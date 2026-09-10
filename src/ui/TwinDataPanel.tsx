import { resolveSpecification } from '../twin/catalog/equipment';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Design, SimulationState } from '../twin/types';
import { solveExchanger } from '../twin/solvers/thermal';
import { calibrateUA, calculateResiduals, connectStream, generateObservations, importObservations, replayObservations, SIMULATION_EPOCH_MS, TelemetryStore, validateObservationMapping, type ImportResult, type ObservationMapping, type StreamStatus, type UACalibrationResult, type UACalibrationSample } from '../twin/telemetry';

const n = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
function downloadGenerated(design: Design, state: SimulationState) {
  const blob = new Blob([JSON.stringify({ schemaVersion: 2, observations: generateObservations(design, state) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'neptune-generated-telemetry.json'; link.click(); URL.revokeObjectURL(url);
}
function fixtureCalibration(design: Design): UACalibrationSample[] {
  const ua = Math.max(10_000, resolveSpecification(design,`${design.modules[0].id}/hx`).ratings.UAWPerK * 0.8);
  return Array.from({ length: 10 }, (_, i) => {
    const boundary = { technicalInletK: 309 + i, seawaterInletK: 291 + i / 3, technicalFlowM3S: 0.05 + i / 1000, seawaterFlowM3S: 0.06, foulingResistanceKPerW: 0 };
    return { assetId: `${design.modules[0].id}/hx`, mappingVersion: design.revision, sourceId: 'generated:calibration-fixture', evidence: 'generated', observedAt: new Date(SIMULATION_EPOCH_MS + i * 1000).toISOString(), observedHeatW: solveExchanger({ ...boundary, cleanUAWPerK: ua }).heatW, boundary };
  });
}

export function DataPanel({ design, state }: { design: Design; state: SimulationState }) {
  const store = useMemo(() => new TelemetryStore(design, { maxStreams: Math.min(20_000, Math.max(2_000, design.modules.length * 8 + 32)) }), [design]);
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [status, setStatus] = useState<StreamStatus | null>(null);
  const [message, setMessage] = useState('');
  const [url, setURL] = useState('http://127.0.0.1:8787/events');
  const [remap, setRemap] = useState(false), [dropout, setDropout] = useState(false);
  const [mappingText, setMappingText] = useState('{"fields":{},"assetIds":{},"metrics":{}}');
  const [imports, setImports] = useState<{ filename: string; result: ImportResult }[]>([]);
  const [historicalMs, setHistoricalMs] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState('generated:simulation-1');
  const [predictionSource, setPredictionSource] = useState('generated:simulation-1');
  const stop = useRef<(() => void) | null>(null), lastSampleTime = useRef(-1);
  const [now, setNow] = useState(() => Date.now());
  const [uaMin, setUAMin] = useState(10_000), [uaMax, setUAMax] = useState(2_000_000);
  const [calibration, setCalibration] = useState<UACalibrationResult | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => () => { stop.current?.(); stop.current = null; }, [design]);
  useEffect(() => {
    if (state.timeS < lastSampleTime.current) store.resetSource('generated:simulation-1', 'Simulation reset/replay boundary', SIMULATION_EPOCH_MS + state.timeS * 1000);
    lastSampleTime.current = state.timeS;
    if (!dropout) for (const observation of generateObservations(design, state)) store.ingest(observation);
  }, [design, state, store, dropout]);

  const samples = store.samples(), sources = [...new Set(samples.map(s => s.sourceId))];
  const streamLimitRejections = store.raw.filter(record => record.result.reason === 'stream-limit').length;
  const sourceSamples = samples.filter(s => s.sourceId === selectedSource).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const viewStore = historicalMs === null ? store : replayObservations(sourceSamples, design, historicalMs);
  const simClock = SIMULATION_EPOCH_MS + state.timeS * 1000;
  const clock = historicalMs ?? (selectedSource.startsWith('generated:simulation') ? simClock : now);
  const rows = design.modules.slice(0, 12).map(spec => ({ id: spec.id, reading: viewStore.staleness(spec.id, 'temperatureK', selectedSource, clock) }));
  const predictions = samples.filter(s => s.sourceId === predictionSource);
  const residuals = calculateResiduals(samples.filter(s => s.sourceId !== predictionSource), predictions);
  const mapping = (): ObservationMapping => {
    if (mappingText.length > 16_384) throw new Error('Mapping JSON exceeds 16 KiB.');
    const explicit = validateObservationMapping(JSON.parse(mappingText));
    return remap ? { ...explicit, mappingVersion: design.revision } : explicit;
  };
  const load = async (file: File) => {
    try {
      if (file.size > 2_097_152) throw new Error('Observation file exceeds 2 MiB.');
      const explicitMapping = mapping();
      const result = importObservations(await file.text(), file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json', design, explicitMapping);
      setImports(previous => [...previous.slice(-2), { filename: file.name, result }]);
      let accepted = 0;
      const reasons: string[] = [];
      // Ingest original parsed rows, so the store and import archive preserve source values/units.
      if (!result.errors.some(error => error.row === 0)) for (const row of result.raw) {
        const ingestion = store.ingest(row.value, explicitMapping);
        if (ingestion.accepted) accepted++;
        else reasons.push(`row ${row.row}: ${ingestion.reason}`);
      }
      setMessage(`${accepted} accepted; ${result.raw.length - accepted} rejected. ${result.errors.filter(error => error.row === 0).map(error => error.message).join(' ')} ${reasons.slice(0, 4).join('; ')}`);
      if (result.accepted[0]) { setSelectedSource(result.accepted[0].sourceId); setHistoricalMs(Date.parse(result.accepted[0].observedAt)); }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };
  const connect = () => {
    try {
      stop.current?.(); let selected = false;
      stop.current = connectStream(url, (raw, reception) => {
        const result = store.ingest(raw, { receivedAt: reception.receivedAt });
        setMessage(result.accepted ? `Accepted stream sample. ${result.warnings.join('; ')}` : `${result.reason}: ${result.warnings.join('; ')}`);
        if (result.observation && !selected) { selected = true; setSelectedSource(result.observation.sourceId); setHistoricalMs(null); }
      }, setStatus);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };
  const fit = (input: readonly UACalibrationSample[]) => {
    try { setCalibration(calibrateUA(design, input, { minUAWPerK: uaMin, maxUAWPerK: uaMax })); setMessage('Calibration proposal evaluated against chronological held-out observations. Design unchanged.'); }
    catch (error) { setCalibration(null); setMessage(error instanceof Error ? error.message : String(error)); }
  };
  const loadCalibration = async (file: File) => {
    try {
      if (file.size > 2_097_152) throw new Error('Calibration file exceeds 2 MiB.');
      const raw: unknown = JSON.parse(await file.text());
      if (!Array.isArray(raw)) throw new Error('Calibration JSON must be an array of boundary/heat observations; see DATA.md.');
      const input = raw as UACalibrationSample[];
      fit(remap ? input.map(sample => ({ ...sample, mappingVersion: design.revision })) : input);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  };

  return <section className="twin-data">
    <h2>Observations & synchronization</h2>
    <p>Simulation truth, generated samples, and measured observations retain separate source identities. Observations do not alter unmeasured solver states. State estimation and forecasts remain unimplemented.</p>
    <p className="muted">{design.modules.length * 8} generated channels · capacity {store.options.maxStreams} source/channel keys · retained replay window: {samples.length} of {store.options.maxSamples} records. Older records leave the bounded replay window; live readings remain available.</p>
    {streamLimitRejections > 0 && <output aria-live="polite">{streamLimitRejections} channel-limit rejections in recent raw records. Some sources are unknown; reset unused sources or reduce the design.</output>}
    <div className="twin-data-grid">
      <div className="twin-card">
        <h3>Local observations</h3>
        <label className="twin-checkbox"><input type="checkbox" checked={remap} onChange={event => setRemap(event.target.checked)} /> Explicitly map imported design version to {design.revision}</label>
        <details><summary>Field, asset, and metric mapping</summary>
          <label>Mapping JSON<textarea aria-label="Telemetry mapping JSON" rows={5} value={mappingText} onChange={event => setMappingText(event.target.value)} style={{ width: '100%', background: '#09202a', color: '#d6e6e8', border: '1px solid #35515b', fontFamily: 'monospace' }} /></label>
          <p>Example: <code>{'{"fields":{"assetId":"sensor","value":"reading"},"assetIds":{"loop-a":"platform-001/module-01"},"metrics":{"bulk":"temperatureK"}}'}</code></p>
          <p>Units convert only through the supported metric contract. Evidence must be explicit. Generated input cannot be promoted to measured.</p>
        </details>
        <label className="twin-file">Import telemetry CSV / JSON<input type="file" accept=".csv,.json" aria-label="Import telemetry CSV or JSON" onChange={event => { if (event.target.files?.[0]) void load(event.target.files[0]); event.target.value = ''; }} /></label>
        <p className="muted">2 MiB / 20,000 rows per file. Unknown assets, units, and incompatible versions are rejected visibly. Imports begin at their historical observation time.</p>
        <label className="twin-checkbox"><input type="checkbox" checked={dropout} onChange={event => setDropout(event.target.checked)} /> Drop generated observations</label>
        <p className="muted">Advance the simulation clock for more than 5 seconds to observe stale generated readings.</p>
        <button onClick={() => downloadGenerated(design, state)}>Export generated sample</button>
      </div>
      <div className="twin-card">
        <h3>Read-only stream</h3>
        <label>Stream URL<input value={url} onChange={event => setURL(event.target.value)} aria-label="Stream URL" /></label>
        <div className="twin-actions"><button onClick={connect}>Connect stream</button><button onClick={() => { stop.current?.(); stop.current = null; }}>Disconnect</button></div>
        <output aria-live="polite">{status ? `${status.state} · ${status.message} · reconnects ${status.reconnects}` : 'Disconnected'}</output>
        <code>node scripts/telemetry-publisher.mjs --mapping-version {design.revision}</code>
        <p className="muted">Local generated fixture, optional HTTPS/CORS gateway. Browser local-network or mixed-content restrictions can block localhost from a hosted page. No gateway is deployed with the static site.</p>
      </div>
    </div>
    {message && <output aria-live="polite">{message}</output>}
    <div className="twin-actions">
      <label>Observation source<select aria-label="Observation source" value={selectedSource} onChange={event => { setSelectedSource(event.target.value); setHistoricalMs(null); }}>{[...new Set(['generated:simulation-1', ...sources])].map(source => <option key={source}>{source}</option>)}</select></label>
      <button onClick={() => setHistoricalMs(sourceSamples[0] ? Date.parse(sourceSamples[0].observedAt) : simClock)}>Historical replay</button>
      <button onClick={() => setHistoricalMs(null)}>Latest observations</button>
      <button onClick={() => { store.resetSource(selectedSource, 'Explicit operator sequence restart'); setMessage(`Reset boundary recorded for ${selectedSource}. Earlier raw records remain in memory; the replay segment restarts.`); }}>Reset selected source sequence</button>
    </div>
    {historicalMs !== null && sourceSamples.length > 1 && <label>Historical observation time<input type="range" min={Date.parse(sourceSamples[0].observedAt)} max={Date.parse(sourceSamples.at(-1)!.observedAt)} value={historicalMs} onChange={event => setHistoricalMs(Number(event.target.value))} /></label>}
    <p className="muted">Selected clock: {new Date(clock).toISOString()} · stale after 5 seconds · no gap filling · first 12 modules shown</p>
    <table><thead><tr><th>Asset</th><th>Observation</th><th>Quality</th><th>Evidence</th></tr></thead><tbody>{rows.map(({ id, reading }) => <tr key={id}><td>{id}</td><td>{reading.observation ? `${n(reading.observation.value - 273.15)} °C` : 'Unknown'}</td><td><span className={`twin-tag ${reading.status}`}>{reading.status}</span></td><td>{reading.observation?.evidence ?? 'none'}</td></tr>)}</tbody></table>
    <h3>Observed versus predicted residuals</h3>
    <label>Prediction source<select aria-label="Prediction source" value={predictionSource} onChange={event => setPredictionSource(event.target.value)}>{[...new Set(['generated:simulation-1', ...samples.filter(sample => sample.evidence === 'generated').map(sample => sample.sourceId)])].map(source => <option key={source}>{source}</option>)}</select></label>
    {residuals.groups.length ? <table><thead><tr><th>Asset / metric</th><th>RMSE</th><th>Pairs / evidence</th></tr></thead><tbody>{residuals.groups.map(group => <tr key={`${group.assetId}${group.metric}${group.sourceId}`}><td>{group.assetId} / {group.metric}</td><td>{n(group.rmse)} {group.unit}</td><td>{group.count} / {group.measuredCount ? 'measured included' : 'generated fixture'}</td></tr>)}</tbody></table> : <p>No compatible timestamped observation/prediction pairs. Measurements need their own physical-to-simulation time alignment; no clock shift is guessed.</p>}
    <p>{residuals.unmatched.length} unmatched samples. Residuals compare matching asset, metric, unit, design revision, and time within 1 second.</p>
    <details><summary>Raw imports and reset boundaries</summary>
      <p>Original parsed rows remain separate from normalized observations. The most recent 3 imports and 5,000 ingestion records are retained in memory. Default project exports exclude observations.</p>
      {imports.map((entry, index) => <article key={`${entry.filename}-${index}`}><strong>{entry.filename}: {entry.result.raw.length} raw rows / {entry.result.errors.length} mapping errors</strong><pre style={{ overflowX: 'auto', maxHeight: 240, fontSize: 11 }}>{JSON.stringify(entry.result.raw.slice(0, 3), null, 2)}</pre></article>)}
      <p>{store.boundaries.map(boundary => `${boundary.sourceId}: ${boundary.reason} at ${boundary.resetAt}`).join(' · ') || 'No source reset boundaries.'}</p>
    </details>
    <details><summary>Bounded exchanger UA calibration</summary>
      <p>Fit one mapped exchanger from 6–1,000 boundary/heat records. The earliest 70% train the proposal; the remaining chronological samples evaluate it. Fouling and fluid properties remain fixed.</p>
      <div className="twin-actions"><label>Minimum UA, W/K<input type="number" min={10000} max={2000000} value={uaMin} onChange={event => setUAMin(Number(event.target.value))} /></label><label>Maximum UA, W/K<input type="number" min={10000} max={2000000} value={uaMax} onChange={event => setUAMax(Number(event.target.value))} /></label></div>
      <div className="twin-actions"><button onClick={() => fit(fixtureCalibration(design))}>Run generated calibration fixture</button><label className="twin-file">Import calibration JSON<input type="file" accept=".json" aria-label="Import calibration JSON" onChange={event => { if (event.target.files?.[0]) void loadCalibration(event.target.files[0]); event.target.value = ''; }} /></label></div>
      {calibration && <div><p>Proposed UA: <strong>{n(calibration.proposedUAWPerK, 0)} W/K</strong> · baseline {n(calibration.baselineUAWPerK, 0)} W/K · {calibration.measuredCount} measured records · {calibration.atBound ? 'at bound' : 'inside bounds'}</p><table><thead><tr><th>Split</th><th>Count</th><th>Baseline RMSE</th><th>Fitted RMSE</th></tr></thead><tbody><tr><td>Training</td><td>{calibration.trainingCount}</td><td>{n(calibration.trainingRmseBeforeW)} W</td><td>{n(calibration.trainingRmseAfterW)} W</td></tr><tr><td>Held out</td><td>{calibration.heldOutCount}</td><td>{n(calibration.heldOutRmseBeforeW)} W</td><td>{n(calibration.heldOutRmseAfterW)} W</td></tr></tbody></table>{calibration.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
      <p>Calibration/physical validation pending. A generated fit verifies this workflow. Compatible time-synchronized measured inlet/outlet temperatures, flows, heat transfer, sensor calibration, and an identified exchanger are required for physical evaluation.</p>
    </details>
  </section>;
}

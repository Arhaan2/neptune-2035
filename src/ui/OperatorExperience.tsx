import type { Design, SimulationState } from '../twin/types';
import { resolveAsset } from '../twin/assets/design';
import { assetConnections, assetOperatingStatus } from '../twin/presentation/assets';
import { operatorEvents, type InspectionResolution, type OperatorEvent } from '../twin/presentation/history';
import { useMemo, useState } from 'react';

const number = (value: number | null | undefined, digits = 3) => value == null || !Number.isFinite(value) ? 'unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: digits });
export type Workspace = 'Explore' | 'Operate' | 'Compare';
const PURPOSE: Record<Workspace, [string, string]> = {
  Explore: ['Understand the installed design', 'Select equipment in the scene or asset list. Trace its power and fluid connections, inspect its installed specification, then open Operate to examine a disturbance.'],
  Operate: ['Follow a disturbance through the system', 'Inspect a recorded fault, its affected domain and the controller response. The current clock belongs to the active simulation; history inspection is a separate view.'],
  Compare: ['Understand the evaluated decision', 'Declare requirements and scenario coverage before ranking candidates. Inspect whole-run outcomes, exact constraint margins and the included-cost tradeoff.'],
};
export function WorkspaceGuide({ workspace, onAssets, onEquipment, onCampus }: { workspace: Workspace; onAssets: () => void; onEquipment: () => void; onCampus: () => void }) {
  return <section className="operator-guide" aria-label={`${workspace} workspace guide`}>
    <div><span className="twin-eyebrow">{workspace.toUpperCase()}</span><h2>{PURPOSE[workspace][0]}</h2><p>{PURPOSE[workspace][1]}</p></div>
    <div className="twin-actions"><button onClick={onCampus}>Campus context</button><button onClick={onAssets}>Browse installed assets</button><button onClick={onEquipment}>Inspect selected equipment</button></div>
  </section>;
}

export function AssetContext({ design, state, assetId, onSelect, origin = 'simulated model' }: { design: Design; state: SimulationState | null; assetId: string; onSelect: (id: string) => void; origin?: string }) {
  const asset = resolveAsset(design, assetId);
  if (!asset) return <output>Unsupported asset identity. Select an installed asset.</output>;
  const module = design.modules.find(item => assetId === item.id || assetId.startsWith(`${item.id}/`));
  const operating = state?.modules.find(item => item.id === module?.id);
  const connections = assetConnections(design, state, assetId);
  const status = assetOperatingStatus(state, assetId);
  return <section className="asset-context" data-testid="asset-context" data-asset-id={assetId} data-time={state?.timeS ?? ''} aria-label="Connected asset context">
    <p><strong>Selected equipment</strong> · <span className={`twin-tag ${status}`} data-testid="asset-operating-status">{status === 'unknown' ? 'Operating status unknown' : status}</span></p>
    <p>Origin: {origin} · {state ? `state at ${number(state.timeS)} s` : 'state unavailable'}. Installed specifications are design assumptions.</p>
    <dl className="twin-properties"><dt>Installed location / parent</dt><dd>{asset.parentId ? <button className="twin-text-button" onClick={() => onSelect(asset.parentId!)}>{asset.parentId}</button> : 'Campus external infrastructure'}</dd><dt>Canonical equipment center</dt><dd>{asset.positionM.map(value => number(value)).join(', ')} m · X, Y, Z</dd></dl>
    {asset.type === 'pump' && <>
      <h3>Pump and circuit operating point</h3>
      <p>The selected pump has its own installed rating and controller status. Flow, pressure and pump power below are module-equivalent solver outputs; individual pump electrical draw is not retained.</p>
      <dl className="twin-properties" data-testid="pump-operating-point"><dt>{assetId.endsWith('/pump-sea') ? 'Seawater' : 'Technical coolant'} circuit flow</dt><dd>{number(operating ? (assetId.endsWith('/pump-sea') ? operating.seawaterFlowM3S : operating.technicalFlowM3S) * 1000 : null)} L/s · module equivalent</dd><dt>Technical circuit pressure</dt><dd>{number(operating ? operating.pressurePa / 1000 : null)} kPa · module equivalent</dd><dt>All module pumps electrical draw</dt><dd>{number(operating?.pumpPowerW)} W · combined</dd></dl>
      <p>Technical coolant exchanges heat with seawater through the exchanger. The circuits do not mix; no seawater reaches computing equipment.</p>
    </>}
    <details open={asset.type === 'pump'}><summary>Direct supported connections ({connections.length})</summary>{connections.length ? <ul className="asset-connection-list">{connections.map(connection => { const other = connection.from === assetId ? connection.to : connection.from; return <li key={connection.id}><span>{connection.medium} · {connection.enabled ? 'connected' : 'open / disabled'}</span><button className="twin-text-button" onClick={() => onSelect(other)}>{other}</button></li>; })}</ul> : <p>No direct connection is represented for this asset. Inspect its parent or the supporting paths.</p>}</details>
    {operating && <details><summary>Warnings for {module!.id} ({operating.warnings.length})</summary>{operating.warnings.length ? operating.warnings.map((warning, index) => <p key={index}>{warning}</p>) : <p>No module warning recorded at this displayed boundary.</p>}</details>}
  </section>;
}

export function InspectionContext({ current, display, mode, status, requestedTimeS, resolution, origin, onReturn, onCancel }: { current: SimulationState | null; display: SimulationState | null; mode: string; status: string; requestedTimeS: number | null; resolution: InspectionResolution | null; origin: string; onReturn: () => void; onCancel: () => void }) {
  const relative = display?.experiment?.originTimeS == null ? null : display.timeS - display.experiment.originTimeS;
  return <section className="inspection-context" data-testid="inspection-context" data-status={status} aria-label="Displayed simulation context" aria-live="polite">
    <strong>{mode === 'history' ? 'Inspecting history' : 'Current simulation state'} · {status}</strong>
    <p>Origin: {origin}. Viewing mode: {mode === 'history' ? 'isolated model replay' : 'current model'}. Current clock: {number(current?.timeS)} s. Displayed scene and operating values: {number(display?.timeS)} s{relative === null ? '' : ` · evaluation-relative ${number(relative)} s`}.</p>
    <p>Run: <code>{current?.experiment?.definition.id ?? 'legacy / uninstrumented'}</code> · {current?.experiment?.definition.name ?? 'Interactive simulation'} · active lifecycle {current?.experiment?.status ?? 'unrecorded'}.</p>
    {mode === 'history' && <><p>Requested event/history time: {number(requestedTimeS)} s. {resolution?.reason ?? 'Resolving the exact engine boundary. Scene and contemporaneous values are unavailable until it resolves.'}</p><p>History does not replace, branch or append to the active experiment. Return to current before issuing simulated commands or resuming its clock.</p><div className="twin-actions"><button onClick={onReturn}>Return to current state</button>{status === 'loading' && <button onClick={onCancel}>Cancel history inspection</button>}</div></>}
  </section>;
}

export function OperatorTimeline({ design, source, display, assetId, selectedEventId, resolution, onInspect, onEvent }: { design: Design; source: SimulationState; display: SimulationState | null; assetId: string; selectedEventId: string | null; resolution: InspectionResolution | null; onInspect: (timeS: number, boundary?: 'post' | 'previous') => void; onEvent: (event: OperatorEvent, boundary?: 'post' | 'previous') => void }) {
  const [draft, setDraft] = useState('0');
  const events = useMemo(() => operatorEvents(source), [source]);
  const selected = events.find(event => event.id === selectedEventId);
  const transition = source.transfer?.transitions.find(item => item.transitionId === selected?.transitionId);
  const module = design.modules.find(item => assetId === item.id || assetId.startsWith(`${item.id}/`));
  const relevant = events.filter(event => event.assetId === assetId || event.affectedAssetIds.includes(assetId) || module && event.affectedAssetIds.includes(module.id));
  const samples = resolution?.status === 'resolved' ? resolution.samples : [];
  const maximumTime = samples.at(-1)?.timeS ?? 0;
  const minimumTemperature = Math.min(290, ...samples.map(sample => sample.coolantK)), maximumTemperature = Math.max(320, ...samples.map(sample => sample.coolantK));
  return <section className="operator-timeline twin-card" aria-label="Operate event and history inspection" data-testid="operator-events">
    <h2>Events, affected assets and exact history</h2>
    <p>Source observation: {source.experiment?.definition.name ?? 'unrecorded simulation'} through {number(source.timeS)} s. Event times are absolute simulation seconds. Selecting one shows the final state after every event and controller transition at that same time.</p>
    <div className="twin-actions"><label>Inspect history at seconds<input aria-label="Inspect history time in seconds" type="number" min="0" max={source.timeS} step="0.125" value={draft} onChange={event => setDraft(event.target.value)} /></label><button disabled={!draft.trim() || !Number.isFinite(Number(draft)) || Number(draft) < 0 || Number(draft) > source.timeS} onClick={() => onInspect(Number(draft))}>Inspect history time</button></div>
    {!source.experiment && <p>Exact historical scenes require a recorded experiment with a saved initial checkpoint. Prepare or load an experiment using the controls below.</p>}
    <details open><summary>Recorded event sequence ({events.length})</summary><ol className="operator-event-list">{events.map(event => <li key={event.id} data-event-id={event.id}><button aria-pressed={event.id === selectedEventId} onClick={() => onEvent(event)}><strong>{number(event.timeS)} s · {event.kind}</strong><span>{event.assetId}</span><small>{event.reason}</small></button></li>)}</ol>{!events.length && <p>No disturbance or controller event has been recorded.</p>}</details>
    {selected && <section className="operator-causal" aria-label="Selected event explanation"><h3>{selected.kind} at {number(selected.timeS)} s</h3><p>{selected.reason}</p><p>Recorded affected assets/domains: {selected.affectedAssetIds.join(', ') || 'unavailable'}. A module-level effect does not establish a separate physical failure for every downstream component.</p><div className="twin-actions"><button onClick={() => onEvent(selected, 'previous')}>Inspect previous committed boundary</button><button onClick={() => onEvent(selected)}>Inspect post-event boundary</button></div>{transition && <><p>Selected transition record {transition.transitionId} · sequence {transition.sequence} · attempt {transition.attemptId ?? 'none'}: {transition.previous} → {transition.status}, reason {transition.reason}.</p><p>This transition’s switch evidence: original {transition.originalClosed ? 'closed' : 'open'}; tie {transition.tieClosed ? 'closed' : 'open'}. The scene shows the final same-time boundary, which may include later transitions.</p><p>Whole-platform electrical admission {number(transition.admittedW)} W; unserved {number(transition.unservedW)} W; decision headroom {number(transition.headroomW)} W; binding resource {transition.bindingResourceId ?? 'none recorded'}. This is the retained decision snapshot, not a new estimate of available donor capacity.</p><p>Original path {transition.originalPath.join(' ← ')}. Donor path {transition.donorPath.join(' ← ')}. Both routes retain the modeled shared shore source.</p></>}{display && <p>At displayed boundary {number(display.timeS)} s: {display.modules.reduce((sum, item) => sum + item.availableAccelerators, 0)} useful accelerators. Direct failed asset IDs: {display.failedAssetIds.join(', ') || 'none recorded'}. Cooling, electrical supply and required networking still jointly limit useful service. Unrecorded causal detail is unavailable.</p>}</section>}
    <details><summary>History for selected asset ({relevant.length} related events)</summary><p>Asset <code>{assetId}</code>{module ? ` · modeled module ${module.id}` : ' · no module operating series available'}.</p>{relevant.map(event => <p key={event.id}><button onClick={() => onEvent(event)}>{number(event.timeS)} s · {event.kind}</button> {event.reason}</p>)}</details>
    <section className="asset-history" data-testid="asset-history" data-asset-id={assetId} aria-label="Selected asset history"><h3>Selected module trend and exact cursor</h3><p>{module ? `${module.id}: module-equivalent bulk coolant and circuit observations` : 'No module-level trend is assigned to this campus asset.'}. Displayed cursor: {number(display?.timeS)} s. {resolution?.truncated ? `${resolution.samples.length} retained display samples from ${resolution.samplesSeen} boundaries; sampled extrema retained.` : 'Retained canonical boundary samples only.'}</p>{samples.length > 0 ? <><svg viewBox="0 0 640 110" aria-label="Selected module bulk coolant history in absolute simulation seconds"><title>Discrete boundary coolant samples; no reconstructed switching states</title><path d="M20 90H620" stroke="#537480" />{samples.map(sample => <circle key={sample.timeS} cx={20 + sample.timeS / Math.max(1, maximumTime) * 600} cy={85 - (sample.coolantK - minimumTemperature) / (maximumTemperature - minimumTemperature) * 65} r="3" fill="#a3efd9" />)}<text x="20" y="107">0 s</text><text x="545" y="107">{number(maximumTime)} s</text></svg><details><summary>Accessible trend values and units</summary><table><caption>{assetId} · simulated module-equivalent output · absolute seconds</caption><thead><tr><th>Time s</th><th>Coolant K</th><th>Technical flow L/s</th><th>Seawater flow L/s</th><th>Pumps W</th><th>Useful accelerators</th></tr></thead><tbody>{samples.map(sample => <tr key={sample.timeS}><td><button onClick={() => onInspect(sample.timeS)}>{number(sample.timeS)}</button></td><td>{number(sample.coolantK)}</td><td>{number(sample.technicalFlowM3S * 1000)}</td><td>{number(sample.seawaterFlowM3S * 1000)}</td><td>{number(sample.pumpPowerW)}</td><td>{sample.availableAccelerators}</td></tr>)}</tbody></table></details></> : <p>Inspect an exact historical boundary of a recorded run to resolve this selected module’s trend. A chart is never used to infer switch positions or failures.</p>}</section>
  </section>;
}

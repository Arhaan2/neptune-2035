import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Waves,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Box,
  Droplets,
  ArrowUpRight,
  Download,
  Activity,
  X,
} from 'lucide-react';
import {
  buildDesign,
  DEFAULT_CONFIG,
  moduleAssets,
  resolveAsset,
} from '../twin/assets/design';
import {
  billOfEquipment,
  conservationResiduals,
  engineeringReport,
  inventoryCSV,
  parseProject,
  projectFile,
  resultsCSV,
  signatureEvents,
  sizingCandidates,
  sizingAssessment,
  topologyForSelection,
  type ProjectFile,
} from '../twin/analysis/reports';
import { summarize } from '../twin/engine/simulation';
import type {
  Design,
  DesignConfig,
  OperationEvent,
  SimulationState,
} from '../twin/types';
import { DataPanel, EvidencePanel, Trend } from './TwinPanels';
import { runWorkerExperiment, useTwin } from './useTwin';
import { upstreamConnections } from '../scene/twinGeometry';
import './twin.css';
const TwinScene = lazy(() => import('../scene/TwinScene'));
const romans = ['I', 'II', 'III'],
  titles = ['Shore-connected pilot', 'Modular campus', 'Segmented archipelago'];
const num = (v: number, d = 1) =>
  Number.isFinite(v)
    ? v.toLocaleString('en-US', { maximumFractionDigits: d })
    : 'Unknown';
function download(name: string, text: string, type = 'application/json') {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
type Focus =
  | 'campus'
  | 'selection'
  | 'cooling'
  | 'top'
  | 'platform'
  | 'module'
  | 'rack';
function NumberField({
  label,
  value,
  unit,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null),
    [error, setError] = useState('');
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    if (!draft.trim() || !Number.isFinite(v) || v < min || v > max) {
      setError(`Use ${min}–${max} ${unit}`);
      setDraft(null);
      return;
    }
    onChange(v);
    setDraft(null);
    setError('');
  };
  return (
    <label className="twin-number">
      <span>{label}</span>
      <span>
        <input
          aria-label={label}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              e.currentTarget.blur();
            }
          }}
        />
        <small>{unit}</small>
      </span>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
interface Compared {
  label: string;
  design: Design;
  state: SimulationState;
}
export default function TwinApp() {
  const [config, setConfig] = useState<DesignConfig>(DEFAULT_CONFIG),
    [workspace, setWorkspace] = useState<'Explore' | 'Operate' | 'Compare'>(
      'Explore',
    ),
    [detail, setDetail] = useState<'inspection' | 'data' | 'evidence'>(
      'inspection',
    );
  const design = useMemo(() => buildDesign(config), [config]),
    sim = useTwin(design),
    { state, replay: replaySimulation, setRunning: setSimulationRunning } = sim;
  const [selectedId, setSelectedId] = useState(
      'platform-001/module-01/pump-duty',
    ),
    [focus, setFocus] = useState<Focus>('campus'),
    [resetId, setResetId] = useState(0),
    [xray, setXray] = useState(false),
    [exploded, setExploded] = useState(false),
    [dimensions, setDimensions] = useState(false),
    [inside, setInside] = useState(false),
    [notice, setNotice] = useState(''),
    [search, setSearch] = useState(''),
    [sceneReady, setSceneReady] = useState(false),
    [demo, setDemo] = useState(false);
  const [comparison, setComparison] = useState<Compared[]>([]),
    [comparisonDescription, setComparisonDescription] = useState(
      'Full load at 0s → selected duty pump trip at 30s → restore at 180s. Both runs use the same parameters through 240s.',
    ),
    [compareBusy, setCompareBusy] = useState(false),
    [saved, setSaved] = useState<{ name: string; project: ProjectFile }[]>(
      () => {
        try {
          const raw = JSON.parse(
            localStorage.getItem('neptune-v2-scenarios') ?? '[]',
          );
          return Array.isArray(raw)
            ? raw.slice(0, 8).map((x) => ({
                name: String(x.name).slice(0, 60),
                project: parseProject(JSON.stringify(x.project)),
              }))
            : [];
        } catch {
          return [];
        }
      },
    ),
    [pendingProject, setPendingProject] = useState<ProjectFile | null>(null),
    [costScale, setCostScale] = useState(1),
    [replayTimeS, setReplayTimeS] = useState(0),
    [maxPlatforms, setMaxPlatforms] = useState(8),
    [sizing, setSizing] = useState('');
  const reducedMotion = useMemo(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const asset = resolveAsset(design, selectedId),
    selectedModule =
      design.modules.find(
        (m) => selectedId === m.id || selectedId.startsWith(`${m.id}/`),
      ) ?? design.modules[0],
    selectedState = state?.modules.find((m) => m.id === selectedModule.id);
  const selectedModuleId = selectedModule.id;
  const details = useMemo(
      () => moduleAssets(design, selectedModuleId),
      [design, selectedModuleId],
    ),
    platform = selectedModule.platformId,
    summary = state ? summarize(design, state) : null,
    residuals = state ? conservationResiduals(design, state) : null,
    cost = useMemo(
      () => billOfEquipment(design, costScale),
      [design, costScale],
    );
  const topology = useMemo(
    () => topologyForSelection(design, selectedId),
    [design, selectedId],
  );
  const powerPaths = upstreamConnections(
    topology.filter((e) => e.medium === 'power'),
    [`${selectedModule.id}/distribution`],
  );
  const direct = topology.filter(
    (e) => e.from === selectedId || e.to === selectedId,
  );
  const select = (id: string, view: Focus = 'selection') => {
    setSelectedId(id);
    setFocus(view);
    setResetId((v) => v + 1);
    setDemo(false);
  };
  const setDesign = (patch: Partial<DesignConfig>) => {
    try {
      const next = { ...config, ...patch };
      const nextDesign = buildDesign(next);
      if (!resolveAsset(nextDesign, selectedId))
        setSelectedId(`${nextDesign.modules[0].id}/pump-duty`);
      setConfig(next);
      setInside(false);
      setDemo(false);
      setNotice(
        'Design revision changed. Clock, stored energy and thermal state reinitialized; simulation paused.',
      );
    } catch (e) {
      setNotice(String(e));
    }
  };
  useEffect(() => {
    if (state && pendingProject) {
      const timer = setTimeout(() => {
        replaySimulation(pendingProject.events, pendingProject.timeS);
        setPendingProject(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state, pendingProject, replaySimulation]);
  const effectiveFocus: Focus = demo
    ? (state?.timeS ?? 0) < 10
      ? 'campus'
      : (state?.timeS ?? 0) < 25
        ? 'module'
        : (state?.timeS ?? 0) < 180
          ? 'cooling'
          : (state?.timeS ?? 0) < 220
            ? 'platform'
            : 'campus'
    : focus;
  const effectiveXray = xray || (demo && (state?.timeS ?? 0) >= 10);
  const sceneRegion = useRef<HTMLDivElement>(null);
  const comparisonRegion = useRef<HTMLElement>(null);
  const cinematicStage =
    demo && (state?.timeS ?? 0) >= 180 && (state?.timeS ?? 0) < 220
      ? 'comparison'
      : 'scene';
  useEffect(() => {
    if (!demo) return;
    const timer = setTimeout(() => {
      (cinematicStage === 'comparison'
        ? comparisonRegion.current
        : sceneRegion.current
      )?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'start',
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [demo, cinematicStage, reducedMotion]);
  useEffect(() => {
    if (!demo || !state || state.timeS !== 0 || sim.busy || sim.running) return;
    const timer = setTimeout(() => setSimulationRunning(true), 0);
    return () => clearTimeout(timer);
  }, [demo, state, sim.busy, sim.running, setSimulationRunning]);
  const showComparison =
    workspace === 'Compare' ||
    (demo && (state?.timeS ?? 0) >= 180 && (state?.timeS ?? 0) < 220);
  useEffect(() => {
    if (!demo || !state || state.timeS < 220 || sim.busy) return;
    const timer = setTimeout(() => {
      setSimulationRunning(false);
      setDemo(false);
      setFocus('campus');
      sceneRegion.current?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'start',
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [demo, state, sim.busy, reducedMotion, setSimulationRunning]);
  const command = (
    kind: OperationEvent['kind'],
    id = selectedId,
    value?: number,
  ) => {
    sim.command(kind, id, value);
    setNotice(`${kind} recorded at ${state?.timeS ?? 0}s for ${id}.`);
  };
  const saveCurrentScenario = () => {
    if (!state) return;
    const next = [
      ...saved.slice(-7),
      {
        name: `${romans[config.generation - 1]} · ${state.timeS}s · ${config.standbyPumps} standby`,
        project: projectFile(design, state),
      },
    ];
    setSaved(next);
    try {
      localStorage.setItem('neptune-v2-scenarios', JSON.stringify(next));
    } catch {
      setNotice(
        'Local storage unavailable. Export a project file to preserve this scenario.',
      );
    }
  };
  const makeComparison = async () => {
    setCompareBusy(true);
    setComparison([]);
    setComparisonDescription(
      'Full load at 0s → selected duty pump trip at 30s → restore at 180s. Both runs use the same parameters through 240s.',
    );
    setNotice(
      'Running the same pump trip and restoration with zero and one standby pump.',
    );
    try {
      const result: Compared[] = [];
      for (const standbyPumps of [0, 1] as const) {
        const d = buildDesign({ ...config, standbyPumps });
        const s = await runWorkerExperiment(
          d,
          signatureEvents(d, selectedModule.id),
          240,
        );
        result.push({
          label: standbyPumps ? 'One standby pump' : 'No standby pump',
          design: d,
          state: s,
        });
      }
      setComparison(result);
      setNotice(
        'Compared identical load and fault events through 240s. Differences follow the modeled capacity and controls.',
      );
    } catch (e) {
      setNotice(String(e));
    } finally {
      setCompareBusy(false);
    }
  };
  const compareSaved = async (mode: 'saved' | 'idle' | 'ua' | 'family') => {
    setCompareBusy(true);
    setComparison([]);
    setComparisonDescription(
      mode === 'family'
        ? 'Same demand: first distribution feeder trips at 30s in each family. These separate runs show the affected power domain and finite UPS response at 240s.'
        : mode === 'saved'
          ? 'The last two saved designs and recorded events are replayed to the same simulated time.'
          : 'Paired assumptions under identical full-load, pump-trip and restoration events, evaluated at 240s. These bounds are not confidence intervals.',
    );
    try {
      const runs: {
        label: string;
        design: Design;
        events: OperationEvent[];
        timeS: number;
      }[] = [];
      if (mode === 'saved') {
        if (saved.length < 2)
          throw Error('Save at least two scenarios to compare.');
        const timeS = Math.max(...saved.slice(-2).map((s) => s.project.timeS));
        for (const item of saved.slice(-2))
          runs.push({
            label: item.name,
            design: buildDesign(item.project.design),
            events: item.project.events,
            timeS,
          });
      } else {
        for (let variant = 0; variant < 2; variant++) {
          const patch: Partial<DesignConfig> =
            mode === 'idle'
              ? {
                  idleFraction: Math.min(
                    0.8,
                    config.idleFraction + variant * 0.1,
                  ),
                }
              : mode === 'ua'
                ? {
                    exchangerUAWPerK: Math.max(
                      10000,
                      config.exchangerUAWPerK * (variant ? 0.7 : 1),
                    ),
                  }
                : { generation: (variant + 1) as 1 | 2 };
          const d = buildDesign({ ...config, ...patch });
          const label =
            mode === 'idle'
              ? `Idle ${num(d.config.idleFraction * 100, 0)}%`
              : mode === 'ua'
                ? `UA ${num(d.config.exchangerUAWPerK / 1000)} kW/K`
                : `Family ${romans[variant]} feeder fault`;
          const events: OperationEvent[] =
            mode === 'family'
              ? [
                  {
                    id: 'feeder-fault',
                    kind: 'trip',
                    assetId: d.modules[0].powerDomainId,
                    timeS: 30,
                  },
                ]
              : signatureEvents(d);
          runs.push({ label, design: d, events, timeS: 240 });
        }
      }
      const result: Compared[] = [];
      for (const r of runs)
        result.push({
          label: r.label,
          design: r.design,
          state: await runWorkerExperiment(r.design, r.events, r.timeS),
        });
      setComparison(result);
      setNotice(
        mode === 'saved'
          ? 'Last two saved scenarios replayed to the same simulated time. Their recorded design and events remain separate.'
          : 'Paired assumptions and identical disturbance semantics; differences follow the same solver. Parameter bounds are not confidence intervals.',
      );
    } catch (e) {
      setNotice(String(e));
    } finally {
      setCompareBusy(false);
    }
  };
  const runSizing = async () => {
    setCompareBusy(true);
    setSizing(
      'Evaluating bounded whole-platform candidates under a pump trip…',
    );
    try {
      let best: Compared | undefined;
      const rows: string[] = [];
      for (const d of sizingCandidates(config, maxPlatforms)) {
        const s = await runWorkerExperiment(d, signatureEvents(d), 180),
          sum = summarize(d, s);
        const assessment = sizingAssessment(d, s, config.budgetUSD, costScale);
        const pass = assessment.passes;
        rows.push(
          `${d.assets.filter((a) => a.type === 'platform').length} platforms: ${pass ? 'satisfies evaluated cuts' : assessment.failures.join(', ')} (${num(sum.maxCoolantK - 273.15)}°C, ${num(sum.availableAccelerators, 0)} available)`,
        );
        if (pass) best = { label: 'Sized candidate', design: d, state: s };
      }
      setSizing(
        `${best ? `Largest passing sampled candidate: ${num(best.design.provisionedAccelerators, 0)} accelerators.` : 'No solution among sampled candidates.'} ${rows.join(' · ')} Uses the declared reference traffic profile and ${costScale}× included cost assumptions. Marine stability, application-specific traffic validation and excluded costs remain unassessed.`,
      );
    } catch (e) {
      setSizing(String(e));
    } finally {
      setCompareBusy(false);
    }
  };
  const sceneProps = state
    ? {
        design,
        state,
        selectedId,
        onSelect: (id: string) => select(id),
        xray: effectiveXray,
        exploded,
        dimensions,
        inside,
        onExitInterior: () => setInside(false),
        focus: effectiveFocus,
        resetId,
        reducedMotion,
        onManual: () => setDemo(false),
        onReady: () => setSceneReady(true),
      }
    : null;
  return (
    <main
      className="twin-app"
      data-ready={state !== null}
      data-scene-ready={sceneReady}
      data-selected={selectedId}
      data-workspace={workspace}
      data-time={state?.timeS ?? 0}
      onWheelCapture={() => {
        if (demo) setDemo(false);
      }}
    >
      <header className="twin-header">
        <a className="twin-brand" href="./">
          <Waves size={27} />
          <span>
            NEPTUNE <small>v2</small>
          </span>
        </a>
        <nav aria-label="Workspaces">
          {(['Explore', 'Operate', 'Compare'] as const).map((w) => (
            <button
              className={workspace === w ? 'active' : ''}
              key={w}
              onClick={() => {
                setWorkspace(w);
                setDemo(false);
              }}
            >
              {w}
            </button>
          ))}
        </nav>
        <div className="twin-header-end">
          <button
            onClick={() =>
              setDetail(detail === 'evidence' ? 'inspection' : 'evidence')
            }
          >
            Evidence <ArrowUpRight size={14} />
          </button>
          <a href="?legacy=1">Legacy v0.1</a>
        </div>
      </header>
      <div className="twin-mode">
        <span>
          <i /> Design-stage digital twin · Simulated operation
        </span>
        <span>{design.revision} · 1 world unit = 1 m</span>
      </div>
      <div className="twin-layout">
        <aside className="twin-design">
          <div className="twin-eyebrow">
            REFERENCE DESIGN / {String(config.generation).padStart(2, '0')}
          </div>
          <h1>NEPTUNE {romans[config.generation - 1]}</h1>
          <p>{titles[config.generation - 1]}</p>
          <div className="twin-generations">
            {[1, 2, 3].map((g) => (
              <button
                key={g}
                className={config.generation === g ? 'active' : ''}
                onClick={() => setDesign({ generation: g as 1 | 2 | 3 })}
                aria-label={`Design family ${romans[g - 1]}`}
              >
                {romans[g - 1]}
              </button>
            ))}
          </div>
          <label className="twin-preset">
            Starting scenario
            <select
              aria-label="Starting scenario"
              value=""
              onChange={(e) => {
                const count = Number(e.target.value);
                setDesign({
                  requestedAccelerators: count,
                  supplyW:
                    count === 10000
                      ? 30e6
                      : count === 100000
                        ? 300e6
                        : count === 500000
                          ? 1.2e9
                          : 10e9,
                });
              }}
            >
              <option value="" disabled>
                Choose capacity…
              </option>
              <option value="10000">10,000 accelerator pilot</option>
              <option value="100000">100,000 campus</option>
              <option value="500000">500,000 archipelago</option>
              <option value="1000000">1,000,000 bounded scale test</option>
            </select>
          </label>
          <NumberField
            label="Requested accelerators"
            value={config.requestedAccelerators}
            unit="units"
            min={8}
            max={1000000}
            onChange={(v) => setDesign({ requestedAccelerators: v })}
          />
          <NumberField
            label="Supply ceiling"
            value={config.supplyW / 1e6}
            unit="MW"
            min={0}
            max={10000}
            onChange={(v) => setDesign({ supplyW: v * 1e6 })}
          />
          <label className="twin-number">
            <span>Standby cooling</span>
            <select
              aria-label="Standby cooling"
              value={config.standbyPumps}
              onChange={(e) =>
                setDesign({ standbyPumps: Number(e.target.value) as 0 | 1 })
              }
            >
              <option value={0}>No standby</option>
              <option value={1}>One standby / module</option>
            </select>
          </label>
          <details className="twin-assumptions">
            <summary>Design assumptions</summary>
            <NumberField
              label="Initial seawater"
              value={Number((config.seawaterK - 273.15).toFixed(2))}
              unit="°C"
              min={2}
              max={38}
              onChange={(v) => setDesign({ seawaterK: v + 273.15 })}
            />
            <NumberField
              label="Initial workload"
              value={config.workload}
              unit="fraction"
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setDesign({ workload: v })}
            />
            <NumberField
              label="Idle draw"
              value={config.idleFraction}
              unit="fraction"
              min={0.1}
              max={0.8}
              step={0.05}
              onChange={(v) => setDesign({ idleFraction: v })}
            />
            <NumberField
              label="Exchanger UA"
              value={config.exchangerUAWPerK / 1000}
              unit="kW/K"
              min={10}
              max={2000}
              onChange={(v) => setDesign({ exchangerUAWPerK: v * 1000 })}
            />
            <NumberField
              label="Storage per module"
              value={config.batteryWhPerModule / 1000}
              unit="kWh"
              min={0}
              max={2000}
              onChange={(v) => setDesign({ batteryWhPerModule: v * 1000 })}
            />
            <label className="twin-checkbox">
              <input
                type="checkbox"
                checked={config.requireExternalNetwork}
                onChange={(e) =>
                  setDesign({ requireExternalNetwork: e.target.checked })
                }
              />{' '}
              Workload requires external access
            </label>
            <label className="twin-checkbox">
              <input
                type="checkbox"
                checked={config.requireClusterNetwork}
                onChange={(e) =>
                  setDesign({ requireClusterNetwork: e.target.checked })
                }
              />{' '}
              Workload requires cluster connectivity
            </label>
            <p>
              Changing design reinitializes operation. Whole-server 12 kW /
              8-accelerator proxy; all hardware envelopes assumed.
            </p>
          </details>
          <div className="twin-tree">
            <h2>Asset hierarchy</h2>
            <label>
              Platform
              <select
                aria-label="Select platform"
                value={platform}
                onChange={(e) =>
                  select(
                    design.modules.find((m) => m.platformId === e.target.value)!
                      .id,
                    'platform',
                  )
                }
              >
                {design.assets
                  .filter((a) => a.type === 'platform')
                  .map((a) => (
                    <option key={a.id}>{a.id}</option>
                  ))}
              </select>
            </label>
            <div role="tree" aria-label="Asset hierarchy">
              {design.modules
                .filter((m) => m.platformId === platform)
                .map((m) => (
                  <button
                    role="treeitem"
                    aria-selected={m.id === selectedModule.id}
                    key={m.id}
                    onClick={() => select(m.id, 'module')}
                  >
                    <Box size={14} /> {m.id.split('/').at(-1)}{' '}
                    <small>{m.rackCount} racks</small>
                  </button>
                ))}
            </div>
            <label>
              Exact equipment
              <select
                aria-label="Select equipment"
                value={
                  selectedId.startsWith(selectedModule.id + '/')
                    ? selectedId
                    : ''
                }
                onChange={(e) => select(e.target.value)}
              >
                <option value="">Module assembly</option>
                {details
                  .filter((a) => a.type !== 'compute')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.type}
                    </option>
                  ))}
                {details
                  .filter(
                    (a) =>
                      a.type === 'compute' &&
                      (selectedId === a.id || selectedId === a.parentId),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id.split('/').slice(-2).join('/')} · compute
                    </option>
                  ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (resolveAsset(design, search)) select(search);
                else
                  setNotice(
                    'Unknown asset ID. Exact IDs are available in the inventory export.',
                  );
              }}
            >
              <input
                aria-label="Find asset ID"
                placeholder="Resolve exact asset ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit">Find</button>
            </form>
          </div>
        </aside>
        <section className="twin-center">
          <div className="twin-scene-shell" ref={sceneRegion}>
            <div className="twin-scene-caption">
              <span>
                {focus === 'campus'
                  ? 'FACILITY / DIMENSIONED MODEL'
                  : `INSPECT / ${asset?.type.toUpperCase() ?? 'MODULE'}`}
              </span>
              <strong>
                {focus === 'campus'
                  ? `${design.modules.length} modules · ${num(design.rackCount, 0)} exact racks`
                  : selectedId}
              </strong>
            </div>
            {sceneProps ? (
              <Suspense
                fallback={
                  <div className="twin-loading">
                    Loading the dimensioned scene. Asset inspection and
                    calculations remain available.
                  </div>
                }
              >
                <TwinScene {...sceneProps} />
              </Suspense>
            ) : (
              <div className="twin-loading">
                Initializing the simulation worker… {sim.error}
              </div>
            )}
            <div className="twin-scene-toolbar" aria-label="Scene controls">
              <button aria-pressed={xray} onClick={() => setXray(!xray)}>
                <Layers size={15} /> X-ray
              </button>
              <button
                aria-pressed={exploded}
                onClick={() => setExploded(!exploded)}
              >
                Explode
              </button>
              <button
                aria-pressed={dimensions}
                onClick={() => setDimensions(!dimensions)}
              >
                Dimensions
              </button>
              <button
                onClick={() => {
                  setFocus('cooling');
                  setXray(true);
                  setResetId((v) => v + 1);
                  setDemo(false);
                }}
              >
                <Droplets size={15} /> Cooling close-up
              </button>
              <button
                onClick={() => {
                  setInside(!inside);
                  setXray(true);
                  setDemo(false);
                }}
              >
                {inside ? 'Exit interior' : 'Inside module'}
              </button>
              <button
                aria-label="Campus view"
                onClick={() => {
                  setInside(false);
                  setFocus('campus');
                  setResetId((v) => v + 1);
                  setDemo(false);
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => {
                  setFocus('top');
                  setDimensions(true);
                  setResetId((v) => v + 1);
                }}
              >
                Plan
              </button>
            </div>
          </div>
          <div className="twin-metrics">
            {[
              [
                'Provisioned',
                `${num(design.provisionedAccelerators, 0)}`,
                `${design.nodeCount} whole servers`,
              ],
              [
                'Facility draw',
                `${num((summary?.facilityW ?? 0) / 1e6, 2)} MW`,
                'IT + cooling + conversion',
              ],
              [
                'Workload available',
                num(summary?.availableAccelerators ?? 0, 0),
                `${num(summary?.energizedAccelerators ?? 0, 0)} energized`,
              ],
              [
                'Bulk coolant',
                summary ? `${num(summary.maxCoolantK - 273.15, 2)} °C` : '—',
                'Maximum modeled module',
              ],
            ].map(([label, value, note]) => (
              <div key={label}>
                <span>{label}</span>
                <strong
                  data-testid={
                    label === 'Facility draw'
                      ? 'twin-power'
                      : label === 'Bulk coolant'
                        ? 'twin-temperature'
                        : undefined
                  }
                >
                  {value}
                </strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div className="twin-clock">
            <button
              className="primary"
              disabled={!state || sim.busy}
              onClick={() => {
                setDemo(false);
                sim.setRunning(!sim.running);
              }}
            >
              {sim.running ? <Pause size={16} /> : <Play size={16} />}{' '}
              {sim.running ? 'Pause' : 'Start'}
            </button>
            <strong data-testid="sim-time">{state?.timeS ?? 0}s</strong>
            <label>
              Speed
              <select
                aria-label="Simulation speed"
                value={sim.speed}
                onChange={(e) => sim.setSpeed(Number(e.target.value))}
              >
                {[1, 5, 20, 60].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={sim.busy || !state}
              onClick={() => sim.advance(10)}
            >
              Step 10s
            </button>
            <button
              disabled={sim.busy || !state}
              onClick={() => {
                sim.reset();
                setDemo(false);
              }}
            >
              Reset state
            </button>
            <button
              disabled={sim.busy || !state}
              onClick={() => {
                setDemo(false);
                if (state) sim.replay(state.events, state.timeS);
              }}
            >
              Replay
            </button>
            <label>
              Replay to
              <input
                aria-label="Replay time in seconds"
                type="number"
                min={0}
                max={86400}
                step={1}
                value={replayTimeS}
                onChange={(e) => setReplayTimeS(Number(e.target.value))}
                style={{ width: 76 }}
              />
              s
            </label>
            <button
              disabled={
                sim.busy ||
                !state ||
                !Number.isInteger(replayTimeS) ||
                replayTimeS < 0 ||
                replayTimeS > 86400
              }
              onClick={() => {
                if (state) {
                  setDemo(false);
                  sim.replay(state.events, replayTimeS);
                }
              }}
            >
              Seek time
            </button>
            {sim.busy && (
              <button
                onClick={() => {
                  setDemo(false);
                  sim.cancel();
                }}
              >
                Cancel run
              </button>
            )}
            <span>
              {sim.busy ? 'Solving…' : sim.running ? 'Running' : 'Paused'} ·
              fixed 1s steps
            </span>
          </div>
          {(notice || sim.error) && (
            <div className={`twin-notice ${sim.error ? 'error' : ''}`}>
              {sim.error || notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                <X size={14} />
              </button>
            </div>
          )}
          {state && !showComparison && <Trend history={sim.history} />}
          {showComparison && (
            <section className="twin-compare" ref={comparisonRegion}>
              <div className="twin-section-line">
                <h2>
                  {demo
                    ? 'Generation topology comparison'
                    : 'Compare reproducible scenarios'}
                </h2>
                <button
                  disabled={compareBusy}
                  onClick={() => void makeComparison()}
                >
                  {compareBusy ? 'Evaluating…' : 'Compare pump experiment'}
                </button>
              </div>
              <p>{comparisonDescription}</p>
              <div className="twin-comparison-grid">
                {comparison.map((c) => {
                  const s = summarize(c.design, c.state),
                    m =
                      c.state.modules.find((m) => m.id === selectedModule.id) ??
                      c.state.modules[0];
                  return (
                    <article className="twin-card" key={c.label}>
                      <h3>{c.label}</h3>
                      <div className="twin-comparison-scene">
                        <Suspense fallback={null}>
                          <TwinScene
                            {...sceneProps!}
                            design={c.design}
                            state={c.state}
                            selectedId={`${selectedModule.id}/pump-duty`}
                            focus={
                              c.label.startsWith('Family')
                                ? 'platform'
                                : 'cooling'
                            }
                            xray
                            inside={false}
                            onManual={() => setDemo(false)}
                            onReady={() => {}}
                          />
                        </Suspense>
                      </div>
                      <p>
                        {num(m.coolantK - 273.15, 2)} °C ·{' '}
                        {num(m.technicalFlowM3S * 1000, 2)} L/s
                      </p>
                      <p>
                        {num(s.availableAccelerators, 0)} available /{' '}
                        {num(c.design.provisionedAccelerators, 0)}
                      </p>
                      <p>
                        {num(s.facilityW / 1e6, 2)} MW ·{' '}
                        {
                          c.state.log.filter((e) => e.kind === 'controller')
                            .length
                        }{' '}
                        controller actions
                      </p>
                      <p>
                        {num(s.gridW / 1e6, 2)} MW grid import ·{' '}
                        {num(s.batteryWh / 1000, 1)} kWh stored
                      </p>
                      <button
                        onClick={() =>
                          download(
                            `experiment-${c.design.config.standbyPumps}-standby.json`,
                            JSON.stringify(
                              projectFile(c.design, c.state),
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        Export reproducible run
                      </button>
                    </article>
                  );
                })}
              </div>
              {comparison.length === 2 && (
                <p className="twin-delta">
                  {comparison[1].label} minus {comparison[0].label} at{' '}
                  {comparison[0].state.timeS}s:{' '}
                  {num(
                    (comparison[1].state.modules.find(
                      (m) => m.id === selectedModule.id,
                    )?.coolantK ?? 0) -
                      (comparison[0].state.modules.find(
                        (m) => m.id === selectedModule.id,
                      )?.coolantK ?? 0),
                    3,
                  )}{' '}
                  K coolant;{' '}
                  {num(
                    summarize(comparison[1].design, comparison[1].state)
                      .availableAccelerators -
                      summarize(comparison[0].design, comparison[0].state)
                        .availableAccelerators,
                    0,
                  )}{' '}
                  available accelerators.
                </p>
              )}
              <div className="twin-actions">
                <button
                  disabled={!state}
                  onClick={() => {
                    saveCurrentScenario();
                  }}
                >
                  Save current scenario locally
                </button>
                <button
                  disabled={compareBusy || saved.length < 2}
                  onClick={() => void compareSaved('saved')}
                >
                  Compare last two saved
                </button>
                <button
                  disabled={compareBusy}
                  onClick={() => void compareSaved('family')}
                >
                  Compare family feeder fault
                </button>
                {saved.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setConfig(s.project.design);
                      setPendingProject(s.project);
                      setNotice(
                        `Restoring ${s.name} through deterministic replay.`,
                      );
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <details>
                <summary>
                  Build Your AI Factory · bounded scenario sizing
                </summary>
                <NumberField
                  label="Maximum platforms"
                  value={maxPlatforms}
                  unit="platforms"
                  min={1}
                  max={200}
                  onChange={setMaxPlatforms}
                />
                <NumberField
                  label="Included-scope budget"
                  value={(config.budgetUSD ?? 0) / 1e6}
                  unit="million USD (0 = unset)"
                  min={0}
                  max={10000000}
                  onChange={(v) =>
                    setDesign({ budgetUSD: v === 0 ? null : v * 1e6 })
                  }
                />
                <button disabled={compareBusy} onClick={() => void runSizing()}>
                  Evaluate discrete candidates
                </button>
                <p>
                  {sizing ||
                    'Uses current supply, thermal assumptions, standby and optional included-scope budget. Fixed reference packing; 1–200 platform limit.'}
                </p>
              </details>
              <details>
                <summary>Cost scope and assumption sensitivity</summary>
                <div className="twin-actions">
                  <button
                    disabled={compareBusy}
                    onClick={() => void compareSaved('idle')}
                  >
                    Paired idle-draw sensitivity
                  </button>
                  <button
                    disabled={compareBusy}
                    onClick={() => void compareSaved('ua')}
                  >
                    Paired exchanger-UA sensitivity
                  </button>
                </div>
                <NumberField
                  label="Equipment cost multiplier"
                  value={costScale}
                  unit="× assumed price"
                  min={0.5}
                  max={2}
                  step={0.1}
                  onChange={setCostScale}
                />
                <p>
                  Included-scope estimate ${num(cost.totalUSD / 1e6, 1)} million
                  · dated {cost.date}. Editable cost multiplier explores
                  sensitivity; range {num(cost.rangeUSD[0] / 1e6)}–
                  {num(cost.rangeUSD[1] / 1e6)} million is not a confidence
                  interval.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Scope</th>
                      <th>Quantity</th>
                      <th>Assumed USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cost.rows.map((r) => (
                      <tr key={r.scope}>
                        <td>{r.scope}</td>
                        <td>{num(r.count, 0)}</td>
                        <td>{num(r.totalUSD, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Installation assumption</td>
                      <td>20%</td>
                      <td>{num(cost.installation, 0)}</td>
                    </tr>
                    <tr>
                      <td>Contingency assumption</td>
                      <td>25%</td>
                      <td>{num(cost.contingency, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p>{cost.exclusions}</p>
                <p>
                  Change idle fraction or exchanger UA in Design assumptions,
                  run the same experiment, then save both scenarios for paired
                  sensitivity comparisons.
                </p>
              </details>
            </section>
          )}
          {state && (
            <div hidden={detail !== 'data'}>
              <DataPanel key={design.revision} design={design} state={state} />
            </div>
          )}
          {state && detail === 'evidence' && (
            <EvidencePanel design={design} state={state} />
          )}
        </section>
        <aside className="twin-inspector">
          <div className="twin-eyebrow">
            {workspace === 'Operate'
              ? 'OPERATE / SELECTED ASSET'
              : 'EXACT ASSET INSPECTION'}
          </div>
          <h2>{asset?.name ?? 'Select an asset'}</h2>
          <code className="twin-id">{selectedId}</code>
          <span
            className={`twin-tag ${state?.failedAssetIds.includes(selectedId) ? 'failed' : ''}`}
          >
            {selectedState?.states[selectedId] ??
              (state?.failedAssetIds.includes(selectedId)
                ? 'failed'
                : 'available')}{' '}
            · simulated
          </span>
          {asset && (
            <dl className="twin-properties">
              <dt>Envelope (W × H × D)</dt>
              <dd>{asset.dimensionsM.map((v) => num(v, 3)).join(' × ')} m</dd>
              <dt>Operational mass</dt>
              <dd>
                {asset.operationalMassKg === null
                  ? 'Unknown / outside floating boundary'
                  : `${num(asset.operationalMassKg)} kg`}
              </dd>
              <dt>Catalog / evidence</dt>
              <dd>{asset.catalogId} · assumed</dd>
              <dt>Failure domain</dt>
              <dd>
                <button
                  className="twin-text-button"
                  onClick={() => select(asset.failureDomain)}
                >
                  {asset.failureDomain}
                </button>
              </dd>
              {asset.type === 'rack' && (
                <>
                  <dt>Occupancy</dt>
                  <dd>
                    {asset.ratings.occupiedU} U / {asset.ratings.slotsU} U ·{' '}
                    {asset.ratings.nodes} whole servers
                  </dd>
                </>
              )}
            </dl>
          )}
          {asset && (
            <details>
              <summary>Ratings and ports</summary>
              <table>
                <tbody>
                  {Object.entries(asset.ratings).map(([key, value]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{num(value, 6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <table>
                <thead>
                  <tr>
                    <th>Port</th>
                    <th>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.ports.map((port) => (
                    <tr key={port.id}>
                      <td>
                        {port.medium} · {port.direction}
                      </td>
                      <td>
                        {num(port.capacity, 3)} {port.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                Assumption records: {asset.provenance.join(', ')}. Position:{' '}
                {asset.positionM.map((v) => num(v, 3)).join(', ')} m in the
                canonical model.
              </p>
            </details>
          )}
          {selectedState && (
            <>
              <h3>Module operating point</h3>
              <dl className="twin-properties">
                <dt>Technical / seawater flow</dt>
                <dd data-testid="selected-flow">
                  {num(selectedState.technicalFlowM3S * 1000, 2)} /{' '}
                  {num(selectedState.seawaterFlowM3S * 1000, 2)} L/s
                </dd>
                <dt>Hydraulic pressure</dt>
                <dd>{num(selectedState.pressurePa / 1000)} kPa</dd>
                <dt>Coolant / residual air</dt>
                <dd>
                  {num(selectedState.coolantK - 273.15, 2)} /{' '}
                  {num(selectedState.airK - 273.15, 2)} °C
                </dd>
                <dt>Stored battery energy</dt>
                <dd>{num(selectedState.batteryWh / 1000, 2)} kWh</dd>
                <dt>Instantaneous / energy PUE</dt>
                <dd>
                  {summary?.instantaneousPUE === null
                    ? 'Undefined'
                    : num(summary?.instantaneousPUE ?? 0, 3)}{' '}
                  /{' '}
                  {summary?.energyPUE === null
                    ? 'Undefined'
                    : num(summary?.energyPUE ?? 0, 3)}
                </dd>
              </dl>
            </>
          )}
          <div className="twin-inspector-actions">
            <button
              className="danger"
              disabled={sim.busy || !state}
              onClick={() => command('trip')}
            >
              Trip selected asset
            </button>
            <button
              disabled={sim.busy || !state}
              onClick={() => command('restore')}
            >
              Restore selected asset
            </button>
            <button
              onClick={() =>
                select(`${selectedModule.id}/pump-duty`, 'cooling')
              }
            >
              Inspect duty pump
            </button>
          </div>
          {workspace === 'Operate' && (
            <>
              <h3>Recorded boundary commands</h3>
              <div className="twin-actions">
                <button
                  disabled={sim.busy}
                  onClick={() => command('workload', 'shore/grid', 1)}
                >
                  Full load
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() => command('seawater', 'shore/grid', 305.15)}
                >
                  Seawater 32°C
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() => command('fouling', 'shore/grid', 0.00001)}
                >
                  Foul exchanger
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() => command('trip', selectedModule.powerDomainId)}
                >
                  Lose feeder
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() =>
                    command('restore', selectedModule.powerDomainId)
                  }
                >
                  Restore feeder
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() => command('maintenance', selectedModule.id)}
                >
                  Isolate module
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() => command('restore', selectedModule.id)}
                >
                  Return module
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() =>
                    command('trip', selectedModule.networkDomainId)
                  }
                >
                  Lose cluster link
                </button>
                <button
                  disabled={sim.busy}
                  onClick={() => command('trip', 'shore/fiber')}
                >
                  Lose external link
                </button>
              </div>
              <button
                className="twin-demo"
                disabled={sim.busy || !state}
                onClick={() => {
                  if (demo) {
                    setDemo(false);
                    sim.setRunning(false);
                  } else {
                    void compareSaved('family');
                    sim.replay(signatureEvents(design, selectedModule.id), 0);
                    setDemo(true);
                    sim.setSpeed(20);
                  }
                }}
              >
                {demo ? 'Stop cinematic' : 'Play pump-failure cinematic'}
              </button>
              <h3>Causal event log</h3>
              <ol className="twin-log">
                {state?.log
                  .slice(-18)
                  .reverse()
                  .map((e, i) => (
                    <li key={`${e.timeS}-${i}`}>
                      <span>
                        {e.timeS}s · {e.kind}
                      </span>
                      <button onClick={() => select(e.assetId)}>
                        {e.assetId}
                      </button>
                      <p>{e.message}</p>
                    </li>
                  ))}
              </ol>
            </>
          )}
          <details open={workspace === 'Explore'}>
            <summary>Supporting paths & connections</summary>
            <div className="twin-path">
              {powerPaths.map((edge) => (
                <div key={edge.id}>
                  <button onClick={() => select(edge.from)}>{edge.from}</button>
                  <span>
                    {edge.enabled ? '↓' : 'open tie ·'}{' '}
                    {num(edge.capacity / 1000, 0)} kW capacity
                  </span>
                  <button onClick={() => select(edge.to)}>{edge.to}</button>
                </div>
              ))}
            </div>
            <div className="twin-connections">
              {direct.length ? (
                direct.slice(0, 14).map((e) => (
                  <button
                    key={e.id}
                    className={e.medium}
                    onClick={() =>
                      select(e.from === selectedId ? e.to : e.from)
                    }
                  >
                    <span>
                      {e.medium} {e.enabled ? '→' : 'tie open'}
                    </span>
                    {e.from === selectedId ? e.to : e.from}
                  </button>
                ))
              ) : (
                <p>
                  Select a component to trace its ports. All shared domains
                  remain explicit.
                </p>
              )}
            </div>
            <p className="muted">
              Technical coolant and seawater exchange heat across the HX; fluids
              do not mix. Colored paths are connectivity, not CFD.
            </p>
          </details>
          <h3>Inspect the evidence</h3>
          <div className="twin-actions">
            <button
              onClick={() =>
                setDetail(detail === 'data' ? 'inspection' : 'data')
              }
            >
              <Activity size={14} /> Data & replay
            </button>
            <button
              onClick={() =>
                setDetail(detail === 'evidence' ? 'inspection' : 'evidence')
              }
            >
              Constraints & sources
            </button>
          </div>
          {summary && (
            <p className="twin-residuals">
              Residuals · electrical {num(summary.electricalResidualW, 5)} W ·
              thermal {num(summary.thermalResidualW, 5)} W · solver{' '}
              {num(state?.solverMs ?? 0, 2)} ms
              <br />
              Normalized · electrical{' '}
              {residuals?.electricalNormalized.toExponential(2)} · thermal{' '}
              {residuals?.thermalNormalized.toExponential(2)}
            </p>
          )}
          {summary?.warnings.length !== 0 && (
            <div className="twin-warnings">
              {summary?.warnings.slice(0, 5).map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
        </aside>
      </div>
      <footer className="twin-footer">
        <span>Arhaan Aggarwal · Calibration / physical validation pending</span>
        <div>
          <label className="twin-file">
            Import project
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                try {
                  if (e.target.files?.[0]) {
                    const p = parseProject(await e.target.files[0].text());
                    setConfig(p.design);
                    setPendingProject(p);
                    setNotice(
                      'Imported bounded v2 design and event history. Replaying numerical state.',
                    );
                  }
                } catch (err) {
                  setNotice(String(err));
                }
                e.target.value = '';
              }}
            />
          </label>
          <select
            aria-label="Export artifact"
            defaultValue=""
            disabled={!state}
            onChange={async (e) => {
              if (!state) return;
              const kind = e.target.value;
              e.target.value = '';
              try {
                if (kind === 'project')
                  download(
                    'neptune-v2-project.json',
                    JSON.stringify(projectFile(design, state), null, 2),
                  );
                if (kind === 'events')
                  download(
                    'neptune-v2-events.json',
                    JSON.stringify(
                      {
                        schemaVersion: 2,
                        designRevision: design.revision,
                        solverVersion: state.solverVersion,
                        events: state.events,
                      },
                      null,
                      2,
                    ),
                  );
                if (kind === 'results')
                  download(
                    'neptune-v2-results.csv',
                    resultsCSV(design, state),
                    'text/csv',
                  );
                if (kind === 'inventory')
                  download(
                    'neptune-v2-inventory.csv',
                    inventoryCSV(design),
                    'text/csv',
                  );
                if (kind === 'report')
                  download(
                    'neptune-v2-engineering.md',
                    engineeringReport(design, state, costScale),
                    'text/markdown',
                  );
                if (kind === 'gltf') {
                  const { geometryGLTF } = await import('../scene/TwinScene');
                  download(
                    'neptune-v2-dimensioned.gltf',
                    JSON.stringify(await geometryGLTF(design)),
                  );
                }
              } catch (err) {
                setNotice(String(err));
              }
            }}
          >
            <option value="" disabled>
              Export…
            </option>
            <option value="project">Versioned project JSON</option>
            <option value="events">Experiment events JSON</option>
            <option value="results">Results CSV</option>
            <option value="inventory">Equipment inventory CSV</option>
            <option value="report">Engineering report</option>
            <option value="gltf">Dimensioned glTF</option>
          </select>
          <Download size={14} />
        </div>
      </footer>
    </main>
  );
}

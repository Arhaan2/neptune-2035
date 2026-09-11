import { DecisionPanel } from './DecisionPanel';
import { TransferPanel } from './TransferPanel';
import { activePowerDesign } from '../twin/transfer/topology';
import type { ExperimentDefinition } from '../twin/experiment/types';
import { ExperimentPanel, ExperimentReport, ExperimentComparison, CounterfactualReport } from './ExperimentPanel';
import { signatureDemonstration, referenceExperiment } from '../twin/experiment/demonstrations';
import { counterfactualDefinition } from '../twin/experiment/runner';
import { createExperimentDefinition } from '../twin/experiment/definition';
import { REFERENCE_CATALOG, resolveSpecification, roleForAsset, equipmentFor, updateEconomicAssumptions, installedEquipmentIdentity } from '../twin/catalog/equipment';
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
  replaceEquipment,
  reconfigureDesign,
  DEFAULT_CONFIG,
  moduleAssets,
  resolveAsset,
  withNetworkPreset,
  withNetworkConnectionEnabled,
} from '../twin/assets/design';
import type { NetworkPreset } from '../twin/network-contract';
import { TwinNetworkPanel } from './TwinNetworkPanel';
import {
  billOfEquipment,
  conservationResiduals,
  engineeringReport,
  inventoryCSV,
  resultsCSV,
  signatureEvents,
  topologyForSelection,
} from '../twin/analysis/reports';
import { summarize, initializeExperimentFromState } from '../twin/engine/simulation';
import {
  compatibilityFor,
  parseProject,
  projectFile,
  recalculateProject,
  serializeProject,
} from '../twin/persistence/project';
import type {
  CurrentProject,
  ProjectFile,
  ProjectProvenance,
} from '../twin/persistence/types';
import { CONTRACT, type IntegrationStep } from '../twin/persistence/limits';
import type {
  Design,
  DesignConfig,
  OperationEvent,
  SimulationState,
} from '../twin/types';
import { DataPanel, EvidencePanel, Trend } from './TwinPanels';
import { runWorkerExperiment, useTwin } from './useTwin';
import { upstreamConnections } from '../scene/twinGeometry';
import {
  preflightJSON,
  validateStructure,
} from '../twin/persistence/structure';
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
function readSavedScenarios(): {
  items: { name: string; project: ProjectFile }[];
  error?: string;
} {
  try {
    const text = localStorage.getItem('neptune-v2-scenarios') ?? '[]';
    preflightJSON(text);
    const raw: unknown = JSON.parse(text);
    validateStructure(raw);
    if (!Array.isArray(raw) || raw.length > CONTRACT.maxSavedScenarios)
      throw Error('Saved scenario collection has an invalid count.');
    const items = raw.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.name !== 'string' ||
        item.name.length > 60
      )
        throw Error('Saved scenario name is invalid.');
      return {
        name: item.name,
        project: parseProject(JSON.stringify(item.project)),
      };
    });
    return { items };
  } catch (problem) {
    return {
      items: [],
      error: `Saved scenario recovery failed: ${String(problem)}. Stored data was retained.`,
    };
  }
}
interface Compared {
  role?: 'faulted' | 'unfaulted';
  provenance?: ProjectProvenance;
  label: string;
  design: Design;
  state: SimulationState;
}
export default function TwinApp() {
  const [config, setConfig] = useState<DesignConfig>(DEFAULT_CONFIG),
    [designOverride, setDesignOverride] = useState<Design | null>(null),
    [workspace, setWorkspace] = useState<'Explore' | 'Operate' | 'Compare'>(
      'Explore',
    ),
    [detail, setDetail] = useState<'inspection' | 'data' | 'evidence'>(
      'inspection',
    );
  const design = useMemo(
      () => designOverride ?? buildDesign(config),
      [config, designOverride],
    ),
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
    [savedRead] = useState(readSavedScenarios),
    [saved, setSaved] = useState(savedRead.items),
    [pendingProject, setPendingProject] = useState<CurrentProject | null>(null),
    [inspectionProject, setInspectionProject] = useState<ProjectFile | null>(
      null,
    ),
    [replacementSpec, setReplacementSpec] = useState('pump-efficient'),
    [replayTimeS, setReplayTimeS] = useState(0);
  const [pendingPhase5,setPendingPhase5]=useState<ExperimentDefinition|null>(null);
  useEffect(()=>{if(pendingPhase5&&state?.designRevision===pendingPhase5.designRevision&&!sim.busy){const timer=setTimeout(()=>{sim.prepareExperiment(pendingPhase5);setPendingPhase5(null);},0);return()=>clearTimeout(timer);}},[pendingPhase5,state?.designRevision,sim]);
  const costScale=equipmentFor(design).economics.unitCostScale;
  const setCostScale=(value:number)=>setDesignOverride(updateEconomicAssumptions(design,{unitCostScale:value}));
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
  const computeSpec=resolveSpecification(design,'compute');
  const installedSpec=asset&&roleForAsset(asset.id)?resolveSpecification(design,asset.id):null;
  const proposedSpec=REFERENCE_CATALOG.find(spec=>spec.id===replacementSpec)!;
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
    () => topologyForSelection(state?activePowerDesign(design,state):design, selectedId),
    [design, selectedId, state],
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
  const retainBeforeRevision = (label: string) => {
    if (!state || sim.busy) throw Error('Wait for the current worker operation to complete before changing the design.');
    const history = [...saved.slice(-(CONTRACT.maxSavedScenarios - 1)), {name: `${label} · ${state.timeS}s`, project: sim.captureProject()}];
    const serialized = JSON.stringify(history.map(item => ({name: item.name, project: JSON.parse(serializeProject(item.project))})));
    preflightJSON(serialized); validateStructure(history);
    localStorage.setItem('neptune-v2-scenarios', serialized);
    setSaved(history); sim.cancel(); setPendingProject(null);
  };
  const setDesign = (patch: Partial<DesignConfig>, nominalPreset = false) => {
    try {
      const next = { ...config, ...patch };
      if(Object.keys(patch).every(key=>key==='budgetUSD')) {
        setConfig(next);setDesignOverride({...design,config:next});setNotice('Economic budget updated. Physical state and engineering identity retained.');return;
      }
      const startingDesign = nominalPreset && !equipmentFor(design).networkDesign ? withNetworkPreset(design, 'scalable-reference') : design;
      const nextDesign = reconfigureDesign(startingDesign, patch);
      retainBeforeRevision('Before design change');
      if (!resolveAsset(nextDesign, selectedId))
        setSelectedId(`${nextDesign.modules[0].id}/pump-duty`);
      setDesignOverride(nextDesign);
      setConfig(next);
      setInside(false);
      setDemo(false);
      setNotice(
        'Design revision changed. Previous experiment saved in Compare. Clock, stored energy and thermal state reinitialized; simulation paused.',
      );
    } catch (e) {
      setNotice(String(e));
    }
  };
  const applyNetwork = (preset: NetworkPreset) => {
    try {
      const next = withNetworkPreset(design, preset);
      retainBeforeRevision('Before network change');
      setDesignOverride(next); setConfig(next.config); select('shore/cluster-core');
      setNotice('Network applied as a new design revision. Prior checkpoint and events saved in Compare; new run paused at 0 s. Old observation mappings remain incompatible.');
    } catch (problem) { setNotice(`Network change was not applied; current run retained. ${String(problem)}`); }
  };
  const changeNetworkConnection = (id: string, enabled: boolean) => {
    try {
      const next = withNetworkConnectionEnabled(design, id, enabled);
      retainBeforeRevision('Before network link change');
      setDesignOverride(next); setConfig(next.config); setDemo(false);
      setNotice(`Network link ${enabled ? 'enabled' : 'disabled'} in a new design revision. Prior run saved in Compare; new run paused at 0 s. No alternate routing is modeled.`);
    } catch (problem) { setNotice(`Link change was not applied; current run retained. ${String(problem)}`); }
  };
  useEffect(() => {
    if (state && pendingProject) {
      const timer = setTimeout(() => {
        replaySimulation(
          pendingProject.events,
          pendingProject.timeS,
          pendingProject.provenance,
          1,
          createExperimentDefinition(pendingProject.designSnapshot, { name: 'Explicit derived whole experiment', durationS: pendingProject.timeS, disturbances: pendingProject.events }),
        );
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
  const endpointTimes=comparison.map(item=>item.state.experiment?.metrics.elapsedS??item.state.timeS);
  const endpointModules=comparison.map(item=>item.state.modules.find(module=>module.id===selectedModule.id));
  const comparableEndpoint=comparison.length===2&&Boolean(comparison[0].state.experiment)===Boolean(comparison[1].state.experiment)&&endpointTimes[0]===endpointTimes[1]&&endpointModules.every(module=>module!==undefined);
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
  const inspectOrRestore = (project: ProjectFile) => {
    const compatibility = compatibilityFor(project);
    if (!compatibility.canResume) {
      setInspectionProject(project);
      setNotice(compatibility.explanation);
      return;
    }
    const restored = sim.restore(project);
    setConfig(restored.config);
    setDesignOverride(restored);
    setPendingProject(null);
    if (!resolveAsset(restored, selectedId))
      setSelectedId(`${restored.modules[0].id}/pump-duty`);
    setDemo(false);
    setNotice(
      `Restored exact checkpoint at ${project.timeS}s. ${compatibility.explanation}`,
    );
  };
  const recalculateInspected = () => {
    if (!inspectionProject) return;
    try {
      const derived = recalculateProject(inspectionProject);
      sim.cancel();
      setConfig(derived.design);
      setDesignOverride(derived.designSnapshot);
      setPendingProject(derived);
      setNotice(
        `Separate derived experiment: recalculating ${inspectionProject.solverVersion} with ${derived.solverVersion}. The original remains available for export.`,
      );
    } catch (problem) {
      setNotice(String(problem));
    }
  };
  const saveCurrentScenario = () => {
    if (!state) return;
    const next = [
      ...saved.slice(-(CONTRACT.maxSavedScenarios - 1)),
      {
        name: `${romans[config.generation - 1]} · ${state.timeS}s · ${config.standbyPumps} standby`,
        project: sim.captureProject(),
      },
    ];
    try {
      const serialized = JSON.stringify(
        next.map((item) => ({
          name: item.name,
          project: JSON.parse(serializeProject(item.project)),
        })),
      );
      preflightJSON(serialized);
      validateStructure(next);
      localStorage.setItem('neptune-v2-scenarios', serialized);
      setSaved(next);
      setNotice(`Scenario saved locally at ${state.timeS}s.`);
    } catch {
      setNotice(
        'Local storage unavailable. Export a project file to preserve this scenario.',
      );
    }
  };
  const applyReplacement = () => {
    if(!state||sim.busy||!asset||asset.type!=='pump')return;
    try {
      const nextDesign=replaceEquipment(design,asset.id,replacementSpec);
      const oldProject=sim.captureProject();
      const history=[...saved.slice(-(CONTRACT.maxSavedScenarios-1)),{name:`Before replacement · ${state.timeS}s`,project:oldProject}];
      const serialized=JSON.stringify(history.map(item=>({name:item.name,project:JSON.parse(serializeProject(item.project))})));
      preflightJSON(serialized);validateStructure(history);
      localStorage.setItem('neptune-v2-scenarios',serialized);
      sim.cancel();setSaved(history);setDesignOverride(nextDesign);setDemo(false);setPendingProject(null);
      setNotice('Replacement applied as a new physical design revision. Simulation paused and reset to declared initial conditions. The prior project and its event history are saved in Compare. Observation mappings from the old revision are incompatible and have been cleared.');
    } catch(problem) {
      setNotice(`Replacement was not applied; current run retained. ${String(problem)} Export the current project if local history storage is unavailable.`);
    }
  };
  const makeComparison = async () => {
    setCompareBusy(true);
    setComparison([]);
    setComparisonDescription(
      'Full load at 0s → selected duty pump trip at 30s → restore at 180s. Both runs use the same parameters through 240s.',
    );
    setNotice(
      'Running the same pump trip and restoration with zero and one standby pump. Installed specifications are preserved; the separate no-standby design omits any removed standby slot override.',
    );
    try {
      const result: Compared[] = [];
      for (const standbyPumps of [0, 1] as const) {
        const d = reconfigureDesign(design,{standbyPumps},{removedOverrides:'omit-in-derived-design'});
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
  const comparePhase4 = async (kind: 'signature' | 'pair') => {
    setDemo(false); setCompareBusy(true); setComparison([]);
    setNotice('0/2 experiments completed. Running canonical worker execution.');
    setComparisonDescription(kind === 'signature'
      ? 'Signature: 1,280 requested accelerators, full workload, cold start, duty pump trip at 30 s and restore at 300 s; 1,800 s evaluation. Supported designs differ only by an installed standby pump. Close final coolant means ≤0.01 K difference; close final air means ≤0.1 K. Both absolute histories use identical disturbance scope; each design needs its own unfaulted baseline for incremental attribution.'
      : 'Faulted and unfaulted pair: identical initial physical state, workload, environment, policy and numerical settings. Core trip at 5 s and restore at 15 s; baseline suppresses only those declared faults. Both evaluate 20 s.');
    try {
      const result: Compared[] = [];
      if (kind === 'signature') {
        for (const item of signatureDemonstration()) {
          const state=await runWorkerExperiment(item.design, [], item.definition.durationS, item.definition.integrationStepS, item.definition, progress=>setNotice(`${result.length}/2 experiments completed. ${item.definition.name}: ${progress.completedTimeS}/${progress.targetTimeS} physical seconds committed.`));
          result.push({label:item.definition.name,design:item.design,state});
          setComparison([...result]);
          setNotice(`${result.length}/2 experiments completed. Validated whole-run reports appear as each worker finishes.`);
        }
      } else {
        const faulted = referenceExperiment(design), baseline = counterfactualDefinition(design, faulted);
        for (const [role, definition] of [['faulted', faulted], ['unfaulted', baseline]] as const) result.push({ role, label: role === 'faulted' ? 'Faulted experiment' : 'Unfaulted baseline', design, state: await runWorkerExperiment(design, [], definition.durationS, definition.integrationStepS, definition) });
      }
      setComparison(result); setNotice('Real worker execution complete. Compare the final state with authoritative whole-run interruption and recovery metrics.');
    } catch (error) { setNotice(String(error)); } finally { setCompareBusy(false); }
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
      if (mode === 'saved' && saved.length >= 2 && saved.slice(-2).every(item => item.project.schemaVersion === 3 && item.project.checkpoint?.state.experiment)) {
        setComparison(saved.slice(-2).map(item => { const project = item.project as CurrentProject; return { label: item.name, design: project.designSnapshot, state: project.checkpoint!.state, provenance: project.provenance }; }));
        setComparisonDescription('Saved whole experiments retain their original observed windows, definitions, lifecycle and metrics. Axes align at evaluation origin. Unequal durations or cross-design disturbance footprints are separate absolute observations; they do not form an equivalent faulted/unfaulted pair.');
        return;
      }
      const runs: {
        label: string;
        design: Design;
        events: OperationEvent[];
        timeS: number;
        integrationStepS?: IntegrationStep;
        provenance?: ProjectProvenance;
      }[] = [];
      if (mode === 'saved') {
        if (saved.length < 2)
          throw Error('Save at least two scenarios to compare.');
        const timeS = Math.max(...saved.slice(-2).map((s) => s.project.timeS));
        for (const item of saved.slice(-2)) {
          if (
            item.project.schemaVersion !== 3 ||
            !compatibilityFor(item.project).canResume
          )
            throw Error(
              'Inspect and explicitly recalculate legacy or incompatible saved scenarios before comparing under the current model.',
            );
          runs.push({
            label: item.name,
            design: item.project.designSnapshot,
            events: item.project.events,
            timeS,
            integrationStepS: item.project.checkpoint!.state.integrationStepS,
            provenance: item.project.provenance,
          });
        }
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
          const d = reconfigureDesign(design,patch);
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
          ...(r.provenance ? { provenance: r.provenance } : {}),
          state: await runWorkerExperiment(
            r.design,
            r.events,
            r.timeS,
            r.integrationStepS,
          ),
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
        <span>Public prototype — simulated, design-stage model</span>
        <span>Simulated, design-stage prototype.</span>
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
                disabled={sim.busy || !state}
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
              disabled={sim.busy || !state}
              value=""
              onChange={(e) => {
                const count = Number(e.target.value);
                setDesign({
                  requestedAccelerators: count,
                  supplyW:
                    count <= 10000
                      ? 30e6
                      : count === 100000
                        ? 300e6
                        : count === 500000
                          ? 1.2e9
                          : 10e9,
                }, true);
              }}
            >
              <option value="" disabled>
                Choose capacity…
              </option>
              <option value="8">8 accelerator fast reference</option>
              <option value="1280">1,280 accelerator module</option>
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
              Changing physical design reinitializes operation. Installed whole-server reference: {num(computeSpec.ratings.capacityW/1000)} kW / {computeSpec.ratings.accelerators} accelerators, {computeSpec.name} v{computeSpec.version}; hardware envelopes are assumed.
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
              disabled={!state || (!sim.running && sim.busy)}
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
                if (state && sim.replay(state.events, state.timeS, undefined, state.integrationStepS, state.experiment?.definition)) setNotice('Replay created an explicit derived experiment containing all recorded interactive inputs and the saved physical initial state.');
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
                max={CONTRACT.horizonS}
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
                replayTimeS > CONTRACT.horizonS
              }
              onClick={() => {
                if (state) {
                  setDemo(false);
                  if(sim.replay(state.events, replayTimeS, undefined, state.integrationStepS, state.experiment?.definition))setNotice('Seek created an explicit derived experiment containing all recorded interactive inputs and the saved physical initial state.');
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
            {!sim.busy &&
              sim.resumeTarget !== null &&
              state &&
              sim.resumeTarget > state.timeS && (
                <button onClick={() => sim.resume()}>
                  Resume to {sim.resumeTarget}s
                </button>
              )}
            <span>
              {sim.busy ? 'Solving…' : sim.running ? 'Running' : 'Paused'} ·
              fixed {state?.integrationStepS ?? 1}s steps
            </span>
          </div>
          {sim.progress && sim.busy && (
            <output>
              Replay progress: {sim.progress.completedTimeS}s /{' '}
              {sim.progress.targetTimeS}s. Completed checkpoints can be exported
              while running.
            </output>
          )}
          {savedRead.error && <output>{savedRead.error}</output>}
          {sim.storageStatus && (
            <output data-testid="checkpoint-storage">
              {sim.storageStatus}
              {sim.durableTimeS !== null &&
                ` Last successful local checkpoint: ${sim.durableTimeS}s.`}
            </output>
          )}
          {sim.recoveryBlocked && (
            <div className="twin-notice">
              Automatic saving is paused because the previous recovery data
              could not be read. The stored value has been retained.
              <button onClick={() => sim.dismissRecovery()}>
                Clear unavailable recovery and enable saving
              </button>
            </div>
          )}
          {sim.recovery && (
            <div className="twin-notice" data-testid="checkpoint-recovery">
              Local checkpoint available at {sim.recovery.timeS}s. Progress
              after that saved checkpoint may have been lost. Recovery is
              paused.
              <button
                disabled={sim.busy}
                onClick={() => {
                  try {
                    inspectOrRestore(sim.recovery!);
                  } catch (problem) {
                    setNotice(String(problem));
                  }
                }}
              >
                Recover saved checkpoint
              </button>
              <button
                onClick={() =>
                  download(
                    'neptune-recovery-project.json',
                    serializeProject(sim.recovery!),
                  )
                }
              >
                Export recovery project
              </button>
              <button onClick={() => sim.dismissRecovery()}>
                Discard recovery and keep current session
              </button>
            </div>
          )}
          {inspectionProject && (
            <div className="twin-notice" data-testid="project-compatibility">
              <p>{compatibilityFor(inspectionProject).explanation}</p>
              <p>
                Saved scenario: {inspectionProject.timeS}s,{' '}
                {inspectionProject.events.length} events, solver{' '}
                {inspectionProject.solverVersion}. Exact continuation is{' '}
                {compatibilityFor(inspectionProject).canResume
                  ? 'available'
                  : 'unavailable'}
                .
              </p>
              <button
                onClick={() =>
                  download(
                    'neptune-original-project.json',
                    serializeProject(inspectionProject),
                  )
                }
              >
                Export original project
              </button>
              <button
                disabled={!compatibilityFor(inspectionProject).canRecalculate}
                onClick={recalculateInspected}
              >
                Recalculate with current model
              </button>
              <button onClick={() => setInspectionProject(null)}>
                Close project inspection
              </button>
            </div>
          )}
          {(notice || sim.error) && (
            <div className={`twin-notice ${sim.error ? 'error' : ''}`}>
              {sim.error || notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                <X size={14} />
              </button>
            </div>
          )}
          <TransferPanel design={design} state={state} busy={sim.busy||compareBusy} onSelect={select} onRun={definition=>sim.startExperiment(definition)} onLoad={(next,definition)=>{try{retainBeforeRevision('Before Phase 5 reference');setDesignOverride(next);setConfig(next.config);setPendingPhase5(definition);setDemo(false);setWorkspace('Operate');select(next.transfer!.routes[0].tieId);}catch(e){setNotice(String(e));}}}/>
          {state && <ExperimentPanel design={design} state={state} busy={sim.busy} hidden={showComparison} onStart={(definition) => { setDemo(false); sim.startExperiment(definition); }} onPrepare={(definition) => { setDemo(false); sim.prepareExperiment(definition); }} onPause={() => sim.setRunning(false)} onStep={() => sim.advance(1)} onCancel={() => sim.cancel()} />}
          {state && !showComparison && <Trend history={sim.history} />}
          <DecisionPanel hidden={!showComparison} activeDesign={design} state={state} busy={sim.busy||compareBusy}
            onLoad={run=>{retainBeforeRevision('Before Phase 6 candidate');const prepared=initializeExperimentFromState(run.design,run.initialState,run.definition);const next=sim.restore(projectFile(run.design,prepared));setDesignOverride(next);setConfig(next.config);setDemo(false);select(next.modules[0].id);setNotice('Selected decision candidate loaded with its exact scenario and physical initial state. Previous project saved in Compare; run explicitly when ready.');}}
            onRun={run=>{setDemo(false);sim.replay([],run.definition.durationS,undefined,run.definition.integrationStepS,run.definition);setWorkspace('Operate');}} />
          {showComparison && (
            <section className="twin-compare" ref={comparisonRegion} aria-busy={compareBusy}>
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
              <div className="twin-actions"><button disabled={compareBusy} onClick={() => void comparePhase4('signature')}>Run signature demonstration</button><button disabled={compareBusy} onClick={() => void comparePhase4('pair')}>Run faulted / unfaulted pair</button></div>
              <p>{comparisonDescription}</p>
              {comparison.some(item => item.state.experiment) && <ExperimentComparison runs={comparison} />}
              {comparison[0]?.role === 'faulted' && comparison[1]?.role === 'unfaulted' && <CounterfactualReport faulted={comparison[0].state} baseline={comparison[1].state} />}
              <div className="twin-comparison-grid">
                {comparison.map((c) => {
                  const s = summarize(c.design, c.state),
                    m = c.state.modules.find((m) => m.id === selectedModule.id);
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
                      {m ? <p>
                        {num(m.coolantK - 273.15, 2)} °C ·{' '}
                        {num(m.technicalFlowM3S * 1000, 2)} L/s
                      </p> : <p>Selected module {selectedModule.id} is not installed in this design; its endpoint temperature and flow are unavailable.</p>}
                      <p>
                        {num(s.availableAccelerators, 0)} available /{' '}
                        {num(c.design.provisionedAccelerators, 0)}
                      </p>
                      <p>
                        {num(s.facilityW / 1e6, 2)} MW ·{' '}
                        {
                          c.state.experiment?.metrics.controllerTransitionCount ?? c.state.log.filter((e) => e.kind === 'controller').length
                        }{' '}
                        controller actions
                      </p>
                      <p>
                        {num(s.gridW / 1e6, 2)} MW grid import ·{' '}
                        {num(s.batteryWh / 1000, 1)} kWh stored
                      </p>
                      <ExperimentReport state={c.state} compact />
                      <button
                        onClick={() =>
                          download(
                            `experiment-${c.design.config.standbyPumps}-standby.json`,
                            serializeProject(
                              projectFile(
                                c.design,
                                c.state,
                                c.provenance
                                  ? { provenance: c.provenance }
                                  : {},
                              ),
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
              {comparableEndpoint && (
                <p className="twin-delta">
                  {comparison[1].label} minus {comparison[0].label} at{' '}
                  {comparison[0].state.experiment?'evaluation time ':'physical time '}{endpointTimes[0]}s:{' '}
                  {num(
                    endpointModules[1]!.coolantK-endpointModules[0]!.coolantK,
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
              {comparison.length===2&&!comparableEndpoint&&<p role="note">Endpoint difference unavailable: matching observation times and the selected installed module in both designs are required. Each run retains its own time and full-run report.</p>}
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
                      inspectOrRestore(s.project);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <p className="muted">The earlier endpoint sizing tool is superseded by Phase 6 decision support above. Its recommendations assess every declared whole experiment in the bounded candidate menu.</p>
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
                  {cost.completeWithinIncludedScope ? 'Included-scope estimate' : 'Known included-scope subtotal'} ${num(cost.totalUSD / 1e6, 1)} million
                  · dated {cost.date}. Editable cost multiplier explores
                  sensitivity; range {num(cost.rangeUSD[0] / 1e6)}–
                  {num(cost.rangeUSD[1] / 1e6)} million is not a confidence
                  interval.
                </p>
                {!cost.completeWithinIncludedScope && <p>Missing declared prices: {cost.missingCostAssetIds.join(', ')}. This subtotal is incomplete.</p>}
                <p>{cost.networkAccounting}</p>
                <table>
                  <thead>
                    <tr>
                      <th>Scope</th>
                      <th>Quantity</th>
                      <th>Assumed USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cost.rows.map((r, index) => (
                      <tr key={`${index}:${r.scope}`}>
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
              <dd data-testid="installed-spec">{installedSpec?`${installedSpec.name} · ${installedSpec.id} · v${installedSpec.version}`:`${asset.catalogId} · v${asset.revision}`} · assumed</dd>
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
          <TwinNetworkPanel design={design} state={state} busy={sim.busy} selectedId={selectedId} onSelect={select} onApply={applyNetwork} onConnection={changeNetworkConnection} />
          {asset?.type==='pump'&&installedSpec&&(
            <section aria-label="Replace installed pump">
              <h3>Replace installed pump</h3>
              <label className="twin-preset">Replacement specification
                <select aria-label="Replacement specification" value={replacementSpec} onChange={event=>setReplacementSpec(event.target.value)}>
                  {REFERENCE_CATALOG.filter(spec=>spec.type==='pump'&&spec.compatibility===installedSpec.compatibility).map(spec=><option key={spec.id} value={spec.id}>{spec.name} · v{spec.version}</option>)}
                </select>
              </label>
              <div data-testid="proposed-spec-details">
                <p><strong>{proposedSpec.name} · v{proposedSpec.version}</strong></p>
                <p>Compatible reference water-loop interfaces. Shutoff {num(proposedSpec.ratings.shutoffPa/1000)} kPa; free flow {num(proposedSpec.ratings.freeFlowM3S*1000)} L/s; efficiency {num(proposedSpec.ratings.efficiency*100)}%; motor rating {num(proposedSpec.ratings.capacityW/1000)} kW.</p>
                <p>Envelope {proposedSpec.dimensionsM?.map(v=>num(v,3)).join(' × ')} m; declared mass {num(proposedSpec.operationalMassKg??NaN)} kg. Included assumed price USD {num(equipmentFor(design).economics.specificationUnitUSD[`${proposedSpec.id}@${proposedSpec.version}`]??NaN,0)}.</p>
                <p>{proposedSpec.assumptions}</p>
                <p>Applying creates a new physical design revision and resets the clock, temperatures, stored energy, controller state and event history to declared initial conditions. The old project stays in saved scenarios; old telemetry mappings are incompatible.</p>
                <button disabled={sim.busy||!state||installedSpec.id===replacementSpec} onClick={applyReplacement}>Apply and reset</button>
              </div>
              <details><summary>Installed equipment identity</summary><code className="twin-id">{installedEquipmentIdentity(design,asset.id)}</code><p>The asset ID remains the logical slot. The specification and design revision identify this installation.</p></details>
            </section>
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
                    if (e.target.files[0].size > CONTRACT.maxProjectBytes)
                      throw Error(
                        `Project exceeds ${CONTRACT.maxProjectBytes} UTF-8 bytes.`,
                      );
                    const p = parseProject(await e.target.files[0].text());
                    inspectOrRestore(p);
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
                    'neptune-v3-project.json',
                    serializeProject(sim.captureProject()),
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

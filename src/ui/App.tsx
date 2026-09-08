import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDownUp,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Cpu,
  Droplets,
  Expand,
  Eye,
  Focus,
  Layers,
  Link2,
  Maximize,
  Network,
  Pause,
  Play,
  Settings2,
  SlidersHorizontal,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BOUNDS,
  PRESETS,
  fmt,
  presetScenario,
  simulate,
  type Scenario,
} from '../domain/model';
import { decodeScenario, encodeScenario } from '../state/scenario';
import { SOURCES } from '../domain/sources';
import type { System } from '../scene/layout';
const Scene = lazy(() => import('../scene/Scene'));
const romans = ['I', 'II', 'III'];
function Control({
  label,
  unit,
  field,
  scenario,
  step = 1,
  displayFactor = 1,
  onChange,
}: {
  label: string;
  unit: string;
  field: Exclude<keyof Scenario, 'generation'>;
  scenario: Scenario;
  step?: number;
  displayFactor?: number;
  onChange: (field: keyof Scenario, value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [min, max] = BOUNDS[field];
  const value = scenario[field] * displayFactor;
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft) / displayFactor;
    if (
      !draft.trim() ||
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (field === 'requestedGpuCount' && !Number.isInteger(n))
    ) {
      setError(true);
      setDraft(null);
      return;
    }
    onChange(field, n);
    setError(false);
    setDraft(null);
  };
  return (
    <div className="control">
      <div className="control-label">
        <label htmlFor={field}>{label}</label>
        <span className="numeric">
          <input
            id={field}
            aria-label={label}
            type="number"
            min={min * displayFactor}
            max={max * displayFactor}
            step={step * displayFactor}
            value={draft ?? Number(value.toFixed(4))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commit();
                e.currentTarget.blur();
              }
            }}
            aria-invalid={error}
          />
          <span>{unit}</span>
        </span>
      </div>
      <Slider
        aria-label={`${label} slider`}
        value={[value]}
        min={min * displayFactor}
        max={max * displayFactor}
        step={step * displayFactor}
        onValueChange={(v) => {
          onChange(field, (Array.isArray(v) ? v[0] : v) / displayFactor);
          setDraft(null);
          setError(false);
        }}
      />
      <div className="range-ends">
        <span>{fmt(min * displayFactor, 0)}</span>
        <span>
          {fmt(max * displayFactor, max * displayFactor < 10 ? 2 : 0)}
        </span>
      </div>
      {error && (
        <p className="input-error" role="alert">
          Use {min * displayFactor}–{max * displayFactor} {unit}. Previous value
          restored.
        </p>
      )}
    </div>
  );
}
export default function App() {
  const [initial] = useState(() => decodeScenario(location.hash));
  const [restoredDefaults, setRestoredDefaults] = useState(
    initial.restoredDefaults,
  );
  const [scenario, setScenario] = useState<Scenario>(initial.scenario);
  const [xray, setXray] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [inside, setInside] = useState(false);
  const [selected, setSelected] = useState<System>('overview');
  const [resetId, setResetId] = useState(0);
  const [lowEffects, setLowEffects] = useState(false);
  const [assumptions, setAssumptions] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const demoBackup = useRef<Scenario | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const model = useMemo(() => simulate(scenario), [scenario]);
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(q.matches);
    q.addEventListener('change', change);
    return () => q.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!demo)
      history.replaceState(
        null,
        '',
        location.pathname + location.search + encodeScenario(scenario),
      );
  }, [scenario, demo]);
  useEffect(() => {
    const handle = () => {
      const next = decodeScenario(location.hash);
      setScenario(next.scenario);
      setRestoredDefaults(next.restoredDefaults);
      setShareLink('');
      setResetId((v) => v + 1);
    };
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, []);
  const stopDemo = useCallback(() => {
    setDemo(false);
    setDemoStep(0);
    setXray(false);
    setExploded(false);
    setInside(false);
    setSelected('overview');
    if (demoBackup.current) {
      setScenario(demoBackup.current);
      demoBackup.current = null;
    }
    setResetId((v) => v + 1);
  }, []);
  const manual = useCallback(() => {
    if (demo) stopDemo();
  }, [demo, stopDemo]);
  const update = (field: keyof Scenario, value: number) => {
    manual();
    setScenario((s) => ({ ...s, [field]: value }));
  };
  const chooseSystem = useCallback(
    (s: System) => {
      manual();
      setSelected(s);
    },
    [manual],
  );
  const reset = () => {
    manual();
    setXray(false);
    setExploded(false);
    setInside(false);
    setSelected('overview');
    setResetId((v) => v + 1);
  };
  const startDemo = () => {
    demoBackup.current = { ...scenario };
    setScenario(presetScenario(2));
    setInside(false);
    setXray(false);
    setExploded(false);
    setSelected('overview');
    setResetId((v) => v + 1);
    setDemoStep(0);
    setDemo(true);
  };
  useEffect(() => {
    if (!demo) return;
    const schedule: [number, () => void][] = [
      [
        5000,
        () => {
          setDemoStep(1);
          setXray(true);
        },
      ],
      [
        10000,
        () => {
          setDemoStep(2);
          setSelected('cooling');
        },
      ],
      [
        15000,
        () => {
          setDemoStep(3);
          setExploded(true);
        },
      ],
      [
        20000,
        () => {
          setDemoStep(4);
          setSelected('overview');
          setExploded(false);
          setXray(false);
          setScenario(presetScenario(3));
        },
      ],
      [26000, () => setDemoStep(5)],
      [30000, stopDemo],
    ];
    const timers = schedule.map(([t, f]) => setTimeout(f, t));
    const hidden = () => {
      if (document.hidden) stopDemo();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [demo, stopDemo]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (demo) stopDemo();
        else if (inside) setInside(false);
        else setPresentation(false);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [demo, inside, stopDemo]);
  const share = async () => {
    const link = location.origin + location.pathname + encodeScenario(scenario);
    setShareLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const onReady = useCallback(() => setReady(true), []);
  const systemLabels: [System, typeof Cpu, string][] = [
    ['overview', Box, 'Overview'],
    ['compute', Cpu, 'Compute'],
    ['cooling', Droplets, 'Cooling'],
    ['power', Zap, 'Power'],
    ['network', Network, 'Network'],
  ];
  return (
    <main
      className={`app ${presentation ? 'presentation' : ''} ${inside ? 'interior' : ''}`}
      data-generation={scenario.generation}
      data-modules={model.moduleCount}
      data-xray={xray}
      data-exploded={exploded}
      data-inside={inside}
      data-demo={demo}
      data-ready={ready}
    >
      <header className="topbar">
        <a
          className="wordmark"
          href={location.pathname}
          aria-label="NEPTUNE home"
        >
          <Waves size={28} strokeWidth={1.4} />
          <span>NEPTUNE</span>
          <span className="wordmark-line" />
          <small>AN INFRASTRUCTURE EXPLORATION</small>
        </a>
        <div className="header-actions">
          <button className="subtle" onClick={() => setAssumptions(true)}>
            The model <ArrowUpRight size={15} />
          </button>
          <button className="share-button" onClick={share}>
            <Link2 size={16} />
            <span>Share scenario</span>
          </button>
        </div>
      </header>
      <div className="generation-bar">
        <p>Design the AI Data Center of 2035</p>
        <fieldset className="generation-tabs" aria-label="Generation presets">
          {PRESETS.map((p) => (
            <button
              key={p.generation}
              aria-pressed={scenario.generation === p.generation}
              onClick={() => {
                manual();
                setScenario(presetScenario(p.generation));
                setInside(false);
                setResetId((v) => v + 1);
              }}
            >
              <span>NEPTUNE {romans[p.generation - 1]}</span>
              <small>{p.year}</small>
            </button>
          ))}
        </fieldset>
        <span className="scenario-label">
          <i />
          SCENARIO · NOT A FORECAST
        </span>
      </div>
      <section
        className="workspace"
        aria-label="Offshore infrastructure simulator"
      >
        <aside className={`scenario-panel ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="panel-top">
            <span className="eyebrow">
              0{scenario.generation} / THE OFFSHORE SERIES
            </span>
            <button
              className="mobile-close icon-button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close controls"
            >
              <X size={18} />
            </button>
          </div>
          <h1>
            NEPTUNE <span>{romans[scenario.generation - 1]}</span>
          </h1>
          <p className="scenario-desc">
            {PRESETS[scenario.generation - 1].title}.<br />
            Energy. Cooling. Modularity.
          </p>
          <div className="divider" />
          <div className="section-label">
            <SlidersHorizontal size={14} /> SHAPE THE SCENARIO
          </div>
          <Control
            label="Accelerators"
            unit="GPUs"
            field="requestedGpuCount"
            scenario={scenario}
            onChange={update}
          />
          <Control
            label="Utilization"
            unit="%"
            field="utilization"
            scenario={scenario}
            step={0.01}
            displayFactor={100}
            onChange={update}
          />
          <Control
            label="Assumed PUE"
            unit="×"
            field="assumedPUE"
            scenario={scenario}
            step={0.01}
            onChange={update}
          />
          <Control
            label="Seawater inlet"
            unit="°C"
            field="seawaterInletC"
            scenario={scenario}
            onChange={update}
          />
          <button
            className="assumptions-link"
            onClick={() => setAssumptions(true)}
          >
            <Settings2 size={14} /> Assumptions & sources{' '}
            <ArrowUpRight size={14} />
          </button>
          <button
            className="reset-inputs"
            onClick={() => {
              manual();
              setScenario(presetScenario(scenario.generation));
            }}
          >
            Reset scenario inputs
          </button>
        </aside>
        <div className="viewport" onPointerDown={manual} onWheel={manual}>
          {presentation && (
            <div className="presentation-brand">
              <Waves size={24} /> NEPTUNE <small>BY ARHAAN AGGARWAL</small>
            </div>
          )}
          <div className="scene-corner">
            <span className="live-dot" />
            {inside
              ? 'REPRESENTATIVE MODULE / INTERIOR'
              : 'OFFSHORE CAMPUS / CONCEPT VIEW'}
          </div>
          <div className="canvas-shell">
            <Suspense
              fallback={
                <div className="scene-loading">
                  <Waves />
                  <span>Assembling the offshore campus…</span>
                </div>
              }
            >
              <Scene
                scenario={scenario}
                model={model}
                xray={xray}
                exploded={exploded}
                selected={selected}
                inside={inside}
                resetId={resetId}
                lowEffects={lowEffects}
                reducedMotion={reducedMotion}
                demo={demo}
                onSelect={chooseSystem}
                onManual={manual}
                onReady={onReady}
              />
            </Suspense>
          </div>
          {xray && selected === 'overview' && !inside && (
            <div className="xray-legend">
              <span>
                <i style={{ background: '#66efe4' }} /> Technical coolant
              </span>
              <span>
                <i style={{ background: '#f4aa87' }} /> Warm return
              </span>
              <span>
                <i style={{ background: '#ffc77c' }} /> Power
              </span>
              <span>
                <i style={{ background: '#c6adff' }} /> Fiber
              </span>
              <small>Traces on one representative platform</small>
            </div>
          )}
          <div className="scene-bottom">
            <span>
              ↔ Drag to orbit <b>·</b> Scroll to explore
            </span>
            <button
              className="icon-button"
              aria-label="Reset view"
              title="Reset view"
              onClick={reset}
            >
              <Focus size={19} />
            </button>
          </div>
          <div className="orientation">
            <span>N</span>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="20" />
              <path d="M24 8 19 29 24 25 29 29Z" />
              <path d="M24 32v8M8 24h7M33 24h7" />
            </svg>
          </div>
          {inside && (
            <div className="inside-banner">
              <strong>Within a compute module</strong>
              <span>
                Representative aisle · 10 glyphs illustrate up to 80 rack
                positions. Partial occupancy, layout and cooling are schematic.
              </span>
              <button
                onClick={() => {
                  setInside(false);
                }}
              >
                <ArrowUpRight size={16} /> Exit interior
              </button>
            </div>
          )}
          {demo && (
            <div className="demo-caption">
              <span className="eyebrow">
                {String(demoStep + 1).padStart(2, '0')} / AN INFRASTRUCTURE
                EXPLORATION
              </span>
              <h2>
                {
                  [
                    'Start with the ocean.',
                    'Look beneath the surface.',
                    'Two circuits. One heat exchange.',
                    'Infrastructure, taken apart.',
                    'From a campus to an archipelago.',
                    'What would you build differently?',
                  ][demoStep]
                }
              </h2>
              <p>
                {
                  [
                    'Energy. Cooling. Modularity.',
                    'Compute, cooling, power and networking.',
                    `${fmt(model.heatRejectedOperatingMW)} MW of IT heat · ${fmt(model.operatingFlowM3PerS)} m³/s seawater · separate circuits.`,
                    'Follow the connections between systems.',
                    `${fmt(model.provisionedGpuCount, 0)} accelerators · ${fmt(model.facilityPeakMW)} MW peak design demand.`,
                    location.origin + location.pathname,
                  ][demoStep]
                }
              </p>
            </div>
          )}
        </div>
        <aside className="inspector">
          <div className="section-label">EXPLORE THE SYSTEMS</div>
          <fieldset className="system-tabs" aria-label="System selection">
            {systemLabels.map(([id, Icon, label]) => (
              <button
                key={id}
                className={selected === id ? `selected ${id}` : ''}
                aria-pressed={selected === id}
                onClick={() => chooseSystem(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
                <ChevronRight size={13} />
              </button>
            ))}
          </fieldset>
          <div className={`inspector-content ${selected}`}>
            <span className="eyebrow">
              {selected === 'overview'
                ? 'THE DESIGN THESIS'
                : 'SYSTEM INSPECTION'}
            </span>
            <h2>
              {
                {
                  overview: 'Compute meets the coast.',
                  compute: 'Modular by design.',
                  cooling: 'Move heat. Keep circuits separate.',
                  power: 'An ocean is not a power source.',
                  network: 'Connected within. Connected beyond.',
                }[selected]
              }
            </h2>
            <p>
              {
                {
                  overview:
                    'What if we designed AI infrastructure around energy, cooling, and modularity from the beginning?',
                  compute:
                    'Whole nodes become racks. Racks become modules. Modules form a connected offshore campus.',
                  cooling:
                    'A closed technical loop carries IT heat to a heat exchanger. A separate seawater circuit carries that heat away.',
                  power:
                    'An external electrical connection feeds distribution and UPS equipment, then the compute loads. Supply is assumed, not secured.',
                  network:
                    'Internal cluster links connect the compute modules. External subsea fiber connects the campus to the world.',
                }[selected]
              }
            </p>
            {selected === 'overview' && (
              <div className="overview-count">
                <strong>
                  {model.platformCount.toString().padStart(2, '0')}
                </strong>
                <span>
                  connected platforms
                  <br />
                  {model.moduleCount} compute modules
                </span>
              </div>
            )}
            {selected === 'compute' && (
              <dl>
                <div>
                  <dt>Provisioned / requested GPUs</dt>
                  <dd>
                    {fmt(model.provisionedGpuCount, 0)} /{' '}
                    {fmt(scenario.requestedGpuCount, 0)}
                  </dd>
                </div>
                <div>
                  <dt>Whole nodes / racks</dt>
                  <dd>
                    {fmt(model.nodeCount, 0)} / {fmt(model.rackCount, 0)}
                  </dd>
                </div>
                <div>
                  <dt>Node rounding</dt>
                  <dd>+{model.roundingGpuCount} GPUs</dd>
                </div>
                <div>
                  <dt>Rack design load</dt>
                  <dd>{fmt(model.rackPeakKW)} kW</dd>
                </div>
              </dl>
            )}
            {selected === 'cooling' && (
              <>
                <div className="flow-legend">
                  <span>
                    <i className="cyan" /> Technical supply
                  </span>
                  <span>
                    <i className="coral" /> Technical return
                  </span>
                  <span>
                    <i className="dashed" /> Separate seawater circuit
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>IT heat to exchanger</dt>
                    <dd>{fmt(model.heatRejectedOperatingMW)} MW</dd>
                  </div>
                  <div>
                    <dt>Seawater flow · operating / peak</dt>
                    <dd>
                      {fmt(model.operatingFlowM3PerS)} /{' '}
                      {fmt(model.peakFlowM3PerS)} m³/s
                    </dd>
                  </div>
                  <div>
                    <dt>Temperature headroom screen</dt>
                    <dd
                      className={
                        model.temperatureHeadroomC <= 0 ? 'warning-text' : ''
                      }
                    >
                      {fmt(model.temperatureHeadroomC)} °C
                    </dd>
                  </div>
                </dl>
                <p className="small-note">
                  Animated dots trace fluid motion. Heat crosses the exchanger;
                  the two fluids do not mix. All modeled IT heat is included;
                  ancillary facility heat is excluded.
                </p>
              </>
            )}
            {selected === 'power' && (
              <dl>
                <div>
                  <dt>Operating demand</dt>
                  <dd>{fmt(model.facilityOperatingMW)} MW</dd>
                </div>
                <div>
                  <dt>Peak design demand</dt>
                  <dd>{fmt(model.facilityPeakMW)} MW</dd>
                </div>
                <div>
                  <dt>Assumed supply ceiling</dt>
                  <dd>{fmt(scenario.availableSupplyMW, 0)} MW</dd>
                </div>
                <div>
                  <dt>8,760-hour scenario</dt>
                  <dd>{fmt(model.annualEnergyMWh / 1000, 0)} GWh/year</dd>
                </div>
              </dl>
            )}
            {selected === 'network' && (
              <p className="small-note">
                Violet paths are illustrative routes. Bandwidth, latency, fiber
                landing rights and resilience are not modeled. External network
                and storage power allowance:{' '}
                {fmt(scenario.externalNetworkingStorageFraction * 100, 0)}% of
                node peak.
              </p>
            )}
            {selected === 'overview' && (
              <p className="small-note">
                Rack glyphs illustrate capacity. Partial modules and grouped
                platforms are schematic.{' '}
                {model.platformCount > 25
                  ? `${Math.min(25, model.platformCount)} hull glyphs represent ${model.platformCount} platforms.`
                  : 'One visible hull assembly per platform.'}
              </p>
            )}
          </div>
          <div className="inspector-footer">
            <span className="eyebrow">OPEN QUESTIONS</span>
            <p>
              Power access. Marine loads.
              <br />
              Thermal discharge. Permitting.
            </p>
            <button onClick={() => setAssumptions(true)}>
              Explore the assumptions <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
        <fieldset className="view-toolbar" aria-label="Scene modes">
          <button
            className="mobile-controls"
            onClick={() => setMobileOpen(true)}
          >
            <SlidersHorizontal size={17} />
            <span>Controls</span>
          </button>
          <button
            className={`xray-button ${xray ? 'active' : ''}`}
            aria-pressed={xray}
            onClick={() => {
              manual();
              setXray((v) => !v);
            }}
          >
            <Layers size={17} /> X-ray{' '}
            <span className="key-label">{xray ? 'ON' : 'OFF'}</span>
          </button>
          <button
            aria-label="Explode"
            aria-pressed={exploded}
            disabled={inside}
            onClick={() => {
              manual();
              setExploded((v) => !v);
            }}
          >
            <ArrowDownUp size={16} />
            <span>Explode</span>
          </button>
          <button
            aria-label={inside ? 'Exit inside' : 'Inside'}
            aria-pressed={inside}
            onClick={() => {
              manual();
              setExploded(false);
              setInside((v) => !v);
            }}
          >
            <Eye size={17} />
            <span>{inside ? 'Exit inside' : 'Inside'}</span>
          </button>
          <span className="toolbar-divider" />
          <button
            aria-label={demo ? 'Stop demo' : 'Play demo'}
            aria-pressed={demo}
            onClick={demo ? stopDemo : startDemo}
          >
            {demo ? <Pause size={16} /> : <Play size={16} />}
            <span>{demo ? 'Stop demo' : 'Play demo'}</span>
          </button>
          <button
            className="icon-button presentation-button"
            aria-label={
              presentation ? 'Exit presentation' : 'Presentation mode'
            }
            aria-pressed={presentation}
            onClick={() => setPresentation((v) => !v)}
          >
            <Maximize size={16} />
          </button>
        </fieldset>
      </section>
      <section className="metrics" aria-label="Derived scenario results">
        <div className="metric metric-primary">
          <span>
            <Cpu size={14} /> ACCELERATORS
          </span>
          <strong data-testid="gpu-total">
            {fmt(model.provisionedGpuCount, 0)}
          </strong>
          <small>{fmt(model.nodeCount, 0)} whole compute nodes</small>
        </div>
        <div className="metric">
          <span>
            <Zap size={14} /> OPERATING DEMAND
          </span>
          <strong data-testid="operating-power">
            {fmt(model.facilityOperatingMW)}
            <em>MW</em>
          </strong>
          <small>{fmt(model.facilityPeakMW)} MW peak design</small>
        </div>
        <div className="metric">
          <span>
            <Droplets size={14} /> SEAWATER FLOW
          </span>
          <strong>
            {fmt(model.operatingFlowM3PerS)}
            <em>m³/s</em>
          </strong>
          <small>{fmt(model.peakFlowM3PerS)} m³/s peak sizing</small>
        </div>
        <div className="metric">
          <span>
            <Box size={14} /> COMPUTE MODULES
          </span>
          <strong data-testid="module-total">
            {model.moduleCount.toString().padStart(2, '0')}
          </strong>
          <small>{fmt(model.rackCount, 0)} racks · schematic geometry</small>
        </div>
        <div className="metric headroom">
          <span>THERMAL HEADROOM</span>
          <strong
            className={model.temperatureHeadroomC <= 0 ? 'warning-text' : ''}
          >
            {fmt(model.temperatureHeadroomC)}
            <em>°C</em>
          </strong>
          <small>Simplified screen · not a feasibility test</small>
        </div>
      </section>
      {(model.warnings.length > 0 || restoredDefaults) && (
        <output className="warnings">
          {restoredDefaults && (
            <p>Invalid shared scenario. Default inputs restored.</p>
          )}
          {model.warnings.map((w) => (
            <p key={w.code}>{w.message}</p>
          ))}
        </output>
      )}
      <footer className="footer">
        <span>Concept simulator · Not an engineering design.</span>
        <span className="credit">
          A concept by <strong>Arhaan Aggarwal</strong>
        </span>
        <button
          aria-pressed={lowEffects}
          onClick={() => setLowEffects((v) => !v)}
        >
          {lowEffects ? <Check size={13} /> : <Expand size={13} />} Low effects
        </button>
      </footer>
      <Dialog
        open={!!shareLink}
        onOpenChange={(open) => {
          if (!open) setShareLink('');
        }}
      >
        <DialogContent className="neptune-dialog share-dialog">
          <DialogTitle>
            {copied ? 'Scenario link copied' : 'Your scenario link'}
          </DialogTitle>
          <DialogDescription>
            This link reconstructs all model inputs. Copy it to explore the same
            scenario on another device.
          </DialogDescription>
          <textarea
            aria-label="Shareable scenario URL"
            value={shareLink}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <button className="solid-button" onClick={share}>
            {copied ? <Check size={16} /> : <Link2 size={16} />} Copy link
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={assumptions} onOpenChange={setAssumptions}>
        <DialogContent className="neptune-dialog assumptions-dialog">
          <DialogTitle>The model, with its assumptions.</DialogTitle>
          <DialogDescription>
            A conceptual digital-twin-style simulator. No live telemetry,
            engineering certification or forecast. Change an assumption and
            follow the consequences.
          </DialogDescription>
          <div className="assumptions-scroll">
            <Assumptions scenario={scenario} model={model} update={update} />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function Assumptions({
  scenario,
  model,
  update,
}: {
  scenario: Scenario;
  model: ReturnType<typeof simulate>;
  update: (field: keyof Scenario, n: number) => void;
}) {
  return (
    <>
      <div className="assumption-kind">USER / ILLUSTRATIVE ASSUMPTIONS</div>
      <div className="advanced-grid">
        <Control
          label="Whole-node peak"
          field="nodePeakKW"
          unit="kW"
          scenario={scenario}
          step={0.1}
          onChange={update}
        />
        <Control
          label="Idle power fraction"
          field="idleFraction"
          unit="%"
          scenario={scenario}
          step={0.01}
          displayFactor={100}
          onChange={update}
        />
        <Control
          label="External network + storage"
          field="externalNetworkingStorageFraction"
          unit="%"
          scenario={scenario}
          step={0.01}
          displayFactor={100}
          onChange={update}
        />
        <Control
          label="Supply ceiling"
          field="availableSupplyMW"
          unit="MW"
          scenario={scenario}
          onChange={update}
        />
        <Control
          label="Seawater temperature rise"
          field="seawaterTemperatureRiseK"
          unit="K"
          scenario={scenario}
          onChange={update}
        />
        <Control
          label="Technical coolant target"
          field="targetTechnicalCoolantSupplyC"
          unit="°C"
          scenario={scenario}
          onChange={update}
        />
        <Control
          label="Exchanger approach"
          field="assumedHeatExchangerApproachC"
          unit="°C"
          scenario={scenario}
          onChange={update}
        />
      </div>
      <p>
        Utilization is constant for 8,760 hours. Idle draw is retained at zero
        utilization. External networking and storage are additional to the
        whole-node envelope, which already includes its CPUs, memory, fans and
        onboard networking. Constant PUE is a simplified power multiplier;
        warmer water does not change it.
      </p>
      <p>
        Capacity: 8 GPUs/node; four 10U nodes per 48U rack (8U service
        allowance), up to 120 kW/rack; 80 racks per 320 m² module (4 m²/rack
        including circulation); eight modules per platform. These are schematic
        space and power allocations, not structural or cooling validation.
        Partial last racks/modules are rounded up. Current node rounding: +
        {model.roundingGpuCount} GPUs.
      </p>
      <p>
        Thermal boundary: all modeled IT heat reaches the exchanger; ancillary
        facility heat is excluded. Seawater density 1,025 kg/m³ and heat
        capacity 3,990 J/(kg·K) are illustrative constants. Flow = IT heat in
        watts ÷ (density × heat capacity × temperature rise). Headroom = coolant
        target − (inlet + exchanger approach). Discharge at{' '}
        {fmt(model.seawaterDischargeC)} °C is an arithmetic scenario, not
        environmental permission.
      </p>
      <div className="assumption-kind">DERIVED RESULTS</div>
      <p>
        {fmt(model.facilityOperatingMW)} MW operating /{' '}
        {fmt(model.facilityPeakMW)} MW peak; {fmt(model.annualEnergyMWh, 0)} MWh
        over 8,760 hours. No training-time, FLOPS, throughput, cost or
        renewable-supply claims are inferred.
      </p>
      <div className="assumption-kind">
        SOURCED REFERENCES · CHECKED 8 SEPTEMBER 2026
      </div>
      <SourceList />
      <div className="assumption-kind">UNRESOLVED CONSTRAINTS</div>
      <p>
        Power availability and interconnection; marine stability, wave and wind
        loads; mooring; corrosion and biofouling; thermal discharge and
        ecosystem effects; weather and maintenance access; fire safety; external
        fiber routes; permitting. Pressure drop, pump sizing, exchanger area,
        coolant distribution, redundancy, reliability and naval architecture are
        not solved. Positive temperature headroom does not establish
        feasibility.
      </p>
      <p>
        Dates identify scenarios, not forecasts. All generations use the same
        configurable hardware proxy. The floating design differs from
        Microsoft’s historical subsea Natick research. That work does not
        validate this concept.
      </p>
    </>
  );
}
function SourceList() {
  return (
    <ul className="source-list">
      {SOURCES.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.publisher} · {source.title}
            <ArrowUpRight size={14} />
          </a>
          <p>
            {source.claim} {source.limitation}
          </p>
          <small>Checked {source.checkedDate}</small>
        </li>
      ))}
    </ul>
  );
}

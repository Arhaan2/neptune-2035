# Requirement → implementation → verification matrix

Status records delivered scope, not a global feasible badge. Browser/hosted acceptance status is finalized in RELEASE-CANDIDATE.md. Deferred items are not implicitly passing.

| ID / gate | Requirement | Implementation | Evidence / status |
| --- | --- | --- | --- |
| A-01 | Preserve and verify baseline | isolated worktree, unchanged legacy code, v0.1 tag | BASELINE.md; fresh 53 unit +15 browser cases |
| A-02 | Versioned reference, identity, provenance | types.ts, catalog/reference.ts, assets/design.ts | REFERENCE-DESIGN.md; integration schema/ID/graph tests |
| B-01 | Exact dimensioned module and inventory | moduleAssets, lazy addresses, R3F instances | geometry and inventory tests, selected-module browser checks |
| B-02 | Coupled electrical/thermal/hydraulics | solvers + engine/simulation.ts | MODELS.md; physics and independent fixtures |
| B-03 | Linked selection / paths / close-ups | TwinScene, TwinApp tree, typed topology | browser/visual acceptance; no representative full-size racks |
| C-01 | Fixed clock, worker, cancellation | engine/worker.ts, ui/useTwin.ts | replay/chunk/epoch/cancel tests |
| C-02 | Pump trip, standby, heat, throttle, recovery | actual component events/controllers | physics signature and browser experiment |
| C-03 | Feeder/UPS, isolation, network faults | graph traversal, battery limits | energy conservation, reserve/exhaustion, graph fault tests |
| D-01 | Hierarchical campus and families | lazy nodes/racks, all platform instances | >25-platform +million-accelerator tests |
| D-02 | Mass/draft/freeboard/packing | canonical floating geometry, reports | floated hull and unknown-mass regression tests |
| D-03 | Network reachability and demand | cluster/external graphs + required job needs + versioned offered traffic | exact disconnect, edge/port bottleneck, idle dispatch and whole job-domain tests |
| D-04 | Advanced distribution | III open ties recorded | closed meshed ties unsupported; no redundancy credit |
| E-01 | Generated, imported, replayed observations | telemetry generator/parser/store | telemetry schema/units/source/stale/gap tests |
| E-02 | Real local read-only stream | native EventSource + local publisher | actual HTTP/CORS/Last-Event-ID/reconnect browser tests |
| E-03 | Residuals / bounded calibration | residuals + calibrateUA + Data UI | held-out fixture tests; physical validation pending |
| F-01 | Reproducible comparison | worker-isolated redundancy runs + local snapshots | same events/seeds; exact project replays |
| F-02 | Discrete sizing / included costs | same solver checks, dated editable assumptions | sizing failure tests; sampled bounded search, not global optimization |
| F-03 | Uncertainty | paired editable idle/UA and cost assumptions | assumption ranges, not confidence intervals; broader probabilistic UQ deferred |
| F-04 | Export / legacy migration | bounded v2 JSON, events, CSV, report, glTF | import injection/version tests; glTF meters/IDs browser check; v1 stays Legacy |
| F-05 | Interior / cameras / cinematic | same canonical selected module, bounded aisle, state-timed cameras | scene tests +actual screenshot inspection; full obstacle path planner unimplemented |
| G-01 | Independent numerical benchmarks | reference/benchmarks.py/json | independent RK4 vs analytic thermal and four analytic/rational fixtures |
| G-02 | Browser, mobile, fallback, performance | running-product acceptance + resource samples | RELEASE-CANDIDATE.md lists actual outcomes and hardware limits |
| G-03 | Separate hosted candidate | existing-repository `v2-preview/` path | verified served manifest and file hashes; hosted browser acceptance in release record; production root unchanged |

## Explicit limits

No CFD/FEA, AC load flow, protection/fault-current study, packet latency, GPU junction model, per-rack hydraulic balancing, building/fire compliance, intact/damage stability, mooring/fatigue/storm survival, corrosion-life or discharge-permit conclusion. No vendor validation or operational commissioning. A real measured component cannot turn the whole readiness matrix green.

The implementation delivers supported reduced-order templates. Arbitrary externally edited asset topology/geometry is not a project-import capability: bounded project files carry the validated configuration and event history used to deterministically regenerate the reference asset model. Extensions require a new schema/reference family with corresponding verification.

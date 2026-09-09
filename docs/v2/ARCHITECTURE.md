# NEPTUNE v2 architecture and decisions

The retained Vite/React/TypeScript/Three.js application is a static design simulator. Its numerical core runs in a Web Worker; an optional local read-only publisher exercises the observation transport. There is no hidden cloud solver, real equipment controller, paid service, or runtime dependency on externally hosted assets.

## Data ownership

| Boundary | Owner / representation | Behavior |
| --- | --- | --- |
| Canonical design | `twin/types.ts`, `catalog/reference.ts`, `assets/design.ts` | Validated configuration regenerates exact hierarchy, dimensions, masses, ports and graphs; deterministic revision |
| Operating state | `engine/simulation.ts` | Clock, component states, temperatures, stored energy, cumulative energy, validated events and causal log |
| Numerical models | `solvers/` | Pure SI-unit electrical, equivalent hydraulic, exchanger, thermal and declared network-demand calculations |
| Execution | `engine/worker.ts`, `ui/useTwin.ts` | Versioned request/epoch protocol; bounded chunks; stale-response suppression and cancellation |
| Observations | `telemetry/`, `ui/TwinDataPanel.tsx` | Raw imports remain separate from normalized, source-namespaced streams; measured/generated provenance and staleness are explicit |
| Analysis | `analysis/reports.ts` | Same-design constraints, discrete sizing, included-scope costs, bounded project import and exports |
| Presentation | `scene/TwinScene.tsx`, `twinGeometry.ts`, `ui/TwinApp.tsx` | Exact selectable identities, instanced canonical geometry, contextual cameras, workspaces and presentation-only transforms |
| Verification | `tests/`, `reference/benchmarks.py` | Software invariants and independent numerical fixtures; neither supplies physical validation |

The UI edits configuration or sends timestamped commands. It does not implement a second electrical or thermal model. The worker returns a state matching its design revision. The same state supplies metrics, equipment appearance, trends, topology and generated observations. A design change pauses and initializes fresh storage/thermal state; view changes do not alter engineering inputs. Observation ingestion does not secretly assimilate or overwrite simulated truth.

## Scale and fidelity

All platforms/modules are exact envelopes. Deterministic rack/node addresses resolve full inventory lazily; the scene renders detailed racks, compute units and support equipment for the selected module. Each physical module retains its own thermal/storage/control state, including faulted domains. Identical supported hydraulic operating points are memoized. Display aggregation does not change module count, unit scale, failure identity or numerical time.

Supported projects carry validated reference-family parameters, not arbitrary editable CAD or graph structures. Electrical operation is radial; III ties are explicit but open. Hydraulics supports declared series circuits with identical parallel pump branches. Network traffic is a declared demand screen, not packet simulation. These boundaries allow inspectable, verified reduced-order behavior and explicit unsupported states.

## Persistence and reproducibility

V2 project JSON carries schema, solver, design, timestamped events and selected simulated time. Imports are bounded and regenerate the canonical asset model. Up to eight scenarios may be saved locally; private observations are excluded from project, result and geometry exports. Cost sensitivity is an analysis setting carried in the engineering report, rather than a physical design revision.

The generated experiment files under `public/experiments/` can be imported and replayed. `npm run evidence:twin` regenerates them and records local numerical timings. CSV output escapes spreadsheet formula prefixes. Geometry exports include meter units and exact asset IDs; an explicit 30,000-mesh limit prevents uncontrolled expansion.

Legacy `?legacy=1` and existing `#s=` links retain the v0.1 aggregate/PUE model. New bottom-up results differ because they account for achieved flow, finite storage, conversion and auxiliary heat paths. Old assumed PUE inputs are never silently reinterpreted as new physics.

## Build and release boundaries

One npm lockfile and the existing dependency versions are retained. Vite uses relative asset URLs for static project paths. Separate free GitHub Pages preview hosting preserves the production branch, tag and release history. The release record names the actual source SHA, compiled manifest, hosted checks and rollback procedure. Promotion to the production URL requires explicit user approval.

The lead defined the shared schema and integrated three actual parallel workers covering numerical verification, asset-linked geometry and telemetry. File ownership avoided independently redefined design/state contracts. The resulting integration was reviewed together; worker reports do not replace the final combined checks recorded in the release evidence.

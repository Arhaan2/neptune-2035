# Phase 7 presentation contract

Simulated, design-stage prototype; physical validation pending.

Baseline: main `9db8565a054f05b24904724ade0ed86e1c136869`, tree `1573cced171ae14077427b5059e87b407d3b59b2`; Pages `ce6432451e02a702a8c26fcb0caf6ab1952d4b60`. Phase 4–6 numerical, persistence, controller, ranking and bounded execution contracts remain authoritative. This document defines presentation, not new physics.

## Ownership and checkpoints

Orchestration owns integration, this contract/matrix, gates and releases. Building owns `src/ui`, `src/scene` and new `src/twin/presentation` features. Testing owns Phase 7 tests. Verification only reviews pinned source and evidence. Fixing receives explicit module ownership for concrete defects. Separate Git worktrees, ports 4271/4272/4273 and external evidence directories prevent contention. Four roles rotate through three available worker slots, retaining distinct native agents. Only Orchestration integrates commits or writes remotes.

Checkpoints: C0 contract; C1 workspaces/asset inspection; C2 synchronized operation/history; C3 decision explanations/walkthrough; C4 accepted integrated candidate. Testing and review start at each immutable checkpoint while Building continues the next independent slice.

## Shared inspected context

Workspace, asset ID, focus/camera, overlays and history cursor are view state. They never change engineering assumptions, battery state, the active experiment, persisted evidence or rankings. One context binds engineering/design revision, full run definition and initial-state identity (plus admitted inputs), selected stable asset ID, requested time, actual resolved absolute simulation time, evaluation-relative time, boundary semantics, origin and availability. Reject unknown asset IDs. Clear incompatible selection and pending requests when design/run changes.

Keep active state separate from displayed state. The scene, asset status/operating values, topology, event navigation and filtered trend cursor consume the same displayed snapshot. Whole-run summaries explicitly identify the original run and full observation interval. Current time, inspected time, selected event time and full-run metrics have distinct labels. During loading/unavailable history hide contemporaneous numerical/scene claims until resolved; do not substitute a nearest sample or zero.

Origins remain simulated, generated demonstration, or imported/supplied observations/evidence; freshness/availability remain independently current, stale, missing, unknown or unavailable. Replay is a viewing mode. Imported campaign evidence remains supplied until existing reproduction checks it, without converting it to physical measurement.

## Exact history observation

History uses a separate bounded worker and existing authoritative initialization/recorded-input replay, never `useTwin.replay` or active-state adoption. Retain only one resolved snapshot and bounded selected-module trend summaries (maximum 160). One active history worker, cancellable by termination; epoch plus full context identity guards reject late responses and prevent old run/design overwrite. Retain the source current checkpoint unchanged; return-to-current cancels history. Resume explicitly leaves inspection and resumes the original current checkpoint.

The engine integer request/timestep rules remain unchanged. For fractional controller boundaries only, a minimal optional seventh boundary-observer argument may expose a snapshot-copy accessor after the existing `finishExperimentBoundary`/boundary observer calls in `advanceWithStep`. Observer code must never receive a mutable engine reference. It may copy requested boundaries; no callback is used for ordinary production runs. This is observation plumbing, not a model change. Verification must review it and tests must prove observer/no-observer canonical output equality excluding solverMs only.

All external events at one time execute in persisted sequence before controller deadlines, as already modeled. Event selection displays the final post-boundary state after all same-time events/transitions. The selected transition's own before/after switch evidence is separately labeled; do not fabricate intermediate physical scenes. Previous committed boundary is the supported pre-event view and must show its actual time, not an epsilon or interpolated state. Non-boundary requests explicitly report unavailable; supported saved-run/event journeys resolve exactly. Replay is bounded by existing module-step, horizon and wall-time budgets; unsupported legacy history lacking initial conditions says why.

## Workspaces and connected assets

Explore exposes installed identity, parent/location, specification/version, unit-bearing ratings, assumptions, and supported connections from existing catalog/topology. Accessible HTML and scene selection share IDs. Pump inspection distinguishes installed pump ratings from module-equivalent flow/pressure/thermal/electrical output; no invented per-pump or per-rack sensor precision. Supporting electrical and distinct technical/seawater circuits use actual connections. Selection decoration must preserve independent failure indication/text.

Operate identifies source/run/scenario/lifecycle and displayed time; simulated faults remain distinct from read-only observation inputs. Explanations cite initiating event, modeled affected assets, controller reasons/blocked constraints and service outcome; direct failure, downstream loss, isolation, capacity limitation and transfer are distinguished only where engine evidence supports them. Unrepresented causality is explicitly unknown.

Compare retains both Phase 6 objectives, campaign coverage and exact feasibility/ranking rules. Expose constraint actual/unit/threshold/tolerance/margin/scenario and supported asset/time navigation. Original Phase 5 outcome may differ from Phase 6 requirements; explain both. Whole-run extrema, shortfall, total/longest interruption, onset and confirmation, and included cost accompany labeled final-state metrics. Common chart axis is evaluation-relative time; duration, warmup and fault footprint differ explicitly, with no padding. Ties, provisional/incomplete/cancelled/stale/no-feasible/numerical-failure remain separate.

## Walkthrough and access

Use actual reference campaign execution and result-derived candidates/events/recovery/constraints for a bounded stepwise walkthrough. No hardcoded winning labels, times or quantities. Primary: installed equipment → eligible feeder campaign → initiating fault/affected domain → transfer and capacity evidence → restoration onset → dwell confirmation → II/III cost/outage tradeoff. Also run nominal-only and receiving-bus/common-source no-feasible demonstrations. Pause/inspect/cancel/exit/user takeover/hidden tabs cancel scripted navigation; reduced motion and non-WebGL retain equivalent steps and shared camera controls.

Keep ocean/platform geometry, legacy routes, X-ray/exploded views and direct camera controls. Verify actual canvas pixels and failed-selected visibility through repeated view combinations. Essential controls work with keyboard, 375px viewport, reduced motion, low effects and actual context loss. Charts have text/table equivalents. Raw recordings stay outside Git and application payload; sanitized selected media is release evidence only.

## Acceptance states

Loading, empty, unsupported, unavailable-history, stale, cancelled and numerical-failure have explicit text. Completed infeasible experiments remain completed. No green/zero substitutes for unknown data. No recommendation before scope completion. No Phase 7 exclusions; preserve exact two historical exclusions. Freeze one clean source/tree/lock/artifact and obtain Testing plus Verification agreement before source CI/normal merge/Pages successor promotion and full public artifact/browser checks.

### C2/C3 clarification: metric markers versus dispatched boundaries

Persisted checkpoint admission remains integer-only. Fractional transfer boundaries are captured inside canonical engine execution as view-only observations; they are never resumed, restored or serialized as checkpoints. `summarize` retains its validator and delegates to the same formula body as the observer-only summary. Full-run/observation panels that intentionally retain the active checkpoint identify its current time explicitly.

Recovery confirmation can be an interval-derived metric time with no dispatched physical boundary at that instant. The primary baseline's metric confirmation is9.375s, bracketed by actual canonical observations9s and10s. Do not create or interpolate a physical state at9.375. For a metric marker only, explicit `at-or-after` inspection selects the first actual observer boundary at/after the requested marker and reports both times and this resolution rule; `previous` selects its preceding actual boundary. Ordinary `post` inspection remains exact and reports non-boundary times unavailable. These baseline numbers are explanatory documentation, not production narrative constants. Verification independently approved this distinction; the application derives marker times and resolved boundaries from evidence.

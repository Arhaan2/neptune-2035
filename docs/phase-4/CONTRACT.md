# Phase 4 experiment contract

Simulated, design-stage prototype. Phase 4 evaluates the entire declared experiment, including earlier outages; it does not predict training throughput or establish physical validation.

## Baseline and ownership checkpoint

Verified remote main `91a52eeff5a01fae3ef21cba7a8293b59e5c40fb`, tree `c6ee142e13955a76cdc07bbafe150ae2d6d2b64c`; Pages `84366132ae9499bdd3f47fd8d2b53864df2cc0a5`; preserved preview tree `531d00a67da4c1f2f02a22bf249d93e683b2601b`. Fresh HTTP/Git integrity check matched all 90 tracked artifact files. Lock SHA-256 `87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9`. The repository default branch still points to an older development branch, so Phase 4 explicitly starts from verified remote main. The original checkout and its two untracked files are preserved.

Four concurrent agents including root are supported. Five distinct roles rotate: root + Building + Testing + Verification initially; after the initial read-only Verification receipt, Fixing takes that slot for reproduced defects; Verification returns for integrated/final/public reviews. No recursive delegation. Only root merges main or publishes Pages.

| Role | Actual agent | Exclusive ownership |
| --- | --- | --- |
| Orchestration | `/root` | Integration worktree, contract/docs, CI/release scripts, PR, main, Pages |
| Building | `/root/building` | Production `src/twin/**` and affected existing UI; successive completed slices |
| Testing | `/root/testing` | Independent Phase 4 tests and browser journeys; immutable integrated candidate gates |
| Verification | `/root/verification` | Independent read-only review; durable review receipts |
| Fixing | Pending initial review checkpoint | Only reproduced defects in explicitly transferred completed surfaces; regression tests coordinated with Testing |

Writers use separate branches/worktrees of the isolated clone. Root records every integrated commit and ownership transfer in the execution log. Raw reports, traces, recovery bundle and rollback tar are retained in the original workspace's ignored `artifacts/phase-4-20260911/`, outside the disposable worktrees.

## Definition and lifecycle

A definition is immutable and versioned, with design engineering identity/revision, initial physical state identity, workload and required network classes, controller/environment assumptions, duration, timestep, disturbance IDs/assets/resolved execution times, success and recovery criteria. Electrical workload utilization does not scale required accelerator count. Required capacity is an explicit nonnegative accelerator count (default requested inventory), optionally an explicit supported demand schedule. Economic identity remains separate.

Execution status is separate from evaluation. Completion may FAIL; cancellation, numerical failure, resource limits, warmup timeout and partial observation cannot PASS. Preserve elapsed evaluation coverage, stop reason and pending state. Pause/resume preserves all physical and aggregate state. Reset/physical edits create a fresh or explicitly derived definition. Interactive disturbances are recorded inputs/derived revisions, never invisible edits. Price-only edits preserve physical state and metrics.

Cold start uses declared initial conditions. Settled start persists explicit service/thermal settling predicates, derivative tolerances, continuous dwell and maximum warmup. A timeout is not equilibrium. Evaluation starts at the confirmed post-warmup boundary with exactly that physical state, including battery energy; no refill. Warmup diagnostics and elapsed time remain available but are excluded from evaluation aggregates unless the definition explicitly includes them.

## Numerical and measurement rules

Physical model `neptune-reference-3`, solver `2.3.0`, algorithm `committed-boundary-1` remain unchanged while physical calculations remain unchanged. Project/state schema 3 gains an optional independently versioned experiment checkpoint extension v1 and metrics `whole-run-1`. Unknown extension versions are rejected. The extension binds definition, evaluation origin and last committed step/time to its atomic physical checkpoint.

The existing physical grid is 1, 0.5, 0.25 or 0.125 seconds. Existing event/request admission uses integer seconds; reject off-grid events rather than silently rounding. Events at a boundary use existing persisted deterministic admission sequence. At each accepted interval `[t,t+dt)`, capture actual `dt>0` dispatch before the following zero-duration event/controller solve overwrites displayed powers or capacities. Service and battery integrals use that actual dispatch, because battery reserve allocation can differ from a zero-duration display solve. Thermal violation duration holds the interval-start sampled thermal predicate. Boundary extrema include initialized t=0 and post-event terminal observations. These are observed model extrema, not guaranteed continuous physical maxima.

Unmet requirement is `sum(max(0, required - serviceable) * dt)` in **accelerator-seconds**. Installed, energized and serviceable capacity remain distinct. Serviceable capacity is the canonical coupled electrical/thermal/required-network result; do not reconstruct inventory or call the full static sizing assessment on every interval. Record minima/maxima with time and supported asset/domain identity. Threshold comparators, units and numerical tolerances must be serialized with supported criteria. Reject unsupported criteria; represent unavailable observations as unavailable.

A terminal event has zero integrated duration but changes final boundary evidence. A terminal trip cannot leave the current recovery status healthy. A zero-duration experiment accrues no duration, shortfall or energy. Failed/uncommitted candidates cannot advance aggregates. Snapshots and worker delivery never add metrics. Checkpoint/resume includes open episodes, pending recovery dwell, event position and aggregate commit position atomically.

Discharged and charged battery bus energy are separate Wh integrals; report storage net change and modeled conversion losses separately. Endpoint state-of-charge difference is not total discharge. Count actual committed controller transitions with timestamp/reason/asset evidence; replay and repeated delivery cannot double count. Campus service, thermal and any-violation durations are unions in time, not sums of affected module durations.

## Recovery and comparison

Recovery requires all declared service and thermal predicates continuously satisfied for a serialized dwell interval. Any relapse resets the candidate. Persist the qualifying interruption/reference event, candidate onset and confirmation boundary; distinguish onset elapsed time from confirmation elapsed time. Record repeated interruptions; an earlier recovery never hides a later unresolved episode. Distinguish no qualifying interruption, recovered, not recovered within completed observation and incomplete observation. Confirmation at terminal T requires its post-event boundary still qualifying; an unfinished dwell is not recovery.

A faulted/unfaulted pair starts from identical declared physical initial state, workload, policy, environment and integration settings. Suppress only the declared fault sequence in the baseline; never seed it from a faulted endpoint. Show absolute results plus signed faulted-minus-baseline differences, including accelerator-seconds. Reject incremental conclusions for incomplete/mismatched pairs. Cross-design comparisons carry an explicit equivalence explanation and actual disturbance footprints (asset, installed equipment/capacity/fraction); ordinal asset names alone are insufficient.

## Persistence and bounds

Preserve Phase 2/3 imported content and histories. Compatible old physical checkpoints may resume, but show **whole-run metrics unavailable for this legacy run**. Never synthesize zero outage or PASS from insufficient historical evidence. Explicit derived recalculation can create a new report; incompatible physical solvers remain inspection-only. Imported summaries are supplied evidence, not independently verified results.

Exact online aggregates are independent of bounded chart/interval detail. Existing chart limit is 600 samples, event input limit 10,000, log/evidence target limit 1,000, file limit 64 MiB, project horizon 30 days, saved-history count 8; execution retains existing bounded worker work/time budgets. Declare coverage/truncation and preserve extrema during downsampling. No per-accelerator-per-timestep history. Validate finite/nonnegative quantities and malformed/oversized imports. Same numerical trajectory must agree across manual steps, worker groupings, UI speeds, replay and restore; a changed physical timestep is a separate numerical-sensitivity experiment.

## Requirement-to-test agreement

Testing independently reproduces the accepted baseline endpoint-only defect before new APIs. The synthetic arithmetic oracle has required100, service100/40/80/100 over four 5s intervals: unmet400 accelerator-seconds, minimum40, service violation10s, first violation5s; healthy thermal conditions with dwell5s recover from onset15s confirmed20s. It remains separate from real-engine demonstrations.

Executable gates cover healthy/zero/boundary/simultaneous events and changing demand; thermal/service overlap and unavailable values; recovery flapping/repeated/terminal/pending checkpoints; discharge/recharge and controller replay; sparse snapshots and retention; trajectory equivalence/cancellation/stale messages; settling and timeout; legacy/roundtrip/economics/incompatible checkpoints; fair pairs and signature two-design demo; desktop/mobile/keyboard/fallback/export/import/reload. The final frozen candidate runs all mandatory existing unit/integration coverage including both real telemetry integrations, ordinary prototype/Phase2/Phase3 browser journeys across all three engines, and new Phase4 journeys. Only the two existing Chromium/WebKit 500,000-accelerator prototype Step10s exclusions remain. Existing deferred Phase1 stress gates are not promoted to complete.

Release acceptance remains pending until implementation, independent review, frozen local gates, exact-source CI, accepted-tree/build parity, actual Pages completion, full public integrity/preview checks and hosted browser gates pass. Recheck the actual last-known-good Pages head immediately before promotion; expected immediate rollback is Phase3 `84366132...`, not its Phase2 parent.

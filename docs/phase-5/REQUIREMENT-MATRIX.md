# Phase 5 requirement and evidence matrix

Simulated, design-stage prototype; physical validation pending.

Acceptance is based on actual immutable candidate tests and native reports. A written test or implemented interface is not a passing gate. The rows below remain pending until populated from executed evidence.

| Requirement | Required verification | Source / current evidence | Acceptance |
| --- | --- | --- | --- |
| 5.1 bounded topology and installed hardware | Explicit opt-in; immutable ratings, mass/dimensions/cost; asset ownership; legacy nontransfer; radial single-hop validation | `transfer/design.ts`, `transfer/topology.ts`; independent initial review V5-C01/C05/C07 | Pending integrated verification |
| 5.2 deterministic state machine | Detect/isolate/evaluate/wait/execute/refuse; reason/path/position evidence; exact deadline ordering; one attempt; nonreversion | `transfer/controller.ts`; initial review V5-C03/C04/C08 | Pending engine integration |
| 5.3 shared capacity and coupled service | Atomic full-path native-first allocation, whole bundles, live revalidation/shedding, loss/auxiliary accounting; actual electrical/thermal/network state | `tests/phase5-capacity.test.ts`; isolated arithmetic expectation in frozen fixture; PH5-T01 repair | Pending complete coupled verification |
| A eligible benefit | Same demand and mapped local feeder footprint; delayed III recovery; own unfaulted baselines and actual interruption metrics | Frozen independent piecewise oracle in `phase5-oracles.test.ts` | Pending engine and browser results |
| B disabled transfer | Same III installed hardware and disabled controller gives no transfer advantage | Required independent fixture | Pending |
| C no-benefit faults | Receiving bus, common source, unavailable donor and tie; unrelated domains remain healthy where supported | Required independent fixtures | Pending |
| D resource boundaries | Zero, insufficient, exact, sufficient, partial; tie and shared upstream bottlenecks | `phase5-capacity.test.ts` independent exhaustive subset oracle | Pending coupled engine/browser cases |
| E competing requests | Persisted priority/stable ID order, native protection, no double spend, permutation invariance | `phase5-capacity.test.ts` | Pending engine competition |
| F changing conditions | Clearance/donor/tie/downstream fault during delay; donor fault after closure; headroom reduction/shedding | Required boundary fixtures | Pending |
| G persistence and lifecycle | Before/during/after checkpoints; chunks/steps/replay/import; cancellation/restart/new identity; stale result invalidation | Required unit/worker/browser fixtures | Pending |
| H validation and coupling | Malformed refs/loops/multiple feeds/delays/ratings; valid inadequate capacity; thermal/network failure despite electrical restoration | Allocator malformed-input coverage; initial review V5-C01–C08 | Pending integrated verification |
| 5.4 fair reproducible demonstrations | Fast reference plus bounded campus; actual initial states/footprints/policy; signed differences and own baselines; cost and exclusions | Required comparison export and report | Pending |
| 5.5 UI inspection and export | Discoverable eligible/no-benefit/capacity demos; linked assets and real switch/headroom state; mobile/keyboard/reduced motion/fallback | Required `tests/browser/phase5.spec.ts` through production worker | Pending |
| Pre-release local gate | Clean install/typecheck/lint/build/all units/both real telemetry integrations; complete retained and Phase 5 three-browser journeys | Native `local-*` receipts at frozen candidate | Pending |
| Independent engineering review | Actual source, numerical output, coverage and native provenance; actionable findings closed independently | `VERIFICATION-INITIAL.md` is contract review only | Pending candidate sign-off |
| Source CI / accepted tree | Exact candidate/equivalent merge tree; all required tests and built payload retained; main tree matches | Existing `.github/workflows/phase-1.yml` extended | Pending |
| Rollback and preview | Complete current public inventory; archive and history; non-destructive restoration rehearsal; refresh before promotion | Baseline 90 tracked/88 HTTP/2 markers matched; archive extraction byte matched | Baseline passed; pre-promotion pending |
| Hosted release acceptance | Finished deployment; fresh complete inventory before/after; full required browsers against production root; final independent review | Required native hosted and final release receipts | Pending |

Frozen isolated tolerances and fixture assumptions are in `TESTING-CONTRACT.md` and `tests/fixtures/phase-5/frozen-expectations.json`. Actual coupled results must not be forced to fit the isolated oracle. Retained earlier coverage, both actual telemetry integrations, zero retries and the two narrow historical Step 10s exclusions remain required. Deferred Phase 1 stress gates and Phases 6–9 remain outside this release.

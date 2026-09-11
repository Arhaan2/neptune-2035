# Independent Phase 5 testing evidence

Testing agent `/root/testing` uses branch `codex/neptune-phase5-testing`, isolated worktree `/private/tmp/neptune-phase5-testing`, baseline `1f7f16c4680d2839af8775fe75b96d3f2ce77cfa`. It owns Phase 5 tests, fixtures and these testing receipts. Production source is integrated only from named immutable Building/Root commits. It never changes production code, accepted earlier tests, timeout budgets, retries or exclusions. Raw native evidence is durable under `/Users/arhaan/Documents/ChatGPT/Neptune/artifacts/phase-5-20260911/testing/`.

## Recorded checks

| Source | Check | Result | Native evidence |
| --- | --- | --- | --- |
| `1f7f16c` | Baseline Phase4 engine/metrics/persistence, existing physics/equipment propagation | 108 PASS, 0 FAIL, 0 pending, five files | `baseline-focused.json` |
| `1f7f16c` plus independent oracle tests committed as `dae3f23` | Frozen capacity and piecewise service arithmetic; existing whole-run evaluator checked against independent history | 8 PASS, 0 FAIL, 0 pending, one file | `frozen-oracles.json` |

The baseline focused invocation was `npm test -- tests/phase4-engine.test.ts tests/phase4-metrics.test.ts tests/phase4-persistence.test.ts tests/twin-physics.test.ts tests/phase2-propagation.test.ts --reporter=json --outputFile=.../baseline-focused.json`. Tests used the original installed dependencies through a worktree symlink; the release owner's required clean dependency install and final complete gates are separate acceptance evidence. These focused passes make no claim about an untested Phase 5 candidate.

## Requirement coverage ledger

| Requirement | Independent tests/evidence | Status |
| --- | --- | --- |
| A eligible feeder interruption and recovery; own unfaulted baselines | Frozen synthetic oracle in `phase5-oracles.test.ts`; engine and browser cases pending production handoff | Oracle passed; engine pending |
| B same III hardware, disabled controller | Engine/browser coverage pending | Pending |
| C receiving bus/common upstream/tie/donor no-benefit, unrelated-domain protection | Engine/browser coverage pending | Pending |
| D zero/insufficient/exact/sufficient, partial, tie and upstream bottlenecks | `phase5-capacity.test.ts`, independent exhaustive-subset oracle,48 bounded multi-resource combinations | Written; awaiting production API |
| E competing priorities, native protection, stable-order allocation, no reservation duplication | `phase5-capacity.test.ts` priority/permutation/native increase/repeated-evaluation cases | Written; awaiting production API |
| F fault clearance, delay invalidation, downstream/post-transfer failure, demand shedding | Engine coverage pending | Pending |
| G before/during/after checkpoint, replay/export/import, chunks, worker cancel/restart, new runs and structural staleness | Existing Phase4 baseline coverage retained; new transfer cases pending | Pending |
| H malformed/unsupported topology/ratings/timing, thermal/network coupling | Allocator malformed input acceptance written; engine/coupling pending | Pending |
| Existing accepted gates and two actual telemetry integrations | Original activations verified `NEPTUNE_TELEMETRY_BROWSER=1` and `NEPTUNE_TELEMETRY_APP=1` | Final complete gates owned by Root; pending |
| Every-browser real UI numerical export and worker/request evidence | `tests/browser/phase5.spec.ts` pending UI handoff | Pending |

No failed candidate evidence has been discarded. No Phase 5 browser exclusion or increased timeout is introduced. Counts and coverage above will be updated from actual immutable candidate receipts; implementation summaries do not substitute for executable results.

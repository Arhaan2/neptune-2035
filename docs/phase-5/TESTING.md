# Independent Phase 5 testing evidence

Testing agent `/root/testing` uses branch `codex/neptune-phase5-testing`, isolated worktree `/private/tmp/neptune-phase5-testing`, baseline `1f7f16c4680d2839af8775fe75b96d3f2ce77cfa`. It owns Phase 5 tests, fixtures and these testing receipts. Production source is integrated only from named immutable Building/Root commits. It never changes production code, accepted earlier tests, timeout budgets, retries or exclusions. Raw native evidence is durable under `/Users/arhaan/Documents/ChatGPT/Neptune/artifacts/phase-5-20260911/testing/`.

## Recorded checks

| Source | Check | Result | Native evidence |
| --- | --- | --- | --- |
| `1f7f16c` | Baseline Phase4 engine/metrics/persistence, existing physics/equipment propagation | 108 PASS, 0 FAIL, 0 pending, five files | `baseline-focused.json` |
| `1f7f16c` plus independent oracle tests committed as `dae3f23` | Frozen capacity and piecewise service arithmetic; existing whole-run evaluator checked against independent history | 8 PASS, 0 FAIL, 0 pending, one file | `frozen-oracles.json` |
| `5ecc557` | Independent allocator plus oracles | 31 PASS / 1 FAIL: duplicate path resource accepted | `slice-5ecc557-allocation.json` |
| `176e3e0` | Duplicate-path repair | All32 allocator/oracle checks PASS; added topology checks exposed malformed feeder roles | `slice-176e3e0-topology-allocation.json`, `slice-176e3e0-role-binding.json` |
| `a9d15ad` | Real engine feeder/policy/path/fault sequence and worker execution | Engine20 PASS; supported worker chunks9 PASS | `slice-a9d15ad-engine-valid-events.json`, `slice-a9d15ad-worker-supported-chunks.json` |
| `38ab672` | Distinct hardware/actual original-feeder binding repair | All34 topology checks PASS; initial capacity evaluation still failed separately | `slice-38ab672-initial-eligibility.json` |
| `9ebec1e` | Initial headroom evaluation, real shared donor partial restoration, native-load protection and thermal limitation | Engine/coupling27 PASS | `slice-9ebec1e-coupling.json` |
| `728bc0a` | Complete checkpoint binding repair | Persistence/engine/worker65 PASS; full Phase5 set136 PASS / 2 FAIL, both installed standby demand | `slice-728bc0a-checkpoint-retest.json`, `slice-728bc0a-all-phase5.json` |
| `728bc0a` with test `5c7187b` | Delay0/0.125/0.5/2.375/10/60s including terminal/pending cases | Engine29 PASS | `slice-728bc0a-delay-boundaries.json` |
| `a79f005` with T02/V01 | Production Chromium UI, four real-worker/export/replay journeys | 4 PASS, 0 FAIL, 0 skipped, 0 retries,5.0s | `browser-a79f005-chromium-authorized.json`; decoded `native-ui-exports/*.json` |

The baseline focused invocation was `npm test -- tests/phase4-engine.test.ts tests/phase4-metrics.test.ts tests/phase4-persistence.test.ts tests/twin-physics.test.ts tests/phase2-propagation.test.ts --reporter=json --outputFile=.../baseline-focused.json`. Tests used the original installed dependencies through a worktree symlink; the release owner's required clean dependency install and final complete gates are separate acceptance evidence. These focused passes make no claim about an untested Phase 5 candidate.

## Requirement coverage ledger

| Requirement | Independent tests/evidence | Status |
| --- | --- | --- |
| A eligible feeder interruption and recovery; own unfaulted baselines | `phase5-oracles.test.ts`, `phase5-engine.test.ts`, eligible UI journey;80 vs19 accelerator-s, onset4.375/confirmation9.375 | Passed focused engine/Chromium |
| B same III hardware, disabled controller | Topology test asserts identical installed assets; engine verifies80 accelerator-s and DISABLED refusal | Passed focused |
| C receiving bus/common upstream/tie/donor no-benefit, unrelated-domain protection | Engine refusal cases; actual bus UI export80 vs80 and healthy unrelated8+8 | Passed focused/Chromium |
| D zero/insufficient/exact/sufficient, partial, tie and upstream bottlenecks | `phase5-capacity.test.ts`, independent exhaustive-subset oracle,48 bounded multi-resource combinations; real shared donor partial99; UI140kW bottleneck99 vs160 | Passed focused/Chromium; V02 installed standby accounting remains open |
| E competing priorities, native protection, stable-order allocation, no reservation duplication | Allocator exhaustive priorities/permutations; real equal-priority route/module/asset/edge permutation and native-demand protection in `phase5-coupling.test.ts` | Passed focused (final equal-priority variant awaits combined retest) |
| F fault clearance, delay invalidation, downstream/post-transfer failure, demand shedding | `phase5-engine.test.ts` exact fault/deadline order, cancellation, non-reversion, single attempt; `phase5-coupling.test.ts` demand increase before/after closure | Passed focused |
| G before/during/after checkpoint, replay/export/import, chunks, worker cancel/restart, new runs and structural staleness | `phase5-persistence.test.ts` including nine corruption probes, actual partial-charge battery continuity and changed demand; `phase5-worker.test.ts`; UI project/import/replay/stale historical report | Passed T03 focused/Chromium |
| H malformed/unsupported topology/ratings/timing, thermal/network coupling | Typed failure classification in topology/allocator;29 engine tests including delay endpoints; real thermal case3x160nodes/pumpSpeed0/600s retains transferred supply while thermal controller curtails service; required network failure remains unserviceable | Passed focused |
| Existing accepted gates and two actual telemetry integrations | Original activations verified `NEPTUNE_TELEMETRY_BROWSER=1` and `NEPTUNE_TELEMETRY_APP=1` | Final complete gates owned by Root; pending |
| Every-browser real UI numerical export and worker/request evidence | `tests/browser/phase5.spec.ts`, four journeys run without retries; complete numeric exports and empty error/failed-request collectors | Chromium passed; final repaired three-browser gate pending |

## Failure provenance and harness corrections

No failed evidence is discarded. Initial browser invocation failed4 launches before any page action because the sandbox denied Chromium's MachPortRendezvous; the ordinary approved escalation then ran the same build and all4 journeys passed. This is an environment launch failure, not a flaky product test or a retry allowance. Unit fixture harness corrections were limited to reading catalog `evidence`/`assumptions` in their actual fields instead of the provenance reference ID, encoding event IDs with the existing accepted stable alphabet, and using the existing10s maximum worker chunk instead of invalid12s. Corresponding initial native failures remain retained. No production behavior, earlier assertion, numerical tolerance, timeout, retry count or exclusion was weakened.

T01 duplicate resource validation, T02 feeder-role binding, V01 initial headroom evaluation and T03 checkpoint binding were independently retested after focused repairs. V02 is still OPEN at this receipt: with supported `pump-physical` standby and a failed duty pump,63000W tie incorrectly reports transferred with no unserved load;64000W tie serves8 but admits62080.096378W while actual module plus platform network requires63632.533679W. Both are regression failures in `phase5-coupling.test.ts`, not acceptance exclusions. Final source/CI/hosted gates must use the repaired frozen candidate.

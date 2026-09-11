# Phase 4 acceptance evidence

Release acceptance is pending. This document maps executable checks to requirements; counts below describe completed focused gates, not a substitute for final local, CI or public gates.

| Requirement | Independent executable evidence |
| --- | --- |
| Accepted baseline endpoint-only gap | `tests/phase4-baseline-gap.test.ts`: existing API, healthy sparse endpoints conceal80 accelerator-seconds;1/1 on accepted Phase3 |
| Immutable definitions, criteria, stable footprints, input bounds | `tests/phase4-definition.test.ts`:23 cases including actual node/rack/partial-rack and existing transformer ancestry |
| Independent arithmetic, boundaries, thermal unions, missing values, battery recharge, recovery, bounded evidence | `tests/phase4-metrics.test.ts`; synthetic `tests/fixtures/phase-4/arithmetic-oracle.json` is independent of simulator output |
| Real engine dispatch, subsecond grid, terminal events, controller ordering, settlement/timeout, trajectory equivalence | `tests/phase4-engine.test.ts` |
| Grouping, message cadence, cancellation, duplicate/stale replies, resource limits, fresh-worker restore | `tests/phase4-worker.test.ts` |
| Atomic checkpoint/project roundtrip, legacy Phase2/3, price-only edits, malformed and oversized imports | `tests/phase4-persistence.test.ts` |
| Same initial state and suppressed declared faults, signed differences, mismatch/incomplete rejection | `tests/phase4-pairing.test.ts` |
| Actual supported two-design signature and100,000 case, wall time and memory observations | `tests/phase4-demonstrations.test.ts` |
| Real UI report, comparisons, exports/imports, saved histories, mobile refresh, manual/speed equality, cancellation, settling, keyboard/fallback, replay/seek and unequal windows | Six journeys in `tests/browser/phase4.spec.ts`, run in Chromium/Firefox/WebKit |
| Preserved existing behavior including both real telemetry integrations | Complete existing `tests` suite with `NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1`; mandatory production browser files `prototype.spec.ts`, `phase2.spec.ts`, `phase3.spec.ts` |

## Completed focused observations

- Baseline gap1/1 passed on `91a52ee`; not a missing-API compilation failure.
- At integrated `4eccabf` (tree `1cb4426b55c51b4f0413d3ea60b2699bdb7b98c0`),102 Phase4 tests in6 files passed,0 failures/skips,1.96 seconds. Counts: baseline1, definition23, metrics32, engine16, worker13, persistence17. Raw `testing-slice2-repaired.json`.
- At integrated runner `64e0988`, pairing10 plus real demonstrations2 passed,0 failures/skips,1.22 seconds. Raw `testing-slice3-pair-demonstrations.json`; measured envelope in `testing-slice3-envelope.json`.
- At UI `7311c42`, first executed Chromium production Phase4 browser gate passed4 journeys and failed1 in20.8 seconds: generic Replay dropped the experiment extension. The sixth unequal-window regression was then added. The sandbox initially prevented browser launch; its0-ms launch failures are retained separately from this actual executed gate. Authorized browser execution succeeded without changing assertions or retrying a correctness failure.
- At integrated `d856c69` (tree `ad3411d904f66184882959c79b5ae31df27a74e6`),17 engine and11 pairing tests passed,0 failures/skips,900 ms, including the original warmup and terminal-unavailable regressions. Raw `testing-numerical-verification-repaired.json`.
- Independent Verification identified left-held warmup qualification, unavailable-terminal comparison, endpoint-delta labeling and recovery-reference defects. Testing reproduced the numerical warmup and unavailable-pair findings; Verification independently decoded the native exported recovery timing. These are blocking until independently rechecked. Earlier footprint and four boundary repairs are recorded in `FIXES.md`.

Two original metric harness corrections were independently reviewed: a synthetic extrema test now supplies committed intervals before its sampled boundaries, and the repeated-disruption test moves the second trip after a completed first confirmation while preserving a separate exact-terminal relapse case. Expected mathematical guarantees were not weakened. No new failing case is skipped.

## Final gate protocol

Freeze source and record its SHA/tree. Install from the unchanged lock, run typecheck/lint, all unit/integration tests with both real telemetry flags and the actual dev server, build, then all four mandatory browser files against the production build with retries0 across all three engines. Record actual counts, raw logs, measured timings, exclusions and all diagnosed failures. Only the historical500,000 prototype Step10s checks in Chromium/WebKit are excluded; no Phase4 exclusions. After substantive repair, rerun the affected and final gates.

Independent Verification reviews the exact candidate; source CI must test the same tree that main will accept. Preserve a fresh verified Pages rollback and the entire preview before publication. Accepted-main build bytes must equal the tested production build except narrowly explained identity metadata. Verify completed Pages deployment, all tracked public files/manifest hashes/preview markers and release identity before and after the full hosted browser gate. A critical hosted failure triggers the preserved artifact rollback; publication alone is not acceptance.

The durable evidence directory is `/Users/arhaan/Documents/ChatGPT/Neptune/artifacts/phase-4-20260911/`. GitHub source CI retains native JSON, logs and traces in its `prototype-verification` artifact. `EXECUTION.md` records source and release links when available. No credentials, recordings or large native traces are committed.

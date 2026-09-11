# Fixing receipt — integrated replay, warmup, comparison and reference repairs

Role `/root/fixing`, worktree `/private/tmp/neptune-phase4-fixing-20260911`. Input immutable root `7311c421a924a435e8e83a635a1a39dc84efd6c6` merged non-destructively. Building completed and root explicitly transferred the affected surfaces; no competing writer, test edits, main, remote or deployment work by Fixing.

Root reports both repair commits integrated at `e32e9a0`; independent Testing and Verification recheck that integrated source. Issue map: PH4-I01 Replay/Seek definition and initial-state preservation; PH4-I02 warmup interval-start thermal dwell; PH4-I03 unavailable counterfactual comparison; PH4-I04 unequal-window/absent-module endpoint differences; PH4-I05 separate fault and qualifying-violation recovery clocks. Production worktree is clean and checkpointed pending a further reproduced assignment.

## Small commits for root integration

1. `7bb04dc4e167e491eb6488ebddafd78547821c3a` changes only `src/twin/experiment/runtime.ts` and `src/twin/experiment/runner.ts` (3 insertions, 2 deletions). Parent `31cca6f` contains Testing `72cae78` after the root merge. Warmup checks interval-start held thermal observations, so a violation on [0,1) cannot count toward settled dwell. Counterfactual comparison uses canonical evaluation availability and complete coverage, including unavailable terminal boundaries.
2. `fb72719029387da3ab153bb8847efefdae47dda0` changes `src/twin/experiment/runner.ts`, `src/twin/experiment/report.ts`, `src/ui/useTwin.ts`, `src/ui/TwinApp.tsx`, `src/ui/ExperimentPanel.tsx` (43 insertions, 23 deletions). Parent `2a4f5f3` also includes independent Testing `7eabee7` and `e6028e4` reference-time regressions. Root should cherry-pick this production-only commit after the first.

## Reproduction and repair meaning

Independent engine + pairing tests on the pre-repair input produced 26 PASS / 2 FAIL (888 ms). A thermal threshold between initial and first end-boundary values incorrectly settled at time 1 despite a violating held interval; expected earliest origin 2. A validated imported completed run with terminal boundary unavailable incorrectly yielded a comparable signed difference 80; expected incomplete with null absolute/difference.

Testing independently reproduced generic Replay losing `state.experiment`, Seek needing the original 20-second definition with a 10-second partial observation, and unequal saved windows (20/40 seconds) rendering a misleading same-time endpoint delta. Verification additionally identified fabricated zero-K fallback for missing selected modules. Existing native browser evidence is retained by Testing.

Replay/Seek now prepare a fresh execution from the stored original physical initial checkpoint using the existing worker replay-with-state contract. They retain the original definition for declared-only input histories and honor the requested physical time. Recorded interactive inputs produce an explicit derived definition, keeping all physical assumptions and converting the existing physical event times to evaluation time using the recorded origin; the UI announces the derived revision. No new worker or persisted checkpoint fields were added.

Endpoint differences now require the same time basis, matching observation times and the selected module installed in both compared designs. An absent module remains unavailable in its individual endpoint card; no zero temperature or fallback module is used.

Signature reference defect reproduced by independent demonstration assertion: actual fault event at 30 seconds, qualifying violation at 240, recovery onset 364, confirmation 369. Before the report repair, the additional fault-clock fields were absent (1 PASS / 1 FAIL, 964 ms). Persisted `metrics.referenceTimeS` continues to mean qualifying violation onset. Exported recovery report now explicitly supplies `referenceTimeBasis`, `violationOnsetTimeS`, actual `referenceEventTimeS`, `onsetFromEventS` and `confirmationFromEventS`; the UI separately labels fault-relative (334/339 seconds) and violation-relative (124/129 seconds) timings. No silent metrics-version semantic change.

## Checks completed by Fixing

- Engine + pairing after first repair: 28/28 PASS (866 ms).
- Existing Phase 4 worker + independently asserted demonstrations after second repair: 15/15 PASS (1.61 s). This includes actual signature and 100,000-accelerator trajectories; numerical expectations unchanged.
- Typecheck, lint and diff whitespace check: PASS.
- Testing owns additional custom-initial-state and recorded-input replay regressions, plus native browser rechecks, on root's integrated source.

Independent review and final release gates remain required. This receipt does not assert acceptance or deployment.

## PH4-I01 follow-up: canonical initial-boundary admission

Verification found a defect introduced by the replay repair: merely attaching the experiment to its physical initial state left a provisional evaluation and unapplied time-zero events, so the worker rejected that supplied checkpoint before it could execute. Fixing reproduced on `fb72719` (equivalent affected source to root `e32e9a0`): reference trip at 5 rejected with `EXPERIMENT_EVALUATION`; trip at 0 rejected with `STATE_EVENT_CURSOR`. Both direct `validateState` and the actual worker handler rejected the candidate.

Isolated repair `b9c5a7611d69fc4f71bfb5186b535306fe11ae3b` (parent `fb72719029387da3ab153bb8847efefdae47dda0`) changes only `src/twin/engine/simulation.ts` and `src/twin/experiment/runner.ts`. New canonical `initializeExperimentFromState` validates the saved physical initial checkpoint, clones it, attaches the definition, applies due time-zero events, finalizes the experiment boundary and validates the whole candidate before returning it to worker admission. No validator was relaxed and stored initial physical quantities are preserved.

Four direct worker checks now pass with exact entire-experiment equality to their original runs: cold fault at 5 (80 accelerator-seconds), cold fault at 0 (120 accelerator-seconds), zero-duration fault at 0 (0 accelerator-seconds), and settled-start fault at evaluation 5 (80 accelerator-seconds). Typecheck and diff whitespace checks pass. Testing independently owns the expanded executable replay regressions and integrated browser recheck.

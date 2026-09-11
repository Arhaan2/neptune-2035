# Testing baseline behavioral reproduction

Source: `91a52eeff5a01fae3ef21cba7a8293b59e5c40fb` (accepted Phase 3), isolated testing worktree.

Command: `npm exec vitest run tests/phase4-baseline-gap.test.ts -- --reporter=verbose`

Result: 1 test passed, 1 file passed; test 89ms; suite 259ms. The fixture compiled and executed using existing Phase 3 APIs only.

Independent observation: 8 required accelerators, canonical one-second steps, shore/cluster-core trip at t=5, restore at t=15, evaluation [0,20). Capacity is zero at committed times 5 through 14; observed interruption duration 10 seconds, shortfall 80 accelerator-seconds. Final capacity is 8, current electrical/thermal/network checks all satisfied, no final warnings; sparse snapshots at t=0 and t=20 both show 8. Current final summary has no accumulated whole-experiment result capable of reporting this historical interruption.

Raw fixture JSON:

```json
{"baseline":"91a52eeff5a01fae3ef21cba7a8293b59e5c40fb","observedShortfallAcceleratorS":80,"observedInterruptionS":10,"final":{"timeS":20,"itW":10319.999999999998,"facilityW":57393.69216776267,"gridW":57393.69216776267,"pumpPowerW":26238.44377467519,"availableAccelerators":8,"energizedAccelerators":8,"curtailedAccelerators":0,"maxCoolantK":301.7634916358442,"batteryWh":400000,"instantaneousPUE":5.561404279821965,"energyPUE":7.738373914883035,"electricalResidualW":0,"thermalResidualW":0,"warnings":[]},"sparseSnapshotCapacity":[8,8]}
```

# Proposed requirement mapping and independent arithmetic

- `phase4-metrics`: synthetic 100 required; 100/40/80/100 service on 5-second intervals. Independent shortfall `(100-40)*5+(100-80)*5=400 accelerator-seconds`; minimum40 at5; service violation10; first5; thermal satisfied; recovery onset15 confirmation20. Include zero/boundary, dynamic required amount, simultaneous service/thermal violations (union), extrema/null/invalid input, flapping/repeated recoveries, evidence caps, discharge+recharge, transition deduplication.
- `phase4-engine`: actual dt dispatch sampling; interval boundary events at0/internal/T; canonical required network semantics; grouping/manual/UI-independent trajectory; canonical metric checkpoint atomicity; settled warmup/timeouts and physical state preservation; long small run and short100000 accelerator case.
- `phase4-persistence`: full definition/run/state export-import and resume mid-violation/mid-dwell; legacy unavailable status; malformed/oversized values; economic-only preservation and physical/incompatible-version rejection; interrupted histories.
- `phase4-pairing`: identical initial state and suppression of declared faults only; signed delta400-like oracle separately from actual simulator; mismatched/incomplete rejection; two-design signature demonstration driven by real supported choices.
- `phase4-worker`: request grouping, progress cadence, cancellation/resource/failure preserved coverage, stale/duplicate replies, deterministic replay.
- `browser/phase4`: real reference experiment and report, pause/step/cancel, both demonstrations/Compare, full export-import/reload, keyboard/mobile/fallback, worker and console/asset observations. Existing Phase3 browser suite retained; root schedules complete gates.

Contract questions: expose accumulator input shape and completion operation for pure synthetic oracle; define nullable temperature measurement handling (unavailable must block a thermal PASS); identify exact metric fields/run lifecycle and state wrapper; define battery quantity as stored energy vs bus energy with losses separately; define retention coverage semantics and first-failing/recovery episode addressing. Integer event timing and sequence ordering retained. Terminal boundary events have zero duration contribution to [0,T), with distinct terminal state and evidence.

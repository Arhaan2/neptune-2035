# Phase 6 testing provenance

Testing agent works independently in an isolated worktree based on accepted main `42a03e171f1d722874328b54fbdb2d3520ff3cc6`, source tree `ef6fafe7d75f7cf5b4fdce9cc0d75c3df8105c2a`. Requirement assertions were recorded in `REQUIREMENT-MATRIX.md` before ranking implementation. No Phase5 tests, skips, retries, or timeouts are modified.

Native runs and any failed attempts are retained in the execution evidence directory, outside frozen source. Orchestration owns durable/public evidence publication and independent defect closure. Test counts and commit identities are appended only after actual execution.

## Baseline and frozen reference assertions

- Native `npm ci` succeeded on the isolated accepted-main checkout (520 packages); no package/lockfile edits.
- Retained Phase5 unit/engine/worker/persistence/topology/capacity/coupling/oracle suite: **152 passed, 0 failed, 0 skipped** on `42a03e171f1d722874328b54fbdb2d3520ff3cc6`.
- New `tests/phase6-reference.test.ts`: **6 passed**, independently evaluating the frozen Phase6 policy against raw real-engine results. A reproduces II/III 80/19 unmet accelerator-seconds, 10/2.375 seconds total interruption, III onset/confirmation 4.375/9.375 seconds, $160,000 direct transfer equipment and $240,000 included total premium. Original Phase5 FAIL remains unchanged.
- B reproduces receiving-bus 80/80 and common-source 240/240 unmet accelerator-seconds; neither architecture passes the mandatory fault policy. C nominal-only prefers cheaper II. A 9-second observation cannot satisfy 5-second recovery dwell despite restored endpoint service. Shared donor remains 160/99, and unavailable headroom admits zero fraction of the rejected platform.
- Typecheck and lint pass with the new reference test. Native JSON/log evidence retained outside source under the Testing execution directory, named `baseline-phase5` and `reference`.

## Incremental acceptance and failure provenance

Testing authored independent contract, ranking, real-engine, sensitivity, persistence/reproduction and browser assertions alongside implementation. Native evidence filenames below identify separate retained executions, not a claimed final release gate. Orchestration reruns the complete gate on one frozen source tree.

| Slice / defect | Native result | Independent disposition |
| --- | --- | --- |
| Contract `ee40a70` | `contract-ee40a70`: 38 passed, 4 failed | P6-T001 rejects missing mandatory requirements after `0f47b75`; unchanged assertions now 42/42 in `contract-T001-retest`. |
| Evaluation `379727d` | `evaluation-379727`: 31 passed, 1 failed | P6-T002 terminal observation unavailable was wrongly feasible. Guard in `cae0df3` yields 32/32 in `evaluation-cae0df3-retest`. |
| Real runner `cae0df3` | `engine-cae0df3`: 12 passed, 1 test-harness timeout | The T004 assertion had not run: the test unnecessarily executed all nine central 120-second thermal cells from the full 81-cell fixture within the unchanged Vitest 5-second budget. Orchestration independently approved replacing only this fixture with transfer nominal/feeder × central/idle-upper (12 declared cells, six completed central cells). Same assertion and criteria, no timeout/retry/skip change; the independent D 120-second engine test remains unchanged. `engine-T004-bounded` then reproduces the actual erroneous `scopeComplete: true`. |
| Worker and incomplete scope `9d96140` | `runner-fixes-retest`: 17 passed | P6-T003 watchdog and P6-T004 incomplete sensitivity scope independently closed by Testing. Includes Testing's 13 engine tests plus Fixing's four worker regressions. |
| Evidence `f1be93` | `persistence-f1be93`: 17 passed | Real export/import labels supplied evidence, fresh invocation reruns and matches, malformed/tampered/version/size/initial-state inputs reject. |
| Comparator `cba6d5f` | `reproduction-tolerances-before-separated`: 18 passed, 2 failed | P6-T006 `peakSupply.timeS + 5e-7` and equipment row `count + .001` were incorrectly tolerated as W/USD. After `7084326`, `T006-and-performance-retest` passes 26/26 (20 persistence assertions plus six focused lifecycle/chunk-equivalence regressions). |
| Native Chromium first Phase6 UI | `browser-phase6-first`: 4 passed, 1 failed | P6-T005 real candidate load emitted React duplicate cost-row key errors. Original no-console-error assertion passes after `a8b4fb2`; no error filtering added. |
| Full native sensitivity and budget | `browser-phase6-E-first`: 2 passed | All 81 cells, nine paired cases, 27 actual 120-second thermal observations, unchanged III winner, and exact cost-only physical histories; 13.6 seconds. Nominal $50m central budget passes and upper bound fails, 2.5 seconds. |
| First three-engine Phase6 matrix | `browser-phase6-three-engine`: 20 passed, 1 test-harness failure | Chromium F compared result arrays by asynchronous completion position. The trace shows nominal zero-loss fields paired with feeder-fault 80-loss fields; matching run IDs are `ii-24:central:nominal` and `ii-24:central:eligible-feeder`. UI's real recomputation comparison already passed after normalizing run IDs. Orchestration independently approved sorting by stable `run.id` before the same complete metrics equality; the assertion now also compares the IDs. Equivalent budget-pair assertion uses the same alignment. No metrics, tolerance, retry, skip or timeout changed. Corrected three-engine rerun is recorded separately. |

Retained baseline browser acceptance: untouched Phase5 Chromium five journeys pass; native `baseline-phase5-browser`. Complete preimplementation unit execution initially hit sandbox `EPERM` on the actual SSE listener; authorized execution passed 670 with only the unchanged DataPanel test failing because its hardcoded port 5173 was not running (isolated test app was on 5177). Satisfying that existing precondition yields 47/47 retained telemetry tests including both real browser integrations in `telemetry-retained-retest`. These environment/harness failures remain preserved; no baseline assertion was edited.

Existing browser exclusions remain exactly the Chromium and WebKit variants of `tests/browser/prototype.spec.ts` → `public prototype large-campus functional Step 10s`; Firefox executes that retained large-campus case. There are no Phase6 skips. Targeted test-name filters used while reproducing defects are not release-gate exclusions.

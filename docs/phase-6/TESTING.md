# Phase 6 testing provenance

Testing agent works independently in an isolated worktree based on accepted main `42a03e171f1d722874328b54fbdb2d3520ff3cc6`, source tree `ef6fafe7d75f7cf5b4fdce9cc0d75c3df8105c2a`. Requirement assertions were recorded in `REQUIREMENT-MATRIX.md` before ranking implementation. No Phase5 tests, skips, retries, or timeouts are modified.

Native runs and any failed attempts are retained in the execution evidence directory, outside frozen source. Orchestration owns durable/public evidence publication and independent defect closure. Test counts and commit identities are appended only after actual execution.

## Baseline and frozen reference assertions

- Native `npm ci` succeeded on the isolated accepted-main checkout (520 packages); no package/lockfile edits.
- Retained Phase5 unit/engine/worker/persistence/topology/capacity/coupling/oracle suite: **152 passed, 0 failed, 0 skipped** on `42a03e171f1d722874328b54fbdb2d3520ff3cc6`.
- New `tests/phase6-reference.test.ts`: **6 passed**, independently evaluating the frozen Phase6 policy against raw real-engine results. A reproduces II/III 80/19 unmet accelerator-seconds, 10/2.375 seconds total interruption, III onset/confirmation 4.375/9.375 seconds, $160,000 direct transfer equipment and $240,000 included total premium. Original Phase5 FAIL remains unchanged.
- B reproduces receiving-bus 80/80 and common-source 240/240 unmet accelerator-seconds; neither architecture passes the mandatory fault policy. C nominal-only prefers cheaper II. A 9-second observation cannot satisfy 5-second recovery dwell despite restored endpoint service. Shared donor remains 160/99, and unavailable headroom admits zero fraction of the rejected platform.
- Typecheck and lint pass with the new reference test. Native JSON/log evidence retained outside source under the Testing execution directory, named `baseline-phase5` and `reference`.

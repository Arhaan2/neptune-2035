# Independent review of the bounded CI repair

**Engineering verdict: PASS** for source `58cee60176705fb8e5ad82fcbbe9d01f7965d16f`, tree `f95c491a744881bbe76cc209be2174f26d936943`. Final acceptance remains conditional on the complete gate for this repaired candidate, successful CI, merge-tree correspondence and public deployment verification. This review is by the distinct Independent Verification agent, with no production-code or deployment writes.

## Reviewed change and preserved behavior

Reviewed the complete production/test delta from previously accepted pre-CI candidate `1a418cc4d38a23674a73dc7b92055d72258748c8`, including the canonical network projection (`d292e27`), network-before-resize UI preparation, two exact-design equivalence assertions, eight initial projection/admission regressions, and the subsequent operable-inventory repair (`e76c997`).

The performance change removes redundant work from network compilation: the same canonical asset/connection functions can project only network, rack and compute inventory; that inventory is supplied once to canonical connection generation. Electrical and hydraulic links are not generated solely to discard them during network compilation. Default full inventory and default full connections retain their ordering and fields. Hydrostatic iterations, masses, geometry formulas, equipment authority, workload/profile meanings and engineering identity inputs are unchanged. Switching remains charged on egress once per traffic class, and ports/links retain separate shared-resource identities and limits.

The no-required-network compact path validates every stored network edge and the actual platform-to-module attachments before avoiding unused leaves/resources. Required-network cases and the ordinary full inspector still compile the full canonical network projection; zero offered load cannot bypass required topology validation. There is no global mutable cache. The UI selects nominal networking before resizing, avoiding a large legacy design that would immediately be discarded; exact complete-design equality is tested at pilot and campus scale.

## Independent finding PH3-CI-02 and resolution

The first repaired candidate `a39738e9842cf9337dc49d561271367d02af71ca`, tree `7ba4dbe1f864addc8dd037f172142b92e3d9151f`, introduced one narrow validation regression. For a one-node design with both network classes optional, declaring that node energized while listing the same node as failed caused the full evaluator to reject `NETWORK_OPERABLE_INVENTORY`, but the compact fast path returned `satisfied` before checking operable inventory. No incorrect allocation from the normal application was observed; the evaluator admission invariant and full/compact parity nevertheless regressed, so verification blocked acceptance.

An independently authored ephemeral fixture reproduced the discrepancy in 13 ms. Root assigned it to Fixing rather than weakening the expected result. The final repair permits the fast path only without explicit failures. Failure queries use the complete graph and existing operable-inventory validation. A separate `dormantValidated` flag prevents an attachment-only validation graph from being reused as a complete graph after a later failure. This matters for a reused evaluator that moves from healthy operation to failure and restoration.

The original independent fixture passes unchanged on the final source: both paths reject the same invalid allocation with `NETWORK_OPERABLE_INVENTORY`. Added production regressions reuse the same full/compact evaluators through healthy, failed node/rack with invalid allocation, zero/valid remaining allocation, and restoration. The fast path remains available for the original no-failure million-accelerator timing case. No timeout or capacity assertion was relaxed.

## Evidence independently inspected and executed

The earlier repaired full-gate native reports were inspected directly, rather than relying only on the pause summary:

- `unit-repaired.json`: **374 passed, zero failed/skipped, 22 files**. Both actual telemetry integrations are recorded as passed. The existing million-accelerator inventory/initialization case took 1,912.874459 ms; the Phase 3 million-accelerator resource case took 2,022.97875 ms, within their unchanged 5,000 ms limits.
- `browser-repaired.json`: **19 passed, two historical exclusions, zero unexpected/flaky results**. These reports belong to Testing source `165f3c194ce2fc75c6f98edd6fd76826c8973cbd`, tree `7ba4dbe1f864addc8dd037f172142b92e3d9151f`, before PH3-CI-02 was repaired. They are not relabeled as a full gate for the final source.
- Both reports and the truthful pause receipt remain at `/private/tmp/neptune-phase3-testing/artifacts/phase3-ci-profile/` and `docs/phase-3/TESTING-PAUSE.md` in the Testing worktree. The user subsequently authorized resuming work.

On the exact final source above, Verification ran `npm test -- tests/phase3-verifier-repair.test.ts tests/phase3-network-projection.test.ts tests/phase3-edge-validation.test.ts --reporter=verbose --reporter=json --outputFile=/private/tmp/neptune-verifier-repair-final-results.json`: **24 passed across three files, 956 ms, no failures or retries**. This includes the original independent regression, exact legacy/new projected inventory and link parity, dormant malformed endpoints, actual attachment directions, disconnected cycles/multiple parents, required-network full/compact equivalence, power-dependency equivalence and reused-evaluator failure/restoration. No heavy suite was run concurrently by Verification.

Preserved independent local evidence (root may copy these actual files into the final ignored artifact directory):

- `/private/tmp/neptune-verifier-repair-fixture-initial.ts` — original independent reproduction source.
- `/private/tmp/neptune-verifier-repair-results.json` — original failing result on `a39738e`.
- `/private/tmp/neptune-verifier-repair-fixed-results.json` — unchanged fixture passing on `e76c997`, whose production/test diff equals final root `58cee60`.
- `/private/tmp/neptune-verifier-repair-final-results.json` — 24-case focused run on final root `58cee60`.

These are local artifacts, not public links. The first CI failure (`34550958284`, 362/364 passed with two 5-second timeouts) remains recorded as failed. Complete final local acceptance and fresh CI/public release evidence must be read and bound to the final candidate before declaring deployment complete.

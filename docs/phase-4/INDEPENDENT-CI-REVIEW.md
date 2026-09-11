# Verification — CI 34568246585 failure diagnosis

Disposition: release approval remains withheld. This receipt diagnoses the observed failure; it does not accept an unexecuted repair or claim the signature would complete if given longer.

## Immutable identity and actual results

Native `source-identity.txt` records PR merge `f52078a82bfecdea5d29cc0e871c065d8e3cfaf3`, parents `91a52eeff5a01fae3ef21cba7a8293b59e5c40fb` and `377ce40c54479143da52146ef6283ddd3c1f3be8`, tree `f743c89ad6659b992e6ecbce1e453fb3ac6b6885`. This is the candidate tree reviewed in `verification-final-candidate-377ce40.md`.

Independently parsed native `unit.json`: 498/498 passed, zero failures/pending. Native `browser.json`: 34 expected, 3 unexpected, 2 skipped, zero flaky, total375.037s; every result retry0. The only skips are the documented historical public-prototype large-campus Step10s cases in Chromium/WebKit. All three failures are the Phase4 signature journey, at line121's first No standby pump shortfall assertion. Failed journey durations: Chromium16955ms, Firefox17182ms, WebKit17680ms. This is a failed mandatory gate, not37 passing browser checks.

## Evidence and diagnosis

Read all three native error-context files and corresponding trace console records. In every failure snapshot, comparison controls show disabled `Evaluating…` and disabled `Run signature demonstration`; the signature description is present and the comparison cards have not been committed. The old fault-pair notice still says execution complete. No resource-limit/numerical error notice is shown. The assertion reports element(s) not found after12000ms, not a differing shortfall value. Trace console records contain no console error/pageError from the signature; observed WebGL context-loss logs/warnings occur around old comparison-scene removal and are not evidence of solver failure.

Immutable source `src/ui/TwinApp.tsx:510` clears the comparison, starts two1800-second worker runs sequentially, then commits both result cards together. `src/ui/useTwin.ts:32` ignores progress messages, rejects resource-limited/failed replies, and terminates on the worker watchdog. `src/twin/persistence/limits.ts:22` retains a120000ms per-job budget; the wrapper watchdog is that budget+1000ms. The shared Playwright default expectation is12000ms. Therefore the native evidence establishes a readiness deadline expiring during pending work. It does not establish a numerical defect or an exhausted worker resource budget; neither does it prove eventual successful completion or identify how far either worker progressed.

## Required repair meaning and next evidence

A bounded, signature-specific wait on actual comparison completion is justified. It must preserve the exact79360/0 accelerator-second values,1800-second coverage, fault/violation/recovery references, matched final states and real exported worker results. Numerical failures/resource limits must remain explicit failures. Do not skip the journey, add retries, change the signature duration/physics, or treat missing cards as a numerical assertion that passed. A comparison lifecycle indicator and replacement of the stale preceding-run completion notice would improve truthful UI readiness; neither warrants altering solver limits merely to satisfy the test.

Testing should independently execute the repaired journey with actual native workers and record completed elapsed times; final mandatory CI must pass on the exact revised tree before release approval. All earlier engineering findings remain resolved on the reviewed source; this new failed gate supersedes any inference of release readiness from local/focused passes.

Evidence root: `ci-34568246585/prototype-verification-f52078a82bfecdea5d29cc0e871c065d8e3cfaf3/`, especially `artifacts/prototype/{source-identity.txt,unit.json,browser.json}` and `test-results/phase4-PH4-genuine-fault-p-31dca-port-exact-computed-results-{chromium,firefox,webkit}/{error-context.md,trace.zip}`. Full native job log: `ci-live-log-attempt.txt`.

Read-only Verification; no production files or tests changed; no duplicate broad suite executed.

## Subsequent independently decoded progress and optimization review scope

Chromium trace network requests for signature workers are at77690.173ms and85797.527ms, after signature click at77601.671ms. Their8.107s separation, together with the sequential source and complete-state validation, proves the first signature worker completed before the second began. Firefox/WebKit traces contain only the first signature worker request before the assertion timed out. This strengthens pending-work diagnosis without establishing the final second-run metrics.

Root has chosen a bounded production performance repair with no timeout/chunk/deadline change: avoid materializing every rack/node for support-asset lookups by using the existing canonical `moduleAssets(...,{attachmentOnly:true})`; retain full inventory resolution for real rack/node IDs. Verification will review exact patch, canonical IDs/fields, absent standby and partial-rack rejection, design generations and admission guards. This is a permissible alternative to a signature-specific readiness wait; no production repair is accepted by this diagnosis receipt alone.

Reviewed independent regression `5bea05a9b19cbb7a5a9cb16da1e6093bc32d805a`: two1800s default-chunk worker executions compare complete experiment, modules, events, log and applied cursor to reference, and validate every delivered checkpoint. Immediate injected scheduler is explicitly disclosed; wall timings must not be presented as native browser elapsed times. Existing numerical assertions remain unchanged.

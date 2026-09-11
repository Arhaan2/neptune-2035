# Independent Testing CI signature investigation

CI34568246585: head377ce40c54479143da52146ef6283ddd3c1f3be8, mergef52078a82bfecdea5d29cc0e871c065d8e3cfaf3. Native traces and error-context snapshots were read independently; no tests or production changed for initial classification.

All three signature failures show actual comparison lifecycle Evaluating and disabled run controls. The card is absent because both jobs have not completed; there is no observed wrong metric. Prior20s pair passed. No error-level browser console or resource-limit/error notice is present. Warning/log-level canvas context loss appears when the prior two comparison canvases are disposed and is not evidence of numerical failure.

Extracted worker-asset request timing is in testing-ci-signature-timing-evidence.json. Chromium starts the first signature worker at77690.173ms and the second at85797.527ms: approximately8.1seconds between the two sequential starts. Firefox and WebKit have only the first signature worker request before the12second result assertion ends. This establishes active but slow execution, not an ignored button action or selector mismatch.

Production source runs two1800s jobs sequentially, default10s worker chunks (180calls each). Every advance validates and clones accumulated state and constructs a validated detached project candidate. The single-call reference runner used by earlier signature unit assertions does not measure that repeated worker path.

Testing regression5bea05a adds both full signature trajectories through the default worker chunk protocol with exact equality against the reference experiment, physical modules, events, log, and applied-event cursor. Every delivered state is validated. The injected scheduler resolves immediately, so measurements exclude timer/render delays and are explicitly labeled. These20worker tests pass on unchanged production; the two long cases take2299.195ms and2177.619ms in native Vitest output on macOSarm64. This is throughput evidence, not a universal performance guarantee or failure threshold. Raw testing-ci-long-worker-before.json retained.

Classification: real worker throughput limitation on the CI envelope; no observed numerical mismatch and no browser assertion defect. Root/Fixing retain production ownership; browser exact metrics, time windows, exports, screenshots, error checks, and12second assertion limit remain unchanged. No retries/skips/timeouts were added by Testing.

## Contract-preserving regression additions

Commit788312f adds13canonicallookup cases: all assets resolve identically across three families and optional standby, attachment inventory agrees with full inventory,72accelerators produce9nodes/3racks with only one third-rack node, canonical support/rack/node faults and logs validate, and malformed local equipment/log IDs are rejected. These13cases pass before optimization; they protect identity and input-admission semantics during the production repair.

Commit19700ab adds a real lifecycle readiness wait after signature click. Root explicitly requested this, and Verification reviewed the exact DOM predicate. It waits for the same signature action to re-enable after compareBusy is cleared by actual completion/failure. No timeout argument is supplied; the existing60second overall test budget still bounds it. The default12second exact-value assertions and all whole-history/export/error assertions remain unchanged. Re-enabled controls are not treated as numerical success. This replaces the unintended use of a report-value assertion as the entire two-job execution deadline, while production throughput optimization remains required independently.

## Independent post-repair gate

Sourcecbb692236e1897b12dde9cb253bbd4484210e4cc, tree86ff7a5b1cc5f2439398dbb7d435c4f95c042e7b. Testing mergea2d52591fd2f646b4cc885f7422302947f6e99c1 has the identical tree. npm test -- tests/phase4-*.test.ts reports137PASS/0FAIL/0pending in9files (testing-ci-repair-focused.json). This includes the13lookup protections and2long-worker trajectories. npm run build includes TypeScript and passed; fresh outputworker-BjFFDFG4.js andindex-CfEDeDcj.js used for the browser gate.

Post-repair immediate-scheduler worker measurements were1288.003ms and1387.703ms for1800seconds with180unchanged chunks each. Separate native worker observation file contains environment and RSS snapshots. This timing scope excludes reference generation/assertion cost, unlike initial JSON per-test durations; those scopes must not be represented as an exact speedup ratio. Full results remain numerically identical.

All six Chromium Phase4 journeys PASS on the fresh production build at4176, zero retries/skips/flakes,20.4seconds total. Signature journey5.1seconds includes real20s pair, exports, both actual1800s signature runs, metrics/recovery/export assertions and screenshot. Reporttesting-ci-repair-chromium.json and matching output directory preserve native artifacts. No browser budgets or metric expectations increased. Readiness wait uses actual UI lifecycle inside the unchanged overall60second budget.

Previewsession20027 was stopped by SIGINT after the gate. Testing working tree clean; no active tests or servers. Root may replace sharednode_modules and run complete final gates and CI. This local pass does not by itself establish the Linux CI envelope; the final CI rerun remains required.

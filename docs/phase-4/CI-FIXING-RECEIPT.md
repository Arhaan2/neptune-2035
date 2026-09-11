# PH4-CI01 — signature worker readiness and repeated inventory construction

Fixing role `/root/fixing`. Failure source root `377ce40`, tree `f743c89ad6659b992e6ecbce1e453fb3ac6b6885`; the fixing worktree's non-destructive merge `365918f2c6975393746f11917bc12d0b68f3791e` has that exact tree. Merge preserved root's latest independent browser assertions byte-for-byte. CI run: https://github.com/Arhaan2/neptune-2035/actions/runs/34568246585 . Actual CI merge source `f52078a82bfecdea5d29cc0e871c065d8e3cfaf3` shares the tested source tree.

## Diagnosis from native evidence

All three browser failures had accepted the signature click, shown the signature definition, remained busy, and produced neither a result card nor an error notice at the 12-second value assertion. Testing independently measured Chromium's second signature worker request 8.107 seconds after the first, demonstrating real first-job completion; Firefox and WebKit had not begun their second jobs before the assertion ended. No error-level console or failed asset caused this condition. Context-loss messages came from disposing the preceding comparison canvases.

The two 1,800-second runs execute sequentially using 180 bounded 10-second chunks per worker. The independent one-call numerical reference is much faster and did not characterize this browser path. Local real-handler diagnostics measured 2,450.8 / 2,372.8 ms, with 2,198.6 / 2,144.2 ms inside the repeated chunks. A Node CPU profile found substantial unnecessary canonical `asset()` construction (452 ms sampled) and structural traversal (291 ms): routine support/controller references repeatedly constructed all 40 racks and 160 servers.

This was a readiness failure at the browser's value assertion, not an incorrect final number or an observed model resource-limit failure. The 120,000 ms worker budget, 10-second chunks, all admission limits and all numerical assertions remain unchanged by Fixing.

## Isolated repairs

- `d665fd3c302a1f2101b081bff5abf9922b752f4d`: `src/twin/assets/design.ts` and `src/twin/persistence/state.ts`, 10 insertions / 3 deletions. Resolve local support assets using the existing canonical `attachmentOnly` generator first. Fall back to the complete canonical rack/server inventory for any unmatched reference. State-validation caches exist only within that validation call. Every existing structural, identity, event, cursor, quantity, deadline and fault check remains intact. No mutable global cache, alternate asset-ID model or skipped validation.
- `63c3afdb685d1c10f88533294e70f157e33ddbf1`: `src/ui/useTwin.ts` and `src/ui/TwinApp.tsx`, 11 insertions / 4 deletions. Clear stale preceding completion notices, report real worker progress, publish each actually completed and validated signature card, retain comparison busy state until both finish, and expose that state with `aria-busy`. Partial results cannot produce endpoint or counterfactual deltas. No artificial delay or completion assumption.

## Measured checks

- Existing physics + definition + expanded worker checks: 71/71 PASS. Testing's complete-worker fixtures compare exact metrics, modules, event histories, logs and cursor against the one-call reference and validate each delivered checkpoint.
- Independent exhaustive lookup fixtures: 13/13 PASS, covering all installed assets in generations I/II/III, standby present/absent, partial racks, accepted support/rack/node faults/logs and malformed/uninstalled IDs. An initial command used an incorrect test filename and ran no tests; the correct `tests/phase4-asset-lookup.test.ts` command then ran these 13 checks.
- Typecheck, lint, production build and diff whitespace checks: PASS.
- Testing's injected-scheduler worker observations decreased from about 2.30 / 2.18 seconds before the lookup repair to 1.328 / 1.265 seconds locally. These omit browser scheduling and are not a CI guarantee.
- Native Chromium, same local machine, production build, actual full UI signature after its preceding fault pair: before repair first card 5,872 ms / both cards 5,875 ms; after repair first card 2,329 ms / both cards 4,160 ms. Individual worker creation-to-completion intervals changed from 2,691 / 2,682 ms to 2,017 / 1,993 ms. At first repaired card there was exactly one card, comparison `aria-busy=true`, and no endpoint delta. At both cards busy was false. Exact results remained 79,360 / 0 accelerator-seconds and both workers completed all 1,800 seconds.

Raw evidence: `fixing-CI01-handler-baseline.json`, `fixing-CI01-native-baseline.json`, `fixing-CI01-native-after.json`, `fixing-CI01-baseline.cpuprofile`; the original native CI artifacts remain under `ci-34568246585/`.

Testing and Verification own integrated rechecks and the independently reviewed readiness-harness adjustment. Root owns the final complete local, CI and hosted gates. This receipt is not release acceptance, and local measurements are not Linux CI or physical-validation claims.

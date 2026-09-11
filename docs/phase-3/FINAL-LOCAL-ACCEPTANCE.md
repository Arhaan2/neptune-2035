# Final Phase 3 local acceptance

**PASS** on source `e76c9975c33f7eb618c95b7705935cec82c518f4`, tree `f95c491a744881bbe76cc209be2174f26d936943`. Root integration `58cee60176705fb8e5ad82fcbbe9d01f7965d16f` has the exact same tree. This receipt is a subsequent documentation-only addition.

| Gate | Actual result |
| --- | --- |
| Typecheck | PASS |
| Lint | PASS |
| Full unit/integration suite | **376 passed, 0 failed, 0 skipped; 22 files**, 29.33 s |
| Both real telemetry integrations | PASS; all 47 telemetry cases executed |
| Production build | PASS; generated worker `assets/worker-CqEaU7vJ.js` |
| Production browser acceptance, three suites and engines | **19 passed, 0 failed, 2 historical exclusions, 0 flaky**, 73.745 s |

The final native browser run started at `2026-09-11T01:57:23.159Z`. Chromium passed 6 cases with 1 historical exclusion; Firefox passed all 7; WebKit passed 6 with 1 historical exclusion. Phase 2 passed 9 cases, Phase 3 passed 6, and prototype passed 4 with the 2 existing exclusions. The only exclusions remain the existing 500,000-accelerator Step 10s case in Chromium and WebKit. Firefox ran that case and the real 100,000-accelerator Phase 3 comparison. Every browser attempt had retry index zero; configured retries were zero.

The two actual telemetry integrations were:

- Production adapter with native browser reconnect, Last-Event-ID and source validation: passed in 705.525 ms.
- App mapping, raw inspection, simulated dropout, calibration and actual streaming: passed in 4004.465 ms.

The final whole-suite million-accelerator cases took 2058.370 ms for the full Phase 3 resource assessment and 2020.684 ms for the existing legacy inventory/supply simulation. Their original 5 s limits and all capacity assertions remain unchanged. The final guard repair also preserves invalid energized-allocation rejection after node/rack failures when both network classes are optional; its two additional regressions ran in this full suite.

Commands executed on this tree:

```text
npm run typecheck
npm run lint
NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1 npm test -- --reporter=default --reporter=json --outputFile=artifacts/phase3-final-gate/unit.json
npm run build
NEPTUNE_BASE_URL=http://127.0.0.1:4173/ NEPTUNE_BROWSER_REPORT=artifacts/phase3-final-gate/browser.json npm run test:browser -- tests/browser/prototype.spec.ts tests/browser/phase2.spec.ts tests/browser/phase3.spec.ts --retries=0
```

Environment: macOS arm64, Node 24.18.0, npm 11.16.0, unchanged repository browser configuration and one worker. `npm ci` had already installed the unchanged lockfile. Its Git blob remains `36113f734cddba74c9af06813e5c3f7200adfa23`; SHA-256 remains `87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9`. Solver `2.3.0`, model `neptune-reference-3`, algorithm `committed-boundary-1`, project schema 3.

Native reports and their checksummed source-identity receipt are preserved locally:

- `/private/tmp/neptune-phase3-testing/artifacts/phase3-final-gate/unit.json`
- `/private/tmp/neptune-phase3-testing/artifacts/phase3-final-gate/browser.json`
- `/private/tmp/neptune-phase3-testing/artifacts/phase3-final-gate/acceptance-identity.json`

The earlier CI timeout and all intermediate results remain recorded in the requirement matrix and CI repair report. This pass covers the final repaired local source; successful CI on the final candidate, merge, publication and hosted verification are separate required release gates and are not claimed by this document.

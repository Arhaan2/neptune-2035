# Phase 7 baseline verification

2026-09-11. Main was fetched from the public repository and explicitly selected; the default remote branch still points to an older development branch. The user's original Phase 1 worktree and two untracked files were untouched.

| Identity | Observed baseline |
| --- | --- |
| Main / PR6 merge | 9db8565a054f05b24904724ade0ed86e1c136869 |
| Source tree | 1573cced171ae14077427b5059e87b407d3b59b2 |
| Lock SHA-256 | 87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9 |
| Pages source commit | ce6432451e02a702a8c26fcb0caf6ab1952d4b60 |
| Production artifact digest | 535cd98ee44ec23080b3b51e4dca6ea7c7e1e1a4db32ff9eb40eb0cea6b5abe7 |
| Preview tree | 531d00a67da4c1f2f02a22bf249d93e683b2601b |
| Recovery artifact tar SHA-256 | d0d366707a0f138bb18a5ee5d8469ba62335f858d4b1fab31b2afcd2bd6e3013 |

PR6 metadata and Phase6 release receipts were retrieved, not assumed from the briefing. Pages API confirmed the existing legacy deployment source `codex/pages` at `/`. A full fresh public check verified 89 served files by byte hash, with two `.nojekyll` markers verified through committed Git evidence. All45 preview files are preserved. A complete Pages artifact tar and Git recovery bundle were captured externally. This checkpoint must be refreshed immediately before promotion.

Testing's native expanded inventory found784 unit/integration cases across45 files (`vitest list --staticParse=false` with both telemetry flags). Ordinary Playwright inventory is180 scheduled cases across11 files. The existing supported release gate selects81 cases across6 files, of which79 execute and two are the historical Chromium/WebKit exclusions for `public prototype large-campus functional Step 10s`: `One focused large-campus check on the previously affected browser.` Firefox executes that case. Inventory is not execution evidence and prior Phase6 pass counts are not reused.

Fresh Phase6 engine reproduction at this baseline completed transfer6/6 (III), nominal3/3 (II), receiving-bus9/9 and common-source9/9 (no feasible candidate), sizing12/12 (40 accelerators), and sensitivity81/81 (III central). Portable full campaigns were retained externally for after-change recomputation. These are modeled outcomes under the existing declared requirements; no probabilities, physical validation or global optimum are inferred.

Model identities remain `neptune-reference-3`, solver2.3.0, algorithm `committed-boundary-1`, transfer `neptune-transfer-1`, metrics `whole-run-1`, decision `decision-campaign-1`. Phase7 observer plumbing must preserve their numerical interpretation.

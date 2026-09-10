# Mobile layout repair — blocked before publication

The legacy preset overflow is fixed and its complete mobile journey passes. A new, retained V2 regression exposes a separate recovery-notice overflow, so complete acceptance and publication are blocked. This is a local checkpoint, not Phase 1 acceptance. No merge or deployment is authorized.

## Source and measured cause

Repository `Arhaan2/neptune-2035`, branch `codex/neptune-phase-1`, PR #1 targeting main. This work starts at local WIP `ccf0eda84d515ee3d7c24741c804569b7728b9c5`. The read-only remote check confirmed published head `bdff4a80cc12dfa70ecbe99b1c787a523503efa2` and main `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f`; no remote writes followed. The commit containing this closure is the new local checkpoint.

The original retained trace and screenshot were inspected. The unchanged ccf mobile test selected exactly one case and reproduced `scrollWidth=390`, `clientWidth=375` at the requested `innerWidth=390`. The task-owned container received a fresh Git clone of the ccf bundle at `/mobile-ccf`, with its exact HEAD and clean status checked. Its lockfile matched the existing installed dependencies; the old `/work` application source was not used as the test candidate.

Geometry identifies the mobile `.generation-tabs` fieldset as the earliest bad constraint. It shrank to 179px while its non-wrapping preset buttons occupied 212.42px; the third button reached x=390.42. The app, workspace, canvas, toolbar, metrics and footer were correctly sized. The same overflow persisted over 120 animation frames, from 1.66s to 7.50s after navigation. It was not stale canvas sizing.

The only application change is `flex-shrink: 0` on that fieldset in the existing mobile override in `app/globals.css`. The adjacent description wraps within the remaining space. No clipping, scrollbar suppression, numerical/persistence change or new graphics flag was added.

| Measured at innerWidth 390 | Before | After |
| --- | ---: | ---: |
| Root clientWidth / scrollWidth | 375 / 390 | 375 / 375 |
| Preset fieldset width | 179 | 212.42 |
| Adjacent description width | 140 | 106.58 |
| Canvas / scene container width | 375 / 375 | 375 / 375 |
| Enumerated overflowing elements | 2 | 0 |

All three after samples, through 7.37s, retained exact root equality. The after screenshot was visually inspected. Existing ccf Chromium configuration/diagnostic, comparison selectors, finite exported temperatures, rendered/fallback coverage and exact overflow assertions are unchanged.

## Focused checks and remaining blocker

`tests/browser/mobile-layout.spec.ts` adds two cases per browser: legacy presets and V2 scene/inspector layout. They exercise 375/390/430px widths and post-initialization resizing, require actual canvases/draw calls or explicit fallback markers, and retain keyboard interactions and exact root equality. The inventory is now **90 cases**, including all earlier 84.

Local typecheck, lint and diff checks passed. The complete formerly failing Chromium journey passed in **14.681s** (test: 13.6s), reaching controls, inspection, inside/exit, explicit fallback and portrait presentation assertions. The affected Chromium batch passed **12/13 in 202.583s**, including every previously failing case and both comparison modes. There were zero skips, retries or flaky classifications.

The failing new case is **V2 mobile scene and inspector retain layout across rendered and fallback resizes**, at `tests/browser/mobile-layout.spec.ts:95` via `tests/browser/layout.ts:13`. Rendered checks and inspection passed; navigating to fallback then exposes a saved-checkpoint recovery notice. Its buttons sit in `.twin-notice`, a non-wrapping flex row with `flex:none` buttons, in unchanged `src/ui/twin.css`. At innerWidth 375, root clientWidth was 360 and scrollWidth was 651. The final recovery button reached x=650.70, and the mismatch persisted across another 60 frames. The original and observational-reproduction traces, screenshots and geometry are retained. A fresh fallback page without the notice measured 360/360 in three samples. The legacy preset selector does not match this V2 notice.

This is a separate demonstrated layout constraint, not evidence of a solver or persistence-contract defect. The recovery notice and its buttons were neither dismissed nor removed to obtain a pass. Further V2 fallback resize/operation assertions after the failed width check did not execute. A separate scoped repair of the recovery notice's responsive layout is needed before complete acceptance; changing recovery semantics is unnecessary for the demonstrated sizing issue.

Focused Firefox/WebKit mobile checks passed **8/10 in 58.223s**, four of five per browser, with no skips, retries or flaky classifications. Both passed the complete legacy journey, new legacy resize/preset regression, existing V2 touch journey and existing fresh-fallback journey. Both failed the new saved-checkpoint V2 case at the same line: `clientWidth=375`, `scrollWidth=635`. The focused reviewer found no actionable issue in the preset repair and new test source; that static review preceded the new failure and does not waive it.

The smallest remaining reproduction in the recorded environment is:

```sh
xvfb-run -a -s '-screen 0 1920x1200x24' npm run test:browser -- --project=chromium tests/browser/mobile-layout.spec.ts --grep 'V2 mobile scene and inspector retain layout across rendered and fallback resizes'
```

## Evidence, limits and preservation

Raw evidence is preserved under `artifacts/phase-1/bounded-repair-bdff/linux/mobile-layout/`: `before-test-results.json`, `before-geometry-2/`, `after-geometry/`, `after-journey-results.json`, `affected-chromium-results.json`, `v2-failure-capture/`, `v2-failure-geometry.json`, and `cross-browser-mobile-results.json`. Logs share those prefixes. The first geometry helper used the wrong legacy draw-call field and failed before capturing geometry; its original log remains. Correcting this diagnostic setup did not change the application or consume another fix candidate.

`artifacts/phase-1/mobile-layout/closure-evidence.json` records file hashes, exact test results and timings; `review.json` retains the single focused review. Recordings remain local and excluded from Git. The historical handoff and bounded-repair record are unchanged.

Environment: preserved Playwright 1.63 Ubuntu 24.04 container, Linux ARM64, Node 24.20.0, Chromium 153.0.8010.12, Mesa 25.2.8, Xvfb 1920×1200×24, four CPUs, 6GiB memory and 1GiB shared memory. This differs from hosted x86_64. Hosted validation remains required before merge readiness.

Usage: **one fix candidate, zero complete local acceptance runs, zero pushes**. Current-checkpoint clean installation/build, all units with both telemetry flags, all 90 browser cases, measurements and full source/protected-file gates were not executed. No source-only publication audit or new CI trigger was needed for this blocked checkpoint. Existing evidence is not substituted for those gates.

The task-owned container `neptune-phase1-bounded-bdff` is stopped with its filesystem and evidence preserved. Unrelated containers and Docker Desktop remain untouched. Unknown `.github/workflows/phase-1 2.yml` and `playwright.config 2.ts` remain untouched and untracked.

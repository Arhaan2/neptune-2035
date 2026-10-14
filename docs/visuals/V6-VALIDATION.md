# Visual V6 validation and V7 handoff protocol

**Simulated, design-stage prototype; physical validation pending.** V6 validates the accepted V1–V5 product. It does not promote Pages, merge a PR, change engineering inputs or certify hardware. Final results and candidate identities live outside the frozen source tree; this document declares the method, not a pass.

## Source and evidence

Start from current remote main, reconciling concurrent work. The initial V6 baseline was `11448dfe6b9d096807a4b2736e5d48140e7eb311` (PR #26). The existing local checkout was stale and shared Git metadata with a separate parent checkout; V6 therefore uses a persistent standalone clone and branch `codex/neptune-visual-v6-validation`, preserving both unrelated untracked local files. Only the V6 clone is edited. Evidence is a persistent sibling directory, outside source, public assets and build output. Append commands, exit codes, UTC timestamps and failures; do not overwrite attempts.

Freeze source commit/tree, lock SHA-256, Node/npm/Playwright versions and build configuration. CI builds once and every browser group verifies that artifact's archive, source/tree/lock, manifest and exact inventory. Download that artifact and verify **every served file** at `/neptune-2035/` before final native work. Manifest and release metadata are separate hashes. If earlier native work used an equivalent payload, compare every compiled/static byte, dependencies and relevant inputs explicitly. A documentation/test-only source change does not turn prior execution into a fresh run.

## Finite coverage matrix

| Requirement | Retained evidence / focused extension |
| --- | --- |
| Default campus, two modules, surface selection, pump/exchanger/CDU, X-ray/Explode/interior/cameras | VIS1 default views; VIS2/3 authored surface/second-module purity; VIS4 eight-view composition; native desktop journey and reviewed stills |
| Start/pause/step, fault/restore, separate clocks and historical boundaries | PH3/4 operation; PH7 C2; VIS4 history/unavailable boundary; VIS5 unavailable-history caption rejection; native journey |
| Real campaigns, explicit result load, pause/resume/restart/exit | PH6 and VIS5 retained tests; VIS6 complete **app-owned** automatic endings for transfer, nominal, no-benefit-bus and no-benefit-source |
| Checkpoint, form draft, saved scenarios, campaign and SSE continuity | VIS4 owners/drafts/progress; all three conditional real telemetry integrations under both telemetry flags; native soak uses compatible generated SSE after explicit result load |
| Delayed/missing/corrupt/unsupported assets and supersession | VIS2 delayed/missing/corrupt pump and physical replacement; VIS3 independent exchanger/CDU fallback; VIS4 delayed/failed CDU reflow; VIS5 source/history supersession |
| Graphics lifecycle | VIS1/2 resource and actual supported context-loss tests; VIS6 restores an **active walkthrough**, advancing frames and authored interaction; native loss is injected separately from soak |
| Normal-motion interior entry | VIS6 two-module entry, real Rack aisle/Cooling bay waypoints, horizontal settled pose, WASD and exit; reproduced V5 defect and scoped interior camera-ownership repair |
| Responsive, keyboard, Escape, reduced motion, 320 CSS px and 200% text | VIS3/4/5 retained tests; native desktop and 390×844; visual review also 768×1024 and 844×390 |
| Scale and numerical/history | Existing prototype/PH8, numerical and historical checks; only named Chromium/WebKit `public prototype large-campus functional Step 10s` exclusions; Firefox stays active |
| Hidden tab and explicit resume | Retained native visibility helper, installed Chrome variant; Safari real tab/manual-assisted observation when access permits; no synthetic visibility |

The release list is `scripts/phase-7/gate.mjs`, extended by Phase 8, and `.github/workflows/phase-1.yml`. Reconcile `(project, file, title)` identities, not totals alone. No new skips or automatic retries. CI retains 30-minute browser jobs, 15-minute execution steps, one worker and the named VIS4 120-second eight-composition allowance with 12-second actions. VIS6 full automatic endings have a declared 180-second aggregate (150-second complete-playback observation); active context recovery has 90 seconds. Native actions remain bounded at 12 seconds. The native soak has its own 30-minute aggregate allowance, never a 60-second test allowance. Its twenty cycles include completed-frame and settled-camera barriers for both modules, Explode, focus and chapters; the diagnostic cycle measured roughly 44 seconds before the final chapter/restart barriers, so the aggregate includes room for all twenty complete cycles plus warmup. Individual actions remain bounded at 12 seconds, and the measured soak still must span at least ten minutes.

## Native device protocol (declared before performance judgment)

Separate bundled Chromium/Firefox/WebKit from installed visible Chrome (`channel: 'chrome'`, headed) and actual Safari (`safaridriver`). Use disposable automation contexts, never personal profiles/storage. Record chip, RAM, macOS/browser versions, CSS viewport, actual DPR, drawing-buffer/CSS render scale, power mode, foreground/focus, normal motion, refresh configuration when observable and instrumentation. Omit serials/accounts. Settings and permission changes remain user controlled.

An admissible native session must report `document.visibilityState === 'visible'`, advancing **completed** scene `renderEpoch`, an inspected visible 3D image and successful real input. A context alone or responsive HTML does not qualify. Stop a hidden/zero-frame route and retain diagnostics. If Safari is genuinely visible but broken, compare unchanged accepted V5 under identical conditions before attributing an app regression. No forced visibility, graphics-security changes or speculative renderer workaround.

Controlled profile: 1440×900 CSS pixels, normal motion, render DPR capped by the existing application at 1.5. Use observed native screen DPR for the automation context and record both it and actual canvas scale. Separately test ordinary browser window size. Window resizing is responsive desktop evidence, not iPhone/iPad hardware testing.

For **each native browser**:

1. Three fresh isolated contexts: navigation → first completed scene → ordinary Cooling close-up click → newer authored-ready publication. Within each context, one explicit warm reload followed by reveal. Fresh contexts are not hardware-cold starts. Retain navigation/resource entries, raw model lengths, encoded body and transferred bytes separately; absent timing fields are null/unavailable, never inferred zero. Ordinary startup requests no GLBs; first reveal remains ≤6 MiB including lazy visual code. Observe readiness separately from settled camera and GPU completion.
2. Three ≥60-second foreground paths, no recording or continuous screenshots: default campus moving orbit (15s), default authored cooling moving orbit (15s), real Compare campaign setup and explicit transfer-result load, then complete app-owned autoplay. Label default and evaluated designs, units, selected IDs, run/source identity, current/displayed/presentation clocks. Keep all transition/loading and hold samples. Sampling starts before the path; polling never advances playback.
3. Retain raw rAF intervals and completed-render epochs. Report median/p95/p99/max/sample count, equivalent median fps and stalls >50/>100/>250/>1000ms, whole path and separate moving/reading/transition segments. Apply **median ≥55 fps and p95 ≤25ms** to each declared steady moving section; report overall and transition stalls without trimming. rAF/completed publication cadence is not proof of physical presentation or GPU completion. Diagnose visibility/timing artifacts; no silent 30fps exception.
4. Twenty recorded integrated cycles and ≥600 seconds of normal-motion interactive soak. Cycles may overlap the soak only with their full ordered action records/count retained. Include two compatible modules, detail reveal, docks, focus, Play/Pause/Resume, manual chapters, Restart and Exit. Return to the same loaded design, campus pose, selection and paused time. Connect a real generated SSE publisher for a documented subset only **after** physical result loading, retaining sequence/source/reset history. Intentional context loss/missing assets run separately.
5. At equivalent warmed checkpoints compare observed canvas, worker and transport owners, renderer geometry/texture inventory, cache/material/mounted-instance counts, requests, saved scenarios and available heap. Derive the baseline from the actual design; do not hardcode V5's 77/2. No forced GC/reloads/global cache flushes. GPU/native memory remains unavailable without telemetry. Compare early/late equivalent moving sections; do not label degradation thermal without evidence.

Performance and visual recording use separate runs. Visuals include campus, authored bay/CDU, inspector open/closed, exploded composition, Operate history, completed Compare, playing/paused/final presentation and compact/expanded mobile with legend. Fix fixture/time/pose/motion per browser; no cross-browser pixel-equality claim or masks over correctness. Review composition, state/failure differentiation, caption agreement, wrapping, controls, keyboard/focus/Escape, touch targets, text enlargement and reflow directly. Agent review and human signoff are distinct.

## Demonstrated repair

Visible installed Chrome on unchanged V5 entered a normal-motion module interior but stayed in transition beyond 12 seconds while completed frames continued. The focused bundled-Chromium regression reproduced it. An interior waypoint looks horizontally four meters ahead; the explicit exterior `OrbitControls.update()` call clamps that pose to `maxPolarAngle = π × 0.495`, even with controls disabled. Its approximately 0.0628 m vertical displacement exceeds the unchanged 0.015 m completion threshold, so convergence is impossible. Interior immediate positioning and ordinary transitions now orient the camera with `lookAt`; exterior orbit constraints and updates remain unchanged. No solver, physical model, equipment, schema, asset or numerical expectation is changed. The external attempt ledger distinguishes this app defect from the new measurement runner's earlier five-second assertion-default mistake and test's unconditional Resume mistake.

## Execution and disposition

Use the existing [Phase 8 commands](../phase-8/RELEASE.md) for clean install/typecheck/lint/units with both real SSE flags, build/package, numerical/history and complete browser acceptance. Preserve failed attempts and make only evidence-backed corrections. Authoring hashes, solver, schemas, topology, equipment counts and historical outputs remain invariant.

With the exact downloaded core artifact unpacked into `dist/`, run the existing preview on port 4173 and these commands from the frozen checkout. Each output directory must be new and outside source. Execute browser/measurement commands serially. The native configuration's DPR 2 is the observed M4 display DPR; the runtime still caps rendering at 1.5.

```sh
npm run start -- --port 4173 --strictPort --base=/neptune-2035/
node scripts/visual-v6/verify-artifact.mjs --directory=/absolute/candidate/dist --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/served-verification --archive=/absolute/tested-build.tar --archive-sha256=EXPECTED_SHA256
node scripts/visual-v6/native-chrome.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/chrome-startup --mode=startup
node scripts/visual-v6/native-chrome.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/chrome-frames --mode=frames
node scripts/visual-v6/native-chrome.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/chrome-soak --mode=soak
node scripts/visual-v6/native-chrome.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/chrome-visuals --mode=capture
NEPTUNE_BASE_URL=http://127.0.0.1:4173/neptune-2035/ npx playwright test --config=scripts/visual-v6/native.config.ts tests/browser/visual-v1.spec.ts tests/browser/visual-v2.spec.ts tests/browser/visual-v3.spec.ts tests/browser/visual-v3-clarity.spec.ts tests/browser/visual-v4.spec.ts tests/browser/visual-v5.spec.ts tests/browser/visual-v6.spec.ts --workers=1 --retries=0
NEPTUNE_BROWSER_CHANNEL=chrome node scripts/visual-v5/visibility.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/chrome-visibility
NEPTUNE_BROWSER_CHANNEL=chrome node scripts/visual-v5/record.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/chrome-walkthrough
node scripts/visual-v5/verify.mjs --recording=/absolute/evidence/chrome-walkthrough --out=/absolute/evidence/decoded-video
node scripts/visual-v6/reconcile.mjs --discovery=/absolute/discovered.json --reports=/absolute/downloaded-browser-reports --out=/absolute/evidence/test-reconciliation.json
```

Safari continuation starts with the user enabling **Safari → Settings → Developer → Allow remote automation**, if disabled. The agent does not change that setting. Run `/usr/bin/safaridriver --port 4446`, then `node scripts/visual-v6/safari-probe.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/evidence/safari-access`. A successful probe only establishes access; inspect its actual images and then execute the same complete device protocol above via a visible Safari WebDriver/manual-assisted session. Chrome helpers are not Safari substitutes. A hidden/zero-frame probe stops without force-rendering; retain its receipt and arrange a genuinely visible authorized session before collecting timings. Mark every missing startup/path/soak/visual requirement pending individually.

The soak holds one loaded result and its compatible SSE mapping throughout repeated navigation; it exits once at the end and compares the canonical exported checkpoint. Repeated **explicit result loads** intentionally save prior projects, so they are separate from the Restart no-duplicate-save contract. A warmup cycle precedes the twenty counted cycles and ten-minute interval. Read-only visibility events, completed epochs, application replay counts, transport sequences, reset boundaries and owner identity distinguish actual continuity from merely receiving network messages.

V6 tools under `scripts/visual-v6/` retain JSON/JSONL, images and raw video externally. Final external index binds all inputs and outputs with SHA-256 and includes CI/PR/artifact URLs, full tests versus reused evidence, issue dispositions and a directly readable report/contact sheet. Never relabel prior V5 runs as V6. Never publish native-private observations or credentials. CI artifacts expire; disclose retention with download links.

- **READY FOR V7** requires all mandatory automated and visible native checks, reviewed visuals and agreed performance/lifecycle targets, with no unresolved blocker.
- **DEVICE VALIDATION PENDING** means independent work is complete but named native permission/session/measurements are unavailable; provide exact continuation commands/checklist.
- **BLOCKED BY REPRODUCED DEFECT** identifies failure, evidence, attempted correction and remaining work while preserving the coherent branch.

V7 rechecks concurrent main and required approvals, merges normally, promotes the exact accepted core artifact using the existing release procedure, preserves latest Pages/preview content and runs hosted acceptance. **Do not execute these promotion commands in V6.** Production remains the accepted V5 release (historical tag `visual-v5-2026-09-30`, deployment recorded October 14, 2026 UTC); tag spelling is not deployment date.

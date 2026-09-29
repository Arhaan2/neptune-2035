# Visual V3 — Authored CDU and cooling-bay clarity

**Simulated, design-stage prototype; physical validation pending.** Visual V3 adds one original closed CDU exterior to the shipped V2 pump/exchanger kit and improves the ordinary **Cooling close-up**. It is not historical engineering Phase 3, a new cooling architecture, physical validation, or completion of the equipment library. Final test, compiled-payload, promotion and hosted identities belong in the separately published release receipt; this implementation document is not itself release approval.

## Authored cabinet and authoritative interfaces

The supported installation is exactly `cdu-reference@1.0.0`, asset type/role `cdu`, envelope **1.2 × 2 × 1.1 m**. The current catalog and generated assets own the dimensions and four interfaces: `technical-in`, `technical-out`, `power-in`, `power-out`. The logical route endpoints remain the canonical asset center. Cosmetic connection faces remain inside the envelope and do not claim measured physical port locations. There is no seawater CDU connection, extra simulated pump/exchanger, thermal stage, sensor, fan or new power load.

The original Blender geometry has pearl closed panels, separate door/side seams, softened edges, a graphite plinth and inset, brushed handles/hinges and restrained fasteners. It has no display readings, health lamps, certification, branding, internal machinery, textures or outside artwork. Paint uses the existing projected state; cyan selection edges remain separate. The unchanged Blue Hour environment and other material roles supply the lighting and finish.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `visuals/v3/cdu.glb` | 296,508 | `f5274b9846026b674773bc2f8170b7175aeee202fbbcb9dd34bf38ebff9ee110` |
| Retained `visuals/v2/pump.glb` | 325,180 | `349db03c6513239aac075c85942ae8a79f90827f40c96b52fdcd593b992eaf75` |
| Retained `visuals/v2/exchanger.glb` | 559,236 | `b18e9ad1d69d2b588e34e9eb06d728a891449d61959d8150b41a47631424c559` |

The CDU contains **5,956 triangles, 10,664 vertices, four merged mesh/material groups, zero textures**. All three GLBs total **1,180,924 bytes** before HTTP overhead. The V2 GLBs, descriptor and manifest stay byte-identical at their original URLs. The additive `descriptor-v3.json` and `visuals/v3/manifest.json` describe only the new CDU; runtime composition uses the two historical V2 entries and one explicit V3 entry.

## Executed regeneration and validation

Blender **4.3.2**, build `32f5fdce0a0a`; exporter **Khronos glTF Blender I/O v4.3.47**. From the repository root with the pinned npm dependencies:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/visuals/blender/author.py -- --descriptor scripts/visuals/blender/descriptor-v3.json --output /private/tmp/neptune-v3-cdu-run-1/output --source-dir /private/tmp/neptune-v3-cdu-run-1/source
node scripts/visuals/blender/validate.mjs /private/tmp/neptune-v3-cdu-run-1/source /private/tmp/neptune-v3-cdu-run-1/output scripts/visuals/blender/descriptor-v3.json
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/visuals/blender/author.py -- --descriptor scripts/visuals/blender/descriptor-v3.json --output /private/tmp/neptune-v3-cdu-run-2/output --source-dir /private/tmp/neptune-v3-cdu-run-2/source
node scripts/visuals/blender/validate.mjs /private/tmp/neptune-v3-cdu-run-2/source /private/tmp/neptune-v3-cdu-run-2/output scripts/visuals/blender/descriptor-v3.json
cmp /private/tmp/neptune-v3-cdu-run-1/output/cdu.glb /private/tmp/neptune-v3-cdu-run-2/output/cdu.glb
cmp /private/tmp/neptune-v3-cdu-run-1/output/manifest.json /private/tmp/neptune-v3-cdu-run-2/output/manifest.json
npx vitest run tests/visuals/cdu-contract.test.ts tests/visuals/kit-contract.test.ts tests/visuals/kit-cache.test.ts
```

See the [authoring README](../../scripts/visuals/blender/README.md) for exact argument spelling and retained authoring failures. The tested path recreates editable `.blend` files and the asymmetric one-meter orientation guide outside `public/`; neither enters the runtime payload. Both independent GLB and manifest comparisons passed. `.blend` metadata is not claimed byte-identical.

Both exports pass the pinned `gltf-validator@2.0.0-dev.3.10` with zero errors, warnings and informational messages, and the actual Three `GLTFLoader`. Checks retain **0.00001 m coordinate** and **0.001 normal-length** tolerances: finite attributes, unit normals, canonical-center root with unit scale, bounds, exactly-once axis conversion, material roles and transformed center anchors. Contract tests compare current catalog/generated assets and reject changed specification/version, role, dimensions, interfaces and graph endpoints. Runtime verifies byte length and SHA-256 before its established parsing/validation path. No dependency pin or historical validator admission expands.

## Integration, ownership and clarity

The existing per-scene cache has exactly three supported kinds: pump, exchanger and CDU. Each kind owns one immutable content identity. Geometry is shared; every mounted instance owns private state materials. Disposal waits for scene owners and mounted instances; StrictMode replay, cancellation and late parsed results retain their existing ownership rules. A failed template leaves only its affected equipment procedural and interactive while other templates remain authored. Unknown/changed/custom installations also remain procedural; no near-match stretching occurs.

Initial campus interaction makes zero model requests. Detail loads through base-path-safe local URLs only when the existing view requires it. During a pending load the procedural silhouette remains interactive. Ready detail replaces that silhouette without a duplicate envelope; CDU is excluded from the unrelated bay-equipment fade. Decorative children select their canonical parent. Current/history state and one `presentedPosition` exploded transform remain authoritative. Canonical design, engineering identity, model/schema/solver versions, routes, inventory and exports do not depend on decorative children.

Cooling close-up fits the real pump/exchanger/CDU bounds to the available canvas; selecting a single equipment item gives a tighter view of its own bounds. Identity and projected state have one clear caption above the machinery. The circuit legend and scale information occupy a collapsible surface outside the canvas; controls remain reachable with pointer and keyboard. The 390 px layout wraps readable text and retains the model, controls, simulation/history context and concept qualifier. Technical coolant and seawater retain their supported routes, text and symbols without new flow animation. Manual camera takeover, interior exit, reset, reduced motion, history and Compare retain their existing owners and behavior.

## Actual-app implementation views

The [cooling bay](images/v3-cooling-reveal.png), [CDU close-up](images/v3-cdu-close-up.png) and [390 px open legend](images/v3-mobile-legend.png) are actual application captures from focused development verification, paused at time zero with the default design. They are implementation references, separate from final CI-payload and hosted media in the release receipt. The surrounding app shell is captured as a region without rescaling or retouching.

## Declared budgets and acceptance evidence

Budgets were recorded before candidate judging: CDU ≤12,000 triangles and ≤1 MiB; all first-reveal assets ≤6 MiB; full reveal ≤250 draw calls and ≤500,000 submitted triangles. At 1440×900 CSS and DPR ≤1.5, each of three normal-motion 30-second paths must achieve median ≥55 fps and p95 frame interval ≤25 ms. Twenty view/module cycles and a ten-minute interactive soak compare exactly equal, fully warmed post-render inventories at the same returned-campus identity.

The expected cache increment is four geometries/four source materials, making twelve cached geometries/source materials and zero kit textures. Five active authored instances own twenty private materials. V2's warmed campus inventory was 73 geometries/two environment textures; the initial actual-browser integration check confirmed 77/two at the same completed returned-campus pose. Exact no-growth comparison remains part of final acceptance. A CDU draw replaces a 108-triangle procedural cabinet with four groups/5,956 triangles: a visibility-equivalent increment of three draws and 5,848 triangles. Camera/canvas changes can also change frustum-visible work. Actual final counts and deltas are recorded in the release receipt.

```sh
NEPTUNE_VISUAL_MODE=capture NEPTUNE_VISUAL_OUT=/absolute/evidence/capture node scripts/visuals/v3-measure.mjs
NEPTUNE_VISUAL_MODE=measure NEPTUNE_VISUAL_OUT=/absolute/evidence/measure node scripts/visuals/v3-measure.mjs
NEPTUNE_VISUAL_MODE=soak NEPTUNE_VISUAL_OUT=/absolute/evidence/soak node scripts/visuals/v3-measure.mjs
```

The V3 helper retains raw frame intervals, machine/browser/viewport/DPR/motion context, actual click-to-rendered-ready timings, separate GLB and JavaScript transfer entries, exact resource cycles, app PNGs and an actual interaction clip outside Git. JS heap and renderer allocation counters are not total GPU/native memory; unavailable native allocation stays unavailable. Local bundled-browser, branded browser, CI and hosted evidence are separately identified. Captures include the unchanged V2 reference, matched V2/V3 bay, CDU, campus, mobile legend open/closed, selected/failed equipment, second module and missing-CDU fallback. Any camera-only comparison alignment must retain its exact patch and unaligned reference; it is not an unmodified historical camera view.

The normal CI and local/hosted browser lists retain V1/V2 and add `visual-v3.spec.ts` and `visual-v3-clarity.spec.ts`. The only permitted exclusions remain the original named Chromium/WebKit large-campus Step 10s cases; Firefox stays active. V2 resource tracing retains its API trace, sources, attachments and failure screenshot without per-action DOM/filmstrip overhead. Full units with both telemetry integrations, numerical checks, original historical campaigns and corrected regressions remain required, as do clean install, typecheck, lint, build, immutable-candidate review and exact CI-payload promotion under the [existing release procedure](../phase-8/RELEASE.md).

The first complete local attempt retained one PH2 Chromium export timeout: ten downloads arrived within 847 ms and the next export produced no download event. An isolated control in the same bundled Chromium 153.0.8010.12 reproduced ten accepted downloads out of eleven rapid Blob-anchor requests with active user activation; the next download succeeded after the native interval. A separate 125 ms cadence accepted all eleven. Untouched PH2 passed in one diagnostic run each against preserved V2 and V3, confirming a timing-sensitive automation burst rather than a deterministic V3 export failure. The PH2 test helper now spaces completed exports by at least 125 ms (at most eight per second), retaining every actual download, functional assertion, original 180-second deadline and zero retries. Production export code and browser settings are unchanged. Failed traces, control requests/events, Chromium source corroboration and subsequent complete acceptance remain separate release evidence.

## Native Safari and next boundary

Native Safari is investigated separately from Playwright WebKit. The available Safari 26.6.2 / macOS 26.6.2 background capture route reproduced V2's blank canvas. Isolated diagnostics observed a valid, non-lost WebGL2 context with no reported GL error, but `document.visibilityState="hidden"`, zero animation-frame advancement and no completed scene diagnostics. Raising the available window did not change those observations. This is a concrete route limitation, not a proof of visible native rendering or an exclusive capture diagnosis. The V3 implementation candidate showed the same blank capture, hidden document and zero animation frames through the identical route. Final observations and unavailable diagnostics are retained in the release receipt. No browser/OS security setting or drawing-buffer setting is changed for this investigation (the baseline already requests drawing-buffer preservation).

The next bounded follow-up is native Safari rendering evidence in an authorized **visible** session, comparing the preserved V2 and V3 payloads and a small isolated WebGL control if needed. Until that succeeds, native Safari 3D and performance remain unverified. The broader authored library, manufacturer detail and physical validation remain unfinished.

# Asset-linked scene — v2 candidate

`src/scene/TwinScene.tsx` is independent of the preserved v0.1 `Scene.tsx`, `Facility.tsx` and `layout.ts`. The v2 renderer consumes `Design`, `SimulationState`, `moduleAssets`, `resolveAsset` and `connectionsForModule`; it does not calculate equipment demand, temperature, flow or inventory counts.

## Physical scope and rendering

- One world unit is one meter. Every box uses its asset's global `positionM` and `[width, height, depth]` `dimensionsM` with no generation-dependent scale multiplier.
- Every platform, pontoon and module is placed. There is no 25-platform cap. Distant modules use instanced envelope meshes, not a representative count.
- The selected module expands to its exact racks, occupied compute units and support inventory. Individual rack/node IDs map directly to instanced-mesh hit IDs. Partial last racks show only the actually installed nodes; the unoccupied enclosure space remains visible.
- Module faces use an illustrative 80 mm wall/floor thickness inside the declared 24 × 4 × 10 m envelope. Instanced panel ribs, louver stripes and corner frames stay within these envelopes and the declared structural allowance; they do not add inventory or mass. Pump silhouettes fit their declared envelopes. Selected rack and equipment geometry are component envelopes rather than vendor manufacturing geometry.
- A persistent caption declares the current detail scope. Other modules remain exact-size envelopes; their racks are not instantiated until that module is inspected. The canonical technical header route is rendered with its declared pipe diameter. Selected module pipe/cable trunk routes and selected rack branches are shown. Network/power edges and the two distinct fluid media use separate colors. Tiny node-level cable branches are hidden by this rendering LOD.
- The sunset sky/ocean shaders preserve the v0.1 visual treatment without modifying the legacy files. The sea shader is decorative, not a seakeeping calculation. Its mean surface is canonical y = 0; canonical platform translations are owned by the design model hydrostatic screen. Small surface ripples do not represent wave loading, stability or storm behavior.

## Identity, state and cameras

Selecting an instanced shape returns its exact model ID. Asset, dimensions and selection outlines share that same identity. Failed equipment stays red even when selected; a separate pale outline indicates selection. State colors read solver equipment states. Stationary arrows appear on enabled fluid edges only when that module has positive solved flow and the endpoint pump is actually running. Failed, isolated, maintenance, starting and standby pumps cannot receive active flow arrows merely because the other branch supplies the module. Arrows show graph direction and do not imply a particle-speed/flow-scale measurement.

Campus, platform, module, rack, selected asset, top/footprint and cooling camera targets use canonical assets. Cooling frames the selected module exchanger and pump bay. Contexts cache exterior poses for returns; manual interaction cancels an in-progress transition. Canvas keyboard controls support arrow-key orbit and +/- zoom.

Interior uses the selected module's same meshes and dimensions. Eye height is 1.65 m above its floor. WASD moves, pointer drag looks, arrows turn, and Escape exits. Entrance, rack-aisle and cooling-bay waypoints provide pointer/touch alternatives. The unobstructed central aisle is bounded to z ±1.3 m, maintaining at least 0.4 m from rack inner faces. X is clamped before the support-equipment bay and within the entry end of the module. This is simple geometric collision screening, not free roaming or accessibility/code certification. Returning outside restores the prior exterior camera. Exploded offsets are suspended during interior navigation so camera and geometry remain in the canonical room.

X-ray changes materials only. Explode returns copied presentation offsets; it cannot mutate assets or engineering routes. Rendered connector endpoints interpolate the corresponding assembly offsets. The canonical route length and separately recorded fittings allowance remain unchanged.

## Fallback and accessibility

`?fallback=1`, unavailable WebGL2, renderer initialization errors and lost contexts show an interactive SVG footprint. Exact module/rack/support rectangles retain asset IDs, labels, keyboard focus, Enter/Space activation and selected equipment state colors. The surrounding app remains responsible for graph, operations and results; they do not depend on WebGL. An active interior request has an explicit exit in fallback mode.

## Export and inspection

`geometryGLTF(design)` exports dimensioned visual envelope meshes with design revision, SI units, exact asset IDs, parent IDs, catalogue references and canonical dimensions/positions in glTF metadata. For bounded designs up to 30,000 meshes it creates all platform/module/rack/node/support assets; larger designs return an explicit limit error before allocating export geometry. It includes the canonical technical header segments but does not export the decorative water, presentation transforms or fabrication-ready routed fittings. It is not CAD, STEP, IFC or BIM support.

`window.__NEPTUNE_TWIN_SCENE__` is a read-only diagnostic snapshot separate from the legacy diagnostic. It includes camera/target, draw calls, geometry/texture counts, exact rendered/total module counts, detail module/rack/node counts, selected ID, view flags and simulated time. It updates at most four times per second and is cleared on unmount.

## Verification performed by the scene worker

- `npm run typecheck`: passed after the scene integration contract was written.
- `npm test -- tests/twin-geometry.test.ts`: 7 tests passed. They exercise exact inventory and partial occupancy, physical bounds above the former 25-platform cap, hydrostatic floor/deck alignment, presentation purity, aisle clearance, source-to-module path tracing and selection identity.
- Scene-specific lint findings were resolved. Whole-repository lint initially had other concurrent files failing; the lead owns final combined checks.
- Actual integrated-app browser audit at `http://127.0.0.1:5173/` on 2026-09-08: headless Chromium with `--use-angle=metal`, 1600 × 1050 desktop and 390 × 844 mobile viewports, reduced motion. Operated cooling close-up, dimensions, selected pump trip, 10 s numerical advance, interior entry/WASD/Escape, exterior restoration, explode/assemble, restoration, fallback interior exit and comparison. No page errors; mobile document width was exactly 390 px. The restored exterior pose matched the prior pose to floating-point precision.
- Inspected actual campus, cooling, failed-pump, interior, comparison, mobile and fallback screenshots. Corrected the scene/root caption CSS collision, neighboring-module occlusion of the cooling camera, portrait framing, fallback-exit overlap, and clipped 230 px comparison canvases. Restored the sunset silhouette and envelope details. Evidence: local ignored `assets/screenshots/v2-scene-{campus,cooling,pump-trip,interior,exploded,mobile,fallback,comparison}.png`, `v2-scene-qa.json`, `v2-scene-export-qa.json`. Publishing selected images is a separate deliberate lead action under the repository's existing ignore policy.
- Final default-campus diagnostic: 8 of 8 modules, 2 platforms, selected-module detail of 40 racks / 160 nodes, 57 draw calls, 57 geometries and 1 texture. Interior/dimension views reached 60 geometries in this audit. These are actual-browser resource snapshots, not FPS measurements or claims about other hardware. The independent browser workstream records repeatable default/campus/large timing and renderer measurements.
- glTF round-trip loaded the exported result through `GLTFLoader`: 1,680 of 1,680 asset identities survived; selected pump world bounds were 1.2 × 1.2 × 0.8 m; all 42,688 inspected normals and all position values were finite; maximum unit-normal error was 2.51 × 10⁻⁸. The root retained `units: meters`. This verifies the visual exporter, not manufacturing suitability or empirical physical validation.
- Final `npm run typecheck`, the seven focused geometry tests, and scene-specific `oxlint` passed. The lead owns final repository-wide checks and hosted-candidate evidence.

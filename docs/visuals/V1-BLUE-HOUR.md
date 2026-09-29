# Visual V1 — Blue Hour

**Simulated, design-stage prototype; physical validation pending.** This release changes presentation in the existing Explore / Operate / Compare application. Solver, schemas, installed specifications, canonical IDs/dimensions, inventory, routes and persistence remain authoritative and unchanged. V1 is enabled at the ordinary production entry point.

## Implemented direction

Pearl painted shells sit on graphite marine structure, with brushed silver cooling equipment, darker rack inserts and rougher decks. The environment is cool dusk, with a subdued horizon and restrained normal-shaded ripples. The first camera immediately fits the existing configured campus, and saved camera contexts distinguish canvas sizes; no intro, automatic tour or substitute fixture is loaded. Existing camera takeover, interior return and focus modes remain available. Cooling close-up approaches the bay from the front to keep the selected pumps visible through the reveal.

| Surface | Source / treatment |
| --- | --- |
| Shared UI | `src/ui/visuals/tokens.css`, `src/ui/twin.css`: background `#0B141D`, panel `#142330`, primary `#EDF3F6`, secondary `#B2C1CC`, focus `#83D5E8`, warning `#F0BE72`, failure `#F27B79`. Opaque data surfaces, tabular numbers, visible focus, compact workspace guidance and mobile controls. |
| Scene presets | `src/scene/visuals/materials.ts`: pearl `#E8EEF0`, silver `#AEBBC4`, structure `#273541`, water `#102735`. Paint metalness 0 / roughness .43; metal 1 / .32; deck .05 / .84; distinct cabinets/racks/inserts. These are artistic choices, not measured properties. |
| Environment | `src/scene/visuals/DuskEnvironment.tsx`: procedural local sky and ocean, one 128px PMREM reflection map, hemisphere fill and two directional lights; no shadow maps or postprocessing. ACES tone mapping at exposure 1, linear working color and sRGB output; custom shaders use the same output conversion once. |
| Existing geometry | `src/scene/TwinScene.tsx`: bounded bevels on instanced shells/cabinets, silver seams, per-family batches, per-instance state color, separate cyan selection edges. X-ray/exploded floors and aisles become translucent to expose cooling equipment. Materials are recreated only when crossing opaque/transparent mode so a warmed opaque shader cannot suppress the reveal; the browser suite samples actual roof pixels after that transition. Existing white aisle accent is illustrative, not a measured indicator or new electrical load. |
| Information hierarchy | `src/ui/TwinApp.tsx`, `src/ui/OperatorExperience.tsx`, `src/scene/twinScene.css`: selected identity/state and operating readings, optional workspace help, compact scene overlays, unchanged handlers and mounted owners. Technical coolant and seawater retain separate routes/legend and heat-exchanger boundary. |

Normal primary/secondary text on the opaque panel measures 14.28:1 / 8.68:1; warning 7.84:1, failure 5.31:1, focus 9.63:1. Small scene overlays use 90–96% opaque dark surfaces. This is a targeted contrast review, not a complete accessibility certification.

## Four next-phase reference shots

Captured in the actual application by `scripts/visuals/capture.mjs`, using the unchanged default 10,000-accelerator design, simulation time 0, 1440×900 CSS viewport, DPR 1.5 and reduced motion. The script names any intentional fault views separately. No screenshot is an offline render or proof of physical fidelity.

1. **Campus hero** — `campus.png`: fresh default camera, all 8 configured modules / 2 platforms visible; no design substitution.
2. **Systems reveal** — `systems-reveal.png`: Cooling close-up, X-ray and Explode; selected duty pump, technical/seawater paths, identity and relevant readings.
3. **Platform approach** — `platform-approach.png`: find canonical `platform-001/module-01`, assembled view; envelope seams and supporting structure are the reference for the next detail study.
4. **Interior / inspection** — `interior-inspection.png`: enter the selected module; installed rack occupancy and clear exit remain authoritative.

The [campus](images/campus.png), [reveal](images/systems-reveal.png), [platform approach](images/platform-approach.png), [interior](images/interior-inspection.png) and [mobile](images/mobile.png) images are local implementation reference captures. The external release evidence directory also contains failed pump, power inspection, Compare and fallback captures. Candidate and hosted captures are identified separately in the release receipt.

## Blender / GLB handoff for V2

No Blender or authored GLB asset library was used in V1. Begin V2 with **one compatible pump/exchanger kit and one module reveal**, keeping distant campus geometry procedural.

- One unit = one meter. Runtime is right-handed Y-up. Author in Blender's Z-up space and apply the glTF export axis conversion once; validate a one-meter guide and an asymmetric part in the browser.
- Use the canonical asset center as the root pivot, identity root scale and applied rotation. Runtime `positionM`, `dimensionsM`, specification ID/version and canonical asset ID own placement and selection. Cosmetic children inherit their parent's ID; they never become engineering inventory.
- Supply an explicit supported-specification list, exact local bounds and connection anchors in meters. Stay inside the existing envelope; never stretch an incompatible kit. Ports must agree with existing technical/seawater/power anchors and preserve their distinct circuits.
- Use opaque metallic/roughness materials compatible with MeshStandardMaterial; local normal/roughness detail is allowed. Avoid transmission, baked cross-object shadows and remote textures. Share immutable geometry; clone or isolate mutable state tint. Preserve cutaway and exploded subparts.
- Deliver reproducible authoring source/script, exporter version, file hashes, dimensions/anchor checks and original-author/license provenance. Any outside source needs verified redistribution rights and local packaging.
- Integration must use base-path-safe URLs, explicit ownership/disposal, supported variants and interactive procedural-envelope fallback for missing/corrupt assets. Asset load failure cannot block selection or operation.

## Settings, evidence and limits

DPR is capped at 1.5; the ocean is a two-triangle plane with normal-only ripples and an unchanged y=0 mean waterline. No heave, buoyancy or sensor-measured flow is implied. Water freezes under reduced motion/hidden tabs; hidden scenes stop the render loop. Standard geometry is instanced, only the selected module expands to installed racks/nodes, and all configured module envelopes remain present. No external runtime assets, paid assets or new dependency were introduced.

The available host reports Apple M4 Pro / macOS 26.6.2 / 24 GiB RAM. An implementation-stage Chromium 153.0.8010.12 sample at 1440×900, DPR 1.5 recorded 65 hero draw calls, 7,794 submitted triangles, 65 geometries and 2 textures. A 30.015-second orbit yielded 1,800 frame intervals, median/p95 16.7 ms and maximum 33.4 ms. Final immutable-candidate and hosted observations are recorded separately in the release receipt. V1 measurements use the bundled Playwright Chromium with ANGLE Metal, not a native Safari benchmark; the final receipt records browser version, viewport, pixel ratio, draw/geometry/texture counts and a 30-second keyboard orbit. These bounded observations do not certify the full roadmap's Safari/Chrome, thermal, memory or sustained-use budgets. No full benchmark campaign is claimed.

Validation keeps the existing release gate and telemetry integration, with additional `tests/visuals/materials.test.ts` and `tests/browser/visual-v1.spec.ts`. The only retained browser exclusions are the historically documented Chromium/WebKit instances of `public prototype large-campus functional Step 10s`; Firefox remains active. No new skips, retries or deadlines are added. CI uses the actual `/neptune-2035/` path and tests the same single compiled payload later promoted to Pages. Release packaging labels this as Visual V1, leaving model/solver/schema versions unchanged.

V2 is bounded to the single compatible asset kit and browser proof described above, with bounds/anchor validation, selection/failure isolation, missing-asset fallback, resource disposal and direct comparison with these four shots. Elaborate rack interiors, whole-campus GLBs, new machinery, new simulation, timeline redesign, new presentation state, postprocessing and broad performance claims remain deferred.

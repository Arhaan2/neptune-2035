# Verification record

Date: 2026-09-08. Release identifiers and hosted acceptance are recorded in [RELEASE.md](RELEASE.md) when complete. This file records executed checks; pending work is explicitly marked.

## Environment and commands

macOS 26.6.2 (25G83), arm64, Node 24.18.0, npm 11.16.0. Playwright 1.63.0: Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6. These are automated desktop browsers, not physical mobile devices. Desktop viewport 1600×1050 CSS pixels; mobile layout 390×844; presentation 1280×720 and 800×1000.

```sh
npm run lint
npm test
npm run build
npm run test:browser
```

- Lint: passed.
- Unit tests: 53 passed in two files. Covers deterministic units, whole-node rounding, step boundaries, supported extremes, idle load, peak versus operating demand, PUE monotonicity, heat-flow conservation, thermal/supply warnings, exact layout population, and bounded schema-v1 sharing.
- Build, including TypeScript checking: passed on Vite 8.2.2.
- Dependency audit: zero reported vulnerabilities after removing unused server tooling and applying compatible updates. This is an audit result, not a security guarantee.
- Local browser acceptance: all 15 cases passed in Chromium, Firefox and WebKit. After the portrait spacing correction, all three mobile/fallback/portrait cases passed again, including bounds checks that the entire toolbar sits above the footer. An earlier keyboard assertion read telemetry before the next animation frame; it now waits for the observable camera change.
- Local real-demo recording: passed in Chromium; actual 30-second storyboard captured to WebM.
- Hosted acceptance and MP4 verification: pending deployment.

## What the browser suite observes

Canvas pixel variance and image differences verify visible scene changes. Mouse and keyboard orbit, reset, X-ray, combined/repeated explode and reassembly, cooling/power/network selection, guided interior and exterior camera restoration run against the real WebGL canvas. Resource counts are compared after repeated toggles. These bounds are useful regression checks, not a proof of absence of every possible memory leak.

Preset changes are checked against both canvas changes and model quantities. Tests exercise numeric validation, utilization without capacity loss, warm-water warnings, a shared scenario in a fresh browser context and after refresh, malformed hashes, mobile controls, the working fallback model, reduced-motion rendering, keyboard dialog focus return, and the entire demo including stop, manual cancellation and restart.

The explicit `?fallback=1` path is exercised; the implementation also handles WebGL2 failure/context loss. Physical device GPU failure, exhaustive assistive-technology coverage, and long-duration stress testing are not claimed. Console and page errors are asserted empty in the rendered-mode case. Local performance samples are recorded separately.

## Visual inspection

Actual screenshots are generated under `assets/screenshots/` with browser prefixes: `hero`, `xray`, `cooling`, `exploded`, `power`, `interior`, `mobile`, and `fallback`. Hero framing, X-ray visibility, the separate circuit traces, named exploded groups, rack aisle, and mobile layout were visually inspected. The inspection caught and corrected an interior camera limit that kept the viewpoint outside and an inspector resize that moved the reset frame. Selected final images will be copied into `docs/images/` after hosted acceptance.

The mobile metric rail scrolls below the canvas; the concept qualifier stays at the viewport bottom. Full-page captures include this sticky footer within the document. Rack glyphs, module occupancy and grouped platforms are representative geometry, explicitly disclosed in the app; exact totals remain model-derived.

## Performance scope

The capture harness records 119 `requestAnimationFrame` intervals after warm-up in the default campus X-ray view. It also records the WebGL renderer and Three.js counters. This small local sample is not an ordinary-laptop benchmark, a measured input-latency result, or a deployment performance guarantee. Browser refresh scheduling and automation affect results. Final hosted samples are added after that run.

## Known conceptual limits

No naval loads/stability, mooring design, corrosion/biofouling, environmental permission, fire engineering, construction cost, interconnection study, or workload throughput model. All IT heat is assigned to the exchanger; ancillary facility heat is excluded. Constant PUE, utilization, coolant properties and discharge rise are declared assumptions. Temperature headroom only screens one simplified condition. Stretch features remain deferred.

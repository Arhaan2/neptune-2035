# Verification record

Date: 2026-09-08. Tested source commit: `127a2fade93112d58f8edd9f6fc6e9e02b12b57c`. Deployed artifact commit: `672805a984feadaab375061817c919fd6849b311`. Release identifiers are recorded in [RELEASE.md](RELEASE.md). Later documentation/evidence commits do not change the deployed application.

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
- Hosted acceptance: **15/15 passed**, five cases each in Chromium, Firefox and WebKit, against https://arhaan2.github.io/neptune-2035/. Includes the corrected portrait bounds and canvas resize check. No skipped or flaky cases in the accepted run. The served source manifest matched the tested commit.
- Hosted recording: passed in Chromium. Final MP4 is 30.00 seconds, 1280×720, 25 fps H.264, yuv420p, silent, 10,622,379 bytes. Chromium 153.0.8010.12 loaded it with no media error, advanced playback, and successfully sought to 2, 7, 12, 17, 23 and 28 seconds. Those real decoded frames were inspected, including the live closing URL. FFmpeg decoded the complete MP4 with exit 0 and no error output. Hash and metadata are in `docs/evidence.json`.

## What the browser suite observes

Canvas pixel variance and image differences verify visible scene changes. Mouse and keyboard orbit, reset, X-ray, combined/repeated explode and reassembly, cooling/power/network selection, guided interior and exterior camera restoration run against the real WebGL canvas. Resource counts are compared after repeated toggles. These bounds are useful regression checks, not a proof of absence of every possible memory leak.

Preset changes are checked against both canvas changes and model quantities. Tests exercise numeric validation, utilization without capacity loss, warm-water warnings, a shared scenario in a fresh browser context and after refresh, malformed hashes, mobile controls, the working fallback model, reduced-motion rendering, keyboard dialog focus return, and the entire demo including stop, manual cancellation and restart.

The explicit `?fallback=1` path is exercised; the implementation also handles WebGL2 failure/context loss. Physical device GPU failure, exhaustive assistive-technology coverage, and long-duration stress testing are not claimed. Console and page errors are asserted empty in the rendered-mode case. Local performance samples are recorded separately.

## Visual inspection

Actual screenshots are generated under `assets/screenshots/` with browser prefixes: `hero`, `xray`, `cooling`, `exploded`, `power`, `interior`, `mobile`, and `fallback`. Hero framing, X-ray visibility, the separate circuit traces, named exploded groups, rack aisle, and mobile layout were visually inspected. The inspection caught and corrected an interior camera limit that kept the viewpoint outside and an inspector resize that moved the reset frame. Selected final images are committed in `docs/images/`.

All six final Chromium screenshots in `docs/images/` were captured from the release URL and visually inspected: hero, X-ray, cooling, exploded, interior and mobile. Browser-specific screenshots, portrait, fallback, resource JSON and performance JSON remain under `assets/screenshots/`. Full local/hosted reports are in `artifacts/local-acceptance.json`, `artifacts/local-portrait-acceptance.json` and `artifacts/hosted-acceptance.json`; these machine-local reports are excluded from Git. A sanitized evidence summary is committed in `docs/evidence.json`.

The mobile metric rail scrolls below the canvas; the concept qualifier stays at the viewport bottom. Full-page captures include this sticky footer within the document. Rack glyphs, module occupancy and grouped platforms are representative geometry, explicitly disclosed in the app; exact totals remain model-derived.

## Performance scope

The capture harness records 119 `requestAnimationFrame` intervals after warm-up in the default campus X-ray view. These are the samples from the hosted run, on the local test machine:

| Browser | Median interval | p95 interval | Reported renderer |
| --- | ---: | ---: | --- |
| Chromium | 16.70 ms | 16.70 ms | ANGLE Metal, Apple M4 Pro |
| Firefox | 8.34 ms | 9.16 ms | “Apple M1, or similar” (browser-masked string) |
| WebKit | 17 ms | 28 ms | Apple GPU |

All three reported 37 render calls, 24 geometries and 3 textures in this X-ray sample. The repeated mode sequence retained 24 geometries and 3 textures after warm-up in each browser, with no captured console/page errors. This small sample is not an ordinary-laptop benchmark, a measured input-latency result, or a deployment performance guarantee. Browser refresh scheduling and automation affect results; Firefox's masked renderer string is not a hardware identification.

## Known conceptual limits

No naval loads/stability, mooring design, corrosion/biofouling, environmental permission, fire engineering, construction cost, interconnection study, or workload throughput model. All IT heat is assigned to the exchanger; ancillary facility heat is excluded. Constant PUE, utilization, coolant properties and discharge rise are declared assumptions. Temperature headroom only screens one simplified condition. Stretch features remain deferred.

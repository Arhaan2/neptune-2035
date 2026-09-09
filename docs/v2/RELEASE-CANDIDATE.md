# NEPTUNE v2 release candidate

**Design-stage digital twin · Simulated operation.** Version `2.0.0-rc.1`; creator Arhaan Aggarwal. Physical calibration and operational commissioning remain pending.

## Release status

The candidate is implemented in the isolated `codex/neptune-digital-twin-v2` worktree. Application source: `dcb9effd698bf10bbe0f98eba165213d2b0e5c16`. The compiled payload contains 43 files (3,273,676 bytes); manifest SHA-256: `2f957728135fa8b98b4b55aecc96f8ccebee4e6beadd9a0e29bfa954b0bb3fd1`. Every file hash and the manifest hash were checked after packaging at 2026-09-09 01:26:57 UTC. Identity records are in `evidence/release.json` and `evidence/build-manifest.json`. There is no production promotion.

The user requested integration into the existing repository. The source was fast-forward merged into the existing default `codex/neptune` branch. The separate candidate is live at **https://arhaan2.github.io/neptune-2035/v2-preview/**. Pages deployment `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711` completed successfully at 2026-09-09 01:35:23 UTC, with no build error. All eight pre-existing production files are byte-for-byte unchanged; only the `v2-preview/` prefix was added. The baseline tag remains preserved. Hosted acceptance and integrity checks are recorded below.

## Hosted artifact integrity

The real preview `release.json` reports application source `dcb9effd698bf10bbe0f98eba165213d2b0e5c16` and the expected artifact manifest hash. The manifest hash and **49 publicly served files** were independently fetched and verified: 42 candidate payload files plus all seven publicly served original production files. The two empty `.nojekyll` build markers were verified in Git rather than requested as public assets. The production root manifest still reports `127a2fade93112d58f8edd9f6fc6e9e02b12b57c`. Full details are in `evidence/hosted-integrity.json` and `evidence/production-preservation.json`.

## Delivered capabilities

The same versioned exact asset model supplies meter-scale geometry, typed paths, worker-based power/hydraulic/thermal/network calculations, finite storage, event controls, causal failure/recovery and replay. Explore, Operate and Compare expose equipment identity, operating points, constraints and provenance. Data supports generated/imported/historical and actual optional local SSE streams, source separation, staleness and bounded exchanger-UA calibration with held-out evaluation. Sizing and costs use the declared assumptions and the same evaluated constraints. Projects, results, inventory, engineering reports and bounded glTF can be exported.

Milestone A was preserved at checkpoint `8072ab3`. The integrated B–F checkpoint and final G evidence checkpoint are recorded by the local Git history. G's local verification is distinct from its separate hosted-preview gate. No dependent operational commissioning gate is marked passed.

## Validation performed

- Fresh baseline: 53 unit checks, 15 browser cases across Chromium/Firefox/WebKit, lint and production build passed. See BASELINE.md for the verified source/tag/deployment identities.
- Combined v2/legacy suite with both opt-in telemetry flags: **162/162 tests passed, zero skips**, seven files, 4.01 seconds. This includes actual HTTP/CORS/native reconnect and running data-panel integration, not mock interfaces alone.
- TypeScript, repository lint, diff whitespace checks and Vite production build passed. Dependency versions and npm lockfile resolution remain unchanged; only the package release version/scripts changed.
- Five independent reference fixtures use analytic/rational calculations and RK4 without importing production code. The model cards specify per-quantity accounting/timestep tolerances and their limits.
- Geometry export round trip: 1,680/1,680 IDs; pump bounds 1.2 × 1.2 × 0.8 m; 42,688 finite normals with maximum unit-normal error 2.51e−8.
- Actual campus, cooling, interior, data, comparison, fallback and mobile screenshots were inspected. Touch/Escape restoration was separately checked twice with unchanged numerical results.

The final hosted candidate passed **48/48 browser cases** across Chromium, Firefox and WebKit in 4.8 minutes, with zero failures, skips, flaky cases or runner errors. This run tested the actual public `v2-preview/` URL and final application source listed above, including all 15 legacy compatibility cases. The record is [hosted-browser-48-summary.json](evidence/hosted-browser-48-summary.json); inspected hosted screenshots include [selected-pump fault propagation](images/hosted-pump-trip.png) and [mobile fallback](images/hosted-mobile-fallback.png).

The earlier full compiled-build suite passed **48/48 cases** across Chromium, Firefox and WebKit in 4.7 minutes. After the final causal-log and cinematic-scroll fixes, **33/33 v2 browser cases passed** in 1.4 minutes; the 15 unchanged legacy cases retain their prior compiled-build result. Both runs had zero failed/skipped cases. The corrected cinematic passed actual normal-motion recording at an explicitly selected 5× rate: zero flow at 30s, operating standby by 40s, duty restoration/start at 180s and running by 185s, computed family comparison, and campus/pause at 220s. The full source qualifier stayed visible, both comparison cards fit the viewport, and the full scene returned on completion. Restart from the same completed 220s state and human-wheel cancellation preserved events and numerical state. The original failed scrolling capture is retained locally as failed evidence; only the corrected run is the accepted demonstration. The native WebM remains local under `artifacts/v2/cinematic-actual.webm` in accordance with the repository recording policy. Selected screenshots and compact evidence are committed. Test output and compact machine-readable evidence are retained under `artifacts/v2/` locally and selected summaries under `docs/v2/evidence/`.

## Performance evidence

Available hardware: Apple M4 Pro, 14 logical CPUs, 24 GiB RAM, macOS 26.6.2 arm64. Browser audit used Chromium 153.0.8010.12 with ANGLE Metal, 1600 × 1050 viewport and reduced motion, against the development server. Three samples per case followed warmup; input/result waits were measured separately from renderer diagnostics.

| Accelerators | Exact modules / platforms | 10s worker round trip | Draw calls / geometries / textures |
| ---: | ---: | ---: | ---: |
| 1,280 | 1 / 1 | 28–57 ms | 55 / 55 / 1 |
| 10,000 | 8 / 2 | 30–44 ms | 57 / 57 / 1 |
| 500,000 | 391 / 98 | 578–611 ms | 57 / 57 / 1 |

Twenty camera/X-ray/explode/resize cycles retained 57 geometries and one texture. Post-GC JavaScript heap changed by +1.45 MiB in that bounded observation. RAF callbacks had median cadence 16.7 ms; that is scheduler cadence, not GPU frame time. No page, console or HTTP error was recorded. This does not prove long-duration leak absence or performance on ordinary laptops/physical mobile devices. Source hashes in the performance record identify the measured numerical/scene implementation; final subsequent edits to cinematic controls and report cost display are not silently relabeled as measured performance changes.

Separate Node CPU samples cover 1,280/10,000/100,000/500,000/1,000,000 accelerators. The million case has 782 modules, 196 platforms and 1.5 GW installed whole-server peak; a required-network bottleneck correctly leaves the energized nodes at 450 MW idle IT in this particular declared traffic scenario. A 10 GW supply ceiling is never presented as consumption. Detailed timings and hardware scope are in `evidence/numerical-performance.json`.

## Reproduce and inspect

```sh
npm ci
npm run typecheck
npm run lint
python3 reference/benchmarks.py
npm run evidence:twin
npm run build
npm run dev
# In another terminal, with the app running on 127.0.0.1:5173:
NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1 npm test
npm run test:browser
```

The actual publisher is `npm run telemetry:publisher`; DATA.md specifies mapping and local HTTPS/CORS/authentication limits. It is not a deployed backend. `npm run package:preview` requires committed application inputs and writes `.nojekyll`, `release.json` and a SHA-256 file manifest into the successful build. The local static archive is `artifacts/v2/neptune-v2-rc1-static.tar.gz` (SHA-256 `d7fbf02fe534cc8db491a37e73765e9d719f1d24f692b6c177691acc83b3f262`). The identity hash covers the manifest bytes; its entries cover the compiled/static payload and exclude the two identity manifests to avoid recursion.

Start with the [signature experiment](EXPERIMENTS.md), [architecture](ARCHITECTURE.md), [reference design](REFERENCE-DESIGN.md), [model cards](MODELS.md), [data contract](DATA.md), [scene fidelity](SCENE.md), [requirement matrix](REQUIREMENTS.md) and [readiness/limits](READINESS.md). Generated sample artifacts are under `public/experiments/` and `public/samples/`.

## Preview deployment and rollback

The validated compiled payload was published under `v2-preview/` in a normal commit descended from the existing `codex/pages` deployment. Every pre-existing root file was compared against the preserved deployment before pushing. The candidate source was fast-forward merged into the repository’s default `codex/neptune` branch as requested. The actual served release/file manifest was verified and the complete browser suite passed against the public subpath. No force-push, root-payload replacement or new repository was used.

GitHub documents Pages availability for public repositories on GitHub Free in [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). No domain, paid API, purchase, plan change or new billing is part of this plan. The existing Sites connector's free entitlement is not assumed, so the verified GitHub static-hosting pattern is retained.

Production remains `https://arhaan2.github.io/neptune-2035/`. Its unchanged root payload is the preserved deployment `672805a984feadaab375061817c919fd6849b311`, now carried unchanged in the additive Pages deployment `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711`, with application source `127a2fade93112d58f8edd9f6fc6e9e02b12b57c`; annotated `v0.1.0` points to source checkpoint `8b78638838a82ee603fdb001bfc978df49a9665d`. To abandon this candidate, leave the production deployment untouched. If a future approved release needs rollback, restore the preserved compiled deployment in a new normal commit, rebuild Pages, verify `release.json` and rerun hosted acceptance. Never rewrite shared history.

Production promotion requires explicit user approval. Publishing this separate preview does not constitute production promotion or empirical validation.

## Local handoff

The final package remains under `artifacts/v2/` for local download. The public preview is the live handoff; local test servers can be stopped. No new repository was created. The final source/evidence changes are integrated into the existing repository, with the v2 development branch retained.

# NEPTUNE

## Current product

[Open NEPTUNE](https://arhaan2.github.io/neptune-2035/) · [Preserved v2 preview](https://arhaan2.github.io/neptune-2035/v2-preview/) · [Phase 7 historical release evidence](https://github.com/Arhaan2/neptune-2035/releases/tag/phase-7-2026-09-11)

**Asset-linked design-stage offshore infrastructure twin with coupled operation and failure simulation.**

**Simulated, design-stage prototype; physical validation pending.** NEPTUNE includes installed equipment, coupled simulation, whole-experiment metrics, bounded radial transfer, constrained decision campaigns, read-only observations and reproducible exports. The `/v2-preview/` deployment is preserved separately; it does not describe the current production root. The published [release identity](https://arhaan2.github.io/neptune-2035/release.json) names the actual deployed source and artifact.

Phase 7 adds Explore, Operate and Compare guidance, connected asset inspection, exact event-boundary history, whole-run decision explanations and an evidence-derived fault-and-recovery walkthrough. Read the [walkthrough instructions](docs/phase-7/WALKTHROUGH.md) and [acceptance matrix](docs/phase-7/REQUIREMENT-MATRIX.md). Acceptance, recordings and deployment are recorded in the corresponding release receipt; this source document alone is not evidence that Phase 7 is live.

Phase 8 defines independent software, numerical and integrated behavioral verification in the [contract](docs/phase-8/CONTRACT.md), [requirement matrix](docs/phase-8/REQUIREMENT-MATRIX.md) and [reproduction/release procedure](docs/phase-8/RELEASE.md). Final acceptance and deployed identities are external release receipts, not inferred from this document.

Use **Explore** to select installed equipment and inspect its specification and supported paths. **Operate** contains simulated fault controls and whole-experiment execution. **Compare** evaluates minimum included cost for fixed workload or maximum passing evaluated workload under a supply ceiling. The reference campaigns demonstrate eligible transfer, nominal-only preference and honest no-feasible receiving-bus/common-source outcomes under their declared requirements. These scenarios do not establish physical reliability or long-term adequacy.

Open `?legacy=1` for the original model; existing `#s=` scenarios also select Legacy mode without reinterpreting assumed PUE. The scene remains a representative, asset-linked model with ocean context, X-ray/exploded views and accessible fallback.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run test:telemetry   # requires the local dev server; opens native Chromium
npm run evidence:twin
npm run build
```

For a real read-only local test stream, run the command displayed in **Data & replay**, which includes the current design mapping version. `scripts/telemetry-publisher.mjs` runs independently of the static site. It is not deployed on GitHub Pages.

- [Baseline audit](docs/v2/BASELINE.md), [architecture](docs/v2/ARCHITECTURE.md), [reference design](docs/v2/REFERENCE-DESIGN.md), [requirement matrix](docs/v2/REQUIREMENTS.md).
- [Model cards and numerical tolerances](docs/v2/MODELS.md), [data contract / samples / calibration](docs/v2/DATA.md), [scene and export fidelity](docs/v2/SCENE.md).
- [Independent equation harness](reference/benchmarks.py), [reproducible pump experiment files](public/experiments/index.json).
- [Release candidate and remaining limits](docs/v2/RELEASE-CANDIDATE.md).

The following is the preserved historical v0.1.0 product/release description. Its scope and counts describe that release, not current production.

**Design the AI Data Center of 2035** — an interactive 3D offshore AI infrastructure concept by **Arhaan Aggarwal**.

[Open NEPTUNE](https://arhaan2.github.io/neptune-2035/) · [Source repository](https://github.com/Arhaan2/neptune-2035) · [Release record](docs/RELEASE.md)

What would AI infrastructure look like if we designed it around energy, cooling, and modularity from the beginning?

Explore a procedural sunset campus, open X-ray, trace separate cooling circuits and external power, explode six system groups, enter a representative rack aisle, and compare three scenario generations. Controls and geometry share a deterministic TypeScript engineering model. Links reconstruct all scenario inputs. A 30-second real-app storyboard supports presentation and recording.

![NEPTUNE running on the public release URL](docs/images/hero.png)

**Concept simulator · Not an engineering design.** No live telemetry, future GPU product claims, naval certification, or implied free electricity. Read [the model](docs/MODEL.md) for assumptions and omissions.

## Run locally

Node 22.13+ and npm:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173/). Drag/touch to orbit, scroll/pinch to zoom, or focus the canvas and use arrow keys and +/−. Reset restores the exterior frame. Escape exits the interior or cancels the demo. The labeled HTML system and scene controls provide equivalent selection.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

Browser tests need Playwright's Chromium, Firefox and WebKit installations; install missing browsers with `npx playwright install`. The browser suite starts or reuses the local dev server. Use `NEPTUNE_BASE_URL` for a hosted or production-preview URL.

## Architecture

- `src/domain`: pure simulation, validated inputs, declared capacity, presets and primary sources.
- `src/state`: bounded schema-v1 scenario URLs.
- `src/scene`: canonical layout, shared instanced geometry, six reversible exploded groups, linked flow anchors, ocean, camera and WebGL fallback.
- `src/ui`: scenario controls, real model outputs, inspectors, assumptions, sharing and demo state.
- `tests`: 53 model/sharing tests and actual-browser acceptance with screenshot comparisons.
- `docs`: model explanation, build log, QA, launch drafts and recording instructions.

Static Vite/React 19 application with Three.js, React Three Fiber 9 and Drei. No backend, database, login, telemetry, live data, paid APIs or essential remote assets. Geometry and the ocean/sky are procedural. A local source registry is bundled. Fonts use the system stack; icons use the installed Lucide library and controls compose the Sites starter's Shadcn/Base UI primitives.

WebGL2 initialization failure or context loss produces an accessible schematic with working model controls. Use `?fallback=1` to inspect it deliberately. Reduced motion stops visual interpolation and flow/ocean animation. Low effects disables shadows and limits resolution. Hidden tabs pause rendering and cancel scripted demos.

## Release and evidence

See [QA](docs/QA.md), [launch drafts](docs/LINKEDIN_LAUNCH.md), and [recording notes](docs/DEMO.md). Generated recordings and full browser traces stay out of Git. Selected screenshots and the social card come from the actual app.

## Scope

The budget builder, free-roaming controls, additional cooling architectures, glTF/Blender/Unreal exports and WebGPU are deferred. Costs, training speed and model capability are intentionally not inferred from accelerator count.

# Visual V2 — Systems Reveal

**Simulated, design-stage prototype; physical validation pending.** This is Visual V2 on the shipped Blue Hour foundation, not historical engineering Phase 2 or physical validation. Final candidate, CI, promotion and hosted results belong in the immutable external release receipt; this document describes the implementation and acceptance contract.

## Equipment and provenance

The normal **Cooling close-up** control reveals the selected module's installed cooling equipment. Campus geometry remains procedural. The authored kit is original geometry created and exported by Blender **4.3.2**, build `32f5fdce0a0a`, glTF exporter **4.3.47**. It contains no outside models, textures, brands, lights or cameras. It is a generic illustrative exterior, not manufacturer CAD or certified internal construction.

| Template | Supported specification | Canonical envelope, m | GLB bytes | Triangles |
| --- | --- | --- | ---: | ---: |
| Pump | `pump-reference@1.0.0`, `pump-efficient@1.0.0` | 1.2 × 1.2 × 0.8 | 325,180 | 8,648 |
| Plate exchanger | `exchanger-reference@1.0.0` | 2 × 2.2 × 1.4 | 559,236 | 15,464 |

Closed solids use back-face culling (Three `FrontSide` draws their front faces); two final exports retain byte-identical geometry/normal/index data to the initial exports, with only material sidedness changed. Each template has four merged mesh/material groups: pearl paint, brushed silver, graphite and dark inserts. Paint conveys the existing projected equipment state; selection uses the separate canonical cyan outline. The pump includes a shaped volute, motor cooling fins, flange rims, coupling guard, feet and shared fastener geometry. The exchanger includes a pressure frame, bounded plate pack, tie bars, feet and illustrative connection fittings. There are no animated rotors, invented sensors or new readings.

The larger `pump-physical` and unknown/legacy/custom specification IDs or versions use the established procedural geometry. Compatibility requires an explicit specification/role, matching meter dimensions, logical port sets and route endpoints. It never stretches the model. Technical pumps and the seawater pump use their respective canonical media; the exchanger retains the existing two-fluid boundary. All current graph endpoints are abstract asset centers. Cosmetic fittings do not claim physical port coordinates, extend outside the owning envelope or alter route lengths.

`scripts/visuals/blender/descriptor.json` is the small read-only authoring input derived from the catalog, design generator and presentation geometry. `public/visuals/v2/manifest.json` records supported specifications, bounds, anchors, material roles, hashes, counts, provenance and export settings. Visual kit versioning does not change project/model/solver/equipment versions.

## Regeneration and validation

From the repository root, after `npm ci`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/visuals/blender/author.py -- --source-dir=/absolute/nonshipping-source-directory
node scripts/visuals/blender/validate.mjs /absolute/nonshipping-source-directory
npx vitest run tests/visuals/kit-contract.test.ts tests/visuals/kit-cache.test.ts
```

The tested command recreates editable `.blend` files and the one-meter/asymmetric orientation proof outside `public/`. See [authoring README](../../scripts/visuals/blender/README.md) for executed commands, exporter settings and retained failures. Only the two GLBs and runtime manifest ship. Two executions produced byte-identical GLBs; no randomness or automatic bounding-box normalization is used. Runtime `(x,y,z)` maps to Blender `(x,-z,y)` and export applies the Y-up conversion exactly once.

- Pump SHA-256: `349db03c6513239aac075c85942ae8a79f90827f40c96b52fdcd593b992eaf75`.
- Exchanger SHA-256: `b18e9ad1d69d2b588e34e9eb06d728a891449d61959d8150b41a47631424c559`.
- Predeclared coordinate tolerance: `0.00001 m`; normal-length tolerance: `0.001`.
- Pinned build-time Khronos `gltf-validator@2.0.0-dev.3.10`: zero errors, warnings and informational messages for both shipping files.
- The validation script and tests load through Three's actual `GLTFLoader` and assert finite attributes/unit normals, identity canonical root, bounded geometry and transformed logical anchors. Tests also compare the descriptor to authoritative installed equipment and reject mismatched versions, dimensions, role/interface and graph endpoints.

The runtime verifies the complete file's byte length and SHA-256 before parsing. Its additional surface/material/envelope checks are defense in depth for these exact validated files, not a claim that arbitrary GLBs have been fully validated. There are no image dependencies or decoded image bitmaps; missing-texture testing is therefore inapplicable to this kit.

## Integration and ownership

`kitContract.ts`, `kitCache.ts` and `AuthoredEquipment.tsx` form the narrow presentation adapter. Compatible detail loads only for a cooling view, selected equipment close-up, interior, or explicit X-ray/exploded inspection. URLs resolve from Vite's base at the ordinary `/neptune-2035/` root. The initial campus and engineering controls never wait for a GLB or decoder.

Procedural equipment stays interactive during loading. A successful complete instance replaces its corresponding procedural silhouette. A missing, corrupt or incompatible file keeps a procedural view with a concise status. A stale load cannot attach to a different design/specification/asset key. Decorative descendants select their canonical parent; translucent decorative trim does not intercept equipment clicks. Both current and historical state come from the scene's existing inspected projection.

Each scene owns a bounded two-template cache. Templates own immutable shared geometries and their source materials. Each mounted equipment instance owns four cloned materials; state changes cannot recolor a peer. Instance cleanup is idempotent and makes its result immediately invalid. Cache retirement waits for every owner and instance, handles StrictMode effect replay, aborts outstanding fetches and disposes late parse results. Nothing clears another scene's resources. Context loss exposes the existing interactive plan fallback; **Restore 3D view** creates a new scene/cache and reloads validated detail.

Placement uses the exact canonical center and `presentedPosition`, with one existing exploded offset. No dimensions, mass, assets, routes or solver inputs change. The dimensioned glTF/project/inventory/results exports still use canonical generators, independently of cosmetic children. Under existing X-ray inspection, the selected bay's other procedural equipment envelopes fade and stop intercepting clicks so their opaque boxes cannot hide the kit; their identities and operating values remain available in the inspector. Distant module shells stay opaque in Cooling close-up. The circuit legend is available on demand. Blue Hour's opaque-to-transparent shader recreation is retained. Diagnostics publish through R3F's post-render callback so readiness and allocation observations describe completed frames.

The diagnostic surface hit is cached for each immutable instance/camera origin/assembly transform. Camera motion, explosion and instance replacement invalidate it; state, selection, rendered-mesh counts and allocation counters remain fresh on every publication. Weak keys retain no retired scene or GPU resources.

## Acceptance and budgets

Declared before judging the candidate: ≤10,000 triangles/pump, ≤20,000/exchanger, ≤6 MiB first-reveal assets; complete reveal ≤250 draws and ≤500,000 submitted triangles. Target 60 fps at 1440×900 CSS and DPR ≤1.5, with median ≥55 fps and p95 interval ≤25 ms in each of three fixed 30-second orbit/reveal runs. Twenty repeated cycles and a ten-minute interactive soak must retain bounded allocations, correct state and recoverable rendering.

The new assets total **884,416 bytes** before HTTP overhead and manifest. The persistent cache contains eight geometries/eight source materials/zero textures. At the standard campus end pose, the implementation-stage observed warmed renderer inventory is **73 geometries/two environment textures**, versus the cold 65/two. The expected change is the eight cached geometries; no-growth assertions compare identical completed poses. Active detail adds four private materials per equipment instance, released on leaving detail. Renderer counters are allocation inventories, not total memory.

`tests/browser/visual-v2.spec.ts` runs alongside the complete retained prototype, Phase 2–8 and VIS1 suites against the same compiled artifact. It covers real production paths, deferred/corrupt/missing loads, supersession, authored surface selection, keyboard selection, failure/history isolation, compatible and physical replacements, paused canonical exports, warmed reveal cycles, resource plateau, 390 px and actual context loss/restoration. Unit tests exercise cache ownership, twenty clone/dispose cycles and geometry/compatibility contracts. The two historical Chromium/WebKit large-campus Step 10s exclusions remain the only exclusions; Firefox's case remains active. No new retries, deadline relaxation or skipped numerical/historical jobs are introduced.

The historical gate admits one explicit dependency addition: the exact build-time `gltf-validator@2.0.0-dev.3.10` package pin, lockfile root pin and complete leaf entry, including registry URL, integrity, development flag and license. It verifies the clean accepted `c22964d` checkout first, requires those additions to be absent there, removes only those three fields in memory, then deep-strict-compares every remaining package and lockfile field. Unchanged inputs also pass. The receipt retains both files' original/current hashes and the admission ledger. The historical checkout still runs `npm ci` against its untouched original lock; solver execution, physical comparisons and tolerances are unchanged. Negative tests reject all other dependency, nested, integrity and metadata changes.

```sh
NEPTUNE_VISUAL_MODE=capture NEPTUNE_VISUAL_OUT=/absolute/evidence/capture node scripts/visuals/v2-measure.mjs
NEPTUNE_VISUAL_MODE=measure NEPTUNE_VISUAL_OUT=/absolute/evidence/measure node scripts/visuals/v2-measure.mjs
NEPTUNE_VISUAL_MODE=soak NEPTUNE_VISUAL_OUT=/absolute/evidence/soak node scripts/visuals/v2-measure.mjs
```

The helper retains raw intervals, cold/warm observations, resource counts, separate JS heap observations, screenshots and an actual-app WebM outside Git. Performance contexts select normal motion before application mount and verify stable completed camera poses, normal-motion state and actual orbit displacement; capture/soak contexts use explicitly recorded reduced motion. GPU/native allocation is unavailable. Bundled Chromium, CI browsers, hosted observations and native Safari are identified separately in the release receipt; none substitutes for another. Local hardware identification is recorded afresh, without assuming the V1 host.

The VIS1/VIS2 resource-cycle cases use native keyboard activation of the same visible, enabled, focused buttons. Pointer control and authored-surface coverage remain in the other cases. Every cycle, intermediate state/render wait, resource equality assertion and the original 60-second deadline remains intact. The visibility, effective disabled-state and actual-focus checks share one retried browser observation before native Enter input, avoiding redundant protocol round trips measured on CI software rendering; all failed attempts are retained.

The VIS2 resource-cycle case also keeps an API trace, sources and attachments on every run while disabling only its per-action DOM snapshots and trace filmstrip. Its automatic failure screenshot remains enabled. The retained failed WebKit trace from CI run `36517200519` recorded 434 DOM snapshots and 116 filmstrip frames; the elapsed boundaries around awaited before/after snapshots totaled 18.18 seconds across six completed cycles, including protocol and scheduling time. This is not a claim that all of that time is removable or that tracing was the sole cause of the timeout. Each completed cycle's existing post-render observation is attached even if a later cycle fails. All cycle inputs, readiness waits, resource assertions and deadlines remain unchanged, and other cases retain their existing tracing and actual-app media evidence. Fresh full CI acceptance is required.

## Release and next boundary

Reuse [Phase 8 release](../phase-8/RELEASE.md): clean installation; typecheck/lint/full units including both real telemetry integrations; numerical and original historical campaign checks; the full retained and V2 browser list; independent review; normal PR and merge. Promote the exact CI-tested compiled payload after preserving the latest verified Pages payload/preview inventory. Only documented release metadata may differ. Preserve every preview byte, await Pages success, verify all served hashes and run hosted acceptance before claiming deployment complete. Final receipts and usable media links are published as durable release evidence.

One narrow V3 candidate is a compatible authored CDU exterior using the same validated binding/lifecycle contract. The broader equipment library, rack interiors and physical-validation roadmap remain unfinished.

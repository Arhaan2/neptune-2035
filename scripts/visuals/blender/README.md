# Original Visual V2 cooling kit

This authoring source generates a generic pump and plate-exchanger exterior for the
existing NEPTUNE installed equipment. It changes no engineering record, physical
route, mass, rated capacity or solver. All geometry is original project-generated
art; it uses no third-party models, textures, fonts, scans or brand marks. It is
design-stage visualization, not manufacturer CAD or validated fabrication detail.

The read-only input is `descriptor.json`. `equipment.ts` owns specification IDs,
versions and dimensions; `assets/design.ts` owns supported role IDs, ports and the
abstract center endpoints of routes. `kit-contract.test.ts` compares these owners
with the descriptor and tests rejection of incompatible substitutions. No matching
name, compatible engineering family alone or automatic scale adjustment admits an
unlisted specification.

## Tested regeneration

From repository root with the lockfile's dependencies installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/visuals/blender/author.py -- --source-dir /private/tmp/neptune-v2-blender-source
node scripts/visuals/blender/validate.mjs /private/tmp/neptune-v2-blender-source
npx vitest run tests/visuals/kit-contract.test.ts
```

The first command was actually executed with Blender **4.3.2**, build
`32f5fdce0a0a`; the exporter identifies itself as **Khronos glTF Blender I/O
v4.3.47**. Blender's installed operator API is used directly:
`bpy.ops.export_scene.gltf`, with GLB output, `export_yup=True`, applied modifiers,
normals and custom extras enabled, and UVs, lights, cameras and animation disabled.
All authored parts are closed solids; materials enable `use_backface_culling` so
the GLB loads as Three `FrontSide`, matching the procedural equipment's culling.
Reference: [Blender glTF exporter manual](https://docs.blender.org/manual/en/4.3/addons/import_export/scene_gltf2.html).

`--source-dir` is required and must be outside the shipping output directory. The
tested command recreates editable `pump.blend` and `exchanger.blend`, the
nonshipping `orientation-proof.glb`, and the authoring report. These are disposable
regeneration outputs; the durable sources are this checked-in script and descriptor.
No unpublished external source artifact is required to recreate them.

Two complete exports into separate editable-source directories produced identical
shipping GLB SHA-256 values. There is no randomness. Mesh and material names and
export settings are fixed. The manifest additionally records semantic geometry,
normal, index and material hashes; `.blend` file metadata is not claimed byte-stable.
Do not regenerate assets after candidate acceptance without rerunning acceptance.

To validate a separate output without overwriting shipping files, pass
`--output /path/to/output` to `author.py`, then pass that directory as the optional
second argument to `validate.mjs`. The culling correction was exported and
validated twice in independent output and editable-source directories.

## Geometry and coordinate checks

One local unit is one meter. Authoring functions convert canonical runtime
`(x,y,z)` to Blender `(x,-z,y)`, and the exporter performs the single documented
Blender Z-up to glTF Y-up conversion. Mesh transforms are applied; the root remains
at canonical center with identity scale/rotation/translation. No bounds-based
normalization is performed.

The nonshipping guide is exported by the same Blender process and loaded through
Three's actual `GLTFLoader`: `[0,0,0]` to `[1,0,0]` is one meter; its asymmetric
point returns `[0.2300000042,0.4099999964,-0.1700000018]` and its unequal dimensions
return `[0.1299999952,0.0700000003,0.0299999993]`. Actual shipping pump vertices are
also checked for the upper-left/rear discharge silhouette. The guide never enters
the shipping geometry.

The predeclared position/bounds tolerance is **0.00001 m**. Unit normals must be
within **0.001**. Material scalar tests use six decimal places for float32 export
noise. Exact canonical envelope extents are retained. Four merged meshes, one per
material role, replace many small-part draw calls. Only `paint` is the intended
instance state-tint surface; metal, structure and inserts keep their material roles.
There are no movable subgroups, textures, decoder dependencies or animations.

All logical anchors remain local `[0,0,0]`, faithfully reflecting the existing
abstract center-route graph. The pump's fluid medium follows its permitted duty,
standby or seawater role. The exchanger retains distinct technical/seawater anchor
semantics. Exterior flange faces remain inside the parent envelope and do not
pretend to be physical port coordinates or add routed flow paths.

## Delivered exports

| Template | Supported specification | Bytes | Triangles | Meshes / materials / textures |
| --- | --- | ---: | ---: | --- |
| Pump | `pump-reference@1.0.0`, `pump-efficient@1.0.0` | 325,180 | 8,648 | 4 / 4 / 0 |
| Exchanger | `exchanger-reference@1.0.0` | 559,236 | 15,464 | 4 / 4 / 0 |

Pump SHA-256: `349db03c6513239aac075c85942ae8a79f90827f40c96b52fdcd593b992eaf75`.

Exchanger SHA-256: `b18e9ad1d69d2b588e34e9eb06d728a891449d61959d8150b41a47631424c559`.

Combined GLB transfer is **884,416 bytes**; the small manifest is additional. A
module's three compatible pumps share one immutable geometry template. The
physically different `pump-physical` and configured nonreference exchanger records
remain procedural, as do unknown versions, changed bounds and changed interfaces.

Khronos `gltf-validator@2.0.0-dev.3.10` reports **zero errors, zero warnings and zero
information messages** for both files. Three's loader checks finite attributes,
unit normals, opaque front-sided standard materials, exact bounds, identity canonical root,
anchor parents/transforms and no external texture/buffer dependency. The normal
unit suite runs both real exported files through Khronos and Three again.

## Recorded corrections and limits

The initial sandboxed Blender process crashed during macOS Metal device discovery
before running Python. The same installed Blender succeeded under the authorized
outside-sandbox execution. An attempted OpenGL backend was unavailable in this
macOS build. These are environment failures, not asset validation passes.

The first geometry validation correctly rejected a suction-face recess extending
0.0005 m beyond the pump envelope. Its authored coordinate was corrected; the
predeclared tolerance was retained. Initial exact material scalar equality also
detected ordinary float32 `0.55 -> 0.5500000119`; the test uses explicit six-decimal
comparison, without weakening geometry limits. Both corrected exports then passed
the full 14-test contract suite and repeat export.

The original exporter defaults produced double-sided materials for these closed
solids. Enabling backface culling removed only the four `doubleSided: true` fields
from each GLB's material definitions. Against frozen candidate
`80d45ad7140ab320960e6d6e4fd8d3efcadf3d71`, the binary chunks and every other GLB JSON
value are identical: positions, normals, indices, accessors, bounds, transforms and
anchors are unchanged. The existing semantic hashes remain identical. Both new
exports and manifests match each other byte for byte; each GLB is 76 bytes smaller.
This corrects culling without reducing geometric detail. Actual browser appearance
and performance remain separate acceptance checks.

These checks establish authored-kit structure and compatibility, not app visual
quality or release acceptance. Browser loader, state/selection isolation, matched
images, resource/performance measurements and hosted evidence belong to the V2
integration/release report. No offline Blender image substitutes for that evidence.

## Additive Visual V3 CDU

`descriptor-v3.json` adds only `cdu-reference@1.0.0`, role `cdu`, with the current
catalog envelope **1.2 × 2 × 1.1 m**. The closed cabinet has pearl doors/side panels,
manufactured edges, dark seams/plinth, silver handles/hinges/mounting hardware and
a blank unlit inset. Its two rear technical connection faces are cosmetic. They
do not replace the authoritative center anchors, move route endpoints or add a
seawater interface. Existing pumps and the two-fluid exchanger stay separate;
the cabinet introduces no simulated pump, exchanger, sensor, airflow, thermal
stage or power load. All geometry is original, unbranded and texture-free.

The V2 descriptor, both V2 GLBs and V2 manifest retain their shipped bytes. The
default author/validator commands above retain the V2 regeneration path; V3 uses
an explicit descriptor and separate output directory. `author.py` dispatches only
the declared pump/exchanger/CDU functions and rejects unknown names.

The following commands were executed from the repository root on 2026-09-29:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/visuals/blender/author.py -- --descriptor scripts/visuals/blender/descriptor-v3.json --output /private/tmp/neptune-v3-cdu-run-1/output --source-dir /private/tmp/neptune-v3-cdu-run-1/source
node scripts/visuals/blender/validate.mjs /private/tmp/neptune-v3-cdu-run-1/source /private/tmp/neptune-v3-cdu-run-1/output scripts/visuals/blender/descriptor-v3.json
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/visuals/blender/author.py -- --descriptor scripts/visuals/blender/descriptor-v3.json --output /private/tmp/neptune-v3-cdu-run-2/output --source-dir /private/tmp/neptune-v3-cdu-run-2/source
node scripts/visuals/blender/validate.mjs /private/tmp/neptune-v3-cdu-run-2/source /private/tmp/neptune-v3-cdu-run-2/output scripts/visuals/blender/descriptor-v3.json
cmp /private/tmp/neptune-v3-cdu-run-1/output/cdu.glb /private/tmp/neptune-v3-cdu-run-2/output/cdu.glb
cmp /private/tmp/neptune-v3-cdu-run-1/output/manifest.json /private/tmp/neptune-v3-cdu-run-2/output/manifest.json
npx vitest run tests/visuals/cdu-contract.test.ts
```

Both independent exports used Blender **4.3.2**, build `32f5fdce0a0a`, and **Khronos
glTF Blender I/O v4.3.47**. Both comparison commands exited zero: the GLBs and
generated manifests are byte-identical. The editable `cdu.blend` files (892,948
bytes each), `orientation-proof.glb`, and `authoring-run.json` remain in their
nonshipping source directories. Their timestamps/metadata are not claimed stable;
the checked-in script and descriptor regenerate them without an outside source.
The first sandboxed Blender attempt exited 139 before Python during native device
discovery; the authorized outside-sandbox executions succeeded. This failed
environment attempt is not included as an export or validation pass.

| New runtime file | Bytes | SHA-256 |
| --- | ---: | --- |
| `public/visuals/v3/cdu.glb` | 296,508 | `f5274b9846026b674773bc2f8170b7175aeee202fbbcb9dd34bf38ebff9ee110` |
| `public/visuals/v3/manifest.json` | 5,623 | `232aa49417cebdaf6e213e908caa4a8309b465f89ca5135353cd2654b03c782b` |

V3 descriptor SHA-256:
`2d8e3dfad5ea454bd03b3033c2c48ea4e47e1e29e8ee904d57887100923ec958`.
The inherited V2 manifest SHA-256 remains
`b9bc013bc9a4cb80171853e423b7958eb79676aebe1dd489150525d26e97454e`;
the unchanged pump/exchanger hashes are recorded above and asserted in V3 tests.

The cabinet has **5,956 triangles**, **10,664 vertices**, four merged meshes/four
material roles and zero textures. Its GLB is below the predeclared 12,000-triangle
and 1 MiB budgets. All three GLBs total **1,180,924 bytes** before HTTP overhead;
manifests are additional. No decoder or dependency admission was added.

Both exports passed the existing pinned `gltf-validator@2.0.0-dev.3.10` with
**zero errors, warnings or information messages**, then the real Three
`GLTFLoader` root/finite-geometry/unit-normal/material/anchor/bounds checks. The
coordinate tolerance remains **0.00001 m**, normal-length tolerance **0.001**.
The one-meter/asymmetric axis proof returned the same values recorded for V2.
`cdu-contract.test.ts` passed **17 tests**, including exact exported bounds,
front/rear asymmetry, specification/version/role/dimension/interface/route
rejections, current first/second-module ports and unchanged V2 artifacts.

Only `cdu.glb` and the new manifest are copied into `public/visuals/v3/`; they
reference no images, external buffers or extensions. The runtime composes this
CDU-only manifest with the retained V2 templates. App appearance, state/lifecycle,
resource/performance and hosted acceptance are separate V3 release evidence;
this authoring validation establishes no physical fidelity or full equipment
library completion.

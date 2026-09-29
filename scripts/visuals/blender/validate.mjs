/** Build-time only: Khronos validation plus the actual Three GLTFLoader contract. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { validateBytes, version } from 'gltf-validator';
import { Box3, Vector3, Matrix4 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const sourceDir = process.argv[2];
if (!sourceDir) throw Error('Usage: node scripts/visuals/blender/validate.mjs /path/to/nonshipping-source-dir');
const descriptorBytes = await readFile(resolve(here, 'descriptor.json'));
const descriptor = JSON.parse(descriptorBytes);
const authoring = JSON.parse(await readFile(resolve(sourceDir, 'authoring-run.json'), 'utf8'));
const tolerance = descriptor.toleranceM;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw Error(message); };
const close = (a, b) => Math.abs(a - b) <= tolerance;

async function load(bytes) {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  return gltf;
}

const guideBytes = await readFile(resolve(sourceDir, 'orientation-proof.glb'));
const guide = await load(guideBytes);
const world = name => guide.scene.getObjectByName(name).getWorldPosition(new Vector3()).toArray();
const start = world('meter_start'), end = world('meter_end'), asymmetric = world('asymmetric_xyz');
assert(start.every((v, i) => close(v, [0, 0, 0][i])) && end.every((v, i) => close(v, [1, 0, 0][i])), 'One-meter axis conversion failed');
assert(asymmetric.every((v, i) => close(v, [0.23, 0.41, -0.17][i])), 'Asymmetric Y-up orientation conversion failed');
const reference = guide.scene.getObjectByName('asymmetric_reference_part');
const proofSize = new Box3().setFromObject(reference).getSize(new Vector3()).toArray();
assert(proofSize.every((v, i) => close(v, [0.13, 0.07, 0.03][i])), 'Asymmetric geometry orientation failed');

const templates = [];
for (const template of descriptor.templates) {
  const path = resolve(root, 'public/visuals/v2', template.file);
  const bytes = await readFile(path);
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert((document.images ?? []).length === 0 && (document.textures ?? []).length === 0, `${template.file}: unexpected texture dependency`);
  assert(document.buffers.every(buffer => !buffer.uri), `${template.file}: external buffer`);
  authoring.gltfExporter = document.asset.generator;
  const validation = await validateBytes(new Uint8Array(bytes), { uri: template.file, maxIssues: 100 });
  assert(validation.issues.numErrors === 0, `${template.file}: Khronos validation errors ${JSON.stringify(validation.issues.messages)}`);
  const { scene } = await load(bytes);
  const canonicalRoot = scene.getObjectByName(`${template.id}_canonical_root`);
  assert(canonicalRoot, `${template.file}: missing canonical root`);
  assert(canonicalRoot.matrixWorld.elements.every((v, i) => close(v, new Matrix4().elements[i])), `${template.file}: root is not canonical identity`);
  let meshes = 0, triangles = 0, vertices = 0;
  const materials = new Set(), textures = new Set(), semantic = [];
  scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    assert(object.parent === canonicalRoot, `${object.name}: mesh is not a canonical child`);
    const geometry = object.geometry, position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    assert(position && normal && position.count === normal.count, `${object.name}: missing normals`);
    for (const [name, attr] of Object.entries(geometry.attributes)) {
      assert(Array.from(attr.array).every(Number.isFinite), `${object.name}: nonfinite ${name}`);
    }
    for (let i = 0; i < normal.count; i++) {
      const n = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert(Math.abs(n - 1) <= descriptor.normalTolerance, `${object.name}: nonunit normal ${n}`);
    }
    vertices += position.count;
    triangles += (geometry.index?.count ?? position.count) / 3;
    const material = object.material;
    assert(!Array.isArray(material), `${object.name}: one material per merged mesh required`);
    assert(descriptor.materialRoles.some(role => role.name === material.name), `${object.name}: unexpected role`);
    assert(!material.transparent && material.opacity === 1 && material.isMeshStandardMaterial, `${object.name}: unsupported material`);
    materials.add(material.name);
    Object.values(material).filter(v => v?.isTexture).forEach(texture => textures.add(texture));
    semantic.push({ name: object.name, matrix: object.matrixWorld.toArray(), positions: [...position.array], normals: [...normal.array], indices: [...geometry.index.array], material: {name: material.name, color: material.color.toArray(), metalness: material.metalness, roughness: material.roughness} });
  });
  const bounds = new Box3().setFromObject(canonicalRoot);
  for (let axis = 0; axis < 3; axis++) {
    assert(bounds.min.toArray()[axis] >= template.boundsM.min[axis] - tolerance && bounds.max.toArray()[axis] <= template.boundsM.max[axis] + tolerance, `${template.file}: geometry exceeds canonical envelope: ${JSON.stringify(bounds)}`);
  }
  for (const anchor of template.logicalAnchors) {
    const object = scene.getObjectByName(`anchor_${anchor.id}`);
    assert(object && object.parent === canonicalRoot, `${template.file}: missing anchor ${anchor.id}`);
    const actual = object.getWorldPosition(new Vector3()).toArray();
    assert(actual.every((v, i) => close(v, anchor.positionM[i])), `${template.file}: misplaced ${anchor.id}`);
    assert(object.userData.medium === anchor.medium && object.userData.direction === anchor.direction, `${template.file}: anchor semantic drift`);
  }
  assert(triangles <= template.triangleBudget, `${template.file}: ${triangles} triangles exceeds budget`);
  assert(meshes === 4 && materials.size === 4 && textures.size === 0, `${template.file}: expected four merged material groups without textures`);
  templates.push({...template, url: `visuals/v2/${template.file}`, rootName: `${template.id}_canonical_root`, sha256: hash(bytes), bytes: bytes.length, semanticSha256: hash(JSON.stringify(semantic)), actualBoundsM: {min: bounds.min.toArray(), max: bounds.max.toArray()}, metrics: {meshes, materials: materials.size, textures: textures.size, triangles, vertices}, validation: {validator: 'Khronos glTF Validator', version: version(), errors: validation.issues.numErrors, warnings: validation.issues.numWarnings, infos: validation.issues.numInfos, messages: validation.issues.messages}});
}
const manifest = {...descriptor, descriptorSha256: hash(descriptorBytes), authoring, orientationProof: {meterStartM: start, meterEndM: end, asymmetricM: asymmetric, asymmetricSizeM: proofSize, sourceFile: 'regenerated outside shipping payload', testedWith: 'Three GLTFLoader'}, templates};
await writeFile(resolve(root, 'public/visuals/v2/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({kitId: descriptor.kitId, version: descriptor.version, blender: authoring.blenderVersion, validator: version(), orientationProof: manifest.orientationProof, assets: templates.map(t => ({file: t.file, sha256: t.sha256, bytes: t.bytes, ...t.metrics, validation: t.validation}))}, null, 2));

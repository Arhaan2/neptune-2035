import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import { Box3, Matrix4, Mesh, MeshStandardMaterial, Vector3, type BufferAttribute } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildDesign, connectionsForModule, DEFAULT_CONFIG, moduleAssets } from '../../src/twin/assets/design';
import { catalogSpecification, engineeringIdentity } from '../../src/twin/catalog/equipment';
import { getVisualKitBinding, KIT_TOLERANCE_M, VISUAL_KIT_MANIFEST as manifest } from '../../src/scene/visuals/kitContract';
import type { Asset } from '../../src/twin/types';

const { validateBytes } = createRequire(import.meta.url)('gltf-validator') as {
  validateBytes: (bytes: Uint8Array, options: {uri: string; maxIssues: number}) => Promise<{issues: {numErrors: number; numWarnings: number}}>;
};

const directory = new URL('../../public/visuals/v2/', import.meta.url);
const descriptorFile = new URL('../../scripts/visuals/blender/descriptor.json', import.meta.url);
const descriptor = JSON.parse(readFileSync(descriptorFile, 'utf8'));
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const close = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(KIT_TOLERANCE_M));
};
const design = buildDesign(DEFAULT_CONFIG);
const equipment = moduleAssets(design, design.modules[0].id);
const asset = (suffix: string) => equipment.find(a => a.id.endsWith('/' + suffix))!;

describe('Visual V2 authoring contract', () => {
  test('descriptor names real immutable installed specifications without wildcard compatibility', () => {
    expect(manifest.descriptorSha256).toBe(hash(readFileSync(descriptorFile)));
    expect(manifest.units).toBe('meter');
    expect(manifest.toleranceM).toBe(KIT_TOLERANCE_M);
    expect(manifest.rootPivot).toBe('canonical-asset-center');
    expect(manifest.rootScale).toEqual([1, 1, 1]);
    expect(manifest.templates.map(t => t.supportedSpecifications.map(s => s.id))).toEqual([
      ['pump-reference', 'pump-efficient'], ['exchanger-reference'],
    ]);
    for (const template of manifest.templates) {
      for (const declared of template.supportedSpecifications) {
        const canonical = catalogSpecification(declared.id);
        expect(canonical.version).toBe(declared.version);
        expect(canonical.type).toBe(template.type);
        expect(canonical.dimensionsM).toEqual(template.dimensionsM);
      }
      expect(template.boundsM.min).toEqual(template.dimensionsM.map(v => -v / 2));
      expect(template.boundsM.max).toEqual(template.dimensionsM.map(v => v / 2));
      expect(template.movableSubgroups).toEqual([]);
    }
  });

  test('all declared roles and a second module bind their current graph center endpoints', () => {
    const before = engineeringIdentity(design);
    for (const module of design.modules.slice(0, 2)) {
      const moduleEquipment = moduleAssets(design, module.id);
      const connections = connectionsForModule(design, module.id);
      for (const suffix of ['pump-duty', 'pump-sea', 'pump-standby', 'hx']) {
        const installed = moduleEquipment.find(a => a.id.endsWith('/' + suffix))!;
        const binding = getVisualKitBinding(installed, connections);
        expect(binding).not.toBeNull();
        expect(binding!.dimensionsM).toEqual(installed.dimensionsM);
        expect(binding!.anchors.map(a => a.medium)).toEqual(suffix === 'hx' ? ['technical', 'technical', 'seawater', 'seawater'] : [suffix === 'pump-sea' ? 'seawater' : 'technical', suffix === 'pump-sea' ? 'seawater' : 'technical', 'power', 'power']);
        for (const anchor of binding!.anchors) expect(anchor.positionM).toEqual([0, 0, 0]);
      }
    }
    expect(getVisualKitBinding({...asset('pump-duty'), catalogId: 'pump-efficient'})).not.toBeNull();
    expect(engineeringIdentity(design)).toBe(before);
  });

  test.each([
    ['physical replacement', {catalogId: 'pump-physical', dimensionsM: [1.35, 1.3, 0.9]}],
    ['same ID but oversized envelope', {dimensionsM: [1.201, 1.2, 0.8]}],
    ['same dimensions but unknown specification', {catalogId: 'pump-unregistered'}],
    ['unknown version', {revision: '2.0.0'}],
    ['wrong canonical role', {id: 'platform-001/module-01/new-pump'}],
    ['nonfinite placement', {positionM: [NaN, 2.6, -3.5]}],
    ['missing port', {ports: asset('pump-duty').ports.slice(1)}],
    ['wrong medium', {ports: asset('pump-duty').ports.map(p => p.medium === 'technical' ? {...p, medium: 'seawater'} : p)}],
  ])('rejects %s in favor of procedural fallback', (_name, patch) => {
    expect(getVisualKitBinding({...asset('pump-duty'), ...patch} as Asset)).toBeNull();
  });

  test('rejects altered route anchors/ports rather than rerouting artwork or joining media', () => {
    const connections = connectionsForModule(design, design.modules[0].id);
    const index = connections.findIndex(c => c.to === asset('pump-duty').id && c.medium === 'technical');
    for (const change of ['endpoint', 'medium', 'port'] as const) {
      const changed = structuredClone(connections), route = changed[index];
      if (change === 'endpoint') route.routeM.at(-1)![0] += 0.01;
      if (change === 'medium') route.medium = 'seawater';
      if (change === 'port') route.toPort = 'power-in';
      expect(getVisualKitBinding(asset('pump-duty'), changed)).toBeNull();
    }
  });

  test('original sources and shipping inventory exclude Blender sources, guides, images and decoders', () => {
    expect(readdirSync(directory).sort()).toEqual(['exchanger.glb', 'manifest.json', 'pump.glb']);
    expect(manifest.provenance.rights).toContain('no third-party');
    expect(manifest.authoring.blenderVersion).toBe('4.3.2');
    expect(manifest.authoring.externalAssets).toEqual([]);
    expect(manifest.authoring.guideShipping).toBe(false);
    expect(manifest.templates.reduce((total, t) => total + t.bytes, 0)).toBeLessThan(6 * 1024 * 1024);
    close(manifest.orientationProof.meterStartM, [0, 0, 0]);
    close(manifest.orientationProof.meterEndM, [1, 0, 0]);
    close(manifest.orientationProof.asymmetricM, [0.23, 0.41, -0.17]);
    close(manifest.orientationProof.asymmetricSizeM, [0.13, 0.07, 0.03]);
  });

  for (const template of manifest.templates) {
    test(`${template.file}: hash, Khronos, actual loader, normals, root, exact bounds and transformed anchors`, async () => {
      const bytes = readFileSync(new URL(template.file, directory));
      expect(bytes.length).toBe(template.bytes);
      expect(hash(bytes)).toBe(template.sha256);
      const result = await validateBytes(new Uint8Array(bytes), {uri: template.file, maxIssues: 100});
      expect(result.issues.numErrors).toBe(0);
      expect(result.issues.numWarnings).toBe(0);
      const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
      expect(document.images ?? []).toHaveLength(0);
      expect(document.textures ?? []).toHaveLength(0);
      expect(document.extensionsRequired ?? []).toHaveLength(0);
      expect(document.buffers.every((b: {uri?: string}) => !b.uri)).toBe(true);
      const loaded = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      loaded.scene.updateMatrixWorld(true);
      const root = loaded.scene.getObjectByName(template.rootName)!;
      expect(root).toBeDefined();
      close(root.matrixWorld.elements, new Matrix4().elements);
      const bounds = new Box3().setFromObject(root);
      close(bounds.min.toArray(), template.boundsM.min);
      close(bounds.max.toArray(), template.boundsM.max);
      const roleNames: string[] = [];
      let meshes = 0, triangles = 0, vertices = 0;
      loaded.scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        meshes++;
        expect(object.parent).toBe(root);
        expect(object.material).toBeInstanceOf(MeshStandardMaterial);
        const material = object.material as MeshStandardMaterial;
        roleNames.push(material.name);
        expect(material.transparent).toBe(false);
        expect(material.opacity).toBe(1);
        const role = descriptor.materialRoles.find((r: {name: string}) => r.name === material.name);
        expect(material.metalness).toBeCloseTo(role.metalness, 6);
        expect(material.roughness).toBeCloseTo(role.roughness, 6);
        const geometry = object.geometry, normal = geometry.getAttribute('normal'), position = geometry.getAttribute('position');
        expect(normal.count).toBe(position.count);
        for (const attribute of Object.values(geometry.attributes) as BufferAttribute[]) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        for (let i = 0; i < normal.count; i++) expect(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1)).toBeLessThanOrEqual(manifest.normalTolerance);
        expect(object.matrixWorld.elements).toEqual(new Matrix4().elements);
        triangles += (geometry.index?.count ?? position.count) / 3;
        vertices += position.count;
      });
      expect(meshes).toBe(4);
      expect(roleNames.sort()).toEqual(['graphite', 'insert', 'paint', 'silver']);
      expect(triangles).toBe(template.metrics.triangles);
      expect(vertices).toBe(template.metrics.vertices);
      expect(triangles).toBeLessThanOrEqual(template.triangleBudget);
      for (const anchor of template.logicalAnchors) {
        const node = root.getObjectByName('anchor_' + anchor.id)!;
        expect(node).toBeDefined();
        expect(node.parent).toBe(root);
        close(node.getWorldPosition(new Vector3()).toArray(), anchor.positionM);
        expect(node.userData.medium).toBe(anchor.medium);
        expect(node.userData.direction).toBe(anchor.direction);
      }
      // Asymmetric discharge is physically above/left/rear of the motor after export.
      // This reads actual geometry, supplementing the separately regenerated 1m proof.
      if (template.id === 'pump') {
        const silver = loaded.scene.getObjectByName('pump_silver') as Mesh;
        const positions = silver.geometry.getAttribute('position');
        const upper = Array.from({length: positions.count}, (_, i) => new Vector3().fromBufferAttribute(positions, i)).filter(p => p.y > 0.58);
        expect(upper.length).toBeGreaterThan(20);
        expect(upper.every(p => p.x < -0.15 && p.z > -0.05)).toBe(true);
      }
      loaded.scene.traverse(object => {
        if (object instanceof Mesh) { object.geometry.dispose(); (object.material as MeshStandardMaterial).dispose(); }
      });
    });
  }
});

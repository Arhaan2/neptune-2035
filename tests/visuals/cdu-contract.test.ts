import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import { Box3, FrontSide, Matrix4, Mesh, MeshStandardMaterial, Vector3, type BufferAttribute } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../public/visuals/v3/manifest.json';
import v2 from '../../public/visuals/v2/manifest.json';
import { buildDesign, connectionsForModule, DEFAULT_CONFIG, moduleAssets } from '../../src/twin/assets/design';
import { catalogSpecification, engineeringIdentity } from '../../src/twin/catalog/equipment';
import { getVisualKitBinding, KIT_TOLERANCE_M } from '../../src/scene/visuals/kitContract';
import type { Asset } from '../../src/twin/types';

const { validateBytes } = createRequire(import.meta.url)('gltf-validator') as {
  validateBytes: (bytes: Uint8Array, options: {uri: string; maxIssues: number}) => Promise<{issues: {numErrors: number; numWarnings: number; numInfos: number}}>;
};
const directory = new URL('../../public/visuals/v3/', import.meta.url);
const descriptorFile = new URL('../../scripts/visuals/blender/descriptor-v3.json', import.meta.url);
const descriptor = JSON.parse(readFileSync(descriptorFile, 'utf8'));
const template = manifest.templates[0];
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const close = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(KIT_TOLERANCE_M));
};
const design = buildDesign(DEFAULT_CONFIG);
const asset = moduleAssets(design, design.modules[0].id).find(a => a.type === 'cdu')!;

describe('Visual V3 original closed CDU contract', () => {
  test('additive descriptor agrees with current authoritative CDU and preserves V2 artifacts', () => {
    expect(manifest.descriptorSha256).toBe(hash(readFileSync(descriptorFile)));
    expect(manifest.units).toBe('meter');
    expect(manifest.toleranceM).toBe(KIT_TOLERANCE_M);
    expect(manifest.normalTolerance).toBe(0.001);
    expect(manifest.rootPivot).toBe('canonical-asset-center');
    expect(manifest.rootScale).toEqual([1, 1, 1]);
    expect(manifest.materialRoles).toEqual(v2.materialRoles);
    expect(manifest.templates).toHaveLength(1);
    expect(template.id).toBe('cdu');
    expect(template.supportedSpecifications).toEqual([{id: 'cdu-reference', version: '1.0.0'}]);
    expect(template.supportedRoles).toEqual(['cdu']);
    const canonical = catalogSpecification('cdu-reference');
    expect(canonical.version).toBe('1.0.0');
    expect(canonical.type).toBe(template.type);
    expect(canonical.dimensionsM).toEqual(template.dimensionsM);
    expect(template.dimensionsM).toEqual([1.2, 2, 1.1]);
    expect(template.boundsM.min).toEqual(template.dimensionsM.map(v => -v / 2));
    expect(template.boundsM.max).toEqual(template.dimensionsM.map(v => v / 2));
    expect(template.movableSubgroups).toEqual([]);
    expect(hash(readFileSync(new URL('../../public/visuals/v2/pump.glb', import.meta.url)))).toBe('349db03c6513239aac075c85942ae8a79f90827f40c96b52fdcd593b992eaf75');
    expect(hash(readFileSync(new URL('../../public/visuals/v2/exchanger.glb', import.meta.url)))).toBe('b18e9ad1d69d2b588e34e9eb06d728a891449d61959d8150b41a47631424c559');
    expect(hash(readFileSync(new URL('../../public/visuals/v2/manifest.json', import.meta.url)))).toBe('b9bc013bc9a4cb80171853e423b7958eb79676aebe1dd489150525d26e97454e');
    expect(hash(readFileSync(new URL('../../scripts/visuals/blender/descriptor.json', import.meta.url)))).toBe(v2.descriptorSha256);
  });

  test('first and second module bind technical/power interfaces without adding topology', () => {
    const before = engineeringIdentity(design);
    for (const module of design.modules.slice(0, 2)) {
      const installed = moduleAssets(design, module.id).find(a => a.type === 'cdu')!;
      const connections = connectionsForModule(design, module.id);
      const binding = getVisualKitBinding(installed, connections);
      expect(binding?.kind).toBe('cdu');
      expect(binding?.url).toBe('visuals/v3/cdu.glb');
      expect(binding?.dimensionsM).toEqual(installed.dimensionsM);
      expect(binding?.anchors).toEqual(template.logicalAnchors);
      expect(installed.ports.map(({id, medium, direction}) => ({id, medium, direction, positionM: [0, 0, 0]}))).toEqual(template.logicalAnchors);
      const routes = connections.filter(c => c.from === installed.id || c.to === installed.id);
      expect(routes.some(c => c.medium === 'technical')).toBe(true);
      expect(routes.some(c => c.medium === 'power')).toBe(true);
      expect(routes.some(c => c.medium === 'seawater')).toBe(false);
      for (const route of routes) close(route.from === installed.id ? route.routeM[0] : route.routeM.at(-1)!, installed.positionM);
    }
    expect(engineeringIdentity(design)).toBe(before);
  });

  const negativeCases: [string, Partial<Asset>][] = [
    ['unknown specification', {catalogId: 'cdu-custom'}],
    ['unknown version', {revision: '1.0.1'}],
    ['wrong role', {id: `${design.modules[0].id}/spare-cdu`}],
    ['wrong type', {type: 'exchanger'}],
    ['oversized envelope', {dimensionsM: [1.201, 2, 1.1]}],
    ['undersized envelope', {dimensionsM: [1.2, 1.99, 1.1]}],
    ['nonfinite placement', {positionM: [NaN, 3, -1.5]}],
    ['missing power interface', {ports: asset.ports.filter(p => p.id !== 'power-out')}],
    ['additional seawater interface', {ports: [...asset.ports, {id: 'seawater-in', medium: 'seawater', direction: 'in', capacity: 0.3, unit: 'm³/s'}]}],
    ['wrong coolant medium', {ports: asset.ports.map(p => p.medium === 'technical' ? {...p, medium: 'seawater'} : p)}],
    ['reversed direction', {ports: asset.ports.map(p => p.id === 'technical-in' ? {...p, direction: 'out'} : p)}],
    ['duplicate interface', {ports: asset.ports.map(p => p.id === 'technical-out' ? {...asset.ports[0]} : p)}],
  ];
  test.each(negativeCases)('rejects %s without stretching or admitting a near-match', (_name, patch) => {
    expect(getVisualKitBinding({...asset, ...patch})).toBeNull();
  });

  test('changed incoming and outgoing route endpoints, media and port IDs remain procedural', () => {
    const connections = connectionsForModule(design, design.modules[0].id);
    for (const direction of ['in', 'out']) {
      const index = connections.findIndex(c => (direction === 'in' ? c.to : c.from) === asset.id && c.medium === 'technical');
      for (const change of ['endpoint', 'medium', 'port']) {
        const changed = structuredClone(connections), route = changed[index];
        if (change === 'endpoint') (direction === 'in' ? route.routeM.at(-1)! : route.routeM[0])[0] += 0.01;
        if (change === 'medium') route.medium = 'seawater';
        if (change === 'port' && direction === 'in') route.toPort = 'power-in';
        if (change === 'port' && direction === 'out') route.fromPort = 'power-out';
        expect(getVisualKitBinding(asset, changed)).toBeNull();
      }
    }
  });

  test('shipping inventory and payload stay bounded without editable sources or dependencies', () => {
    expect(readdirSync(directory).sort()).toEqual(['cdu.glb', 'manifest.json']);
    expect(manifest.provenance.rights).toContain('no third-party');
    expect(manifest.authoring.blenderVersion).toBe('4.3.2');
    expect(manifest.authoring.gltfExporter).toBe('Khronos glTF Blender I/O v4.3.47');
    expect(manifest.authoring.externalAssets).toEqual([]);
    expect(manifest.authoring.guideShipping).toBe(false);
    expect(template.bytes).toBeLessThanOrEqual(1024 * 1024);
    expect(template.metrics.triangles).toBeLessThanOrEqual(12_000);
    expect(v2.templates.reduce((total, t) => total + t.bytes, template.bytes)).toBeLessThanOrEqual(6 * 1024 * 1024);
    close(manifest.orientationProof.meterStartM, [0, 0, 0]);
    close(manifest.orientationProof.meterEndM, [1, 0, 0]);
    close(manifest.orientationProof.asymmetricM, [0.23, 0.41, -0.17]);
    close(manifest.orientationProof.asymmetricSizeM, [0.13, 0.07, 0.03]);
  });

  test('actual GLB passes Khronos and Three with finite unit normals, exact bounds, root, roles and anchors', async () => {
    const bytes = readFileSync(new URL(template.file, directory));
    expect(bytes.length).toBe(template.bytes);
    expect(hash(bytes)).toBe(template.sha256);
    const result = await validateBytes(new Uint8Array(bytes), {uri: template.file, maxIssues: 100});
    expect(result.issues.numErrors).toBe(0);
    expect(result.issues.numWarnings).toBe(0);
    expect(result.issues.numInfos).toBe(0);
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
    const roles: string[] = [];
    let meshes = 0, triangles = 0, vertices = 0;
    loaded.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      meshes++;
      expect(object.parent).toBe(root);
      expect(object.material).toBeInstanceOf(MeshStandardMaterial);
      const material = object.material as MeshStandardMaterial;
      roles.push(material.name);
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.side).toBe(FrontSide);
      const role = descriptor.materialRoles.find((r: {name: string}) => r.name === material.name);
      expect(material.metalness).toBeCloseTo(role.metalness, 6);
      expect(material.roughness).toBeCloseTo(role.roughness, 6);
      const geometry = object.geometry, normal = geometry.getAttribute('normal'), position = geometry.getAttribute('position');
      expect(normal.count).toBe(position.count);
      for (const attribute of Object.values(geometry.attributes) as BufferAttribute[]) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < normal.count; i++) expect(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1)).toBeLessThanOrEqual(manifest.normalTolerance);
      close(object.matrixWorld.elements, new Matrix4().elements);
      triangles += (geometry.index?.count ?? position.count) / 3;
      vertices += position.count;
    });
    expect(meshes).toBe(4);
    expect(roles.sort()).toEqual(['graphite', 'insert', 'paint', 'silver']);
    expect(triangles).toBe(template.metrics.triangles);
    expect(vertices).toBe(template.metrics.vertices);
    for (const anchor of template.logicalAnchors) {
      const node = root.getObjectByName('anchor_' + anchor.id)!;
      expect(node).toBeDefined();
      expect(node.parent).toBe(root);
      close(node.getWorldPosition(new Vector3()).toArray(), anchor.positionM);
      expect(node.userData.medium).toBe(anchor.medium);
      expect(node.userData.direction).toBe(anchor.direction);
    }
    // The upper-right unlit inset is on the front (-Z), and technical service
    // fittings remain on the rear (+Z). Test exported vertices, not metadata alone.
    const insert = loaded.scene.getObjectByName('cdu_insert') as Mesh;
    const positions = insert.geometry.getAttribute('position');
    const inset = Array.from({length: positions.count}, (_, i) => new Vector3().fromBufferAttribute(positions, i)).filter(p => p.z < -0.548 && p.y > 0.56);
    expect(inset.length).toBeGreaterThan(20);
    expect(inset.every(p => p.x > 0.16 && p.y < 0.75)).toBe(true);
    const silver = loaded.scene.getObjectByName('cdu_silver') as Mesh;
    const metal = silver.geometry.getAttribute('position');
    const rear = Array.from({length: metal.count}, (_, i) => new Vector3().fromBufferAttribute(metal, i)).filter(p => p.z > 0.535);
    expect(rear.length).toBeGreaterThan(100);
    expect(rear.every(p => p.y > 0.36 && p.y < 0.56)).toBe(true);
    loaded.scene.traverse(object => {
      if (object instanceof Mesh) { object.geometry.dispose(); (object.material as MeshStandardMaterial).dispose(); }
    });
  });
});

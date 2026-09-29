import { Box3, Group, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import { KIT_TOLERANCE_M, isVisualKitKind, type VisualKitKind } from './kitContract';

export interface KitFile {
  kind: VisualKitKind;
  url: string;
  sha256: string;
  bytes: number;
  dimensionsM: readonly number[];
}
export interface KitTemplate {
  scene: Group;
  geometries: Set<BufferGeometry>;
  materials: Set<MeshStandardMaterial>;
}
export interface KitInstance {
  scene: Group;
  materials: Map<MeshStandardMaterial, string>;
  disposed: boolean;
  dispose: () => void;
}

/** No URL normalization of geometry: one exported meter is one runtime meter. */
export function validateKitScene(scene: Group, file: KitFile): KitTemplate {
  scene.updateMatrixWorld(true);
  const geometries = new Set<BufferGeometry>(), materials = new Set<MeshStandardMaterial>();
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry: BufferGeometry = object.geometry;
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
    if (!position || !normal || position.count !== normal.count) throw Error('Incomplete authored surface.');
    for (const attribute of Object.values(geometry.attributes)) {
      if (Array.from(attribute.array).some(value => !Number.isFinite(value))) throw Error('Non-finite authored geometry.');
    }
    geometries.add(geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MeshStandardMaterial) || material.transparent || material.opacity !== 1)
        throw Error('Unsupported authored material.');
      // This kit is intentionally texture-free. Reject undeclared image dependencies.
      if (material.map || material.normalMap || material.roughnessMap || material.metalnessMap || material.emissiveMap)
        throw Error('Unexpected authored texture.');
      materials.add(material);
    }
  });
  if (!geometries.size || geometries.size > 8 || materials.size > 6) throw Error('Unexpected authored inventory.');
  const bounds = new Box3().setFromObject(scene), tolerance = KIT_TOLERANCE_M;
  for (let axis = 0; axis < 3; axis++) {
    if (!Number.isFinite(bounds.min.getComponent(axis)) || bounds.min.getComponent(axis) < -file.dimensionsM[axis] / 2 - tolerance || bounds.max.getComponent(axis) > file.dimensionsM[axis] / 2 + tolerance)
      throw Error('Authored geometry exceeds its canonical envelope.');
  }
  if (!scene.position.equals(new Vector3()) || !scene.scale.equals(new Vector3(1, 1, 1))) throw Error('Noncanonical authored root.');
  return { scene, geometries, materials };
}

function disposeTemplate(template: KitTemplate) {
  template.geometries.forEach(geometry => geometry.dispose());
  template.materials.forEach(material => material.dispose());
}

export async function loadKit(file: KitFile, signal: AbortSignal): Promise<KitTemplate> {
  const response = await fetch(new URL(file.url, new URL(import.meta.env.BASE_URL, document.baseURI)), { signal });
  if (!response.ok) throw Error(`Equipment detail HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== file.bytes) throw Error('Equipment detail size mismatch.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== file.sha256) throw Error('Equipment detail integrity mismatch.');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  try {
    return validateKitScene(gltf.scene, file);
  } catch (error) {
    // Even a rejected parse owns its allocations. No image data exists in this kit.
    gltf.scene.traverse(object => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      }
    });
    throw error;
  }
}

/** One bounded three-template cache per scene owner. Geometry is immutable and shared;
 * instance materials are private. Retirement waits for all consumers, including
 * StrictMode's immediate effect replay, and handles in-flight completion. */
export class VisualKitCache {
  private entries = new Map<VisualKitKind, { sha256: string; promise: Promise<KitTemplate>; template?: KitTemplate }>();
  private instances = new Set<KitInstance>();
  private owners = 0;
  private retired = false;
  private controller = new AbortController();
  constructor(private loader = loadKit) {}

  retain() {
    if (this.retired) throw Error('Retired visual cache.');
    this.owners++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.owners--;
      queueMicrotask(() => this.collect());
    };
  }
  private collect() {
    if (this.owners || this.instances.size || this.retired) return;
    this.retired = true;
    this.controller.abort();
    this.entries.forEach(entry => { if (entry.template) disposeTemplate(entry.template); });
    this.entries.clear();
  }
  load(file: KitFile) {
    if (this.retired) return Promise.reject(Error('Retired visual cache.'));
    if (!isVisualKitKind(file.kind)) return Promise.reject(Error('Unsupported visual kit kind.'));
    const existing = this.entries.get(file.kind);
    if (existing) return existing.sha256 === file.sha256 ? existing.promise : Promise.reject(Error('Visual kit kind already owns different content.'));
    const entry: { sha256: string; promise: Promise<KitTemplate>; template?: KitTemplate } = {
      sha256: file.sha256,
      promise: this.loader(file, this.controller.signal).then(template => {
        if (this.retired) { disposeTemplate(template); throw Error('Retired visual load.'); }
        entry.template = template;
        return template;
      }),
    };
    this.entries.set(file.kind, entry);
    return entry.promise;
  }
  instantiate(template: KitTemplate): KitInstance {
    if (this.retired) throw Error('Retired visual cache.');
    const scene = template.scene.clone(true);
    const clones = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    const materials = new Map<MeshStandardMaterial, string>();
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const clone = (original: MeshStandardMaterial) => {
        let material = clones.get(original);
        if (!material) {
          material = original.clone();
          clones.set(original, material);
          materials.set(material, `#${original.color.getHexString()}`);
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? (object.material as MeshStandardMaterial[]).map(clone)
        : clone(object.material as MeshStandardMaterial);
      object.onAfterRender = renderer => { object.userData.renderedFrame = renderer.info.render.frame; };
    });
    const instance: KitInstance = { scene, materials, disposed: false, dispose: () => {
      if (!this.instances.delete(instance)) return;
      instance.disposed = true;
      materials.forEach((_color, material) => material.dispose());
      queueMicrotask(() => this.collect());
    } };
    this.instances.add(instance);
    return instance;
  }
  inventory() {
    let geometries = 0, materials = 0;
    this.entries.forEach(entry => { geometries += entry.template?.geometries.size ?? 0; materials += entry.template?.materials.size ?? 0; });
    this.instances.forEach(instance => { materials += instance.materials.size; });
    return { geometries, materials, textures: 0, instances: this.instances.size };
  }
}

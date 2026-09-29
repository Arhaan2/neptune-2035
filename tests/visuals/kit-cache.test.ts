import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { VisualKitCache, validateKitScene, type KitFile, type KitTemplate } from '../../src/scene/visuals/kitCache';
import { stateColor } from '../../src/scene/visuals/materials';

const pump: KitFile = {
  kind: 'pump', url: 'visuals/v2/pump.glb', sha256: 'pump-content', bytes: 100,
  dimensionsM: [1.2, 1.2, 0.8],
};
const cdu: KitFile = {
  kind: 'cdu', url: 'visuals/v3/cdu.glb', sha256: 'cdu-content', bytes: 300,
  dimensionsM: [1.2, 2, 1.1],
};
const exchanger: KitFile = {
  kind: 'exchanger', url: 'visuals/v2/exchanger.glb', sha256: 'exchanger-content', bytes: 200,
  dimensionsM: [2, 2.2, 1.4],
};

function template(file = pump) {
  const geometry = new BoxGeometry(...file.dimensionsM as [number, number, number]);
  const paint = new MeshStandardMaterial({ name: 'paint', color: '#E8EEF0' });
  const silver = new MeshStandardMaterial({ name: 'silver', color: '#AEBBC4', metalness: 1 });
  const scene = new Group();
  // Reused geometry and a reused material across two meshes exercise intra-instance
  // deduplication, in addition to sharing across independent equipment instances.
  scene.add(new Mesh(geometry, [paint, silver]), new Mesh(geometry, paint));
  const geometryDisposal = vi.spyOn(geometry, 'dispose');
  const paintDisposal = vi.spyOn(paint, 'dispose');
  const silverDisposal = vi.spyOn(silver, 'dispose');
  return { value: validateKitScene(scene, file), geometry, paint, silver, geometryDisposal, paintDisposal, silverDisposal };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Retirement is intentionally a microtask, matching immediate StrictMode replay.
const collect = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe('Visual V2/V3 cache ownership', () => {
  it('deduplicates in-flight loads and shares immutable geometry with private per-instance state materials', async () => {
    const source = template(), pending = deferred<KitTemplate>();
    const loader = vi.fn((_file: KitFile, _signal: AbortSignal) => pending.promise);
    const cache = new VisualKitCache(loader), release = cache.retain();
    const firstLoad = cache.load(pump), peerLoad = cache.load({ ...pump });
    expect(firstLoad).toBe(peerLoad);
    expect(loader).toHaveBeenCalledTimes(1);
    pending.resolve(source.value);
    const loaded = await firstLoad;
    const first = cache.instantiate(loaded), peer = cache.instantiate(loaded);
    expect(first.disposed).toBe(false);
    expect(peer.disposed).toBe(false);
    const firstMeshes = first.scene.children as Mesh[], peerMeshes = peer.scene.children as Mesh[];
    expect(first.scene).not.toBe(peer.scene);
    expect(firstMeshes[0].geometry).toBe(source.geometry);
    expect(peerMeshes[0].geometry).toBe(source.geometry);
    const firstMaterials = firstMeshes[0].material as MeshStandardMaterial[];
    const peerMaterials = peerMeshes[0].material as MeshStandardMaterial[];
    expect(firstMeshes[1].material).toBe(firstMaterials[0]);
    expect(peerMeshes[1].material).toBe(peerMaterials[0]);
    expect(firstMaterials[0]).not.toBe(peerMaterials[0]);
    expect(firstMaterials[0]).not.toBe(source.paint);
    firstMaterials[0].color.set(stateColor('failed', '#E8EEF0'));
    expect(firstMaterials[0].color.getHexString()).not.toBe(peerMaterials[0].color.getHexString());
    expect(peerMaterials[0].color.getHexString()).toBe(source.paint.color.getHexString());
    expect(cache.inventory()).toEqual({ geometries: 1, materials: 6, textures: 0, instances: 2 });

    const privateDisposals = firstMaterials.map(material => vi.spyOn(material, 'dispose'));
    const validityAtDisposal: boolean[] = [];
    firstMaterials.forEach(material => material.addEventListener('dispose', () => validityAtDisposal.push(first.disposed)));
    first.dispose();
    expect(first.disposed).toBe(true);
    expect(peer.disposed).toBe(false);
    expect(validityAtDisposal).toEqual([true, true]);
    first.dispose();
    await collect();
    privateDisposals.forEach(disposal => expect(disposal).toHaveBeenCalledTimes(1));
    expect(source.geometryDisposal).not.toHaveBeenCalled();
    expect(source.paintDisposal).not.toHaveBeenCalled();
    expect(cache.inventory()).toEqual({ geometries: 1, materials: 4, textures: 0, instances: 1 });
    peer.dispose();
    release();
    await collect();
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
    expect(source.paintDisposal).toHaveBeenCalledTimes(1);
    expect(source.silverDisposal).toHaveBeenCalledTimes(1);
    expect(cache.inventory()).toEqual({ geometries: 0, materials: 0, textures: 0, instances: 0 });
  });

  it('retains a loaded template through immediate StrictMode owner cleanup and replay', async () => {
    const source = template();
    const loader = vi.fn(async (_file: KitFile, _signal: AbortSignal) => source.value);
    const cache = new VisualKitCache(loader);
    const firstRelease = cache.retain();
    await cache.load(pump);
    firstRelease();
    firstRelease();
    const replayRelease = cache.retain();
    await collect();
    expect(loader.mock.calls[0][1].aborted).toBe(false);
    expect(source.geometryDisposal).not.toHaveBeenCalled();
    expect(await cache.load(pump)).toBe(source.value);
    expect(loader).toHaveBeenCalledTimes(1);
    replayRelease();
    await collect();
    expect(loader.mock.calls[0][1].aborted).toBe(true);
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
    expect(() => cache.retain()).toThrow('Retired visual cache');
    await expect(cache.load(pump)).rejects.toThrow('Retired visual cache');
  });

  it('retains an in-flight load across immediate owner replay without aborting or reloading', async () => {
    const source = template(), pending = deferred<KitTemplate>();
    const loader = vi.fn((_file: KitFile, _signal: AbortSignal) => pending.promise);
    const cache = new VisualKitCache(loader), release = cache.retain();
    const loading = cache.load(pump);
    release();
    const replayRelease = cache.retain();
    await collect();
    expect(loader.mock.calls[0][1].aborted).toBe(false);
    pending.resolve(source.value);
    expect(await loading).toBe(source.value);
    expect(await cache.load(pump)).toBe(source.value);
    expect(loader).toHaveBeenCalledTimes(1);
    replayRelease();
    await collect();
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
  });

  it('does not dispose shared geometry while an instance still consumes it after owner release', async () => {
    const source = template();
    const cache = new VisualKitCache(async () => source.value), release = cache.retain();
    const instance = cache.instantiate(await cache.load(pump));
    const privateDisposals = [...instance.materials.keys()].map(material => vi.spyOn(material, 'dispose'));
    release();
    await collect();
    expect(source.geometryDisposal).not.toHaveBeenCalled();
    expect(cache.inventory()).toEqual({ geometries: 1, materials: 4, textures: 0, instances: 1 });
    instance.dispose();
    await collect();
    privateDisposals.forEach(disposal => expect(disposal).toHaveBeenCalledTimes(1));
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
    expect(source.paintDisposal).toHaveBeenCalledTimes(1);
  });

  it('aborts retirement and disposes late parse allocations when a loader cannot cancel completion', async () => {
    const source = template(), pending = deferred<KitTemplate>();
    const loader = vi.fn((_file: KitFile, _signal: AbortSignal) => pending.promise);
    const cache = new VisualKitCache(loader), release = cache.retain();
    const loading = cache.load(pump);
    const rejection = expect(loading).rejects.toThrow('Retired visual load');
    release();
    await collect();
    expect(loader.mock.calls[0][1].aborted).toBe(true);
    pending.resolve(source.value);
    await rejection;
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
    expect(source.paintDisposal).toHaveBeenCalledTimes(1);
    expect(source.silverDisposal).toHaveBeenCalledTimes(1);
    expect(cache.inventory()).toEqual({ geometries: 0, materials: 0, textures: 0, instances: 0 });
  });

  it('keeps independent owners alive until the final idempotent release', async () => {
    const source = template();
    const cache = new VisualKitCache(async () => source.value);
    const firstRelease = cache.retain(), secondRelease = cache.retain();
    await cache.load(pump);
    firstRelease();
    firstRelease();
    await collect();
    expect(source.geometryDisposal).not.toHaveBeenCalled();
    expect(await cache.load(pump)).toBe(source.value);
    secondRelease();
    await collect();
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
  });

  it('bounds the cache to one identity for each of the three declared templates', async () => {
    const pumpSource = template(), exchangerSource = template(exchanger), cduSource = template(cdu);
    const sources = { pump: pumpSource, exchanger: exchangerSource, cdu: cduSource };
    const loader = vi.fn(async (file: KitFile, _signal: AbortSignal) => sources[file.kind].value);
    const cache = new VisualKitCache(loader), release = cache.retain();
    await Promise.all([cache.load(pump), cache.load(exchanger), cache.load(cdu)]);
    await expect(cache.load({ ...pump, sha256: 'unauthored-fourth-content' })).rejects.toThrow('Visual kit kind already owns different content');
    expect(loader).toHaveBeenCalledTimes(3);
    expect(await cache.load(pump)).toBe(pumpSource.value);
    expect(await cache.load(exchanger)).toBe(exchangerSource.value);
    expect(await cache.load(cdu)).toBe(cduSource.value);
    expect(cache.inventory()).toEqual({ geometries: 3, materials: 6, textures: 0, instances: 0 });
    release();
    await collect();
    Object.values(sources).forEach(source => expect(source.geometryDisposal).toHaveBeenCalledTimes(1));
  });

  it('reserves a kind on its first load so changed content cannot displace a mounted template', async () => {
    const source = template(cdu);
    const loader = vi.fn(async (_file: KitFile, _signal: AbortSignal) => source.value);
    const cache = new VisualKitCache(loader), release = cache.retain();
    const instance = cache.instantiate(await cache.load(cdu));
    await expect(cache.load({ ...cdu, sha256: 'different-cdu' })).rejects.toThrow('already owns different content');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(instance.disposed).toBe(false);
    expect(source.geometryDisposal).not.toHaveBeenCalled();
    instance.dispose(); release(); await collect();
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
  });

  it('isolates a failed load from the other template and does not repeatedly allocate failed retries', async () => {
    const source = template(exchanger);
    const loader = vi.fn(async (file: KitFile, _signal: AbortSignal) => {
      if (file.kind === 'pump') throw Error('Equipment detail integrity mismatch.');
      return source.value;
    });
    const cache = new VisualKitCache(loader), release = cache.retain();
    const failed = cache.load(pump);
    await expect(failed).rejects.toThrow('integrity mismatch');
    expect(cache.load(pump)).toBe(failed);
    await expect(cache.load(pump)).rejects.toThrow('integrity mismatch');
    const instance = cache.instantiate(await cache.load(exchanger));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(cache.inventory()).toEqual({ geometries: 1, materials: 4, textures: 0, instances: 1 });
    instance.dispose();
    release();
    await collect();
    expect(source.geometryDisposal).toHaveBeenCalledTimes(1);
  });

  it('keeps healthy pump and exchanger owners while CDU loads and disposes its late completion after unmount', async () => {
    const sources = { pump: template(pump), exchanger: template(exchanger), cdu: template(cdu) };
    const pending = deferred<KitTemplate>();
    const loader = vi.fn((file: KitFile, _signal: AbortSignal) => file.kind === 'cdu' ? pending.promise : Promise.resolve(sources[file.kind].value));
    const cache = new VisualKitCache(loader), release = cache.retain();
    const instances = await Promise.all([pump, exchanger].map(async file => cache.instantiate(await cache.load(file))));
    const late = cache.load(cdu), rejection = expect(late).rejects.toThrow('Retired visual load');
    expect(cache.inventory()).toEqual({ geometries: 2, materials: 8, textures: 0, instances: 2 });
    release(); await collect();
    expect(loader.mock.calls.every(call => !call[1].aborted)).toBe(true);
    instances.forEach(instance => instance.dispose()); await collect();
    expect(loader.mock.calls.every(call => call[1].aborted)).toBe(true);
    pending.resolve(sources.cdu.value); await rejection;
    Object.values(sources).forEach(source => expect(source.geometryDisposal).toHaveBeenCalledTimes(1));
    expect(cache.inventory()).toEqual({ geometries: 0, materials: 0, textures: 0, instances: 0 });
  });

  it.each([pump, exchanger, cdu])('isolates failed $kind content from both healthy template families', async failedFile => {
    const sources = { pump: template(pump), exchanger: template(exchanger), cdu: template(cdu) };
    const loader = vi.fn(async (file: KitFile) => {
      if (file.kind === failedFile.kind) throw Error('Equipment detail integrity mismatch.');
      return sources[file.kind].value;
    });
    const cache = new VisualKitCache(loader), release = cache.retain();
    await expect(cache.load(failedFile)).rejects.toThrow('integrity mismatch');
    const instances = await Promise.all([pump, exchanger, cdu].filter(file => file.kind !== failedFile.kind).map(async file => cache.instantiate(await cache.load(file))));
    expect(cache.inventory()).toEqual({ geometries: 2, materials: 8, textures: 0, instances: 2 });
    instances.forEach(instance => instance.dispose()); release(); await collect();
    Object.entries(sources).filter(([kind]) => kind !== failedFile.kind).forEach(([,source]) => expect(source.geometryDisposal).toHaveBeenCalledTimes(1));
    // This fixture was never returned by the failed loader; its owner cleans it up.
    sources[failedFile.kind].value.geometries.forEach(geometry => geometry.dispose());
    sources[failedFile.kind].value.materials.forEach(material => material.dispose());
  });

  it('returns to the exact warmed allocation inventory over twenty equipment cycles', async () => {
    const sources = { pump: template(pump), exchanger: template(exchanger), cdu: template(cdu) };
    const loader = vi.fn(async (file: KitFile, _signal: AbortSignal) => sources[file.kind].value);
    const cache = new VisualKitCache(loader), release = cache.retain();
    const loaded = await Promise.all([cache.load(pump), cache.load(exchanger), cache.load(cdu)]);
    const warm = { geometries: 3, materials: 6, textures: 0, instances: 0 };
    expect(cache.inventory()).toEqual(warm);
    for (let cycle = 0; cycle < 20; cycle++) {
      const instances = loaded.map(value => cache.instantiate(value));
      const instance = instances[cycle % instances.length];
      expect(instance.disposed).toBe(false);
      const privateDisposals = [...instance.materials.keys()].map(material => vi.spyOn(material, 'dispose'));
      expect(cache.inventory()).toEqual({ geometries: 3, materials: 12, textures: 0, instances: 3 });
      instances.forEach(value => value.dispose());
      expect(instance.disposed).toBe(true);
      await collect();
      privateDisposals.forEach(disposal => expect(disposal).toHaveBeenCalledTimes(1));
      expect(cache.inventory()).toEqual(warm);
      Object.values(sources).forEach(source => expect(source.geometryDisposal).not.toHaveBeenCalled());
    }
    expect(loader).toHaveBeenCalledTimes(3);
    release();
    await collect();
    Object.values(sources).forEach(source => expect(source.geometryDisposal).toHaveBeenCalledTimes(1));
  });
});

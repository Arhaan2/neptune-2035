import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three';
import { describe, expect, test, vi } from 'vitest';
import { visualKitDiagnostic } from '../../src/scene/visuals/AuthoredEquipment';
import { VisualKitCache } from '../../src/scene/visuals/kitCache';

function fixture() {
  const scene = new Scene(), owner = new Group(), assembly = new Group(), instance = new Group();
  const material = new MeshStandardMaterial({ color: '#ffffff' }); material.name = 'paint';
  const mesh = new Mesh(new BoxGeometry(2, 2, 2), material);
  owner.userData.visualKitAsset = { assetId: 'pump-duty', kind: 'pump', status: 'ready', selected: false, operatingState: 'running' };
  instance.add(mesh); assembly.add(instance); owner.add(assembly); scene.add(owner);
  const camera = new PerspectiveCamera(); camera.position.set(0, 0, 5);
  const cache = new VisualKitCache();
  const observe = (frame = 1) => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    mesh.userData.renderedFrame = frame;
    return visualKitDiagnostic(scene, camera, cache, 'module-01', frame).assets[0];
  };
  return { scene, owner, assembly, instance, mesh, material, camera, observe };
}

describe('authored diagnostic surface-point lifetime', () => {
  test('stationary frames reuse the surface hit while current state and rendered visibility remain live', () => {
    const f = fixture(), cast = vi.spyOn(f.mesh, 'raycast');
    expect(f.observe().childWorldPoint).toEqual([0, 0, 1]);
    for (let frame = 2; frame <= 100; frame++) expect(f.observe(frame).renderedMeshes).toBe(1);
    expect(cast).toHaveBeenCalledTimes(1);
    f.owner.userData.visualKitAsset.selected = true;
    f.owner.userData.visualKitAsset.operatingState = 'failed'; f.material.color.set('#ff0000');
    const current = f.observe(101);
    expect(current).toMatchObject({ selected: true, operatingState: 'failed', materialColor: '#ff0000', renderedMeshes: 1 });
    current.childWorldPoint![0] = 900;
    expect(f.observe(102).childWorldPoint).toEqual([0, 0, 1]);
    expect(cast).toHaveBeenCalledTimes(1);
  });

  test('camera motion and assembly translation/rotation/scale recompute actual authored surface hits', () => {
    const f = fixture(), cast = vi.spyOn(f.mesh, 'raycast');
    f.observe(); f.camera.position.x = 2;
    expect(f.observe().childWorldPoint![0]).toBeCloseTo(0.4);
    f.assembly.position.set(3, 3, 0);
    f.observe().childWorldPoint!.forEach((value, axis) => expect(value).toBeCloseTo([2.8, 2.4, 1][axis], 10));
    f.assembly.rotation.y = Math.PI / 4; f.observe();
    f.assembly.scale.setScalar(0.5); f.observe();
    expect(cast).toHaveBeenCalledTimes(5);
  });

  test('replacement and fallback invalidate the hit without retaining or confusing an old instance', () => {
    const f = fixture(); f.observe();
    const next = new Group(), replacement = new Mesh(new BoxGeometry(1, 1, 1), f.material);
    next.add(replacement); f.assembly.remove(f.instance); f.assembly.add(next);
    const cast = vi.spyOn(replacement, 'raycast');
    expect(f.observe().childWorldPoint).toEqual([0, 0, 0.5]);
    f.owner.userData.visualKitAsset.status = 'loading';
    expect(f.observe().childWorldPoint).toBeUndefined();
    f.owner.userData.visualKitAsset.status = 'ready';
    expect(f.observe().childWorldPoint).toEqual([0, 0, 0.5]);
    expect(cast).toHaveBeenCalledTimes(2);
  });
});

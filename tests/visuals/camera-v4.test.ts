import { describe, expect, test } from 'vitest';
import { Box3, PerspectiveCamera, Ray, Vector3 } from 'three';
import { buildDesign, DEFAULT_CONFIG, moduleAssets, resolveAsset } from '../../src/twin/assets/design';
import { coolingViewDirection, equipmentFrame } from '../../src/scene/visuals/equipmentFraming';
import { presentedPosition } from '../../src/scene/twinGeometry';
import type { Asset } from '../../src/twin/types';

const design = buildDesign(DEFAULT_CONFIG);
function expectBoundsFit(assets: Asset[], exploded: boolean, aspect: number, direction: [number, number, number]) {
  const pose = equipmentFrame(assets, exploded, aspect, direction);
  const camera = new PerspectiveCamera(46, aspect, 0.03, 10000);
  camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
  for (const asset of assets) {
    const center = presentedPosition(asset, exploded);
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
      const projected = new Vector3(center[0] + x * asset.dimensionsM[0], center[1] + y * asset.dimensionsM[1], center[2] + z * asset.dimensionsM[2]).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(0.85);
      expect(Math.abs(projected.y)).toBeLessThan(0.85);
      expect(Math.abs(projected.z)).toBeLessThan(1);
    }
  }
  return pose;
}

describe('Visual V4 canvas framing and exploded cabinet sightline', () => {
  for (const aspect of [280 / 400, 350 / 260, 700 / 480, 950 / 460, 1380 / 520]) {
    test(`campus, plan and cooling fit the occupied canvas at aspect ${aspect}`, () => {
      const before = JSON.stringify(design);
      for (const exploded of [false, true]) {
        const campus = design.assets.filter(asset => ['platform', 'hull', 'module'].includes(asset.type));
        expectBoundsFit(campus, exploded, aspect, [0.55, 0.28, 0.8]);
        expectBoundsFit(campus, exploded, aspect, [0, 1, 0.0001]);
        for (const module of design.modules.slice(0, 2)) {
          const equipment = moduleAssets(design, module.id).filter(asset => ['pump', 'exchanger', 'cdu'].includes(asset.type));
          const pose = expectBoundsFit(equipment, exploded, aspect, coolingViewDirection(exploded));
          if (exploded) {
            // The raised floor/opaque aisle accent cannot cross a cabinet ray
            // when both camera and all cooling equipment remain below it.
            const shell = resolveAsset(design, module.id)!;
            const floorY = presentedPosition(shell, true)[1] - shell.dimensionsM[1] / 2;
            expect(pose.position.y).toBeLessThan(floorY);
            for (const asset of equipment)
              expect(presentedPosition(asset, true)[1] + asset.dimensionsM[1] / 2).toBeLessThan(floorY);
          }
        }
      }
      expect(JSON.stringify(design)).toBe(before);
    });
  }

  test('reproduces V3 opaque aisle crossing the CDU front and clears it by camera composition alone', () => {
    const module = design.modules[0], shell = resolveAsset(design, module.id)!;
    const equipment = moduleAssets(design, module.id).filter(asset => ['pump', 'exchanger', 'cdu'].includes(asset.type));
    const cdu = equipment.find(asset => asset.type === 'cdu')!;
    const center = new Vector3(...presentedPosition(cdu, true));
    const moduleCenter = new Vector3(...presentedPosition(shell, true));
    const aisleCenter = moduleCenter.add(new Vector3(-1.5, -shell.dimensionsM[1] / 2 + 0.065, 0));
    // The actual unchanged opaque 19 m × 0.06 m aisle accent plane.
    const aisle = new Box3(aisleCenter.clone().sub(new Vector3(9.5, 0.00001, 0.03)), aisleCenter.clone().add(new Vector3(9.5, 0.00001, 0.03)));
    const countBlocked = (direction: [number, number, number]) => {
      const { position } = equipmentFrame(equipment, true, 908 / 400, direction);
      let blocked = 0;
      for (let x = 0; x <= 40; x++) for (let y = 0; y <= 40; y++) {
        const target = center.clone().add(new Vector3((x / 40 - 0.5) * cdu.dimensionsM[0], (y / 40 - 0.5) * cdu.dimensionsM[1], -cdu.dimensionsM[2] / 2));
        const hit = new Ray(position, target.clone().sub(position).normalize()).intersectBox(aisle, new Vector3());
        if (hit && hit.distanceTo(position) < target.distanceTo(position)) blocked++;
      }
      return blocked;
    };
    expect(countBlocked([-0.76, 0.46, -0.64])).toBeGreaterThan(0);
    expect(countBlocked(coolingViewDirection(true))).toBe(0);
  });

  test('rejects unusable hidden or invalid canvas aspects before producing a pose', () => {
    const asset = design.assets[0];
    for (const aspect of [0, -1, NaN, Infinity])
      expect(() => equipmentFrame([asset], false, aspect, [1, 1, 1])).toThrow(RangeError);
    expect(() => equipmentFrame([], false, 1, [1, 1, 1])).toThrow(RangeError);
  });
});

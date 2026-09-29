import { describe, expect, test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { buildDesign, DEFAULT_CONFIG, moduleAssets } from '../../src/twin/assets/design';
import { equipmentFrame } from '../../src/scene/visuals/equipmentFraming';
import { presentedPosition } from '../../src/scene/twinGeometry';

const design = buildDesign(DEFAULT_CONFIG);

describe('Visual V3 authoritative equipment framing', () => {
  for (const aspect of [390 / 350, 700 / 420]) for (const exploded of [false, true]) {
    test(`fits all cooling bounds at aspect ${aspect}, exploded ${exploded}`, () => {
      for (const module of design.modules.slice(0, 2)) {
        const equipment = moduleAssets(design, module.id).filter(asset => ['pump', 'exchanger', 'cdu'].includes(asset.type));
        const before = JSON.stringify(equipment);
        for (const assets of [equipment, equipment.filter(asset => asset.type === 'cdu')]) {
          const pose = equipmentFrame(assets, exploded, aspect, [-0.76, 0.46, -0.64]);
          const camera = new PerspectiveCamera(46, aspect, 0.03, 10000);
          camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
          for (const asset of assets) {
            const center = presentedPosition(asset, exploded);
            for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
              const point = new Vector3(center[0] + x * asset.dimensionsM[0], center[1] + y * asset.dimensionsM[1], center[2] + z * asset.dimensionsM[2]).project(camera);
              expect(Math.abs(point.x)).toBeLessThan(0.85);
              expect(Math.abs(point.y)).toBeLessThan(0.85);
              expect(point.z).toBeLessThan(1);
              expect(point.z).toBeGreaterThan(-1);
            }
          }
        }
        expect(JSON.stringify(equipment)).toBe(before);
      }
    });
  }
});

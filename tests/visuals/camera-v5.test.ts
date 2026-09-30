import { describe, expect, test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { buildDesign, DEFAULT_CONFIG, resolveAsset } from '../../src/twin/assets/design';
import { createCameraFlight, presentationFrame, presentationRequestKey, PresentationSettling, sampleCameraFlight, type PresentationCameraRequest } from '../../src/scene/presentationCamera';
import { presentedPosition } from '../../src/scene/twinGeometry';

const design = buildDesign(DEFAULT_CONFIG);
const request = (shot: PresentationCameraRequest['shot'], selectedId = design.modules[0].id): PresentationCameraRequest => ({
  token: 'request-1', sourceKey: 'run-1:evidence-1', stepId: 'evidence-step-1', shot, selectedId, timeS: 16,
  transitionMs: 2200, authoredKind: null,
});

describe('Visual V5 directed camera', () => {
  test('fits full evaluated campus and actual equipment to both mobile and wide occupied canvases', () => {
    const before = JSON.stringify(design);
    for (const aspect of [280 / 400, 350 / 260, 950 / 460, 1380 / 520]) {
      for (const shot of ['campus', 'summary', 'equipment'] as const) {
        const selectedId = shot === 'equipment' ? `${design.modules[0].id}/cdu` : design.modules[0].id;
        const pose = presentationFrame(design, request(shot, selectedId), true, aspect);
        const camera = new PerspectiveCamera(46, aspect, 0.03, 10000);
        camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
        const subjects = shot === 'equipment' ? [resolveAsset(design, selectedId)!] : design.assets.filter(asset => ['platform', 'hull', 'module'].includes(asset.type));
        for (const asset of subjects) {
          const center = presentedPosition(asset, true);
          for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
            const projected = new Vector3(center[0] + x * asset.dimensionsM[0], center[1] + y * asset.dimensionsM[1], center[2] + z * asset.dimensionsM[2]).project(camera);
            expect(Math.abs(projected.x)).toBeLessThan(0.85);
            expect(Math.abs(projected.y)).toBeLessThan(0.85);
          }
        }
      }
    }
    expect(JSON.stringify(design)).toBe(before);
  });

  test('uses elapsed time with exact endpoints and a safe outside orbit for opposite-side views', () => {
    const from = { position: new Vector3(20, 10, 0), target: new Vector3() };
    const to = { position: new Vector3(-20, 10, 0), target: new Vector3() };
    const flight = createCameraFlight(from, to, 2000);
    expect(sampleCameraFlight(flight, 0)).toEqual(from);
    expect(sampleCameraFlight(flight, 2)).toEqual(to);
    expect(sampleCameraFlight(flight, 40)).toEqual(to);
    const midpoint = sampleCameraFlight(flight, 1);
    expect(midpoint.position.distanceTo(midpoint.target)).toBeCloseTo(Math.sqrt(500));
    expect(midpoint.position.y).toBeCloseTo(10);
    for (const hz of [20, 60, 120]) {
      let elapsed = 0;
      for (let frame = 0; frame < hz; frame++) elapsed += 1 / hz;
      expect(sampleCameraFlight(flight, elapsed).position.distanceTo(midpoint.position)).toBeLessThan(1e-10);
    }
    expect(sampleCameraFlight(createCameraFlight(from, to, 0), 0)).toEqual(to);
    expect(createCameraFlight(from, to, 20).durationS).toBe(1.5);
    expect(createCameraFlight(from, to, 20000).durationS).toBe(2.5);
    expect(createCameraFlight(from, to, NaN).durationS).toBe(2);
  });

  test('source/run replacement cannot share a camera request identity even with reused display IDs', () => {
    const original = request('fault');
    expect(presentationRequestKey(original)).not.toBe(presentationRequestKey({ ...original, sourceKey: 'run-2:evidence-1' }));
    expect(presentationRequestKey(original)).not.toBe(presentationRequestKey({ ...original, token: 'request-2' }));
    expect(presentationRequestKey(original)).not.toBe(presentationRequestKey({ ...original, timeS: 17 }));
  });

  test('requires three consecutive valid stable completed poses and discards loading/reflow/stale progress', () => {
    const tracker = new PresentationSettling(), pose = [1, 2, 3, 0, 0, 0, 390, 420];
    expect(tracker.observe(pose, true)).toBe(false);
    expect(tracker.observe(pose, true)).toBe(false);
    expect(tracker.observe(pose, true)).toBe(true);
    expect(tracker.observe([...pose.slice(0, -1), 421], true)).toBe(false);
    expect(tracker.observe(pose, false)).toBe(false);
    expect(tracker.frames).toBe(0);
    expect(tracker.observe(pose, true)).toBe(false);
    expect(tracker.observe(pose, true)).toBe(false);
    expect(tracker.observe(pose, true)).toBe(true);
    expect(tracker.observe([NaN, ...pose], true)).toBe(false);
  });
});

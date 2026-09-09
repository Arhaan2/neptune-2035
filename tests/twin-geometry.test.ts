import { describe, expect, test } from 'vitest';
import {
  allAssets,
  buildDesign,
  connectionsForModule,
  DEFAULT_CONFIG,
  moduleAssets,
} from '../src/twin/assets/design';
import {
  clampInterior,
  footprintBounds,
  interiorWaypoint,
  pathLength,
  presentedPosition,
  presentedRoute,
  selectedModule,
  upstreamConnections,
} from '../src/scene/twinGeometry';
import type { Vec3 } from '../src/twin/types';

describe('dimensioned rendering contract', () => {
  test('hydrostatic translations keep each module floor on its own platform deck', () => {
    const design = buildDesign(DEFAULT_CONFIG);
    for (const m of design.modules) {
      const platform = design.assets.find((a) => a.id === m.platformId)!;
      const envelope = design.assets.find((a) => a.id === m.id)!;
      expect(envelope.positionM).toEqual(m.positionM);
      expect(m.positionM[1] - envelope.dimensionsM[1] / 2).toBeCloseTo(
        platform.positionM[1] + platform.dimensionsM[1] / 2,
        10,
      );
      const rack = moduleAssets(design, m.id).find((a) => a.type === 'rack')!;
      expect(rack.positionM[1] - rack.dimensionsM[1] / 2).toBeCloseTo(
        platform.positionM[1] + platform.dimensionsM[1] / 2,
        10,
      );
    }
  });
  test('all exact module and rack inventories reconcile, including a partial last rack', () => {
    const design = buildDesign({
      ...DEFAULT_CONFIG,
      requestedAccelerators: 10_008,
    });
    const assets = [...allAssets(design)];
    expect(assets.filter((a) => a.type === 'module')).toHaveLength(
      design.modules.length,
    );
    expect(assets.filter((a) => a.type === 'rack')).toHaveLength(
      design.rackCount,
    );
    expect(assets.filter((a) => a.type === 'compute')).toHaveLength(
      design.nodeCount,
    );
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
    const racks = assets.filter((a) => a.type === 'rack');
    const last = racks.at(-1)!;
    expect(assets.filter((a) => a.parentId === last.id)).toHaveLength(
      last.ratings.nodes,
    );
    expect(last.ratings.occupiedU).toBe(last.ratings.nodes * 10);
    expect(last.ratings.occupiedU).toBeLessThanOrEqual(last.ratings.slotsU);
    for (const rack of racks) expect(rack.dimensionsM).toEqual([0.6, 2.2, 1.2]);
  });
  test('all platforms are included in physical campus footprint above the old visual cap', () => {
    const design = buildDesign({
      ...DEFAULT_CONFIG,
      generation: 2,
      requestedAccelerators: 500_000,
    });
    const platforms = design.assets.filter((a) => a.type === 'platform');
    expect(platforms.length).toBeGreaterThan(25);
    const bounds = footprintBounds(platforms);
    for (const platform of platforms) {
      expect(
        platform.positionM[0] - platform.dimensionsM[0] / 2,
      ).toBeGreaterThanOrEqual(bounds.minX);
      expect(
        platform.positionM[0] + platform.dimensionsM[0] / 2,
      ).toBeLessThanOrEqual(bounds.maxX);
      expect(
        platform.positionM[2] - platform.dimensionsM[2] / 2,
      ).toBeGreaterThanOrEqual(bounds.minZ);
      expect(
        platform.positionM[2] + platform.dimensionsM[2] / 2,
      ).toBeLessThanOrEqual(bounds.maxZ);
    }
  });
  test('exploding is a pure presentation operation and preserves canonical hydraulic input', () => {
    const design = buildDesign(DEFAULT_CONFIG),
      moduleSpec = design.modules[0];
    const assets = [...design.assets, ...moduleAssets(design, moduleSpec.id)];
    const routes = connectionsForModule(design, moduleSpec.id);
    const before = JSON.stringify({ design, assets, routes });
    const map = new Map(assets.map((a) => [a.id, a]));
    for (const asset of assets) {
      expect(presentedPosition(asset, false)).toEqual(asset.positionM);
      const position = presentedPosition(asset, true);
      expect(position.every(Number.isFinite)).toBe(true);
      expect(position).not.toBe(asset.positionM);
    }
    for (const route of routes) {
      const originalLength = pathLength(route.routeM);
      presentedRoute(route, map, true);
      expect(pathLength(route.routeM)).toBe(originalLength);
      expect(presentedRoute(route, map, false)).toEqual(route.routeM);
    }
    expect(JSON.stringify({ design, assets, routes })).toBe(before);
  });
  test('interior camera remains in the canonical obstacle-free aisle at every waypoint and boundary', () => {
    const design = buildDesign(DEFAULT_CONFIG),
      moduleSpec = design.modules[1];
    const racks = moduleAssets(design, moduleSpec.id).filter(
      (a) => a.type === 'rack',
    );
    const candidates: Vec3[] = [
      [-1e6, 1e6, -1e6],
      [1e6, -1e6, 1e6],
      ...[0, 1, 2].map((n) => interiorWaypoint(moduleSpec, n)),
    ];
    for (const candidate of candidates) {
      const camera = clampInterior(candidate, moduleSpec);
      expect(camera[1]).toBe(moduleSpec.positionM[1] - 0.35);
      expect(Math.abs(camera[2] - moduleSpec.positionM[2])).toBeLessThanOrEqual(
        1.3 + 1e-12,
      );
      expect(camera[0]).toBeGreaterThanOrEqual(moduleSpec.positionM[0] - 10.5);
      expect(camera[0]).toBeLessThanOrEqual(moduleSpec.positionM[0] + 7.7);
      for (const rack of racks) {
        const clearanceZ =
          Math.abs(camera[2] - rack.positionM[2]) - rack.dimensionsM[2] / 2;
        expect(clearanceZ).toBeGreaterThanOrEqual(0.4 - 1e-12);
      }
    }
  });
  test('upstream rendered paths include the shared source rather than stopping at the local bus', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, generation: 2 });
    const m = design.modules[0];
    const support = upstreamConnections(design.connections, [
      m.powerDomainId,
      m.networkDomainId,
    ]);
    expect(support.some((c) => c.from === 'shore/grid')).toBe(true);
    expect(support.some((c) => c.from === 'shore/fiber')).toBe(true);
    expect(support.some((c) => c.to === m.powerDomainId)).toBe(true);
  });
  test('asset selection resolves the actual enclosing module and engineering path lengths use meters', () => {
    const design = buildDesign(DEFAULT_CONFIG),
      moduleSpec = design.modules.at(-1)!;
    expect(selectedModule(design, `${moduleSpec.id}/rack-01/node-01`)?.id).toBe(
      moduleSpec.id,
    );
    expect(selectedModule(design, `${moduleSpec.id}/pump-duty`)?.id).toBe(
      moduleSpec.id,
    );
    expect(selectedModule(design, moduleSpec.platformId)?.platformId).toBe(
      moduleSpec.platformId,
    );
    expect(
      pathLength([
        [0, 0, 0],
        [3, 0, 0],
        [3, 4, 0],
      ]),
    ).toBe(7);
    expect(
      pathLength([
        [0, 0, 0],
        [3, 4, 0],
      ]),
    ).toBe(5);
  });
});

import type {
  Asset,
  Connection,
  Design,
  ModuleSpec,
  Vec3,
} from '../twin/types';

/** Canonical SI geometry is never modified by presentation transforms. */
export function presentationOffset(
  type: Asset['type'],
  exploded: boolean,
): Vec3 {
  if (!exploded) return [0, 0, 0];
  if (type === 'hull') return [0, -2, 0];
  if (['module', 'rack', 'compute'].includes(type)) return [0, 7, 0];
  if (['pump', 'cdu', 'exchanger', 'valve', 'pipe'].includes(type))
    return [0, 3, 5];
  if (['battery', 'transformer', 'switchboard'].includes(type))
    return [4, 5, 0];
  if (type === 'network') return [0, 11, 0];
  return [0, 0, 0];
}
export function presentedPosition(asset: Asset, exploded: boolean): Vec3 {
  const d = presentationOffset(asset.type, exploded);
  return asset.positionM.map((v, i) => v + d[i]) as Vec3;
}
export function selectedModule(
  design: Design,
  id: string,
): ModuleSpec | undefined {
  return (
    design.modules.find((m) => id === m.id || id.startsWith(`${m.id}/`)) ??
    design.modules.find(
      (m) => m.platformId === id || id.startsWith(`${m.platformId}/`),
    ) ??
    design.modules[0]
  );
}
export interface FootprintBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  center: Vec3;
  radius: number;
}
export function footprintBounds(assets: readonly Asset[]): FootprintBounds {
  if (!assets.length)
    return {
      minX: -30,
      maxX: 30,
      minZ: -15,
      maxZ: 15,
      center: [0, 0, 0],
      radius: 34,
    };
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const a of assets) {
    minX = Math.min(minX, a.positionM[0] - a.dimensionsM[0] / 2);
    maxX = Math.max(maxX, a.positionM[0] + a.dimensionsM[0] / 2);
    minZ = Math.min(minZ, a.positionM[2] - a.dimensionsM[2] / 2);
    maxZ = Math.max(maxZ, a.positionM[2] + a.dimensionsM[2] / 2);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    radius: Math.max(16, Math.hypot(maxX - minX, maxZ - minZ) / 2),
  };
}
/** The accessible navigation volume is the unobstructed central service aisle.
 * Canonical racks are on z ±2.3 m with 1.2 m depth: their inner faces are ±1.7 m.
 * Keep a 0.35 m camera/body radius, 0.05 m margin and avoid the support bay x > 8. */
export function clampInterior(position: Vec3, module: ModuleSpec): Vec3 {
  return [
    Math.max(
      module.positionM[0] - 10.5,
      Math.min(module.positionM[0] + 7.7, position[0]),
    ),
    module.positionM[1] - 0.35,
    Math.max(
      module.positionM[2] - 1.3,
      Math.min(module.positionM[2] + 1.3, position[2]),
    ),
  ];
}
export function interiorWaypoint(module: ModuleSpec, index: number): Vec3 {
  return clampInterior(
    [
      module.positionM[0] + [-9.8, -1, 7.2][Math.min(2, Math.max(0, index))],
      module.positionM[1],
      module.positionM[2],
    ],
    module,
  );
}
/** Exact geometric path length only; callers retain the separately declared allowance. */
export function pathLength(route: readonly Vec3[]): number {
  return route
    .slice(1)
    .reduce(
      (sum, p, i) =>
        sum +
        Math.hypot(p[0] - route[i][0], p[1] - route[i][1], p[2] - route[i][2]),
      0,
    );
}
export function presentedRoute(
  connection: Connection,
  assetById: ReadonlyMap<string, Asset>,
  exploded: boolean,
): Vec3[] {
  const from = assetById.get(connection.from),
    to = assetById.get(connection.to);
  const a = from ? presentationOffset(from.type, exploded) : [0, 0, 0];
  const b = to ? presentationOffset(to.type, exploded) : [0, 0, 0];
  const length = pathLength(connection.routeM);
  let distance = 0;
  return connection.routeM.map((p, i) => {
    if (i)
      distance += Math.hypot(
        ...p.map((v, j) => v - connection.routeM[i - 1][j]),
      );
    const t = length ? distance / length : 0;
    return p.map((v, j) => v + a[j] * (1 - t) + b[j] * t) as Vec3;
  });
}

/** Trace the selected module's actual upstream dependency graph, including shared sources. */
export function upstreamConnections(
  connections: readonly Connection[],
  targets: readonly string[],
): Connection[] {
  const reached = new Set(targets),
    result = new Map<string, Connection>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const connection of connections) {
      if (!reached.has(connection.to)) continue;
      result.set(connection.id, connection);
      if (connection.enabled && !reached.has(connection.from)) {
        reached.add(connection.from);
        changed = true;
      }
    }
  }
  return [...result.values()];
}

import { CAPACITY, type Model, type Generation } from '../domain/model';
export type Vec3 = [number, number, number];
export type System = 'overview' | 'compute' | 'cooling' | 'power' | 'network';
export type GroupName =
  | 'hull'
  | 'compute'
  | 'cooling'
  | 'power'
  | 'network'
  | 'service';
export const EXPLODE: Record<GroupName, Vec3> = {
  hull: [0, -1, 0],
  compute: [0, 8, 0],
  cooling: [0, 3.5, 6],
  power: [-7, 4, 0],
  network: [0, 13, 0],
  service: [0, 1.5, -5],
};
export interface Island {
  id: string;
  x: number;
  z: number;
  modules: number;
  representedPlatforms: number;
}
export function makeLayout(
  model: Pick<Model, 'moduleCount' | 'platformCount'>,
  generation: Generation,
): Island[] {
  const visibleCount = Math.min(model.platformCount, 25);
  const columns =
    generation === 1
      ? Math.min(visibleCount, 2)
      : generation === 2
        ? Math.ceil(Math.sqrt(visibleCount * 1.6))
        : Math.ceil(Math.sqrt(visibleCount));
  const rows = Math.ceil(visibleCount / columns);
  let remainingModules = model.moduleCount;
  let remainingPlatforms = model.platformCount;
  return Array.from({ length: visibleCount }, (_, i) => {
    const representedPlatforms = Math.ceil(
      remainingPlatforms / (visibleCount - i),
    );
    remainingPlatforms -= representedPlatforms;
    const modules = Math.min(
      remainingModules,
      CAPACITY.modulesPerPlatform * representedPlatforms,
    );
    remainingModules -= modules;
    const row = Math.floor(i / columns);
    return {
      id: `platform-${i}`,
      x:
        ((i % columns) - (columns - 1) / 2) * 35 +
        (generation === 3 && row % 2 ? 8 : 0),
      z: (row - (rows - 1) / 2) * 39,
      modules,
      representedPlatforms,
    };
  });
}
export function layoutRadius(layout: Island[]) {
  return Math.max(25, ...layout.map((p) => Math.hypot(p.x, p.z) + 24));
}

export function representativeIsland(layout: Island[]): Island {
  return layout.reduce((a, b) =>
    b.x * 0.6 + b.z * 0.8 > a.x * 0.6 + a.z * 0.8 ? b : a,
  );
}

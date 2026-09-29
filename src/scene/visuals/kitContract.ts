import manifest from '../../../public/visuals/v2/manifest.json';
import type { Asset, Connection, Medium, Vec3 } from '../../twin/types';

/** Presentation-only compatibility. Installed specifications and center routes own truth. */
export const KIT_TOLERANCE_M = 0.00001;
export const VISUAL_KIT_MANIFEST = manifest;
export interface VisualKitAnchor {
  id: string;
  medium: Medium;
  direction: 'in' | 'out';
  positionM: Vec3;
}
export interface VisualKitBinding {
  kind: 'pump' | 'exchanger';
  url: string;
  sha256: string;
  bytes: number;
  dimensionsM: Vec3;
  bounds: { min: Vec3; max: Vec3 };
  anchors: VisualKitAnchor[];
  materialRoles: string[];
  rootName: string;
}
const vecMatches = (actual: readonly number[], expected: readonly number[]) =>
  actual.length === 3 && actual.every((v, index) => Number.isFinite(v) && Math.abs(v - expected[index]) <= KIT_TOLERANCE_M);

/** Unknown versions, physical replacements, altered dimensions and interfaces fall back.
 * Optional graph checks bind visual anchors to existing logical route endpoints; they
 * never move routes or infer a fabrication-ready port from a cosmetic flange.
 */
export function getVisualKitBinding(asset: Asset, connections?: readonly Connection[]): VisualKitBinding | null {
  const role = asset.id.split('/').at(-1)!;
  const template = manifest.templates.find(t =>
    t.type === asset.type && t.supportedRoles.includes(role) &&
    t.supportedSpecifications.some(s => s.id === asset.catalogId && s.version === asset.revision));
  if (!template || !vecMatches(asset.dimensionsM, template.dimensionsM) || !vecMatches(asset.positionM, asset.positionM)) return null;
  const anchors: VisualKitAnchor[] = template.logicalAnchors.map(anchor => {
    const medium = anchor.medium === 'role-fluid' ? role === 'pump-sea' ? 'seawater' : 'technical' : anchor.medium;
    return { id: anchor.id.replace('fluid', medium), medium: medium as Medium, direction: anchor.direction as 'in' | 'out', positionM: [...anchor.positionM] as Vec3 };
  });
  if (asset.ports.length !== anchors.length || anchors.some(anchor => !asset.ports.some(port => port.id === anchor.id && port.medium === anchor.medium && port.direction === anchor.direction))) return null;
  if (connections?.some(connection => {
    const isFrom = connection.from === asset.id, isTo = connection.to === asset.id;
    if (!isFrom && !isTo) return false;
    const port = isFrom ? connection.fromPort : connection.toPort;
    const endpoint = isFrom ? connection.routeM[0] : connection.routeM.at(-1);
    const anchor = anchors.find(a => a.id === port && a.medium === connection.medium && a.direction === (isFrom ? 'out' : 'in'));
    return !anchor || !endpoint || !vecMatches(endpoint, asset.positionM.map((v, i) => v + anchor.positionM[i]));
  })) return null;
  return {
    kind: template.id as VisualKitBinding['kind'], url: template.url,
    sha256: template.sha256, bytes: template.bytes, dimensionsM: [...template.dimensionsM] as Vec3,
    bounds: {min: [...template.boundsM.min] as Vec3, max: [...template.boundsM.max] as Vec3},
    anchors, materialRoles: manifest.materialRoles.map(role => role.name), rootName: template.rootName,
  };
}

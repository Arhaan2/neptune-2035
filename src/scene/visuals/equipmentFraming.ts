import { Vector3 } from 'three';
import type { Asset, Vec3 } from '../../twin/types';
import { presentedPosition } from '../twinGeometry';

/** Fit authoritative presented bounds to the actual canvas, after UI rails take
 * their space. This only chooses a camera pose; it never moves equipment. */
export function equipmentFrame(assets: readonly Asset[], exploded: boolean, aspect: number, direction: Vec3) {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const asset of assets) {
    const center = new Vector3(...presentedPosition(asset, exploded));
    const half = new Vector3(...asset.dimensionsM).multiplyScalar(0.5);
    min.min(center.clone().sub(half));
    max.max(center.clone().add(half));
  }
  const target = min.clone().add(max).multiplyScalar(0.5);
  const back = new Vector3(...direction).normalize();
  const right = new Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right);
  const verticalTangent = Math.tan(46 * Math.PI / 360);
  const horizontalTangent = verticalTangent * Math.max(0.1, aspect);
  let distance = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const corner = new Vector3(x, y, z).sub(target);
    const depth = corner.dot(back);
    distance = Math.max(distance,
      depth + Math.abs(corner.dot(right)) * 1.18 / horizontalTangent,
      depth + Math.abs(corner.dot(up)) * 1.18 / verticalTangent);
  }
  return { target, position: target.clone().addScaledVector(back, Math.max(1, distance)) };
}

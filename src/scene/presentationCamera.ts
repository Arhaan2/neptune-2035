import { Vector3 } from 'three';
import { moduleAssets, resolveAsset } from '../twin/assets/design';
import type { Asset, Design, Vec3 } from '../twin/types';
import { selectedModule } from './twinGeometry';
import { coolingViewDirection, equipmentFrame } from './visuals/equipmentFraming';

export type PresentationCameraShot = 'campus' | 'cooling' | 'equipment' | 'fault' | 'response' | 'summary';
export interface PresentationCameraRequest {
  token: string;
  sourceKey: string;
  stepId: string;
  shot: PresentationCameraShot;
  selectedId: string;
  timeS: number;
  transitionMs: number;
  authoredKind: 'pump' | 'exchanger' | 'cdu' | null;
}
export interface PresentationSceneReadiness {
  token: string;
  sourceKey: string;
  stepId: string;
  shot: PresentationCameraShot;
  selectedId: string;
  timeS: number;
  status: 'settling' | 'ready' | 'fallback';
  representation: 'authored' | 'procedural' | 'plan';
  settledFrames: number;
  camera: number[];
  target: number[];
  canvasSize: { width: number; height: number };
  renderEpoch: number;
}
export interface CameraPose { position: Vector3; target: Vector3 }
export interface CameraFlight { from: CameraPose; to: CameraPose; durationS: number; elapsedS: number }

export function presentationRequestKey(request: PresentationCameraRequest): string {
  return JSON.stringify([request.sourceKey, request.token, request.stepId, request.shot, request.selectedId, request.timeS, request.authoredKind]);
}

/** Shot subjects are canonical assets; existing offsets and the actual occupied
 * canvas determine composition. No shot changes equipment or numerical state. */
export function presentationFrame(design: Design, request: PresentationCameraRequest, exploded: boolean, aspect: number): CameraPose {
  const selected = resolveAsset(design, request.selectedId);
  const module = selectedModule(design, request.selectedId);
  const campus = design.assets.filter(asset => ['platform', 'hull', 'module'].includes(asset.type));
  let subjects: Asset[] = selected ? [selected] : campus;
  let direction: Vec3 = [0.65, 0.32, -0.69];
  if (request.shot === 'campus' || request.shot === 'summary') {
    subjects = campus;
    // A different final angle makes the decision a return to the whole evaluated
    // facility, while retaining the same bounds and stable Y-up horizon.
    direction = request.shot === 'campus' ? [0.55, 0.28, 0.8] : [-0.55, 0.34, 0.8];
  } else if (request.shot === 'cooling' && module) {
    subjects = moduleAssets(design, module.id).filter(asset => ['pump', 'exchanger', 'cdu'].includes(asset.type));
    direction = coolingViewDirection(exploded);
  } else if ((request.shot === 'response' || request.shot === 'fault') && selected) {
    // Frame the selected canonical path's immediate neighbours. A fault shot
    // also includes isolated edges; their scene highlights remain dashed.
    const ids = new Set([selected.id]);
    for (const connection of design.connections) {
      if ((connection.enabled || request.shot === 'fault') && connection.medium === 'power' && (connection.from === selected.id || connection.to === selected.id)) {
        ids.add(connection.from); ids.add(connection.to);
      }
    }
    subjects = [...ids].map(id => resolveAsset(design, id)).filter((asset): asset is Asset => !!asset);
    direction = [-0.55, 0.5, 0.8];
  } else if (selected && ['pump', 'exchanger', 'cdu'].includes(selected.type)) {
    // Approach all cooling close-ups from the front, below the lifted floor.
    direction = coolingViewDirection(exploded);
  }
  return equipmentFrame(subjects, exploded, aspect, direction);
}

export function createCameraFlight(from: CameraPose, to: CameraPose, durationMs: number): CameraFlight {
  return {
    from: { position: from.position.clone(), target: from.target.clone() },
    to: { position: to.position.clone(), target: to.target.clone() },
    durationS: durationMs === 0 ? 0 : Math.min(2.5, Math.max(1.5, Number.isFinite(durationMs) ? durationMs / 1000 : 2)),
    elapsedS: 0,
  };
}
const ease = (t: number) => t * t * (3 - 2 * t);
/** Elapsed foreground time controls a complete move. Interpolating the viewing
 * orbit avoids a straight chord through the subject on opposite-side shots.
 * Position and target use the same easing and the camera never acquires roll. */
export function sampleCameraFlight(flight: CameraFlight, elapsedS: number): CameraPose {
  const t = flight.durationS === 0 ? 1 : ease(Math.max(0, Math.min(1, elapsedS / flight.durationS)));
  if (t === 0) return { position: flight.from.position.clone(), target: flight.from.target.clone() };
  if (t === 1) return { position: flight.to.position.clone(), target: flight.to.target.clone() };
  const from = flight.from.position.clone().sub(flight.from.target);
  const to = flight.to.position.clone().sub(flight.to.target);
  const fromRadius = Math.max(0.001, from.length()), toRadius = Math.max(0.001, to.length());
  const azimuth = Math.atan2(from.x, from.z);
  const azimuthDelta = Math.atan2(Math.sin(Math.atan2(to.x, to.z) - azimuth), Math.cos(Math.atan2(to.x, to.z) - azimuth));
  const fromElevation = Math.asin(Math.max(-1, Math.min(1, from.y / fromRadius)));
  const toElevation = Math.asin(Math.max(-1, Math.min(1, to.y / toRadius)));
  const target = flight.from.target.clone().lerp(flight.to.target, t);
  const radius = fromRadius + (toRadius - fromRadius) * t;
  const elevation = fromElevation + (toElevation - fromElevation) * t;
  const angle = azimuth + azimuthDelta * t;
  const offset = new Vector3(Math.sin(angle) * Math.cos(elevation), Math.sin(elevation), Math.cos(angle) * Math.cos(elevation)).multiplyScalar(radius);
  return { position: target.clone().add(offset), target };
}

/** Consecutive completed frames, not elapsed loading time, establish settling. */
export class PresentationSettling {
  private previous: number[] | null = null;
  frames = 0;
  reset() { this.previous = null; this.frames = 0; }
  observe(pose: readonly number[], valid: boolean): boolean {
    if (!valid || pose.some(value => !Number.isFinite(value))) { this.reset(); return false; }
    const stable = this.previous?.length === pose.length && pose.every((value, index) => Math.abs(value - this.previous![index]) <= 1e-5);
    this.frames = stable ? this.frames + 1 : 1;
    this.previous = [...pose];
    return this.frames >= 3;
  }
}

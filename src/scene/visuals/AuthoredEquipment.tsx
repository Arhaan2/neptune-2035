import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Mesh, Raycaster, Vector3, type Camera, type Object3D, type Scene } from 'three';
import type { Asset, Connection, EquipmentState } from '../../twin/types';
import { presentedPosition } from '../twinGeometry';
import { getVisualKitBinding, type VisualKitBinding } from './kitContract';
import { stateColor } from './materials';
import { VisualKitCache, type KitInstance } from './kitCache';

export type KitStatus = 'idle' | 'loading' | 'ready' | 'fallback';
export interface KitAssetDiagnostic {
  assetId: string;
  kind: string;
  status: KitStatus;
  selected: boolean;
  operatingState: EquipmentState;
  materialColor: string;
  meshCount: number;
  renderedMeshes: number;
  worldCenter: number[];
  childWorldPoint?: number[];
}
export interface KitDiagnostic {
  version: 'systems-reveal-v3';
  moduleId: string;
  status: KitStatus;
  assets: KitAssetDiagnostic[];
  cache: ReturnType<VisualKitCache['inventory']>;
}

// The kit has immutable geometry and no moving subgroups. A diagnostic surface
// point changes only with the instance, its assembly transform or camera origin.
// Avoid raycasting every triangle on otherwise identical diagnostic publications.
// Weak keys and numeric values retain neither retired scenes nor GPU resources.
const diagnosticHits = new WeakMap<Object3D, { key: string; point?: number[] }>();

export function AuthoredEquipment({ asset, connections, identity, state, selected, exploded, enabled, cache, onSelect, children }: {
  asset: Asset;
  connections: readonly Connection[];
  identity: string;
  state?: EquipmentState;
  selected: boolean;
  exploded: boolean;
  enabled: boolean;
  cache: VisualKitCache;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  // Intern the small read-only descriptor by value: selecting a peer may recreate
  // connection arrays but must not retire a still-compatible material instance.
  const bindingJSON = useMemo(() => JSON.stringify(getVisualKitBinding(asset, connections)), [asset, connections]);
  const binding = useMemo(() => JSON.parse(bindingJSON) as VisualKitBinding | null, [bindingJSON]);
  const key = `${identity}:${asset.id}:${asset.catalogId}@${asset.revision}:${binding?.sha256 ?? 'unsupported'}`;
  const [result, setResult] = useState<{ key: string; instance?: KitInstance; failed?: boolean }>();
  useEffect(() => {
    if (!enabled || !binding) return;
    let cancelled = false, instance: KitInstance | undefined;
    cache.load(binding).then(template => {
      if (cancelled) return;
      instance = cache.instantiate(template);
      setResult({ key, instance });
    }).catch(() => { if (!cancelled) setResult({ key, failed: true }); });
    return () => { cancelled = true; instance?.dispose(); };
    // The semantic key includes design/spec/content identity and compatibility.
    // Selecting a peer may recreate a connection array without changing this file.
  }, [cache, binding, key, enabled]);
  const instance = enabled && result?.key === key && !result.instance?.disposed ? result.instance : undefined;
  const status: KitStatus = !enabled ? 'idle' : !binding || (result?.key === key && result.failed) ? 'fallback' : instance ? 'ready' : 'loading';
  useLayoutEffect(() => {
    instance?.materials.forEach((base, material) => {
      // The painted housing/frame conveys the same projected state as the inspector.
      // Selection remains the canonical cyan envelope, never a shared material tint.
      material.color.set(material.name.includes('paint') ? stateColor(state, base) : base);
    });
  }, [instance, state]);
  const diagnostic = { assetId: asset.id, kind: asset.type, status, selected, operatingState: state ?? 'unknown' };
  return (
    <group userData={{ visualKitAsset: diagnostic }}>
      {instance ? (
        <group position={presentedPosition(asset, exploded)} onClick={event => { event.stopPropagation(); onSelect(asset.id); }}>
          <primitive object={instance.scene} dispose={null} />
        </group>
      ) : children}
    </group>
  );
}

/** Called only after R3F has rendered this root: readiness/resource samples describe
 * the current completed frame, including changes in selection or loaded assets. */
export function visualKitDiagnostic(scene: Scene, camera: Camera, cache: VisualKitCache, moduleId: string, frame: number): KitDiagnostic {
  const assets: KitAssetDiagnostic[] = [];
  const cameraPosition = camera.getWorldPosition(new Vector3());
  scene.traverse(object => {
    const source = object.userData.visualKitAsset as Omit<KitAssetDiagnostic, 'materialColor' | 'meshCount' | 'renderedMeshes' | 'worldCenter'> | undefined;
    if (!source || source.status === 'idle') return;
    let meshCount = 0, renderedMeshes = 0, materialColor = '';
    const center = new Vector3();
    object.children[0]?.getWorldPosition(center);
    if (source.status === 'ready') object.traverse(child => {
      if (!(child instanceof Mesh)) return;
      meshCount++;
      if (child.userData.renderedFrame === frame) renderedMeshes++;
      for (const material of Array.isArray(child.material) ? child.material : [child.material])
        if (material.name.includes('paint')) materialColor = `#${material.color.getHexString()}`;
    });
    let point: number[] | undefined;
    const assembly = object.children[0], instance = assembly?.children[0];
    if (source.status === 'ready' && instance) {
      const key = `${instance.uuid}:${assembly.matrixWorld.elements.join(',')}:${cameraPosition.toArray().join(',')}`;
      let cached = diagnosticHits.get(object);
      if (cached?.key !== key) {
        const ray = new Raycaster(cameraPosition, center.clone().sub(cameraPosition).normalize());
        cached = { key, point: ray.intersectObject(object, true)[0]?.point.toArray() };
        diagnosticHits.set(object, cached);
      }
      point = cached.point?.slice();
    } else diagnosticHits.delete(object);
    assets.push({ ...source, meshCount, renderedMeshes, materialColor, worldCenter: center.toArray(), ...(point ? { childWorldPoint: point } : {}) });
  });
  const status = !assets.length ? 'idle' : assets.some(asset => asset.status === 'loading') ? 'loading' : assets.some(asset => asset.status === 'fallback') ? 'fallback' : 'ready';
  return { version: 'systems-reveal-v3', moduleId, status, assets, cache: cache.inventory() };
}

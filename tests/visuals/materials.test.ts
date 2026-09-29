import { describe, expect, it } from 'vitest';
import { Color, MeshStandardMaterial } from 'three';
import { allAssets, buildDesign, DEFAULT_CONFIG } from '../../src/twin/assets/design';
import { engineeringIdentity } from '../../src/twin/catalog/equipment';
import { advance, initialize } from '../../src/twin/engine/simulation';
import { normalizeProject, projectFile } from '../../src/twin/persistence/project';
import { presentedPosition } from '../../src/scene/twinGeometry';
import { assetSurface, BLUE_HOUR, MATERIALS, stateColor } from '../../src/scene/visuals/materials';
import type { EquipmentState } from '../../src/twin/types';

describe('Blue Hour presentation materials', () => {
  it('separates painted shells, exposed metal, rough decks and dark marine structure', () => {
    const paint = assetSurface('module'), metal = assetSurface('pump');
    expect(paint.metalness).toBe(0);
    expect(paint.roughness).toBeGreaterThanOrEqual(0.35);
    expect(paint.roughness).toBeLessThanOrEqual(0.5);
    expect(metal.metalness).toBe(1);
    expect(metal.roughness).toBeGreaterThanOrEqual(0.25);
    expect(metal.roughness).toBeLessThanOrEqual(0.4);
    expect(assetSurface('platform').roughness).toBeGreaterThan(paint.roughness);
    expect(new Set(['module', 'pump', 'hull', 'platform', 'rack'].map(type =>
      assetSurface(type as 'module' | 'pump' | 'hull' | 'platform' | 'rack').color,
    )).size).toBe(5);
    expect(Object.isFrozen(MATERIALS)).toBe(true);
    for (const preset of Object.values(MATERIALS)) expect(Object.isFrozen(preset)).toBe(true);
  });

  it('isolates per-instance failure tint and mutable Three materials from shared family presets', () => {
    const first = assetSurface('pump'), peer = assetSurface('pump');
    expect(first).not.toBe(peer);
    const original = { ...peer };
    first.color = stateColor('failed', first.color);
    first.roughness = 0.9;
    expect(peer).toEqual(original);
    expect(assetSurface('pump')).toEqual(original);
    const failedMaterial = new MeshStandardMaterial(first);
    const peerMaterial = new MeshStandardMaterial(peer);
    try {
      expect(failedMaterial.color.equals(new Color(BLUE_HOUR.failure))).toBe(true);
      expect(peerMaterial.color.equals(new Color(original.color))).toBe(true);
      failedMaterial.color.set(BLUE_HOUR.selection);
      expect(peerMaterial.color.equals(new Color(original.color))).toBe(true);
      expect(stateColor('failed', original.color)).toBe(BLUE_HOUR.failure);
      expect(assetSurface('pump')).toEqual(original);
    } finally {
      failedMaterial.dispose();
      peerMaterial.dispose();
    }
  });

  it('keeps unknown, maintenance, isolated, standby, startup and failure distinct from healthy metal', () => {
    const base = assetSurface('pump').color;
    const conditions: EquipmentState[] = ['unknown', 'maintenance', 'isolated', 'standby', 'starting', 'failed'];
    const colors = conditions.map(state => stateColor(state, base));
    expect(new Set(colors).size).toBe(conditions.length);
    for (const color of colors) {
      expect(color).not.toBe(base);
      expect(color).not.toBe(BLUE_HOUR.selection);
    }
    expect(stateColor('running', base)).toBe(base);
    expect(stateColor('available', base)).toBe(base);
    expect(stateColor(undefined, base)).toBe(base);
  });

  it('leaves installed geometry, engineering identity and the full normalized failed project unchanged', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
    const duty = 'platform-001/module-01/pump-duty';
    const state = advance(design, initialize(design), 2, [
      { id: 'visual-failure-fixture', kind: 'trip', assetId: duty, timeS: 1 },
    ]);
    const originalDesign = structuredClone(design), originalState = structuredClone(state);
    const identity = engineeringIdentity(design);
    const before = normalizeProject(projectFile(design, state));
    for (const exploded of [false, true, false]) {
      for (const asset of allAssets(design)) {
        const surface = assetSurface(asset.type);
        const status = state.modules.flatMap(module => Object.entries(module.states)).find(([id]) => id === asset.id)?.[1];
        stateColor(status, surface.color);
        presentedPosition(asset, exploded);
      }
    }
    expect(state.failedAssetIds).toContain(duty);
    expect(design).toEqual(originalDesign);
    expect(state).toEqual(originalState);
    expect(engineeringIdentity(design)).toBe(identity);
    // Retain the repository's exact comparator; do not introduce visual exceptions.
    expect(normalizeProject(projectFile(design, state))).toEqual(before);
  });
});

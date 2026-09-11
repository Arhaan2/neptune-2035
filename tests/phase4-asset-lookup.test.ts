import { describe, expect, it } from 'vitest';
import { allAssets, buildDesign, DEFAULT_CONFIG, moduleAssets, resolveAsset } from '../src/twin/assets/design';
import { advance, initialize } from '../src/twin/engine/simulation';
import { validateState } from '../src/twin/persistence/state';

const families = [1, 2, 3] as const;
const fixtures = families.flatMap(generation => ([0, 1] as const).map(standbyPumps => ({ generation, standbyPumps })));

describe('PH4 bounded asset lookup retains the canonical installed inventory', () => {
  it.each(fixtures)('preserves every asset for family $generation with $standbyPumps standby pumps', config => {
    const design = buildDesign({ ...DEFAULT_CONFIG, ...config, requestedAccelerators: 72 });
    const canonical = [...allAssets(design)];
    expect(canonical.filter(asset => asset.type === 'compute')).toHaveLength(9);
    expect(canonical.filter(asset => asset.type === 'rack')).toHaveLength(3);
    for (const asset of canonical) expect(resolveAsset(design, asset.id)).toEqual(asset);
    const module = design.modules[0];
    for (const attachment of moduleAssets(design, module.id, { attachmentOnly: true })) {
      expect(canonical.find(asset => asset.id === attachment.id)).toEqual(attachment);
    }
    expect(resolveAsset(design, `${module.id}/pump-standby`) !== undefined).toBe(Boolean(config.standbyPumps));
    expect(resolveAsset(design, `${module.id}/rack-03/node-01`)?.type).toBe('compute');
    expect(resolveAsset(design, `${module.id}/rack-03/node-02`)).toBeUndefined();
  });
  it.each(['pump-duty', 'rack-03', 'rack-03/node-01'])('accepts canonical %s references through committed faults and logs', suffix => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 72 });
    const assetId = `${design.modules[0].id}/${suffix}`;
    const state = advance(design, initialize(design), 1, [{ id: 'lookup-trip', timeS: 1, kind: 'trip', assetId }]);
    expect(state.failedAssetIds).toContain(assetId);
    expect(state.log.some(entry => entry.assetId === assetId)).toBe(true);
    expect(() => validateState(design, state)).not.toThrow();
  });
  it.each(['pump-duty/unknown', 'rack-03/node-02', 'rack-04', 'rack-01/node-99'])('rejects nonexistent module-local reference %s after support lookup', suffix => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 72 });
    const assetId = `${design.modules[0].id}/${suffix}`;
    expect(resolveAsset(design, assetId)).toBeUndefined();
    const state = initialize(design);
    state.modules[0].states[assetId] = 'available';
    expect(() => validateState(design, state)).toThrow(/Unknown equipment reference/);
    delete state.modules[0].states[assetId];
    state.log.push({ timeS: 0, assetId, message: 'invalid local asset', kind: 'warning', affectedIds: [design.modules[0].id] });
    expect(() => validateState(design, state)).toThrow(/Invalid causal trace asset/);
  });
});

import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, withNetworkPreset } from '../src/twin/assets/design';
import { billOfEquipment } from '../src/twin/analysis/reports';
import { updateEconomicAssumptions } from '../src/twin/catalog/equipment';

describe('Phase 3 declared and unknown network prices',()=>{
  it('preserves an unknown installed price through an explicit network revision',()=>{
    const initial=withNetworkPreset(buildDesign({...DEFAULT_CONFIG,requestedAccelerators:8}),'scalable-reference');
    const prices={...initial.equipment!.economics.specificationUnitUSD};
    delete prices['network-platform@1.0.0'];
    const unknown=updateEconomicAssumptions(initial,{specificationUnitUSD:prices});
    const derived=withNetworkPreset(unknown,'undersized-shared-core');
    const bill=billOfEquipment(derived);
    expect(derived.equipment!.economics.specificationUnitUSD['network-platform@1.0.0']).toBeUndefined();
    expect(bill.completeWithinIncludedScope).toBe(false);
    expect(bill.missingCostAssetIds).toEqual(['platform-001/cluster']);
    expect(bill.rows.some(row=>row.scope==='Networking')).toBe(false);
  });
  it('installs a declared reference price only when introducing a previously unavailable record',()=>{
    const legacy=buildDesign({...DEFAULT_CONFIG,requestedAccelerators:8});
    legacy.equipment!.specifications=legacy.equipment!.specifications.filter(spec=>!spec.id.startsWith('network-'));
    legacy.equipment!.economics.specificationUnitUSD=Object.fromEntries(Object.entries(legacy.equipment!.economics.specificationUnitUSD).filter(([id])=>!id.startsWith('network-')));
    const derived=withNetworkPreset(legacy,'scalable-reference');
    expect(derived.equipment!.economics.specificationUnitUSD['network-platform@1.0.0']).toBe(25_000);
    expect(billOfEquipment(derived).completeWithinIncludedScope).toBe(true);
    expect(legacy.equipment!.specifications.some(spec=>spec.id.startsWith('network-'))).toBe(false);
  });
});

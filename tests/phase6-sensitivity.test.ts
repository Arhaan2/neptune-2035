import { describe, expect, it } from 'vitest';
import { createDecisionCampaign } from '../src/twin/decision/candidates';
import { applyDecisionSensitivity } from '../src/twin/decision/sensitivity';
import { validateDesign } from '../src/twin/persistence/design';
import { engineeringIdentity, equipmentFor, resolveModuleEngineering } from '../src/twin/catalog/equipment';
import { billOfEquipment } from '../src/twin/analysis/reports';

const campaign = createDecisionCampaign('sensitivity');
describe('PH6 sensitivities use actual versioned engineering/economic inputs', () => {
  it.each(campaign.sensitivities)('all supported candidates resolve under $id without losing installed specifications', sensitivity => {
    for (const candidate of campaign.candidates) {
      const design = applyDecisionSensitivity(candidate.design, sensitivity);
      expect(() => validateDesign(design)).not.toThrow();
      expect(design.assets).toEqual(candidate.design.assets);
      expect(design.modules).toEqual(candidate.design.modules);
      if (sensitivity.parameter === 'idleFraction' || sensitivity.parameter === 'foulingResistanceKPerW') expect(design.config[sensitivity.parameter]).toBe(sensitivity.value);
      if (sensitivity.parameter === 'exchangerUAWPerK') expect(resolveModuleEngineering(design, design.modules[0].id).exchanger.ratings.UAWPerK).toBe(sensitivity.value);
      if (sensitivity.parameter === 'unitCostScale') {
        expect(equipmentFor(design).economics.unitCostScale).toBe(sensitivity.value);
        expect(engineeringIdentity(design)).toBe(candidate.physicalIdentity);
        expect(billOfEquipment(design).totalUSD).toBeCloseTo(billOfEquipment(candidate.design).totalUSD * sensitivity.value!, 6);
      }
    }
  });
  it('one sensitivity application cannot mutate the source or the next run initialization inputs', () => {
    const before = structuredClone(campaign);
    for (const sensitivity of campaign.sensitivities.filter(s => s.parameter !== 'exchangerUAWPerK')) for (const candidate of campaign.candidates) applyDecisionSensitivity(candidate.design, sensitivity);
    expect(campaign).toEqual(before);
  });
});

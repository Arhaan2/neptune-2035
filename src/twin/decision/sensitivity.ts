import { createEquipmentConfiguration, engineeringIdentity, equipmentFor } from '../catalog/equipment';
import { validateDesign } from '../persistence/design';
import type { DecisionSensitivity } from './types';
import type { Design } from '../types';
/** Rebind existing versioned config/spec adapters without rebuilding or resizing physical platforms. */
export function applyDecisionSensitivity(source:Design,sensitivity:DecisionSensitivity):Design {
  const design=structuredClone(source);design.equipment=structuredClone(equipmentFor(design));
  if(sensitivity.parameter==='unitCostScale')design.equipment.economics.unitCostScale=equipmentFor(source).economics.unitCostScale*sensitivity.value!;
  else if(sensitivity.parameter!=='central'){
    design.config[sensitivity.parameter]=sensitivity.value!;
    if(sensitivity.parameter==='exchangerUAWPerK'){
      const reference=createEquipmentConfiguration(design.config);design.equipment.defaults.exchanger=reference.defaults.exchanger;
      // Keep only installed supported adapter records; stale unused adapters are not valid for the derived config.
      design.equipment.specifications=reference.specifications;
    }
    design.revision=`decision-${engineeringIdentity(design)}`;
  }
  validateDesign(design);return design;
}

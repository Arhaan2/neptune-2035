import { catalogSpecification, CONTROL_POLICY } from '../catalog/equipment';
import { failure, finiteNumber, finiteOutputs } from '../safety';
import { CONTRACT } from '../persistence/limits';

export const ELECTRICAL_ASSUMPTIONS = Object.freeze({
  nodePeakW: catalogSpecification('compute-reference').ratings.capacityW, acceleratorsPerNode: 8, distributionEfficiency: catalogSpecification('transformer-reference').ratings.efficiency, upsEfficiency: catalogSpecification('distribution-reference').ratings.efficiency,
  chargeEfficiency: catalogSpecification('battery-reference').ratings.chargeEfficiency, dischargeEfficiency: catalogSpecification('battery-reference').ratings.dischargeEfficiency, batteryReserveFraction: CONTROL_POLICY.batteryReserveFraction,
  controlsWPerModule: catalogSpecification('cdu-reference').ratings.capacityW, fanWPerModule: catalogSpecification('moduleSupport-reference').ratings.capacityW,
});
export const GRID_EFFICIENCY = ELECTRICAL_ASSUMPTIONS.distributionEfficiency * ELECTRICAL_ASSUMPTIONS.upsEfficiency;
export interface ElectricalEquipment { nodePeakW:number; gridEfficiency:number; chargeEfficiency:number; dischargeEfficiency:number; batteryReserveFraction:number }
export const REFERENCE_ELECTRICAL_EQUIPMENT:ElectricalEquipment = {nodePeakW:ELECTRICAL_ASSUMPTIONS.nodePeakW,gridEfficiency:GRID_EFFICIENCY,chargeEfficiency:ELECTRICAL_ASSUMPTIONS.chargeEfficiency,dischargeEfficiency:ELECTRICAL_ASSUMPTIONS.dischargeEfficiency,batteryReserveFraction:ELECTRICAL_ASSUMPTIONS.batteryReserveFraction};
export interface ElectricalInput {
  equipment?: ElectricalEquipment;
  desiredNodes: number; workload: number; idleFraction: number; networkAvailable: boolean;
  criticalLoadW: number; gridAvailableW: number; batteryWh: number; batteryCapacityWh: number;
  batteryMaxW: number; batteryAvailable: boolean; isolated: boolean; dtS: number;
}
export interface ElectricalResult {
  energizedNodes: number; itW: number; loadW: number; criticalPowered: boolean; gridW: number;
  batteryWh: number; batteryDischargeW: number; batteryChargeW: number;
  gridLossW: number; batteryLossW: number; facilityW: number; residualW: number; normalizedResidual: number;
}
function booleanInput(value: unknown, field: string) {
  if (typeof value !== 'boolean') failure('invalid-input', 'INVALID_BOOLEAN', `${field} must be a boolean.`, { field });
}
function checked(value: number, field: string) {
  return finiteOutputs({ [field]: value }, 'electrical')[field];
}
export function nodeDrawW(workload: number, idleFraction: number, networkAvailable = true, nodePeakW = ELECTRICAL_ASSUMPTIONS.nodePeakW): number {
  finiteNumber(workload, 'workload', { min: 0, max: 1, unit: '1' });
  finiteNumber(idleFraction, 'idleFraction', { min: 0, max: 1, unit: '1' });
  booleanInput(networkAvailable, 'networkAvailable');
  finiteNumber(nodePeakW,'nodePeakW',{min:0,unit:'W'});
  return checked(nodePeakW * (idleFraction + (1 - idleFraction) * (networkAvailable ? workload : 0)), 'nodeDrawW');
}
export function solveElectrical(input: ElectricalInput): ElectricalResult {
  if (!input || typeof input !== 'object') failure('invalid-input', 'ELECTRICAL_INPUT', 'Electrical input must be an object.');
  for (const key of ['criticalLoadW', 'gridAvailableW', 'batteryMaxW'] as const) finiteNumber(input[key], key, { min: 0, unit: 'W' });
  for (const key of ['batteryWh', 'batteryCapacityWh'] as const) finiteNumber(input[key], key, { min: 0, unit: 'Wh' });
  for (const key of ['networkAvailable', 'batteryAvailable', 'isolated'] as const) booleanInput(input[key], key);
  finiteNumber(input.desiredNodes, 'desiredNodes', { min: 0, integer: true, unit: 'nodes' });
  if (input.desiredNodes > 160) failure('unsupported-configuration', 'ELECTRICAL_INVENTORY', 'Unsupported module node inventory: at most 160 nodes.', { field: 'desiredNodes', unit: 'nodes', details: { maximum: 160, received: input.desiredNodes } });
  if (input.batteryWh > input.batteryCapacityWh + 1e-8) failure('invalid-input', 'BATTERY_CAPACITY', 'Battery state exceeds capacity.', { field: 'batteryWh', unit: 'Wh', details: { capacityWh: input.batteryCapacityWh, received: input.batteryWh } });
  finiteNumber(input.dtS, 'dtS', { min: 0, max: 1, unit: 's' });
  const a = input.equipment ?? REFERENCE_ELECTRICAL_EQUIPMENT, dt = input.dtS || 1;
  finiteNumber(a.nodePeakW,'nodePeakW',{min:0,unit:'W'});
  for(const field of ['gridEfficiency','chargeEfficiency','dischargeEfficiency'] as const)finiteNumber(a[field],field,{min:Number.MIN_VALUE,max:1});
  finiteNumber(a.batteryReserveFraction,'batteryReserveFraction',{min:0,max:1});
  const draw = nodeDrawW(input.workload, input.idleFraction, input.networkAvailable,a.nodePeakW);
  const gridAvailableW = input.isolated ? 0 : input.gridAvailableW;
  const reserveWh = input.batteryCapacityWh * a.batteryReserveFraction;
  const dischargeLimitW = input.batteryAvailable && !input.isolated
    ? Math.min(input.batteryMaxW, checked(Math.max(0, input.batteryWh - reserveWh) * a.dischargeEfficiency * 3600 / dt, 'dischargeEnergyLimitW')) : 0;
  const busAvailableW = checked(gridAvailableW * a.gridEfficiency + dischargeLimitW, 'busAvailableW');
  const criticalPowered = !input.isolated && busAvailableW + 1e-7 >= input.criticalLoadW;
  const energizedNodes = criticalPowered
    ? Math.min(input.desiredNodes, draw > 0 ? Math.max(0, Math.floor(checked((busAvailableW - input.criticalLoadW + 1e-7) / draw, 'supportedNodes'))) : input.desiredNodes) : 0;
  const itW = energizedNodes * draw;
  const loadW = itW + (criticalPowered ? input.criticalLoadW : 0);
  const gridToLoadW = Math.min(gridAvailableW * a.gridEfficiency, loadW);
  const batteryDischargeW = Math.max(0, loadW - gridToLoadW);
  const chargeLimitW = input.batteryAvailable && !input.isolated
    ? Math.min(input.batteryMaxW, checked(Math.max(0, input.batteryCapacityWh - input.batteryWh) * 3600 / (a.chargeEfficiency * dt), 'chargeEnergyLimitW')) : 0;
  const batteryChargeW = batteryDischargeW > 1e-8 ? 0 : Math.min(chargeLimitW, Math.max(0, gridAvailableW * a.gridEfficiency - loadW));
  const gridW = (gridToLoadW + batteryChargeW) / a.gridEfficiency;
  const gridLossW = gridW * (1 - a.gridEfficiency);
  const batteryLossW = batteryDischargeW * (1 / a.dischargeEfficiency - 1) + batteryChargeW * (1 - a.chargeEfficiency);
  const facilityW = loadW + gridLossW + batteryLossW;
  const batteryWh = input.dtS === 0 ? input.batteryWh : input.batteryWh + (a.chargeEfficiency * batteryChargeW - batteryDischargeW / a.dischargeEfficiency) * input.dtS / 3600;
  const residualW = gridW + batteryDischargeW / a.dischargeEfficiency - a.chargeEfficiency * batteryChargeW - facilityW;
  return finiteOutputs({ energizedNodes, itW, loadW, criticalPowered, gridW, batteryWh,
    batteryDischargeW, batteryChargeW, gridLossW, batteryLossW, facilityW, residualW,
    normalizedResidual: residualW / Math.max(1, gridW, facilityW) }, 'solveElectrical');
}
/** Proportional allocation under a common upstream and explicit branch capacities. */
export function allocateGrid(requests: { domainId: string; requestedW: number; moduleLimitW: number }[], supplyW: number, domainLimits: ReadonlyMap<string, number>): number[] {
  finiteNumber(supplyW, 'supplyW', { min: 0, unit: 'W' });
  if (!Array.isArray(requests) || !(domainLimits instanceof Map)) failure('invalid-input', 'GRID_ALLOCATION_INPUT', 'Grid allocation requires a request array and a domain-capacity map.');
  if (requests.length > CONTRACT.maxModules || domainLimits.size > CONTRACT.maxDesignAssets) failure('invalid-input', 'GRID_ALLOCATION_LIMIT', 'Grid allocation exceeds the shared module/domain structural limits.');
  for (const [domainId, capacity] of domainLimits) {
    if (typeof domainId !== 'string' || !domainId) failure('invalid-input', 'GRID_DOMAIN_ID', 'Power domain identity must be a nonempty string.', { field: 'domainId' });
    finiteNumber(capacity, `domainLimits.${domainId}`, { min: 0, unit: 'W' });
  }
  for (const [i, r] of requests.entries()) {
    if (!r || typeof r.domainId !== 'string' || !r.domainId) failure('invalid-input', 'GRID_DOMAIN_ID', 'Power request requires a nonempty domain identity.', { field: `requests.${i}.domainId` });
    finiteNumber(r.requestedW, `requests.${i}.requestedW`, { min: 0, unit: 'W' });
    finiteNumber(r.moduleLimitW, `requests.${i}.moduleLimitW`, { min: 0, unit: 'W' });
    if (!domainLimits.has(r.domainId)) failure('invalid-input', 'GRID_DOMAIN_MISSING', 'Power request references an unspecified domain capacity.', { field: `requests.${i}.domainId`, assetId: r.domainId, unit: 'W' });
  }
  const allocations = requests.map(r => Math.min(r.requestedW, r.moduleLimitW));
  const sums = new Map<string, number>();
  requests.forEach((r, i) => sums.set(r.domainId, checked((sums.get(r.domainId) ?? 0) + allocations[i], 'domainRequestW')));
  requests.forEach((r, i) => {
    const sum = sums.get(r.domainId) ?? 0, cap = domainLimits.get(r.domainId) ?? 0;
    allocations[i] *= sum > 0 ? cap >= sum ? 1 : cap / sum : 0;
  });
  const total = allocations.reduce((sum, p) => checked(sum + p, 'totalRequestW'), 0), factor = total > 0 ? supplyW >= total ? 1 : supplyW / total : 0;
  return allocations.map(p => checked(p * factor, 'allocatedW'));
}

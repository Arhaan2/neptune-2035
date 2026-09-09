export const ELECTRICAL_ASSUMPTIONS = Object.freeze({
  nodePeakW: 12_000, acceleratorsPerNode: 8, distributionEfficiency: 0.98, upsEfficiency: 0.97,
  chargeEfficiency: 0.95, dischargeEfficiency: 0.95, batteryReserveFraction: 0.1,
  controlsWPerModule: 3_000, fanWPerModule: 15_000,
});
export const GRID_EFFICIENCY = ELECTRICAL_ASSUMPTIONS.distributionEfficiency * ELECTRICAL_ASSUMPTIONS.upsEfficiency;
export interface ElectricalInput {
  desiredNodes: number; workload: number; idleFraction: number; networkAvailable: boolean;
  criticalLoadW: number; gridAvailableW: number; batteryWh: number; batteryCapacityWh: number;
  batteryMaxW: number; batteryAvailable: boolean; isolated: boolean; dtS: number;
}
export interface ElectricalResult {
  energizedNodes: number; itW: number; loadW: number; criticalPowered: boolean; gridW: number;
  batteryWh: number; batteryDischargeW: number; batteryChargeW: number;
  gridLossW: number; batteryLossW: number; facilityW: number; residualW: number; normalizedResidual: number;
}
export function nodeDrawW(workload: number, idleFraction: number, networkAvailable = true): number {
  if (![workload, idleFraction].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Workload and idle fraction must be between zero and one');
  return ELECTRICAL_ASSUMPTIONS.nodePeakW * (idleFraction + (1 - idleFraction) * (networkAvailable ? workload : 0));
}
export function solveElectrical(input: ElectricalInput): ElectricalResult {
  for (const key of ['criticalLoadW', 'gridAvailableW', 'batteryWh', 'batteryCapacityWh', 'batteryMaxW', 'dtS'] as const) {
    if (!Number.isFinite(input[key]) || input[key] < 0) throw new Error(`Electrical ${key} must be finite and non-negative`);
  }
  if (!Number.isInteger(input.desiredNodes) || input.desiredNodes < 0 || input.desiredNodes > 160) throw new Error('Unsupported module node inventory');
  if (input.batteryWh > input.batteryCapacityWh + 1e-8) throw new Error('Battery state exceeds capacity');
  if (input.dtS > 1) throw new Error('Electrical timestep exceeds one second');
  const a = ELECTRICAL_ASSUMPTIONS, dt = input.dtS || 1;
  const draw = nodeDrawW(input.workload, input.idleFraction, input.networkAvailable);
  const gridAvailableW = input.isolated ? 0 : input.gridAvailableW;
  const reserveWh = input.batteryCapacityWh * a.batteryReserveFraction;
  const dischargeLimitW = input.batteryAvailable && !input.isolated
    ? Math.min(input.batteryMaxW, Math.max(0, input.batteryWh - reserveWh) * a.dischargeEfficiency * 3600 / dt) : 0;
  const busAvailableW = gridAvailableW * GRID_EFFICIENCY + dischargeLimitW;
  const criticalPowered = !input.isolated && busAvailableW + 1e-7 >= input.criticalLoadW;
  const energizedNodes = criticalPowered
    ? Math.min(input.desiredNodes, draw > 0 ? Math.max(0, Math.floor((busAvailableW - input.criticalLoadW + 1e-7) / draw)) : input.desiredNodes) : 0;
  const itW = energizedNodes * draw;
  const loadW = itW + (criticalPowered ? input.criticalLoadW : 0);
  const gridToLoadW = Math.min(gridAvailableW * GRID_EFFICIENCY, loadW);
  const batteryDischargeW = Math.max(0, loadW - gridToLoadW);
  const chargeLimitW = input.batteryAvailable && !input.isolated
    ? Math.min(input.batteryMaxW, Math.max(0, input.batteryCapacityWh - input.batteryWh) * 3600 / (a.chargeEfficiency * dt)) : 0;
  const batteryChargeW = batteryDischargeW > 1e-8 ? 0 : Math.min(chargeLimitW, Math.max(0, gridAvailableW * GRID_EFFICIENCY - loadW));
  const gridW = (gridToLoadW + batteryChargeW) / GRID_EFFICIENCY;
  const gridLossW = gridW * (1 - GRID_EFFICIENCY);
  const batteryLossW = batteryDischargeW * (1 / a.dischargeEfficiency - 1) + batteryChargeW * (1 - a.chargeEfficiency);
  const facilityW = loadW + gridLossW + batteryLossW;
  const batteryWh = input.dtS === 0 ? input.batteryWh : input.batteryWh + (a.chargeEfficiency * batteryChargeW - batteryDischargeW / a.dischargeEfficiency) * input.dtS / 3600;
  const residualW = gridW + batteryDischargeW / a.dischargeEfficiency - a.chargeEfficiency * batteryChargeW - facilityW;
  return { energizedNodes, itW, loadW, criticalPowered, gridW, batteryWh,
    batteryDischargeW, batteryChargeW, gridLossW, batteryLossW, facilityW, residualW,
    normalizedResidual: residualW / Math.max(1, gridW, facilityW) };
}
/** Proportional allocation under a common upstream and explicit branch capacities. */
export function allocateGrid(requests: { domainId: string; requestedW: number; moduleLimitW: number }[], supplyW: number, domainLimits: ReadonlyMap<string, number>): number[] {
  if (!Number.isFinite(supplyW) || supplyW < 0) throw new Error('Invalid supply capacity');
  const allocations = requests.map(r => Math.max(0, Math.min(r.requestedW, r.moduleLimitW)));
  const sums = new Map<string, number>();
  requests.forEach((r, i) => sums.set(r.domainId, (sums.get(r.domainId) ?? 0) + allocations[i]));
  requests.forEach((r, i) => {
    const sum = sums.get(r.domainId) ?? 0, cap = domainLimits.get(r.domainId) ?? 0;
    allocations[i] *= sum > 0 ? Math.min(1, cap / sum) : 0;
  });
  const total = allocations.reduce((sum, p) => sum + p, 0), factor = total > 0 ? Math.min(1, supplyW / total) : 0;
  return allocations.map(p => p * factor);
}

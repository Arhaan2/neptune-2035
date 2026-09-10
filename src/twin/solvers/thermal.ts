import { catalogSpecification } from '../catalog/equipment';
import { failure, finiteNumber, finiteOutputs } from '../safety';

export const THERMAL_ASSUMPTIONS = Object.freeze({
  technicalDensityKgM3: 997, technicalCpJKgK: 4180, seawaterDensityKgM3: 1025, seawaterCpJKgK: 3990,
  liquidCapture: catalogSpecification('compute-reference').ratings.liquidCaptureFraction, coolantCapacitanceJK: 24e6, airCapacitanceJK: 12e6,
  ambientK: 298.15, passiveAirConductanceWK: 500, fanAirConductanceWK: 22_000,
  pumpToFluidFraction: 0.9,
});
export interface ExchangerInput {
  technicalInletK: number; seawaterInletK: number; technicalFlowM3S: number; seawaterFlowM3S: number;
  cleanUAWPerK: number; foulingResistanceKPerW: number;
  technicalDensityKgM3?: number; technicalCpJKgK?: number; seawaterDensityKgM3?: number; seawaterCpJKgK?: number;
}
export interface ExchangerResult {
  heatW: number; technicalOutletK: number; seawaterOutletK: number; effectiveUAWPerK: number;
  effectiveness: number; conductanceWPerK: number; balanceResidualW: number;
}
function checked(value: number, field: string) {
  return finiteOutputs({ [field]: value }, 'thermal')[field];
}
function fluidProperty(input: ExchangerInput, field: 'technicalDensityKgM3' | 'technicalCpJKgK' | 'seawaterDensityKgM3' | 'seawaterCpJKgK', fallback: number, unit: string) {
  const value = Object.hasOwn(input, field) ? input[field] : fallback;
  finiteNumber(value, field, { min: Number.MIN_VALUE, unit });
  return value;
}
function capacityRate(flowM3S: number, densityKgM3: number, cpJKgK: number, field: string) {
  const capacity = checked(flowM3S * densityKgM3 * cpJKgK, field);
  if (flowM3S > 0 && capacity === 0) failure('numerical-failure', 'THERMAL_UNDERFLOW', 'Positive flow and fluid properties underflowed to zero heat-capacity rate.', { field, unit: 'W/K' });
  return capacity;
}
export function solveExchanger(input: ExchangerInput): ExchangerResult {
  if (!input || typeof input !== 'object') failure('invalid-input', 'EXCHANGER_INPUT', 'Exchanger input must be an object.');
  for (const key of ['technicalInletK', 'seawaterInletK'] as const) finiteNumber(input[key], key, { min: Number.MIN_VALUE, unit: 'K' });
  for (const [field, minimum, maximum] of [['technicalInletK', 273.15, 373.15], ['seawaterInletK', 271.15, 343.15]] as const) {
    if (input[field] < minimum || input[field] > maximum) failure('unsupported-configuration', 'EXCHANGER_PROPERTY_RANGE', 'Exchanger fluid temperature outside declared single-phase property range.', { field, unit: 'K', details: { minimum, maximum, received: input[field] } });
  }
  for (const key of ['technicalFlowM3S', 'seawaterFlowM3S'] as const) finiteNumber(input[key], key, { min: 0, unit: 'm³/s' });
  finiteNumber(input.cleanUAWPerK, 'cleanUAWPerK', { min: 0, unit: 'W/K' });
  finiteNumber(input.foulingResistanceKPerW, 'foulingResistanceKPerW', { min: 0, unit: 'K/W' });
  const properties = [fluidProperty(input, 'technicalDensityKgM3', 997, 'kg/m³'), fluidProperty(input, 'technicalCpJKgK', 4180, 'J/(kg·K)'), fluidProperty(input, 'seawaterDensityKgM3', 1025, 'kg/m³'), fluidProperty(input, 'seawaterCpJKgK', 3990, 'J/(kg·K)')];
  const cTechnical = capacityRate(input.technicalFlowM3S, properties[0], properties[1], 'technicalCapacityWPerK');
  const cSea = capacityRate(input.seawaterFlowM3S, properties[2], properties[3], 'seawaterCapacityWPerK');
  const ua = input.cleanUAWPerK === 0 ? 0 : checked(1 / checked(1 / input.cleanUAWPerK + input.foulingResistanceKPerW, 'thermalResistanceKPerW'), 'effectiveUAWPerK');
  const cMin = Math.min(cTechnical, cSea), cMax = Math.max(cTechnical, cSea);
  let effectiveness = 0;
  if (cMin > 0 && ua > 0) {
    const ratio = cMin / cMax, ntu = checked(ua / cMin, 'ntu');
    if (Math.abs(1 - ratio) < 1e-8) effectiveness = ntu / (1 + ntu);
    else { const z = Math.exp(-ntu * (1 - ratio)); effectiveness = -Math.expm1(-ntu * (1 - ratio)) / (1 - ratio * z); }
  }
  const conductanceWPerK = effectiveness * cMin;
  const heatW = conductanceWPerK * (input.technicalInletK - input.seawaterInletK);
  const technicalOutletK = cTechnical > 0 ? input.technicalInletK - heatW / cTechnical : input.technicalInletK;
  const seawaterOutletK = cSea > 0 ? input.seawaterInletK + heatW / cSea : input.seawaterInletK;
  return finiteOutputs({ heatW, technicalOutletK, seawaterOutletK, effectiveUAWPerK: ua, effectiveness, conductanceWPerK,
    balanceResidualW: cTechnical * (input.technicalInletK - technicalOutletK) - cSea * (seawaterOutletK - input.seawaterInletK) }, 'solveExchanger');
}
export interface ThermalInput {
  liquidCaptureFraction?: number;
  coolantK: number; airK: number; itW: number; facilityW: number;
  technicalPumpW: number; seawaterPumpW: number; technicalFlowM3S: number; seawaterFlowM3S: number;
  seawaterK: number; exchangerUAWPerK: number; foulingResistanceKPerW: number; fanPowered: boolean; dtS: number;
}
export interface ThermalResult {
  coolantK: number; airK: number; technicalOutletK: number; seawaterOutletK: number;
  rejectedHeatW: number; ambientHeatW: number; storedHeatW: number; residualW: number; normalizedResidual: number;
}
/** Exact integration of each linear bulk thermal node over a constant-power interval. */
function integrateNode(temperatureK: number, boundaryK: number, generatedW: number, conductanceWK: number, capacitanceJK: number, dtS: number) {
  if (dtS === 0) return finiteOutputs({ temperatureK, removedW: conductanceWK * (temperatureK - boundaryK), storedW: generatedW - conductanceWK * (temperatureK - boundaryK) }, 'integrateNode');
  const delta = conductanceWK > 0
    ? checked(generatedW / conductanceWK - (temperatureK - boundaryK), 'equilibriumDeltaK') * -Math.expm1(-conductanceWK * dtS / capacitanceJK)
    : generatedW * dtS / capacitanceJK;
  const storedW = capacitanceJK * delta / dtS;
  return finiteOutputs({ temperatureK: temperatureK + delta, removedW: generatedW - storedW, storedW }, 'integrateNode');
}
export function advanceThermal(input: ThermalInput): ThermalResult {
  if (!input || typeof input !== 'object') failure('invalid-input', 'THERMAL_INPUT', 'Thermal input must be an object.');
  finiteNumber(input.dtS, 'dtS', { min: 0, max: 1, unit: 's' });
  finiteNumber(input.airK, 'airK', { min: Number.MIN_VALUE, unit: 'K' });
  for (const key of ['itW', 'facilityW', 'technicalPumpW', 'seawaterPumpW'] as const) finiteNumber(input[key], key, { min: 0, unit: 'W' });
  if (typeof input.fanPowered !== 'boolean') failure('invalid-input', 'INVALID_BOOLEAN', 'fanPowered must be a boolean.', { field: 'fanPowered' });
  const a = THERMAL_ASSUMPTIONS;
  const exchanger = solveExchanger({ technicalInletK: input.coolantK, seawaterInletK: input.seawaterK,
    technicalFlowM3S: input.technicalFlowM3S, seawaterFlowM3S: input.seawaterFlowM3S,
    cleanUAWPerK: input.exchangerUAWPerK, foulingResistanceKPerW: input.foulingResistanceKPerW });
  const liquidCapture=input.liquidCaptureFraction??a.liquidCapture;finiteNumber(liquidCapture,'liquidCaptureFraction',{min:0,max:1});
  const coolantHeat = checked(input.itW * liquidCapture + input.technicalPumpW * a.pumpToFluidFraction, 'coolantHeatW');
  const seaDirectHeat = checked(input.seawaterPumpW * a.pumpToFluidFraction, 'seaDirectHeatW');
  const airHeat = checked(input.facilityW - coolantHeat - seaDirectHeat, 'airHeatW');
  if (airHeat < -1e-6) failure('invalid-input', 'THERMAL_ENERGY_BOUNDARY', 'Facility boundary omits an electrical heat source.', { field: 'facilityW', unit: 'W', details: { facilityW: input.facilityW, coolantHeatW: coolantHeat, seaDirectHeatW: seaDirectHeat } });
  const coolant = integrateNode(input.coolantK, input.seawaterK, coolantHeat, exchanger.conductanceWPerK, a.coolantCapacitanceJK, input.dtS);
  const air = integrateNode(input.airK, a.ambientK, airHeat, a.passiveAirConductanceWK + (input.fanPowered ? a.fanAirConductanceWK : 0), a.airCapacitanceJK, input.dtS);
  const cTechnical = input.technicalFlowM3S * a.technicalDensityKgM3 * a.technicalCpJKgK;
  const cSea = input.seawaterFlowM3S * a.seawaterDensityKgM3 * a.seawaterCpJKgK;
  const meanCoolantK = exchanger.conductanceWPerK > 0 ? input.seawaterK + coolant.removedW / exchanger.conductanceWPerK : (input.coolantK + coolant.temperatureK) / 2;
  const rejectedHeatW = coolant.removedW + seaDirectHeat;
  const storedHeatW = coolant.storedW + air.storedW;
  const residualW = input.facilityW - rejectedHeatW - air.removedW - storedHeatW;
  return finiteOutputs({ coolantK: coolant.temperatureK, airK: air.temperatureK,
    technicalOutletK: cTechnical > 0 ? meanCoolantK - coolant.removedW / cTechnical : coolant.temperatureK,
    seawaterOutletK: cSea > 0 ? input.seawaterK + rejectedHeatW / cSea : input.seawaterK,
    rejectedHeatW, ambientHeatW: air.removedW, storedHeatW, residualW,
    normalizedResidual: residualW / Math.max(1, input.facilityW, Math.abs(storedHeatW)) }, 'advanceThermal');
}

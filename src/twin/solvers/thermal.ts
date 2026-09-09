export const THERMAL_ASSUMPTIONS = Object.freeze({
  technicalDensityKgM3: 997, technicalCpJKgK: 4180, seawaterDensityKgM3: 1025, seawaterCpJKgK: 3990,
  liquidCapture: 0.9, coolantCapacitanceJK: 24e6, airCapacitanceJK: 12e6,
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
export function solveExchanger(input: ExchangerInput): ExchangerResult {
  for (const [key, value] of Object.entries(input)) if (!Number.isFinite(value)) throw new Error(`Invalid exchanger ${key}`);
  if (input.technicalInletK < 273.15 || input.technicalInletK > 373.15 || input.seawaterInletK < 271.15 || input.seawaterInletK > 343.15) throw new Error('Exchanger fluid temperature outside declared single-phase property range');
  if (input.technicalFlowM3S < 0 || input.seawaterFlowM3S < 0 || input.cleanUAWPerK < 0 || input.foulingResistanceKPerW < 0) throw new Error('Negative exchanger flow, UA, or fouling resistance');
  const properties = [input.technicalDensityKgM3 ?? 997, input.technicalCpJKgK ?? 4180, input.seawaterDensityKgM3 ?? 1025, input.seawaterCpJKgK ?? 3990];
  if (properties.some(v => v <= 0)) throw new Error('Fluid properties must be positive');
  const cTechnical = input.technicalFlowM3S * properties[0] * properties[1];
  const cSea = input.seawaterFlowM3S * properties[2] * properties[3];
  const ua = input.cleanUAWPerK === 0 ? 0 : 1 / (1 / input.cleanUAWPerK + input.foulingResistanceKPerW);
  const cMin = Math.min(cTechnical, cSea), cMax = Math.max(cTechnical, cSea);
  let effectiveness = 0;
  if (cMin > 0 && ua > 0) {
    const ratio = cMin / cMax, ntu = ua / cMin;
    if (Math.abs(1 - ratio) < 1e-8) effectiveness = ntu / (1 + ntu);
    else { const z = Math.exp(-ntu * (1 - ratio)); effectiveness = -Math.expm1(-ntu * (1 - ratio)) / (1 - ratio * z); }
  }
  const conductanceWPerK = effectiveness * cMin;
  const heatW = conductanceWPerK * (input.technicalInletK - input.seawaterInletK);
  const technicalOutletK = cTechnical > 0 ? input.technicalInletK - heatW / cTechnical : input.technicalInletK;
  const seawaterOutletK = cSea > 0 ? input.seawaterInletK + heatW / cSea : input.seawaterInletK;
  return { heatW, technicalOutletK, seawaterOutletK, effectiveUAWPerK: ua, effectiveness, conductanceWPerK,
    balanceResidualW: cTechnical * (input.technicalInletK - technicalOutletK) - cSea * (seawaterOutletK - input.seawaterInletK) };
}
export interface ThermalInput {
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
  if (dtS === 0) return { temperatureK, removedW: conductanceWK * (temperatureK - boundaryK), storedW: generatedW - conductanceWK * (temperatureK - boundaryK) };
  const delta = conductanceWK > 0
    ? (generatedW / conductanceWK - (temperatureK - boundaryK)) * -Math.expm1(-conductanceWK * dtS / capacitanceJK)
    : generatedW * dtS / capacitanceJK;
  const storedW = capacitanceJK * delta / dtS;
  return { temperatureK: temperatureK + delta, removedW: generatedW - storedW, storedW };
}
export function advanceThermal(input: ThermalInput): ThermalResult {
  if (!Number.isFinite(input.dtS) || input.dtS < 0 || input.dtS > 1) throw new Error('Thermal interval must be 0–1 second');
  const a = THERMAL_ASSUMPTIONS;
  const exchanger = solveExchanger({ technicalInletK: input.coolantK, seawaterInletK: input.seawaterK,
    technicalFlowM3S: input.technicalFlowM3S, seawaterFlowM3S: input.seawaterFlowM3S,
    cleanUAWPerK: input.exchangerUAWPerK, foulingResistanceKPerW: input.foulingResistanceKPerW });
  const coolantHeat = input.itW * a.liquidCapture + input.technicalPumpW * a.pumpToFluidFraction;
  const seaDirectHeat = input.seawaterPumpW * a.pumpToFluidFraction;
  const airHeat = input.facilityW - coolantHeat - seaDirectHeat;
  if (airHeat < -1e-6) throw new Error('Facility boundary omits an electrical heat source');
  const coolant = integrateNode(input.coolantK, input.seawaterK, coolantHeat, exchanger.conductanceWPerK, a.coolantCapacitanceJK, input.dtS);
  const air = integrateNode(input.airK, a.ambientK, airHeat, a.passiveAirConductanceWK + (input.fanPowered ? a.fanAirConductanceWK : 0), a.airCapacitanceJK, input.dtS);
  const cTechnical = input.technicalFlowM3S * a.technicalDensityKgM3 * a.technicalCpJKgK;
  const cSea = input.seawaterFlowM3S * a.seawaterDensityKgM3 * a.seawaterCpJKgK;
  const meanCoolantK = exchanger.conductanceWPerK > 0 ? input.seawaterK + coolant.removedW / exchanger.conductanceWPerK : (input.coolantK + coolant.temperatureK) / 2;
  const rejectedHeatW = coolant.removedW + seaDirectHeat;
  const storedHeatW = coolant.storedW + air.storedW;
  const residualW = input.facilityW - rejectedHeatW - air.removedW - storedHeatW;
  return { coolantK: coolant.temperatureK, airK: air.temperatureK,
    technicalOutletK: cTechnical > 0 ? meanCoolantK - coolant.removedW / cTechnical : coolant.temperatureK,
    seawaterOutletK: cSea > 0 ? input.seawaterK + rejectedHeatW / cSea : input.seawaterK,
    rejectedHeatW, ambientHeatW: air.removedW, storedHeatW, residualW,
    normalizedResidual: residualW / Math.max(1, input.facilityW, Math.abs(storedHeatW)) };
}

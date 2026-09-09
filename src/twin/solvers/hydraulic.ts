/** Single-phase, incompressible series circuit with identical parallel pumps. SI only. */
export interface HydraulicInput {
  lengthM: number; diameterM: number; roughnessM: number; densityKgM3: number;
  dynamicViscosityPaS: number; fittingsK: number; equipmentDropPaAtReference: number;
  referenceFlowM3S: number; pumpCount: number; pumpSpeed: number;
  shutoffPa?: number; freeFlowM3S?: number; efficiency?: number;
}
export interface HydraulicResult {
  flowM3S: number; pressurePa: number; electricalW: number; reynolds: number;
  darcyFactor: number; headResidualPa: number; massResidualKgS: number; iterations: number;
}
function nonnegative(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and non-negative`);
}
/** Darcy (not Fanning) factor. Transition is a declared linear interpolation. */
export function darcyFrictionFactor(reynolds: number, relativeRoughness: number): number {
  nonnegative(reynolds, 'Reynolds number'); nonnegative(relativeRoughness, 'Relative roughness');
  if (reynolds === 0) return 0;
  if (reynolds <= 2300) return 64 / reynolds;
  const turbulent = (re: number) => 1 / (-1.8 * Math.log10((relativeRoughness / 3.7) ** 1.11 + 6.9 / re)) ** 2;
  if (reynolds >= 4000) return turbulent(reynolds);
  const blend = (reynolds - 2300) / 1700;
  return (1 - blend) * 64 / 2300 + blend * turbulent(4000);
}
export function systemPressurePa(input: HydraulicInput, flowM3S: number): number {
  if (flowM3S === 0) return 0;
  const velocity = flowM3S / (Math.PI * input.diameterM ** 2 / 4);
  const re = input.densityKgM3 * velocity * input.diameterM / input.dynamicViscosityPaS;
  const darcy = darcyFrictionFactor(re, input.roughnessM / input.diameterM);
  return (darcy * input.lengthM / input.diameterM + input.fittingsK) * input.densityKgM3 * velocity ** 2 / 2
    + input.equipmentDropPaAtReference * (flowM3S / input.referenceFlowM3S) ** 2;
}
export function solveHydraulics(input: HydraulicInput): HydraulicResult {
  for (const key of ['lengthM', 'roughnessM', 'fittingsK', 'equipmentDropPaAtReference', 'pumpSpeed'] as const) nonnegative(input[key], key);
  for (const key of ['diameterM', 'densityKgM3', 'dynamicViscosityPaS', 'referenceFlowM3S'] as const) {
    if (!Number.isFinite(input[key]) || input[key] <= 0) throw new Error(`${key} must be positive`);
  }
  if (!Number.isInteger(input.pumpCount) || input.pumpCount < 0 || input.pumpCount > 2) throw new Error('Unsupported pump topology: support zero, one, or two identical parallel pumps');
  if (input.pumpSpeed > 1.2) throw new Error('Pump speed exceeds supported affinity-law range 0–1.2');
  const shutoff = input.shutoffPa ?? 250_000, freeFlow = input.freeFlowM3S ?? 0.1, efficiency = input.efficiency ?? 0.72;
  if (!(shutoff > 0 && freeFlow > 0 && efficiency > 0 && efficiency <= 1)) throw new Error('Invalid pump rating');
  if (!input.pumpCount || !input.pumpSpeed) return { flowM3S: 0, pressurePa: 0, electricalW: 0, reynolds: 0, darcyFactor: 0, headResidualPa: 0, massResidualKgS: 0, iterations: 0 };
  const freeTotal = input.pumpCount * freeFlow * input.pumpSpeed;
  const pumpPressure = (q: number) => shutoff * input.pumpSpeed ** 2 * (1 - (q / freeTotal) ** 2);
  let low = 0, high = freeTotal, iterations = 0;
  while (iterations < 60 && high - low > 1e-12) {
    const mid = (low + high) / 2;
    if (pumpPressure(mid) > systemPressurePa(input, mid)) low = mid; else high = mid;
    iterations++;
  }
  const flowM3S = (low + high) / 2, pressurePa = systemPressurePa(input, flowM3S);
  const velocity = flowM3S / (Math.PI * input.diameterM ** 2 / 4);
  const reynolds = input.densityKgM3 * velocity * input.diameterM / input.dynamicViscosityPaS;
  return { flowM3S, pressurePa, electricalW: pressurePa * flowM3S / efficiency, reynolds,
    darcyFactor: darcyFrictionFactor(reynolds, input.roughnessM / input.diameterM),
    headResidualPa: pumpPressure(flowM3S) - pressurePa, massResidualKgS: 0, iterations };
}

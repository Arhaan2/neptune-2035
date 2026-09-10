import { catalogSpecification } from '../catalog/equipment';
import { failure, finiteNumber, finiteOutputs } from '../safety';

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
function positive(value: unknown, field: string, unit: string) {
  finiteNumber(value, field, { min: Number.MIN_VALUE, unit });
}
function pumpRating(input: HydraulicInput, field: 'shutoffPa' | 'freeFlowM3S' | 'efficiency', fallback: number, unit: string) {
  const value = Object.hasOwn(input, field) ? input[field] : fallback;
  positive(value, field, unit);
  if (field === 'efficiency') finiteNumber(value, field, { max: 1, unit });
  return value as number;
}
function validateInput(input: HydraulicInput) {
  if (!input || typeof input !== 'object') failure('invalid-input', 'HYDRAULIC_INPUT', 'Hydraulic input must be an object.');
  for (const [field, unit] of [['lengthM', 'm'], ['roughnessM', 'm'], ['fittingsK', '1'], ['equipmentDropPaAtReference', 'Pa'], ['pumpSpeed', '1']] as const) finiteNumber(input[field], field, { min: 0, unit });
  for (const [field, unit] of [['diameterM', 'm'], ['densityKgM3', 'kg/m³'], ['dynamicViscosityPaS', 'Pa·s'], ['referenceFlowM3S', 'm³/s']] as const) positive(input[field], field, unit);
  finiteNumber(input.pumpCount, 'pumpCount', { min: 0, integer: true, unit: 'pumps' });
  if (input.pumpCount > 2) failure('unsupported-configuration', 'HYDRAULIC_TOPOLOGY', 'Unsupported pump topology: support zero, one, or two identical parallel pumps.', { field: 'pumpCount', unit: 'pumps', details: { maximum: 2, received: input.pumpCount } });
  if (input.pumpSpeed > 1.2) failure('unsupported-configuration', 'HYDRAULIC_AFFINITY_RANGE', 'Pump speed exceeds supported affinity-law range 0–1.2.', { field: 'pumpSpeed', unit: '1', details: { maximum: 1.2, received: input.pumpSpeed } });
  return {
    shutoff: pumpRating(input, 'shutoffPa', catalogSpecification('pump-reference').ratings.shutoffPa, 'Pa'),
    freeFlow: pumpRating(input, 'freeFlowM3S', catalogSpecification('pump-reference').ratings.freeFlowM3S, 'm³/s'),
    efficiency: pumpRating(input, 'efficiency', catalogSpecification('pump-reference').ratings.efficiency, '1'),
  };
}
function checked(value: number, field: string): number {
  return finiteOutputs({ [field]: value }, 'hydraulic')[field];
}
/** Darcy (not Fanning) factor. Transition is a declared linear interpolation. */
export function darcyFrictionFactor(reynolds: number, relativeRoughness: number): number {
  finiteNumber(reynolds, 'reynolds', { min: 0, unit: '1' });
  finiteNumber(relativeRoughness, 'relativeRoughness', { min: 0, unit: '1' });
  if (reynolds === 0) return 0;
  if (reynolds <= 2300) return checked(64 / reynolds, 'darcyFactor');
  const turbulent = (re: number) => checked(1 / (-1.8 * Math.log10(checked((relativeRoughness / 3.7) ** 1.11 + 6.9 / re, 'roughnessLogArgument'))) ** 2, 'darcyFactor');
  if (reynolds >= 4000) return turbulent(reynolds);
  const blend = (reynolds - 2300) / 1700;
  return checked((1 - blend) * 64 / 2300 + blend * turbulent(4000), 'darcyFactor');
}
export function systemPressurePa(input: HydraulicInput, flowM3S: number): number {
  validateInput(input);
  finiteNumber(flowM3S, 'flowM3S', { min: 0, unit: 'm³/s' });
  return pressureAtFlow(input, flowM3S);
}
/** Internal hot path: input is validated once by the public boundary. */
function pressureAtFlow(input: HydraulicInput, flowM3S: number): number {
  if (flowM3S === 0) return 0;
  const area = checked(Math.PI * input.diameterM ** 2 / 4, 'pipeAreaM2');
  const velocity = checked(flowM3S / area, 'velocityMS');
  const re = checked(input.densityKgM3 * velocity * input.diameterM / input.dynamicViscosityPaS, 'reynolds');
  const darcy = darcyFrictionFactor(re, checked(input.roughnessM / input.diameterM, 'relativeRoughness'));
  return checked((darcy * input.lengthM / input.diameterM + input.fittingsK) * input.densityKgM3 * velocity ** 2 / 2
    + input.equipmentDropPaAtReference * (flowM3S / input.referenceFlowM3S) ** 2, 'pressurePa');
}
export function solveHydraulics(input: HydraulicInput): HydraulicResult {
  const { shutoff, freeFlow, efficiency } = validateInput(input);
  if (!input.pumpCount || !input.pumpSpeed) return { flowM3S: 0, pressurePa: 0, electricalW: 0, reynolds: 0, darcyFactor: 0, headResidualPa: 0, massResidualKgS: 0, iterations: 0 };
  const freeTotal = checked(input.pumpCount * freeFlow * input.pumpSpeed, 'freeTotalM3S');
  const shutoffHead = checked(shutoff * input.pumpSpeed ** 2, 'shutoffHeadPa');
  if (freeTotal === 0 || shutoffHead === 0) failure('numerical-failure', 'HYDRAULIC_UNDERFLOW', 'Positive pump input underflowed to a zero operating envelope.', { field: freeTotal === 0 ? 'freeTotalM3S' : 'shutoffHeadPa' });
  const pumpPressure = (q: number) => checked(shutoffHead * (1 - (q / freeTotal) ** 2), 'pumpPressurePa');
  const flowToleranceM3S = Math.min(1e-12, freeTotal * 1e-10);
  let low = 0, high = freeTotal, iterations = 0;
  while (iterations < 60 && high - low > flowToleranceM3S) {
    const mid = low + (high - low) / 2;
    if (mid === low || mid === high) break;
    if (pumpPressure(mid) > pressureAtFlow(input, mid)) low = mid; else high = mid;
    iterations++;
  }
  const flowM3S = low + (high - low) / 2, pressurePa = pressureAtFlow(input, flowM3S);
  const headResidualPa = checked(pumpPressure(flowM3S) - pressurePa, 'headResidualPa');
  if (high - low > flowToleranceM3S || Math.abs(headResidualPa) > 0.01 + shutoffHead * 1e-10) failure('numerical-failure', 'HYDRAULIC_NONCONVERGENCE', 'Hydraulic crossing did not converge within the bounded 60-iteration solve.', { field: 'headResidualPa', unit: 'Pa', details: { iterations, headResidualPa, flowBracketM3S: high - low, flowToleranceM3S } });
  const velocity = checked(flowM3S / (Math.PI * input.diameterM ** 2 / 4), 'velocityMS');
  const reynolds = checked(input.densityKgM3 * velocity * input.diameterM / input.dynamicViscosityPaS, 'reynolds');
  return finiteOutputs({ flowM3S, pressurePa, electricalW: pressurePa * flowM3S / efficiency, reynolds,
    darcyFactor: darcyFrictionFactor(reynolds, input.roughnessM / input.diameterM),
    headResidualPa, massResidualKgS: 0, iterations }, 'solveHydraulics');
}

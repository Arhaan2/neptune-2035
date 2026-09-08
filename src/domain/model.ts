export type Generation = 1 | 2 | 3;
export interface Scenario {
  generation: Generation;
  requestedGpuCount: number;
  utilization: number;
  assumedPUE: number;
  seawaterInletC: number;
  nodePeakKW: number;
  idleFraction: number;
  externalNetworkingStorageFraction: number;
  seawaterTemperatureRiseK: number;
  targetTechnicalCoolantSupplyC: number;
  assumedHeatExchangerApproachC: number;
  availableSupplyMW: number;
}
export const CAPACITY = Object.freeze({
  gpusPerNode: 8,
  nodesPerRack: 4,
  nodeHeightU: 10,
  rackHeightU: 48,
  rackPowerLimitKW: 120,
  racksPerModule: 80,
  moduleFloorAreaM2: 320,
  modulesPerPlatform: 8,
  densityKgPerM3: 1025,
  specificHeatJPerKgK: 3990,
});
export const BOUNDS: Record<
  Exclude<keyof Scenario, 'generation'>,
  readonly [number, number]
> = {
  requestedGpuCount: [8, 1_000_000],
  utilization: [0, 1],
  assumedPUE: [1, 2],
  seawaterInletC: [-2, 38],
  nodePeakKW: [5, 30],
  idleFraction: [0.1, 0.8],
  externalNetworkingStorageFraction: [0, 0.3],
  seawaterTemperatureRiseK: [1, 15],
  targetTechnicalCoolantSupplyC: [20, 50],
  assumedHeatExchangerApproachC: [1, 15],
  availableSupplyMW: [1, 10_000],
};
export const DEFAULT_SCENARIO: Scenario = {
  generation: 2,
  requestedGpuCount: 100_000,
  utilization: 0.8,
  assumedPUE: 1.15,
  seawaterInletC: 18,
  nodePeakKW: 14.3,
  idleFraction: 0.3,
  externalNetworkingStorageFraction: 0.08,
  seawaterTemperatureRiseK: 5,
  targetTechnicalCoolantSupplyC: 32,
  assumedHeatExchangerApproachC: 5,
  availableSupplyMW: 300,
};
export const PRESETS = [
  {
    generation: 1 as const,
    year: 2026,
    title: 'The pilot',
    description: 'Present-day-inspired pilot concept',
    requestedGpuCount: 10_000,
    availableSupplyMW: 30,
  },
  {
    generation: 2 as const,
    year: 2030,
    title: 'The modular campus',
    description: 'Hypothetical modular campus',
    requestedGpuCount: 100_000,
    availableSupplyMW: 300,
  },
  {
    generation: 3 as const,
    year: 2035,
    title: 'The compute archipelago',
    description: 'Speculative gigawatt-scale archipelago',
    requestedGpuCount: 500_000,
    availableSupplyMW: 1200,
  },
];
export function presetScenario(generation: Generation): Scenario {
  const p = PRESETS[generation - 1];
  return {
    ...DEFAULT_SCENARIO,
    generation,
    requestedGpuCount: p.requestedGpuCount,
    availableSupplyMW: p.availableSupplyMW,
  };
}
export function validateScenario(
  value: unknown,
): { valid: true; scenario: Scenario } | { valid: false; errors: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { valid: false, errors: ['Scenario must be an object.'] };
  const v = value as Record<string, unknown>;
  const errors: string[] = [];
  if (![1, 2, 3].includes(v.generation as number))
    errors.push('Generation must be I, II or III.');
  for (const [key, [min, max]] of Object.entries(BOUNDS)) {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      errors.push(`${key} must be between ${min} and ${max}.`);
  }
  if (!Number.isInteger(v.requestedGpuCount))
    errors.push('Requested GPU count must be a whole number.');
  if (errors.length) return { valid: false, errors };
  const scenario = {
    generation: v.generation,
    ...Object.fromEntries(Object.keys(BOUNDS).map((k) => [k, v[k]])),
  } as Scenario;
  return { valid: true, scenario };
}
export function simulate(input: Scenario) {
  const parsed = validateScenario(input);
  if (!parsed.valid) throw new RangeError(parsed.errors.join(' '));
  const s = parsed.scenario;
  const nodeCount = Math.ceil(s.requestedGpuCount / CAPACITY.gpusPerNode);
  const provisionedGpuCount = nodeCount * CAPACITY.gpusPerNode;
  const computePeakKW = nodeCount * s.nodePeakKW;
  const otherITKW = computePeakKW * s.externalNetworkingStorageFraction;
  const itPeakMW = (computePeakKW + otherITKW) / 1000;
  const itOperatingMW =
    (computePeakKW * (s.idleFraction + (1 - s.idleFraction) * s.utilization) +
      otherITKW) /
    1000;
  const facilityPeakMW = itPeakMW * s.assumedPUE;
  const facilityOperatingMW = itOperatingMW * s.assumedPUE;
  const annualEnergyMWh = facilityOperatingMW * 8760;
  const rackCount = Math.ceil(nodeCount / CAPACITY.nodesPerRack);
  const moduleCount = Math.ceil(rackCount / CAPACITY.racksPerModule);
  const platformCount = Math.ceil(moduleCount / CAPACITY.modulesPerPlatform);
  const heatRejectedOperatingMW = itOperatingMW;
  const heatRejectedPeakMW = itPeakMW;
  const flow = (mw: number) =>
    (mw * 1e6) /
    (CAPACITY.densityKgPerM3 *
      CAPACITY.specificHeatJPerKgK *
      s.seawaterTemperatureRiseK);
  const operatingFlowM3PerS = flow(heatRejectedOperatingMW);
  const peakFlowM3PerS = flow(heatRejectedPeakMW);
  const temperatureHeadroomC =
    s.targetTechnicalCoolantSupplyC -
    (s.seawaterInletC + s.assumedHeatExchangerApproachC);
  const warnings: { code: 'thermal' | 'supply'; message: string }[] = [];
  if (temperatureHeadroomC <= 0)
    warnings.push({
      code: 'thermal',
      message:
        'Insufficient temperature headroom. This screen does not establish cooling feasibility; a different thermal design is needed.',
    });
  if (facilityPeakMW > s.availableSupplyMW)
    warnings.push({
      code: 'supply',
      message: `Peak design demand exceeds the assumed ${s.availableSupplyMW.toLocaleString()} MW supply ceiling. Interconnection is unresolved.`,
    });
  return {
    nodeCount,
    provisionedGpuCount,
    roundingGpuCount: provisionedGpuCount - s.requestedGpuCount,
    computePeakKW,
    otherITKW,
    itPeakMW,
    itOperatingMW,
    facilityPeakMW,
    facilityOperatingMW,
    annualEnergyMWh,
    rackCount,
    moduleCount,
    platformCount,
    moduleFloorAreaM2: moduleCount * CAPACITY.moduleFloorAreaM2,
    rackPeakKW: s.nodePeakKW * CAPACITY.nodesPerRack,
    heatRejectedOperatingMW,
    heatRejectedPeakMW,
    operatingFlowM3PerS,
    peakFlowM3PerS,
    temperatureHeadroomC,
    seawaterDischargeC: s.seawaterInletC + s.seawaterTemperatureRiseK,
    warnings,
  };
}
export type Model = ReturnType<typeof simulate>;
export const fmt = (n: number, digits = 1) =>
  n.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

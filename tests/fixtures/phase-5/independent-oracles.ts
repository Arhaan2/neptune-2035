/** Independent acceptance arithmetic. This file imports no production code. */
export interface Resource { id: string; ratingW: number; nativeW: number }
export interface Bundle { id: string; priority: number; drawW: number; resources: string[] }

/** Exhaustively enumerate feasible subsets, then choose lexicographic priority.
 * Intentionally not the production greedy allocation algorithm. Bounded test fixtures only. */
export function capacityOracle(resources: Resource[], bundles: Bundle[]) {
  if (bundles.length > 12) throw Error('Oracle is bounded to twelve test bundles.');
  const ordered = [...bundles].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  let best: Bundle[] = [];
  let bestPreference = -1;
  for (let mask = 0; mask < 2 ** ordered.length; mask++) {
    const chosen = ordered.filter((_, index) => (mask & (1 << index)) !== 0);
    const feasible = resources.every(resource => resource.nativeW + chosen.filter(bundle => bundle.resources.includes(resource.id)).reduce((sum, bundle) => sum + bundle.drawW, 0) <= resource.ratingW);
    const preference = ordered.reduce((sum, _, index) => sum + ((mask & (1 << index)) ? 2 ** (ordered.length - index - 1) : 0), 0);
    if (feasible && preference > bestPreference) { best = chosen; bestPreference = preference; }
  }
  return { admittedIds: best.map(bundle => bundle.id), unservedIds: ordered.filter(bundle => !best.includes(bundle)).map(bundle => bundle.id), spareW: Object.fromEntries(resources.map(resource => [resource.id, resource.ratingW - resource.nativeW - best.filter(bundle => bundle.resources.includes(resource.id)).reduce((sum, bundle) => sum + bundle.drawW, 0)])) };
}

export interface ServiceInterval { startS: number; endS: number; required: number; serviceable: number }
/** Area under the declared shortfall curve, independent of engine/evaluator. */
export function serviceOracle(intervals: ServiceInterval[]) {
  let shortfallAcceleratorS = 0, serviceViolationS = 0;
  for (const interval of intervals) {
    if (!(interval.endS > interval.startS)) throw Error('Positive intervals required.');
    const shortfall = Math.max(0, interval.required - interval.serviceable);
    shortfallAcceleratorS += shortfall * (interval.endS - interval.startS);
    if (shortfall > 0) serviceViolationS += interval.endS - interval.startS;
  }
  return { shortfallAcceleratorS, serviceViolationS, firstServiceViolationS: intervals.find(interval => interval.serviceable < interval.required)?.startS ?? null, minimumServiceable: Math.min(...intervals.map(interval => interval.serviceable)) };
}

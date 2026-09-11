import { describe, expect, it } from 'vitest';
import { createDecisionCampaign, decisionCandidate } from '../src/twin/decision/candidates';
import { decisionCampaignIdentity, validateDecisionCampaign } from '../src/twin/decision/contract';
import { DECISION_LIMITS, DECISION_VERSION, type DecisionCampaign } from '../src/twin/decision/types';
import { billOfEquipment } from '../src/twin/analysis/reports';

describe('PH6 contract boundaries and fixed discrete candidate fairness', () => {
  it.each(['transfer', 'no-benefit-bus', 'no-benefit-source', 'nominal', 'sizing', 'sensitivity'] as const)('admits the complete frozen %s fixture', fixture => {
    const c = createDecisionCampaign(fixture);
    expect(() => validateDecisionCampaign(c)).not.toThrow();
    expect(c.version).toBe(DECISION_VERSION);
    expect(c.candidates.length).toBeLessThanOrEqual(DECISION_LIMITS.candidates);
    expect(c.scenarios.some(s => s.kind === 'nominal')).toBe(true);
    expect(c.exclusions.join(' ')).toMatch(/physical validation/);
  });
  it('freezes A workload, explicit absolute recovery, total interruption and authoritative transfer premium before ranking', () => {
    const c = createDecisionCampaign('transfer');
    expect(c.requirements).toEqual({ nominalUnmetAcceleratorS: 0, faultUnmetAcceleratorS: 24, totalInterruptionS: 3, thermalViolationS: 0, recoveryConfirmationDeadlineS: 10, recoveryDwellS: 5, timeOrigin: 'absolute-evaluation-time' });
    expect(c.candidates.map(d => d.workload)).toEqual([24, 24, 24]);
    expect(c.candidates.map(d => d.design.config.workload)).toEqual([0.8, 0.8, 0.8]);
    const [ii, iii, disabled] = c.candidates;
    expect(iii.design.assets).toEqual(disabled.design.assets);
    expect(iii.design.connections).toEqual(disabled.design.connections);
    expect(iii.design.transfer?.enabled).toBe(true); expect(disabled.design.transfer?.enabled).toBe(false);
    expect(billOfEquipment(iii.design).totalUSD - billOfEquipment(ii.design).totalUSD).toBe(240_000);
    expect(billOfEquipment(iii.design).totalUSD).toBe(billOfEquipment(disabled.design).totalUSD);
  });
  it('sizes only declared whole-server requests and includes an actual bounded thermal horizon', () => {
    const c = createDecisionCampaign('sizing');
    expect(c.objective).toMatchObject({ mode: 'maximum-passing-workload', direction: 'descending', unit: 'accelerators', fixedWorkload: null, supplyCeilingW: 120_000 });
    expect(c.candidates.map(d => d.workload)).toEqual([8, 16, 24, 32, 40, 48]);
    for (const candidate of c.candidates) {
      expect(candidate.design.provisionedAccelerators).toBe(candidate.workload);
      expect(Number.isInteger(candidate.design.nodeCount)).toBe(true);
    }
    expect(c.scenarios.find(s => s.kind === 'thermal')).toMatchObject({ durationS: 120, initialMode: 'cold', settling: 'not-requested' });
  });
  it('paired OFAT bounds are exploratory and explicitly disclose overlapping and untested combinations', () => {
    const c = createDecisionCampaign('sensitivity');
    expect(c.sensitivities).toHaveLength(9);
    for (const parameter of ['idleFraction', 'exchangerUAWPerK', 'foulingResistanceKPerW', 'unitCostScale']) expect(c.sensitivities.filter(s => s.parameter === parameter)).toHaveLength(2);
    expect(c.sensitivityNote).toMatch(/overlap/i); expect(c.sensitivityNote).toMatch(/Joint combinations are untested/);
    expect(c.sensitivities.every(s => s.evidence === 'exploratory-assumption')).toBe(true);
  });
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite numeric input %s without JSON coercion', value => {
    const c = createDecisionCampaign(); c.objective.budgetUSD = value;
    expect(() => validateDecisionCampaign(c)).toThrow();
  });
  const invalid: [string, (c: DecisionCampaign) => void][] = [
    ['wrong objective units', c => { c.objective.unit = 'W' as 'USD'; }],
    ['wrong ranking direction', c => { c.objective.direction = 'descending'; }],
    ['unsupported contract version', c => { c.version = 'decision-campaign-999' as typeof DECISION_VERSION; }],
    ['unsupported solver version', c => { c.versions.solver = 'invented'; }],
    ['ambiguous relative recovery origin', c => { c.requirements.timeOrigin = 'since-disturbance' as 'absolute-evaluation-time'; }],
    ['negative interruption allowance', c => { c.requirements.totalInterruptionS = -1; }],
    ['nonzero nominal unmet demand', c => { c.requirements.nominalUnmetAcceleratorS = 1; }],
    ['fractional fixed requested workload', c => { c.objective.fixedWorkload = 24.5; }],
    ['duplicate candidate ID', c => { c.candidates[1].id = c.candidates[0].id; }],
    ['duplicate physical candidate', c => { c.candidates.push({ ...structuredClone(c.candidates[0]), id: 'same-design-different-label' }); }],
    ['duplicate scenario identity', c => { c.scenarios.push(structuredClone(c.scenarios[0])); }],
    ['duplicate sensitivity identity', c => { c.sensitivities.push(structuredClone(c.sensitivities[0])); }],
    ['unsupported candidate topology', c => { c.candidates[0].topology = 'parallel-independent-sources'; }],
    ['stale physical identity', c => { c.candidates[0].physicalIdentity = 'forged'; }],
    ['different fixed workloads', c => { c.candidates[0] = createDecisionCampaign('sizing').candidates[0]; }],
    ['unpaired candidate environment', c => { const d = structuredClone(c.candidates[1].design); d.config.seawaterK += 1; c.candidates[1] = decisionCandidate(c.candidates[1].id, c.candidates[1].label, d); }],
    ['missing unfaulted baseline', c => { c.scenarios = c.scenarios.filter(s => s.kind !== 'nominal'); }],
    ['fault after observation', c => { c.scenarios[1].disturbanceTimeS = 13; }],
    ['ambiguous nominal fault time', c => { c.scenarios[0].disturbanceTimeS = 2; }],
    ['out-of-envelope horizon', c => { c.scenarios[0].durationS = 121; }],
    ['unbounded worker pool', c => { c.execution.concurrency = 3 as 2; }],
    ['unsupported integration step', c => { c.execution.integrationStepS = 0.1 as 1; }],
    ['unsupported currency', c => { c.costPolicy.currency = 'EUR' as 'USD'; }],
    ['statistical claim on assumed bounds', c => { c.sensitivities[0].evidence = '95%-confidence' as 'exploratory-assumption'; }],
  ];
  it.each(invalid)('rejects %s', (_name, mutate) => {
    const c = createDecisionCampaign(); mutate(c); expect(() => validateDecisionCampaign(c)).toThrow();
  });
  it.each(['faultUnmetAcceleratorS', 'totalInterruptionS', 'thermalViolationS', 'recoveryConfirmationDeadlineS'] as const)('rejects missing mandatory requirement %s rather than treating absence as zero', key => {
    const c = createDecisionCampaign(); delete (c.requirements as Partial<DecisionCampaign['requirements']>)[key];
    expect(() => validateDecisionCampaign(c)).toThrow();
  });
  it('allows an explicit empty candidate set for a distinct no-admissible result', () => {
    const c = createDecisionCampaign(); c.candidates = [];
    expect(() => validateDecisionCampaign(c)).not.toThrow();
  });
  it('changes campaign identity for each behavior, economic or policy edit, while object-key order is immaterial', () => {
    const c = createDecisionCampaign(), original = decisionCampaignIdentity(c);
    const mutations: ((d: DecisionCampaign) => void)[] = [d => { d.objective.budgetUSD = 1; }, d => { d.requirements.totalInterruptionS = 2; }, d => { d.execution.integrationStepS = 0.5; }, d => { d.scenarios[1].disturbanceTimeS = 3; }, d => { d.versions.solver += '-different'; }];
    for (const mutate of mutations) { const d = structuredClone(c); mutate(d); expect(decisionCampaignIdentity(d)).not.toBe(original); }
    expect(decisionCampaignIdentity(Object.fromEntries(Object.entries(c).reverse()) as unknown as DecisionCampaign)).toBe(original);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { createDecisionCampaign } from '../src/twin/decision/candidates';
import { runDecisionCampaign } from '../src/twin/decision/runner';
import { compareReproduction, decisionReport, exportDecisionCampaign, importDecisionCampaign, validateDecisionResult } from '../src/twin/decision/evidence';
import { identity } from '../src/twin/persistence/structure';
import type { DecisionExport, DecisionResult } from '../src/twin/decision/types';

const campaign = createDecisionCampaign('transfer');
let result: DecisionResult, text: string, exported: DecisionExport;
beforeAll(async () => {
  result = await runDecisionCampaign(campaign);
  text = exportDecisionCampaign(campaign, result, { commit: 'portable-source-commit', sourceTree: 'portable-source-tree' });
  exported = JSON.parse(text) as DecisionExport;
});
function rehash(e: DecisionExport) { e.evidenceIdentity = identity({ campaign: e.campaign, result: { ...e.result, provenance: 'executed' }, sourceIdentity: e.sourceIdentity }); return JSON.stringify(e); }

describe('PH6 portable campaign import and independently rerun reproduction', () => {
  it('exports the complete declared matrix and all infeasible alternatives with actual initial states and source identities', () => {
    expect(exported).toMatchObject({ kind: 'neptune-decision-evidence', version: 'decision-campaign-1', sourceIdentity: { commit: 'portable-source-commit', sourceTree: 'portable-source-tree' } });
    expect(exported.result.evaluations).toHaveLength(3); expect(exported.result.runs).toHaveLength(6);
    expect(exported.result.evaluations.filter(r => r.feasibility === 'infeasible')).toHaveLength(2);
    for (const run of exported.result.plan.runs) {
      expect(run.initialState).toBeDefined(); expect(run.design.equipment?.specifications.length).toBeGreaterThan(0);
      expect(run.initialStateIdentity).toBe(identity(run.initialState));
    }
    expect(() => validateDecisionResult(campaign, result)).not.toThrow();
    expect(text).not.toContain('/Users/'); expect(text).not.toContain('/private/tmp/');
  });
  it('labels imported outcomes supplied evidence and refuses to call imported data a newly executed reproduction', () => {
    const imported = importDecisionCampaign(text);
    expect(imported.result.provenance).toBe('imported-supplied-evidence');
    expect(imported.result.ranking).toEqual(result.ranking);
    expect(compareReproduction(imported, imported.result)).toMatchObject({ matches: false });
    expect(compareReproduction(imported, imported.result).differences.join(' ')).toMatch(/newly executed/);
  });
  it('actually reruns imported definitions in a fresh invocation and recovers metrics and recommendation', async () => {
    const imported = importDecisionCampaign(text), recomputed = await runDecisionCampaign(imported.campaign, { concurrency: 1 });
    expect(recomputed).not.toBe(imported.result);
    expect(compareReproduction(imported, recomputed)).toEqual({ matches: true, differences: [] });
    expect(recomputed.ranking.winnerIds).toEqual(['iii-24']);
  });
  it.each([
    ['unsupported export version', (e: DecisionExport) => { e.version = 'decision-campaign-999' as DecisionExport['version']; }],
    ['unsupported model version', (e: DecisionExport) => { e.campaign.versions.solver = 'different'; }],
    ['stored winner overwrite', (e: DecisionExport) => { e.result.ranking.winnerIds = ['ii-24']; }],
    ['duplicate run', (e: DecisionExport) => { e.result.runs.push(structuredClone(e.result.runs[0])); }],
    ['missing required run metrics', (e: DecisionExport) => { e.result.runs[0].state = null; }],
    ['nonfinite upstream peak via JSON null', (e: DecisionExport) => { e.result.runs[0].peakSupply!.value = Infinity; }],
    ['invented completeness', (e: DecisionExport) => { e.result.coverage.completed += 1; }],
    ['actual initial checkpoint replaced', (e: DecisionExport) => { e.result.plan.runs[0].initialState.timeS = 1; }],
    ['wrong disturbance target', (e: DecisionExport) => { e.result.plan.runs.find(r => r.definition.disturbances.length)!.definition.disturbances[0].assetId = 'nonexistent'; }],
    ['private source path', (e: DecisionExport) => { e.sourceIdentity.commit = '/Users/private/checkout'; }],
  ] as const)('rejects %s even if accidental-mismatch checksum is recomputed', (_label, mutate) => {
    const changed = structuredClone(exported); mutate(changed);
    expect(() => importDecisionCampaign(rehash(changed))).toThrow();
  });
  it('rejects checksum mismatch, duplicate JSON keys, malformed input and input above the declared size limit', () => {
    const changed = structuredClone(exported); changed.sourceIdentity.commit = 'different-valid-looking-source';
    expect(() => importDecisionCampaign(JSON.stringify(changed))).toThrow(/identity mismatch/);
    expect(() => importDecisionCampaign('{"kind":"one","kind":"two"}')).toThrow(/Duplicate JSON key/);
    expect(() => importDecisionCampaign('{')).toThrow();
    expect(() => importDecisionCampaign(' '.repeat(64 * 1024 * 1024 + 1))).toThrow(/envelope/);
  });
  it('a changed full-run metric or ranking is exposed by real reproduction comparison', () => {
    const changed = structuredClone(result); changed.runs.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'eligible-feeder')!.state!.experiment!.metrics.shortfallAcceleratorS += 1;
    const mismatch = compareReproduction(exported, changed);
    expect(mismatch.matches).toBe(false); expect(mismatch.differences.join(' ')).toContain('shortfallAcceleratorS');
    changed.ranking.winnerIds = ['ii-24']; expect(compareReproduction(exported, changed).differences.join(' ')).toContain('winnerIds');
  });
  it('cancelled export/import includes unresolved candidates and cannot acquire a final recommendation', async () => {
    const abort = new AbortController(); abort.abort();
    const cancelled = await runDecisionCampaign(campaign, { signal: abort.signal }), imported = importDecisionCampaign(exportDecisionCampaign(campaign, cancelled));
    expect(imported.result.status).toBe('cancelled'); expect(imported.result.evaluations).toHaveLength(3);
    expect(imported.result.evaluations.every(r => r.feasibility === 'unresolved')).toBe(true);
    expect(imported.result.ranking).toMatchObject({ status: 'evaluation-incomplete', winnerIds: [], scopeComplete: false });
  });
  it('readable report names objective, scope, limitations, every alternative and original experiment policy', () => {
    const report = decisionReport(campaign, result);
    for (const fragment of ['minimum-included-cost', 'iii-24', 'ii-24', 'iii-disabled-24', 'Completed 6/6', 'Whole-run outcomes', 'Phase4/5 zero-outage', 'actual initial checkpoints', 'physical validation']) expect(report).toContain(fragment);
    expect(report).toContain('Limiting assessed requirements'); expect(report).toContain('Unmet accelerator-s');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDecisionCampaign, PAIRED_SENSITIVITIES } from '../src/twin/decision/candidates';
import { assembleDecisionResult, executeDecisionRun, planDecisionCampaign } from '../src/twin/decision/runner';
import { createDecisionWorkerExecutor } from '../src/twin/decision/worker-client';
import { advanceWithStep, initializeExperimentFromState, summarize } from '../src/twin/engine/simulation';
import type { DecisionRunEvidence, PlannedDecisionRun } from '../src/twin/decision/types';

class UnresponsiveWorker {
  static instances: UnresponsiveWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  postMessage = vi.fn();
  constructor() { UnresponsiveWorker.instances.push(this); }
  terminate() { this.terminated = true; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); UnresponsiveWorker.instances = []; });
const protocolEvidence = (run: PlannedDecisionRun): DecisionRunEvidence => ({ id: run.id, candidateId: run.candidateId, scenarioId: run.scenarioId, sensitivityId: run.sensitivityId, status: 'incomplete', reason: null, state: null, peakSupply: null, hardConstraints: [], recovery: null, incrementalShortfallAcceleratorS: null });

describe('Phase 6 focused repair regressions', () => {
  it('bounds a nonresponding worker and keeps resource exhaustion distinct from numerical failure', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', UnresponsiveWorker);
    const campaign = createDecisionCampaign('nominal'), run = planDecisionCampaign(campaign).runs[0];
    const execute = createDecisionWorkerExecutor();
    let outcome: DecisionRunEvidence | undefined;
    const pending = execute(run, campaign.execution).then(value => { outcome = value; });
    try {
      await vi.advanceTimersByTimeAsync(125_000);
      expect(outcome, 'worker must settle within the documented wall-clock envelope').toBeDefined();
      await pending;
      expect(outcome).toMatchObject({ id: run.id, status: 'resource-limited', state: null });
      expect(UnresponsiveWorker.instances[0].terminated).toBe(true);
    } finally { execute.dispose(); }
  });

  it('clears successful deadlines and rejects late response callbacks when a worker is reused', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', UnresponsiveWorker);
    const campaign = createDecisionCampaign('nominal'), runs = planDecisionCampaign(campaign).runs;
    const execute = createDecisionWorkerExecutor();
    try {
      const first = execute(runs[0], campaign.execution), worker = UnresponsiveWorker.instances[0];
      const firstRequest = worker.postMessage.mock.calls[0][0], firstHandler = worker.onmessage!;
      const firstResponse = { data: { version: 1, epoch: firstRequest.epoch, evidence: protocolEvidence(runs[0]) } } as MessageEvent;
      firstHandler(firstResponse);
      await expect(first).resolves.toMatchObject({ id: runs[0].id });
      expect(vi.getTimerCount()).toBe(0);
      let secondSettled = false;
      const second = execute(runs[1], campaign.execution).then(value => { secondSettled = true; return value; });
      firstHandler(firstResponse);
      await Promise.resolve();
      expect(secondSettled).toBe(false);
      const secondRequest = worker.postMessage.mock.calls[1][0];
      worker.onmessage!({ data: { version: 1, epoch: secondRequest.epoch, evidence: protocolEvidence(runs[1]) } } as MessageEvent);
      await expect(second).resolves.toMatchObject({ id: runs[1].id });
      expect(UnresponsiveWorker.instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally { execute.dispose(); }
  });

  it('settles every active invocation on disposal and frees cancelled worker slots', async () => {
    vi.useFakeTimers(); vi.stubGlobal('Worker', UnresponsiveWorker);
    const campaign = createDecisionCampaign('nominal'), runs = planDecisionCampaign(campaign).runs;
    const execute = createDecisionWorkerExecutor(), signal = new AbortController();
    const first = execute(runs[0], campaign.execution, signal.signal).catch(error => error);
    signal.abort();
    expect(await first).toBeInstanceOf(Error);
    expect(vi.getTimerCount()).toBe(0);
    const remaining = runs.slice(1).map(run => execute(run, campaign.execution).catch(error => error));
    execute.dispose();
    expect((await Promise.all(remaining)).every(outcome => outcome instanceof Error)).toBe(true);
    expect(UnresponsiveWorker.instances.every(worker => worker.terminated)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not declare the full search complete when central results are infeasible but sensitivity runs are pending', async () => {
    const campaign = createDecisionCampaign('no-benefit-bus');
    campaign.candidates = campaign.candidates.filter(candidate => candidate.id === 'iii-24');
    campaign.sensitivities = structuredClone(PAIRED_SENSITIVITIES.filter(sensitivity => ['central', 'cost-upper'].includes(sensitivity.id)));
    const plan = planDecisionCampaign(campaign);
    const central = [];
    for (const run of plan.runs.filter(run => run.sensitivityId === 'central')) central.push(await executeDecisionRun(run, campaign.execution));
    const result = assembleDecisionResult(campaign, plan, central);
    expect(result.sensitivityRankings.find(ranking => ranking.sensitivityId === 'central')).toMatchObject({ scopeComplete: true, status: 'no-feasible-evaluated-candidate' });
    expect(result).toMatchObject({ status: 'incomplete', ranking: { scopeComplete: false, status: 'evaluation-incomplete', winnerIds: [] } });
    expect(result.coverage.completed).toBe(3);
    expect(result.coverage.planned).toBe(6);
  });

  it.each([1, 0.125] as const)('preserves whole-run transfer evidence and exact supply peak with bounded chunks at %s s integration', async integrationStepS => {
    const campaign = createDecisionCampaign('transfer');
    campaign.candidates = campaign.candidates.filter(candidate => candidate.id === 'iii-24');
    campaign.execution.integrationStepS = integrationStepS;
    const run = planDecisionCampaign(campaign).runs.find(run => run.scenarioId === 'eligible-feeder')!;
    let reference = initializeExperimentFromState(run.design, run.initialState, run.definition);
    const peak = { value: summarize(run.design, reference).gridW, timeS: 0 };
    while (reference.timeS < run.definition.durationS) reference = advanceWithStep(run.design, reference, 1, [], integrationStepS, observation => {
      if (observation.gridW > peak.value) { peak.value = observation.gridW; peak.timeS = observation.timeS; }
    });
    const actual = await executeDecisionRun(run, campaign.execution);
    expect(actual.status).toBe('completed');
    expect(actual.state!.experiment!.metrics).toEqual(reference.experiment!.metrics);
    expect(actual.state!.transfer).toEqual(reference.transfer);
    expect(actual.peakSupply).toMatchObject(peak);
    expect(actual.state!.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 19, serviceViolationS: 2.375 });
  });
});

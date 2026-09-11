import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import type { DecisionExport } from '../../src/twin/decision/types';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Phase 6 decision support', exact: true });
async function setup(page: Page, fallback = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fallback ? './?fallback=1' : './');
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  await button(page, 'Compare').click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toContainText('Simulated, design-stage prototype; physical validation pending.');
  await expect(button(page, 'Start decision campaign')).toBeEnabled();
}
async function download(page: Page, trigger: () => Promise<unknown>) {
  const pending = page.waitForEvent('download'); await trigger(); const file = await pending;
  expect(await file.failure()).toBeNull(); const path = await file.path();
  if (!path) throw Error('Actual native export missing.');
  return JSON.parse(await fs.readFile(path, 'utf8'));
}
async function exported(page: Page): Promise<DecisionExport> { return download(page, () => button(page, 'Export decision campaign').click()); }
const metricsByRunId = (campaign: DecisionExport) => campaign.result.runs.map(run => ({ id: run.id, metrics: run.state?.experiment?.metrics })).sort((a, b) => a.id.localeCompare(b.id));
async function run(page: Page, fixture: string) {
  await page.getByLabel('Decision fixture', { exact: true }).selectOption(fixture);
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  await expect(button(page, 'Export decision campaign')).toBeEnabled();
  return exported(page);
}
function observe(page: Page) {
  const errors: string[] = [], workers: string[] = [], failedRequests: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failedRequests.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('requestfailed', request => { if (/\.(js|css|svg|png)(\?|$)/.test(request.url())) failedRequests.push(`${request.failure()?.errorText}: ${request.url()}`); });
  return { errors, workers, failedRequests };
}
async function evidence(info: TestInfo, name: string, payload: unknown, observed: ReturnType<typeof observe>) {
  expect(observed.workers.length).toBeGreaterThan(0); expect(observed.errors).toEqual([]); expect(observed.failedRequests).toEqual([]);
  await info.attach(name, { body: JSON.stringify({ browser: info.project.name, payload, observed }), contentType: 'application/json' });
}

test('PH6 A real worker recommendation exports complete evidence and explicitly loads the selected experiment', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  const before = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  const campaign = await run(page, 'transfer');
  expect(campaign).toMatchObject({ kind: 'neptune-decision-evidence', version: 'decision-campaign-1', result: { provenance: 'executed', status: 'completed', ranking: { status: 'recommended', winnerIds: ['iii-24'], scopeComplete: true }, coverage: { completed: 6, planned: 6, fullyEvaluatedCandidates: 3 } } });
  expect(campaign.result.runs).toHaveLength(6);
  const ii = campaign.result.runs.find(r => r.candidateId === 'ii-24' && r.scenarioId === 'eligible-feeder')!;
  const iii = campaign.result.runs.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'eligible-feeder')!;
  expect(ii.state!.experiment!.metrics.shortfallAcceleratorS).toBe(80);
  expect(iii.state!.experiment).toMatchObject({ evaluation: { outcome: 'FAIL' }, metrics: { shortfallAcceleratorS: 19, serviceViolationS: 2.375, pendingRecovery: { onsetTimeS: 4.375, confirmationTimeS: 9.375 } } });
  const untouched = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(untouched.checkpoint).toEqual(before.checkpoint);
  await page.getByTestId('decision-row-iii-24').getByRole('button', { name: 'Inspect candidate', exact: true }).click();
  await page.getByLabel('Decision scenario', { exact: true }).selectOption('nominal');
  await button(page, 'Load selected candidate').click();
  await expect(button(page, 'Run selected experiment')).toBeEnabled();
  await button(page, 'Operate').click(); await button(page, 'Compare').click();
  await expect(page.getByLabel('Decision scenario', { exact: true })).toHaveValue('nominal');
  await button(page, 'Run selected experiment').click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '12');
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  const loaded = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  const expected = campaign.result.plan.runs.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'nominal')!;
  expect(loaded.checkpoint.state.experiment.definition).toEqual(expected.definition);
  expect(loaded.checkpoint.state.experiment.initialState).toEqual(expected.initialState);
  expect(loaded.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(0);
  expect(loaded.checkpoint.state.experiment.definition.disturbances).toEqual([]);
  await evidence(info, 'phase6-native-transfer-and-selected-nominal', { campaign, loaded }, observed);
});

test('PH6 B no-benefit suites remain infeasible while C nominal-only selects lower included-cost II', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  const campaigns: DecisionExport[] = [];
  for (const fixture of ['no-benefit-bus', 'no-benefit-source']) {
    const campaign = await run(page, fixture); campaigns.push(campaign);
    expect(campaign.result.ranking).toMatchObject({ status: 'no-feasible-evaluated-candidate', winnerIds: [], scopeComplete: true });
    expect(campaign.result.coverage.completed).toBe(campaign.result.coverage.planned);
    expect(campaign.result.evaluations.every(row => row.feasibility === 'infeasible')).toBe(true);
  }
  const nominal = await run(page, 'nominal'); campaigns.push(nominal);
  expect(nominal.result.ranking.winnerIds).toEqual(['ii-24']);
  expect(nominal.result.ranking.feasibleCandidateIds).toHaveLength(3);
  await expect(page.getByTestId('decision-recommendation')).toContainText('Nominal-only coverage');
  await evidence(info, 'phase6-native-honest-no-feasible-and-nominal', campaigns, observed);
});

test('PH6 F native import marks supplied evidence and recomputes through new workers after refresh', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  const source = await run(page, 'transfer');
  await page.getByLabel('Import decision campaign', { exact: true }).setInputFiles({ name: 'phase6-export.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.getByTestId('decision-recommendation')).toContainText('Imported supplied evidence');
  expect((await exported(page)).result.provenance).toBe('imported-supplied-evidence');
  await expect(panel(page)).toContainText('Decision draft and bounded evidence stored on this device.');
  await page.reload(); await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  await button(page, 'Compare').click();
  await expect(button(page, 'Recompute imported campaign')).toBeEnabled();
  const priorWorkers = observed.workers.length;
  await button(page, 'Recompute imported campaign').click();
  await expect(page.getByTestId('decision-reproduction')).toContainText('Reproduction matched');
  const reproduced = await exported(page);
  expect(reproduced.result.provenance).toBe('executed');
  expect(reproduced.result.ranking).toEqual(source.result.ranking);
  expect(metricsByRunId(reproduced)).toEqual(metricsByRunId(source));
  expect(observed.workers.length).toBeGreaterThan(priorWorkers);
  await evidence(info, 'phase6-native-import-refresh-reproduction', { source, reproduced }, observed);
});

test('PH6 cancellation remains incomplete and edits stale prior results on keyboard mobile fallback', async ({ page }, info) => {
  const observed = observe(page); await setup(page); await expect(page.locator('canvas')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Decision fixture', { exact: true }).selectOption('sensitivity');
  await button(page, 'Start decision campaign').focus(); await page.keyboard.press('Enter');
  await button(page, 'Cancel decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'cancelled');
  const cancelled = await exported(page);
  expect(cancelled.result.status).toBe('cancelled'); expect(cancelled.result.ranking.scopeComplete).toBe(false);
  expect(cancelled.result.ranking.status).not.toBe('recommended');
  expect(cancelled.result.coverage.completed).toBeLessThan(cancelled.result.coverage.planned);
  const completed = await run(page, 'transfer'); expect(completed.result.ranking.winnerIds).toEqual(['iii-24']);
  await page.getByLabel('Decision interruption seconds', { exact: true }).fill('2');
  await expect(page.getByTestId('decision-stale')).toBeVisible();
  await expect(page.getByTestId('decision-recommendation')).toContainText('Historical result');
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  const tightened = await exported(page); expect(tightened.result.ranking.winnerIds).toEqual([]);
  expect(tightened.result.ranking.status).toBe('no-feasible-evaluated-candidate');
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('phase6-mobile-fallback.png'), fullPage: true });
  await evidence(info, 'phase6-native-cancel-restart-staleness', { cancelled, completed, tightened }, observed);
});

test('PH6 D actual whole-run supply ceiling chooses the largest passing discrete requested workload', async ({ page }, info) => {
  const observed = observe(page); await setup(page, false);
  const campaign = await run(page, 'sizing');
  expect(campaign.result.ranking.winnerIds).toEqual(['ii-40']);
  expect(campaign.result.coverage).toMatchObject({ completed: 12, planned: 12, fullyEvaluatedCandidates: 6 });
  const passing = campaign.result.evaluations.find(row => row.candidateId === 'ii-40')!, larger = campaign.result.evaluations.find(row => row.candidateId === 'ii-48')!;
  expect(passing.feasibility).toBe('feasible'); expect(passing.worst.peakSupplyW).toBeCloseTo(113505.311811, 5);
  expect(larger.feasibility).toBe('infeasible'); expect(larger.worst.peakSupplyW).toBeCloseTo(124361.611487, 5);
  expect(larger.requirements.some(item => item.unit === 'W' && item.status === 'violated' && item.threshold === 120000)).toBe(true);
  expect(campaign.campaign.scenarios.find(s => s.kind === 'thermal')).toMatchObject({ durationS: 120, settling: 'not-requested' });
  await evidence(info, 'phase6-native-integer-sizing', campaign, observed);
});

test('PH6 E all81 paired assumption cells execute through the bounded native workers', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  await page.getByLabel('Decision fixture', { exact: true }).selectOption('sensitivity');
  await button(page, 'Start decision campaign').click();
  // Condition-based worker completion within the unchanged 60-second browser test budget.
  await page.waitForFunction(() => document.querySelector('[data-testid="decision-coverage"]')?.getAttribute('data-status') === 'completed');
  const campaign = await exported(page);
  expect(campaign.result.coverage).toEqual({ completed: 81, planned: 81, fullyEvaluatedCandidates: 3 });
  expect(campaign.result.status).toBe('completed'); expect(campaign.result.ranking.winnerIds).toEqual(['iii-24']);
  expect(campaign.result.sensitivityRankings).toHaveLength(9);
  for (const ranking of campaign.result.sensitivityRankings) {
    expect(ranking.scopeComplete).toBe(true); expect(ranking.winnerIds).toEqual(['iii-24']);
  }
  expect(campaign.campaign.sensitivityNote).toContain('Joint combinations are untested');
  expect(campaign.result.sensitivityConclusion).toContain('unchanged winner set');
  for (const thermal of campaign.result.runs.filter(run => run.scenarioId === 'thermal')) expect(thermal.state!.experiment).toMatchObject({ warmup: { status: 'not-requested' }, metrics: { elapsedS: 120 } });
  for (const candidate of campaign.campaign.candidates) for (const scenario of campaign.campaign.scenarios) {
    const central = campaign.result.runs.find(run => run.candidateId === candidate.id && run.scenarioId === scenario.id && run.sensitivityId === 'central')!;
    for (const cost of campaign.result.runs.filter(run => run.candidateId === candidate.id && run.scenarioId === scenario.id && run.sensitivityId.startsWith('cost-'))) expect(cost.state!.experiment!.metrics).toEqual(central.state!.experiment!.metrics);
  }
  await evidence(info, 'phase6-native-complete-paired-sensitivity', campaign, observed);
});

test('PH6 E frozen50millionUSD budget passes central and rejects the upper included-cost bound in the UI', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  await page.getByLabel('Decision fixture', { exact: true }).selectOption('nominal');
  await page.getByLabel('Decision budget USD', { exact: true }).fill('50000000');
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  const central = await exported(page); expect(central.result.ranking.winnerIds).toEqual(['ii-24']);
  await page.getByLabel('Decision budget basis', { exact: true }).selectOption('upper-bound');
  await expect(page.getByTestId('decision-stale')).toBeVisible();
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  const upper = await exported(page);
  expect(upper.result.ranking).toMatchObject({ status: 'no-feasible-evaluated-candidate', winnerIds: [], scopeComplete: true });
  for (const row of upper.result.evaluations) {
    const original = central.result.evaluations.find(item => item.candidateId === row.candidateId)!;
    expect(original.feasibility).toBe('feasible'); expect(row.budgetCostUSD).toBe(original.includedCost.totalUSD * 1.5);
    expect(row.requirements.find(item => item.id === 'included-cost-budget')).toMatchObject({ status: 'violated', threshold: 50000000, unit: 'USD' });
  }
  expect(metricsByRunId(upper)).toEqual(metricsByRunId(central));
  await evidence(info, 'phase6-native-central-upper-budget-consequence', { central, upper }, observed);
});

test('PH6 selected experiment binding requires explicit reload after recovery policy changes', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  await button(page, 'Inspect candidate · Generation III enabled · 24 accelerators').click();
  await expect(page.getByLabel('Decision scenario', { exact: true })).toHaveValue('eligible-feeder');
  await button(page, 'Load selected candidate').click();
  await expect(button(page, 'Run selected experiment')).toBeEnabled();
  await page.getByLabel('Decision recovery dwell seconds', { exact: true }).fill('8');
  await expect(button(page, 'Run selected experiment')).toBeDisabled();
  await button(page, 'Load selected candidate').click();
  await expect(button(page, 'Run selected experiment')).toBeEnabled();
  await button(page, 'Run selected experiment').click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '12');
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  const project = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(project.checkpoint.state.experiment.definition.recovery.dwellS).toBe(8);
  expect(project.checkpoint.state.experiment.metrics).toMatchObject({ shortfallAcceleratorS: 19, pendingRecovery: { onsetTimeS: 4.375, confirmationTimeS: null } });
  await evidence(info, 'phase6-native-exact-loaded-recovery-binding', project, observed);
});

test('PH6 selected run isolates prior interactive inputs while generic Replay and previous project recovery remain available', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  const before = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  const campaign = await run(page, 'transfer');
  await page.getByTestId('decision-row-iii-24').getByRole('button', { name: 'Inspect candidate', exact: true }).click();
  await button(page, 'Load selected candidate').click(); await expect(button(page, 'Run selected experiment')).toBeEnabled();
  await button(page, 'Operate').click();
  await button(page, 'Seawater 32°C').click(); await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  await button(page, 'Step 10s').click(); await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '10');
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  const interactive = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(interactive.checkpoint.state.events.some((event: { kind: string; value?: number }) => event.kind === 'seawater' && event.value === 305.15)).toBe(true);
  await button(page, 'Replay').click(); await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  const replayed = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(replayed.checkpoint.state.events).toEqual(interactive.checkpoint.state.events);
  expect(replayed.checkpoint.state.experiment.metrics).toEqual(interactive.checkpoint.state.experiment.metrics);
  await button(page, 'Compare').click(); await button(page, 'Load selected candidate').click();
  await expect(button(page, 'Run selected experiment')).toBeEnabled();
  await button(page, 'Operate').click(); await button(page, 'Seawater 32°C').click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  await button(page, 'Compare').click(); await button(page, 'Run selected experiment').click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '12');
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  const selected = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  const planned = campaign.result.plan.runs.find(run => run.candidateId === 'iii-24' && run.scenarioId === 'eligible-feeder')!;
  expect(selected.checkpoint.state.experiment.definition).toEqual(planned.definition);
  expect(selected.checkpoint.state.experiment.initialState).toEqual(planned.initialState);
  expect(selected.checkpoint.state.events).toEqual(planned.definition.disturbances);
  expect(selected.checkpoint.state.seawaterK).toBe(291.15);
  expect(selected.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(19);
  await button(page, 'Compare').click();
  await page.getByRole('button', { name: 'Before Phase 6 candidate · 0s', exact: true }).first().click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  const recovered = await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(recovered.checkpoint).toEqual(before.checkpoint);
  await evidence(info, 'phase6-native-selected-history-isolation-and-recovery', { interactive, replayed, selected, recovered }, observed);
});

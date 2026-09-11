import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';

const main = (page: Page) => page.locator('main.twin-app');
const panel = (page: Page) => page.getByRole('region', { name: 'Phase 5 controlled transfer', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
async function ready(page: Page) { await expect(main(page)).toHaveAttribute('data-ready', 'true'); await expect(button(page, 'Step 10s')).toBeEnabled(); }
async function setup(page: Page, fallback = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fallback ? './?fallback=1' : './'); await ready(page);
  await page.getByLabel('Starting scenario', { exact: true }).selectOption('8'); await ready(page);
  await expect(panel(page)).toContainText('Simulated, design-stage prototype; physical validation pending.');
}
async function download(page: Page, trigger: () => Promise<unknown>) {
  const pending = page.waitForEvent('download'); await trigger(); const file = await pending;
  expect(await file.failure()).toBeNull(); const path = await file.path();
  if (!path) throw Error('Actual native export missing.');
  return JSON.parse(await fs.readFile(path, 'utf8'));
}
async function project(page: Page) { return download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project')); }
async function compare(page: Page, kind: string) {
  await page.getByLabel('Phase 5 experiment', { exact: true }).selectOption(kind);
  await button(page, 'Compare Generation II / III').click();
  // Follow the real four-worker lifecycle within the original test budget.
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(control => control.textContent === 'Compare Generation II / III' && !control.disabled));
  await expect(page.getByTestId('phase5-comparison-report')).toBeVisible();
  return download(page, () => button(page, 'Export Phase 5 comparison').click());
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

test('PH5 eligible real four-worker comparison exports interruption recovery initial states and included hardware', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  const exported = await compare(page, 'eligible');
  expect(exported).toMatchObject({ kind: 'neptune-phase5-comparison', version: 1, case: 'eligible', signed: { shortfallAcceleratorS: -61, serviceViolationS: -7.625, includedCostUSD: 240000 } });
  expect(exported.runs).toHaveLength(4);
  const ii = exported.runs.find((run: { generation: number; role: string }) => run.generation === 2 && run.role === 'faulted');
  const iii = exported.runs.find((run: { generation: number; role: string }) => run.generation === 3 && run.role === 'faulted');
  expect(ii.project.checkpoint.state.experiment.metrics).toMatchObject({ shortfallAcceleratorS: 80, serviceViolationS: 10 });
  expect(iii.project.checkpoint.state.experiment.metrics).toMatchObject({ shortfallAcceleratorS: 19, serviceViolationS: 2.375, pendingRecovery: { onsetTimeS: 4.375, confirmationTimeS: 9.375 } });
  for (const generation of [2, 3]) {
    const faulted = exported.runs.find((run: { generation: number; role: string }) => run.generation === generation && run.role === 'faulted');
    const unfaulted = exported.runs.find((run: { generation: number; role: string }) => run.generation === generation && run.role === 'unfaulted');
    expect(faulted.project.checkpoint.state.experiment.initialState).toEqual(unfaulted.project.checkpoint.state.experiment.initialState);
    expect(unfaulted.project.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(0);
    expect(faulted.project.design.requestedAccelerators).toBe(24); expect(faulted.project.design.workload).toBe(0.8);
    expect(exported.faultImpact.find((impact: { generation: number }) => impact.generation === generation).comparison.status).toBe('comparable');
  }
  expect(iii.project.checkpoint.state.transfer.transitions.find((transition: { reason: string }) => transition.reason === 'TRANSFERRED')).toMatchObject({ timeS: 4.375, originalClosed: false, tieClosed: true });
  expect(iii.addedTransferAssets).toHaveLength(6); expect(ii.addedTransferAssets).toHaveLength(0);
  expect(exported.exclusions).toContain('No vendor validation');
  await expect(page.getByTestId('phase5-comparison-shortfall')).toContainText('signed Generation III minus Generation II');
  await evidence(info, 'phase5-eligible-native-export', exported, observed);
});

test('PH5 receiving bus no-benefit preserves unrelated service and exports refusal through real workers', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  const exported = await compare(page, 'bus');
  expect(exported.signed.shortfallAcceleratorS).toBe(0);
  for (const faulted of exported.runs.filter((run: { role: string }) => run.role === 'faulted')) expect(faulted.project.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(80);
  const iii = exported.runs.find((run: { generation: number; role: string }) => run.generation === 3 && run.role === 'faulted');
  expect(iii.project.checkpoint.state.transfer.attempts[0]).toMatchObject({ reason: 'RECEIVING_BUS_FAILED', tieClosed: false, admittedW: 0 });
  expect(iii.project.checkpoint.state.modules.map((module: { availableAccelerators: number }) => module.availableAccelerators)).toEqual([8, 0, 8]);
  await expect(page.getByTestId('phase5-comparison-report').getByTestId('phase5-transfer-status')).toContainText('RECEIVING_BUS_FAILED');
  await evidence(info, 'phase5-no-benefit-native-export', exported, observed);
});

test('PH5 shared-donor partial restoration has exact unserved history and native capacity evidence', async ({ page }, info) => {
  const observed = observe(page); await setup(page, true);
  const exported = await compare(page, 'partial');
  const ii = exported.runs.find((run: { generation: number; role: string }) => run.generation === 2 && run.role === 'faulted');
  const iii = exported.runs.find((run: { generation: number; role: string }) => run.generation === 3 && run.role === 'faulted');
  expect(ii.project.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(160);
  expect(iii.project.checkpoint.state.experiment.metrics).toMatchObject({ shortfallAcceleratorS: 99, serviceViolationS: 10 });
  const [admitted, unserved] = iii.project.checkpoint.state.transfer.attempts;
  expect(admitted).toMatchObject({ status: 'transferred', unservedW: 0 });
  expect(unserved).toMatchObject({ status: 'blocked', reason: 'INSUFFICIENT_HEADROOM', admittedW: 0, bindingResourceId: 'edge:shore/grid>platform-001/transformer:power' });
  const resource = iii.project.checkpoint.state.transfer.resources.find((resource: { id: string }) => resource.id === unserved.bindingResourceId);
  expect(resource.capacityW).toBe(140000); expect(resource.transferredW).toBeCloseTo(admitted.admittedW, 6);
  expect(resource.nativeW).toBeGreaterThan(0); expect(resource.nativeW + resource.transferredW).toBeLessThanOrEqual(140000 + 1e-6);
  expect(resource.headroomW).toBeLessThan(unserved.unservedW);
  expect(iii.project.checkpoint.state.modules.map((module: { availableAccelerators: number }) => module.availableAccelerators)).toEqual([8, 8, 0]);
  await evidence(info, 'phase5-partial-native-export', exported, observed);
});

test('PH5 loaded experiment exports imports replays and invalidates stale comparisons on mobile keyboard fallback', async ({ page }, info) => {
  const observed = observe(page); await setup(page, true); await expect(page.locator('canvas')).toHaveCount(0);
  await button(page, 'Load Phase 5 reference').focus(); await page.keyboard.press('Enter');
  await expect(button(page, 'Run loaded Phase 5 experiment')).toBeEnabled(); await ready(page);
  await button(page, 'Run loaded Phase 5 experiment').click();
  await expect(main(page)).toHaveAttribute('data-time', '12'); await ready(page);
  const source = await project(page);
  expect(source.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(19);
  expect(source.checkpoint.state.transfer.attempts[0]).toMatchObject({ status: 'transferred', tieClosed: true });
  await button(page, 'Replay').click(); await ready(page);
  const replayed = await project(page);
  expect(replayed.checkpoint.state.experiment.metrics).toEqual(source.checkpoint.state.experiment.metrics);
  expect(replayed.checkpoint.state.transfer).toEqual(source.checkpoint.state.transfer);
  await page.getByLabel('Import project', { exact: true }).setInputFiles({ name: 'phase5-replay.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) }); await ready(page);
  const imported = await project(page); expect(imported.checkpoint).toEqual(source.checkpoint);
  await compare(page, 'eligible');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('phase5-mobile-report.png'), fullPage: true });
  await page.getByLabel('Starting scenario', { exact: true }).selectOption('8'); await ready(page);
  await expect(page.getByTestId('phase5-comparison-report')).toHaveCount(0);
  await expect(panel(page)).toContainText('previous Phase 5 comparison is historical because engineering inputs changed');
  await evidence(info, 'phase5-replay-native-exports', { source, replayed, imported }, observed);
});

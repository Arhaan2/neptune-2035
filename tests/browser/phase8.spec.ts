import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { buildDesign, DEFAULT_CONFIG } from '../../src/twin/assets/design';
import type { WorkerRequest, WorkerResponse } from '../../src/twin/types';

async function nativeJSON(page: Page, action: () => Promise<unknown>) {
  const pending = page.waitForEvent('download');
  await action();
  const downloaded = await pending;
  expect(await downloaded.failure()).toBeNull();
  const file = await downloaded.path();
  if (!file) throw Error('Native export has no artifact path.');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

test('P8-S02 old active project requires explicit recalculation and old campaign rejection preserves the active session', async ({ page }, info) => {
  const errors: string[] = [], workerURLs: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workerURLs.push(worker.url()));
  const oldText = await fs.readFile(new URL('../fixtures/phase-8/phase7-network-experiment.json', import.meta.url), 'utf8');
  const oldProject = JSON.parse(oldText);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?fallback=1');
  const step = page.getByRole('button', { name: 'Step 10s', exact: true });
  await expect(step).toBeEnabled(); await step.click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '10');
  await expect(step).toBeEnabled();
  const exportProject = () => nativeJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  const before = await exportProject();
  const url = workerURLs.find(url => /(?:\/assets\/worker-|\/engine\/worker\.ts)/.test(url));
  expect(url).toBeDefined();
  const rejected = await page.evaluate(async ({ url, project }) => {
    const worker = new Worker(url, { type: 'module' });
    try {
      return await new Promise<WorkerResponse>((resolve, reject) => {
        worker.onerror = event => reject(Error(event.message));
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => { if (event.data.status !== 'progress') resolve(event.data); };
        worker.postMessage({ version: 2, epoch: 1, requestId: 1, kind: 'advance', design: project.designSnapshot, state: project.checkpoint.state, durationS: 1 });
      });
    } finally { worker.terminate(); }
  }, { url: url!, project: oldProject });
  expect(rejected.status).toBe('failed'); expect(rejected.state).toBeUndefined();
  await page.getByLabel('Import project', { exact: true }).setInputFiles({ name: 'old-active-project.json', mimeType: 'application/json', buffer: Buffer.from(oldText) });
  await expect(page.getByTestId('project-compatibility')).toContainText('Exact continuation is unavailable');
  expect(await nativeJSON(page, () => page.getByRole('button', { name: 'Export original project', exact: true }).click())).toEqual(oldProject);
  expect(await exportProject()).toEqual(before);
  await page.getByRole('button', { name: 'Recalculate with current model', exact: true }).click();
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '5');
  await expect(step).toBeEnabled();
  const derived = await exportProject();
  expect(derived.solverVersion).toBe('2.3.1');
  expect(derived.provenance.parent).toMatchObject({ solverVersion: '2.3.0', action: 'recalculate-current-model' });
  expect(derived.checkpoint.state.experiment.definition.solverVersion).toBe('2.3.1');
  expect(await nativeJSON(page, () => page.getByRole('button', { name: 'Export original project', exact: true }).click())).toEqual(oldProject);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByLabel('Decision fixture', { exact: true }).selectOption('nominal');
  await page.getByRole('button', { name: 'Start decision campaign', exact: true }).click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  const exportCampaign = () => nativeJSON(page, () => page.getByRole('button', { name: 'Export decision campaign', exact: true }).click());
  const currentCampaign = await exportCampaign();
  const oldCampaign = await fs.readFile(new URL('../fixtures/phase-8/phase7-decision-nominal.json', import.meta.url), 'utf8');
  await page.getByLabel('Import decision campaign', { exact: true }).setInputFiles({ name: 'old-campaign.json', mimeType: 'application/json', buffer: Buffer.from(oldCampaign) });
  await expect(page.getByRole('region', { name: 'Phase 6 decision support', exact: true })).toContainText('Import rejected; current campaign retained.');
  expect(await exportCampaign()).toEqual(currentCampaign);
  expect((await exportProject()).checkpoint).toEqual(derived.checkpoint);
  expect(errors).toEqual([]);
  await info.attach('P8-S02-native-version-boundaries', { body: JSON.stringify({ rejected, oldSolver: oldProject.solverVersion, derivedSolver: derived.solverVersion, parent: derived.provenance.parent, oldCampaignSolver: JSON.parse(oldCampaign).campaign.versions.solver, currentCampaignSolver: currentCampaign.campaign.versions.solver, exactActiveCampaignPreservation: true, exactOriginalProjectPreservation: true }), contentType: 'application/json' });
});

test('P8-S02 legacy query and generated hash routes retain the saved aggregate scenario', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?legacy=1');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  const accelerators = page.getByRole('spinbutton', { name: 'Accelerators', exact: true });
  await accelerators.fill('2561');
  await accelerators.press('Enter');
  await expect(page.getByTestId('gpu-total')).toHaveText('2,568');
  await page.getByRole('button', { name: 'Share scenario', exact: true }).click();
  const link = await page.getByRole('textbox', { name: 'Shareable scenario URL', exact: true }).inputValue();
  expect(link).toContain('#s=');
  const legacyURL = new URL(link);
  legacyURL.searchParams.delete('legacy');
  await page.goto(legacyURL.href);
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(accelerators).toHaveValue('2561');
  await expect(page.getByTestId('gpu-total')).toHaveText('2,568');
  await expect(page.locator('main.twin-app')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('P8-ENV largest enabled campus completes native-worker one-second boundaries and rejects an oversized atomic event batch', async ({ page }, info) => {
  // Fixed before execution: 1,000,000 requested accelerators; 1 s cold + 1 s continuation.
  // This adds compatibility coverage, not a universal speed or 10 s campus claim.
  const workerURLs: string[] = [];
  const errors: string[] = [];
  page.on('worker', worker => workerURLs.push(worker.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?fallback=1');
  await expect(page.getByRole('button', { name: 'Step 10s', exact: true })).toBeEnabled();
  const nativeWorkerURL = workerURLs.find(url => /(?:\/assets\/worker-|\/engine\/worker\.ts)/.test(url));
  expect(nativeWorkerURL, 'The actual application must load its worker before the protocol exercise.').toBeDefined();
  const design = buildDesign({ ...DEFAULT_CONFIG, generation: 3, requestedAccelerators: 1_000_000, supplyW: 3e9 });
  const observations = await page.evaluate(async ({ url, design }) => {
    const worker = new Worker(url, { type: 'module' });
    const replies: WorkerResponse[] = [];
    const request = (message: WorkerRequest) => new Promise<WorkerResponse>((resolve, reject) => {
      const onError = (error: ErrorEvent) => { cleanup(); reject(new Error(error.message)); };
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.requestId !== message.requestId || event.data.epoch !== message.epoch) return;
        replies.push(event.data);
        if (event.data.status === 'progress') return;
        cleanup(); resolve(event.data);
      };
      const cleanup = () => { worker.removeEventListener('error', onError); worker.removeEventListener('message', onMessage); };
      worker.addEventListener('error', onError); worker.addEventListener('message', onMessage);
      worker.postMessage(message);
    });
    try {
      const started = performance.now();
      const initial = await request({ version: 2, requestId: 1, epoch: 1, kind: 'initialize', design });
      if (initial.status !== 'complete' || !initial.state) throw Error(JSON.stringify(initial));
      const first = await request({ version: 2, requestId: 2, epoch: 1, kind: 'advance', design, state: initial.state, durationS: 1 });
      if (first.status !== 'complete' || !first.state) throw Error(JSON.stringify(first));
      const second = await request({ version: 2, requestId: 3, epoch: 1, kind: 'advance', design, state: first.state, durationS: 1 });
      if (second.status !== 'complete' || !second.state) throw Error(JSON.stringify(second));
      const rejected = await request({ version: 2, requestId: 4, epoch: 1, kind: 'advance', design, state: second.state, durationS: 0, events: Array.from({ length: 11 }, (_, i) => ({ id: `atomic-${i}`, kind: 'workload', assetId: 'shore/grid', timeS: 2, value: 0.8 })) });
      const restored = await request({ version: 2, requestId: 5, epoch: 2, kind: 'restore', design, state: second.state, durationS: 0 });
      return { initial, first, second, rejected, restored, wallMs: performance.now() - started, responseStatuses: replies.map(reply => reply.status) };
    } finally { worker.terminate(); }
  }, { url: nativeWorkerURL!, design });
  expect(design.modules).toHaveLength(782);
  expect(observations.first.state!.timeS).toBe(1);
  expect(observations.second.state!.timeS).toBe(2);
  expect(observations.second.state!.facilityEnergyWh).toBeGreaterThan(observations.first.state!.facilityEnergyWh);
  expect(observations.second.state!.modules).toHaveLength(782);
  expect(observations.second.state!.modules.every(module => Number.isFinite(module.coolantK) && Number.isFinite(module.batteryWh))).toBe(true);
  expect(observations.rejected).toMatchObject({ status: 'resource-limited', diagnostic: { kind: 'resource-limit', code: 'EVENT_CHUNK_BUDGET' } });
  expect(observations.rejected.state).toBeUndefined();
  expect(observations.restored.status).toBe('complete');
  expect(observations.restored.state).toEqual(observations.second.state);
  expect(errors).toEqual([]);
  await info.attach('P8-ENV-native-worker-observations', { body: JSON.stringify({ browser: info.project.name, designConfig: design.config, moduleCount: design.modules.length, sourceWorkerURL: nativeWorkerURL, initialTimeS: observations.initial.state!.timeS, firstTimeS: observations.first.state!.timeS, secondTimeS: observations.second.state!.timeS, firstEnergyWh: observations.first.state!.facilityEnergyWh, secondEnergyWh: observations.second.state!.facilityEnergyWh, rejected: observations.rejected, exactRestoration: true, wallMs: observations.wallMs, responseStatuses: observations.responseStatuses }), contentType: 'application/json' });
});

import { expect, test } from '@playwright/test';
import { buildDesign, DEFAULT_CONFIG } from '../../src/twin/assets/design';
import type { WorkerRequest, WorkerResponse } from '../../src/twin/types';

test('P8-S02 legacy query and generated hash routes retain the saved aggregate scenario', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?legacy=1&fallback=1');
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

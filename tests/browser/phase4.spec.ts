import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs/promises';

const main = (page: Page) => page.locator('main.twin-app');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const experiment = (page: Page) => page.getByRole('region', { name: 'Whole experiment', exact: true });
const outcome = (page: Page) => experiment(page).getByTestId('experiment-outcome');
async function ready(page: Page) { await expect(main(page)).toHaveAttribute('data-ready', 'true'); await expect(button(page, 'Step 10s')).toBeEnabled(); }
async function setup(page: Page, fallback = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fallback ? './?fallback=1' : './'); await ready(page);
  await page.getByLabel('Starting scenario', { exact: true }).selectOption('8'); await ready(page);
  await expect(experiment(page)).toBeVisible();
}
async function downloaded(page: Page, trigger: () => Promise<unknown>) {
  const pending = page.waitForEvent('download'); await trigger(); const download = await pending;
  expect(await download.failure()).toBeNull(); const path = await download.path();
  if (!path) throw Error('Expected actual exported project file.');
  return fs.readFile(path, 'utf8');
}
async function exported(page: Page) { return JSON.parse(await downloaded(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'))); }
async function exportedComparison(page: Page, card: Locator) { return JSON.parse(await downloaded(page, () => card.getByRole('button', { name: 'Export reproducible run', exact: true }).click())); }
async function prepare(page: Page) { await button(page, 'Prepare experiment for stepping').click(); await ready(page); await expect(main(page)).toHaveAttribute('data-time', '0'); }
async function step(page: Page) {
  const before = Number(await main(page).getAttribute('data-time'));
  await button(page, 'Step experiment 1 s').click();
  await expect(main(page)).toHaveAttribute('data-time', String(before + 1)); await ready(page);
}
function observe(page: Page) {
  const errors: string[] = [], workers: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('requestfailed', request => { if (/\.(js|css|svg|png)(\?|$)/.test(request.url())) errors.push(`Failed asset: ${request.url()}`); });
  return { errors, workers };
}

test('PH4 real reference report, saved histories, project import and refresh recovery on desktop/mobile', async ({ page }, info) => {
  const observed = observe(page); await setup(page);
  await button(page, 'Start whole experiment').click();
  await expect(outcome(page)).toContainText('completed · FAIL'); await ready(page);
  await expect(experiment(page).getByTestId('experiment-shortfall')).toHaveText('80 accelerator-seconds');
  await expect(experiment(page).getByTestId('experiment-recovery')).toContainText('recovered · onset 15 s · confirmed 20 s');
  await expect(experiment(page)).toContainText('Final state: 8 serviceable accelerators');
  await experiment(page).getByText('Recorded definition, assumptions and evidence', { exact: true }).click();
  await expect(experiment(page)).toContainText('Imported checkpoint summaries are supplied evidence');
  const faulted = await exported(page), metrics = faulted.checkpoint.state.experiment.metrics;
  expect(metrics).toMatchObject({ shortfallAcceleratorS: 80, serviceViolationS: 10, firstServiceViolationS: 5, minServiceable: { value: 0, timeS: 5 } });
  expect(faulted.checkpoint.state.experiment.definition.recovery.dwellS).toBe(5);
  await button(page, 'Compare').click(); await button(page, 'Save current scenario locally').click();
  await button(page, 'Operate').click();
  await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  await button(page, 'Start whole experiment').click(); await expect(outcome(page)).toContainText('completed · PASS'); await ready(page);
  await button(page, 'Compare').click(); await button(page, 'Save current scenario locally').click();
  await button(page, 'Compare last two saved').click();
  await expect(page.getByRole('region', { name: 'Aligned experiment intervals', exact: true })).toBeVisible();
  const compared = page.locator('.twin-comparison-grid article');
  await expect(compared).toHaveCount(2);
  await expect(compared.nth(0).getByTestId('experiment-shortfall')).toHaveText('80 accelerator-seconds');
  await expect(compared.nth(1).getByTestId('experiment-shortfall')).toHaveText('0 accelerator-seconds');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('neptune-v2-scenarios') || '[]'));
  expect(stored.some((entry: { project: { checkpoint?: { state: { experiment?: { metrics: { shortfallAcceleratorS: number } } } } } }) => entry.project.checkpoint?.state.experiment?.metrics.shortfallAcceleratorS === 80)).toBe(true);
  await button(page, 'Operate').click();
  await page.getByLabel('Import project', { exact: true }).setInputFiles({ name: 'phase4-reference.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(faulted)) });
  await expect(outcome(page)).toContainText('completed · FAIL'); await ready(page);
  expect((await exported(page)).checkpoint.state.experiment).toEqual(faulted.checkpoint.state.experiment);
  await page.reload(); await ready(page);
  await expect(page.getByTestId('checkpoint-recovery')).toContainText('available at 20s');
  await page.setViewportSize({ width: 390, height: 844 });
  await button(page, 'Recover saved checkpoint').click(); await ready(page);
  await expect(outcome(page)).toContainText('completed · FAIL');
  expect((await exported(page)).checkpoint.state.experiment.metrics).toEqual(metrics);
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('phase4-reference-mobile.png'), fullPage: true });
  expect(observed.workers.length).toBeGreaterThan(0); expect(observed.errors).toEqual([]);
  await info.attach('phase4-reference', { body: JSON.stringify({ metrics, ...observed }), contentType: 'application/json' });
});

test('PH4 manual steps, UI speeds, pause, cancellation and mid-dwell refresh preserve real metric trajectory', async ({ page }) => {
  const observed = observe(page); await setup(page, true); await prepare(page);
  for (let second = 0; second < 17; second++) await step(page);
  const midDwell = await exported(page);
  expect(midDwell.checkpoint.state.experiment.metrics).toMatchObject({ elapsedS: 17, shortfallAcceleratorS: 80, pendingRecovery: { onsetTimeS: 15, confirmationTimeS: null } });
  await page.reload(); await ready(page); await button(page, 'Recover saved checkpoint').click(); await ready(page);
  for (let second = 17; second < 20; second++) await step(page);
  const manual = await exported(page);
  expect(manual.checkpoint.state.experiment.status).toBe('completed');
  for (const speed of ['5', '60']) {
    await prepare(page); await page.getByLabel('Simulation speed', { exact: true }).selectOption(speed);
    await button(page, 'Start').click();
    await expect(outcome(page)).toContainText('completed · FAIL'); await ready(page);
    expect((await exported(page)).checkpoint.state.experiment.metrics).toEqual(manual.checkpoint.state.experiment.metrics);
  }
  await prepare(page); await page.getByLabel('Simulation speed', { exact: true }).selectOption('1');
  await button(page, 'Start').click(); await expect(main(page)).toHaveAttribute('data-time', '1');
  await button(page, 'Pause').click(); await ready(page);
  const paused = await exported(page);
  expect(paused.checkpoint.state.experiment.status).toBe('paused');
  expect(paused.checkpoint.state.experiment.evaluation.outcome).toBe('INCOMPLETE');
  expect((await exported(page)).checkpoint).toEqual(paused.checkpoint);
  await button(page, 'Cancel experiment').click(); await ready(page);
  const cancelled = await exported(page);
  expect(cancelled.checkpoint.state.experiment.status).toBe('cancelled');
  expect(cancelled.checkpoint.state.experiment.evaluation.outcome).toBe('INCOMPLETE');
  expect(cancelled.checkpoint.state.experiment.metrics).toEqual(paused.checkpoint.state.experiment.metrics);
  expect(observed.errors).toEqual([]);
});

test('PH4 genuine fault pair and supported two-design signature export exact computed results', async ({ page }, info) => {
  const observed = observe(page); await setup(page); await button(page, 'Compare').click();
  await button(page, 'Run faulted / unfaulted pair').click();
  await expect(page.getByTestId('counterfactual-result')).toContainText('comparable: 80 accelerator-seconds');
  const cards = page.locator('.twin-comparison-grid article');
  const faulted = await exportedComparison(page, cards.filter({ has: page.getByRole('heading', { name: 'Faulted experiment', exact: true }) }));
  const baseline = await exportedComparison(page, cards.filter({ has: page.getByRole('heading', { name: 'Unfaulted baseline', exact: true }) }));
  expect(faulted.checkpoint.state.experiment.initialState).toEqual(baseline.checkpoint.state.experiment.initialState);
  expect(faulted.checkpoint.state.experiment.metrics.shortfallAcceleratorS - baseline.checkpoint.state.experiment.metrics.shortfallAcceleratorS).toBe(80);
  await button(page, 'Run signature demonstration').click();
  // Read the real comparison lifecycle before checking values. The existing
  // 60-second test budget bounds execution; a ready control does not prove success.
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(control => control.textContent === 'Run signature demonstration' && !control.disabled));
  const noStandby = cards.filter({ has: page.getByRole('heading', { name: 'No standby pump', exact: true }) }), standby = cards.filter({ has: page.getByRole('heading', { name: 'One standby pump', exact: true }) });
  await expect(noStandby.getByTestId('experiment-shortfall')).toHaveText('79,360 accelerator-seconds');
  await expect(standby.getByTestId('experiment-shortfall')).toHaveText('0 accelerator-seconds');
  await expect(noStandby).toContainText('signature-duty-trip at 30 s');
  await expect(noStandby.locator('dl > div').filter({ has: page.getByText('Qualifying violation onset', { exact: true }) }).locator('dd')).toContainText('240 s; recovery onset after violation 124 s; confirmation after violation 129 s');
  await expect(noStandby).toContainText('confirmation after fault 339 s');
  const a = await exportedComparison(page, noStandby), b = await exportedComparison(page, standby);
  expect(a.checkpoint.state.experiment.metrics).toMatchObject({ elapsedS: 1800, shortfallAcceleratorS: 79360, serviceViolationS: 124, minServiceable: { value: 640 }, traceTruncated: true });
  expect(b.checkpoint.state.experiment.metrics).toMatchObject({ elapsedS: 1800, shortfallAcceleratorS: 0, minServiceable: { value: 1280 } });
  expect(a.checkpoint.state.modules[0].availableAccelerators).toBe(1280);
  expect(b.checkpoint.state.modules[0].availableAccelerators).toBe(1280);
  expect(Math.abs(a.checkpoint.state.modules[0].coolantK - b.checkpoint.state.modules[0].coolantK)).toBeLessThan(0.01);
  expect(Math.abs(a.checkpoint.state.modules[0].airK - b.checkpoint.state.modules[0].airK)).toBeLessThan(0.1);
  await expect(page.getByRole('region', { name: 'Aligned experiment intervals', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('phase4-signature-desktop.png'), fullPage: true });
  expect(observed.workers.length).toBeGreaterThanOrEqual(4); expect(observed.errors).toEqual([]);
  await info.attach('phase4-signature-exported', { body: JSON.stringify({ withoutStandby: a.checkpoint.state.experiment.metrics, withStandby: b.checkpoint.state.experiment.metrics }), contentType: 'application/json' });
});

test('PH4 settled start succeeds or times out explicitly through keyboard and non-WebGL controls', async ({ page }) => {
  const observed = observe(page); await setup(page, true); await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  await page.getByLabel('Experiment initial conditions', { exact: true }).selectOption('settled');
  await page.getByLabel('Maximum warmup seconds', { exact: true }).fill('30');
  await button(page, 'Start whole experiment').focus(); await page.keyboard.press('Enter');
  await expect(outcome(page)).toContainText('warmup-timeout · INCOMPLETE'); await ready(page);
  const timedOut = await exported(page);
  expect(timedOut.checkpoint.state.experiment).toMatchObject({ originTimeS: null, warmup: { status: 'timeout', elapsedS: 30 }, metrics: { elapsedS: 0 } });
  await page.getByLabel('Maximum warmup seconds', { exact: true }).fill('1200');
  await button(page, 'Start whole experiment').click();
  await expect(outcome(page)).toContainText('completed · PASS'); await ready(page);
  const settled = await exported(page), run = settled.checkpoint.state.experiment;
  expect(run.warmup.status).toBe('settled'); expect(run.originTimeS).toBeGreaterThan(30);
  expect(run.metrics.elapsedS).toBe(20); expect(settled.timeS).toBe(run.originTimeS + 20);
  expect(run.metrics.initialBatteryWh).toBeLessThanOrEqual(run.initialState.modules.reduce((sum: number, module: { batteryWh: number }) => sum + module.batteryWh, 0));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  expect(observed.errors).toEqual([]);
});

test('PH4 replay retains the declared experiment and accumulated history', async ({ page }) => {
  await setup(page, true); await button(page, 'Start whole experiment').click();
  await expect(outcome(page)).toContainText('completed · FAIL'); await ready(page);
  const original = await exported(page);
  await button(page, 'Replay').click(); await ready(page);
  const replayed = await exported(page);
  expect(replayed.checkpoint.state.experiment?.definition).toEqual(original.checkpoint.state.experiment.definition);
  expect(replayed.checkpoint.state.experiment?.metrics).toEqual(original.checkpoint.state.experiment.metrics);
  await page.getByLabel('Replay time in seconds', { exact: true }).fill('10');
  await button(page, 'Seek time').click(); await ready(page);
  const partial = await exported(page);
  expect(partial.timeS).toBe(10);
  expect(partial.checkpoint.state.experiment?.definition).toEqual(original.checkpoint.state.experiment.definition);
  expect(partial.checkpoint.state.experiment?.metrics).toMatchObject({ elapsedS: 10, shortfallAcceleratorS: 40, serviceViolationS: 5 });
  expect(partial.checkpoint.state.experiment?.evaluation.outcome).toBe('INCOMPLETE');
});

test('PH4 unequal saved observation windows do not produce a falsely aligned endpoint delta', async ({ page }) => {
  await setup(page, true);
  await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  for (const duration of ['20', '40']) {
    await page.getByLabel('Experiment duration seconds', { exact: true }).fill(duration);
    await button(page, 'Start whole experiment').click(); await expect(outcome(page)).toContainText('completed · PASS'); await ready(page);
    await button(page, 'Compare').click(); await button(page, 'Save current scenario locally').click();
    await button(page, 'Operate').click();
  }
  await button(page, 'Compare').click(); await button(page, 'Compare last two saved').click();
  const cards = page.locator('.twin-comparison-grid article'); await expect(cards).toHaveCount(2);
  const observations = [await exportedComparison(page, cards.nth(0)), await exportedComparison(page, cards.nth(1))];
  expect(observations.map(project => project.timeS)).toEqual([20, 40]);
  await expect(page.locator('.twin-delta')).toHaveCount(0);
});

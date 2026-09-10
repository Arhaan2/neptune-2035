import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const duty = 'platform-001/module-01/pump-duty';
const main = (page: Page) => page.locator('main.twin-app');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
async function ready(page: Page) {
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await expect(button(page, 'Step 10s')).toBeEnabled();
}
async function loadSmall(page: Page, fallback = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fallback ? './?fallback=1' : './');
  await ready(page);
  const input = page.getByRole('spinbutton', { name: 'Requested accelerators', exact: true });
  await input.fill('8'); await input.press('Enter');
  await ready(page);
  await page.getByLabel('Select equipment', { exact: true }).selectOption(duty);
  await expect(main(page)).toHaveAttribute('data-selected', duty);
}
async function step(page: Page) {
  const before = Number(await main(page).getAttribute('data-time'));
  await button(page, 'Step 10s').click();
  await expect(main(page)).toHaveAttribute('data-time', String(before + 10));
  await ready(page);
}
async function artifact(page: Page, value: string) {
  const waiting = page.waitForEvent('download');
  await page.getByLabel('Export artifact', { exact: true }).selectOption(value);
  const download = await waiting;
  expect(await download.failure()).toBeNull();
  const path = await download.path(); if (!path) throw Error('Expected actual downloaded artifact.');
  return fs.readFile(path, 'utf8');
}
async function project(page: Page) { return JSON.parse(await artifact(page, 'project')); }
async function install(page: Page, specification: string) {
  await page.getByLabel('Replacement specification', { exact: true }).selectOption(specification);
  await expect(page.getByTestId('proposed-spec-details')).toBeVisible();
  await button(page, 'Apply and reset').click();
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await ready(page);
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

test('PH2 real-worker replacement preserves history and propagates through scene geometry, inspector, exports and mobile recovery', async ({ page }, info) => {
  test.setTimeout(180_000);
  const observed = observe(page);
  await loadSmall(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('installed-spec')).toContainText('72%');
  await expect(page.getByTestId('installed-spec')).toContainText('1.0.0');
  const original = await project(page);
  await button(page, 'Cooling close-up').click();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.focus)).toBe('cooling');
  await button(page, 'Explode').click();
  await button(page, 'Explode').click();
  const viewed = await project(page);
  expect(viewed.designSnapshot.revision).toBe(original.designSnapshot.revision);
  expect(viewed.checkpoint.configIdentity).toBe(original.checkpoint.configIdentity);
  expect(viewed.checkpoint.state).toEqual(original.checkpoint.state);

  await step(page);
  const oldRun = await project(page);
  await page.getByLabel('Replacement specification', { exact: true }).selectOption('pump-efficient');
  await expect(page.getByTestId('proposed-spec-details')).toContainText(/0\.84|84%/);
  // A proposed replacement leaves the active hardware/clock/checkpoint untouched until Apply.
  expect((await project(page)).checkpoint).toEqual(oldRun.checkpoint);
  await button(page, 'Apply and reset').click();
  await expect(main(page)).toHaveAttribute('data-time', '0'); await ready(page);
  await expect(page.getByTestId('installed-spec')).toContainText('84%');
  const efficient = await project(page);
  expect(efficient.designSnapshot.revision).not.toBe(oldRun.designSnapshot.revision);
  expect(efficient.checkpoint.state.events).toEqual([]);
  expect(efficient.checkpoint.state.modules[0].technicalFlowM3S).toBe(oldRun.checkpoint.state.modules[0].technicalFlowM3S);
  expect(efficient.checkpoint.state.modules[0].pumpPowerW).toBeLessThan(oldRun.checkpoint.state.modules[0].pumpPowerW);
  expect(efficient.checkpoint.state.modules[0].batteryWh).toBe(400000);
  expect(efficient.checkpoint.state.modules[0].coolantK).toBe(303.15);
  const savedHistory = await page.evaluate(() => JSON.parse(localStorage.getItem('neptune-v2-scenarios') || '[]'));
  const preserved = savedHistory.find((entry: { project: { designSnapshot: { revision: string } } }) => entry.project.designSnapshot.revision === oldRun.designSnapshot.revision);
  expect(preserved?.project.checkpoint.state).toEqual(oldRun.checkpoint.state);
  const efficientGeometry = JSON.parse(await artifact(page, 'gltf'));
  const efficientMesh = efficientGeometry.nodes.find((node: { name: string }) => node.name === duty);
  expect(efficientMesh.scale).toEqual([1.2, 1.2, 0.8]);

  await install(page, 'pump-physical');
  await expect(page.getByTestId('installed-spec')).toContainText('Physical replacement');
  await expect(page.locator('.twin-inspector')).toContainText('240');
  const physical = await project(page);
  expect(physical.checkpoint.state.modules[0].technicalFlowM3S).toBeGreaterThan(efficient.checkpoint.state.modules[0].technicalFlowM3S);
  const gltf = JSON.parse(await artifact(page, 'gltf'));
  const mesh = gltf.nodes.find((node: { name: string }) => node.name === duty);
  expect(mesh.scale).toEqual([1.35, 1.3, 0.9]);
  expect(mesh.extras.catalogId).toBe('pump-physical');
  expect(mesh.extras.assetRevision).toBe('1.0.0');
  const row = (await artifact(page, 'inventory')).split('\n').find(line => line.startsWith(`"${duty}"`))!;
  for (const value of ['pump-physical', '1.35', '1.3', '0.9', '240']) expect(row).toContain(`"${value}"`);
  const report = await artifact(page, 'report'); expect(report).toContain('pump-physical'); expect(report).toContain('280000');
  await step(page);
  const saved = await artifact(page, 'project');
  await button(page, 'Reset state').click(); await expect(main(page)).toHaveAttribute('data-time', '0'); await ready(page);
  await page.getByLabel('Import project', { exact: true }).setInputFiles({ name: 'phase2-replacement.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await expect(main(page)).toHaveAttribute('data-time', '10'); await ready(page);
  expect((await project(page)).checkpoint).toEqual(JSON.parse(saved).checkpoint);
  await page.reload();
  await expect(page.getByTestId('checkpoint-recovery')).toContainText('available at 10s');
  await expect(page.getByText('Saved scenario recovery failed:', { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await button(page, 'Recover saved checkpoint').click();
  await expect(main(page)).toHaveAttribute('data-time', '10'); await ready(page);
  await expect(page.getByTestId('installed-spec')).toContainText('Physical replacement');
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('phase2-mobile-replacement.png'), fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1050 });
  await button(page, 'Compare').click();
  await button(page, preserved.name).click();
  await ready(page);
  await expect(main(page)).toHaveAttribute('data-time', '10');
  expect((await project(page)).checkpoint).toEqual(oldRun.checkpoint);
  await expect(page.getByTestId('installed-spec')).toContainText('72%');
  expect(observed.workers.length).toBeGreaterThan(0); expect(observed.errors).toEqual([]);
  await info.attach('phase2-propagation', { body: JSON.stringify({ browser: info.project.name, mesh, oldRevision: oldRun.designSnapshot.revision, newRevision: physical.designSnapshot.revision, ...observed }), contentType: 'application/json' });
});

test('PH2 fallback replacement and cost-only UI edit retain exact physical checkpoint and worker stepping', async ({ page }, info) => {
  test.setTimeout(120_000);
  const observed = observe(page);
  await loadSmall(page, true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await install(page, 'pump-efficient');
  await step(page);
  const before = await project(page), reportBefore = await artifact(page, 'report');
  await button(page, 'Data & replay').click();
  const observationHistory = page.getByText(/retained replay window:/);
  await expect(observationHistory).toBeVisible();
  const retainedBefore = await observationHistory.innerText();
  const recordCount = Number(retainedBefore.match(/retained replay window: (\d+)/)?.[1]);
  expect(recordCount).toBeGreaterThanOrEqual(16);
  await button(page, 'Compare').click();
  await page.getByText('Cost scope and assumption sensitivity', { exact: true }).click();
  const cost = page.getByRole('spinbutton', { name: 'Equipment cost multiplier', exact: true });
  await cost.fill('1.5'); await cost.press('Enter');
  await expect(cost).toHaveValue('1.5');
  const priced = await project(page);
  expect(priced.checkpoint).toEqual(before.checkpoint);
  expect(priced.designSnapshot.revision).toBe(before.designSnapshot.revision);
  expect(priced.designSnapshot.equipment.economics.unitCostScale).toBe(1.5);
  await expect(observationHistory).toHaveText(retainedBefore);
  expect(await artifact(page, 'report')).not.toBe(reportBefore);
  await button(page, 'Operate').click();
  await step(page); await expect(main(page)).toHaveAttribute('data-time', '20');
  expect(observed.errors).toEqual([]);
  await info.attach('phase2-fallback-cost', { body: JSON.stringify({ oldIdentity: before.checkpoint.configIdentity, pricedIdentity: priced.checkpoint.configIdentity, retainedBefore, retainedAfter: await observationHistory.innerText(), ...observed }), contentType: 'application/json' });
});

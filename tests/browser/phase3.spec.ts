import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const main = (page: Page) => page.locator('main.twin-app');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('region', { name: 'Network capacity', exact: true });
async function ready(page: Page) {
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await expect(button(page, 'Step 10s')).toBeEnabled();
}
async function step(page: Page) {
  const before = Number(await main(page).getAttribute('data-time'));
  await button(page, 'Step 10s').click();
  await expect(main(page)).toHaveAttribute('data-time', String(before + 10));
  await ready(page);
}
async function changeNumber(page: Page, name: string, value: string) {
  const input = page.getByRole('spinbutton', { name, exact: true });
  await input.fill(value); await input.press('Enter'); await ready(page);
}
async function exported(page: Page, kind = 'project') {
  const waiting = page.waitForEvent('download');
  await page.getByLabel('Export artifact', { exact: true }).selectOption(kind);
  const download = await waiting;
  expect(await download.failure()).toBeNull();
  const path = await download.path(); if (!path) throw Error('Expected actual downloaded artifact.');
  return fs.readFile(path, 'utf8');
}
async function project(page: Page) { return JSON.parse(await exported(page)); }
async function preset(page: Page, value: string) {
  await page.getByLabel('Network configuration', { exact: true }).selectOption(value);
  await button(page, 'Apply network and reset').click();
  await expect(main(page)).toHaveAttribute('data-time', '0'); await ready(page);
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

test('PH3 nominal and undersized inspection, real worker, revision history, failure restoration and project recovery', async ({ page }, info) => {
  test.setTimeout(180_000);
  const observed = observe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  await changeNumber(page, 'Requested accelerators', '32008');
  await changeNumber(page, 'Supply ceiling', '100');
  await preset(page, 'scalable-reference');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Simulated, design-stage prototype; physical validation pending.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('network-design-name')).toHaveText('Scalable reference network');
  await expect(page.getByTestId('network-provisioning')).toContainText('Installed design demand: satisfied');
  await expect(page.getByTestId('network-provisioning')).toContainText('4,001 provisioned nodes');
  await expect(page.getByTestId('network-provisioning')).toContainText('400.1 Gbit/s');
  await expect(page.getByTestId('network-current')).toContainText('Current energized demand: satisfied');
  await panel(page).getByText('Saved workload assumptions', { exact: true }).click();
  await expect(panel(page)).toContainText('illustrative-job-traffic-v2');
  await expect(panel(page)).toContainText('100,000,000 bit/s per energized node');
  await expect(panel(page)).toContainText('1,000,000 bit/s per energized node');
  await expect(panel(page)).toContainText('not measured training traffic');
  await expect(panel(page)).toContainText('Legacy URL links carry only Legacy v0.1 settings');
  await button(page, 'Inspect shared core').click();
  await expect(main(page)).toHaveAttribute('data-selected', 'shore/cluster-core');
  await expect(panel(page).getByRole('cell', { name: /switch:shore\/cluster-core/ })).toContainText('7 domains');
  const initial = await project(page);
  expect(initial.designSnapshot.equipment.networkDesign.preset).toBe('scalable-reference');
  expect(initial.designSnapshot.equipment.workloadProfile.clusterBitSPerNode).toBe(100e6);
  expect(initial.checkpoint.state.modules.reduce((sum: number, module: { energizedNodes: number }) => sum + module.energizedNodes, 0)).toBe(4001);
  await step(page);
  const nominalRun = await project(page);

  await page.getByLabel('Network configuration', { exact: true }).selectOption('undersized-shared-core');
  expect((await project(page)).checkpoint).toEqual(nominalRun.checkpoint);
  await button(page, 'Apply network and reset').click(); await ready(page);
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await expect(page.getByTestId('network-provisioning')).toContainText('Installed design demand: violated');
  await expect(page.getByTestId('network-current')).toContainText('Current energized demand: violated');
  await expect(panel(page)).toContainText('switch:shore/cluster-core');
  const undersized = await project(page);
  expect(undersized.designSnapshot.revision).not.toBe(nominalRun.designSnapshot.revision);
  expect(undersized.checkpoint.state.modules.every((module: { availableAccelerators: number }) => module.availableAccelerators === 0)).toBe(true);
  const histories = await page.evaluate(() => JSON.parse(localStorage.getItem('neptune-v2-scenarios') || '[]'));
  expect(histories.some((entry: { project: { checkpoint: unknown } }) => JSON.stringify(entry.project.checkpoint) === JSON.stringify(nominalRun.checkpoint))).toBe(true);

  await preset(page, 'scalable-reference');
  await page.getByLabel('Inspect network asset', { exact: true }).selectOption('platform-001/cluster');
  await panel(page).getByText('Network links · enable / disable', { exact: true }).click();
  const link = panel(page).locator('.twin-network-link').filter({ hasText: 'shore/cluster-core>platform-001/cluster:cluster' });
  await link.getByRole('button', { name: 'Disable network link and reset', exact: true }).click(); await ready(page);
  await expect(page.getByTestId('network-current')).toContainText('1 affected domains');
  const disabled = await project(page);
  expect(disabled.checkpoint.state.modules.filter((module: { id: string }) => module.id.startsWith('platform-001/')).every((module: { availableAccelerators: number }) => module.availableAccelerators === 0)).toBe(true);
  expect(disabled.checkpoint.state.modules.filter((module: { id: string }) => module.id.startsWith('platform-002/')).every((module: { availableAccelerators: number }) => module.availableAccelerators > 0)).toBe(true);
  await link.getByRole('button', { name: 'Enable network link and reset', exact: true }).click(); await ready(page);
  await expect(page.getByTestId('network-current')).toContainText('Current energized demand: satisfied');
  await button(page, 'Inspect shared core').click();
  await button(page, 'Trip selected asset').click(); await step(page);
  const failed = await project(page);
  expect(failed.checkpoint.state.failedAssetIds).toContain('shore/cluster-core');
  expect(failed.checkpoint.state.modules.every((module: { availableAccelerators: number }) => module.availableAccelerators === 0)).toBe(true);
  await button(page, 'Restore selected asset').click(); await step(page);
  await expect(page.getByTestId('network-current')).toContainText('Current energized demand: satisfied');
  const saved = await exported(page), checkpoint = JSON.parse(saved).checkpoint;
  await button(page, 'Reset state').click(); await ready(page);
  await page.getByLabel('Import project', { exact: true }).setInputFiles({ name: 'phase3-network.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await expect(main(page)).toHaveAttribute('data-time', String(checkpoint.state.timeS)); await ready(page);
  expect((await project(page)).checkpoint).toEqual(checkpoint);
  await page.reload();
  await expect(page.getByTestId('checkpoint-recovery')).toContainText(`available at ${checkpoint.state.timeS}s`);
  await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await button(page, 'Recover saved checkpoint').click(); await ready(page);
  expect((await project(page)).checkpoint).toEqual(checkpoint);
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('phase3-mobile-network.png'), fullPage: true });
  if (info.project.name === 'firefox') {
    await page.setViewportSize({ width: 1600, height: 1050 });
    await page.getByLabel('Starting scenario', { exact: true }).selectOption('100000'); await ready(page);
    await expect(page.getByTestId('network-design-name')).toHaveText('Scalable reference network');
    await expect(page.getByTestId('network-provisioning')).toContainText('12,500 provisioned nodes');
    await expect(page.getByTestId('network-provisioning')).toContainText('1,250 Gbit/s');
    await expect(page.getByTestId('network-current')).toContainText('12,500 energized nodes');
    await expect(page.getByTestId('network-current')).toContainText('Current energized demand: satisfied');
    await step(page);
    const campus = await project(page);
    expect(campus.checkpoint.state.timeS).toBe(10);
    await preset(page, 'undersized-shared-core');
    await expect(page.getByTestId('network-provisioning')).toContainText('Installed design demand: violated');
    await expect(page.getByTestId('network-current')).toContainText('Current energized demand: violated');
    const undersizedCampus = await project(page);
    expect(undersizedCampus.checkpoint.state.modules.reduce((sum: number, module: { energizedNodes: number }) => sum + module.energizedNodes, 0)).toBe(12500);
    expect(undersizedCampus.checkpoint.state.modules.every((module: { availableAccelerators: number }) => module.availableAccelerators === 0)).toBe(true);
    await info.attach('phase3-campus', { body: JSON.stringify({ requested: 100000, nominalRevision: campus.designSnapshot.revision, undersizedRevision: undersizedCampus.designSnapshot.revision }), contentType: 'application/json' });
  }
  expect(observed.workers.length).toBeGreaterThan(0); expect(observed.errors).toEqual([]);
  await info.attach('phase3-network', { body: JSON.stringify({ browser: info.project.name, requested: 32008, nominalRevision: nominalRun.designSnapshot.revision, undersizedRevision: undersized.designSnapshot.revision, ...observed }), contentType: 'application/json' });
});

test('PH3 fallback and keyboard network controls retain the supported design', async ({ page }) => {
  const observed = observe(page);
  await page.goto('./?fallback=1'); await ready(page);
  await changeNumber(page, 'Requested accelerators', '8');
  await page.getByLabel('Network configuration', { exact: true }).selectOption('scalable-reference');
  await button(page, 'Apply network and reset').focus();
  await page.keyboard.press('Enter'); await ready(page);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByTestId('network-design-name')).toHaveText('Scalable reference network');
  await step(page);
  const saved = await project(page);
  expect(saved.designSnapshot.equipment.networkDesign.preset).toBe('scalable-reference');
  expect(saved.checkpoint.state.timeS).toBe(10);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  expect(observed.errors).toEqual([]);
});

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import { normalizeProject, parseProject, type CurrentProject } from '../../src/twin/persistence/project';
import { expectNoHorizontalOverflow } from './layout';

const duty = 'platform-001/module-01/pump-duty';
const standby = 'platform-001/module-01/pump-standby';
const main = (page: Page) => page.locator('main.twin-app');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

function observe(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  return errors;
}

async function ready(page: Page) {
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await expect(button(page, 'Step 10s')).toBeEnabled();
}

async function project(page: Page): Promise<CurrentProject> {
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export artifact', { exact: true }).selectOption('project');
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const file = await download.path();
  if (!file) throw Error('Expected a native project download.');
  const parsed = parseProject(await fs.readFile(file, 'utf8'));
  if (parsed.schemaVersion !== 3 || !parsed.checkpoint) throw Error('Expected the complete current checkpoint.');
  return parsed;
}

async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('VIS1 default campus and systems views preserve the complete normalized project', async ({ page }, info) => {
  const errors = observe(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await ready(page);
  await expect(page.locator('canvas')).toBeVisible();
  const before = await project(page);
  // The first visitor sees the actual configured campus, with no smaller visual fixture.
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({
    renderedModules: before.designSnapshot.modules.length,
    totalModules: before.designSnapshot.modules.length,
    renderedPlatforms: before.designSnapshot.assets.filter(asset => asset.type === 'platform').length,
    focus: 'campus',
    simulationTimeS: before.timeS,
    visualSystem: 'blue-hour-v1',
    reducedMotion: true,
  });
  await expect(page.getByText('Simulated, design-stage prototype; physical validation pending.', { exact: true }).first()).toBeVisible();
  await capture(page, info, 'visual-v1-campus-1440');
  const desktopCamera = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__!.camera);
  await page.setViewportSize({ width: 390, height: 844 });
  await button(page, 'Campus view').click();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__!.camera)).not.toEqual(desktopCamera);
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({
    renderedModules: before.designSnapshot.modules.length,
    totalModules: before.designSnapshot.modules.length,
    renderedPlatforms: before.designSnapshot.assets.filter(asset => asset.type === 'platform').length,
    focus: 'campus',
  });
  await expectNoHorizontalOverflow(page, 390);
  await capture(page, info, 'visual-v1-campus-resized-390');
  const mobileCamera = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__!.camera);
  await page.setViewportSize({ width: 1440, height: 900 });
  await button(page, 'Campus view').click();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__!.camera)).not.toEqual(mobileCamera);

  await button(page, 'Cooling close-up').click();
  await button(page, 'Explode').click();
  await button(page, 'Dimensions').click();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ focus: 'cooling', exploded: true });
  await expect(page.getByTestId('asset-context')).toContainText('no seawater reaches computing equipment');
  await capture(page, info, 'visual-v1-cooling-reveal');

  const feeder = before.designSnapshot.modules[0].powerDomainId;
  await page.getByLabel('Find asset ID', { exact: true }).fill(feeder);
  await button(page, 'Find').click();
  await expect(main(page)).toHaveAttribute('data-selected', feeder);
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.selectedId)).toBe(feeder);
  await capture(page, info, 'visual-v1-power-inspector');
  await page.getByLabel('Select equipment', { exact: true }).selectOption(duty);
  await button(page, 'Inside module').click();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.inside)).toBe(true);
  await capture(page, info, 'visual-v1-interior');
  await button(page, 'Exit interior').click();
  await button(page, 'Campus view').click();
  for (const name of ['Operate', 'Compare', 'Explore']) {
    await button(page, name).click();
    await expect(button(page, name)).toHaveAttribute('aria-pressed', 'true');
  }
  // Use the existing comparator: only the established solverMs timing field is normalized.
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  await expectNoHorizontalOverflow(page, 1440);
  expect(errors).toEqual([]);
});

test('VIS1 repeated selection reveal and interior visits release transient scene resources', async ({ page }, info) => {
  const errors = observe(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await ready(page);
  const cycle = async () => {
    await page.getByLabel('Select equipment', { exact: true }).selectOption(standby);
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.selectedId)).toBe(standby);
    await page.getByLabel('Select equipment', { exact: true }).selectOption(duty);
    await button(page, 'Cooling close-up').click();
    await button(page, 'Explode').click();
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ focus: 'cooling', exploded: true, selectedId: duty });
    await button(page, 'Inside module').click();
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.inside)).toBe(true);
    await button(page, 'Exit interior').click();
    await button(page, 'Explode').click();
    await button(page, 'X-ray').click();
    await button(page, 'Campus view').click();
    await expect(button(page, 'X-ray')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ focus: 'campus', inside: false, exploded: false, selectedId: duty });
  };
  const resources = () => page.evaluate(() => {
    const scene = window.__NEPTUNE_TWIN_SCENE__!;
    return { geometries: scene.geometries, textures: scene.textures };
  });
  // Compile/upload each visited presentation before comparing a repeated identical end state.
  await cycle();
  const warmed = await resources();
  expect(warmed.geometries).toBeGreaterThan(0);
  expect(warmed.textures).toBeGreaterThan(0);
  const observations = [warmed];
  for (let index = 0; index < 5; index++) {
    await cycle();
    await expect.poll(resources).toEqual(warmed);
    observations.push(await resources());
  }
  await info.attach('visual-v1-resource-stability', {
    body: JSON.stringify({ browser: info.project.name, warmupCycles: 1, measuredCycles: 5, observations }),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});

test('VIS1 reduced-motion 390px inspection and real WebGL loss retain faults and selection isolation', async ({ page }, info) => {
  const errors = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await ready(page);
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.oceanTimeS)).toBe(0);
  // A bounded observation window checks the actual decorative shader clock stays frozen.
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.oceanTimeS)).toBe(0);
  await expectNoHorizontalOverflow(page, 390);
  await button(page, 'Inside module').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.inside)).toBe(true);
  await button(page, 'Exit interior').focus();
  await expect(button(page, 'Exit interior')).toBeFocused();
  await expect(button(page, 'Exit interior')).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.inside)).toBe(false);
  await button(page, 'Operate').click();
  await button(page, 'Trip selected asset').click();
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  const failed = await project(page);
  await capture(page, info, 'visual-v1-mobile-failed-inspector');

  const lost = await page.locator('canvas').evaluate(canvas => {
    const context = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(lost, 'The test must exercise actual WebGL context loss.').toBe(true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByTestId('twin-fallback')).toBeVisible();
  await page.getByLabel('Select equipment', { exact: true }).selectOption(duty);
  const failedAsset = page.getByRole('button', { name: `pump duty, ${duty}, failed, selected`, exact: true });
  const failedFill = await failedAsset.locator('rect').getAttribute('fill');
  const peer = page.getByRole('button', { name: new RegExp(`pump standby, ${standby},`) });
  const peerFill = await peer.locator('rect').getAttribute('fill');
  expect(failedFill).not.toBe(peerFill);
  await peer.focus();
  await expect(peer).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', standby);
  await expect(page.getByRole('button', { name: `pump duty, ${duty}, failed`, exact: true }).locator('rect')).toHaveAttribute('fill', failedFill!);
  await expect(peer.locator('rect')).toHaveAttribute('fill', peerFill!);
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(failed));
  await expectNoHorizontalOverflow(page, 390);
  await capture(page, info, 'visual-v1-mobile-context-loss');
  expect(errors).toEqual([]);
});

test('VIS1 explicit fallback preserves observations, checkpoint import and operation across workspaces', async ({ page }, info) => {
  const errors = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?fallback=1');
  await ready(page);
  await expect(page.getByTestId('twin-fallback')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await button(page, 'Step 10s').click();
  await expect(main(page)).toHaveAttribute('data-time', '10');
  await ready(page);
  const before = await project(page);
  await button(page, 'Data & replay').click();
  const observations = page.getByText(/retained replay window:/);
  await expect(observations).toBeVisible();
  const retained = await observations.innerText();
  expect(Number(retained.match(/retained replay window: (\d+)/)?.[1])).toBeGreaterThan(0);
  await page.getByLabel('Drop generated observations', { exact: true }).check();
  for (const name of ['Compare', 'Operate', 'Explore']) {
    await button(page, name).click();
    await expectNoHorizontalOverflow(page, 390);
  }
  await expect(observations).toHaveText(retained);
  await expect(page.getByLabel('Drop generated observations', { exact: true })).toBeChecked();
  await button(page, 'Data & replay').click();
  await button(page, 'Cooling close-up').click();
  await button(page, 'Explode').click();
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));

  await page.getByLabel('Import project', { exact: true }).setInputFiles({
    name: 'visual-v1-checkpoint.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)),
  });
  await ready(page);
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  await button(page, 'Step 10s').click();
  await expect(main(page)).toHaveAttribute('data-time', '20');
  await ready(page);
  await expectNoHorizontalOverflow(page, 390);
  await capture(page, info, 'visual-v1-mobile-explicit-fallback');
  expect(errors).toEqual([]);
});

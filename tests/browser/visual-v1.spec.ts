import { withVisibleControl } from './visible-controls';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { PerspectiveCamera, Vector3 } from 'three';
import { normalizeProject, parseProject, type CurrentProject } from '../../src/twin/persistence/project';
import { expectNoHorizontalOverflow } from './layout';
import { activateLifecycleButton } from './lifecycle-keyboard';

const duty = 'platform-001/module-01/pump-duty';
const standby = 'platform-001/module-01/pump-standby';
const main = (page: Page) => page.locator('main.twin-app');
const button = (page: Page, name: string) => page.getByRole('button', { includeHidden: true, name, exact: true });

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
  await withVisibleControl(page, page.getByLabel('Export artifact', { exact: true }), control => control.selectOption('project'));
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
  // Exercise a shader that already rendered opaque before toggling its transparency.
  // Use the canonical roof position and the real camera; no platform-specific golden image.
  const opaqueScene = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__!);
  const canvas = page.locator('canvas');
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw Error('Expected the visible campus canvas bounds.');
  const cameraPosition = new Vector3().fromArray(opaqueScene.camera);
  const roof = before.designSnapshot.assets
    .filter(asset => asset.type === 'module' && !duty.startsWith(`${asset.id}/`))
    .sort((left, right) => new Vector3(...left.positionM).distanceToSquared(cameraPosition)
      - new Vector3(...right.positionM).distanceToSquared(cameraPosition))[0];
  expect(roof, 'The configured campus must include a nonselected roof.').toBeDefined();
  const projection = new PerspectiveCamera(46, canvasBounds.width / canvasBounds.height, 0.1, 10000);
  projection.position.copy(cameraPosition);
  projection.lookAt(new Vector3().fromArray(opaqueScene.target));
  projection.updateMatrixWorld();
  // Offset within the canonical roof to avoid the center seam and its metal trim.
  const roofSampleM: [number, number, number] = [roof.positionM[0] + 1, roof.positionM[1] + roof.dimensionsM[1] / 2, roof.positionM[2] + 0.5];
  const roofCenter = new Vector3(...roofSampleM).project(projection);
  const opaquePixels = await canvas.screenshot({ scale: 'css' });
  const imageSize = await sharp(opaquePixels).metadata();
  const region = {
    left: Math.round((roofCenter.x + 1) / 2 * imageSize.width!) - 5,
    top: Math.round((1 - roofCenter.y) / 2 * imageSize.height!) - 5,
    width: 10, height: 10,
  };
  expect(region.left).toBeGreaterThanOrEqual(0);
  expect(region.top).toBeGreaterThanOrEqual(0);
  expect(region.left + region.width).toBeLessThanOrEqual(imageSize.width!);
  expect(region.top + region.height).toBeLessThanOrEqual(imageSize.height!);
  const luminance = async (pixels: Buffer) => {
    const { data, info: sample } = await sharp(pixels).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (let index = 0; index < data.length; index += sample.channels) {
      sum += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    }
    return sum / (sample.width * sample.height);
  };
  await button(page, 'X-ray').click();
  await expect(button(page, 'X-ray')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  const transparentPixels = await canvas.screenshot({ scale: 'css' });
  const opaqueLuminance = await luminance(opaquePixels), transparentLuminance = await luminance(transparentPixels);
  await info.attach('visual-v1-warmed-opaque-canvas', { body: opaquePixels, contentType: 'image/png' });
  await info.attach('visual-v1-warmed-xray-canvas', { body: transparentPixels, contentType: 'image/png' });
  await info.attach('visual-v1-roof-transparency', {
    body: JSON.stringify({ assetId: roof.id, canonicalRoofM: roofSampleM, region, opaqueLuminance, transparentLuminance }),
    contentType: 'application/json',
  });
  expect(opaqueLuminance - transparentLuminance, 'X-ray must visibly reveal the darker structure below an already rendered pearl roof.').toBeGreaterThan(10);
  await expect.poll(() => page.evaluate(() => ({ camera: window.__NEPTUNE_TWIN_SCENE__!.camera, target: window.__NEPTUNE_TWIN_SCENE__!.target }))).toEqual({ camera: opaqueScene.camera, target: opaqueScene.target });
  await button(page, 'X-ray').click();
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
  await withVisibleControl(page, page.getByLabel('Find asset ID', { exact: true }), control => control.fill(feeder));
  await withVisibleControl(page, button(page, 'Find'), control => control.click());
  await expect(main(page)).toHaveAttribute('data-selected', feeder);
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.selectedId)).toBe(feeder);
  await capture(page, info, 'visual-v1-power-inspector');
  await withVisibleControl(page, page.getByLabel('Select equipment', { exact: true }), control => control.selectOption(duty));
  await button(page, 'Inside module').click();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.inside)).toBe(true);
  await capture(page, info, 'visual-v1-interior');
  await button(page, 'Exit interior').click();
  await button(page, 'Campus view').click();
  for (const name of ['Operate', 'Compare', 'Explore']) {
    await withVisibleControl(page, button(page, name), control => control.click());
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
  // Keep every lifecycle transition and resource assertion while using native
  // keyboard input; the preceding VIS1 case retains pointer coverage of these controls.
  const activate = (name: string) => activateLifecycleButton(page, name);
  const cycle = async () => {
    await withVisibleControl(page, page.getByLabel('Select equipment', { exact: true }), control => control.selectOption(standby));
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.selectedId)).toBe(standby);
    await withVisibleControl(page, page.getByLabel('Select equipment', { exact: true }), control => control.selectOption(duty));
    await activate('Cooling close-up');
    await activate('Explode');
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ focus: 'cooling', exploded: true, selectedId: duty });
    await activate('Inside module');
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.inside)).toBe(true);
    await activate('Exit interior');
    await activate('Explode');
    await activate('X-ray');
    await activate('Campus view');
    await expect(button(page, 'X-ray')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ focus: 'campus', inside: false, exploded: false, selectedId: duty });
  };
  const completedRenderResources = () => page.evaluate(() => new Promise<{ geometries: number; textures: number }>(resolve => {
    // Diagnostics publish after rendering. Retain two subsequent publications
    // so resource comparisons follow the final campus transition and cleanup.
    let previous = window.__NEPTUNE_TWIN_SCENE__, emissions = 0;
    const observeFrame = () => {
      const scene = window.__NEPTUNE_TWIN_SCENE__;
      if (scene && scene !== previous) {
        previous = scene;
        emissions += 1;
        if (emissions === 2) {
          resolve({ geometries: scene.geometries, textures: scene.textures });
          return;
        }
      }
      requestAnimationFrame(observeFrame);
    };
    requestAnimationFrame(observeFrame);
  }));
  // Compile/upload each visited presentation before comparing a repeated identical end state.
  await cycle();
  const warmed = await completedRenderResources();
  expect(warmed.geometries).toBeGreaterThan(0);
  expect(warmed.textures).toBeGreaterThan(0);
  const observations = [warmed];
  for (let index = 0; index < 5; index++) {
    await cycle();
    const measured = await completedRenderResources();
    expect(measured).toEqual(warmed);
    observations.push(measured);
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
  await withVisibleControl(page, button(page, 'Trip selected asset'), control => control.click());
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
  await withVisibleControl(page, page.getByLabel('Select equipment', { exact: true }), control => control.selectOption(duty));
  const failedAsset = page.getByRole('button', { includeHidden: true, name: `pump duty, ${duty}, failed, selected`, exact: true });
  const failedFill = await failedAsset.locator('rect').getAttribute('fill');
  const peer = page.getByRole('button', { includeHidden: true, name: new RegExp(`pump standby, ${standby},`) });
  const peerFill = await peer.locator('rect').getAttribute('fill');
  expect(failedFill).not.toBe(peerFill);
  await withVisibleControl(page, peer, control => control.focus());
  await expect(peer).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', standby);
  await expect(page.getByRole('button', { includeHidden: true, name: `pump duty, ${duty}, failed`, exact: true }).locator('rect')).toHaveAttribute('fill', failedFill!);
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
  await withVisibleControl(page, button(page, 'Data & replay'), control => control.click());
  const observations = page.getByText(/retained replay window:/);
  await expect(observations).toBeVisible();
  const retained = await observations.innerText();
  expect(Number(retained.match(/retained replay window: (\d+)/)?.[1])).toBeGreaterThan(0);
  await withVisibleControl(page, page.getByLabel('Drop generated observations', { exact: true }), control => control.check());
  for (const name of ['Compare', 'Operate', 'Explore']) {
    await withVisibleControl(page, button(page, name), control => control.click());
    await expectNoHorizontalOverflow(page, 390);
  }
  await expect(observations).toHaveText(retained);
  await expect(page.getByLabel('Drop generated observations', { exact: true })).toBeChecked();
  await withVisibleControl(page, button(page, 'Data & replay'), control => control.click());
  await button(page, 'Cooling close-up').click();
  await button(page, 'Explode').click();
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));

  await withVisibleControl(page, page.getByLabel('Import project', { exact: true }), control => control.setInputFiles({
    name: 'visual-v1-checkpoint.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)),
  }));
  await ready(page);
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  await button(page, 'Step 10s').click();
  await expect(main(page)).toHaveAttribute('data-time', '20');
  await ready(page);
  await expectNoHorizontalOverflow(page, 390);
  await capture(page, info, 'visual-v1-mobile-explicit-fallback');
  expect(errors).toEqual([]);
});

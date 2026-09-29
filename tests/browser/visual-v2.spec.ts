import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import { normalizeProject, parseProject, type CurrentProject } from '../../src/twin/persistence/project';
import { expectNoHorizontalOverflow } from './layout';
import { activateLifecycleButton } from './lifecycle-keyboard';
const manifest = JSON.parse(await fs.readFile(new URL('../../public/visuals/v2/manifest.json', import.meta.url), 'utf8')) as { templates: { id: string; bytes: number }[] };

const duty = 'platform-001/module-01/pump-duty';
const standby = 'platform-001/module-01/pump-standby';
const secondDuty = 'platform-001/module-02/pump-duty';
const glbs = /\/visuals\/v2\/(?:pump|exchanger)\.glb(?:\?.*)?$/;
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const main = (page: Page) => page.locator('main.twin-app');
type KitAsset = { assetId: string; kind: string; status: string; selected: boolean; operatingState: string; materialColor: string; meshCount: number; renderedMeshes: number; worldCenter: number[]; childWorldPoint: number[] };
type Observation = NonNullable<Window['__NEPTUNE_TWIN_SCENE__']> & { renderEpoch: number; visualKit: { version: string; moduleId: string; status: string; assets: KitAsset[]; cache: { geometries: number; materials: number; textures: number; instances: number } } };
const scene = (page: Page) => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__ as Observation);
const kit = async (page: Page): Promise<Observation['visualKit'] | undefined> => (await scene(page))?.visualKit;
function errors(page: Page) {
  const collected: string[] = [];
  page.on('pageerror', error => collected.push(error.message));
  return collected;
}
async function ready(page: Page) {
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await expect(button(page, 'Step 10s')).toBeEnabled();
  await expect.poll(async () => (await scene(page))?.renderEpoch ?? 0).toBeGreaterThan(0);
}
async function completed(page: Page) {
  // Observe two NEW post-render publications. A legitimate canvas remount may
  // restart its local counter, so compare publication identity as well as epoch.
  return page.evaluate(() => new Promise<Observation>((resolve, reject) => {
    let previous = window.__NEPTUNE_TWIN_SCENE__, emissions = 0;
    const timeout = setTimeout(() => reject(Error('No two completed render epochs within 12 seconds.')), 12000);
    const observe = () => {
      const current = window.__NEPTUNE_TWIN_SCENE__;
      if (current && current !== previous && current.renderEpoch > 0) {
        previous = current;
        if (++emissions === 2) { clearTimeout(timeout); resolve(current as Observation); return; }
      }
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  }));
}
async function select(page: Page, id: string) {
  const equipment = page.getByLabel('Select equipment', { exact: true });
  const optionExists = await equipment.locator('option').evaluateAll((options, target) => options.some(option => (option as HTMLOptionElement).value === target), id);
  if (optionExists) await equipment.selectOption(id);
  else { await page.getByLabel('Find asset ID', { exact: true }).fill(id); await button(page, 'Find').click(); }
  await expect(main(page)).toHaveAttribute('data-selected', id);
}
async function reveal(page: Page, id = duty, activate = (name: string) => button(page, name).click()) {
  await select(page, id);
  await activate('Cooling close-up');
  await expect.poll(() => kit(page)).toMatchObject({ version: 'systems-reveal-v2', moduleId: id.slice(0, id.lastIndexOf('/')), status: 'ready' });
  const observation = await completed(page);
  expect(observation.visualKit.assets.length).toBeGreaterThanOrEqual(3);
  expect(observation.visualKit.assets.every(asset => asset.status === 'ready' && asset.meshCount > 0 && asset.renderedMeshes > 0)).toBe(true);
  return observation;
}
async function toggle(page: Page, name: string, value: boolean, activate = (label: string) => button(page, label).click()) {
  if ((await button(page, name).getAttribute('aria-pressed')) !== String(value)) await activate(name);
}
async function download(page: Page, kind: string) {
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export artifact', { exact: true }).selectOption(kind);
  const artifact = await pending;
  expect(await artifact.failure()).toBeNull();
  const file = await artifact.path();
  if (!file) throw Error(`No readable ${kind} export.`);
  return fs.readFile(file, 'utf8');
}
async function project(page: Page): Promise<CurrentProject> {
  const parsed = parseProject(await download(page, 'project'));
  if (parsed.schemaVersion !== 3 || !parsed.checkpoint) throw Error('Expected current checkpoint export.');
  return parsed;
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if ((page.viewportSize()?.width ?? 1440) <= 390 && await page.locator('canvas').count()) await page.locator('canvas').scrollIntoViewIfNeeded();
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

test('VIS2 lazy production-path authored kit renders while paused exports remain canonical', async ({ page }, info) => {
  const failures = errors(page), requests: string[] = [];
  page.on('request', request => { if (glbs.test(request.url())) requests.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  const before = await project(page);
  const inventoryBefore = await download(page, 'inventory');
  const geometryBefore = JSON.parse(await download(page, 'gltf'));
  const resultsBefore = await download(page, 'results');
  expect(requests, 'Initial campus and usable controls do not fetch the detail kit.').toEqual([]);
  const campus = await completed(page);
  expect(campus.visualSystem).toBe('blue-hour-v1');
  expect(campus.renderedModules).toBe(before.designSnapshot.modules.length);
  await capture(page, info, 'visual-v2-campus');
  const authored = await reveal(page);
  expect(new Set(requests.map(url => new URL(url).pathname))).toEqual(new Set([
    new URL('visuals/v2/pump.glb', page.url()).pathname,
    new URL('visuals/v2/exchanger.glb', page.url()).pathname,
  ]));
  expect(authored.drawCalls).toBeLessThanOrEqual(250);
  expect(authored.triangles).toBeLessThanOrEqual(500000);
  await capture(page, info, 'visual-v2-ordinary-cooling-control');
  await toggle(page, 'Explode', true); await completed(page);
  await capture(page, info, 'visual-v2-authored-cooling-reveal');
  await reveal(page, secondDuty); await capture(page, info, 'visual-v2-second-module');
  await button(page, 'Inside module').click();
  await expect.poll(async () => (await scene(page)).inside).toBe(true);
  await button(page, 'Exit interior').click();
  await button(page, 'Campus view').click();
  await toggle(page, 'Explode', false); await toggle(page, 'X-ray', false); await completed(page);
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  expect(await download(page, 'inventory')).toBe(inventoryBefore);
  expect(await download(page, 'results')).toBe(resultsBefore);
  expect(JSON.parse(await download(page, 'gltf'))).toEqual(geometryBefore);
  expect(requests).toHaveLength(2);
  await info.attach('visual-v2-authored-and-canonical', { body: JSON.stringify({ campus, authored, requests }), contentType: 'application/json' });
  expect(failures).toEqual([]);
});

test('VIS2 delayed GLBs stay procedural and late completion binds only the selected replacement design', async ({ page }, info) => {
  const failures = errors(page);
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const pending: string[] = [];
  await page.route(glbs, async route => { pending.push(route.request().url()); await barrier; await route.continue(); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  try {
    await button(page, 'Cooling close-up').click();
    await expect.poll(() => pending.length).toBe(2);
    await expect.poll(() => kit(page)).toMatchObject({ status: 'loading' });
    expect((await completed(page)).visualKit.assets.every(asset => asset.meshCount === 0)).toBe(true);
    await expect(button(page, 'Step 10s')).toBeEnabled();
    await select(page, secondDuty);
    await button(page, 'Cooling close-up').click();
    await button(page, 'Design family II').click(); await ready(page);
    await select(page, secondDuty); await button(page, 'Cooling close-up').click();
    const current = await project(page);
    await capture(page, info, 'visual-v2-delayed-procedural');
    release();
    const loaded = await reveal(page, secondDuty);
    expect(loaded.visualKit.assets.every(asset => asset.assetId.startsWith('platform-001/module-02/'))).toBe(true);
    expect(loaded.selectedId).toBe(secondDuty);
    expect(normalizeProject(await project(page))).toEqual(normalizeProject(current));
    await capture(page, info, 'visual-v2-delayed-current-design');
  } finally { release(); }
  expect(failures).toEqual([]);
});

for (const fault of ['missing', 'corrupt'] as const) {
  test(`VIS2 ${fault} pump GLB retains honest interactive procedural fallback`, async ({ page }, info) => {
    const failures = errors(page);
    await page.route('**/visuals/v2/pump.glb', route => fault === 'missing'
      ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'Intentional missing asset fixture' })
      : route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.alloc(manifest.templates.find(template => template.id === 'pump')!.bytes, 0x7f) }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./'); await ready(page);
    const before = await project(page);
    await button(page, 'Cooling close-up').click();
    await expect.poll(() => kit(page)).toMatchObject({ status: 'fallback' });
    await expect(page.getByTestId('visual-kit-status')).toContainText(/fallback|procedural/i);
    const observed = await completed(page);
    const pump = observed.visualKit.assets.find(asset => asset.assetId === duty)!;
    expect(pump.status).toBe('fallback'); expect(pump.meshCount).toBe(0);
    await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.kind === 'exchanger')).toMatchObject({ status: 'ready' });
    await select(page, standby); await button(page, 'Cooling close-up').click(); await completed(page);
    expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
    await button(page, 'Operate').click(); await button(page, 'Trip selected asset').click();
    await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
    await capture(page, info, `visual-v2-${fault}-interactive-fallback`);
    expect(failures).toEqual([]);
  });
}

test('VIS2 authored submesh and keyboard selection isolate live failure and exact history colors', async ({ page }, info) => {
  const failures = errors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  await button(page, 'Operate').click();
  await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  await page.getByLabel('Experiment initial conditions', { exact: true }).selectOption('cold');
  await button(page, 'Prepare experiment for stepping').click(); await ready(page);
  await button(page, 'Step 10s').click(); await ready(page);
  await expect(main(page)).toHaveAttribute('data-time', '10');
  await reveal(page); await button(page, 'Operate').click();
  await button(page, 'Trip selected asset').click();
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  await select(page, standby); await button(page, 'Cooling close-up').click();
  const failed = await completed(page);
  const failedDuty = failed.visualKit.assets.find(asset => asset.assetId === duty)!;
  const selectedPeer = failed.visualKit.assets.find(asset => asset.assetId === standby)!;
  expect(failedDuty).toMatchObject({ status: 'ready', selected: false, operatingState: 'failed' });
  expect(selectedPeer).toMatchObject({ status: 'ready', selected: true });
  expect(selectedPeer.operatingState).not.toBe('failed');
  expect(failedDuty.materialColor).not.toBe(selectedPeer.materialColor);
  // Project an actual authored triangle centroid, then use the browser pointer.
  // This exercises scene raycasting and child→canonical parent identity.
  const bounds = await page.locator('canvas').boundingBox();
  if (!bounds) throw Error('Canvas is not visible.');
  const camera = new PerspectiveCamera(46, bounds.width / bounds.height, 0.1, 10000);
  camera.position.fromArray(failed.camera); camera.lookAt(new Vector3().fromArray(failed.target)); camera.updateMatrixWorld();
  expect(failedDuty.childWorldPoint, 'The authored mesh must provide a visible surface hit.').toBeDefined();
  const point = new Vector3().fromArray(failedDuty.childWorldPoint!).project(camera);
  expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1);
  await page.mouse.click(bounds.x + (point.x + 1) / 2 * bounds.width, bounds.y + (1 - point.y) / 2 * bounds.height);
  await expect(main(page)).toHaveAttribute('data-selected', duty);
  await expect(page.getByTestId('asset-context')).toHaveAttribute('data-asset-id', duty);
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  const finder = page.getByLabel('Find asset ID', { exact: true });
  await finder.fill(standby); await finder.focus(); await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', standby);
  await expect(page.getByLabel('Select equipment', { exact: true })).toHaveValue(standby);
  await select(page, duty); await button(page, 'Cooling close-up').click();
  const checkpoint = await project(page);
  await page.getByLabel('Inspect history time in seconds', { exact: true }).fill('0');
  await button(page, 'Inspect history time').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
  await expect(main(page)).toHaveAttribute('data-display-time', '0');
  await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.assetId === duty)?.operatingState).not.toBe('failed');
  const historical = await completed(page);
  expect(historical.simulationTimeS).toBe(0);
  expect(historical.visualKit.assets.find(asset => asset.assetId === duty)!.operatingState).toBe(await page.getByTestId('asset-operating-status').innerText());
  await button(page, 'Return to current state').click();
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.assetId === duty)?.operatingState).toBe('failed');
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(checkpoint));
  await select(page, standby); await button(page, 'Cooling close-up').click(); await completed(page);
  await capture(page, info, 'visual-v2-failed-duty-selected-peer');
  expect(failures).toEqual([]);
});

test('VIS2 warmed reveal cycles reach the same post-render resource inventory', async ({ page }, info) => {
  const failures = errors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  // Exercise the identical lifecycle through native keyboard activation. Pointer
  // discoverability and authored-surface clicks remain in the other VIS1/VIS2 cases.
  const activate = (name: string) => activateLifecycleButton(page, name);
  const cycle = async (id: string) => {
    await reveal(page, id, activate);
    await toggle(page, 'Explode', true, activate); await completed(page);
    await toggle(page, 'Explode', false, activate); await toggle(page, 'X-ray', false, activate); await completed(page);
    await toggle(page, 'X-ray', true, activate); await completed(page);
    await select(page, duty); await activate('Campus view');
    await toggle(page, 'X-ray', false, activate); return completed(page);
  };
  await cycle(duty); await cycle(secondDuty);
  const baseline = await cycle(duty);
  const inventory = (value: Observation) => ({ geometries: value.geometries, textures: value.textures, cache: value.visualKit.cache });
  const observations = [baseline];
  for (let index = 0; index < 5; index++) {
    const value = await cycle(index % 2 ? duty : secondDuty);
    expect(value.renderEpoch).toBeGreaterThan(observations.at(-1)!.renderEpoch);
    expect(inventory(value)).toEqual(inventory(baseline));
    expect(value.simulationTimeS).toBe(0); observations.push(value);
  }
  await info.attach('visual-v2-post-render-resource-plateau', { body: JSON.stringify({ browser: info.project.name, warmupCycles: 3, measuredCycles: 5, observations }), contentType: 'application/json' });
  expect(failures).toEqual([]);
});

test('VIS2 390px reduced-motion authored reveal and real context loss preserve paused state', async ({ page }, info) => {
  const failures = errors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  await reveal(page); await expectNoHorizontalOverflow(page, 390);
  expect((await scene(page)).reducedMotion).toBe(true);
  await button(page, 'Cooling close-up').focus(); await expect(button(page, 'Cooling close-up')).toBeInViewport();
  await page.keyboard.press('Enter'); await completed(page);
  await capture(page, info, 'visual-v2-390-authored-reveal');
  await button(page, 'Inside module').click();
  await expect.poll(async () => (await scene(page)).inside).toBe(true);
  await button(page, 'Exit interior').focus(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await scene(page)).inside).toBe(false);
  await reveal(page); const before = await project(page);
  const lost = await page.locator('canvas').evaluate(canvas => {
    const extension = (canvas as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  });
  expect(lost, 'Exercise real WebGL context loss.').toBe(true);
  await expect(page.getByTestId('twin-fallback')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await select(page, standby); await button(page, 'Cooling close-up').click();
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  await expectNoHorizontalOverflow(page, 390);
  await expect(button(page, 'Step 10s')).toBeEnabled();
  await capture(page, info, 'visual-v2-390-context-fallback');
  await button(page, 'Restore 3D view').click();
  await expect(page.locator('canvas')).toBeVisible();
  await reveal(page, standby);
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  await expectNoHorizontalOverflow(page, 390);
  await capture(page, info, 'visual-v2-390-context-restored');
  expect(failures).toEqual([]);
});


test('VIS2 compatible efficiency replacement reuses authored kit and different physical pump stays procedural', async ({ page }, info) => {
  const failures = errors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page); await reveal(page);
  await page.getByLabel('Replacement specification', { exact: true }).selectOption('pump-efficient');
  await button(page, 'Apply and reset').click(); await ready(page);
  await expect(page.getByTestId('installed-spec')).toContainText('pump-efficient');
  await reveal(page);
  await page.getByLabel('Replacement specification', { exact: true }).selectOption('pump-physical');
  await button(page, 'Apply and reset').click(); await ready(page);
  await expect(page.getByTestId('installed-spec')).toContainText('pump-physical');
  await button(page, 'Cooling close-up').click();
  await expect.poll(() => kit(page)).toMatchObject({ status: 'fallback' });
  const observed = await completed(page);
  expect(observed.visualKit.assets.find(asset => asset.assetId === duty)).toMatchObject({ status: 'fallback', meshCount: 0 });
  expect(observed.visualKit.assets.find(asset => asset.assetId === standby)).toMatchObject({ status: 'ready' });
  const replaced = await project(page);
  await toggle(page, 'Explode', true); await completed(page);
  await select(page, standby); await button(page, 'Cooling close-up').click(); await completed(page);
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(replaced));
  await capture(page, info, 'visual-v2-incompatible-physical-replacement');
  expect(failures).toEqual([]);
});

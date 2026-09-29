import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import { Box3, PerspectiveCamera, Ray, Vector3 } from 'three';
import { resolveAsset } from '../../src/twin/assets/design';
import { normalizeProject, parseProject, type CurrentProject } from '../../src/twin/persistence/project';
import { presentationOffset, presentedPosition } from '../../src/scene/twinGeometry';
import type { KitDiagnostic } from '../../src/scene/visuals/AuthoredEquipment';

const manifest = JSON.parse(await fs.readFile(new URL('../../public/visuals/v3/manifest.json', import.meta.url), 'utf8')) as { templates: { bytes: number }[] };
const cdu = 'platform-001/module-01/cdu', secondCdu = 'platform-001/module-02/cdu';
const glbs = /\/visuals\/(?:v2\/(?:pump|exchanger)|v3\/cdu)\.glb(?:\?.*)?$/;
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const main = (page: Page) => page.locator('main.twin-app');
type Observation = NonNullable<Window['__NEPTUNE_TWIN_SCENE__']> & { renderEpoch: number; visualKit: KitDiagnostic };
const scene = (page: Page) => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__ as Observation);
const kit = async (page: Page) => (await scene(page))?.visualKit;
async function ready(page: Page) {
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await expect(button(page, 'Step 10s')).toBeEnabled();
  await expect.poll(async () => (await scene(page))?.renderEpoch ?? 0).toBeGreaterThan(0);
}
async function completed(page: Page) {
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
  const finder = page.getByLabel('Find asset ID', { exact: true });
  await finder.fill(id); await finder.focus(); await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', id);
}
async function reveal(page: Page, id = cdu) {
  await select(page, id); await button(page, 'Cooling close-up').click();
  await expect.poll(() => kit(page)).toMatchObject({ version: 'systems-reveal-v3', status: 'ready', moduleId: id.slice(0, id.lastIndexOf('/')) });
  await expect.poll(async () => (await kit(page))?.assets.every(asset => asset.meshCount === 4 && asset.renderedMeshes > 0)).toBe(true);
  return completed(page);
}
async function project(page: Page): Promise<CurrentProject> {
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export artifact', { exact: true }).selectOption('project');
  const artifact = await pending; expect(await artifact.failure()).toBeNull();
  const file = await artifact.path(); if (!file) throw Error('No project export.');
  const value = parseProject(await fs.readFile(file, 'utf8'));
  if (value.schemaVersion !== 3 || !value.checkpoint) throw Error('Expected current checkpoint export.');
  return value;
}
async function clickProceduralCdu(page: Page, id = cdu) {
  // Derive a point on the canonical procedural box, without adding a production
  // diagnostic or relying on an inspector selection as the interaction witness.
  const installed = resolveAsset((await project(page)).designSnapshot, id);
  if (!installed) throw Error('No installed CDU.');
  await select(page, id.replace(/cdu$/, 'pump-duty'));
  await button(page, 'Cooling close-up').click();
  const observation = await completed(page), canvas = await page.locator('canvas').boundingBox();
  if (!canvas) throw Error('No canvas.');
  const camera = new PerspectiveCamera(46, canvas.width / canvas.height, 0.1, 10000);
  camera.position.fromArray(observation.camera); camera.lookAt(new Vector3().fromArray(observation.target)); camera.updateMatrixWorld();
  const center = new Vector3(...presentedPosition(installed, observation.exploded));
  const half = new Vector3(...installed.dimensionsM).multiplyScalar(0.5);
  const aim = center.clone().add(new Vector3(0, installed.dimensionsM[1] * 0.2, 0));
  const ray = new Ray(camera.position, aim.sub(camera.position).normalize());
  const hit = ray.intersectBox(new Box3(center.clone().sub(half), center.clone().add(half)), new Vector3());
  expect(hit, 'The projected canonical cabinet face must exist.').not.toBeNull();
  const point = hit!.project(camera);
  expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1);
  await page.mouse.click(canvas.x + (point.x + 1) * canvas.width / 2, canvas.y + (1 - point.y) * canvas.height / 2);
  await expect(main(page)).toHaveAttribute('data-selected', id);
  await expect(page.getByTestId('asset-context')).toHaveAttribute('data-asset-id', id);
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}
function errors(page: Page) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); return errors;
}

test('VIS3 three lazy templates render authored surfaces with canonical placement and second-module purity', async ({ page }, info) => {
  const failures = errors(page), requests: string[] = [];
  page.on('request', request => { if (glbs.test(request.url())) requests.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page); const before = await project(page);
  expect(requests).toEqual([]);
  const loaded = await reveal(page);
  expect([...new Set(loaded.visualKit.assets.map(asset => asset.kind))].sort()).toEqual(['cdu', 'exchanger', 'pump']);
  expect(loaded.visualKit.assets).toHaveLength(5);
  expect(loaded.visualKit.cache).toEqual({ geometries: 12, materials: 32, textures: 0, instances: 5 });
  expect(requests.map(url => new URL(url).pathname).sort()).toEqual([
    new URL('visuals/v2/exchanger.glb', page.url()).pathname,
    new URL('visuals/v2/pump.glb', page.url()).pathname,
    new URL('visuals/v3/cdu.glb', page.url()).pathname,
  ].sort());
  const base = loaded.visualKit.assets.find(asset => asset.assetId === cdu)!.worldCenter;
  await button(page, 'Explode').click(); const exploded = await completed(page);
  expect(exploded.visualKit.assets.find(asset => asset.assetId === cdu)!.worldCenter).toEqual(base.map((value, axis) => value + presentationOffset('cdu', true)[axis]));
  // A warmed opaque/transparent transition must not fade the ready CDU or revive
  // its old procedural box; the adapter reports only its four rendered surfaces.
  await button(page, 'X-ray').click(); await completed(page); await button(page, 'X-ray').click();
  const warmed = await completed(page);
  expect(warmed.visualKit.assets.find(asset => asset.assetId === cdu)).toMatchObject({ status: 'ready', meshCount: 4, renderedMeshes: 4 });
  await capture(page, info, 'visual-v3-warmed-cdu');
  await button(page, 'Explode').click(); const second = await reveal(page, secondCdu);
  expect(second.visualKit.assets.every(asset => asset.assetId.startsWith('platform-001/module-02/'))).toBe(true);
  expect(second.visualKit.assets.find(asset => asset.assetId === secondCdu)).toMatchObject({ selected: true, status: 'ready', renderedMeshes: 4 });
  await capture(page, info, 'visual-v3-second-module');
  await button(page, 'Campus view').click(); await button(page, 'X-ray').click(); const returned = await completed(page);
  expect(returned.visualKit.cache).toEqual({ geometries: 12, materials: 12, textures: 0, instances: 0 });
  expect({ geometries: returned.geometries, textures: returned.textures }).toEqual({ geometries: 77, textures: 2 });
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(before));
  expect(requests).toHaveLength(3); expect(failures).toEqual([]);
  await info.attach('visual-v3-post-render-inventories', { body: JSON.stringify({ loaded, warmed, second, returned, requests }), contentType: 'application/json' });
});

test('VIS3 delayed CDU remains interactive beside healthy older templates and cannot attach after module/design supersession', async ({ page }, info) => {
  const failures = errors(page); let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/visuals/v3/cdu.glb', async route => { await barrier; await route.continue(); });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('./'); await ready(page);
  try {
    await select(page, cdu); await button(page, 'Cooling close-up').click();
    await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.kind === 'cdu')).toMatchObject({ status: 'loading', meshCount: 0 });
    await expect.poll(async () => (await kit(page))?.assets.filter(asset => asset.kind !== 'cdu').every(asset => asset.status === 'ready' && asset.renderedMeshes > 0)).toBe(true);
    await expect(button(page, 'Step 10s')).toBeEnabled();
    await clickProceduralCdu(page);
    await select(page, secondCdu); await button(page, 'Cooling close-up').click();
    await button(page, 'Design family II').click(); await ready(page);
    await select(page, secondCdu); await button(page, 'Cooling close-up').click();
    const before = await project(page); await capture(page, info, 'visual-v3-delayed-cdu');
    release(); const loaded = await reveal(page, secondCdu);
    expect(loaded.visualKit.assets.every(asset => asset.assetId.startsWith('platform-001/module-02/'))).toBe(true);
    expect(loaded.visualKit.assets.find(asset => asset.kind === 'cdu')).toMatchObject({ assetId: secondCdu, selected: true, renderedMeshes: 4 });
    expect(normalizeProject(await project(page))).toEqual(normalizeProject(before)); expect(failures).toEqual([]);
  } finally { release(); }
});

for (const fault of ['missing', 'corrupt', 'size'] as const) {
  test(`VIS3 ${fault} CDU retains procedural interaction while authored pumps and exchanger render`, async ({ page }, info) => {
    const failures = errors(page);
    await page.route('**/visuals/v3/cdu.glb', route => fault === 'missing'
      ? route.fulfill({ status: 404, body: 'Intentional missing CDU fixture' })
      : route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.alloc(fault === 'size' ? 16 : manifest.templates[0].bytes, 0x7f) }));
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('./'); await ready(page);
    await select(page, cdu); await button(page, 'Cooling close-up').click();
    await expect.poll(() => kit(page)).toMatchObject({ status: 'fallback' });
    await expect.poll(async () => (await kit(page))?.assets.filter(asset => asset.kind !== 'cdu').every(asset => asset.status === 'ready' && asset.renderedMeshes > 0)).toBe(true);
    const observed = await completed(page);
    expect(observed.visualKit.assets.find(asset => asset.assetId === cdu)).toMatchObject({ status: 'fallback', selected: true, meshCount: 0 });
    await expect(page.getByTestId('visual-kit-status')).toContainText(/procedural/i);
    await clickProceduralCdu(page);
    await button(page, 'Trip selected asset').click(); await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
    await button(page, 'Restore selected asset').click(); await expect(page.getByTestId('asset-operating-status')).not.toHaveText('failed');
    await capture(page, info, `visual-v3-${fault}-cdu-fallback`); expect(failures).toEqual([]);
  });
}

test('VIS3 missing exchanger independently preserves the authored CDU and pump surfaces', async ({ page }) => {
  await page.route('**/visuals/v2/exchanger.glb', route => route.fulfill({ status: 404, body: 'Intentional missing exchanger fixture' }));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('./'); await ready(page);
  await select(page, cdu); await button(page, 'Cooling close-up').click();
  await expect.poll(() => kit(page)).toMatchObject({ status: 'fallback' });
  await expect.poll(async () => (await kit(page))?.assets.filter(asset => asset.kind !== 'exchanger').every(asset => asset.status === 'ready' && asset.renderedMeshes > 0)).toBe(true);
  expect((await completed(page)).visualKit.assets.find(asset => asset.kind === 'exchanger')).toMatchObject({ status: 'fallback', meshCount: 0 });
});

test('VIS3 CDU submeshes select their parent and projected failure/history tint remains private and restorable', async ({ page }, info) => {
  const failures = errors(page);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  await button(page, 'Operate').click(); await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  await page.getByLabel('Experiment initial conditions', { exact: true }).selectOption('cold');
  await button(page, 'Prepare experiment for stepping').click(); await ready(page);
  await button(page, 'Step 10s').click(); await ready(page); await reveal(page);
  await button(page, 'Trip selected asset').click(); await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.assetId === cdu)?.operatingState).toBe('failed');
  const failed = await completed(page), failedCdu = failed.visualKit.assets.find(asset => asset.assetId === cdu)!;
  expect(failedCdu.materialColor).toBe('#f27b79');
  expect(failed.visualKit.assets.filter(asset => asset.kind !== 'cdu').every(asset => asset.materialColor !== failedCdu.materialColor)).toBe(true);
  // Keep the canonical bay framing while selecting a peer, then target an actual
  // rendered CDU triangle using the same diagnostic projection as retained VIS2.
  await page.getByLabel('Select equipment', { exact: true }).selectOption('platform-001/module-01/pump-duty');
  await button(page, 'Cooling close-up').click(); const peer = await completed(page);
  const surface = peer.visualKit.assets.find(asset => asset.assetId === cdu)!.childWorldPoint;
  expect(surface).toBeDefined(); const bounds = await page.locator('canvas').boundingBox(); if (!bounds) throw Error('No canvas.');
  const camera = new PerspectiveCamera(46, bounds.width / bounds.height, 0.1, 10000);
  camera.position.fromArray(peer.camera); camera.lookAt(new Vector3().fromArray(peer.target)); camera.updateMatrixWorld();
  const point = new Vector3().fromArray(surface!).project(camera);
  expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1);
  await page.mouse.click(bounds.x + (point.x + 1) * bounds.width / 2, bounds.y + (1 - point.y) * bounds.height / 2);
  await expect(main(page)).toHaveAttribute('data-selected', cdu);
  await expect(page.getByTestId('asset-context')).toHaveAttribute('data-asset-id', cdu);
  const checkpoint = await project(page);
  await page.getByLabel('Inspect history time in seconds', { exact: true }).fill('0'); await button(page, 'Inspect history time').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
  await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.assetId === cdu)?.operatingState).not.toBe('failed');
  expect((await completed(page)).visualKit.assets.find(asset => asset.assetId === cdu)!.operatingState).toBe(await page.getByTestId('asset-operating-status').innerText());
  await button(page, 'Return to current state').click(); await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  expect(normalizeProject(await project(page))).toEqual(normalizeProject(checkpoint));
  await select(page, secondCdu); const healthy = await completed(page);
  expect(healthy.visualKit.assets.find(asset => asset.assetId === secondCdu)!.materialColor).not.toBe(failedCdu.materialColor);
  await select(page, cdu); await button(page, 'Restore selected asset').click();
  await expect(page.getByTestId('asset-operating-status')).not.toHaveText('failed');
  await expect.poll(async () => (await kit(page))?.assets.find(asset => asset.assetId === cdu)?.materialColor).not.toBe(failedCdu.materialColor);
  await capture(page, info, 'visual-v3-restored-cdu'); expect(failures).toEqual([]);
});

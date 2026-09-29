import { activateLifecycleButton } from './lifecycle-keyboard';
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import { normalizeProject, parseProject, type CurrentProject } from '../../src/twin/persistence/project';
import { expectNoHorizontalOverflow } from './layout';
import { openPanel, projectActions, visibleControl } from './visible-controls';

const cdu = 'platform-001/module-01/cdu';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const main = (page: Page) => page.locator('main.twin-app');
const scene = (page: Page) => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);

async function ready(page: Page, canvas = true) {
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await expect(button(page, 'Step 10s')).toBeEnabled();
  if (canvas) await expect.poll(async () => (await scene(page))?.renderEpoch ?? 0).toBeGreaterThan(0);
}
async function project(page: Page): Promise<CurrentProject> {
  await projectActions(page);
  const pending = page.waitForEvent('download');
  await page.getByLabel('Export artifact', { exact: true }).selectOption('project');
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const location = await download.path();
  if (!location) throw Error('No native project artifact.');
  const value = parseProject(await fs.readFile(location, 'utf8'));
  if (value.schemaVersion !== 3 || !value.checkpoint) throw Error('Expected a current checkpoint export.');
  await page.locator('summary').filter({ hasText: /^Project actions$/ }).click();
  return value;
}
async function select(page: Page, id = cdu, activate?: (name: string) => Promise<void>) {
  await openPanel(page, 'Assets', activate);
  const finder = page.getByLabel('Find asset ID', { exact: true });
  await finder.fill(id); await finder.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', id);
  await openPanel(page, 'Inspector', activate);
}
async function focus(page: Page, enabled: boolean, activate?: (name: string) => Promise<void>) {
  const name = enabled ? 'Presentation focus' : 'Exit presentation focus';
  await (activate ? activate(name) : button(page, name).click());
  await expect(button(page, enabled ? 'Exit presentation focus' : 'Presentation focus')).toBeVisible();
}
async function settledCamera(page: Page) {
  let prior: number[] | undefined, epoch = -1, stable = 0;
  let settled: NonNullable<Awaited<ReturnType<typeof scene>>> | undefined;
  // Same three completed publications and 1e-5m tolerance as V3 measurement;
  // named-transition readiness alone does not exhaust manual orbit damping.
  await expect.poll(async () => {
    const value = await scene(page);
    if (!value || value.renderEpoch === epoch) return stable;
    epoch = value.renderEpoch;
    const pose = [...value.camera, ...value.target];
    stable = prior && pose.every((coordinate, index) => Math.abs(coordinate - prior![index]) <= 0.00001) ? stable + 1 : 0;
    prior = pose; settled = value;
    return stable;
  }).toBeGreaterThanOrEqual(3);
  return settled!;
}

test('VIS4 scene-first shell keeps owners, form drafts and canonical paused checkpoint through layout changes', async ({ page }, info) => {
  const errors: string[] = [], workers: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  const canvas = page.locator('canvas');
  const initial = await canvas.boundingBox();
  expect(initial!.y).toBeLessThan(320);
  expect(initial!.width).toBeGreaterThan(900);
  expect(initial!.height).toBeGreaterThan(300);
  await expect(button(page, 'Campus view')).toBeInViewport();
  await expect(button(page, 'Presentation focus')).toBeInViewport();
  await select(page);
  await button(page, 'Cooling close-up').click();
  await expect.poll(async () => (await scene(page))?.visualKit.status).toBe('ready');
  const checkpoint = normalizeProject(await project(page));
  const canvasOwner = await canvas.elementHandle();
  await openPanel(page, 'Data & replay');
  const dataOwner = await page.locator('.twin-data').elementHandle();
  await page.getByText('Field, asset, and metric mapping', { exact: true }).click();
  await page.getByLabel('Telemetry mapping JSON').fill('{"fields":{"value":"private-draft"}}');
  await page.getByLabel('Stream URL', { exact: true }).fill('http://127.0.0.1:8787/private-draft');
  const workerCount = workers.length;
  for (const workspace of ['Operate', 'Compare', 'Explore']) {
    await button(page, workspace).click();
    await focus(page, true); await page.setViewportSize({ width: 390, height: 844 });
    await expect(main(page)).toHaveAttribute('data-selected', cdu);
    await expect(main(page)).toHaveAttribute('data-time', '0');
    await expect(canvas).toHaveCount(1);
    expect(await canvasOwner!.evaluate(element => element === document.querySelector('canvas'))).toBe(true);
    expect(await dataOwner!.evaluate(element => element === document.querySelector('.twin-data'))).toBe(true);
    await focus(page, false); await page.setViewportSize({ width: 1440, height: 900 });
  }
  await openPanel(page, 'Data & replay');
  await expect(page.getByLabel('Telemetry mapping JSON')).toHaveValue('{"fields":{"value":"private-draft"}}');
  await expect(page.getByLabel('Stream URL', { exact: true })).toHaveValue('http://127.0.0.1:8787/private-draft');
  expect(workers).toHaveLength(workerCount);
  expect(normalizeProject(await project(page))).toEqual(checkpoint);
  expect(errors).toEqual([]);
  await openPanel(page, 'Inspector');
  await info.attach('V4-desktop-inspector', { body: await page.screenshot(), contentType: 'image/png' });
  await focus(page, true);
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(initial!.width);
  await info.attach('V4-presentation-focus', { body: await page.screenshot(), contentType: 'image/png' });
});

test('VIS4 history context and unavailable boundaries survive presentation without changing the active run', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  await button(page, 'Operate').click();
  await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  await page.getByLabel('Experiment initial conditions', { exact: true }).selectOption('cold');
  await button(page, 'Prepare experiment for stepping').click(); await ready(page);
  await button(page, 'Step 10s').click(); await ready(page);
  const checkpoint = normalizeProject(await project(page));
  await page.getByLabel('Inspect history time in seconds', { exact: true }).fill('0');
  await button(page, 'Inspect history time').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
  await expect(main(page)).toHaveAttribute('data-display-time', '0');
  await focus(page, true);
  await page.setViewportSize({ width: 768, height: 1024 });
  await button(page, 'Compare').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
  await expect(main(page)).toHaveAttribute('data-display-time', '0');
  await button(page, 'Operate').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByTestId('inspection-context')).toContainText('Inspecting history');
  await expect(page.getByTestId('inspection-context')).toContainText('Current clock: 10 s');
  await expect(page.getByTestId('inspection-context')).toContainText('Displayed scene and operating values: 0 s');
  await expect(button(page, 'Return to current state')).toBeVisible();
  await expect(button(page, 'Start')).toBeDisabled();
  await expect(button(page, 'Step 10s')).toBeDisabled();
  await info.attach('V4-focused-history', { body: await page.screenshot(), contentType: 'image/png' });
  await focus(page, false);
  await page.getByLabel('Inspect history time in seconds', { exact: true }).fill('0.3');
  await button(page, 'Inspect history time').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'unavailable-history');
  await focus(page, true);
  await expect(page.getByTestId('inspection-context')).toContainText('unavailable');
  await button(page, 'Return to current state').click();
  await expect(main(page)).toHaveAttribute('data-inspection-mode', 'current');
  await expect(main(page)).toHaveAttribute('data-display-time', '10');
  await focus(page, false);
  expect(normalizeProject(await project(page))).toEqual(checkpoint);
});

test('VIS4 comparison work continues across layout changes and workspace entry performs no implicit run', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?fallback=1'); await ready(page, false);
  const checkpoint = normalizeProject(await project(page));
  await button(page, 'Compare').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'ready');
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await page.getByLabel('Decision fixture', { exact: true }).selectOption('nominal');
  const owner = await page.getByRole('region', { name: 'Phase 6 decision support', exact: true }).elementHandle();
  let release!: () => void, heldWorkers = 0;
  const workerGate = new Promise<void>(resolve => { release = resolve; });
  // Hold only newly requested real worker modules after the active simulation
  // worker is ready. The campaign executes its actual engine after reflow.
  await page.route(/\/(?:assets\/worker-[^/]+\.js|src\/twin\/decision\/worker\.ts)(?:\?.*)?$/, async route => {
    heldWorkers++; await workerGate; await route.continue();
  });
  try {
    await button(page, 'Start decision campaign').click();
    await expect.poll(() => heldWorkers).toBeGreaterThan(0);
    await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'running');
    await focus(page, true); await page.setViewportSize({ width: 768, height: 1024 });
    await button(page, 'Explore').click(); await focus(page, false);
    await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'running');
    await button(page, 'Compare').click();
    await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'running');
  } finally { release(); }
  expect(await owner!.evaluate(element => element === document.querySelector('.decision-panel'))).toBe(true);
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  await expect(page.getByTestId('decision-recommendation')).toBeVisible();
  const completed = await page.getByTestId('decision-coverage').getAttribute('data-completed');
  await button(page, 'Explore').click(); await button(page, 'Compare').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-completed', completed!);
  expect(normalizeProject(await project(page))).toEqual(checkpoint);
  await expectNoHorizontalOverflow(page, 768);
  await info.attach('V4-completed-comparison', { body: await page.screenshot(), contentType: 'image/png' });
});

test('VIS4 responsive inspector has a visible route back, one semantic tree and usable keyboard controls', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./'); await ready(page);
  await expect(button(page, 'Expand inspector')).toBeVisible();
  await info.attach('V4-mobile-compact', { body: await page.screenshot(), contentType: 'image/png' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await openPanel(page, 'Assets');
    await expect(page.getByLabel('Find asset ID', { exact: true })).toBeVisible();
    await openPanel(page, 'Inspector');
    await expect(page.getByTestId('asset-context')).toBeVisible();
    await expect(page.locator('.twin-inspector')).toHaveCount(1);
    await expect(page.locator('.twin-data')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveCount(1);
    await expectNoHorizontalOverflow(page, viewport.width);
    const control = button(page, 'Presentation focus');
    await control.scrollIntoViewIfNeeded(); await control.focus();
    await expect(control).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(button(page, 'Exit presentation focus')).toBeVisible();
    await focus(page, false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await openPanel(page, 'Inspector');
  await info.attach('V4-mobile-expanded', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'Collapse inspector').click();
  await expect(button(page, 'Expand inspector')).toBeVisible();
  await button(page, 'Inside module').click();
  await expect.poll(async () => (await scene(page))?.inside).toBe(true);
  await projectActions(page);
  const importProject = page.getByLabel('Import project', { exact: true });
  await expect(importProject).toBeVisible();
  await importProject.focus(); await expect(importProject).toBeFocused();
  await page.getByLabel('Export artifact', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('summary').filter({ hasText: /^Project actions$/ })).toBeFocused();
  await expect(page.getByLabel('Export artifact', { exact: true })).not.toBeVisible();
  expect((await scene(page))?.inside).toBe(true);
  await page.locator('canvas').focus(); await page.keyboard.press('Escape');
  await expect.poll(async () => (await scene(page))?.inside).toBe(false);
  // Text enlargement is independent of 320 CSS-pixel reflow above.
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page, 390);
  await openPanel(page, 'Assets');
  const finder = page.getByLabel('Find asset ID', { exact: true });
  await finder.fill(cdu); await finder.focus(); await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', cdu);
  await openPanel(page, 'Inspector');
  await expect(page.getByTestId('asset-context')).toBeVisible();
  await button(page, 'Collapse inspector').click();
  await button(page, 'Expand inspector').click();
  await expect(page.getByTestId('asset-context')).toBeVisible();
  await button(page, 'Close panel').click();
  await expect(page.locator('.twin-dock')).not.toBeVisible();
  await button(page, 'Cooling close-up').click();
  await expect.poll(async () => (await scene(page))?.focus).toBe('cooling');
  await button(page, 'Dimensions').click();
  await expect(button(page, 'Dimensions')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Dimensions').click();
  await expect(button(page, 'Presentation focus')).toBeVisible();
  await expectNoHorizontalOverflow(page, 390);
  await info.attach('V4-mobile-200-percent-text', { body: await page.screenshot(), contentType: 'image/png' });
});

for (const outcome of ['delayed', 'failed'] as const) {
  test(`VIS4 ${outcome} CDU load survives panel and viewport reflow without duplicated canvases or requests`, async ({ page }, info) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const fetched: string[] = [];
    page.on('request', request => { if (/\/visuals\/v[23]\/.*\.glb$/.test(request.url())) fetched.push(request.url()); });
    await page.route('**/visuals/v3/cdu.glb', async route => {
      await gate;
      if (outcome === 'failed') await route.fulfill({ status: 404, body: 'Intentional V4 fallback fixture' });
      else await route.continue();
    });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('./'); await ready(page);
      expect(fetched).toEqual([]);
      await select(page); await button(page, 'Cooling close-up').click();
      await expect.poll(async () => (await scene(page))?.visualKit.assets.find(asset => asset.kind === 'cdu')?.status).toBe('loading');
      const owner = await page.locator('canvas').elementHandle();
      const before = normalizeProject(await project(page));
      await openPanel(page, 'Design'); await focus(page, true);
      await page.setViewportSize({ width: 390, height: 844 }); await focus(page, false);
      await openPanel(page, 'Inspector');
      release();
      await expect.poll(async () => (await scene(page))?.visualKit.status).toBe(outcome === 'delayed' ? 'ready' : 'fallback');
      expect(await owner!.evaluate(element => element === document.querySelector('canvas'))).toBe(true);
      await expect(page.locator('canvas')).toHaveCount(1);
      expect(fetched).toHaveLength(3);
      expect(new Set(fetched).size).toBe(3);
      expect(normalizeProject(await project(page))).toEqual(before);
      await button(page, 'Operate').click();
      await (await visibleControl(page, page.getByRole('button', { name: 'Trip selected asset', exact: true, includeHidden: true }))).click();
      await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
      await (await visibleControl(page, page.getByRole('button', { name: 'Restore selected asset', exact: true, includeHidden: true }))).click();
      await info.attach(`V4-${outcome}-load-reflow`, { body: await page.screenshot(), contentType: 'image/png' });
    } finally { release(); }
  });
}

test('VIS4 exploded cooling leaves the actual CDU surface selectable across inspector and presentation compositions', async ({ page }, info) => {
  const activate = (name: string) => activateLifecycleButton(page, name);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./'); await ready(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const moduleId of ['platform-001/module-01', 'platform-001/module-02']) {
      const target = `${moduleId}/cdu`;
      await select(page, `${moduleId}/pump-duty`, activate);
      await activate('Cooling close-up');
      if (await button(page, 'Explode').getAttribute('aria-pressed') !== 'true') await activate('Explode');
      for (const presentation of [false, true]) {
        if (presentation) await focus(page, true, activate);
        const canvas = page.locator('canvas');
        await canvas.scrollIntoViewIfNeeded();
        await expect.poll(async () => {
          const { value, rect, parent } = await canvas.evaluate(element => {
            const rect = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
            return { value: window.__NEPTUNE_TWIN_SCENE__, rect: { width: rect.width, height: rect.height }, parent: { width: parent.width, height: parent.height } };
          });
          return Boolean(value && rect.width > 0 && rect.height > 0 && value.focus === 'cooling' && value.exploded && value.selectedId === `${moduleId}/pump-duty` &&
            value.visualKit.moduleId === moduleId && value.visualKit.status === 'ready' && !value.cameraTransitioning &&
            Math.abs(parent.width - rect.width) < 1 && Math.abs(parent.height - rect.height) < 1 &&
            Math.abs(value.canvasSize.width - rect.width) < 1 && Math.abs(value.canvasSize.height - rect.height) < 1 &&
            value.visualKit.assets.find(asset => asset.assetId === target)?.renderedMeshes === 4);
        }).toBe(true);
        const value = (await scene(page))!, rect = (await canvas.boundingBox())!;
        const surface = value.visualKit.assets.find(asset => asset.assetId === target)!.childWorldPoint;
        expect(surface).toBeDefined();
        const camera = new PerspectiveCamera(46, rect.width / rect.height, 0.03, 10000);
        camera.position.fromArray(value.camera); camera.lookAt(new Vector3().fromArray(value.target)); camera.updateMatrixWorld();
        const point = new Vector3().fromArray(surface!).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(1); expect(Math.abs(point.y)).toBeLessThan(1);
        const visible = (await canvas.boundingBox())!;
        const click = { x: visible.x + (point.x + 1) * visible.width / 2, y: visible.y + (1 - point.y) * visible.height / 2 };
        const hit = await canvas.evaluate((element, coordinate) => {
          const node = document.elementFromPoint(coordinate.x, coordinate.y);
          const parent = element.parentElement!.getBoundingClientRect();
          return { canvasOwnsPoint: node === element, hitTag: node?.tagName, hitClass: node?.getAttribute('class'), parent: { x: parent.x, y: parent.y, width: parent.width, height: parent.height } };
        }, click);
        await info.attach(`V4-CDU-pointer-${width}-${moduleId.split('/').at(-1)}-${presentation}`, { body: JSON.stringify({ click, canvas: visible, surface, hit, scene: value }), contentType: 'application/json' });
        await info.attach(`V4-CDU-before-click-${width}-${moduleId.split('/').at(-1)}-${presentation}`, { body: await page.screenshot(), contentType: 'image/png' });
        expect(hit.canvasOwnsPoint, 'The actual CDU surface point must be outside occupied inspector UI.').toBe(true);
        await page.mouse.click(click.x, click.y);
        await expect(main(page)).toHaveAttribute('data-selected', target);
        await expect(page.getByTestId('scene-selected-identity')).toContainText(target);
        await info.attach(`V4-CDU-${width}-${moduleId.split('/').at(-1)}-${presentation ? 'presentation' : 'inspector'}`, { body: await page.screenshot(), contentType: 'image/png' });
        if (presentation) await focus(page, false, activate);
        await select(page, `${moduleId}/pump-duty`, activate); await activate('Cooling close-up');
      }
    }
  }
});

test('VIS4 normal-motion panel reflow settles named framing and preserves subsequent manual camera takeover', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./'); await ready(page);
  await select(page); await button(page, 'Cooling close-up').click();
  await button(page, 'Close panel').click(); await openPanel(page, 'Inspector');
  await focus(page, true); await focus(page, false);
  await expect.poll(async () => {
    const value = await scene(page);
    return value?.focus === 'cooling' && value.cameraControl === 'named' && !value.cameraTransitioning && value.visualKit.status === 'ready';
  }).toBe(true);
  const named = (await scene(page))!;
  const canvas = page.locator('canvas');
  // A settled native zoom tests manual-pose preservation without making the
  // inherited frame-count-based angular damping a wall-clock settling contract.
  // Retained VIS3 coverage still exercises the ArrowRight route.
  await canvas.focus(); await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeInViewport();
  await canvas.hover();
  const wheelPoint = await canvas.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    return { x, y, usable: rect.width > 0 && rect.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && document.elementFromPoint(x, y) === element };
  });
  expect(wheelPoint.usable, 'The native wheel point must belong to the visible canvas.').toBe(true);
  await page.mouse.move(wheelPoint.x, wheelPoint.y);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await scene(page))?.cameraControl).toBe('manual');
  const manual = await settledCamera(page);
  expect(manual.camera).not.toEqual(named.camera);
  await focus(page, true); await page.setViewportSize({ width: 768, height: 1024 });
  await focus(page, false); await openPanel(page, 'Inspector');
  await expect.poll(() => canvas.evaluate(element => {
    const value = window.__NEPTUNE_TWIN_SCENE__;
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    // Compare the DOM geometry used by R3F; Firefox protocol quads can round
    // differently even when the canvas, parent and completed frame agree.
    return Boolean(value && parent && rect.width > 0 && rect.height > 0 &&
      value.canvasSize.width === rect.width && value.canvasSize.height === rect.height &&
      parent.width === rect.width && parent.height === rect.height && !value.cameraTransitioning);
  })).toBe(true);
  const reframed = await settledCamera(page);
  expect(reframed.cameraControl).toBe('manual');
  expect(reframed.camera).toEqual(manual.camera.map(value => expect.closeTo(value, 5)));
  expect(reframed.target).toEqual(manual.target.map(value => expect.closeTo(value, 5)));
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await info.attach('V4-named-reflow-and-manual-pose', { body: JSON.stringify({ named, manual, reframed, wheelPoint }), contentType: 'application/json' });
});

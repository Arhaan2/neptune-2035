import { openPanel, withVisibleControl } from './visible-controls';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { buildDesign, DEFAULT_CONFIG, moduleAssets } from '../../src/twin/assets/design';
import { presentedPosition } from '../../src/scene/twinGeometry';
import { expectNoHorizontalOverflow } from './layout';

const moduleId = 'platform-001/module-01';
const cdu = `${moduleId}/cdu`;
const button = (page: Page, name: string) => page.getByRole('button', { includeHidden: true, name, exact: true });
const scene = (page: Page) => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);
const design = buildDesign(DEFAULT_CONFIG);

async function disjoint(left: Locator, right: Locator) {
  const a = await left.boundingBox(), b = await right.boundingBox();
  expect(a).not.toBeNull(); expect(b).not.toBeNull();
  const width = Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x);
  const height = Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y);
  expect(width <= 0.5 || height <= 0.5, `Reading surfaces and controls must not overlap: ${JSON.stringify({left: await left.getAttribute('class'), right: await right.getAttribute('class'), a, b, width, height})}`).toBe(true);
}
async function fit(page: Page, ids?: string[]) {
  await expect.poll(async () => {
    const observed = await scene(page), bounds = await page.locator('canvas').boundingBox();
    if (!observed || !bounds) return false;
    const camera = new PerspectiveCamera(46, bounds.width / bounds.height, 0.03, 10000);
    camera.position.fromArray(observed.camera); camera.lookAt(new Vector3().fromArray(observed.target)); camera.updateMatrixWorld();
    const assets = moduleAssets(design, moduleId).filter(asset => ids ? ids.includes(asset.id) : ['pump', 'exchanger', 'cdu'].includes(asset.type));
    return assets.every(asset => {
      const center = presentedPosition(asset, observed.exploded);
      return [-0.5, 0.5].every(x => [-0.5, 0.5].every(y => [-0.5, 0.5].every(z => {
        const point = new Vector3(center[0] + x * asset.dimensionsM[0], center[1] + y * asset.dimensionsM[1], center[2] + z * asset.dimensionsM[2]).project(camera);
        return Math.abs(point.x) < 0.99 && Math.abs(point.y) < 0.99 && Math.abs(point.z) < 1;
      })));
    });
  }).toBe(true);
}

for (const width of [1440, 390]) {
  test(`VIS3 ${width}px cooling identity and open/closed legend keep equipment and controls clear`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
    await expect(button(page, 'Step 10s')).toBeEnabled();
    await openPanel(page, 'Inspector');
    await button(page, 'Cooling close-up').click();
    await expect.poll(async () => (await scene(page))?.visualKit.status).toBe('ready');
    await fit(page);
    const canvas = page.locator('canvas'), shell = page.locator('.twin-scene-shell');
    const identity = page.getByTestId('scene-selected-identity');
    const caption = page.locator('.twin-scene-caption');
    const legend = page.getByLabel('Connection colors', { exact: true });
    const summary = legend.locator('summary');
    const controls = page.getByLabel('Scene controls', { exact: true });
    await expect(identity).toContainText(`${moduleId}/pump-duty`);
    await expect(identity).toContainText('simulated');
    await expect(page.locator('.twin-asset-label')).toHaveCount(0);
    for (const open of [false, true]) {
      if (open) { await withVisibleControl(page, summary, control => control.focus()); await page.keyboard.press('Enter'); }
      await expect(legend).toHaveJSProperty('open', open);
      await fit(page);
      await disjoint(canvas, caption); await disjoint(canvas, legend); await disjoint(canvas, controls);
      await disjoint(legend, controls); await disjoint(legend, page.locator('.twin-inspector'));
      expect((await canvas.boundingBox())!.height).toBeGreaterThan(220);
      await expectNoHorizontalOverflow(page, width);
      await withVisibleControl(page, shell, control => control.scrollIntoViewIfNeeded());
      await info.attach(`visual-v3-${width}-legend-${open ? 'open' : 'closed'}`, { body: await shell.screenshot(), contentType: 'image/png' });
    }
    await expect(legend).toContainText('Technical coolant');
    await expect(legend).toContainText('Seawater');
    await withVisibleControl(page, summary, control => control.focus()); await page.keyboard.press('Enter');
    await expect(summary).toBeFocused();
    // macOS WebKit uses Option-Tab to include native buttons in traversal.
    await page.keyboard.press(info.project.name === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
    await expect(button(page, 'X-ray')).toBeFocused();
    // Existing ID lookup remains a native keyboard selection alternative.
    const finder = page.getByLabel('Find asset ID', { exact: true });
    await withVisibleControl(page, finder, control => control.fill(cdu)); await withVisibleControl(page, finder, control => control.focus()); await page.keyboard.press('Enter');
    await expect(page.locator('main.twin-app')).toHaveAttribute('data-selected', cdu);
    await expect(identity).toContainText(cdu);
    await expect(page.getByLabel('Select equipment', { exact: true })).toHaveValue(cdu);
    await fit(page, [cdu]);
    await expect.poll(async () => (await scene(page))?.visualKit.assets.find(asset => asset.assetId === cdu)?.renderedMeshes ?? 0).toBeGreaterThan(0);
    const beforeManual = await scene(page);
    await withVisibleControl(page, canvas, control => control.focus()); await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await scene(page))?.camera).not.toEqual(beforeManual!.camera);
    await expect(page.locator('main.twin-app')).toHaveAttribute('data-time', '0');
    await expect(page.getByText('Simulated, design-stage prototype; physical validation pending.', { exact: true }).first()).toBeVisible();
    await withVisibleControl(page, shell, control => control.scrollIntoViewIfNeeded());
    await info.attach(`visual-v3-${width}-cdu-selection`, { body: await shell.screenshot(), contentType: 'image/png' });
    await button(page, 'Campus view').click();
    await expect.poll(async () => (await scene(page))?.focus).toBe('campus');
    await expectNoHorizontalOverflow(page, width);
    expect(errors).toEqual([]);
  });
}

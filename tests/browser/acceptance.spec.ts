import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { expectNoHorizontalOverflow } from './layout';
import { readScene, resetCamera, waitForCameraTransition } from './camera';
const root = (page: Page) => page.locator('main');
async function load(page: Page) {
  await page.goto('./?legacy=1');
  await expect(root(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1600);
}
async function imageDifference(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([
    sharp(a).resize(400, 260).removeAlpha().raw().toBuffer(),
    sharp(b).resize(400, 260).removeAlpha().raw().toBuffer(),
  ]);
  let changed = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 20) changed++;
  return changed / x.length;
}
async function capture(page: Page, name: string) {
  await fs.mkdir('assets/screenshots', { recursive: true });
  await page.screenshot({
    path: `assets/screenshots/${name}.png`,
    fullPage: true,
  });
}

test('rendered modes, connected exploded paths, interior and bounded resources', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page);
  const canvas = page.locator('canvas');
  const hero = await canvas.screenshot();
  const stats = await sharp(hero).stats();
  expect(stats.channels.reduce((sum, c) => sum + c.stdev, 0)).toBeGreaterThan(
    35,
  );
  await canvas.focus();
  const keyHome = await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera);
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(() => page.evaluate(() => window.__NEPTUNE_SCENE__!.camera))
    .not.toEqual(keyHome);
  const home = await resetCamera(page);
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.6,
    bounds.y + bounds.height * 0.6,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.78,
    bounds.y + bounds.height * 0.62,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect.poll(() => readScene(page).then(s => s.camera)).not.toEqual(home.camera);
  const orbit = await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera);
  expect(orbit).not.toEqual(home.camera);
  await resetCamera(page, home);
  await page.getByRole('button', { name: /X-ray/ }).click();
  await expect(root(page)).toHaveAttribute('data-xray', 'true');
  await page.waitForTimeout(200);
  const cutaway = await canvas.screenshot();
  expect(await imageDifference(hero, cutaway)).toBeGreaterThan(0.01);
  await page.getByRole('button', { name: 'Cooling', exact: true }).click();
  await expect(
    page.getByText('Move heat. Keep circuits separate.'),
  ).toBeVisible();
  await capture(page, `${info.project.name}-cooling`);
  const beforeExplode = await readScene(page);
  await page.getByRole('button', { name: 'Explode', exact: true }).click();
  await expect(root(page)).toHaveAttribute('data-exploded', 'true');
  await waitForCameraTransition(() => readScene(page), beforeExplode, false);
  await capture(page, `${info.project.name}-exploded`);
  expect(
    await imageDifference(cutaway, await canvas.screenshot()),
  ).toBeGreaterThan(0.015);
  const warmed = await page.evaluate(() => window.__NEPTUNE_SCENE__!);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Explode', exact: true }).click();
    await page.getByRole('button', { name: /X-ray/ }).click();
  }
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => window.__NEPTUNE_SCENE__!);
  expect(after.geometries).toBeLessThanOrEqual(warmed.geometries + 3);
  expect(after.textures).toBeLessThanOrEqual(warmed.textures + 1);
  await resetCamera(page, home);
  expect(await imageDifference(hero, await canvas.screenshot())).toBeLessThan(
    0.025,
  );
  await page.getByRole('button', { name: 'Power', exact: true }).click();
  await expect(page.getByText('An ocean is not a power source.')).toBeVisible();
  await capture(page, `${info.project.name}-power`);
  await page.getByRole('button', { name: 'Network', exact: true }).click();
  await expect(
    page.getByText('Connected within. Connected beyond.'),
  ).toBeVisible();
  const prior = await resetCamera(page, home);
  await page.getByRole('button', { name: 'Inside', exact: true }).click();
  await expect(page.getByText('Within a compute module')).toBeVisible();
  const interior = await waitForCameraTransition(() => readScene(page), prior, true);
  expect(Math.hypot(...interior.camera.map((v, i) => v - prior.camera[i]))).toBeGreaterThan(1);
  expect(Math.hypot(...interior.target.map((v, i) => v - prior.target[i]))).toBeGreaterThan(1);
  await capture(page, `${info.project.name}-interior`);
  expect(
    await imageDifference(hero, await canvas.screenshot()),
  ).toBeGreaterThan(0.1);
  await page
    .getByRole('button', { name: 'Exit interior', exact: true })
    .click();
  const restored = await waitForCameraTransition(() => readScene(page), interior, false, prior);
  await info.attach('camera-return', {
    body: JSON.stringify({ prior, interior, restored }, null, 2),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
  await fs.writeFile(
    `assets/screenshots/${info.project.name}-render-stats.json`,
    JSON.stringify(
      { viewport: page.viewportSize(), home, warmed, after, errors },
      null,
      2,
    ),
  );
});

test('camera return preserves a manually selected exterior pose with normal motion', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await load(page);
  const home = await resetCamera(page);
  await page.locator('canvas').focus();
  await page.keyboard.press('+');
  let prior = home;
  // A neighboring frame can differ by floating-point noise before the key's
  // zoom is visible. Capture the same new frame that proves material movement.
  await expect.poll(async () => {
    prior = await readScene(page);
    return prior.frame > home.frame && !prior.transitioning && !prior.inside
      ? Math.hypot(...prior.camera.map((v, i) => v - home.camera[i]))
      : 0;
  }).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Inside', exact: true }).click();
  const interior = await waitForCameraTransition(() => readScene(page), prior, true);
  expect(Math.hypot(...interior.camera.map((v, i) => v - prior.camera[i]))).toBeGreaterThan(1);
  expect(Math.hypot(...interior.target.map((v, i) => v - prior.target[i]))).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Exit interior', exact: true }).click();
  const restored = await waitForCameraTransition(() => readScene(page), interior, false, prior);
  await info.attach('camera-return-normal-motion', {
    body: JSON.stringify({ home, prior, interior, restored }, null, 2),
    contentType: 'application/json',
  });
});

test('presets, engineering controls, validation and fresh-context sharing', async ({
  page,
  browser,
}) => {
  await load(page);
  const initial = await page.locator('canvas').screenshot();
  await page.getByRole('button', { name: 'NEPTUNE III 2035' }).click();
  await expect(root(page)).toHaveAttribute('data-generation', '3');
  await expect(page.getByTestId('gpu-total')).toHaveText('500,000');
  await expect(page.getByTestId('module-total')).toHaveText('196');
  await page.waitForTimeout(1500);
  expect(
    await imageDifference(initial, await page.locator('canvas').screenshot()),
  ).toBeGreaterThan(0.025);
  await page.getByRole('button', { name: 'NEPTUNE I 2026' }).click();
  await expect(page.getByTestId('module-total')).toHaveText('04');
  const input = page.getByRole('spinbutton', {
    name: 'Accelerators',
    exact: true,
  });
  await input.fill('2561');
  await input.press('Enter');
  await expect(page.getByTestId('gpu-total')).toHaveText('2,568');
  await expect(page.getByTestId('module-total')).toHaveText('02');
  await input.fill('-5');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    'Previous value restored',
  );
  await expect(input).toHaveValue('2561');
  const operating = await page.getByTestId('operating-power').innerText();
  const util = page.getByRole('spinbutton', {
    name: 'Utilization',
    exact: true,
  });
  await util.fill('0');
  await util.press('Enter');
  await expect(page.getByTestId('operating-power')).not.toHaveText(operating);
  await expect(page.getByTestId('module-total')).toHaveText('02');
  const seawater = page.getByRole('spinbutton', {
    name: 'Seawater inlet',
    exact: true,
  });
  await seawater.fill('30');
  await seawater.press('Enter');
  await expect(page.getByRole('status')).toContainText(
    'Insufficient temperature headroom',
  );
  await page
    .getByRole('button', { name: 'Share scenario', exact: true })
    .click();
  const link = await page
    .getByRole('textbox', { name: 'Shareable scenario URL' })
    .inputValue();
  const fresh = await browser.newContext({
    viewport: { width: 1600, height: 1050 },
  });
  const second = await fresh.newPage();
  await second.goto(link);
  await expect(
    second.getByRole('spinbutton', { name: 'Accelerators', exact: true }),
  ).toHaveValue('2561');
  await expect(
    second.getByRole('spinbutton', { name: 'Utilization', exact: true }),
  ).toHaveValue('0');
  await expect(
    second.getByRole('spinbutton', { name: 'Seawater inlet', exact: true }),
  ).toHaveValue('30');
  await second.reload();
  await expect(second.getByTestId('gpu-total')).toHaveText('2,568');
  await fresh.close();
  await page.goto('./#s=%GG');
  await expect(page.getByRole('status')).toContainText(
    'Default inputs restored',
  );
  await expect(page.getByTestId('gpu-total')).toHaveText('100,000');
});

test('mobile controls, contextual inspection and explicit WebGL fallback', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(page);
  await expectNoHorizontalOverflow(page, 390);
  await capture(page, `${info.project.name}-mobile`);
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  const util = page.getByRole('spinbutton', {
    name: 'Utilization',
    exact: true,
  });
  await expect(util).toBeVisible();
  await util.fill('50');
  await util.press('Enter');
  await page
    .getByRole('button', { name: 'Close controls', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cooling', exact: true }).click();
  await expect(
    page.getByText('Move heat. Keep circuits separate.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inside', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Exit inside', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Exit inside', exact: true }).click();
  await page.goto('./?legacy=1&fallback=1');
  await expect(
    page.getByText('SCHEMATIC VIEW · WEBGL2 UNAVAILABLE'),
  ).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await page
    .getByRole('spinbutton', { name: 'Accelerators', exact: true })
    .fill('8');
  await page
    .getByRole('spinbutton', { name: 'Accelerators', exact: true })
    .press('Enter');
  await page
    .getByRole('button', { name: 'Close controls', exact: true })
    .click();
  await expect(page.getByTestId('gpu-total')).toHaveText('8');
  await capture(page, `${info.project.name}-fallback`);
  await page.setViewportSize({ width: 800, height: 1000 });
  await load(page);
  await page
    .getByRole('button', { name: 'Presentation mode', exact: true })
    .click();
  const toolbar = (await page
    .getByRole('group', { name: 'Scene modes' })
    .boundingBox())!;
  const footer = (await page.locator('footer').boundingBox())!;
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(footer.y);
  expect(footer.y + footer.height).toBeLessThanOrEqual(1000);
  await expect
    .poll(async () => (await page.locator('canvas').boundingBox())!.height)
    .toBeGreaterThan(900);
  await page.waitForTimeout(1500);
  await capture(page, `${info.project.name}-portrait`);
});

test('demo runs through real state, cancels, restores and restarts; keyboard dialog access', async ({
  page,
}) => {
  await load(page);
  await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  await expect(root(page)).toHaveAttribute('data-demo', 'true');
  await expect(page.getByText('Start with the ocean.')).toBeVisible();
  await expect(page.getByText('Look beneath the surface.')).toBeVisible({
    timeout: 8000,
  });
  await expect(root(page)).toHaveAttribute('data-xray', 'true');
  await page.getByRole('button', { name: 'Stop demo', exact: true }).click();
  await expect(root(page)).toHaveAttribute('data-demo', 'false');
  await expect(root(page)).toHaveAttribute('data-xray', 'false');
  await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  const b = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(b.x + 20, b.y + 100);
  await expect(root(page)).toHaveAttribute('data-demo', 'false');
  await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  await expect(page.getByText('Two circuits. One heat exchange.')).toBeVisible({
    timeout: 12000,
  });
  await expect(root(page)).toHaveAttribute('data-exploded', 'true', {
    timeout: 8000,
  });
  await expect(root(page)).toHaveAttribute('data-generation', '3', {
    timeout: 8000,
  });
  await expect(root(page)).toHaveAttribute('data-demo', 'false', {
    timeout: 12000,
  });
  await expect(root(page)).toHaveAttribute('data-generation', '2');
  const modelButton = page.getByRole('button', {
    name: 'The model',
    exact: true,
  });
  await modelButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(modelButton).toBeFocused();
});

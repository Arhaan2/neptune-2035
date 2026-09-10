import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { expectNoHorizontalOverflow } from './layout';

async function rendered(page: Page, legacy: boolean) {
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(isLegacy => isLegacy
    ? window.__NEPTUNE_SCENE__?.calls ?? 0
    : window.__NEPTUNE_TWIN_SCENE__?.drawCalls ?? 0, legacy)).toBeGreaterThan(0);
}

async function legacyBounds(page: Page, width: number, hasCanvas: boolean) {
  if (hasCanvas) {
    // Wait for the actual canvas to follow its container after a viewport resize.
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('canvas')!.getBoundingClientRect().width
      - document.querySelector('.viewport')!.getBoundingClientRect().width,
    )).toBe(0);
  }
  await expectNoHorizontalOverflow(page, width);
  const presets = page.getByRole('group', { name: 'Generation presets' });
  await expect(presets.getByRole('button')).toHaveCount(3);
  const bounds = await presets.evaluate(element => {
    const bar = element.parentElement!.getBoundingClientRect();
    return [...element.querySelectorAll('button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left - bar.left, right: rect.right - bar.right, width: rect.width };
    });
  });
  for (const button of bounds) {
    expect(button.left).toBeGreaterThanOrEqual(0);
    expect(button.right).toBeLessThanOrEqual(0);
    expect(button.width).toBeGreaterThan(0);
  }
}

test('legacy mobile presets remain visible and usable across rendered and fallback resizes', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 430, height: 844 });
  await page.goto('./?legacy=1');
  await rendered(page, true);
  await legacyBounds(page, 430, true);
  await page.setViewportSize({ width: 375, height: 844 });
  await legacyBounds(page, 375, true);
  const third = page.getByRole('button', { name: 'NEPTUNE III 2035', exact: true });
  await third.focus();
  await expect(third).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-generation', '3');
  await legacyBounds(page, 375, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await legacyBounds(page, 390, true);
  await info.attach('legacy-rendered-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

  await page.goto('./?legacy=1&fallback=1');
  await expect(page.getByText('SCHEMATIC VIEW · WEBGL2 UNAVAILABLE')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await legacyBounds(page, 390, false);
  await page.setViewportSize({ width: 375, height: 844 });
  await legacyBounds(page, 375, false);
  await third.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-generation', '3');
  await legacyBounds(page, 375, false);
  await page.setViewportSize({ width: 430, height: 844 });
  await legacyBounds(page, 430, false);
  await info.attach('legacy-fallback-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('V2 mobile scene and inspector retain layout across rendered and fallback resizes', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await rendered(page, false);
  await expectNoHorizontalOverflow(page, 390);
  for (const width of [430, 375]) {
    await page.setViewportSize({ width, height: 844 });
    await rendered(page, false);
    await expectNoHorizontalOverflow(page, width);
  }
  const find = page.getByRole('textbox', { name: 'Find asset ID', exact: true });
  await find.fill('platform-001/module-01/rack-02');
  await find.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-selected', 'platform-001/module-01/rack-02');
  await expect(page.locator('.twin-inspector')).toContainText('40 U / 48 U');
  await expectNoHorizontalOverflow(page, 375);
  await info.attach('twin-rendered-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

  await page.goto('./?fallback=1');
  await expect(page.getByTestId('twin-fallback')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 375);
  const recovery = page.getByTestId('checkpoint-recovery');
  await expect(recovery).toContainText('Local checkpoint available at 0s');
  const actions = recovery.getByRole('button');
  await expect(actions).toHaveCount(3);
  const geometry = await recovery.evaluate(element => {
    const notice = element.getBoundingClientRect();
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      notice: { left: notice.left, right: notice.right },
      buttons: [...element.querySelectorAll('button')].map(button => {
        const rect = button.getBoundingClientRect();
        return { name: button.textContent, left: rect.left, right: rect.right };
      }),
    };
  });
  for (const button of geometry.buttons) {
    expect(button.left).toBeGreaterThanOrEqual(geometry.notice.left);
    expect(button.right).toBeLessThanOrEqual(geometry.notice.right);
  }
  await info.attach('recovery-layout', { body: Buffer.from(JSON.stringify(geometry)), contentType: 'application/json' });
  for (const action of await actions.all()) {
    await action.focus();
    await expect(action).toBeFocused();
    await expect(action).toBeInViewport();
  }
  const exportRecovery = recovery.getByRole('button', { name: 'Export recovery project', exact: true });
  await exportRecovery.focus();
  const downloadPending = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const download = await downloadPending;
  expect(await download.failure()).toBeNull();
  const saved = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));
  expect(saved.schemaVersion).toBe(3);
  expect(saved.timeS).toBe(0);
  expect(saved.checkpoint).toBeTruthy();
  await expect(recovery).toBeVisible();
  await expectNoHorizontalOverflow(page, 375);
  await info.attach('recovery-notice-mobile', { body: await recovery.screenshot(), contentType: 'image/png' });
  await page.setViewportSize({ width: 430, height: 844 });
  await expectNoHorizontalOverflow(page, 430);
  await find.fill('platform-001/module-01/rack-02');
  await find.press('Enter');
  await expect(page.locator('.twin-inspector')).toContainText('40 U / 48 U');
  const operate = page.getByRole('button', { name: 'Operate', exact: true });
  await operate.focus();
  await expect(operate).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-workspace', 'Operate');
  await expectNoHorizontalOverflow(page, 430);
  expect(errors).toEqual([]);
});

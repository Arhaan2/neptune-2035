import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('record the real 30-second app storyboard and social preview', async ({
  browser,
}) => {
  test.setTimeout(65_000);
  await fs.mkdir('assets/demo', { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: 'assets/demo/raw', size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const recordingStartedAt = Date.now();
  await page.goto(process.env.NEPTUNE_BASE_URL || 'http://127.0.0.1:5173/');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await page
    .getByRole('button', { name: 'Presentation mode', exact: true })
    .click();
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: process.env.NEPTUNE_BASE_URL
      ? 'assets/screenshots/hosted-presentation-16x9.png'
      : 'public/social-preview.png',
  });
  const demoOffsetSeconds = (Date.now() - recordingStartedAt) / 1000;
  await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-demo', 'true');
  await expect(page.getByText('Look beneath the surface.')).toBeVisible({
    timeout: 8000,
  });
  await expect(page.getByText('Two circuits. One heat exchange.')).toBeVisible({
    timeout: 8000,
  });
  await page.screenshot({ path: 'assets/screenshots/demo-cooling-16x9.png' });
  await expect(page.locator('main')).toHaveAttribute('data-exploded', 'true', {
    timeout: 8000,
  });
  await expect(page.locator('main')).toHaveAttribute('data-generation', '3', {
    timeout: 8000,
  });
  await page.screenshot({
    path: 'assets/screenshots/demo-archipelago-16x9.png',
  });
  await expect(page.getByText('What would you build differently?')).toBeVisible(
    { timeout: 8000 },
  );
  await expect(page.locator('main')).toHaveAttribute('data-demo', 'false', {
    timeout: 7000,
  });
  const video = page.video()!;
  await context.close();
  await video.saveAs('assets/demo/neptune-demo.webm');
  await fs.writeFile(
    'assets/demo/capture.json',
    JSON.stringify(
      {
        url: process.env.NEPTUNE_BASE_URL || 'http://127.0.0.1:5173/',
        viewport: { width: 1280, height: 720 },
        demoOffsetSeconds,
        durationSeconds: 30,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  const portrait = await browser.newContext({
    viewport: { width: 800, height: 1000 },
  });
  const portraitPage = await portrait.newPage();
  await portraitPage.goto(
    process.env.NEPTUNE_BASE_URL || 'http://127.0.0.1:5173/',
  );
  await expect(portraitPage.locator('main')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await portraitPage
    .getByRole('button', { name: 'Presentation mode', exact: true })
    .click();
  await portraitPage.waitForTimeout(2000);
  await portraitPage.screenshot({
    path: 'assets/screenshots/presentation-4x5.png',
  });
  await portrait.close();
});

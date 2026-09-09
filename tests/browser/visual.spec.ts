import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('capture the first coherent 3D slice', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./?legacy=1');
  await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1800);
  await fs.mkdir('assets/screenshots', { recursive: true });
  await page.screenshot({
    path: `assets/screenshots/${testInfo.project.name}-hero.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /X-ray/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `assets/screenshots/${testInfo.project.name}-xray.png`,
    fullPage: true,
  });
  const timing = await page.evaluate(async () => {
    const intervals: number[] = [];
    let last = window.performance.now();
    await new Promise<void>((resolve) => {
      const frame = (t: number) => {
        intervals.push(t - last);
        last = t;
        if (intervals.length < 120) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const gl = document.querySelector('canvas')!.getContext('webgl2')!;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const sorted = intervals.slice(1).sort((a, b) => a - b);
    return {
      medianFrameMs: sorted[Math.floor(sorted.length / 2)],
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      samples: sorted.length,
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : 'unavailable',
      scene: window.__NEPTUNE_SCENE__,
    };
  });
  await fs.writeFile(
    `assets/screenshots/${testInfo.project.name}-performance.json`,
    JSON.stringify(timing, null, 2),
  );
  expect(errors).toEqual([]);
});

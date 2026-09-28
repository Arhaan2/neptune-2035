/** Real-app Blue Hour views and a bounded local frame observation; no solver advance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from '@playwright/test';
const base =
  process.env.NEPTUNE_BASE_URL || 'http://127.0.0.1:4173/neptune-2035/';
const out =
  process.env.NEPTUNE_VISUAL_OUT ||
  '/private/tmp/neptune-v1-evidence/candidate';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: process.platform === 'darwin' ? ['--use-angle=metal'] : [],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const button = (name) => page.getByRole('button', { name, exact: true });
await page.goto(base);
await page.locator('main.twin-app[data-ready="true"]').waitFor();
await page.waitForFunction(
  () => window.__NEPTUNE_TWIN_SCENE__?.visualSystem === 'blue-hour-v1',
);
await page.evaluate(() => document.fonts.ready);
const capture = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
};
await capture('campus');
const hero = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);
await button('Cooling close-up').click();
await button('Explode').click();
await capture('systems-reveal');
const reveal = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);
await button('Explode').click();
await button('X-ray').click();
await page
  .getByLabel('Find asset ID', { exact: true })
  .fill('platform-001/module-01');
await button('Find').click();
await capture('platform-approach');
await button('Inside module').click();
await capture('interior-inspection');
await button('Exit interior', { exact: true }).click();
await page
  .getByLabel('Select equipment', { exact: true })
  .selectOption('platform-001/module-01/pump-duty');
await button('Operate').click();
await button('Trip selected asset').click();
await page
  .getByTestId('asset-operating-status')
  .filter({ hasText: 'failed' })
  .waitFor();
await capture('failed-selected-pump');
await page.getByLabel('Find asset ID', { exact: true }).fill('shore/bus');
await button('Find').click();
await capture('power-inspection');
await button('Compare').click();
await capture('compare');
await page.setViewportSize({ width: 390, height: 844 });
await button('Explore').click();
await button('Campus context').click();
await page.evaluate(() => window.scrollTo(0, 0));
await capture('mobile');
const mobileOverflow = await page.evaluate(() => ({
  viewport: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
}));
await page.goto(new URL('?fallback=1', base).href);
await page.getByTestId('twin-fallback').waitFor();
await capture('mobile-fallback');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base);
await page.waitForFunction(
  () => window.__NEPTUNE_TWIN_SCENE__?.visualSystem === 'blue-hour-v1',
);
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.waitForTimeout(1200);
// 30 seconds of measured rAF intervals while keyboard orbit exercises the real controls.
await page.locator('canvas').focus();
const framesPromise = page.evaluate(
  () =>
    new Promise((resolve) => {
      const intervals = [];
      let start = null,
        last = null;
      function frame(t) {
        if (start === null) start = t;
        if (last !== null) intervals.push(t - last);
        last = t;
        if (t - start < 30000) requestAnimationFrame(frame);
        else resolve(intervals);
      }
      requestAnimationFrame(frame);
    }),
);
for (let i = 0; i < 60; i++) {
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
}
const frames = await framesPromise;
const sorted = [...frames].sort((a, b) => a - b);
const observation = {
  sampleCount: frames.length,
  durationMs: frames.reduce((a, b) => a + b, 0),
  medianMs: sorted[Math.floor(sorted.length * 0.5)],
  p95Ms: sorted[Math.floor(sorted.length * 0.95)],
  maxMs: sorted.at(-1),
};
const receipt = {
  base,
  at: new Date().toISOString(),
  fixture:
    'Unchanged default design, time 0; failure views explicitly trip selected pump',
  browser: browser.version(),
  browserMode:
    'Playwright bundled Chromium, headless, ANGLE Metal on macOS; not native Safari validation',
  machine: {
    cpu: os.cpus()[0].model,
    memoryBytes: os.totalmem(),
    platform: os.platform(),
    release: os.release(),
  },
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.5,
  capturesReducedMotion: true,
  orbitReducedMotion: false,
  hero,
  reveal,
  observation,
  mobileOverflow,
  errors,
};
await fs.writeFile(
  path.join(out, 'receipt.json'),
  JSON.stringify(receipt, null, 2) + '\n',
);
console.log(JSON.stringify(receipt, null, 2));
await browser.close();
if (errors.length || mobileOverflow.scrollWidth > mobileOverflow.viewport)
  process.exitCode = 1;

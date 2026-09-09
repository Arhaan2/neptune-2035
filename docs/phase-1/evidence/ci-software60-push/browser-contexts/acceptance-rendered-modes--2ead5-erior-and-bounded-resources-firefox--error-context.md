# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> rendered modes, connected exploded paths, interior and bounded resources
- Location: tests/browser/acceptance.spec.ts:28:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('main')
Expected: "true"
Received: "false"
Timeout:  12000ms

Call log:
  - Expect "toHaveAttribute" locator('main') with timeout 12000ms
  - waiting for locator('main')
    2 × locator resolved to <main class="app  " data-modules="40" data-xray="false" data-demo="false" data-ready="false" data-generation="2" data-inside="false" data-exploded="false">…</main>
      - unexpected value "false"

```

```yaml
- main:
  - link "NEPTUNE home":
    - /url: /
    - text: NEPTUNE AN INFRASTRUCTURE EXPLORATION
  - button "The model"
  - button "Share scenario"
  - paragraph: Design the AI Data Center of 2035
  - group "Generation presets"
  - text: SCENARIO · NOT A FORECAST
  - region "Offshore infrastructure simulator"
  - region "Derived scenario results"
  - text: Concept simulator · Not an engineering design. A concept by
  - strong: Arhaan Aggarwal
  - button "Low effects"
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import fs from 'node:fs/promises';
  3   | import sharp from 'sharp';
  4   | const root = (page: Page) => page.locator('main');
  5   | async function load(page: Page) {
  6   |   await page.goto('./?legacy=1');
> 7   |   await expect(root(page)).toHaveAttribute('data-ready', 'true');
      |                            ^ Error: expect(locator).toHaveAttribute(expected) failed
  8   |   await expect(page.locator('canvas')).toBeVisible();
  9   |   await page.waitForTimeout(1600);
  10  | }
  11  | async function imageDifference(a: Buffer, b: Buffer) {
  12  |   const [x, y] = await Promise.all([
  13  |     sharp(a).resize(400, 260).removeAlpha().raw().toBuffer(),
  14  |     sharp(b).resize(400, 260).removeAlpha().raw().toBuffer(),
  15  |   ]);
  16  |   let changed = 0;
  17  |   for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 20) changed++;
  18  |   return changed / x.length;
  19  | }
  20  | async function capture(page: Page, name: string) {
  21  |   await fs.mkdir('assets/screenshots', { recursive: true });
  22  |   await page.screenshot({
  23  |     path: `assets/screenshots/${name}.png`,
  24  |     fullPage: true,
  25  |   });
  26  | }
  27  | 
  28  | test('rendered modes, connected exploded paths, interior and bounded resources', async ({
  29  |   page,
  30  | }, info) => {
  31  |   const errors: string[] = [];
  32  |   page.on('pageerror', (e) => errors.push(e.message));
  33  |   page.on('console', (m) => {
  34  |     if (m.type() === 'error') errors.push(m.text());
  35  |   });
  36  |   await page.emulateMedia({ reducedMotion: 'reduce' });
  37  |   await load(page);
  38  |   const canvas = page.locator('canvas');
  39  |   const hero = await canvas.screenshot();
  40  |   const stats = await sharp(hero).stats();
  41  |   expect(stats.channels.reduce((sum, c) => sum + c.stdev, 0)).toBeGreaterThan(
  42  |     35,
  43  |   );
  44  |   await canvas.focus();
  45  |   const keyHome = await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera);
  46  |   await page.keyboard.press('ArrowLeft');
  47  |   await expect
  48  |     .poll(() => page.evaluate(() => window.__NEPTUNE_SCENE__!.camera))
  49  |     .not.toEqual(keyHome);
  50  |   await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  51  |   await page.waitForTimeout(150);
  52  |   const home = await page.evaluate(() => window.__NEPTUNE_SCENE__!);
  53  |   const bounds = (await canvas.boundingBox())!;
  54  |   await page.mouse.move(
  55  |     bounds.x + bounds.width * 0.6,
  56  |     bounds.y + bounds.height * 0.6,
  57  |   );
  58  |   await page.mouse.down();
  59  |   await page.mouse.move(
  60  |     bounds.x + bounds.width * 0.78,
  61  |     bounds.y + bounds.height * 0.62,
  62  |     { steps: 10 },
  63  |   );
  64  |   await page.mouse.up();
  65  |   await page.waitForTimeout(150);
  66  |   const orbit = await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera);
  67  |   expect(orbit).not.toEqual(home.camera);
  68  |   await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  69  |   await page.waitForTimeout(150);
  70  |   const reset = await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera);
  71  |   reset.forEach((v, i) => expect(v).toBeCloseTo(home.camera[i], 1));
  72  |   await page.getByRole('button', { name: /X-ray/ }).click();
  73  |   await expect(root(page)).toHaveAttribute('data-xray', 'true');
  74  |   await page.waitForTimeout(200);
  75  |   const cutaway = await canvas.screenshot();
  76  |   expect(await imageDifference(hero, cutaway)).toBeGreaterThan(0.01);
  77  |   await page.getByRole('button', { name: 'Cooling', exact: true }).click();
  78  |   await expect(
  79  |     page.getByText('Move heat. Keep circuits separate.'),
  80  |   ).toBeVisible();
  81  |   await capture(page, `${info.project.name}-cooling`);
  82  |   await page.getByRole('button', { name: 'Explode', exact: true }).click();
  83  |   await expect(root(page)).toHaveAttribute('data-exploded', 'true');
  84  |   await page.waitForTimeout(200);
  85  |   await capture(page, `${info.project.name}-exploded`);
  86  |   expect(
  87  |     await imageDifference(cutaway, await canvas.screenshot()),
  88  |   ).toBeGreaterThan(0.015);
  89  |   const warmed = await page.evaluate(() => window.__NEPTUNE_SCENE__!);
  90  |   for (let i = 0; i < 4; i++) {
  91  |     await page.getByRole('button', { name: 'Explode', exact: true }).click();
  92  |     await page.getByRole('button', { name: /X-ray/ }).click();
  93  |   }
  94  |   await page.waitForTimeout(250);
  95  |   const after = await page.evaluate(() => window.__NEPTUNE_SCENE__!);
  96  |   expect(after.geometries).toBeLessThanOrEqual(warmed.geometries + 3);
  97  |   expect(after.textures).toBeLessThanOrEqual(warmed.textures + 1);
  98  |   await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  99  |   await page.waitForTimeout(150);
  100 |   expect(await imageDifference(hero, await canvas.screenshot())).toBeLessThan(
  101 |     0.025,
  102 |   );
  103 |   await page.getByRole('button', { name: 'Power', exact: true }).click();
  104 |   await expect(page.getByText('An ocean is not a power source.')).toBeVisible();
  105 |   await capture(page, `${info.project.name}-power`);
  106 |   await page.getByRole('button', { name: 'Network', exact: true }).click();
  107 |   await expect(
```
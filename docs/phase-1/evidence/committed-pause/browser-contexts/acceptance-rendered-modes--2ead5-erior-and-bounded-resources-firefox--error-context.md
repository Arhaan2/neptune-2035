# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> rendered modes, connected exploded paths, interior and bounded resources
- Location: tests/browser/acceptance.spec.ts:28:1

# Error details

```
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 81.86859002510815
Received: 76.62242322113698

Expected precision:    1
Expected difference: < 0.05
Received difference:   5.246166803971164
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - link "NEPTUNE home" [ref=e5] [cursor=pointer]:
      - /url: /
      - generic [ref=e10]: NEPTUNE
      - generic [ref=e12]: AN INFRASTRUCTURE EXPLORATION
    - generic [ref=e13]:
      - button "The model" [ref=e14] [cursor=pointer]
      - button "Share scenario" [ref=e18] [cursor=pointer]
  - generic [ref=e24]:
    - paragraph [ref=e25]: Design the AI Data Center of 2035
    - group "Generation presets" [ref=e26]:
      - button "NEPTUNE I 2026" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: NEPTUNE I
        - generic [ref=e29]: "2026"
      - button "NEPTUNE II 2030" [pressed] [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: NEPTUNE II
        - generic [ref=e32]: "2030"
      - button "NEPTUNE III 2035" [ref=e33] [cursor=pointer]:
        - generic [ref=e34]: NEPTUNE III
        - generic [ref=e35]: "2035"
    - generic [ref=e36]: SCENARIO · NOT A FORECAST
  - region "Offshore infrastructure simulator" [ref=e38]:
    - complementary [ref=e39]:
      - generic [ref=e40]: 02 / THE OFFSHORE SERIES
      - heading "NEPTUNE II" [level=1] [ref=e42]
      - paragraph [ref=e43]: The modular campus.Energy. Cooling. Modularity.
      - generic [ref=e45]: SHAPE THE SCENARIO
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]: Accelerators
          - generic [ref=e59]:
            - spinbutton "Accelerators" [ref=e60]: "100000"
            - generic [ref=e61]: GPUs
        - group "Accelerators slider" [ref=e62]:
          - slider [ref=e67]: "100000"
        - generic [ref=e68]:
          - generic [ref=e69]: "8"
          - generic [ref=e70]: 1,000,000
      - generic [ref=e71]:
        - generic [ref=e72]:
          - generic [ref=e73]: Utilization
          - generic [ref=e74]:
            - spinbutton "Utilization" [ref=e75]: "80"
            - generic [ref=e76]: "%"
        - group "Utilization slider" [ref=e77]:
          - slider [ref=e82]: "80"
        - generic [ref=e83]:
          - generic [ref=e84]: "0"
          - generic [ref=e85]: "100"
      - generic [ref=e86]:
        - generic [ref=e87]:
          - generic [ref=e88]: Assumed PUE
          - generic [ref=e89]:
            - spinbutton "Assumed PUE" [ref=e90]: "1.15"
            - generic [ref=e91]: ×
        - group "Assumed PUE slider" [ref=e92]:
          - slider [ref=e97]: "1.15"
        - generic [ref=e98]:
          - generic [ref=e99]: "1"
          - generic [ref=e100]: "2.00"
      - generic [ref=e101]:
        - generic [ref=e102]:
          - generic [ref=e103]: Seawater inlet
          - generic [ref=e104]:
            - spinbutton "Seawater inlet" [ref=e105]: "18"
            - generic [ref=e106]: °C
        - group "Seawater inlet slider" [ref=e107]:
          - slider [ref=e112]: "18"
        - generic [ref=e113]:
          - generic [ref=e114]: "-2"
          - generic [ref=e115]: "38"
      - button "Assumptions & sources" [ref=e116] [cursor=pointer]
      - button "Reset scenario inputs" [ref=e125] [cursor=pointer]
    - generic [ref=e126]:
      - generic [ref=e127]: OFFSHORE CAMPUS / CONCEPT VIEW
      - img "Interactive offshore compute platform. Drag or use arrow keys to orbit; plus and minus to zoom." [ref=e132]
      - generic:
        - generic: ↔ Drag to orbit · Scroll to explore
        - button "Reset view" [active] [ref=e133] [cursor=pointer]
      - generic [ref=e140]: "N"
    - complementary [ref=e146]:
      - generic [ref=e147]: EXPLORE THE SYSTEMS
      - group "System selection" [ref=e148]:
        - button "Overview" [pressed] [ref=e149] [cursor=pointer]
        - button "Compute" [ref=e157] [cursor=pointer]
        - button "Cooling" [ref=e176] [cursor=pointer]
        - button "Power" [ref=e183] [cursor=pointer]
        - button "Network" [ref=e189] [cursor=pointer]
      - generic [ref=e199]:
        - text: THE DESIGN THESIS
        - heading "Compute meets the coast." [level=2] [ref=e200]
        - paragraph [ref=e201]: What if we designed AI infrastructure around energy, cooling, and modularity from the beginning?
        - generic [ref=e202]:
          - strong [ref=e203]: "05"
          - generic [ref=e204]: connected platforms40 compute modules
        - paragraph [ref=e205]: Rack glyphs illustrate capacity. Partial modules and grouped platforms are schematic. One visible hull assembly per platform.
    - group "Scene modes" [ref=e206]:
      - button "X-ray OFF" [ref=e207] [cursor=pointer]:
        - text: X-ray
        - generic [ref=e212]: "OFF"
      - button "Explode" [ref=e213] [cursor=pointer]
      - button "Inside" [ref=e220] [cursor=pointer]
      - button "Play demo" [ref=e226] [cursor=pointer]
      - button "Presentation mode" [ref=e230] [cursor=pointer]
  - region "Derived scenario results" [ref=e236]:
    - generic [ref=e237]:
      - generic [ref=e238]: ACCELERATORS
      - strong [ref=e254]: 100,000
      - generic [ref=e255]: 12,500 whole compute nodes
    - generic [ref=e256]:
      - generic [ref=e257]: OPERATING DEMAND
      - strong [ref=e260]:
        - text: "193.2"
        - emphasis [ref=e261]: MW
      - generic [ref=e262]: 222.0 MW peak design
    - generic [ref=e263]:
      - generic [ref=e264]: SEAWATER FLOW
      - strong [ref=e268]:
        - text: "8.2"
        - emphasis [ref=e269]: m³/s
      - generic [ref=e270]: 9.4 m³/s peak sizing
    - generic [ref=e271]:
      - generic [ref=e272]: COMPUTE MODULES
      - strong [ref=e277]: "40"
      - generic [ref=e278]: 3,125 racks · schematic geometry
    - generic [ref=e279]:
      - generic [ref=e280]: THERMAL HEADROOM
      - strong [ref=e281]:
        - text: "9.0"
        - emphasis [ref=e282]: °C
      - text: Simplified screen · not a feasibility test
  - generic [ref=e283]:
    - generic [ref=e284]: Concept simulator · Not an engineering design.
    - generic [ref=e285]:
      - text: A concept by
      - strong [ref=e286]: Arhaan Aggarwal
    - button "Low effects" [ref=e287] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import fs from 'node:fs/promises';
  3   | import sharp from 'sharp';
  4   | const root = (page: Page) => page.locator('main');
  5   | async function load(page: Page) {
  6   |   await page.goto('./?legacy=1');
  7   |   await expect(root(page)).toHaveAttribute('data-ready', 'true');
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
> 71  |   reset.forEach((v, i) => expect(v).toBeCloseTo(home.camera[i], 1));
      |                                     ^ Error: expect(received).toBeCloseTo(expected, precision)
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
  108 |     page.getByText('Connected within. Connected beyond.'),
  109 |   ).toBeVisible();
  110 |   await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  111 |   const prior = await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera);
  112 |   await page.getByRole('button', { name: 'Inside', exact: true }).click();
  113 |   await expect(page.getByText('Within a compute module')).toBeVisible();
  114 |   await page.waitForTimeout(200);
  115 |   await capture(page, `${info.project.name}-interior`);
  116 |   expect(
  117 |     await imageDifference(hero, await canvas.screenshot()),
  118 |   ).toBeGreaterThan(0.1);
  119 |   await page
  120 |     .getByRole('button', { name: 'Exit interior', exact: true })
  121 |     .click();
  122 |   await page.waitForTimeout(150);
  123 |   (await page.evaluate(() => window.__NEPTUNE_SCENE__!.camera)).forEach(
  124 |     (v, i) => expect(v).toBeCloseTo(prior[i], 1),
  125 |   );
  126 |   expect(errors).toEqual([]);
  127 |   await fs.writeFile(
  128 |     `assets/screenshots/${info.project.name}-render-stats.json`,
  129 |     JSON.stringify(
  130 |       { viewport: page.viewportSize(), home, warmed, after, errors },
  131 |       null,
  132 |       2,
  133 |     ),
  134 |   );
  135 | });
  136 | 
  137 | test('presets, engineering controls, validation and fresh-context sharing', async ({
  138 |   page,
  139 |   browser,
  140 | }) => {
  141 |   await load(page);
  142 |   const initial = await page.locator('canvas').screenshot();
  143 |   await page.getByRole('button', { name: 'NEPTUNE III 2035' }).click();
  144 |   await expect(root(page)).toHaveAttribute('data-generation', '3');
  145 |   await expect(page.getByTestId('gpu-total')).toHaveText('500,000');
  146 |   await expect(page.getByTestId('module-total')).toHaveText('196');
  147 |   await page.waitForTimeout(1500);
  148 |   expect(
  149 |     await imageDifference(initial, await page.locator('canvas').screenshot()),
  150 |   ).toBeGreaterThan(0.025);
  151 |   await page.getByRole('button', { name: 'NEPTUNE I 2026' }).click();
  152 |   await expect(page.getByTestId('module-total')).toHaveText('04');
  153 |   const input = page.getByRole('spinbutton', {
  154 |     name: 'Accelerators',
  155 |     exact: true,
  156 |   });
  157 |   await input.fill('2561');
  158 |   await input.press('Enter');
  159 |   await expect(page.getByTestId('gpu-total')).toHaveText('2,568');
  160 |   await expect(page.getByTestId('module-total')).toHaveText('02');
  161 |   await input.fill('-5');
  162 |   await input.press('Enter');
  163 |   await expect(page.getByRole('alert')).toContainText(
  164 |     'Previous value restored',
  165 |   );
  166 |   await expect(input).toHaveValue('2561');
  167 |   const operating = await page.getByTestId('operating-power').innerText();
  168 |   const util = page.getByRole('spinbutton', {
  169 |     name: 'Utilization',
  170 |     exact: true,
  171 |   });
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> presets, engineering controls, validation and fresh-context sharing
- Location: tests/browser/acceptance.spec.ts:137:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
```

# Test source

```ts
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
> 151 |   await page.getByRole('button', { name: 'NEPTUNE I 2026' }).click();
      |                                                              ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  172 |   await util.fill('0');
  173 |   await util.press('Enter');
  174 |   await expect(page.getByTestId('operating-power')).not.toHaveText(operating);
  175 |   await expect(page.getByTestId('module-total')).toHaveText('02');
  176 |   const seawater = page.getByRole('spinbutton', {
  177 |     name: 'Seawater inlet',
  178 |     exact: true,
  179 |   });
  180 |   await seawater.fill('30');
  181 |   await seawater.press('Enter');
  182 |   await expect(page.getByRole('status')).toContainText(
  183 |     'Insufficient temperature headroom',
  184 |   );
  185 |   await page
  186 |     .getByRole('button', { name: 'Share scenario', exact: true })
  187 |     .click();
  188 |   const link = await page
  189 |     .getByRole('textbox', { name: 'Shareable scenario URL' })
  190 |     .inputValue();
  191 |   const fresh = await browser.newContext({
  192 |     viewport: { width: 1600, height: 1050 },
  193 |   });
  194 |   const second = await fresh.newPage();
  195 |   await second.goto(link);
  196 |   await expect(
  197 |     second.getByRole('spinbutton', { name: 'Accelerators', exact: true }),
  198 |   ).toHaveValue('2561');
  199 |   await expect(
  200 |     second.getByRole('spinbutton', { name: 'Utilization', exact: true }),
  201 |   ).toHaveValue('0');
  202 |   await expect(
  203 |     second.getByRole('spinbutton', { name: 'Seawater inlet', exact: true }),
  204 |   ).toHaveValue('30');
  205 |   await second.reload();
  206 |   await expect(second.getByTestId('gpu-total')).toHaveText('2,568');
  207 |   await fresh.close();
  208 |   await page.goto('./#s=%GG');
  209 |   await expect(page.getByRole('status')).toContainText(
  210 |     'Default inputs restored',
  211 |   );
  212 |   await expect(page.getByTestId('gpu-total')).toHaveText('100,000');
  213 | });
  214 | 
  215 | test('mobile controls, contextual inspection and explicit WebGL fallback', async ({
  216 |   page,
  217 | }, info) => {
  218 |   await page.setViewportSize({ width: 390, height: 844 });
  219 |   await load(page);
  220 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
  221 |     390,
  222 |   );
  223 |   await capture(page, `${info.project.name}-mobile`);
  224 |   await page.getByRole('button', { name: 'Controls', exact: true }).click();
  225 |   const util = page.getByRole('spinbutton', {
  226 |     name: 'Utilization',
  227 |     exact: true,
  228 |   });
  229 |   await expect(util).toBeVisible();
  230 |   await util.fill('50');
  231 |   await util.press('Enter');
  232 |   await page
  233 |     .getByRole('button', { name: 'Close controls', exact: true })
  234 |     .click();
  235 |   await page.getByRole('button', { name: 'Cooling', exact: true }).click();
  236 |   await expect(
  237 |     page.getByText('Move heat. Keep circuits separate.'),
  238 |   ).toBeVisible();
  239 |   await page.getByRole('button', { name: 'Inside', exact: true }).click();
  240 |   await expect(
  241 |     page.getByRole('button', { name: 'Exit inside', exact: true }),
  242 |   ).toBeVisible();
  243 |   await page.getByRole('button', { name: 'Exit inside', exact: true }).click();
  244 |   await page.goto('./?legacy=1&fallback=1');
  245 |   await expect(
  246 |     page.getByText('SCHEMATIC VIEW · WEBGL2 UNAVAILABLE'),
  247 |   ).toBeVisible();
  248 |   await expect(page.locator('canvas')).toHaveCount(0);
  249 |   await page.getByRole('button', { name: 'Controls', exact: true }).click();
  250 |   await page
  251 |     .getByRole('spinbutton', { name: 'Accelerators', exact: true })
```
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
Call log:
  - waiting for getByRole('button', { name: 'NEPTUNE I 2026' })
    - locator resolved to <button aria-pressed="false">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

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
  - generic [ref=e23]:
    - paragraph [ref=e24]: Design the AI Data Center of 2035
    - group "Generation presets" [ref=e25]:
      - button "NEPTUNE I 2026" [ref=e26] [cursor=pointer]:
        - generic [ref=e27]: NEPTUNE I
        - generic [ref=e28]: "2026"
      - button "NEPTUNE II 2030" [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: NEPTUNE II
        - generic [ref=e31]: "2030"
      - button "NEPTUNE III 2035" [active] [pressed] [ref=e32] [cursor=pointer]:
        - generic [ref=e33]: NEPTUNE III
        - generic [ref=e34]: "2035"
    - generic [ref=e35]: SCENARIO · NOT A FORECAST
  - region "Offshore infrastructure simulator" [ref=e37]:
    - complementary [ref=e38]:
      - generic [ref=e39]: 03 / THE OFFSHORE SERIES
      - heading "NEPTUNE III" [level=1] [ref=e41]
      - paragraph [ref=e42]: The compute archipelago.Energy. Cooling. Modularity.
      - generic [ref=e44]: SHAPE THE SCENARIO
      - generic [ref=e46]:
        - generic [ref=e47]:
          - generic [ref=e48]: Accelerators
          - generic [ref=e49]:
            - spinbutton "Accelerators" [ref=e50]: "500000"
            - generic [ref=e51]: GPUs
        - group "Accelerators slider" [ref=e52]:
          - slider [ref=e57]: "500000"
        - generic [ref=e58]:
          - generic [ref=e59]: "8"
          - generic [ref=e60]: 1,000,000
      - generic [ref=e61]:
        - generic [ref=e62]:
          - generic [ref=e63]: Utilization
          - generic [ref=e64]:
            - spinbutton "Utilization" [ref=e65]: "80"
            - generic [ref=e66]: "%"
        - group "Utilization slider" [ref=e67]:
          - slider [ref=e72]: "80"
        - generic [ref=e73]:
          - generic [ref=e74]: "0"
          - generic [ref=e75]: "100"
      - generic [ref=e76]:
        - generic [ref=e77]:
          - generic [ref=e78]: Assumed PUE
          - generic [ref=e79]:
            - spinbutton "Assumed PUE" [ref=e80]: "1.15"
            - generic [ref=e81]: ×
        - group "Assumed PUE slider" [ref=e82]:
          - slider [ref=e87]: "1.15"
        - generic [ref=e88]:
          - generic [ref=e89]: "1"
          - generic [ref=e90]: "2.00"
      - generic [ref=e91]:
        - generic [ref=e92]:
          - generic [ref=e93]: Seawater inlet
          - generic [ref=e94]:
            - spinbutton "Seawater inlet" [ref=e95]: "18"
            - generic [ref=e96]: °C
        - group "Seawater inlet slider" [ref=e97]:
          - slider [ref=e102]: "18"
        - generic [ref=e103]:
          - generic [ref=e104]: "-2"
          - generic [ref=e105]: "38"
      - button "Assumptions & sources" [ref=e106] [cursor=pointer]
      - button "Reset scenario inputs" [ref=e113] [cursor=pointer]
    - generic [ref=e114]:
      - generic [ref=e115]: OFFSHORE CAMPUS / CONCEPT VIEW
      - img "Interactive offshore compute platform. Drag or use arrow keys to orbit; plus and minus to zoom." [ref=e120]
      - generic:
        - generic: ↔ Drag to orbit · Scroll to explore
        - button "Reset view" [ref=e121] [cursor=pointer]
      - generic [ref=e128]: "N"
    - complementary [ref=e134]:
      - generic [ref=e135]: EXPLORE THE SYSTEMS
      - group "System selection" [ref=e136]:
        - button "Overview" [pressed] [ref=e137] [cursor=pointer]
        - button "Compute" [ref=e144] [cursor=pointer]
        - button "Cooling" [ref=e151] [cursor=pointer]
        - button "Power" [ref=e158] [cursor=pointer]
        - button "Network" [ref=e164] [cursor=pointer]
      - generic [ref=e173]:
        - text: THE DESIGN THESIS
        - heading "Compute meets the coast." [level=2] [ref=e174]
        - paragraph [ref=e175]: What if we designed AI infrastructure around energy, cooling, and modularity from the beginning?
        - generic [ref=e176]:
          - strong [ref=e177]: "25"
          - generic [ref=e178]: connected platforms196 compute modules
        - paragraph [ref=e179]: Rack glyphs illustrate capacity. Partial modules and grouped platforms are schematic. One visible hull assembly per platform.
    - group "Scene modes" [ref=e180]:
      - button "X-ray OFF" [ref=e181] [cursor=pointer]:
        - text: X-ray
        - generic [ref=e186]: "OFF"
      - button "Explode" [ref=e187] [cursor=pointer]
      - button "Inside" [ref=e192] [cursor=pointer]
      - button "Play demo" [ref=e198] [cursor=pointer]
      - button "Presentation mode" [ref=e202] [cursor=pointer]
  - region "Derived scenario results" [ref=e208]:
    - generic [ref=e209]:
      - generic [ref=e210]: ACCELERATORS
      - strong [ref=e214]: 500,000
      - generic [ref=e215]: 62,500 whole compute nodes
    - generic [ref=e216]:
      - generic [ref=e217]: OPERATING DEMAND
      - strong [ref=e220]:
        - text: "966.1"
        - emphasis [ref=e221]: MW
      - generic [ref=e222]: 1,110.0 MW peak design
    - generic [ref=e223]:
      - generic [ref=e224]: SEAWATER FLOW
      - strong [ref=e228]:
        - text: "41.1"
        - emphasis [ref=e229]: m³/s
      - generic [ref=e230]: 47.2 m³/s peak sizing
    - generic [ref=e231]:
      - generic [ref=e232]: COMPUTE MODULES
      - strong [ref=e236]: "196"
      - generic [ref=e237]: 15,625 racks · schematic geometry
    - generic [ref=e238]:
      - generic [ref=e239]: THERMAL HEADROOM
      - strong [ref=e240]:
        - text: "9.0"
        - emphasis [ref=e241]: °C
      - text: Simplified screen · not a feasibility test
  - generic [ref=e242]:
    - generic [ref=e243]: Concept simulator · Not an engineering design.
    - generic [ref=e244]:
      - text: A concept by
      - strong [ref=e245]: Arhaan Aggarwal
    - button "Low effects" [ref=e246] [cursor=pointer]
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
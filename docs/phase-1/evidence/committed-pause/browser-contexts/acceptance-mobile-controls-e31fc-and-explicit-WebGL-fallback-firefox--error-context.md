# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> mobile controls, contextual inspection and explicit WebGL fallback
- Location: tests/browser/acceptance.spec.ts:215:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 390
Received: 391
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - link "NEPTUNE home" [ref=e5] [cursor=pointer]:
      - /url: /
      - generic [ref=e10]: NEPTUNE
    - button "Share scenario" [ref=e12] [cursor=pointer]
  - generic [ref=e18]:
    - paragraph [ref=e19]: Design the AI Data Center of 2035
    - group "Generation presets" [ref=e20]:
      - button "NEPTUNE I 2026" [ref=e21] [cursor=pointer]:
        - generic [ref=e22]: NEPTUNE I
        - generic [ref=e23]: "2026"
      - button "NEPTUNE II 2030" [pressed] [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: NEPTUNE II
        - generic [ref=e26]: "2030"
      - button "NEPTUNE III 2035" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: NEPTUNE III
        - generic [ref=e29]: "2035"
  - region "Offshore infrastructure simulator" [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]: OFFSHORE CAMPUS / CONCEPT VIEW
      - img "Interactive offshore compute platform. Drag or use arrow keys to orbit; plus and minus to zoom." [ref=e37]
      - generic:
        - generic: ↔ Drag to orbit · Scroll to explore
        - button "Reset view" [ref=e38] [cursor=pointer]
      - generic [ref=e45]: "N"
    - complementary:
      - group "System selection":
        - button "Overview" [pressed] [ref=e51] [cursor=pointer]
        - button "Compute" [ref=e57] [cursor=pointer]
        - button "Cooling" [ref=e74] [cursor=pointer]
        - button "Power" [ref=e79] [cursor=pointer]
        - button "Network" [ref=e83] [cursor=pointer]
    - group "Scene modes" [ref=e91]:
      - button "Controls" [ref=e92] [cursor=pointer]
      - button "X-ray" [ref=e104] [cursor=pointer]
      - button "Explode" [ref=e109] [cursor=pointer]
      - button "Inside" [ref=e115] [cursor=pointer]
      - button "Play demo" [ref=e120] [cursor=pointer]
      - button "Presentation mode" [ref=e123] [cursor=pointer]
  - region "Derived scenario results" [ref=e129]:
    - generic [ref=e130]:
      - generic [ref=e131]: ACCELERATORS
      - strong [ref=e147]: 100,000
      - generic [ref=e148]: 12,500 whole compute nodes
    - generic [ref=e149]:
      - generic [ref=e150]: OPERATING DEMAND
      - strong [ref=e153]:
        - text: "193.2"
        - emphasis [ref=e154]: MW
      - generic [ref=e155]: 222.0 MW peak design
    - generic [ref=e156]:
      - generic [ref=e157]: SEAWATER FLOW
      - strong [ref=e161]:
        - text: "8.2"
        - emphasis [ref=e162]: m³/s
      - generic [ref=e163]: 9.4 m³/s peak sizing
    - generic [ref=e164]:
      - generic [ref=e165]: COMPUTE MODULES
      - strong [ref=e170]: "40"
      - generic [ref=e171]: 3,125 racks · schematic geometry
  - generic [ref=e172]:
    - generic [ref=e173]: Concept simulator · Not an engineering design.
    - generic [ref=e174]:
      - text: A concept by
      - strong [ref=e175]: Arhaan Aggarwal
    - button "Low effects" [ref=e176] [cursor=pointer]
```

# Test source

```ts
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
> 220 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      |                                                                           ^ Error: expect(received).toBe(expected) // Object.is equality
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
  252 |     .fill('8');
  253 |   await page
  254 |     .getByRole('spinbutton', { name: 'Accelerators', exact: true })
  255 |     .press('Enter');
  256 |   await page
  257 |     .getByRole('button', { name: 'Close controls', exact: true })
  258 |     .click();
  259 |   await expect(page.getByTestId('gpu-total')).toHaveText('8');
  260 |   await capture(page, `${info.project.name}-fallback`);
  261 |   await page.setViewportSize({ width: 800, height: 1000 });
  262 |   await load(page);
  263 |   await page
  264 |     .getByRole('button', { name: 'Presentation mode', exact: true })
  265 |     .click();
  266 |   const toolbar = (await page
  267 |     .getByRole('group', { name: 'Scene modes' })
  268 |     .boundingBox())!;
  269 |   const footer = (await page.locator('footer').boundingBox())!;
  270 |   expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(footer.y);
  271 |   expect(footer.y + footer.height).toBeLessThanOrEqual(1000);
  272 |   await expect
  273 |     .poll(async () => (await page.locator('canvas').boundingBox())!.height)
  274 |     .toBeGreaterThan(900);
  275 |   await page.waitForTimeout(1500);
  276 |   await capture(page, `${info.project.name}-portrait`);
  277 | });
  278 | 
  279 | test('demo runs through real state, cancels, restores and restarts; keyboard dialog access', async ({
  280 |   page,
  281 | }) => {
  282 |   await load(page);
  283 |   await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  284 |   await expect(root(page)).toHaveAttribute('data-demo', 'true');
  285 |   await expect(page.getByText('Start with the ocean.')).toBeVisible();
  286 |   await expect(page.getByText('Look beneath the surface.')).toBeVisible({
  287 |     timeout: 8000,
  288 |   });
  289 |   await expect(root(page)).toHaveAttribute('data-xray', 'true');
  290 |   await page.getByRole('button', { name: 'Stop demo', exact: true }).click();
  291 |   await expect(root(page)).toHaveAttribute('data-demo', 'false');
  292 |   await expect(root(page)).toHaveAttribute('data-xray', 'false');
  293 |   await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  294 |   const b = (await page.locator('canvas').boundingBox())!;
  295 |   await page.mouse.click(b.x + 20, b.y + 100);
  296 |   await expect(root(page)).toHaveAttribute('data-demo', 'false');
  297 |   await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  298 |   await expect(page.getByText('Two circuits. One heat exchange.')).toBeVisible({
  299 |     timeout: 12000,
  300 |   });
  301 |   await expect(root(page)).toHaveAttribute('data-exploded', 'true', {
  302 |     timeout: 8000,
  303 |   });
  304 |   await expect(root(page)).toHaveAttribute('data-generation', '3', {
  305 |     timeout: 8000,
  306 |   });
  307 |   await expect(root(page)).toHaveAttribute('data-demo', 'false', {
  308 |     timeout: 12000,
  309 |   });
  310 |   await expect(root(page)).toHaveAttribute('data-generation', '2');
  311 |   const modelButton = page.getByRole('button', {
  312 |     name: 'The model',
  313 |     exact: true,
  314 |   });
  315 |   await modelButton.focus();
  316 |   await page.keyboard.press('Enter');
  317 |   await expect(page.getByRole('dialog')).toBeVisible();
  318 |   await page.keyboard.press('Escape');
  319 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  320 |   await expect(modelButton).toBeFocused();
```
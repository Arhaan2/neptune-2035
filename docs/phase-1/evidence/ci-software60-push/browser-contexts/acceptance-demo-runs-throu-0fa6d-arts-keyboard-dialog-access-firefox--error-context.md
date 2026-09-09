# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> demo runs through real state, cancels, restores and restarts; keyboard dialog access
- Location: tests/browser/acceptance.spec.ts:279:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Look beneath the surface.')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Look beneath the surface.') with timeout 8000ms
  - waiting for getByText('Look beneath the surface.')

```

```yaml
- main:
  - link "NEPTUNE home":
    - /url: /
    - text: NEPTUNE AN INFRASTRUCTURE EXPLORATION
  - button "The model"
  - button "Share scenario"
  - paragraph: Design the AI Data Center of 2035
  - group "Generation presets":
    - button "NEPTUNE I 2026"
    - button "NEPTUNE II 2030" [pressed]
    - button "NEPTUNE III 2035"
  - text: SCENARIO · NOT A FORECAST
  - region "Offshore infrastructure simulator":
    - complementary:
      - text: 02 / THE OFFSHORE SERIES
      - heading "NEPTUNE II" [level=1]
      - paragraph: The modular campus. Energy. Cooling. Modularity.
      - text: SHAPE THE SCENARIO Accelerators
      - spinbutton "Accelerators": "100000"
      - text: GPUs
      - group "Accelerators slider":
        - slider: "100000"
      - text: 8 1,000,000 Utilization
      - spinbutton "Utilization": "80"
      - text: "%"
      - group "Utilization slider":
        - slider: "80"
      - text: 0 100 Assumed PUE
      - spinbutton "Assumed PUE": "1.15"
      - text: ×
      - group "Assumed PUE slider":
        - slider: "1.15"
      - text: 1 2.00 Seawater inlet
      - spinbutton "Seawater inlet": "18"
      - text: °C
      - group "Seawater inlet slider":
        - slider: "18"
      - text: "-2 38"
      - button "Assumptions & sources"
      - button "Reset scenario inputs"
    - text: OFFSHORE CAMPUS / CONCEPT VIEW
    - img "Interactive offshore compute platform. Drag or use arrow keys to orbit; plus and minus to zoom."
    - text: Technical coolant Warm return Power Fiber Traces on one representative platform ↔ Drag to orbit · Scroll to explore
    - button "Reset view"
    - text: N 02 / AN INFRASTRUCTURE EXPLORATION
    - heading "Look beneath the surface." [level=2]
    - paragraph: Compute, cooling, power and networking.
    - complementary:
      - text: EXPLORE THE SYSTEMS
      - group "System selection":
        - button "Overview" [pressed]
        - button "Compute"
        - button "Cooling"
        - button "Power"
        - button "Network"
      - text: THE DESIGN THESIS
      - heading "Compute meets the coast." [level=2]
      - paragraph: What if we designed AI infrastructure around energy, cooling, and modularity from the beginning?
      - strong: "05"
      - text: connected platforms 40 compute modules
      - paragraph: Rack glyphs illustrate capacity. Partial modules and grouped platforms are schematic. One visible hull assembly per platform.
    - group "Scene modes":
      - button "X-ray ON" [pressed]
      - button "Explode"
      - button "Inside"
      - button "Stop demo" [pressed]
      - button "Presentation mode"
  - region "Derived scenario results":
    - text: ACCELERATORS
    - strong: 100,000
    - text: 12,500 whole compute nodes OPERATING DEMAND
    - strong:
      - text: "193.2"
      - emphasis: MW
    - text: 222.0 MW peak design SEAWATER FLOW
    - strong:
      - text: "8.2"
      - emphasis: m³/s
    - text: 9.4 m³/s peak sizing COMPUTE MODULES
    - strong: "40"
    - text: 3,125 racks · schematic geometry THERMAL HEADROOM
    - strong:
      - text: "9.0"
      - emphasis: °C
    - text: Simplified screen · not a feasibility test
  - text: Concept simulator · Not an engineering design. A concept by
  - strong: Arhaan Aggarwal
  - button "Low effects"
```

# Test source

```ts
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
> 286 |   await expect(page.getByText('Look beneath the surface.')).toBeVisible({
      |                                                             ^ Error: expect(locator).toBeVisible() failed
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
  321 | });
  322 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> demo runs through real state, cancels, restores and restarts; keyboard dialog access
- Location: tests/browser/acceptance.spec.ts:279:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('main')
Expected: "false"
Received: "true"

Call log:
  - Expect "toHaveAttribute" locator('main') with timeout 12000ms
  - waiting for locator('main')
    6 × locator resolved to <main class="app  " data-demo="true" data-xray="false" data-ready="true" data-modules="196" data-generation="3" data-inside="false" data-exploded="false">…</main>
      - unexpected value "true"
  - Test timeout of 60000ms exceeded.

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
> 307 |   await expect(root(page)).toHaveAttribute('data-demo', 'false', {
      |                            ^ Error: expect(locator).toHaveAttribute(expected) failed
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
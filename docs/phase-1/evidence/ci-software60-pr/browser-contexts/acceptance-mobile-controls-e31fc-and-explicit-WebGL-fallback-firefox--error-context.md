# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> mobile controls, contextual inspection and explicit WebGL fallback
- Location: tests/browser/acceptance.spec.ts:215:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 900
Received:   570

Call Log:
- Test timeout of 60000ms exceeded
```

# Page snapshot

```yaml
- main [ref=f2e3]:
  - region "Offshore infrastructure simulator" [ref=f2e4]:
    - generic [ref=f2e5]:
      - generic [ref=f2e6]: NEPTUNE
      - img "Interactive offshore compute platform. Drag or use arrow keys to orbit; plus and minus to zoom." [ref=f2e14]
    - group "Scene modes" [ref=f2e15]:
      - button "Controls" [ref=f2e16] [cursor=pointer]
      - button "X-ray" [ref=f2e28] [cursor=pointer]
      - button "Explode" [ref=f2e33] [cursor=pointer]
      - button "Inside" [ref=f2e39] [cursor=pointer]
      - button "Play demo" [ref=f2e44] [cursor=pointer]
      - button "Exit presentation" [active] [pressed] [ref=f2e47] [cursor=pointer]
  - generic [ref=f2e53]:
    - generic [ref=f2e54]: Concept simulator · Not an engineering design.
    - generic [ref=f2e55]:
      - text: A concept by
      - strong [ref=f2e56]: Arhaan Aggarwal
    - button "Low effects" [ref=f2e57] [cursor=pointer]
```

# Test source

```ts
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
> 274 |     .toBeGreaterThan(900);
      |      ^ Error: expect(received).toBeGreaterThan(expected)
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
  321 | });
  322 | 
```
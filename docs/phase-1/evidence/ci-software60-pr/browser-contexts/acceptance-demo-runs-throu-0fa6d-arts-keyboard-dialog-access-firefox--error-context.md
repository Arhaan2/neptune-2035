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
Error: mouse.click: Test timeout of 60000ms exceeded.
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
        - button "Reset view" [ref=e133] [cursor=pointer]
      - generic [ref=e140]: "N"
      - generic:
        - generic: 01 / AN INFRASTRUCTURE EXPLORATION
        - heading "Start with the ocean." [level=2]
        - paragraph: Energy. Cooling. Modularity.
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
      - button "Stop demo" [active] [pressed] [ref=e226] [cursor=pointer]
      - button "Presentation mode" [ref=e231] [cursor=pointer]
  - region "Derived scenario results" [ref=e237]:
    - generic [ref=e238]:
      - generic [ref=e239]: ACCELERATORS
      - strong [ref=e255]: 100,000
      - generic [ref=e256]: 12,500 whole compute nodes
    - generic [ref=e257]:
      - generic [ref=e258]: OPERATING DEMAND
      - strong [ref=e261]:
        - text: "193.2"
        - emphasis [ref=e262]: MW
      - generic [ref=e263]: 222.0 MW peak design
    - generic [ref=e264]:
      - generic [ref=e265]: SEAWATER FLOW
      - strong [ref=e269]:
        - text: "8.2"
        - emphasis [ref=e270]: m³/s
      - generic [ref=e271]: 9.4 m³/s peak sizing
    - generic [ref=e272]:
      - generic [ref=e273]: COMPUTE MODULES
      - strong [ref=e278]: "40"
      - generic [ref=e279]: 3,125 racks · schematic geometry
    - generic [ref=e280]:
      - generic [ref=e281]: THERMAL HEADROOM
      - strong [ref=e282]:
        - text: "9.0"
        - emphasis [ref=e283]: °C
      - text: Simplified screen · not a feasibility test
  - generic [ref=e284]:
    - generic [ref=e285]: Concept simulator · Not an engineering design.
    - generic [ref=e286]:
      - text: A concept by
      - strong [ref=e287]: Arhaan Aggarwal
    - button "Low effects" [ref=e288] [cursor=pointer]
```

# Test source

```ts
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
  286 |   await expect(page.getByText('Look beneath the surface.')).toBeVisible({
  287 |     timeout: 8000,
  288 |   });
  289 |   await expect(root(page)).toHaveAttribute('data-xray', 'true');
  290 |   await page.getByRole('button', { name: 'Stop demo', exact: true }).click();
  291 |   await expect(root(page)).toHaveAttribute('data-demo', 'false');
  292 |   await expect(root(page)).toHaveAttribute('data-xray', 'false');
  293 |   await page.getByRole('button', { name: 'Play demo', exact: true }).click();
  294 |   const b = (await page.locator('canvas').boundingBox())!;
> 295 |   await page.mouse.click(b.x + 20, b.y + 100);
      |                    ^ Error: mouse.click: Test timeout of 60000ms exceeded.
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
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> capture the first coherent 3D slice
- Location: tests/browser/visual.spec.ts:3:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.evaluate: Test timeout of 60000ms exceeded.
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
      - generic [ref=e133]:
        - generic [ref=e134]: Technical coolant
        - generic [ref=e136]: Warm return
        - generic [ref=e138]: Power
        - generic [ref=e140]: Fiber
        - generic [ref=e142]: Traces on one representative platform
      - generic:
        - generic: ↔ Drag to orbit · Scroll to explore
        - button "Reset view" [ref=e143] [cursor=pointer]
      - generic [ref=e150]: "N"
    - complementary [ref=e156]:
      - generic [ref=e157]: EXPLORE THE SYSTEMS
      - group "System selection" [ref=e158]:
        - button "Overview" [pressed] [ref=e159] [cursor=pointer]
        - button "Compute" [ref=e167] [cursor=pointer]
        - button "Cooling" [ref=e186] [cursor=pointer]
        - button "Power" [ref=e193] [cursor=pointer]
        - button "Network" [ref=e199] [cursor=pointer]
      - generic [ref=e209]:
        - text: THE DESIGN THESIS
        - heading "Compute meets the coast." [level=2] [ref=e210]
        - paragraph [ref=e211]: What if we designed AI infrastructure around energy, cooling, and modularity from the beginning?
        - generic [ref=e212]:
          - strong [ref=e213]: "05"
          - generic [ref=e214]: connected platforms40 compute modules
        - paragraph [ref=e215]: Rack glyphs illustrate capacity. Partial modules and grouped platforms are schematic. One visible hull assembly per platform.
    - group "Scene modes" [ref=e216]:
      - button "X-ray ON" [active] [pressed] [ref=e217] [cursor=pointer]:
        - text: X-ray
        - generic [ref=e222]: "ON"
      - button "Explode" [ref=e223] [cursor=pointer]
      - button "Inside" [ref=e230] [cursor=pointer]
      - button "Play demo" [ref=e236] [cursor=pointer]
      - button "Presentation mode" [ref=e240] [cursor=pointer]
  - region "Derived scenario results" [ref=e246]:
    - generic [ref=e247]:
      - generic [ref=e248]: ACCELERATORS
      - strong [ref=e264]: 100,000
      - generic [ref=e265]: 12,500 whole compute nodes
    - generic [ref=e266]:
      - generic [ref=e267]: OPERATING DEMAND
      - strong [ref=e270]:
        - text: "193.2"
        - emphasis [ref=e271]: MW
      - generic [ref=e272]: 222.0 MW peak design
    - generic [ref=e273]:
      - generic [ref=e274]: SEAWATER FLOW
      - strong [ref=e278]:
        - text: "8.2"
        - emphasis [ref=e279]: m³/s
      - generic [ref=e280]: 9.4 m³/s peak sizing
    - generic [ref=e281]:
      - generic [ref=e282]: COMPUTE MODULES
      - strong [ref=e287]: "40"
      - generic [ref=e288]: 3,125 racks · schematic geometry
    - generic [ref=e289]:
      - generic [ref=e290]: THERMAL HEADROOM
      - strong [ref=e291]:
        - text: "9.0"
        - emphasis [ref=e292]: °C
      - text: Simplified screen · not a feasibility test
  - generic [ref=e293]:
    - generic [ref=e294]: Concept simulator · Not an engineering design.
    - generic [ref=e295]:
      - text: A concept by
      - strong [ref=e296]: Arhaan Aggarwal
    - button "Low effects" [ref=e297] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import fs from 'node:fs/promises';
  3  | test('capture the first coherent 3D slice', async ({ page }, testInfo) => {
  4  |   const errors: string[] = [];
  5  |   page.on('pageerror', (e) => errors.push(e.message));
  6  |   await page.goto('./?legacy=1');
  7  |   await expect(page.locator('main')).toHaveAttribute('data-ready', 'true');
  8  |   await expect(page.locator('canvas')).toBeVisible();
  9  |   await page.waitForTimeout(1800);
  10 |   await fs.mkdir('assets/screenshots', { recursive: true });
  11 |   await page.screenshot({
  12 |     path: `assets/screenshots/${testInfo.project.name}-hero.png`,
  13 |     fullPage: true,
  14 |   });
  15 |   await page.getByRole('button', { name: /X-ray/ }).click();
  16 |   await page.waitForTimeout(700);
  17 |   await page.screenshot({
  18 |     path: `assets/screenshots/${testInfo.project.name}-xray.png`,
  19 |     fullPage: true,
  20 |   });
> 21 |   const timing = await page.evaluate(async () => {
     |                             ^ Error: page.evaluate: Test timeout of 60000ms exceeded.
  22 |     const intervals: number[] = [];
  23 |     let last = window.performance.now();
  24 |     await new Promise<void>((resolve) => {
  25 |       const frame = (t: number) => {
  26 |         intervals.push(t - last);
  27 |         last = t;
  28 |         if (intervals.length < 120) requestAnimationFrame(frame);
  29 |         else resolve();
  30 |       };
  31 |       requestAnimationFrame(frame);
  32 |     });
  33 |     const gl = document.querySelector('canvas')!.getContext('webgl2')!;
  34 |     const ext = gl.getExtension('WEBGL_debug_renderer_info');
  35 |     const sorted = intervals.slice(1).sort((a, b) => a - b);
  36 |     return {
  37 |       medianFrameMs: sorted[Math.floor(sorted.length / 2)],
  38 |       p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
  39 |       samples: sorted.length,
  40 |       renderer: ext
  41 |         ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
  42 |         : 'unavailable',
  43 |       scene: window.__NEPTUNE_SCENE__,
  44 |     };
  45 |   });
  46 |   await fs.writeFile(
  47 |     `assets/screenshots/${testInfo.project.name}-performance.json`,
  48 |     JSON.stringify(timing, null, 2),
  49 |   );
  50 |   expect(errors).toEqual([]);
  51 | });
  52 | 
```
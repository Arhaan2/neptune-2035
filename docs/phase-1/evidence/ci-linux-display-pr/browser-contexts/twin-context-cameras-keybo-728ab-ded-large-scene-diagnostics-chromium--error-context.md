# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: twin.spec.ts >> context cameras, keyboard interior, distinct families and bounded large-scene diagnostics
- Location: tests/browser/twin.spec.ts:248:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Design family II', exact: true })

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - link "NEPTUNE v2" [ref=e5] [cursor=pointer]:
      - /url: ./
    - navigation "Workspaces" [ref=e11]:
      - button "Explore" [ref=e12] [cursor=pointer]
      - button "Operate" [ref=e13] [cursor=pointer]
      - button "Compare" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - button "Evidence" [ref=e16] [cursor=pointer]
      - link "Legacy v0.1" [ref=e20] [cursor=pointer]:
        - /url: "?legacy=1"
  - generic [ref=e21]:
    - generic [ref=e22]: Design-stage digital twin · Simulated operation
    - generic [ref=e24]: reference-v2-aa6189d9 · 1 world unit = 1 m
  - generic [ref=e25]:
    - complementary [ref=e26]:
      - generic [ref=e27]: REFERENCE DESIGN / 01
      - heading "NEPTUNE I" [level=1] [ref=e28]
      - paragraph [ref=e29]: Shore-connected pilot
      - generic [ref=e30]:
        - button "Design family I" [ref=e31] [cursor=pointer]: I
        - button "Design family II" [ref=e32] [cursor=pointer]: II
        - button "Design family III" [ref=e33] [cursor=pointer]: III
      - generic [ref=e34]:
        - text: Starting scenario
        - combobox "Starting scenario" [ref=e35] [cursor=pointer]:
          - option "Choose capacity…" [disabled] [selected]
          - option "10,000 accelerator pilot"
          - option "100,000 campus"
          - option "500,000 archipelago"
          - option "1,000,000 bounded scale test"
      - generic [ref=e36]:
        - generic [ref=e37]: Requested accelerators
        - generic [ref=e38]:
          - spinbutton "Requested accelerators" [ref=e39]: "10000"
          - generic [ref=e40]: units
      - generic [ref=e41]:
        - generic [ref=e42]: Supply ceiling
        - generic [ref=e43]:
          - spinbutton "Supply ceiling" [ref=e44]: "30"
          - generic [ref=e45]: MW
      - generic [ref=e46]:
        - generic [ref=e47]: Standby cooling
        - combobox "Standby cooling" [ref=e48] [cursor=pointer]:
          - option "No standby"
          - option "One standby / module" [selected]
      - group [ref=e49]:
        - generic "Design assumptions" [ref=e50] [cursor=pointer]
      - generic [ref=e51]:
        - heading "Asset hierarchy" [level=2] [ref=e52]
        - generic [ref=e53]:
          - text: Platform
          - combobox "Select platform" [ref=e54] [cursor=pointer]:
            - option "platform-001" [selected]
            - option "platform-002"
        - tree "Asset hierarchy" [ref=e55]:
          - treeitem "module-01 40 racks" [selected] [ref=e56] [cursor=pointer]:
            - text: module-01
            - generic [ref=e60]: 40 racks
          - treeitem "module-02 40 racks" [ref=e61] [cursor=pointer]:
            - text: module-02
            - generic [ref=e65]: 40 racks
          - treeitem "module-03 40 racks" [ref=e66] [cursor=pointer]:
            - text: module-03
            - generic [ref=e70]: 40 racks
          - treeitem "module-04 40 racks" [ref=e71] [cursor=pointer]:
            - text: module-04
            - generic [ref=e75]: 40 racks
        - generic [ref=e76]:
          - text: Exact equipment
          - combobox "Select equipment" [ref=e77] [cursor=pointer]:
            - option "Module assembly"
            - option "pump duty · pump" [selected]
            - option "pump sea · pump"
            - option "hx · exchanger"
            - option "cdu · cdu"
            - option "valve tech · valve"
            - option "valve sea · valve"
            - option "pipe tech · pipe"
            - option "pipe sea · pipe"
            - option "battery · battery"
            - option "distribution · switchboard"
            - option "rack network · network"
            - option "pump standby · pump"
            - option "rack 01 · rack"
            - option "rack 02 · rack"
            - option "rack 03 · rack"
            - option "rack 04 · rack"
            - option "rack 05 · rack"
            - option "rack 06 · rack"
            - option "rack 07 · rack"
            - option "rack 08 · rack"
            - option "rack 09 · rack"
            - option "rack 10 · rack"
            - option "rack 11 · rack"
            - option "rack 12 · rack"
            - option "rack 13 · rack"
            - option "rack 14 · rack"
            - option "rack 15 · rack"
            - option "rack 16 · rack"
            - option "rack 17 · rack"
            - option "rack 18 · rack"
            - option "rack 19 · rack"
            - option "rack 20 · rack"
            - option "rack 21 · rack"
            - option "rack 22 · rack"
            - option "rack 23 · rack"
            - option "rack 24 · rack"
            - option "rack 25 · rack"
            - option "rack 26 · rack"
            - option "rack 27 · rack"
            - option "rack 28 · rack"
            - option "rack 29 · rack"
            - option "rack 30 · rack"
            - option "rack 31 · rack"
            - option "rack 32 · rack"
            - option "rack 33 · rack"
            - option "rack 34 · rack"
            - option "rack 35 · rack"
            - option "rack 36 · rack"
            - option "rack 37 · rack"
            - option "rack 38 · rack"
            - option "rack 39 · rack"
            - option "rack 40 · rack"
        - generic [ref=e78]:
          - textbox "Find asset ID" [ref=e79]:
            - /placeholder: Resolve exact asset ID
          - button "Find" [ref=e80] [cursor=pointer]
    - generic [ref=e81]:
      - generic [ref=e82]:
        - generic:
          - generic: INSPECT / PUMP
          - strong: platform-001/module-01/pump-duty
        - generic [ref=e83]:
          - generic [ref=e84]:
            - 'img "Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits." [ref=e86]'
            - generic:
              - generic:
                - generic: pump duty
                - text: platform-001/module-01/pump-duty
          - generic:
            - generic: 1 UNIT = 1 m
            - generic: 8 / 8 modules
            - generic: "LOD: 40 racks · 160 nodes · 1 selected module"
          - generic "Connection colors":
            - generic: — Technical coolant
            - generic: — Seawater
            - generic: — Power
            - generic: — Network
        - generic "Scene controls" [ref=e87]:
          - button "X-ray" [active] [pressed] [ref=e88] [cursor=pointer]
          - button "Explode" [ref=e93] [cursor=pointer]
          - button "Dimensions" [ref=e94] [cursor=pointer]
          - button "Cooling close-up" [ref=e95] [cursor=pointer]
          - button "Inside module" [ref=e99] [cursor=pointer]
          - button "Campus view" [ref=e100] [cursor=pointer]
          - button "Plan" [ref=e104] [cursor=pointer]
      - generic [ref=e105]:
        - generic [ref=e106]:
          - generic [ref=e107]: Provisioned
          - strong [ref=e108]: 10,000
          - text: 1250 whole servers
        - generic [ref=e109]:
          - generic [ref=e110]: Facility draw
          - strong [ref=e111]: 13.94 MW
          - text: IT + cooling + conversion
        - generic [ref=e112]:
          - generic [ref=e113]: Workload available
          - strong [ref=e114]: 10,000
          - text: 10,000 energized
        - generic [ref=e115]:
          - generic [ref=e116]: Bulk coolant
          - strong [ref=e117]: 30 °C
          - text: Maximum modeled module
      - generic [ref=e118]:
        - button "Start" [ref=e119] [cursor=pointer]
        - strong [ref=e122]: 0s
        - generic [ref=e123]:
          - text: Speed
          - combobox "Simulation speed" [ref=e124] [cursor=pointer]:
            - option "1×" [selected]
            - option "5×"
            - option "20×"
            - option "60×"
        - button "Step 10s" [ref=e125] [cursor=pointer]
        - button "Reset state" [ref=e126] [cursor=pointer]
        - button "Replay" [ref=e127] [cursor=pointer]
        - generic [ref=e128]:
          - text: Replay to
          - spinbutton "Replay time in seconds" [ref=e129]: "0"
          - text: s
        - button "Seek time" [ref=e130] [cursor=pointer]
        - generic [ref=e131]: Paused · fixed 1s steps
      - status [ref=e132]: "Checkpoint saved locally at 0s. Progress after this checkpoint may be lost on interruption. Last successful local checkpoint: 0s."
      - generic [ref=e133]:
        - generic [ref=e134]:
          - generic [ref=e135]: Bulk coolant · actual model samples
          - generic [ref=e136]: 17–47 °C
        - img "Bulk coolant temperature trend over simulated time" [ref=e137]
        - generic [ref=e139]:
          - generic [ref=e140]: 0s
          - generic [ref=e141]: 0s · no interpolation of physical fields
    - complementary [ref=e142]:
      - generic [ref=e143]: EXACT ASSET INSPECTION
      - heading "pump duty" [level=2] [ref=e144]
      - code [ref=e145]: platform-001/module-01/pump-duty
      - generic [ref=e146]: running · simulated
      - generic [ref=e147]:
        - term [ref=e148]: Envelope (W × H × D)
        - definition [ref=e149]: 1.2 × 1.2 × 0.8 m
        - term [ref=e150]: Operational mass
        - definition [ref=e151]: 180 kg
        - term [ref=e152]: Catalog / evidence
        - definition [ref=e153]: equipment-v2 · assumed
        - term [ref=e154]: Failure domain
        - definition [ref=e155]:
          - button "shore/bus" [ref=e156] [cursor=pointer]
      - group [ref=e157]:
        - generic "Ratings and ports" [ref=e158] [cursor=pointer]
      - heading "Module operating point" [level=3] [ref=e159]
      - generic [ref=e160]:
        - term [ref=e161]: Technical / seawater flow
        - definition [ref=e162]: 59.69 / 66.37 L/s
        - term [ref=e163]: Hydraulic pressure
        - definition [ref=e164]: 160.9 kPa
        - term [ref=e165]: Coolant / residual air
        - definition [ref=e166]: 30 / 25 °C
        - term [ref=e167]: Stored battery energy
        - definition [ref=e168]: 400 kWh
        - term [ref=e169]: Instantaneous / energy PUE
        - definition [ref=e170]: 1.081 / Undefined
      - generic [ref=e171]:
        - button "Trip selected asset" [ref=e172] [cursor=pointer]
        - button "Restore selected asset" [ref=e173] [cursor=pointer]
        - button "Inspect duty pump" [ref=e174] [cursor=pointer]
      - group [ref=e175]:
        - generic "Supporting paths & connections" [ref=e176] [cursor=pointer]
        - generic [ref=e177]:
          - generic [ref=e178]:
            - button "platform-001/module-01/battery" [ref=e179] [cursor=pointer]
            - generic [ref=e180]: ↓ 2,200 kW capacity
            - button "platform-001/module-01/distribution" [ref=e181] [cursor=pointer]
          - generic [ref=e182]:
            - button "shore/bus" [ref=e183] [cursor=pointer]
            - generic [ref=e184]: ↓ 2,200 kW capacity
            - button "platform-001/module-01/battery" [ref=e185] [cursor=pointer]
          - generic [ref=e186]:
            - button "shore/transformer" [ref=e187] [cursor=pointer]
            - generic [ref=e188]: ↓ 30,000 kW capacity
            - button "shore/bus" [ref=e189] [cursor=pointer]
          - generic [ref=e190]:
            - button "shore/grid" [ref=e191] [cursor=pointer]
            - generic [ref=e192]: ↓ 30,000 kW capacity
            - button "shore/transformer" [ref=e193] [cursor=pointer]
        - generic [ref=e194]:
          - button "power → platform-001/module-01/distribution" [ref=e195] [cursor=pointer]:
            - generic [ref=e196]: power →
            - text: platform-001/module-01/distribution
          - button "technical → platform-001/module-01/pipe-tech" [ref=e197] [cursor=pointer]:
            - generic [ref=e198]: technical →
            - text: platform-001/module-01/pipe-tech
          - button "technical → platform-001/module-01/valve-tech" [ref=e199] [cursor=pointer]:
            - generic [ref=e200]: technical →
            - text: platform-001/module-01/valve-tech
        - paragraph [ref=e201]: Technical coolant and seawater exchange heat across the HX; fluids do not mix. Colored paths are connectivity, not CFD.
      - heading "Inspect the evidence" [level=3] [ref=e202]
      - generic [ref=e203]:
        - button "Data & replay" [ref=e204] [cursor=pointer]
        - button "Constraints & sources" [ref=e207] [cursor=pointer]
      - paragraph [ref=e208]: Residuals · electrical 0 W · thermal -0 W · solver 0 msNormalized · electrical 0.00e+0 · thermal -3.34e-17
  - generic [ref=e209]:
    - generic [ref=e210]: Arhaan Aggarwal · Calibration / physical validation pending
    - generic [ref=e211]:
      - generic [ref=e212] [cursor=pointer]: Import project
      - combobox "Export artifact" [ref=e213] [cursor=pointer]:
        - option "Export…" [disabled] [selected]
        - option "Versioned project JSON"
        - option "Experiment events JSON"
        - option "Results CSV"
        - option "Equipment inventory CSV"
        - option "Engineering report"
        - option "Dimensioned glTF"
```

# Test source

```ts
  171 |   await screenshot(page,info,'cancel-stale-worker');expect(errors).toEqual([]);
  172 | });
  173 | 
  174 | test.describe('reduced-motion touch acceptance',()=>{
  175 |   test.use({hasTouch:true,viewport:{width:390,height:844}});
  176 |   test('touch waypoints and keyboard exit preserve exact selected asset and physical state',async({page},info)=>{
  177 |     const errors=observeErrors(page);await load(page);
  178 |     expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  179 |     const before=await exportArtifact(page,'results'),selected=await main(page).getAttribute('data-selected');
  180 |     await page.getByRole('button',{name:'Cooling close-up',exact:true}).tap();
  181 |     await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('cooling');
  182 |     await page.getByRole('button',{name:'Inside module',exact:true}).tap();
  183 |     await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(true);
  184 |     const entrance=(await diagnostics(page))?.camera;
  185 |     await page.getByRole('button',{name:'Rack aisle',exact:true}).tap();
  186 |     await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(entrance);
  187 |     const aisle=(await diagnostics(page))?.camera;
  188 |     await page.getByRole('button',{name:'Cooling bay',exact:true}).tap();
  189 |     await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(aisle);
  190 |     await expect(main(page)).toHaveAttribute('data-selected',selected!);
  191 |     const canvas=page.locator('canvas');await canvas.focus();const target=(await diagnostics(page))?.target;
  192 |     await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
  193 |     await expect.poll(async()=>(await diagnostics(page))?.target).not.toEqual(target);
  194 |     await page.keyboard.press('Escape');await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(false);
  195 |     await page.getByRole('button',{name:'Explode',exact:true}).tap();await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(true);
  196 |     await page.getByRole('button',{name:'Explode',exact:true}).tap();await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(false);
  197 |     await expect(main(page)).toHaveAttribute('data-time','0');expect(await exportArtifact(page,'results')).toBe(before);
  198 |     expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  199 |     await screenshot(page,info,'reduced-motion-touch');expect(errors).toEqual([]);
  200 |   });
  201 | });
  202 | 
  203 | test('comparison renders two computed 240-second runs and exports identical disturbance histories',async({page},info)=>{
  204 |   const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  205 |   await page.getByRole('button',{name:'Compare',exact:true}).click();
  206 |   await page.getByRole('button',{name:'Compare pump experiment',exact:true}).click();
  207 |   const cards=page.locator('.twin-comparison-grid article');await expect(cards).toHaveCount(2);
  208 |   await expect(cards.nth(0).getByRole('heading',{level:3})).toHaveText('No standby pump');
  209 |   await expect(cards.nth(1).getByRole('heading',{level:3})).toHaveText('One standby pump');
  210 |   const temperature=async(card:Locator)=>Number((await card.locator('p').first().innerText()).split('°')[0].replaceAll(',','').trim());
  211 |   expect(await temperature(cards.nth(0))).toBeGreaterThan(await temperature(cards.nth(1))+0.5);
  212 |   const a=JSON.parse(await textDownload(page,()=>cards.nth(0).getByRole('button',{name:'Export reproducible run',exact:true}).click()));
  213 |   const b=JSON.parse(await textDownload(page,()=>cards.nth(1).getByRole('button',{name:'Export reproducible run',exact:true}).click()));
  214 |   expect(a.timeS).toBe(240);expect(b.timeS).toBe(240);expect(a.events).toEqual(b.events);
  215 |   expect(a.design.standbyPumps).toBe(0);expect(b.design.standbyPumps).toBe(1);
  216 |   await expect(page.locator('.twin-delta')).toContainText('at 240s:');
  217 |   await screenshot(page,info,'comparison');expect(errors).toEqual([]);
  218 | });
  219 | 
  220 | test('project exports and imports replay numerical state, with invalid mappings rejected visibly',async({page},info)=>{
  221 |   const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  222 |   await step(page,10);await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();await step(page,10);
  223 |   const before=await exportArtifact(page,'results'),projectText=await exportArtifact(page,'project'),project=JSON.parse(projectText);
  224 |   expect(project.events).toContainEqual(expect.objectContaining({assetId:pump,kind:'trip',timeS:10}));
  225 |   await page.getByRole('button',{name:'Reset state',exact:true}).click();await expect(main(page)).toHaveAttribute('data-time','0');
  226 |   await page.getByLabel('Import project',{exact:true}).setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(projectText)});
  227 |   await expect(main(page)).toHaveAttribute('data-time','20');await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  228 |   expect(await exportArtifact(page,'results')).toBe(before);
  229 |   const invalid=JSON.stringify({...project,events:[{id:'invalid',timeS:0,kind:'trip',assetId:'unmapped/pump'}]});
  230 |   await page.getByLabel('Import project',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(invalid)});
  231 |   await expect(page.locator('.twin-notice')).toContainText('Unknown event asset');await expect(main(page)).toHaveAttribute('data-time','20');
  232 |   await screenshot(page,info,'project-replay');expect(errors).toEqual([]);
  233 | });
  234 | 
  235 | test('mobile keyboard and explicit fallback retain asset inspection, operation and exports',async({page},info)=>{
  236 |   const errors=observeErrors(page);await page.setViewportSize({width:390,height:844});await load(page,'./?fallback=1');
  237 |   await expect(page.getByTestId('twin-fallback')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);
  238 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  239 |   const find=page.getByRole('textbox',{name:'Find asset ID',exact:true});await find.fill('platform-001/module-01/rack-02');await find.press('Enter');
  240 |   await expect(main(page)).toHaveAttribute('data-selected','platform-001/module-01/rack-02');
  241 |   await expect(page.locator('.twin-inspector')).toContainText('40 U / 48 U');
  242 |   const operate=page.getByRole('button',{name:'Operate',exact:true});await operate.focus();await page.keyboard.press('Enter');
  243 |   await expect(main(page)).toHaveAttribute('data-workspace','Operate');await step(page,10);
  244 |   const results=await exportArtifact(page,'results');expect(results).toContain('simulatedTimeS');expect(results).toContain('platform-001/module-01');
  245 |   await screenshot(page,info,'mobile-fallback');expect(errors).toEqual([]);
  246 | });
  247 | 
  248 | test('context cameras, keyboard interior, distinct families and bounded large-scene diagnostics',async({page},info)=>{
  249 |   const errors=observeErrors(page);await load(page);
  250 |   await expect(page.locator('canvas')).toBeVisible();await expect.poll(()=>diagnostics(page)).toBeTruthy();
  251 |   const initial=await diagnostics(page);expect(initial?.worldUnitsPerMeter).toBe(1);expect(initial?.renderedModules).toBe(8);
  252 |   const initialCadence=await frameCadence(page);
  253 |   const canvas=page.locator('canvas');await canvas.focus();await page.keyboard.press('ArrowLeft');
  254 |   await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(initial?.camera);
  255 |   await page.getByRole('button',{name:'Cooling close-up',exact:true}).click();
  256 |   await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('cooling');
  257 |   await screenshot(page,info,'cooling-close-up');
  258 |   await page.getByRole('button',{name:'Inside module',exact:true}).click();await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(true);
  259 |   const inside=(await diagnostics(page))?.camera;await canvas.focus();await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');
  260 |   await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(inside);
  261 |   await page.keyboard.press('Escape');await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(false);
  262 |   const beforeFlow=await page.getByTestId('selected-flow').innerText();
  263 |   await page.getByRole('button',{name:'Explode',exact:true}).click();await page.getByRole('button',{name:'Explode',exact:true}).click();
  264 |   await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(false);
  265 |   const warmed=await diagnostics(page);
  266 |   for(let n=0;n<4;n++){await page.getByRole('button',{name:'Explode',exact:true}).click();await page.getByRole('button',{name:'X-ray',exact:true}).click();}
  267 |   await page.setViewportSize({width:1200,height:900});await page.setViewportSize({width:1600,height:1050});
  268 |   await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(false);
  269 |   const after=await diagnostics(page);expect(after!.geometries).toBeLessThanOrEqual(warmed!.geometries+5);expect(after!.textures).toBeLessThanOrEqual(warmed!.textures+2);
  270 |   await expect(page.getByTestId('selected-flow')).toHaveText(beforeFlow);await expect(main(page)).toHaveAttribute('data-time','0');
> 271 |   await page.getByRole('button',{name:'Design family II',exact:true}).click();await expect(page.getByRole('heading',{name:'NEPTUNE II',exact:true})).toBeVisible();
      |                                                                       ^ Error: locator.click: Test timeout of 60000ms exceeded.
  272 |   await expect(page.locator('.twin-inspector')).toContainText('platform-001/switchboard');
  273 |   await page.getByRole('button',{name:'Design family III',exact:true}).click();await expect(page.locator('.twin-inspector')).toContainText('platform-001/segment-feeder');
  274 |   await changeNumber(page,'Requested accelerators','1280');await expect.poll(async()=>(await diagnostics(page))?.totalModules).toBe(1);const small=await diagnostics(page),smallCadence=await frameCadence(page);
  275 |   await page.getByRole('button',{name:'Campus view',exact:true}).click();
  276 |   await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('campus');
  277 |   const start=Date.now();await page.getByLabel('Starting scenario',{exact:true}).selectOption('500000');
  278 |   await expect.poll(async()=>(await diagnostics(page))?.totalModules,{timeout:20000}).toBe(391);const large=await diagnostics(page),largeInteractionMs=Date.now()-start,largeCadence=await frameCadence(page);
  279 |   expect(large?.renderedPlatforms).toBe(98);expect(large?.renderedModules).toBe(large?.totalModules);
  280 |   const stepStart=Date.now();await step(page,10);const largeStepResponseMs=Date.now()-stepStart;
  281 |   const hardware=await page.evaluate(()=>{
  282 |     const gl=document.querySelector('canvas')?.getContext('webgl2'),extension=gl?.getExtension('WEBGL_debug_renderer_info');
  283 |     return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,renderer:gl&&extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable'};
  284 |   });
  285 |   await screenshot(page,info,'large-campus');
  286 |   await fs.writeFile(`assets/screenshots/v2-${info.project.name}-diagnostics.json`,JSON.stringify({hardware,viewport:page.viewportSize(),initial,initialCadence,warmed,after,small,smallCadence,large,largeCadence,largeInteractionMs,largeStepResponseMs,errors,scope:'Actual tested browser/device only; RAF intervals measure presentation cadence, not GPU benchmark certification or a general laptop-performance claim.'},null,2));
  287 |   expect(errors).toEqual([]);
  288 | });
  289 | 
  290 | test('legacy saved scenario links retain the explicit aggregate model',async({page})=>{
  291 |   const errors=observeErrors(page);await page.goto('./?legacy=1');
  292 |   await expect(page.locator('main')).toHaveAttribute('data-ready','true');
  293 |   await expect(page.getByRole('spinbutton',{name:'Accelerators',exact:true})).toBeVisible();
  294 |   await page.getByRole('button',{name:'Share scenario',exact:true}).click();
  295 |   const link=await page.getByRole('textbox',{name:'Shareable scenario URL',exact:true}).inputValue();
  296 |   expect(link).toContain('#s=');
  297 |   const legacyURL=new URL(link);legacyURL.searchParams.delete('legacy');await page.goto(legacyURL.href);
  298 |   await expect(page.getByRole('spinbutton',{name:'Accelerators',exact:true})).toBeVisible();
  299 |   await expect(main(page)).toHaveCount(0);expect(errors).toEqual([]);
  300 | });
  301 | 
```
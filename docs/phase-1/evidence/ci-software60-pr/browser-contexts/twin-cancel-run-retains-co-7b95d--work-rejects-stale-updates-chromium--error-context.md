# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: twin.spec.ts >> cancel run retains completed state and superseding work rejects stale updates
- Location: tests/browser/twin.spec.ts:146:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('main.twin-app')
Expected: "20"
Received: "110"
Timeout:  12000ms

Call log:
  - Expect "toHaveAttribute" locator('main.twin-app') with timeout 12000ms
  - waiting for locator('main.twin-app')
    27 × locator resolved to <main data-time="110" class="twin-app" data-ready="true" data-scene-ready="true" data-workspace="Explore" data-selected="platform-001/module-01/pump-duty">…</main>
       - unexpected value "110"

```

```yaml
- main:
  - link "NEPTUNE v2":
    - /url: ./
  - navigation "Workspaces"
  - button "Evidence"
  - link "Legacy v0.1":
    - /url: "?legacy=1"
  - text: Design-stage digital twin · Simulated operation reference-v2-bcb507c9 · 1 world unit = 1 m
  - complementary
  - text: FACILITY / DIMENSIONED MODEL
  - strong: 1 modules · 40 exact racks
  - 'img "Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits."'
  - text: "1 UNIT = 1 m 1 / 1 modules LOD: 40 racks · 160 nodes · 1 selected module — Technical coolant — Seawater — Power — Network"
  - button "X-ray"
  - button "Explode"
  - button "Dimensions"
  - button "Cooling close-up"
  - button "Inside module"
  - button "Campus view"
  - button "Plan"
  - text: Provisioned
  - strong: 1,280
  - text: 160 whole servers Facility draw
  - strong: 1.78 MW
  - text: IT + cooling + conversion Workload available
  - strong: 1,280
  - text: 1,280 energized Bulk coolant
  - strong: 29.37 °C
  - text: Maximum modeled module
  - button "Start"
  - strong: 110s
  - text: Speed
  - combobox "Simulation speed"
  - button "Step 10s"
  - button "Reset state"
  - button "Replay"
  - text: Replay to
  - spinbutton "Replay time in seconds": "86400"
  - text: s
  - button "Seek time"
  - text: Paused · fixed 1s steps
  - status: "Checkpoint saved locally at 110s. Progress after this checkpoint may be lost on interruption. Last successful local checkpoint: 110s."
  - text: trip recorded at 10s for platform-001/module-01/pump-duty.
  - button "Dismiss notice"
  - text: Bulk coolant · actual model samples 17–47 °C
  - img "Bulk coolant temperature trend over simulated time"
  - text: 10s 110s · no interpolation of physical fields
  - complementary
  - text: Arhaan Aggarwal · Calibration / physical validation pending Import project
  - combobox "Export artifact"
```

# Test source

```ts
  65  |   await expect.poll(async()=>technicalFlow(await page.getByTestId('selected-flow').innerText())).toBe(0);
  66  |   const before=await page.getByTestId('twin-temperature').innerText();await step(page,10);
  67  |   await expect(page.getByTestId('twin-temperature')).not.toHaveText(before);
  68  |   await expect(page.locator('.twin-log')).toContainText(selected);
  69  |   await expect(page.locator('.twin-warnings')).toContainText('Technical coolant flow lost');
  70  |   await screenshot(page,info,'specific-pump-trip');
  71  |   await page.getByRole('button',{name:'Restore selected asset',exact:true}).click();
  72  |   await expect.poll(()=>inspectorStatus(page)).toContain('starting');await step(page,10);
  73  |   await expect.poll(()=>inspectorStatus(page)).toContain('running');
  74  |   expect(technicalFlow(await page.getByTestId('selected-flow').innerText())).toBeGreaterThan(1);
  75  |   const results=await exportArtifact(page,'results');
  76  |   await page.getByRole('button',{name:'Replay',exact:true}).click();
  77  |   await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  78  |   await expect(main(page)).toHaveAttribute('data-time','20');
  79  |   expect(await exportArtifact(page,'results')).toBe(results);
  80  |   const project=JSON.parse(await exportArtifact(page,'project'));
  81  |   expect(project.events.filter((e:{kind:string})=>e.kind==='trip')).toEqual([expect.objectContaining({assetId:selected,timeS:0})]);
  82  |   expect(project.events.filter((e:{kind:string})=>e.kind==='restore')).toEqual([expect.objectContaining({assetId:selected,timeS:10})]);
  83  |   expect(errors).toEqual([]);
  84  | });
  85  | 
  86  | test('standby transfer is an actual selected-component state transition',async({page},info)=>{
  87  |   const errors=observeErrors(page);await load(page);await page.getByRole('button',{name:'Operate',exact:true}).click();
  88  |   await page.getByRole('button',{name:'Full load',exact:true}).click();await step(page,10);
  89  |   await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();
  90  |   await expect.poll(async()=>technicalFlow(await page.getByTestId('selected-flow').innerText())).toBe(0);
  91  |   await page.getByLabel('Select equipment',{exact:true}).selectOption('platform-001/module-01/pump-standby');
  92  |   await expect.poll(()=>inspectorStatus(page)).toContain('starting');await step(page,10);
  93  |   await expect.poll(()=>inspectorStatus(page)).toContain('running');
  94  |   expect(technicalFlow(await page.getByTestId('selected-flow').innerText())).toBeGreaterThan(1);
  95  |   await expect(page.locator('.twin-log')).toContainText('Standby startup delay elapsed');
  96  |   await screenshot(page,info,'standby-transfer');expect(errors).toEqual([]);
  97  | });
  98  | 
  99  | test('clock pause and speed are independent of design resets and validated controls',async({page})=>{
  100 |   const errors=observeErrors(page);await load(page);
  101 |   await page.getByLabel('Simulation speed',{exact:true}).selectOption('20');
  102 |   await page.getByRole('button',{name:'Start',exact:true}).click();
  103 |   await expect.poll(async()=>Number(await main(page).getAttribute('data-time'))).toBeGreaterThanOrEqual(20);
  104 |   await page.getByRole('button',{name:'Pause',exact:true}).click();
  105 |   const paused=await main(page).getAttribute('data-time');await page.waitForTimeout(1200);
  106 |   await expect(main(page)).toHaveAttribute('data-time',paused!);
  107 |   await changeNumber(page,'Requested accelerators','1280');await expect(main(page)).toHaveAttribute('data-time','0');
  108 |   await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible();
  109 |   await expect(page.locator('.twin-notice')).toContainText('reinitialized');
  110 |   const requested=page.getByRole('spinbutton',{name:'Requested accelerators',exact:true});
  111 |   await requested.fill('-1');await requested.press('Enter');await expect(requested).toHaveValue('1280');
  112 |   await expect(page.getByRole('alert')).toContainText('Use 8');expect(errors).toEqual([]);
  113 | });
  114 | 
  115 | test('seek backward and forward restores exact event-boundary numerical results',async({page},info)=>{
  116 |   const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  117 |   const initial=await exportArtifact(page,'results');
  118 |   await step(page,10);await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();
  119 |   await expect.poll(()=>inspectorStatus(page)).toContain('failed');
  120 |   const tripped=await exportArtifact(page,'results');
  121 |   await step(page,10);await page.getByRole('button',{name:'Restore selected asset',exact:true}).click();
  122 |   await expect.poll(()=>inspectorStatus(page)).toContain('starting');
  123 |   const restoring=await exportArtifact(page,'results');await step(page,10);
  124 |   const recovered=await exportArtifact(page,'results');
  125 |   const target=page.getByRole('spinbutton',{name:'Replay time in seconds',exact:true});
  126 |   const seek=async(timeS:number,expected:string)=>{
  127 |     await target.fill(String(timeS));await page.getByRole('button',{name:'Seek time',exact:true}).click();
  128 |     await expect(main(page)).toHaveAttribute('data-time',String(timeS));
  129 |     await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  130 |     expect(await exportArtifact(page,'results')).toBe(expected);
  131 |   };
  132 |   await seek(10,tripped);await expect.poll(()=>inspectorStatus(page)).toContain('failed');
  133 |   const historical=JSON.parse(await exportArtifact(page,'project'));
  134 |   expect(historical.timeS).toBe(10);
  135 |   expect(historical.events).toContainEqual(expect.objectContaining({kind:'restore',assetId:pump,timeS:20}));
  136 |   await seek(0,initial);await seek(20,restoring);await expect.poll(()=>inspectorStatus(page)).toContain('starting');
  137 |   await seek(30,recovered);await expect.poll(()=>inspectorStatus(page)).toContain('running');
  138 |   await target.fill('86401');await expect(page.getByRole('button',{name:'Seek time',exact:true})).toBeEnabled();
  139 |   for(const invalid of ['-1','0.5',String(CONTRACT.horizonS+1)]){
  140 |     await target.fill(invalid);await expect(page.getByRole('button',{name:'Seek time',exact:true})).toBeDisabled();
  141 |     await expect(main(page)).toHaveAttribute('data-time','30');
  142 |   }
  143 |   await target.fill('30');await screenshot(page,info,'seek-exact-replay');expect(errors).toEqual([]);
  144 | });
  145 | 
  146 | test('cancel run retains completed state and superseding work rejects stale updates',async({page},info)=>{
  147 |   const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  148 |   await step(page,10);await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();await step(page,10);
  149 |   const completed=await exportArtifact(page,'results'),project=JSON.parse(await exportArtifact(page,'project'));
  150 |   await page.getByRole('spinbutton',{name:'Replay time in seconds',exact:true}).fill('86400');
  151 |   await page.getByRole('button',{name:'Seek time',exact:true}).click();
  152 |   const cancel=page.getByRole('button',{name:'Cancel run',exact:true});await expect(cancel).toBeVisible();
  153 |   await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeDisabled();
  154 |   await cancel.focus();await page.keyboard.press('Enter');
  155 |   await expect(page.locator('.twin-notice')).toContainText('Run cancelled. The last completed numerical state is retained.');
  156 |   await expect(cancel).toHaveCount(0);
  157 |   const retained=Number(await main(page).getAttribute('data-time'));
  158 |   expect(retained).toBeGreaterThanOrEqual(0);expect(retained).toBeLessThan(86400);
  159 |   const checkpoint=JSON.parse(await exportArtifact(page,'project'));
  160 |   expect(checkpoint.timeS).toBe(retained);expect(checkpoint.checkpoint.state.timeS).toBe(retained);
  161 |   expect(JSON.parse(await exportArtifact(page,'project')).events).toEqual(project.events);
  162 |   // A new physical step must finish without waiting for the cancelled 24-hour replay.
  163 |   await step(page,10);const newer=await exportArtifact(page,'results');
  164 |   await expect(page.locator('.twin-notice')).not.toContainText('Run cancelled');
> 165 |   await page.waitForTimeout(1200);await expect(main(page)).toHaveAttribute('data-time',String(retained+10));
      |                                                            ^ Error: expect(locator).toHaveAttribute(expected) failed
  166 |   expect(await exportArtifact(page,'results')).toBe(newer);
  167 |   await page.getByRole('spinbutton',{name:'Replay time in seconds',exact:true}).fill('20');
  168 |   await page.getByRole('button',{name:'Seek time',exact:true}).click();
  169 |   await expect(main(page)).toHaveAttribute('data-time','20');await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  170 |   expect(await exportArtifact(page,'results')).toBe(completed);
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
```
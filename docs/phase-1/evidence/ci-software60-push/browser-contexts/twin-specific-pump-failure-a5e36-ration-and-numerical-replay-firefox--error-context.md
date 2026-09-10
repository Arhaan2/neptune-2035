# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: twin.spec.ts >> specific pump failure propagates to flow, clock, thermal state, restoration and numerical replay
- Location: tests/browser/twin.spec.ts:50:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Full load', exact: true })
    - locator resolved to <button>Full load</button>
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
    - link "NEPTUNE v2" [ref=e5] [cursor=pointer]:
      - /url: ./
    - navigation "Workspaces" [ref=e11]:
      - button "Explore" [ref=e12] [cursor=pointer]
      - button "Operate" [active] [ref=e13] [cursor=pointer]
      - button "Compare" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - button "Evidence" [ref=e16] [cursor=pointer]
      - link "Legacy v0.1" [ref=e20] [cursor=pointer]:
        - /url: "?legacy=1"
  - generic [ref=e21]:
    - generic [ref=e22]: Design-stage digital twin · Simulated operation
    - generic [ref=e24]: reference-v2-f0f951c0 · 1 world unit = 1 m
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
          - option "No standby" [selected]
          - option "One standby / module"
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
          - treeitem "module-01 40 racks" [ref=e56] [cursor=pointer]:
            - text: module-01
            - generic [ref=e61]: 40 racks
          - treeitem "module-02 40 racks" [selected] [ref=e62] [cursor=pointer]:
            - text: module-02
            - generic [ref=e67]: 40 racks
          - treeitem "module-03 40 racks" [ref=e68] [cursor=pointer]:
            - text: module-03
            - generic [ref=e73]: 40 racks
          - treeitem "module-04 40 racks" [ref=e74] [cursor=pointer]:
            - text: module-04
            - generic [ref=e79]: 40 racks
        - generic [ref=e80]:
          - text: Exact equipment
          - combobox "Select equipment" [ref=e81] [cursor=pointer]:
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
        - generic [ref=e82]:
          - textbox "Find asset ID" [ref=e83]:
            - /placeholder: Resolve exact asset ID
          - button "Find" [ref=e84] [cursor=pointer]
    - generic [ref=e85]:
      - generic [ref=e86]:
        - generic:
          - generic: INSPECT / PUMP
          - strong: platform-001/module-02/pump-duty
        - generic [ref=e87]:
          - generic [ref=e88]:
            - 'img "Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits." [ref=e90]'
            - generic:
              - generic:
                - generic: pump duty
                - text: platform-001/module-02/pump-duty
          - generic:
            - generic: 1 UNIT = 1 m
            - generic: 8 / 8 modules
            - generic: "LOD: 40 racks · 160 nodes · 1 selected module"
          - generic "Connection colors":
            - generic: — Technical coolant
            - generic: — Seawater
            - generic: — Power
            - generic: — Network
        - generic "Scene controls" [ref=e91]:
          - button "X-ray" [ref=e92] [cursor=pointer]
          - button "Explode" [ref=e97] [cursor=pointer]
          - button "Dimensions" [ref=e98] [cursor=pointer]
          - button "Cooling close-up" [ref=e99] [cursor=pointer]
          - button "Inside module" [ref=e103] [cursor=pointer]
          - button "Campus view" [ref=e104] [cursor=pointer]
          - button "Plan" [ref=e108] [cursor=pointer]
      - generic [ref=e109]:
        - generic [ref=e110]:
          - generic [ref=e111]: Provisioned
          - strong [ref=e112]: 10,000
          - text: 1250 whole servers
        - generic [ref=e113]:
          - generic [ref=e114]: Facility draw
          - strong [ref=e115]: 13.94 MW
          - text: IT + cooling + conversion
        - generic [ref=e116]:
          - generic [ref=e117]: Workload available
          - strong [ref=e118]: 10,000
          - text: 10,000 energized
        - generic [ref=e119]:
          - generic [ref=e120]: Bulk coolant
          - strong [ref=e121]: 30 °C
          - text: Maximum modeled module
      - generic [ref=e122]:
        - button "Start" [ref=e123] [cursor=pointer]
        - strong [ref=e126]: 0s
        - generic [ref=e127]:
          - text: Speed
          - combobox "Simulation speed" [ref=e128] [cursor=pointer]:
            - option "1×" [selected]
            - option "5×"
            - option "20×"
            - option "60×"
        - button "Step 10s" [ref=e129] [cursor=pointer]
        - button "Reset state" [ref=e130] [cursor=pointer]
        - button "Replay" [ref=e131] [cursor=pointer]
        - generic [ref=e132]:
          - text: Replay to
          - spinbutton "Replay time in seconds" [ref=e133]: "0"
          - text: s
        - button "Seek time" [ref=e134] [cursor=pointer]
        - generic [ref=e135]: Paused · fixed 1s steps
      - status [ref=e136]: "Checkpoint saved locally at 0s. Progress after this checkpoint may be lost on interruption. Last successful local checkpoint: 0s."
      - generic [ref=e137]:
        - text: Design revision changed. Clock, stored energy and thermal state reinitialized; simulation paused.
        - button "Dismiss notice" [ref=e138] [cursor=pointer]
      - generic [ref=e142]:
        - generic [ref=e143]:
          - generic [ref=e144]: Bulk coolant · actual model samples
          - generic [ref=e145]: 17–47 °C
        - img "Bulk coolant temperature trend over simulated time" [ref=e146]
        - generic [ref=e148]:
          - generic [ref=e149]: 0s
          - generic [ref=e150]: 0s · no interpolation of physical fields
    - complementary [ref=e151]:
      - generic [ref=e152]: OPERATE / SELECTED ASSET
      - heading "pump duty" [level=2] [ref=e153]
      - code [ref=e154]: platform-001/module-02/pump-duty
      - generic [ref=e155]: running · simulated
      - generic [ref=e156]:
        - term [ref=e157]: Envelope (W × H × D)
        - definition [ref=e158]: 1.2 × 1.2 × 0.8 m
        - term [ref=e159]: Operational mass
        - definition [ref=e160]: 180 kg
        - term [ref=e161]: Catalog / evidence
        - definition [ref=e162]: equipment-v2 · assumed
        - term [ref=e163]: Failure domain
        - definition [ref=e164]:
          - button "shore/bus" [ref=e165] [cursor=pointer]
      - group [ref=e166]:
        - generic "Ratings and ports" [ref=e167] [cursor=pointer]
      - heading "Module operating point" [level=3] [ref=e168]
      - generic [ref=e169]:
        - term [ref=e170]: Technical / seawater flow
        - definition [ref=e171]: 59.69 / 66.37 L/s
        - term [ref=e172]: Hydraulic pressure
        - definition [ref=e173]: 160.9 kPa
        - term [ref=e174]: Coolant / residual air
        - definition [ref=e175]: 30 / 25 °C
        - term [ref=e176]: Stored battery energy
        - definition [ref=e177]: 400 kWh
        - term [ref=e178]: Instantaneous / energy PUE
        - definition [ref=e179]: 1.081 / Undefined
      - generic [ref=e180]:
        - button "Trip selected asset" [ref=e181] [cursor=pointer]
        - button "Restore selected asset" [ref=e182] [cursor=pointer]
        - button "Inspect duty pump" [ref=e183] [cursor=pointer]
      - heading "Recorded boundary commands" [level=3] [ref=e184]
      - generic [ref=e185]:
        - button "Full load" [ref=e186] [cursor=pointer]
        - button "Seawater 32°C" [ref=e187] [cursor=pointer]
        - button "Foul exchanger" [ref=e188] [cursor=pointer]
        - button "Lose feeder" [ref=e189] [cursor=pointer]
        - button "Restore feeder" [ref=e190] [cursor=pointer]
        - button "Isolate module" [ref=e191] [cursor=pointer]
        - button "Return module" [ref=e192] [cursor=pointer]
        - button "Lose cluster link" [ref=e193] [cursor=pointer]
        - button "Lose external link" [ref=e194] [cursor=pointer]
      - button "Play pump-failure cinematic" [ref=e195] [cursor=pointer]
      - heading "Causal event log" [level=3] [ref=e196]
      - list
      - group [ref=e197]:
        - generic "Supporting paths & connections" [ref=e198] [cursor=pointer]
      - heading "Inspect the evidence" [level=3] [ref=e199]
      - generic [ref=e200]:
        - button "Data & replay" [ref=e201] [cursor=pointer]
        - button "Constraints & sources" [ref=e204] [cursor=pointer]
      - paragraph [ref=e205]: Residuals · electrical 0 W · thermal -0 W · solver 0 msNormalized · electrical 0.00e+0 · thermal -3.34e-17
  - generic [ref=e206]:
    - generic [ref=e207]: Arhaan Aggarwal · Calibration / physical validation pending
    - generic [ref=e208]:
      - generic [ref=e209] [cursor=pointer]: Import project
      - combobox "Export artifact" [ref=e210] [cursor=pointer]:
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
  1   | import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test';
  2   | import fs from 'node:fs/promises';
  3   | import { CONTRACT } from '../../src/twin/persistence/limits';
  4   | 
  5   | const main=(page:Page)=>page.locator('main.twin-app');
  6   | const pump='platform-001/module-01/pump-duty';
  7   | async function load(page:Page,url='./'){
  8   |   await page.emulateMedia({reducedMotion:'reduce'});
  9   |   await page.goto(url);
  10  |   await expect(main(page)).toHaveAttribute('data-ready','true');
  11  |   await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  12  |   await expect(page.getByText('Design-stage digital twin · Simulated operation',{exact:true})).toBeVisible();
  13  | }
  14  | async function step(page:Page,seconds:number){
  15  |   const before=Number(await main(page).getAttribute('data-time'));
  16  |   for(let n=0;n<seconds/10;n++){
  17  |     await page.getByRole('button',{name:'Step 10s',exact:true}).click();
  18  |     await expect(main(page)).toHaveAttribute('data-time',String(before+(n+1)*10));
  19  |     await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  20  |   }
  21  | }
  22  | async function changeNumber(page:Page,label:string,value:string){
  23  |   const input=page.getByRole('spinbutton',{name:label,exact:true});await input.fill(value);await input.press('Enter');
  24  |   await expect(input).toHaveValue(value);await expect(main(page)).toHaveAttribute('data-ready','true');
  25  |   await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  26  | }
  27  | async function textDownload(page:Page,action:()=>Promise<unknown>){
  28  |   const pending=page.waitForEvent('download');await action();const download=await pending,path=await download.path();
  29  |   expect(download.failure?await download.failure():null).toBeNull();
  30  |   if(!path)throw Error('Download did not materialize');return fs.readFile(path,'utf8');
  31  | }
  32  | async function exportArtifact(page:Page,value:string){return textDownload(page,()=>page.getByLabel('Export artifact',{exact:true}).selectOption(value));}
  33  | async function screenshot(page:Page,info:TestInfo,suffix:string){
  34  |   await fs.mkdir('assets/screenshots',{recursive:true});
  35  |   const path=`assets/screenshots/v2-${info.project.name}-${suffix}.png`;await page.screenshot({path,fullPage:true});
  36  |   await info.attach(suffix,{path,contentType:'image/png'});
  37  | }
  38  | function observeErrors(page:Page){
  39  |   const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  40  |   page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  41  |   page.on('response',response=>{if(response.status()>=400)errors.push(`HTTP ${response.status()}: ${response.url()}`);});return errors;
  42  | }
  43  | function technicalFlow(text:string){return Number(text.split('/')[0].trim().replaceAll(',',''));}
  44  | async function inspectorStatus(page:Page){return page.locator('.twin-inspector > .twin-tag').innerText();}
  45  | async function diagnostics(page:Page){return page.evaluate(()=>window.__NEPTUNE_TWIN_SCENE__);}
  46  | async function frameCadence(page:Page){return page.evaluate(()=>new Promise<{samples:number,medianIntervalMs:number,p95IntervalMs:number}>(resolve=>{
  47  |   const times:number[]=[];let prior=0;const frame=(now:number)=>{if(prior)times.push(now-prior);prior=now;if(times.length<45)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({samples:times.length,medianIntervalMs:times[22],p95IntervalMs:times[42]});}};requestAnimationFrame(frame);
  48  | }));}
  49  | 
  50  | test('specific pump failure propagates to flow, clock, thermal state, restoration and numerical replay',async({page},info)=>{
  51  |   const errors=observeErrors(page);await load(page);
  52  |   await page.getByLabel('Standby cooling',{exact:true}).selectOption('0');
  53  |   await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  54  |   await page.getByRole('treeitem',{name:/module-02/}).click();
  55  |   const selected='platform-001/module-02/pump-duty';await page.getByLabel('Select equipment',{exact:true}).selectOption(selected);
  56  |   await expect(main(page)).toHaveAttribute('data-selected',selected);
  57  |   await expect(page.locator('.twin-inspector .twin-id')).toHaveText(selected);
  58  |   expect(technicalFlow(await page.getByTestId('selected-flow').innerText())).toBeGreaterThan(1);
  59  |   await expect(page.locator('.twin-path')).toContainText('shore/grid');
  60  |   await expect(page.locator('.twin-connections')).toContainText('technical');
  61  |   await page.getByRole('button',{name:'Operate',exact:true}).click();
> 62  |   await page.getByRole('button',{name:'Full load',exact:true}).click();
      |                                                                ^ Error: locator.click: Test timeout of 60000ms exceeded.
  63  |   await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();
  64  |   await expect.poll(()=>inspectorStatus(page)).toContain('failed');
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
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: twin.spec.ts >> seek backward and forward restores exact event-boundary numerical results
- Location: tests/browser/twin.spec.ts:115:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Seek time', exact: true })
    - locator resolved to <button>Seek time</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

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
    - generic [ref=e24]: reference-v2-bcb507c9 · 1 world unit = 1 m
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
          - spinbutton "Requested accelerators" [ref=e39]: "1280"
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
        - tree "Asset hierarchy" [ref=e55]:
          - treeitem "module-01 40 racks" [selected] [ref=e56] [cursor=pointer]:
            - text: module-01
            - generic [ref=e61]: 40 racks
        - generic [ref=e62]:
          - text: Exact equipment
          - combobox "Select equipment" [ref=e63] [cursor=pointer]:
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
        - generic [ref=e64]:
          - textbox "Find asset ID" [ref=e65]:
            - /placeholder: Resolve exact asset ID
          - button "Find" [ref=e66] [cursor=pointer]
    - generic [ref=e67]:
      - generic [ref=e68]:
        - generic:
          - generic: FACILITY / DIMENSIONED MODEL
          - strong: 1 modules · 40 exact racks
        - generic [ref=e69]:
          - 'img "Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits." [ref=e72]'
          - generic:
            - generic: 1 UNIT = 1 m
            - generic: 1 / 1 modules
            - generic: "LOD: 40 racks · 160 nodes · 1 selected module"
          - generic "Connection colors":
            - generic: — Technical coolant
            - generic: — Seawater
            - generic: — Power
            - generic: — Network
        - generic "Scene controls" [ref=e73]:
          - button "X-ray" [ref=e74] [cursor=pointer]
          - button "Explode" [ref=e79] [cursor=pointer]
          - button "Dimensions" [ref=e80] [cursor=pointer]
          - button "Cooling close-up" [ref=e81] [cursor=pointer]
          - button "Inside module" [ref=e85] [cursor=pointer]
          - button "Campus view" [ref=e86] [cursor=pointer]
          - button "Plan" [ref=e90] [cursor=pointer]
      - generic [ref=e91]:
        - generic [ref=e92]:
          - generic [ref=e93]: Provisioned
          - strong [ref=e94]: 1,280
          - text: 160 whole servers
        - generic [ref=e95]:
          - generic [ref=e96]: Facility draw
          - strong [ref=e97]: 1.78 MW
          - text: IT + cooling + conversion
        - generic [ref=e98]:
          - generic [ref=e99]: Workload available
          - strong [ref=e100]: 1,280
          - text: 1,280 energized
        - generic [ref=e101]:
          - generic [ref=e102]: Bulk coolant
          - strong [ref=e103]: 30.35 °C
          - text: Maximum modeled module
      - generic [ref=e104]:
        - button "Start" [ref=e105] [cursor=pointer]
        - strong [ref=e108]: 20s
        - generic [ref=e109]:
          - text: Speed
          - combobox "Simulation speed" [ref=e110] [cursor=pointer]:
            - option "1×" [selected]
            - option "5×"
            - option "20×"
            - option "60×"
        - button "Step 10s" [ref=e111] [cursor=pointer]
        - button "Reset state" [ref=e112] [cursor=pointer]
        - button "Replay" [ref=e113] [cursor=pointer]
        - generic [ref=e114]:
          - text: Replay to
          - spinbutton "Replay time in seconds" [active] [ref=e115]: "30"
          - text: s
        - button "Seek time" [ref=e116] [cursor=pointer]
        - generic [ref=e117]: Paused · fixed 1s steps
      - status [ref=e118]: "Checkpoint saved locally at 20s. Progress after this checkpoint may be lost on interruption. Last successful local checkpoint: 20s."
      - generic [ref=e119]:
        - text: restore recorded at 20s for platform-001/module-01/pump-duty.
        - button "Dismiss notice" [ref=e120] [cursor=pointer]
      - generic [ref=e124]:
        - generic [ref=e125]:
          - generic [ref=e126]: Bulk coolant · actual model samples
          - generic [ref=e127]: 17–47 °C
        - img "Bulk coolant temperature trend over simulated time" [ref=e128]
        - generic [ref=e131]:
          - generic [ref=e132]: 10s
          - generic [ref=e133]: 20s · no interpolation of physical fields
    - complementary [ref=e134]:
      - generic [ref=e135]: EXACT ASSET INSPECTION
      - heading "pump duty" [level=2] [ref=e136]
      - code [ref=e137]: platform-001/module-01/pump-duty
      - generic [ref=e138]: starting · simulated
      - generic [ref=e139]:
        - term [ref=e140]: Envelope (W × H × D)
        - definition [ref=e141]: 1.2 × 1.2 × 0.8 m
        - term [ref=e142]: Operational mass
        - definition [ref=e143]: 180 kg
        - term [ref=e144]: Catalog / evidence
        - definition [ref=e145]: equipment-v2 · assumed
        - term [ref=e146]: Failure domain
        - definition [ref=e147]:
          - button "shore/bus" [ref=e148] [cursor=pointer]
      - group [ref=e149]:
        - generic "Ratings and ports" [ref=e150] [cursor=pointer]
      - heading "Module operating point" [level=3] [ref=e151]
      - generic [ref=e152]:
        - term [ref=e153]: Technical / seawater flow
        - definition [ref=e154]: 59.69 / 66.34 L/s
        - term [ref=e155]: Hydraulic pressure
        - definition [ref=e156]: 160.9 kPa
        - term [ref=e157]: Coolant / residual air
        - definition [ref=e158]: 30.35 / 25.45 °C
        - term [ref=e159]: Stored battery energy
        - definition [ref=e160]: 400 kWh
        - term [ref=e161]: Instantaneous / energy PUE
        - definition [ref=e162]: 1.08 / 1.077
      - generic [ref=e163]:
        - button "Trip selected asset" [ref=e164] [cursor=pointer]
        - button "Restore selected asset" [ref=e165] [cursor=pointer]
        - button "Inspect duty pump" [ref=e166] [cursor=pointer]
      - group [ref=e167]:
        - generic "Supporting paths & connections" [ref=e168] [cursor=pointer]
        - generic [ref=e169]:
          - generic [ref=e170]:
            - button "platform-001/module-01/battery" [ref=e171] [cursor=pointer]
            - generic [ref=e172]: ↓ 2,200 kW capacity
            - button "platform-001/module-01/distribution" [ref=e173] [cursor=pointer]
          - generic [ref=e174]:
            - button "shore/bus" [ref=e175] [cursor=pointer]
            - generic [ref=e176]: ↓ 2,200 kW capacity
            - button "platform-001/module-01/battery" [ref=e177] [cursor=pointer]
          - generic [ref=e178]:
            - button "shore/transformer" [ref=e179] [cursor=pointer]
            - generic [ref=e180]: ↓ 30,000 kW capacity
            - button "shore/bus" [ref=e181] [cursor=pointer]
          - generic [ref=e182]:
            - button "shore/grid" [ref=e183] [cursor=pointer]
            - generic [ref=e184]: ↓ 30,000 kW capacity
            - button "shore/transformer" [ref=e185] [cursor=pointer]
        - generic [ref=e186]:
          - button "power → platform-001/module-01/distribution" [ref=e187] [cursor=pointer]:
            - generic [ref=e188]: power →
            - text: platform-001/module-01/distribution
          - button "technical → platform-001/module-01/pipe-tech" [ref=e189] [cursor=pointer]:
            - generic [ref=e190]: technical →
            - text: platform-001/module-01/pipe-tech
          - button "technical → platform-001/module-01/valve-tech" [ref=e191] [cursor=pointer]:
            - generic [ref=e192]: technical →
            - text: platform-001/module-01/valve-tech
        - paragraph [ref=e193]: Technical coolant and seawater exchange heat across the HX; fluids do not mix. Colored paths are connectivity, not CFD.
      - heading "Inspect the evidence" [level=3] [ref=e194]
      - generic [ref=e195]:
        - button "Data & replay" [ref=e196] [cursor=pointer]
        - button "Constraints & sources" [ref=e199] [cursor=pointer]
      - paragraph [ref=e200]: Residuals · electrical 0 W · thermal -0 W · solver 27 msNormalized · electrical 0.00e+0 · thermal -8.16e-17
  - generic [ref=e201]:
    - generic [ref=e202]: Arhaan Aggarwal · Calibration / physical validation pending
    - generic [ref=e203]:
      - generic [ref=e204] [cursor=pointer]: Import project
      - combobox "Export artifact" [ref=e205] [cursor=pointer]:
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
  62  |   await page.getByRole('button',{name:'Full load',exact:true}).click();
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
> 127 |     await target.fill(String(timeS));await page.getByRole('button',{name:'Seek time',exact:true}).click();
      |                                                                                                   ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  165 |   await page.waitForTimeout(1200);await expect(main(page)).toHaveAttribute('data-time',String(retained+10));
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
```
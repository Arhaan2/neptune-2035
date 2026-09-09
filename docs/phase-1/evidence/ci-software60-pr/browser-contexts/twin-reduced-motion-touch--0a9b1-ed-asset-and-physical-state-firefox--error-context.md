# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: twin.spec.ts >> reduced-motion touch acceptance >> touch waypoints and keyboard exit preserve exact selected asset and physical state
- Location: tests/browser/twin.spec.ts:176:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "cooling"
Received: undefined

Call Log:
- Timeout 12000ms exceeded while waiting on the predicate
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
  - generic [ref=e15]: Design-stage digital twin · Simulated operation
  - generic [ref=e18]:
    - complementary [ref=e19]:
      - generic [ref=e20]: REFERENCE DESIGN / 01
      - heading "NEPTUNE I" [level=1] [ref=e21]
      - paragraph [ref=e22]: Shore-connected pilot
      - generic [ref=e23]:
        - button "Design family I" [ref=e24] [cursor=pointer]: I
        - button "Design family II" [ref=e25] [cursor=pointer]: II
        - button "Design family III" [ref=e26] [cursor=pointer]: III
      - generic [ref=e27]:
        - text: Starting scenario
        - combobox "Starting scenario" [ref=e28] [cursor=pointer]:
          - option "Choose capacity…" [disabled] [selected]
          - option "10,000 accelerator pilot"
          - option "100,000 campus"
          - option "500,000 archipelago"
          - option "1,000,000 bounded scale test"
      - generic [ref=e29]:
        - generic [ref=e30]: Requested accelerators
        - generic [ref=e31]:
          - spinbutton "Requested accelerators" [ref=e32]: "10000"
          - generic [ref=e33]: units
      - generic [ref=e34]:
        - generic [ref=e35]: Supply ceiling
        - generic [ref=e36]:
          - spinbutton "Supply ceiling" [ref=e37]: "30"
          - generic [ref=e38]: MW
      - generic [ref=e39]:
        - generic [ref=e40]: Standby cooling
        - combobox "Standby cooling" [ref=e41] [cursor=pointer]:
          - option "No standby"
          - option "One standby / module" [selected]
      - group [ref=e42]:
        - generic "Design assumptions" [ref=e43] [cursor=pointer]
      - generic [ref=e44]:
        - heading "Asset hierarchy" [level=2] [ref=e45]
        - generic [ref=e46]:
          - text: Platform
          - combobox "Select platform" [ref=e47] [cursor=pointer]:
            - option "platform-001" [selected]
            - option "platform-002"
        - tree "Asset hierarchy" [ref=e48]:
          - treeitem "module-01 40 racks" [selected] [ref=e49] [cursor=pointer]:
            - text: module-01
            - generic [ref=e54]: 40 racks
          - treeitem "module-02 40 racks" [ref=e55] [cursor=pointer]:
            - text: module-02
            - generic [ref=e60]: 40 racks
          - treeitem "module-03 40 racks" [ref=e61] [cursor=pointer]:
            - text: module-03
            - generic [ref=e66]: 40 racks
          - treeitem "module-04 40 racks" [ref=e67] [cursor=pointer]:
            - text: module-04
            - generic [ref=e72]: 40 racks
        - generic [ref=e73]:
          - text: Exact equipment
          - combobox "Select equipment" [ref=e74] [cursor=pointer]:
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
        - generic [ref=e75]:
          - textbox "Find asset ID" [ref=e76]:
            - /placeholder: Resolve exact asset ID
          - button "Find" [ref=e77] [cursor=pointer]
    - generic [ref=e78]:
      - generic [ref=e79]:
        - generic:
          - generic: INSPECT / PUMP
          - strong: platform-001/module-01/pump-duty
        - generic [ref=e80]:
          - generic [ref=e81]:
            - 'img "Dimensioned offshore facility. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom. In interior: WASD moves, drag looks, Escape exits." [ref=e83]'
            - generic: pump duty
          - generic:
            - generic: 1 UNIT = 1 m
            - generic: 8 / 8 modules
            - generic: "LOD: 40 racks · 160 nodes · 1 selected module"
          - generic "Connection colors":
            - generic: — Technical coolant
            - generic: — Seawater
            - generic: — Power
            - generic: — Network
        - generic "Scene controls" [ref=e84]:
          - button "X-ray" [pressed] [ref=e85] [cursor=pointer]
          - button "Explode" [ref=e90] [cursor=pointer]
          - button "Dimensions" [ref=e91] [cursor=pointer]
          - button "Cooling close-up" [active] [ref=e92] [cursor=pointer]
          - button "Inside module" [ref=e96] [cursor=pointer]
          - button "Campus view" [ref=e97] [cursor=pointer]
          - button "Plan" [ref=e101] [cursor=pointer]
      - generic [ref=e102]:
        - generic [ref=e103]:
          - generic [ref=e104]: Provisioned
          - strong [ref=e105]: 10,000
          - text: 1250 whole servers
        - generic [ref=e106]:
          - generic [ref=e107]: Facility draw
          - strong [ref=e108]: 13.94 MW
          - text: IT + cooling + conversion
        - generic [ref=e109]:
          - generic [ref=e110]: Workload available
          - strong [ref=e111]: 10,000
          - text: 10,000 energized
        - generic [ref=e112]:
          - generic [ref=e113]: Bulk coolant
          - strong [ref=e114]: 30 °C
          - text: Maximum modeled module
      - generic [ref=e115]:
        - button "Start" [ref=e116] [cursor=pointer]
        - strong [ref=e119]: 0s
        - generic [ref=e120]:
          - text: Speed
          - combobox "Simulation speed" [ref=e121] [cursor=pointer]:
            - option "1×" [selected]
            - option "5×"
            - option "20×"
            - option "60×"
        - button "Step 10s" [ref=e122] [cursor=pointer]
        - button "Reset state" [ref=e123] [cursor=pointer]
        - button "Replay" [ref=e124] [cursor=pointer]
        - generic [ref=e125]:
          - text: Replay to
          - spinbutton "Replay time in seconds" [ref=e126]: "0"
          - text: s
        - button "Seek time" [ref=e127] [cursor=pointer]
      - status [ref=e128]: "Checkpoint saved locally at 0s. Progress after this checkpoint may be lost on interruption. Last successful local checkpoint: 0s."
      - generic [ref=e129]:
        - generic [ref=e130]:
          - generic [ref=e131]: Bulk coolant · actual model samples
          - generic [ref=e132]: 17–47 °C
        - img "Bulk coolant temperature trend over simulated time" [ref=e133]
        - generic [ref=e135]:
          - generic [ref=e136]: 0s
          - generic [ref=e137]: 0s · no interpolation of physical fields
    - complementary [ref=e138]:
      - generic [ref=e139]: EXACT ASSET INSPECTION
      - heading "pump duty" [level=2] [ref=e140]
      - code [ref=e141]: platform-001/module-01/pump-duty
      - generic [ref=e142]: running · simulated
      - generic [ref=e143]:
        - term [ref=e144]: Envelope (W × H × D)
        - definition [ref=e145]: 1.2 × 1.2 × 0.8 m
        - term [ref=e146]: Operational mass
        - definition [ref=e147]: 180 kg
        - term [ref=e148]: Catalog / evidence
        - definition [ref=e149]: equipment-v2 · assumed
        - term [ref=e150]: Failure domain
        - definition [ref=e151]:
          - button "shore/bus" [ref=e152] [cursor=pointer]
      - group [ref=e153]:
        - generic "Ratings and ports" [ref=e154] [cursor=pointer]
      - heading "Module operating point" [level=3] [ref=e155]
      - generic [ref=e156]:
        - term [ref=e157]: Technical / seawater flow
        - definition [ref=e158]: 59.69 / 66.37 L/s
        - term [ref=e159]: Hydraulic pressure
        - definition [ref=e160]: 160.9 kPa
        - term [ref=e161]: Coolant / residual air
        - definition [ref=e162]: 30 / 25 °C
        - term [ref=e163]: Stored battery energy
        - definition [ref=e164]: 400 kWh
        - term [ref=e165]: Instantaneous / energy PUE
        - definition [ref=e166]: 1.081 / Undefined
      - generic [ref=e167]:
        - button "Trip selected asset" [ref=e168] [cursor=pointer]
        - button "Restore selected asset" [ref=e169] [cursor=pointer]
        - button "Inspect duty pump" [ref=e170] [cursor=pointer]
      - group [ref=e171]:
        - generic "Supporting paths & connections" [ref=e172] [cursor=pointer]
        - generic [ref=e173]:
          - generic [ref=e174]:
            - button "platform-001/module-01/battery" [ref=e175] [cursor=pointer]
            - generic [ref=e176]: ↓ 2,200 kW capacity
            - button "platform-001/module-01/distribution" [ref=e177] [cursor=pointer]
          - generic [ref=e178]:
            - button "shore/bus" [ref=e179] [cursor=pointer]
            - generic [ref=e180]: ↓ 2,200 kW capacity
            - button "platform-001/module-01/battery" [ref=e181] [cursor=pointer]
          - generic [ref=e182]:
            - button "shore/transformer" [ref=e183] [cursor=pointer]
            - generic [ref=e184]: ↓ 30,000 kW capacity
            - button "shore/bus" [ref=e185] [cursor=pointer]
          - generic [ref=e186]:
            - button "shore/grid" [ref=e187] [cursor=pointer]
            - generic [ref=e188]: ↓ 30,000 kW capacity
            - button "shore/transformer" [ref=e189] [cursor=pointer]
        - generic [ref=e190]:
          - button "power → platform-001/module-01/distribution" [ref=e191] [cursor=pointer]:
            - generic [ref=e192]: power →
            - text: platform-001/module-01/distribution
          - button "technical → platform-001/module-01/pipe-tech" [ref=e193] [cursor=pointer]:
            - generic [ref=e194]: technical →
            - text: platform-001/module-01/pipe-tech
          - button "technical → platform-001/module-01/valve-tech" [ref=e195] [cursor=pointer]:
            - generic [ref=e196]: technical →
            - text: platform-001/module-01/valve-tech
        - paragraph [ref=e197]: Technical coolant and seawater exchange heat across the HX; fluids do not mix. Colored paths are connectivity, not CFD.
      - heading "Inspect the evidence" [level=3] [ref=e198]
      - generic [ref=e199]:
        - button "Data & replay" [ref=e200] [cursor=pointer]
        - button "Constraints & sources" [ref=e203] [cursor=pointer]
      - paragraph [ref=e204]: Residuals · electrical 0 W · thermal -0 W · solver 0 msNormalized · electrical 0.00e+0 · thermal -3.34e-17
  - generic [ref=e205]:
    - generic [ref=e206]: Arhaan Aggarwal · Calibration / physical validation pending
    - generic [ref=e207]:
      - generic [ref=e208] [cursor=pointer]: Import project
      - combobox "Export artifact" [ref=e209] [cursor=pointer]:
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
> 181 |     await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('cooling');
      |                                                                  ^ Error: expect(received).toBe(expected) // Object.is equality
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
  271 |   await page.getByRole('button',{name:'Design family II',exact:true}).click();await expect(page.getByRole('heading',{name:'NEPTUNE II',exact:true})).toBeVisible();
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
```
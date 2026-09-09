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
```

# Test source

```ts
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
> 258 |   await page.getByRole('button',{name:'Inside module',exact:true}).click();await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(true);
      |                                                                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
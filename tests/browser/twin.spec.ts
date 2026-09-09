import { test, expect, type Page, type TestInfo, type Locator } from '@playwright/test';
import fs from 'node:fs/promises';
import { CONTRACT } from '../../src/twin/persistence/limits';

const main=(page:Page)=>page.locator('main.twin-app');
const pump='platform-001/module-01/pump-duty';
async function load(page:Page,url='./'){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(url);
  await expect(main(page)).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  await expect(page.getByText('Design-stage digital twin · Simulated operation',{exact:true})).toBeVisible();
}
async function step(page:Page,seconds:number){
  const before=Number(await main(page).getAttribute('data-time'));
  for(let n=0;n<seconds/10;n++){
    await page.getByRole('button',{name:'Step 10s',exact:true}).click();
    await expect(main(page)).toHaveAttribute('data-time',String(before+(n+1)*10));
    await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  }
}
async function changeNumber(page:Page,label:string,value:string){
  const input=page.getByRole('spinbutton',{name:label,exact:true});await input.fill(value);await input.press('Enter');
  await expect(input).toHaveValue(value);await expect(main(page)).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
}
async function textDownload(page:Page,action:()=>Promise<unknown>){
  const pending=page.waitForEvent('download');await action();const download=await pending,path=await download.path();
  expect(download.failure?await download.failure():null).toBeNull();
  if(!path)throw Error('Download did not materialize');return fs.readFile(path,'utf8');
}
async function exportArtifact(page:Page,value:string){return textDownload(page,()=>page.getByLabel('Export artifact',{exact:true}).selectOption(value));}
async function screenshot(page:Page,info:TestInfo,suffix:string){
  await fs.mkdir('assets/screenshots',{recursive:true});
  const path=`assets/screenshots/v2-${info.project.name}-${suffix}.png`;await page.screenshot({path,fullPage:true});
  await info.attach(suffix,{path,contentType:'image/png'});
}
function observeErrors(page:Page){
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)errors.push(`HTTP ${response.status()}: ${response.url()}`);});return errors;
}
function technicalFlow(text:string){return Number(text.split('/')[0].trim().replaceAll(',',''));}
async function inspectorStatus(page:Page){return page.locator('.twin-inspector > .twin-tag').innerText();}
async function diagnostics(page:Page){return page.evaluate(()=>window.__NEPTUNE_TWIN_SCENE__);}
async function frameCadence(page:Page){return page.evaluate(()=>new Promise<{samples:number,medianIntervalMs:number,p95IntervalMs:number}>(resolve=>{
  const times:number[]=[];let prior=0;const frame=(now:number)=>{if(prior)times.push(now-prior);prior=now;if(times.length<45)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({samples:times.length,medianIntervalMs:times[22],p95IntervalMs:times[42]});}};requestAnimationFrame(frame);
}));}

test('specific pump failure propagates to flow, clock, thermal state, restoration and numerical replay',async({page},info)=>{
  const errors=observeErrors(page);await load(page);
  await page.getByLabel('Standby cooling',{exact:true}).selectOption('0');
  await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  await page.getByRole('treeitem',{name:/module-02/}).click();
  const selected='platform-001/module-02/pump-duty';await page.getByLabel('Select equipment',{exact:true}).selectOption(selected);
  await expect(main(page)).toHaveAttribute('data-selected',selected);
  await expect(page.locator('.twin-inspector .twin-id')).toHaveText(selected);
  expect(technicalFlow(await page.getByTestId('selected-flow').innerText())).toBeGreaterThan(1);
  await expect(page.locator('.twin-path')).toContainText('shore/grid');
  await expect(page.locator('.twin-connections')).toContainText('technical');
  await page.getByRole('button',{name:'Operate',exact:true}).click();
  await page.getByRole('button',{name:'Full load',exact:true}).click();
  await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();
  await expect.poll(()=>inspectorStatus(page)).toContain('failed');
  await expect.poll(async()=>technicalFlow(await page.getByTestId('selected-flow').innerText())).toBe(0);
  const before=await page.getByTestId('twin-temperature').innerText();await step(page,10);
  await expect(page.getByTestId('twin-temperature')).not.toHaveText(before);
  await expect(page.locator('.twin-log')).toContainText(selected);
  await expect(page.locator('.twin-warnings')).toContainText('Technical coolant flow lost');
  await screenshot(page,info,'specific-pump-trip');
  await page.getByRole('button',{name:'Restore selected asset',exact:true}).click();
  await expect.poll(()=>inspectorStatus(page)).toContain('starting');await step(page,10);
  await expect.poll(()=>inspectorStatus(page)).toContain('running');
  expect(technicalFlow(await page.getByTestId('selected-flow').innerText())).toBeGreaterThan(1);
  const results=await exportArtifact(page,'results');
  await page.getByRole('button',{name:'Replay',exact:true}).click();
  await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  await expect(main(page)).toHaveAttribute('data-time','20');
  expect(await exportArtifact(page,'results')).toBe(results);
  const project=JSON.parse(await exportArtifact(page,'project'));
  expect(project.events.filter((e:{kind:string})=>e.kind==='trip')).toEqual([expect.objectContaining({assetId:selected,timeS:0})]);
  expect(project.events.filter((e:{kind:string})=>e.kind==='restore')).toEqual([expect.objectContaining({assetId:selected,timeS:10})]);
  expect(errors).toEqual([]);
});

test('standby transfer is an actual selected-component state transition',async({page},info)=>{
  const errors=observeErrors(page);await load(page);await page.getByRole('button',{name:'Operate',exact:true}).click();
  await page.getByRole('button',{name:'Full load',exact:true}).click();await step(page,10);
  await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();
  await expect.poll(async()=>technicalFlow(await page.getByTestId('selected-flow').innerText())).toBe(0);
  await page.getByLabel('Select equipment',{exact:true}).selectOption('platform-001/module-01/pump-standby');
  await expect.poll(()=>inspectorStatus(page)).toContain('starting');await step(page,10);
  await expect.poll(()=>inspectorStatus(page)).toContain('running');
  expect(technicalFlow(await page.getByTestId('selected-flow').innerText())).toBeGreaterThan(1);
  await expect(page.locator('.twin-log')).toContainText('Standby startup delay elapsed');
  await screenshot(page,info,'standby-transfer');expect(errors).toEqual([]);
});

test('clock pause and speed are independent of design resets and validated controls',async({page})=>{
  const errors=observeErrors(page);await load(page);
  await page.getByLabel('Simulation speed',{exact:true}).selectOption('20');
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect.poll(async()=>Number(await main(page).getAttribute('data-time'))).toBeGreaterThanOrEqual(20);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const paused=await main(page).getAttribute('data-time');await page.waitForTimeout(1200);
  await expect(main(page)).toHaveAttribute('data-time',paused!);
  await changeNumber(page,'Requested accelerators','1280');await expect(main(page)).toHaveAttribute('data-time','0');
  await expect(page.getByRole('button',{name:'Start',exact:true})).toBeVisible();
  await expect(page.locator('.twin-notice')).toContainText('reinitialized');
  const requested=page.getByRole('spinbutton',{name:'Requested accelerators',exact:true});
  await requested.fill('-1');await requested.press('Enter');await expect(requested).toHaveValue('1280');
  await expect(page.getByRole('alert')).toContainText('Use 8');expect(errors).toEqual([]);
});

test('seek backward and forward restores exact event-boundary numerical results',async({page},info)=>{
  const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  const initial=await exportArtifact(page,'results');
  await step(page,10);await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();
  await expect.poll(()=>inspectorStatus(page)).toContain('failed');
  const tripped=await exportArtifact(page,'results');
  await step(page,10);await page.getByRole('button',{name:'Restore selected asset',exact:true}).click();
  await expect.poll(()=>inspectorStatus(page)).toContain('starting');
  const restoring=await exportArtifact(page,'results');await step(page,10);
  const recovered=await exportArtifact(page,'results');
  const target=page.getByRole('spinbutton',{name:'Replay time in seconds',exact:true});
  const seek=async(timeS:number,expected:string)=>{
    await target.fill(String(timeS));await page.getByRole('button',{name:'Seek time',exact:true}).click();
    await expect(main(page)).toHaveAttribute('data-time',String(timeS));
    await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
    expect(await exportArtifact(page,'results')).toBe(expected);
  };
  await seek(10,tripped);await expect.poll(()=>inspectorStatus(page)).toContain('failed');
  const historical=JSON.parse(await exportArtifact(page,'project'));
  expect(historical.timeS).toBe(10);
  expect(historical.events).toContainEqual(expect.objectContaining({kind:'restore',assetId:pump,timeS:20}));
  await seek(0,initial);await seek(20,restoring);await expect.poll(()=>inspectorStatus(page)).toContain('starting');
  await seek(30,recovered);await expect.poll(()=>inspectorStatus(page)).toContain('running');
  await target.fill('86401');await expect(page.getByRole('button',{name:'Seek time',exact:true})).toBeEnabled();
  for(const invalid of ['-1','0.5',String(CONTRACT.horizonS+1)]){
    await target.fill(invalid);await expect(page.getByRole('button',{name:'Seek time',exact:true})).toBeDisabled();
    await expect(main(page)).toHaveAttribute('data-time','30');
  }
  await target.fill('30');await screenshot(page,info,'seek-exact-replay');expect(errors).toEqual([]);
});

test('cancel run retains completed state and superseding work rejects stale updates',async({page},info)=>{
  const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  await step(page,10);await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();await step(page,10);
  const completed=await exportArtifact(page,'results'),project=JSON.parse(await exportArtifact(page,'project'));
  await page.getByRole('spinbutton',{name:'Replay time in seconds',exact:true}).fill('86400');
  await page.getByRole('button',{name:'Seek time',exact:true}).click();
  const cancel=page.getByRole('button',{name:'Cancel run',exact:true});await expect(cancel).toBeVisible();
  await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeDisabled();
  await cancel.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.twin-notice')).toContainText('Run cancelled. The last completed numerical state is retained.');
  await expect(cancel).toHaveCount(0);
  const retained=Number(await main(page).getAttribute('data-time'));
  expect(retained).toBeGreaterThanOrEqual(0);expect(retained).toBeLessThan(86400);
  const checkpoint=JSON.parse(await exportArtifact(page,'project'));
  expect(checkpoint.timeS).toBe(retained);expect(checkpoint.checkpoint.state.timeS).toBe(retained);
  expect(JSON.parse(await exportArtifact(page,'project')).events).toEqual(project.events);
  // A new physical step must finish without waiting for the cancelled 24-hour replay.
  await step(page,10);const newer=await exportArtifact(page,'results');
  await expect(page.locator('.twin-notice')).not.toContainText('Run cancelled');
  await page.waitForTimeout(1200);await expect(main(page)).toHaveAttribute('data-time',String(retained+10));
  expect(await exportArtifact(page,'results')).toBe(newer);
  await page.getByRole('spinbutton',{name:'Replay time in seconds',exact:true}).fill('20');
  await page.getByRole('button',{name:'Seek time',exact:true}).click();
  await expect(main(page)).toHaveAttribute('data-time','20');await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  expect(await exportArtifact(page,'results')).toBe(completed);
  await screenshot(page,info,'cancel-stale-worker');expect(errors).toEqual([]);
});

test.describe('reduced-motion touch acceptance',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('touch waypoints and keyboard exit preserve exact selected asset and physical state',async({page},info)=>{
    const errors=observeErrors(page);await load(page);
    expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    const before=await exportArtifact(page,'results'),selected=await main(page).getAttribute('data-selected');
    await page.getByRole('button',{name:'Cooling close-up',exact:true}).tap();
    await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('cooling');
    await page.getByRole('button',{name:'Inside module',exact:true}).tap();
    await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(true);
    const entrance=(await diagnostics(page))?.camera;
    await page.getByRole('button',{name:'Rack aisle',exact:true}).tap();
    await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(entrance);
    const aisle=(await diagnostics(page))?.camera;
    await page.getByRole('button',{name:'Cooling bay',exact:true}).tap();
    await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(aisle);
    await expect(main(page)).toHaveAttribute('data-selected',selected!);
    const canvas=page.locator('canvas');await canvas.focus();const target=(await diagnostics(page))?.target;
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
    await expect.poll(async()=>(await diagnostics(page))?.target).not.toEqual(target);
    await page.keyboard.press('Escape');await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(false);
    await page.getByRole('button',{name:'Explode',exact:true}).tap();await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(true);
    await page.getByRole('button',{name:'Explode',exact:true}).tap();await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(false);
    await expect(main(page)).toHaveAttribute('data-time','0');expect(await exportArtifact(page,'results')).toBe(before);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await screenshot(page,info,'reduced-motion-touch');expect(errors).toEqual([]);
  });
});

test('comparison renders two computed 240-second runs and exports identical disturbance histories',async({page},info)=>{
  const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.getByRole('button',{name:'Compare pump experiment',exact:true}).click();
  const cards=page.locator('.twin-comparison-grid article');await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole('heading',{level:3})).toHaveText('No standby pump');
  await expect(cards.nth(1).getByRole('heading',{level:3})).toHaveText('One standby pump');
  const temperature=async(card:Locator)=>Number((await card.locator('p').first().innerText()).split('°')[0].replaceAll(',','').trim());
  expect(await temperature(cards.nth(0))).toBeGreaterThan(await temperature(cards.nth(1))+0.5);
  const a=JSON.parse(await textDownload(page,()=>cards.nth(0).getByRole('button',{name:'Export reproducible run',exact:true}).click()));
  const b=JSON.parse(await textDownload(page,()=>cards.nth(1).getByRole('button',{name:'Export reproducible run',exact:true}).click()));
  expect(a.timeS).toBe(240);expect(b.timeS).toBe(240);expect(a.events).toEqual(b.events);
  expect(a.design.standbyPumps).toBe(0);expect(b.design.standbyPumps).toBe(1);
  await expect(page.locator('.twin-delta')).toContainText('at 240s:');
  await screenshot(page,info,'comparison');expect(errors).toEqual([]);
});

test('project exports and imports replay numerical state, with invalid mappings rejected visibly',async({page},info)=>{
  const errors=observeErrors(page);await load(page);await changeNumber(page,'Requested accelerators','1280');
  await step(page,10);await page.getByRole('button',{name:'Trip selected asset',exact:true}).click();await step(page,10);
  const before=await exportArtifact(page,'results'),projectText=await exportArtifact(page,'project'),project=JSON.parse(projectText);
  expect(project.events).toContainEqual(expect.objectContaining({assetId:pump,kind:'trip',timeS:10}));
  await page.getByRole('button',{name:'Reset state',exact:true}).click();await expect(main(page)).toHaveAttribute('data-time','0');
  await page.getByLabel('Import project',{exact:true}).setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(projectText)});
  await expect(main(page)).toHaveAttribute('data-time','20');await expect(page.getByRole('button',{name:'Step 10s',exact:true})).toBeEnabled();
  expect(await exportArtifact(page,'results')).toBe(before);
  const invalid=JSON.stringify({...project,events:[{id:'invalid',timeS:0,kind:'trip',assetId:'unmapped/pump'}]});
  await page.getByLabel('Import project',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(invalid)});
  await expect(page.locator('.twin-notice')).toContainText('Unknown event asset');await expect(main(page)).toHaveAttribute('data-time','20');
  await screenshot(page,info,'project-replay');expect(errors).toEqual([]);
});

test('mobile keyboard and explicit fallback retain asset inspection, operation and exports',async({page},info)=>{
  const errors=observeErrors(page);await page.setViewportSize({width:390,height:844});await load(page,'./?fallback=1');
  await expect(page.getByTestId('twin-fallback')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  const find=page.getByRole('textbox',{name:'Find asset ID',exact:true});await find.fill('platform-001/module-01/rack-02');await find.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected','platform-001/module-01/rack-02');
  await expect(page.locator('.twin-inspector')).toContainText('40 U / 48 U');
  const operate=page.getByRole('button',{name:'Operate',exact:true});await operate.focus();await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-workspace','Operate');await step(page,10);
  const results=await exportArtifact(page,'results');expect(results).toContain('simulatedTimeS');expect(results).toContain('platform-001/module-01');
  await screenshot(page,info,'mobile-fallback');expect(errors).toEqual([]);
});

test('context cameras, keyboard interior, distinct families and bounded large-scene diagnostics',async({page},info)=>{
  const errors=observeErrors(page);await load(page);
  await expect(page.locator('canvas')).toBeVisible();await expect.poll(()=>diagnostics(page)).toBeTruthy();
  const initial=await diagnostics(page);expect(initial?.worldUnitsPerMeter).toBe(1);expect(initial?.renderedModules).toBe(8);
  const initialCadence=await frameCadence(page);
  const canvas=page.locator('canvas');await canvas.focus();await page.keyboard.press('ArrowLeft');
  await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(initial?.camera);
  await page.getByRole('button',{name:'Cooling close-up',exact:true}).click();
  await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('cooling');
  await screenshot(page,info,'cooling-close-up');
  await page.getByRole('button',{name:'Inside module',exact:true}).click();await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(true);
  const inside=(await diagnostics(page))?.camera;await canvas.focus();await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');
  await expect.poll(async()=>(await diagnostics(page))?.camera).not.toEqual(inside);
  await page.keyboard.press('Escape');await expect.poll(async()=>(await diagnostics(page))?.inside).toBe(false);
  const beforeFlow=await page.getByTestId('selected-flow').innerText();
  await page.getByRole('button',{name:'Explode',exact:true}).click();await page.getByRole('button',{name:'Explode',exact:true}).click();
  await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(false);
  const warmed=await diagnostics(page);
  for(let n=0;n<4;n++){await page.getByRole('button',{name:'Explode',exact:true}).click();await page.getByRole('button',{name:'X-ray',exact:true}).click();}
  await page.setViewportSize({width:1200,height:900});await page.setViewportSize({width:1600,height:1050});
  await expect.poll(async()=>(await diagnostics(page))?.exploded).toBe(false);
  const after=await diagnostics(page);expect(after!.geometries).toBeLessThanOrEqual(warmed!.geometries+5);expect(after!.textures).toBeLessThanOrEqual(warmed!.textures+2);
  await expect(page.getByTestId('selected-flow')).toHaveText(beforeFlow);await expect(main(page)).toHaveAttribute('data-time','0');
  await page.getByRole('button',{name:'Design family II',exact:true}).click();await expect(page.getByRole('heading',{name:'NEPTUNE II',exact:true})).toBeVisible();
  await expect(page.locator('.twin-inspector')).toContainText('platform-001/switchboard');
  await page.getByRole('button',{name:'Design family III',exact:true}).click();await expect(page.locator('.twin-inspector')).toContainText('platform-001/segment-feeder');
  await changeNumber(page,'Requested accelerators','1280');await expect.poll(async()=>(await diagnostics(page))?.totalModules).toBe(1);const small=await diagnostics(page),smallCadence=await frameCadence(page);
  await page.getByRole('button',{name:'Campus view',exact:true}).click();
  await expect.poll(async()=>(await diagnostics(page))?.focus).toBe('campus');
  const start=Date.now();await page.getByLabel('Starting scenario',{exact:true}).selectOption('500000');
  await expect.poll(async()=>(await diagnostics(page))?.totalModules,{timeout:20000}).toBe(391);const large=await diagnostics(page),largeInteractionMs=Date.now()-start,largeCadence=await frameCadence(page);
  expect(large?.renderedPlatforms).toBe(98);expect(large?.renderedModules).toBe(large?.totalModules);
  const stepStart=Date.now();await step(page,10);const largeStepResponseMs=Date.now()-stepStart;
  const hardware=await page.evaluate(()=>{
    const gl=document.querySelector('canvas')?.getContext('webgl2'),extension=gl?.getExtension('WEBGL_debug_renderer_info');
    return {userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,renderer:gl&&extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable'};
  });
  await screenshot(page,info,'large-campus');
  await fs.writeFile(`assets/screenshots/v2-${info.project.name}-diagnostics.json`,JSON.stringify({hardware,viewport:page.viewportSize(),initial,initialCadence,warmed,after,small,smallCadence,large,largeCadence,largeInteractionMs,largeStepResponseMs,errors,scope:'Actual tested browser/device only; RAF intervals measure presentation cadence, not GPU benchmark certification or a general laptop-performance claim.'},null,2));
  expect(errors).toEqual([]);
});

test('legacy saved scenario links retain the explicit aggregate model',async({page})=>{
  const errors=observeErrors(page);await page.goto('./?legacy=1');
  await expect(page.locator('main')).toHaveAttribute('data-ready','true');
  await expect(page.getByRole('spinbutton',{name:'Accelerators',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Share scenario',exact:true}).click();
  const link=await page.getByRole('textbox',{name:'Shareable scenario URL',exact:true}).inputValue();
  expect(link).toContain('#s=');
  const legacyURL=new URL(link);legacyURL.searchParams.delete('legacy');await page.goto(legacyURL.href);
  await expect(page.getByRole('spinbutton',{name:'Accelerators',exact:true})).toBeVisible();
  await expect(main(page)).toHaveCount(0);expect(errors).toEqual([]);
});

/**
 * Genuine native Chromium tab visibility. Playwright's active-page emulation
 * keeps its pages visible on this host, so this disposable browser is launched
 * without Playwright attachment and controlled with native CDP pointer input.
 * node scripts/visual-v5/visibility.mjs --url=https://.../ --out=/external/new-dir
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { argument, externalDirectory, hash } from './common.mjs';

const url = argument('url'); assert(url && /^https?:/.test(url), 'Pass a packaged --url.');
const out = await externalDirectory(argument('out'));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'neptune-v5-visibility-profile-'));
const args = ['--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,1000', 'about:blank'];
const receipt = { kind: 'actual-native-chromium-hidden-session', startedAt: new Date().toISOString(), url,
  route: 'Fresh native Chromium profile, direct CDP WebSocket, native Input.dispatchMouseEvent controls, Target.activateTarget switches real tabs. No Playwright attach, focus/visibility overrides, tracing or capture during hidden intervals.',
  browserArguments: args.map(value => value.startsWith('--user-data-dir=') ? '--user-data-dir=<disposable-profile>' : value), samples: [], errors: [] };
const child = spawn(chromium.executablePath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
let socket, send, sessionId;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = '';
    child.stderr.on('data', chunk => { buffer += chunk; const found = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (found) resolve(found[1]); });
    child.on('error', reject); setTimeout(() => reject(Error('No native browser endpoint within 10 seconds.')), 10000).unref();
  });
  socket = new WebSocket(endpoint); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let next = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (request) message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') receipt.errors.push(message.params.exceptionDetails);
  });
  send = (method, params = {}, targetSession) => new Promise((resolve, reject) => {
    const id = ++next; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
  receipt.browser = await send('Browser.getVersion');
  const targets = await send('Target.getTargets'), target = targets.targetInfos.find(item => item.type === 'page');
  ({ sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }));
  await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (response.exceptionDetails) throw Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const wait = async (expression, message, timeout = 12000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await evaluate(expression); if (value) return value; await new Promise(resolve => setTimeout(resolve, 80)); }
    throw Error(message);
  };
  const read = async label => {
    const sample = await evaluate(`(() => {const p=document.querySelector('[data-testid="operator-walkthrough"]'), main=document.querySelector('main.twin-app');return {atMs:performance.now(),timeOrigin:performance.timeOrigin,hidden:document.hidden,visibilityState:document.visibilityState,focused:document.hasFocus(),record:p?JSON.parse(p.getAttribute('data-presentation-record')):null,currentTimeS:main?.getAttribute('data-time'),displayedTimeS:main?.getAttribute('data-display-time'),saved:localStorage.getItem('neptune-v2-scenarios'),scene:window.__NEPTUNE_TWIN_SCENE__};})()`);
    receipt.samples.push({ label, ...sample }); return sample;
  };
  const click = async label => {
    const expression = `(() => {const items=[...document.querySelectorAll('button')].filter(e=>e.textContent.trim()===${JSON.stringify(label)} && e.getBoundingClientRect().width && e.getBoundingClientRect().height && getComputedStyle(e).visibility==='visible');if(items.length!==1 || items[0].disabled)return null;const e=items[0];e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return e.contains(document.elementFromPoint(x,y))?{x,y}:null;})()`;
    const point = await wait(expression, `Visible native button unavailable: ${label}`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, sessionId);
  };
  const releaseResponse = await fetch(new URL('release.json', url)); assert(releaseResponse.ok, 'Packaged release identity required.');
  const releaseBytes = Buffer.from(await releaseResponse.arrayBuffer()); receipt.release = JSON.parse(releaseBytes); receipt.releaseSha256 = hash(releaseBytes);
  await fs.writeFile(path.join(out, 'release.json'), releaseBytes);
  await send('Page.navigate', { url }, sessionId); await send('Target.activateTarget', { targetId: target.targetId });
  await wait(`document.querySelector('main.twin-app')?.dataset.ready==='true'`, 'App initialization did not complete.');
  await click('Compare'); await click('Start decision campaign');
  await wait(`document.querySelector('[data-testid="decision-coverage"]')?.dataset.status==='completed'`, 'Campaign did not complete.', 120000);
  await click('Start result walkthrough');
  await wait(`document.querySelector('[data-testid="operator-walkthrough"]')?.dataset.status==='ready'`, 'Manual prepared result did not resolve.');
  await click('Play presentation');
  await wait(`document.querySelector('[data-testid="operator-walkthrough"]')?.dataset.presentationStatus==='playing'`, 'Native Play did not start.');
  const before = await read('foreground-playing'); assert.equal(before.visibilityState, 'visible');
  const other = await send('Target.createTarget', { url: 'data:text/html,<title>NEPTUNE visibility test companion</title><h1>Disposable background-session test</h1>' });
  await send('Target.activateTarget', { targetId: other.targetId });
  await wait(`document.hidden && document.visibilityState==='hidden' && document.querySelector('[data-testid="operator-walkthrough"]')?.dataset.presentationStatus==='paused'`, 'Native tab did not become actually hidden and pause.');
  const hidden = await read('actually-hidden-paused');
  // Negative control: longer than the selected app reading dwell. This wait is
  // not readiness and never causes presentation advancement.
  await new Promise(resolve => setTimeout(resolve, 6500));
  const held = await read('hidden-after-dwell');
  assert.equal(held.visibilityState, 'hidden'); assert.equal(held.hidden, true);
  assert.equal(held.record.shotIndex, hidden.record.shotIndex); assert.equal(held.record.elapsedReadingMs, hidden.record.elapsedReadingMs);
  await send('Target.activateTarget', { targetId: target.targetId });
  await wait(`!document.hidden && document.visibilityState==='visible'`, 'Original tab did not return to visible.');
  const foreground = await read('foreground-still-paused');
  assert.equal(foreground.record.status, 'paused'); assert.equal(foreground.record.shotIndex, hidden.record.shotIndex);
  await click('Resume walkthrough');
  await wait(`document.querySelector('[data-testid="operator-walkthrough"]')?.dataset.presentationStatus==='playing'`, 'Explicit Resume did not resume.');
  const resumed = await read('explicit-resume');
  assert.equal(resumed.record.shotIndex, hidden.record.shotIndex); assert.equal(resumed.record.sourceKey, before.record.sourceKey);
  assert.equal(resumed.currentTimeS, before.currentTimeS); assert.equal(resumed.saved, before.saved);
  assert.deepEqual(receipt.errors, []);
  // Capture only after all visibility observations have finished.
  const screenshot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  await fs.writeFile(path.join(out, 'native-foreground-resumed.png'), Buffer.from(screenshot.data, 'base64'));
  receipt.status = 'PASS';
} catch (error) { receipt.status = 'FAIL'; receipt.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  if (send) { try { await send('Browser.close'); } catch { /* Browser may already be gone. */ } }
  socket?.close(); child.kill('SIGTERM');
  receipt.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'visibility.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: receipt.status, out, failure: receipt.failure }));
}

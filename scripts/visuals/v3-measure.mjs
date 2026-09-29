/**
 * Actual-app Visual V3 evidence. Start a production preview before invoking.
 * NEPTUNE_BASE_URL=... NEPTUNE_VISUAL_OUT=/outside/repository node scripts/visuals/v3-measure.mjs
 * Modes: capture (PNG + actual interaction WebM), measure (three 30s paths),
 * soak (20 cycles + ten interactive minutes), all (default). Each mode retains
 * failed observations and exits nonzero when its declared acceptance fails.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = process.env.NEPTUNE_BASE_URL || 'http://127.0.0.1:4173/neptune-2035/';
const out = path.resolve(process.env.NEPTUNE_VISUAL_OUT || '/private/tmp/neptune-visual-v3-evidence');
const mode = process.env.NEPTUNE_VISUAL_MODE || 'all';
if (!['all', 'capture', 'measure', 'soak'].includes(mode)) throw Error(`Unknown mode: ${mode}`);
const repository = process.cwd();
if (out === repository || out.startsWith(repository + path.sep)) throw Error('Keep screenshots, recordings and raw logs outside the repository.');
await fs.mkdir(out, { recursive: true });
const failures = [], errors = [], requests = [], snapshots = [];
const receipt = {
  schemaVersion: 1, phase: 'Visual V3', mode, base, startedAt: new Date().toISOString(),
  fixture: 'Unchanged default design, paused; explicit fault capture documented separately.',
  machine: { cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, memoryBytes: os.totalmem(), platform: os.platform(), release: os.release(), architecture: os.arch() },
  environment: { power: process.env.NEPTUNE_POWER_STATE || 'unknown', foreground: process.env.NEPTUNE_FOREGROUND_STATE || 'unknown', display: process.env.NEPTUNE_DISPLAY_DESCRIPTION || 'unknown', nativeSafari: 'not measured by this Playwright helper' },
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5,
  budgets: { cduTriangles: 12000, cduPayloadBytes: 1024 * 1024, revealTransferBytes: 6 * 1024 * 1024, drawCalls: 250, triangles: 500000, durationPerRunMs: 30000, runs: 3, medianFPS: 55, p95FrameMs: 25, cycles: 20, soakDurationMs: 600000 },
  transferTimingScope: 'GLB response entries are reported separately from the lazy GLTFLoader JavaScript chunk; the full detail transfer is also reported. encodedBodySize is compressed response-body bytes; transferSize includes response overhead and can be zero on cache hits. Metadata is compiled into initial scene code, not separately fetched at reveal.',
  loadTimingScope: 'Browser performance.now timestamps span the ordinary Cooling close-up click event to the first observed post-render authored-ready publication. Subsequent stable-frame resource sampling is excluded. Cold capture preserves the default campus selection and asserts every GLB fetch starts after the click; separate entries describe fetch timing.',
  motionScope: 'Capture and resource soak use reduced motion. Performance contexts use normal motion from before navigation, then wait for three stable completed camera/target publications before each measured path. Raw samples retain the observed preference and camera movement.',
  measurementLimits: 'rAF intervals describe browser presentation cadence. Geometry/texture object counters are allocation inventories, not total memory. GPU/native driver allocation unavailable. JS heap uses the nonstandard performance.memory API, may be quantized, and may be unavailable. No native Safari or thermal certification is inferred.',
  errors, failures, requests, snapshots, loadTimings: [],
};
try { receipt.machine.osVersion = execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(); } catch { /* Non-macOS host. */ }
try { receipt.sourceSHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { receipt.sourceSHA = null; }
const persist = async () => fs.writeFile(path.join(out, `${mode}-receipt.json`), JSON.stringify(receipt, null, 2) + '\n');
const check = (condition, message, observation) => { if (!condition) failures.push({ message, observation }); };
const browser = await chromium.launch({ headless: process.env.NEPTUNE_HEADED !== '1', args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
receipt.browser = { version: browser.version(), product: 'Playwright bundled Chromium', headless: process.env.NEPTUNE_HEADED !== '1', angle: process.platform === 'darwin' ? 'Metal requested' : 'default' };
let activeContext;
const duty = 'platform-001/module-01/pump-duty';
const standby = 'platform-001/module-01/pump-standby';
const second = 'platform-001/module-02/pump-duty';
const cdu = 'platform-001/module-01/cdu';
async function createPage(recordVideo = false, reducedMotion = 'reduce') {
  activeContext = await browser.newContext({ viewport: receipt.viewport, deviceScaleFactor: 1.5, reducedMotion, ...(recordVideo ? { recordVideo: { dir: path.join(out, 'recordings'), size: receipt.viewport } } : {}) });
  const page = await activeContext.newPage();
  page.on('pageerror', e => errors.push({ at: new Date().toISOString(), message: e.message }));
  page.on('response', response => {
    if (/\/visuals\/v[23]\/|\/assets\/GLTFLoader-[^/]+\.js/.test(response.url())) requests.push({ url: response.url(), status: response.status(), at: new Date().toISOString() });
  });
  return page;
}
const button = (page, name) => page.getByRole('button', { name, exact: true });
const scene = page => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);
async function ready(page) {
  await page.locator('main.twin-app[data-ready="true"]').waitFor();
  await page.waitForFunction(() => (window.__NEPTUNE_TWIN_SCENE__?.renderEpoch ?? 0) > 0);
  if (!receipt.graphics) receipt.graphics = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2');
    if (!gl) return null;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION), unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null, unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null, visibilityState: document.visibilityState };
  });
}
async function completed(page) {
  const epoch = (await scene(page)).renderEpoch;
  await page.waitForFunction(e => (window.__NEPTUNE_TWIN_SCENE__?.renderEpoch ?? 0) >= e + 2, epoch);
  return scene(page);
}
async function select(page, assetId) {
  const equipment = page.getByLabel('Select equipment', { exact: true });
  const exists = await equipment.locator('option').evaluateAll((options, id) => options.some(option => option.value === id), assetId);
  if (exists) await equipment.selectOption(assetId);
  else { await page.getByLabel('Find asset ID', { exact: true }).fill(assetId); await button(page, 'Find').click(); }
}
async function reveal(page, assetId = duty) {
  // Selecting even the current option dispatches a view change and can start
  // detail loading. Leave the default campus selection untouched for cold proof.
  if (await page.locator('main.twin-app').getAttribute('data-selected') !== assetId) await select(page, assetId);
  const moduleId = assetId.slice(0, assetId.lastIndexOf('/'));
  await button(page, 'Cooling close-up').evaluate((element, expectedModule) => {
    window.__NEPTUNE_VISUAL_READY_TIMING__ = null;
    element.addEventListener('click', () => {
      const clickAtMs = performance.now();
      const observe = () => {
        const s = window.__NEPTUNE_TWIN_SCENE__;
        if (s?.focus === 'cooling' && s.visualKit?.moduleId === expectedModule && s.visualKit.status === 'ready' &&
            s.visualKit.assets.some(asset => asset.kind === 'cdu') &&
            s.visualKit.assets.every(asset => asset.meshCount > 0 && asset.renderedMeshes > 0)) {
          const renderedReadyAtMs = performance.now();
          window.__NEPTUNE_VISUAL_READY_TIMING__ = { moduleId: expectedModule, clickAtMs, renderedReadyAtMs,
            clickToRenderedReadyMs: renderedReadyAtMs - clickAtMs, renderEpoch: s.renderEpoch };
        } else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }, { once: true, capture: true });
  }, moduleId);
  await button(page, 'Cooling close-up').click();
  await page.waitForFunction(() => window.__NEPTUNE_VISUAL_READY_TIMING__ !== null);
  receipt.loadTimings.push(await page.evaluate(() => window.__NEPTUNE_VISUAL_READY_TIMING__));
  // Extra stable publications support resource snapshots, not readiness latency.
  return completed(page);
}
async function setToggle(page, name, enabled) {
  if ((await button(page, name).getAttribute('aria-pressed')) !== String(enabled)) await button(page, name).click();
}
async function campus(page) {
  if (await button(page, 'Exit interior').count()) await button(page, 'Exit interior').click();
  await setToggle(page, 'Explode', false);
  await setToggle(page, 'X-ray', false);
  await button(page, 'Campus view').click();
  await page.waitForFunction(() => window.__NEPTUNE_TWIN_SCENE__?.focus === 'campus');
  return completed(page);
}
async function sample(page, label) {
  const observation = await completed(page);
  const heap = await page.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null);
  const value = { label, at: new Date().toISOString(), scene: observation, jsHeap: heap, estimatedKitTextureBytes: observation.visualKit?.cache.textures === 0 ? 0 : null, gpuNativeAllocationBytes: null };
  snapshots.push(value);
  check(observation.drawCalls <= receipt.budgets.drawCalls, 'Draw-call ceiling exceeded', value);
  check(observation.triangles <= receipt.budgets.triangles, 'Submitted-triangle ceiling exceeded', value);
  return value;
}
async function capture(page, name) {
  await completed(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (page.viewportSize().width <= 390) await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  await sample(page, name);
}
async function runCapture() {
  let page = await createPage(true);
  const start = Date.now();
  await page.goto(base); await ready(page); await page.evaluate(() => document.fonts.ready);
  await capture(page, 'campus');
  receipt.initialKitRequests = requests.length;
  check(requests.length === 0, 'Initial campus downloaded authored kit before reveal', requests);
  const cold = Date.now(); await reveal(page); receipt.coldActionMs = Date.now() - cold; receipt.coldLoadMs = receipt.loadTimings.at(-1).clickToRenderedReadyMs;
  await capture(page, 'cooling-close-up');
  await setToggle(page, 'Explode', true); await capture(page, 'systems-reveal');
  await select(page, duty); await capture(page, 'pump-close-up');
  const exchanger = await page.getByLabel('Select equipment', { exact: true }).locator('option').evaluateAll(options => options.find(option => /platform-001\/module-01\/.*(?:exchanger|hx)/i.test(option.value))?.value);
  if (!exchanger) throw Error('No canonical exchanger option found.');
  await page.getByLabel('Select equipment', { exact: true }).selectOption(exchanger); await capture(page, 'exchanger-close-up');
  await select(page, cdu); await capture(page, 'cdu-close-up');
  await button(page, 'Cooling close-up').click();
  await page.locator('.twin-route-legend > summary').click(); await capture(page, 'reveal-legend-open');
  await page.locator('.twin-route-legend > summary').click(); await capture(page, 'reveal-legend-closed');
  await campus(page); await capture(page, 'campus-return');
  receipt.captureResourceEntries = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\/visuals\/v[23]\/|\/assets\/GLTFLoader-[^/]+\.js/.test(entry.name)).map(entry => ({ url: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, startTimeMs: entry.startTime, durationMs: entry.duration })));
  receipt.captureModelResources = receipt.captureResourceEntries.filter(entry => /\.glb(?:\?|$)/.test(entry.url));
  receipt.coldModelFetchesAfterClick = receipt.captureModelResources.length === 3 && receipt.captureModelResources.every(entry => entry.startTimeMs >= receipt.loadTimings[0].clickAtMs);
  check(receipt.coldModelFetchesAfterClick, 'Cold detail fetch began before the ordinary Cooling close-up click', { click: receipt.loadTimings[0], models: receipt.captureModelResources });
  receipt.captureModelBytes = receipt.captureModelResources.reduce((sum, entry) => sum + entry.encodedBodySize, 0);
  receipt.captureJavaScriptResources = receipt.captureResourceEntries.filter(entry => /\.js(?:\?|$)/.test(entry.url));
  receipt.captureRevealEncodedBodyBytes = receipt.captureResourceEntries.reduce((sum, entry) => sum + entry.encodedBodySize, 0);
  receipt.captureRevealTransferBytes = receipt.captureResourceEntries.reduce((sum, entry) => sum + entry.transferSize, 0);
  check(Math.max(receipt.captureRevealEncodedBodyBytes, receipt.captureRevealTransferBytes) <= receipt.budgets.revealTransferBytes, 'First-reveal transfer exceeds asset budget', receipt.captureResourceEntries);
  const video = page.video(); await activeContext.close();
  if (video) { receipt.interactiveClip = path.join(out, 'actual-app-reveal.webm'); await video.saveAs(receipt.interactiveClip); }
  page = await createPage(); await page.goto(base); await ready(page); await reveal(page);
  await campus(page); const warm = Date.now(); await reveal(page, duty); receipt.warmActionMs = Date.now() - warm; receipt.warmLoadMs = receipt.loadTimings.at(-1).clickToRenderedReadyMs;
  await reveal(page, second); await capture(page, 'second-module');
  await button(page, 'Inside module').click(); await page.waitForFunction(() => window.__NEPTUNE_TWIN_SCENE__?.inside); await capture(page, 'interior');
  await button(page, 'Exit interior').click(); await reveal(page, second); await capture(page, 'interior-return');
  await reveal(page, cdu); await button(page, 'Operate').click(); await button(page, 'Trip selected asset').click();
  await page.getByTestId('asset-operating-status').filter({ hasText: 'failed' }).waitFor();
  await page.getByLabel('Select equipment', { exact: true }).selectOption(standby); await button(page, 'Cooling close-up').click(); await capture(page, 'failed-and-selected');
  // Finish the desktop interaction clip before changing viewport; mobile is
  // captured in a clean context, avoiding a letterboxed tail in the shared clip.
  await activeContext.close();
  page = await createPage(); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base); await ready(page);
  await reveal(page, cdu); await capture(page, 'mobile-reveal');
  await page.locator('.twin-route-legend > summary').click(); await capture(page, 'mobile-reveal-legend');
  await page.locator('.twin-route-legend > summary').click();
  await select(page, cdu); await capture(page, 'mobile-cdu-close-up');
  receipt.mobileOverflow = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  check(receipt.mobileOverflow.scrollWidth <= receipt.mobileOverflow.viewport, '390px horizontal overflow', receipt.mobileOverflow);
  await page.goto(new URL('?fallback=1', base).href); await page.getByTestId('twin-fallback').waitFor();
  await page.screenshot({ path: path.join(out, 'mobile-fallback.png'), fullPage: true });
  await activeContext.close();
  page = await createPage();
  await page.route('**/visuals/v3/cdu.glb', route => route.fulfill({ status: 404, body: 'Intentional missing CDU capture' }));
  await page.goto(base); await ready(page); await select(page, cdu); await button(page, 'Cooling close-up').click();
  await page.waitForFunction(() => { const k = window.__NEPTUNE_TWIN_SCENE__?.visualKit; return k?.assets.some(a => a.kind === 'cdu' && a.status === 'fallback') && k.assets.filter(a => a.kind !== 'cdu').every(a => a.status === 'ready' && a.renderedMeshes > 0); });
  await capture(page, 'missing-cdu-fallback'); await activeContext.close();
  receipt.captureDurationMs = Date.now() - start;
}
async function runMeasure() {
  // TwinApp reads the preference at mount. Changing only emulated media after
  // navigation cannot turn an already mounted reduced-motion app into this path.
  const page = await createPage(false, 'no-preference');
  await page.goto(base); await ready(page); await reveal(page);
  await setToggle(page, 'Explode', true); await completed(page);
  receipt.performanceRuns = [];
  const stableCamera = async () => {
    const samples = [], toleranceM = 0.00001, requiredStablePublications = 3;
    let previous, stable = 0;
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      const value = await completed(page);
      if (value.reducedMotion !== false) throw Error('Performance requires observed normal motion from initial navigation.');
      const pose = [...value.camera, ...value.target];
      stable = previous && pose.every((coordinate, index) => Math.abs(coordinate - previous[index]) <= toleranceM) ? stable + 1 : 0;
      samples.push({ renderEpoch: value.renderEpoch, camera: value.camera, target: value.target, reducedMotion: value.reducedMotion });
      previous = pose;
      if (stable >= requiredStablePublications) return { scene: value, readiness: { toleranceM, requiredStablePublications, samples } };
    }
    throw Error('Camera/target did not reach three stable completed publications within 12 seconds.');
  };
  for (let run = 0; run < 3; run++) {
    // Reset through the ordinary control and observe actual camera convergence;
    // authored readiness alone does not mean normal-motion framing has settled.
    await reveal(page);
    const settled = await stableCamera(), startScene = settled.scene;
    await page.locator('canvas').focus();
    const measured = page.evaluate(() => new Promise(resolve => {
      const intervals = [], samples = []; let first = null, last = null, epoch = -1;
      function frame(t) {
        if (first === null) first = t;
        if (last !== null) intervals.push(t - last);
        last = t;
        const scene = window.__NEPTUNE_TWIN_SCENE__;
        if (scene && scene.renderEpoch !== epoch) { epoch = scene.renderEpoch; samples.push({ atMs: t - first, renderEpoch: epoch, camera: scene.camera, target: scene.target, reducedMotion: scene.reducedMotion, oceanTimeS: scene.oceanTimeS, drawCalls: scene.drawCalls, triangles: scene.triangles, geometries: scene.geometries, textures: scene.textures, kitStatus: scene.visualKit?.status, moduleId: scene.visualKit?.moduleId }); }
        if (t - first < 30000) requestAnimationFrame(frame); else resolve({ intervals, samples, startMs: first, endMs: t, durationMs: t - first });
      }
      requestAnimationFrame(frame);
    }));
    // Identical 30-second path in every run: 500ms cadence, first half clockwise,
    // second half anticlockwise; reveal stays fully rendered throughout.
    const pathStart = Date.now();
    for (let step = 0; step < 60; step++) {
      const until = pathStart + step * 500 - Date.now();
      if (until > 0) await page.waitForTimeout(until);
      await page.keyboard.press(step < 30 ? 'ArrowRight' : 'ArrowLeft');
    }
    const raw = await measured, sorted = [...raw.intervals].sort((a, b) => a - b);
    const maxCameraDisplacementM = Math.max(...raw.samples.map(s => Math.hypot(...s.camera.map((coordinate, index) => coordinate - startScene.camera[index]))));
    const result = { run: run + 1, startScene, cameraReadiness: settled.readiness, normalMotion: raw.samples.length > 0 && raw.samples.every(s => s.reducedMotion === false), maxCameraDisplacementM, cameraMoved: maxCameraDisplacementM > settled.readiness.toleranceM, durationMs: raw.durationMs, sampleCount: sorted.length, medianFrameMs: sorted[Math.floor(sorted.length * 0.5)], p95FrameMs: sorted[Math.floor(sorted.length * 0.95)], maxFrameMs: sorted.at(-1), minFrameMs: sorted[0], maxDrawCalls: Math.max(...raw.samples.map(s => s.drawCalls)), maxTriangles: Math.max(...raw.samples.map(s => s.triangles)) };
    result.medianFPS = 1000 / result.medianFrameMs;
    result.passed = result.normalMotion && result.cameraMoved && result.durationMs >= 30000 && result.medianFPS >= 55 && result.p95FrameMs <= 25 && result.maxDrawCalls <= 250 && result.maxTriangles <= 500000;
    receipt.performanceRuns.push(result);
    await fs.writeFile(path.join(out, `orbit-run-${run + 1}-raw.json`), JSON.stringify(raw) + '\n');
    check(result.passed, `Performance run ${run + 1} failed declared budget`, result); await persist();
    console.log(JSON.stringify({ progress: 'performance', ...result }));
  }
  receipt.runtimeResourceEntries = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\/visuals\/v[23]\/|\/assets\/GLTFLoader-[^/]+\.js/.test(entry.name)).map(entry => ({ url: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, startTimeMs: entry.startTime, durationMs: entry.duration })));
  receipt.modelResources = receipt.runtimeResourceEntries.filter(entry => /\.glb(?:\?|$)/.test(entry.url));
  receipt.modelEncodedBodyBytes = receipt.modelResources.reduce((sum, entry) => sum + entry.encodedBodySize, 0);
  receipt.modelTransferBytes = receipt.modelResources.reduce((sum, entry) => sum + entry.transferSize, 0);
  receipt.javaScriptResources = receipt.runtimeResourceEntries.filter(entry => /\.js(?:\?|$)/.test(entry.url));
  receipt.revealEncodedBodyBytes = receipt.runtimeResourceEntries.reduce((sum, entry) => sum + entry.encodedBodySize, 0);
  receipt.revealTransferBytes = receipt.runtimeResourceEntries.reduce((sum, entry) => sum + entry.transferSize, 0);
  check(Math.max(receipt.revealEncodedBodyBytes, receipt.revealTransferBytes) <= receipt.budgets.revealTransferBytes, 'First-reveal asset byte budget exceeded', { encodedBodyBytes: receipt.revealEncodedBodyBytes, transferBytes: receipt.revealTransferBytes });
  await activeContext.close();
}
async function runSoak() {
  const page = await createPage(); await page.goto(base); await ready(page);
  const cycle = async index => {
    await reveal(page, index % 2 ? second : duty); await setToggle(page, 'Explode', true); await completed(page);
    await setToggle(page, 'Explode', false); await setToggle(page, 'X-ray', false); await completed(page);
    await setToggle(page, 'X-ray', true); await completed(page);
    await button(page, 'Inside module').click(); await page.waitForFunction(() => window.__NEPTUNE_TWIN_SCENE__?.inside);
    await button(page, 'Exit interior').click(); await campus(page);
    // Same end identity prevents a legitimate selected-module difference from
    // masquerading as growth. Ready epochs exclude previous-pose counters.
    await select(page, duty); await campus(page);
    return sample(page, `cycle-${index}`);
  };
  await cycle(0); await cycle(1);
  const baseline = await sample(page, 'warmed-campus');
  receipt.resourceBaseline = baseline;
  const compare = value => {
    check(value.scene.geometries === baseline.scene.geometries && value.scene.textures === baseline.scene.textures, 'Post-warm renderer allocation inventory changed at identical end pose', { baseline, value });
    check(JSON.stringify(value.scene.visualKit.cache) === JSON.stringify(baseline.scene.visualKit.cache), 'Post-warm kit cache inventory changed at identical end pose', { baseline, value });
    check(value.scene.simulationTimeS === baseline.scene.simulationTimeS, 'View path advanced paused simulation', value);
  };
  receipt.cycles = [];
  for (let index = 0; index < 20; index++) { const value = await cycle(index + 2); compare(value); receipt.cycles.push(value); await persist(); }
  const start = Date.now(); receipt.soak = { requestedDurationMs: 600000, samples: [] };
  let index = 0;
  while (Date.now() - start < 600000) {
    await reveal(page, index % 2 ? second : duty); await page.locator('canvas').focus();
    for (let step = 0; step < 8; step++) { await page.keyboard.press(index % 2 ? 'ArrowLeft' : 'ArrowRight'); await page.waitForTimeout(250); }
    const value = await cycle(index + 22); compare(value); receipt.soak.samples.push(value); index++;
    receipt.soak.elapsedMs = Date.now() - start; await persist();
    console.log(JSON.stringify({ progress: 'soak', elapsedMs: receipt.soak.elapsedMs, interactions: index, failures: failures.length }));
    await page.waitForTimeout(5000);
  }
  receipt.soak.elapsedMs = Date.now() - start;
  check(receipt.soak.elapsedMs >= 600000, 'Soak did not run ten minutes', receipt.soak);
  await activeContext.close();
}
try {
  if (mode === 'all' || mode === 'capture') await runCapture();
  if (mode === 'all' || mode === 'measure') await runMeasure();
  if (mode === 'all' || mode === 'soak') await runSoak();
} catch (error) { failures.push({ message: 'Evidence helper failed', error: String(error), stack: error?.stack }); }
finally {
  await browser.close(); receipt.finishedAt = new Date().toISOString();
  if (errors.length) failures.push({ message: 'Unexpected browser errors', errors });
  receipt.passed = failures.length === 0; await persist();
  console.log(JSON.stringify({ receipt: path.join(out, `${mode}-receipt.json`), passed: receipt.passed, failures }, null, 2));
  if (!receipt.passed) process.exitCode = 1;
}

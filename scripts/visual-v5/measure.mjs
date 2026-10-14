/**
 * Exact packaged-candidate automatic frame paths and interactive lifecycle.
 * node scripts/visual-v5/measure.mjs --url=https://.../ --out=/external/unique-dir --mode=all
 * Modes: frames (three complete >=30s normal-motion presentations), soak (20
 * lifecycle cycles followed by 10 minutes of real interaction), all (default).
 * No production handlers, time acceleration or request/readiness replacement.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { argument, artifactIdentity, assertReadable, button, externalDirectory, launchOptions, observe, prepare, savedProjects } from './common.mjs';

const url = argument('url'), mode = argument('mode') ?? 'all';
assert(url && /^https?:/.test(url) && ['all', 'frames', 'soak'].includes(mode), 'Pass --url, --out and optional --mode=all|frames|soak.');
const out = await externalDirectory(argument('out'));
const receipt = {
  schemaVersion: 1, phase: 'Visual V5', mode, url, startedAt: new Date().toISOString(),
  machine: { cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, memoryBytes: os.totalmem(), platform: os.platform(), release: os.release(), architecture: os.arch() },
  environment: { power: process.env.NEPTUNE_POWER_STATE ?? 'unknown', nativeSafari: 'not measured; Playwright Chromium only' },
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5,
  budgets: { medianFPS: 55, p95FrameMs: 25, pathDurationMinMs: 30000, fullPaths: 3, cycles: 20, soakDurationMs: 600000 },
  measurements: 'Normal-motion rAF intervals include every in-sequence load, history resolve, camera settle, reading hold and stall. Resource/heap counters do not measure total GPU/native allocations. No silent interval trimming, forced GC, renderer reconstruction or animation acceleration.',
  failures: [], errors: [], paths: [], cycles: [], soak: [], requests: [],
};
const fail = (condition, message, values) => { if (!condition) receipt.failures.push({ message, values }); };
const persist = () => fs.writeFile(path.join(out, 'measurement.json'), JSON.stringify(receipt, null, 2) + '\n');
const browser = await chromium.launch(launchOptions);
receipt.browser = { name: 'Playwright Chromium', version: browser.version(), ...launchOptions };
let context;
async function session() {
  context = await browser.newContext({ viewport: receipt.viewport, deviceScaleFactor: 1.5, reducedMotion: 'no-preference' });
  if (!receipt.artifact) {
    receipt.artifact = await artifactIdentity(context, url, out);
    receipt.localSource = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), trackedClean: !execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() };
    assert(receipt.localSource.trackedClean && receipt.localSource.tree === receipt.artifact.release.sourceTree, 'Measure only the clean source tree of the packaged candidate.');
  }
  const page = await context.newPage();
  page.on('pageerror', error => receipt.errors.push({ at: new Date().toISOString(), message: error.message }));
  page.on('request', request => { if (/\/visuals\/v[23]\/.*\.glb$/.test(request.url())) receipt.requests.push({ at: new Date().toISOString(), url: request.url() }); });
  const campaign = await prepare(page, url);
  await fs.writeFile(path.join(out, `campaign-${mode}.json`), JSON.stringify(campaign, null, 2) + '\n');
  receipt.graphics ??= await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl ? { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null, visibilityState: document.visibilityState } : null;
  });
  return page;
}
async function details(page, opened) {
  const summary = page.getByTestId('operator-walkthrough').getByText('Details', { exact: true });
  if (await summary.locator('..').evaluate(element => element.open) !== opened) await summary.click();
}
async function restart(page) {
  await details(page, true); await button(page, 'Restart presentation').click(); await details(page, false);
}
async function completePath(page, index) {
  // Read-only frame sampling is installed immediately before the real Play or
  // Restart action. The application remains the sole presentation clock owner.
  await page.evaluate(() => {
    const data = { startedAt: performance.now(), frames: [], changes: [], ended: false, previous: null, last: '' };
    window.__NEPTUNE_V5_FRAME_SAMPLE__ = data;
    const frame = time => {
      if (data.ended) return;
      const panel = document.querySelector('[data-testid="operator-walkthrough"]');
      const main = document.querySelector('main.twin-app'), scene = window.__NEPTUNE_TWIN_SCENE__;
      const observation = { inspectionStatus: main?.dataset.inspectionStatus ?? null, kitStatus: scene?.visualKit.status ?? null,
        cameraTransitioning: scene?.cameraTransitioning ?? null, visibilityState: document.visibilityState };
      const key = `${panel?.dataset.shotIndex}:${panel?.dataset.presentationStatus}:${panel?.dataset.readiness}:${observation.inspectionStatus}:${observation.kitStatus}:${observation.cameraTransitioning}:${document.visibilityState}`;
      if (key !== data.last) {
        data.changes.push({ atMs: time, key, ...observation, record: panel ? JSON.parse(panel.getAttribute('data-presentation-record')) : null }); data.last = key;
      }
      if (data.previous !== null) data.frames.push({ atMs: time, intervalMs: time - data.previous });
      data.previous = time; requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  let completionError = null;
  try {
    if (index === 0) await button(page, 'Play presentation').click(); else await restart(page);
    await expect(page.getByTestId('operator-walkthrough')).toHaveAttribute('data-presentation-status', 'completed', { timeout: 240_000 });
  } catch (error) { completionError = error.stack ?? String(error); }
  const sample = await page.evaluate(() => { const data = window.__NEPTUNE_V5_FRAME_SAMPLE__; data.ended = true; return { ...data, stoppedAt: performance.now(), visibilityState: document.visibilityState, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }; });
  const final = await observe(page);
  if (completionError) { receipt.paths.push({ index, incomplete: true, sample, final, failure: completionError }); await persist(); throw Error(completionError); }
  assertReadable(final);
  const intervals = sample.frames.map(item => item.intervalMs).sort((a, b) => a - b);
  const percentile = fraction => intervals[Math.floor((intervals.length - 1) * fraction)];
  const summary = { durationMs: sample.stoppedAt - sample.startedAt, frames: intervals.length, medianFrameMs: percentile(.5), medianFPS: 1000 / percentile(.5), p95FrameMs: percentile(.95), maxFrameMs: intervals.at(-1), transitions: {},
    overlappingStageDurationsMs: { historyResolution: 0, kitLoading: 0, cameraMovement: 0, postRenderSettling: 0, reading: 0 },
    stageDurationScope: 'These state-observed durations may overlap (for example camera and GLB work); they are not additive. Every underlying state interval and resource transfer entry is retained.' };
  for (let change = 0; change < sample.changes.length; change++) {
    const value = sample.changes[change], duration = (sample.changes[change + 1]?.atMs ?? sample.stoppedAt) - value.atMs;
    const stage = value.record?.status === 'playing' ? 'reading' : value.record?.readiness === 'settling' ? 'settling' : value.record?.status === 'resolving' ? 'loadingOrHistory' : value.record?.status ?? 'setup';
    summary.transitions[stage] = (summary.transitions[stage] ?? 0) + duration;
    if (value.inspectionStatus === 'loading') summary.overlappingStageDurationsMs.historyResolution += duration;
    if (value.kitStatus === 'loading') summary.overlappingStageDurationsMs.kitLoading += duration;
    if (value.cameraTransitioning) summary.overlappingStageDurationsMs.cameraMovement += duration;
    if (value.record?.readiness === 'settling' && !value.cameraTransitioning) summary.overlappingStageDurationsMs.postRenderSettling += duration;
    if (value.record?.status === 'playing') summary.overlappingStageDurationsMs.reading += duration;
  }
  // Resolution and transfer timelines are retained separately rather than
  // pretending concurrent history/GLB work can be added as disjoint durations.
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\.glb(?:\?|$)|GLTFLoader/.test(entry.name)).map(entry => ({ name: entry.name, startTimeMs: entry.startTime, durationMs: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize })));
  receipt.paths.push({ index, summary, sample, final, resources });
  fail(summary.durationMs >= 30000, 'Complete automatic path shorter than 30 seconds', summary);
  fail(summary.medianFPS >= 55 && summary.p95FrameMs <= 25, 'Frame budget not met on available measured host', summary);
  fail(sample.visibilityState === 'visible' && !sample.reducedMotion && sample.changes.every(change => change.key.endsWith(':visible')), 'Path must remain foreground normal-motion', sample);
  const visited = [...new Set(sample.changes.map(change => change.record?.shotIndex).filter(Number.isInteger))];
  fail(visited.length === Number(final.panel.shotCount), 'Full automatic path omitted a shot', visited);
  await persist();
}
async function warmPose(page, label) {
  for (const title of receipt.baseline ? [/Distribution to the racks/] : [/Reveal the cooling system/, /Separate fluid circuits/, /Distribution to the racks/]) {
    await details(page, true);
    const value = await page.getByRole('option').filter({ hasText: title }).getAttribute('value'); assert(value, 'Application must expose the authored presentation view.');
    await page.getByLabel('Presentation view', { exact: true }).selectOption(value); await details(page, false);
    await expect(page.getByTestId('operator-walkthrough')).toHaveAttribute('data-readiness', 'authored');
    await expect(page.getByTestId('operator-walkthrough')).toHaveAttribute('data-presentation-status', 'ready');
  }
  const detail = await observe(page); assertReadable(detail);
  await details(page, true); await page.getByLabel('Presentation view', { exact: true }).selectOption('0'); await details(page, false);
  await expect(page.getByTestId('operator-walkthrough')).toHaveAttribute('data-presentation-status', 'ready');
  const sample = await observe(page); assertReadable(sample);
  assert(Number.isFinite(sample.scene.geometries) && Number.isFinite(sample.scene.textures), 'Real renderer allocation counters are required.');
  assert.deepEqual(sample.scene.visualKit.cache, { geometries: 12, materials: 12, textures: 0, instances: 0 }, 'Three retained four-mesh templates, with no active detail instances, are required.');
  const memory = await page.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null);
  return { label, sample, detail, memory, gpuNativeMemoryBytes: null, persistentCanvases: await page.locator('canvas').count(), kitRequests: receipt.requests.length };
}
function compareResources(baseline, current) {
  fail(current.persistentCanvases === 1, 'Extra persistent renderer', current);
  fail(current.sample.scene.geometries === baseline.sample.scene.geometries && current.sample.scene.textures === baseline.sample.scene.textures, 'Warmed resource inventory grew at identical returned campus pose', { baseline, current });
  fail(JSON.stringify(current.sample.scene.visualKit.cache) === JSON.stringify(baseline.sample.scene.visualKit.cache), 'Warmed three-template cache inventory changed', { baseline, current });
  fail([...current.sample.scene.camera, ...current.sample.scene.target].every((coordinate, index) => Math.abs(coordinate - [...baseline.sample.scene.camera, ...baseline.sample.scene.target][index]) <= 1e-5), 'Returned warmed campus pose changed', { baseline, current });
  fail(current.kitRequests === baseline.kitRequests, 'Compatible lifecycle requested duplicate kit templates after warming', { baseline: baseline.kitRequests, current: current.kitRequests });
}
async function lifecycleCycle(page, index) {
  const beforeRestart = await savedProjects(page);
  await button(page, 'Play presentation').click();
  await expect(page.getByTestId('operator-walkthrough')).toHaveAttribute('data-presentation-status', 'playing');
  await button(page, 'Pause walkthrough').click();
  await button(page, 'Resume walkthrough').click();
  await button(page, 'Pause walkthrough').click();
  await button(page, 'Next walkthrough step').click();
  await button(page, 'Previous walkthrough step').click();
  await restart(page);
  assert.deepEqual(await savedProjects(page), beforeRestart, 'Restart multiplied saved scenarios.');
  await button(page, 'Exit walkthrough').click();
  await expect(page.getByTestId('operator-walkthrough')).toHaveCount(0);
  await button(page, 'Compare').click(); await button(page, 'Start result walkthrough').click();
  const current = await warmPose(page, `cycle-${index}`);
  compareResources(receipt.baseline, current); return current;
}
try {
  if (['all', 'frames'].includes(mode)) {
    const page = await session();
    for (let index = 0; index < 3; index++) await completePath(page, index);
    await context.close(); context = null;
  }
  if (['all', 'soak'].includes(mode)) {
    const page = await session(), owner = await page.locator('canvas').elementHandle();
    receipt.baseline = await warmPose(page, 'warmed-baseline');
    receipt.priorV4Comparison = { priorGeometries: 77, priorTextures: 2, measuredGeometries: receipt.baseline.sample.scene.geometries, measuredTextures: receipt.baseline.sample.scene.textures,
      caveat: 'Prior V4 77/2 is an investigation reference, not total GPU memory. Same-pose plateau is compared within this candidate and full provenance/scene retained for changes.' };
    for (let index = 0; index < 20; index++) { receipt.cycles.push(await lifecycleCycle(page, index)); await persist(); }
    const start = Date.now(); let iterations = 0;
    while (Date.now() - start < 600000) {
      // Each cycle exercises ordinary visible controls. The foreground interval
      // between cycles retains continuous rendering and normal input lifetime.
      const value = await lifecycleCycle(page, `soak-${iterations++}`);
      receipt.soak.push({ elapsedMs: Date.now() - start, ...value }); await persist();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    receipt.soakDurationMs = Date.now() - start;
    receipt.final = await warmPose(page, 'soak-final'); compareResources(receipt.baseline, receipt.final);
    fail(await owner.evaluate(element => element === document.querySelector('canvas')), 'Scene owner remounted during lifecycle', receipt.final);
    await context.close(); context = null;
  }
} catch (error) { receipt.failures.push({ message: error.stack ?? String(error) }); }
finally {
  if (context) await context.close(); await browser.close();
  receipt.status = receipt.failures.length || receipt.errors.length ? 'FAIL' : 'PASS';
  receipt.completedAt = new Date().toISOString(); await persist();
  if (receipt.status !== 'PASS') process.exitCode = 1;
  console.log(JSON.stringify({ status: receipt.status, out, paths: receipt.paths.map(item => item.summary), cycles: receipt.cycles.length, soakDurationMs: receipt.soakDurationMs, failures: receipt.failures }));
}

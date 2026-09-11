/** Record the real packaged application. Never writes media into source/public/dist. */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import os from 'node:os';
const argument = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = argument('url'), destination = argument('out');
assert(url && destination, 'Required: --url=http(s)://packaged-app/ --out=/absolute/external/evidence');
const out = path.resolve(destination), root = process.cwd();
assert(!out.startsWith(root + path.sep), 'Recording evidence must be outside the source checkout.');
await fs.mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const releaseResponse = await fetch(new URL('release.json', url), { cache: 'no-store' });
assert(releaseResponse.ok, 'Record a packaged application with release identity.');
const release = await releaseResponse.json();
const browser = await chromium.launch({ headless: process.platform !== 'linux', args: process.platform === 'darwin' ? ['--use-angle=metal'] : process.platform === 'linux' ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'] : [] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 }, recordVideo: { dir: path.join(out, 'raw'), size: { width: 1600, height: 1050 } } });
const page = await context.newPage(), startedAt = new Date().toISOString(), errors = [], steps = [];
const diagnostics = await context.newCDPSession(page);
await diagnostics.send('Performance.enable');
const memory = async () => Object.fromEntries((await diagnostics.send('Performance.getMetrics')).metrics.filter(item => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents'].includes(item.name)).map(item => [item.name, item.value]));
page.on('pageerror', error => errors.push(error.message));
const button = name => page.getByRole('button', { name, exact: true });
let evidence, video;
try {
  await page.goto(url);
  await expect(page.locator('main.twin-app')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.renderedModules)).toBeGreaterThan(0);
  await button('Compare').click();
  await page.getByLabel('Decision fixture', { exact: true }).selectOption('transfer');
  await button('Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed', { timeout: 120_000 });
  const downloading = page.waitForEvent('download'); await button('Export decision campaign').click();
  const download = await downloading; assert.equal(await download.failure(), null);
  evidence = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.equal(evidence.result.status, 'completed'); assert(evidence.result.ranking.scopeComplete);
  await fs.writeFile(path.join(out, 'walkthrough-campaign.json'), JSON.stringify(evidence, null, 2) + '\n');
  let navigationStartedAt = performance.now();
  await button('Start result walkthrough').click();
  const walkthrough = page.getByTestId('operator-walkthrough');
  await expect(walkthrough).toBeVisible();
  const count = Number(await walkthrough.getAttribute('data-step-count'));
  assert(Number.isSafeInteger(count) && count > 0 && count <= 20, 'Bounded declared step count required.');
  for (let index = 0; index < count; index++) {
    await expect(walkthrough).toHaveAttribute('data-step-index', String(index));
    await expect(walkthrough).toHaveAttribute('data-status', index === count - 1 ? 'completed' : 'ready');
    const stepReadyMs = performance.now() - navigationStartedAt;
    const inspectionStatus = await page.locator('main.twin-app').getAttribute('data-inspection-status');
    assert(['resolved', 'current'].includes(inspectionStatus), `Walkthrough state unavailable: ${inspectionStatus}`);
    await page.locator('.twin-scene-shell').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => {
      const scene = window.__NEPTUNE_TWIN_SCENE__, main = document.querySelector('main.twin-app');
      return Boolean(scene && scene.selectedId === main.dataset.selected && scene.simulationTimeS === Number(main.dataset.displayTime));
    })).toBe(true);
    let previousPose = null, stableObservations = 0;
    await expect.poll(async () => {
      const scene = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);
      const pose = [...scene.camera, ...scene.target];
      stableObservations = previousPose && pose.every((value, axis) => Math.abs(value - previousPose[axis]) < 0.015) ? stableObservations + 1 : 0;
      previousPose = pose;
      return stableObservations;
    }, { intervals: [350], timeout: 12_000 }).toBeGreaterThanOrEqual(2);
    // Deliberate readable recording dwell only; readiness above is condition-based.
    await page.waitForTimeout(1500);
    const title = await walkthrough.getAttribute('data-step-title');
    const filename = `step-${String(index + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(out, filename) });
    await page.locator('.twin-scene-shell').screenshot({ path: path.join(out, `canvas-${filename}`) });
    steps.push({ index, title, runId: await walkthrough.getAttribute('data-run-id'), displayedTimeS: await page.locator('main.twin-app').getAttribute('data-display-time'), inspectionStatus, stepReadyMs, rendererMemory: await memory(), screenshot: filename, text: await walkthrough.innerText() });
    if (index + 1 < count) { navigationStartedAt = performance.now(); await button('Next walkthrough step').click(); }
  }
  await button('Pause walkthrough').click();
  await expect(button('Resume walkthrough')).toBeVisible();
  await button('Resume walkthrough').click();
  await button('Exit walkthrough').click();
  await expect(walkthrough).toHaveCount(0);
  assert.deepEqual(errors, []);
  video = page.video();
} finally {
  try {
    await context.close();
    if (video) await video.saveAs(path.join(out, 'neptune-phase7-walkthrough.webm'));
  } finally { await browser.close(); }
}
assert(video && evidence, 'Recording did not complete. Raw failure media retained.');
const outputVideo = path.join(out, 'neptune-phase7-walkthrough.webm');
const bytes = await fs.readFile(outputVideo);
const receipt = { kind: 'actual-application-recording', url, startedAt, completedAt: new Date().toISOString(), source: { scriptCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), application: release }, experiment: { campaignId: evidence.campaign.id, campaignIdentity: evidence.result.campaignIdentity, coverage: evidence.result.coverage, winnerIds: evidence.result.ranking.winnerIds }, viewport: { width: 1600, height: 1050 }, device: 'emulated desktop browser; no real-device claim', environment: { platform: process.platform, architecture: process.arch, cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, systemMemoryBytes: os.totalmem(), node: process.version }, measurements: 'Observed primary fixture only, recording enabled: click-to-applied-step latency includes UI and history resolution; renderer JS heap excludes worker/GPU/native memory. These samples are neither a leak test nor a universal performance guarantee.', provenance: 'simulated real application executed through public UI; no separate success model', qualification: 'Simulated, design-stage prototype; physical validation pending.', media: { file: path.basename(outputVideo), bytes: bytes.length, sha256: hash(bytes) }, steps, errors };
await fs.writeFile(path.join(out, 'recording.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ recording: outputVideo, steps: steps.length, campaignIdentity: evidence.result.campaignIdentity, sha256: hash(bytes) }));

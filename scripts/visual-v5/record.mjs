/**
 * Extend the PH7 actual-application recorder with APPLICATION-owned advancement.
 * node scripts/visual-v5/record.mjs --url=https://.../ --out=/external/unique-dir
 * Optional --fixture=nominal|no-benefit-bus|no-benefit-source --mobile=1.
 * No Next clicks, clock acceleration, capture-only timeline, cuts or retiming.
 */
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { argument, artifactIdentity, assertReadable, button, externalDirectory, hash, launchOptions, observe, prepare, savedProjects } from './common.mjs';

const url = argument('url'), fixture = argument('fixture') ?? 'transfer';
assert(url && /^https?:/.test(url), 'Pass --url=http(s)://packaged-app/');
const out = await externalDirectory(argument('out'));
const viewport = argument('mobile') === '1' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const receipt = {
  schemaVersion: 1, kind: 'actual-application-automatic-presentation', url, fixture,
  startedAt: new Date().toISOString(), viewport, deviceScaleFactor: 1.5,
  qualifier: 'Simulated, design-stage prototype; physical validation pending.',
  advancement: 'One visible Play presentation action; application owns every following chapter and subshot.',
  rawMediaPolicy: 'Complete preparation, loading, transitions, reading and final card retained. No cuts, replacement frames, soundtrack, speeding or retiming.',
  scope: 'Playwright bundled Chromium; mobile is viewport emulation, not a real device. Native Safari is not exercised.',
  machine: { cpu: os.cpus()[0]?.model, logicalCPUs: os.cpus().length, memoryBytes: os.totalmem(), platform: os.platform(), release: os.release(), architecture: os.arch(), node: process.version },
  localSource: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), trackedClean: !execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() },
  samples: [], shots: [], errors: [], failures: [], requests: [],
};
const persist = () => fs.writeFile(path.join(out, 'recording.json'), JSON.stringify(receipt, null, 2) + '\n');
const browser = await chromium.launch(launchOptions);
receipt.browser = { name: 'Playwright Chromium', version: browser.version(), ...launchOptions };
const context = await browser.newContext({ viewport, deviceScaleFactor: 1.5, reducedMotion: 'no-preference', recordVideo: { dir: path.join(out, 'raw'), size: viewport } });
let page, video, lastKey = '', shot;
try {
  receipt.artifact = await artifactIdentity(context, url, out);
  assert(receipt.localSource.trackedClean && receipt.localSource.tree === receipt.artifact.release.sourceTree, 'Record the clean source tree of the served compiled candidate.');
  receipt.pageCreationStartEpochMs = Date.now();
  page = await context.newPage(); video = page.video();
  receipt.pageCreationEndEpochMs = Date.now();
  page.on('pageerror', error => receipt.errors.push({ at: new Date().toISOString(), message: error.message }));
  page.on('request', request => { if (/\/visuals\/v[23]\/.*\.glb$/.test(request.url())) receipt.requests.push({ url: request.url(), epochMs: Date.now() }); });
  receipt.campaign = await prepare(page, url, fixture);
  await fs.writeFile(path.join(out, 'campaign.json'), JSON.stringify(receipt.campaign, null, 2) + '\n');
  receipt.savedBeforePlay = await savedProjects(page);
  receipt.beforePlay = await observe(page);
  assert.equal(receipt.beforePlay.visibilityState, 'visible');
  assert.equal(receipt.beforePlay.reducedMotion, false, 'Recorder does not override reduced motion after entry.');
  const panel = page.getByTestId('operator-walkthrough');
  // The browser clock is sampled around a real native action; neither the
  // elapsed time nor recorder polling drives application advancement.
  receipt.playActionBefore = await observe(page);
  await button(page, 'Play presentation').click();
  receipt.playActionAfter = await observe(page);
  const deadline = Date.now() + 240_000;
  let completed = false;
  while (Date.now() < deadline) {
    const sample = await observe(page);
    sample.observedEpochMs = Date.now();
    receipt.samples.push(sample);
    assert(sample.panel, 'Guidance disappeared before completion.');
    assert(!['error', 'invalidated'].includes(sample.panel.presentationStatus), `Presentation stopped: ${sample.text}`);
    assert.equal(sample.visibilityState, 'visible', 'Capture document became hidden; retained footage is not a pass.');
    const key = `${sample.panel.requestToken}:${sample.panel.shotIndex}:${sample.panel.shotId}`;
    if (key !== lastKey) {
      if (shot) shot.endBrowserTimeMs = sample.browserTimeMs;
      const index = Number(sample.panel.shotIndex);
      assert(Number.isInteger(index) && (receipt.shots.length === 0 ? index === 0 : index === receipt.shots.at(-1).index + 1), 'Automatic sequence skipped or repeated a subshot.');
      shot = { index, id: sample.panel.shotId, stepId: sample.panel.stepId, requestToken: sample.panel.requestToken,
        sourceIdentity: sample.panel.sourceIdentity, runId: sample.panel.runId, startedBrowserTimeMs: sample.browserTimeMs,
        requestedTimeS: sample.panel.requestedTime, displayedTimeS: sample.displayedTimeS, record: sample.record,
        readinessObservations: [], caption: null, still: null };
      receipt.shots.push(shot); lastKey = key;
    }
    const readinessKey = `${sample.panel.presentationStatus}:${sample.panel.readiness}:${sample.inspectionStatus}`;
    if (shot.readinessObservations.at(-1)?.key !== readinessKey) shot.readinessObservations.push({ key: readinessKey, atBrowserTimeMs: sample.browserTimeMs });
    if (['playing', 'completed'].includes(sample.panel.presentationStatus) && ['authored', 'plan', 'procedural'].includes(sample.panel.readiness) && !shot.still) {
      assertReadable(sample);
      assert(sample.displayedCaption, 'Readable shot must expose its actual displayed primary caption.');
      shot.readableBrowserTimeMs = sample.browserTimeMs;
      shot.caption = sample.displayedCaption;
      shot.heading = sample.heading;
      shot.captionRect = sample.captionRect;
      shot.record = sample.record; shot.displayedTimeS = sample.displayedTimeS;
      shot.readableScene = sample.scene;
      shot.still = `shot-${String(shot.index + 1).padStart(2, '0')}-${shot.id.replace(/[^a-z0-9-]/gi, '-')}.png`;
      await page.screenshot({ path: path.join(out, shot.still) });
    }
    if (sample.panel.presentationStatus === 'completed') {
      assertReadable(sample);
      assert.equal(receipt.shots.length, Number(sample.panel.shotCount));
      assert(receipt.shots.every(item => item.still && item.caption), 'Every shot needs an observed authored/plan reading interval and actual still.');
      shot.endBrowserTimeMs = sample.browserTimeMs;
      receipt.completedSample = sample; completed = true; break;
    }
    // This is recorder observation cadence, never playback pacing/readiness.
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  assert(completed, 'Application did not complete within the bounded recorder observation window.');
  await expect(button(page, 'Review evidence')).toBeVisible();
  await expect(button(page, 'Exit walkthrough')).toBeVisible();
  receipt.savedAfterPlay = await savedProjects(page);
  assert.deepEqual(receipt.savedAfterPlay, receipt.savedBeforePlay, 'Playing must not resave the previous project.');
  assert.deepEqual(receipt.errors, []);
  receipt.status = 'PASS';
} catch (error) {
  receipt.status = 'FAIL'; receipt.failures.push(error.stack ?? String(error)); process.exitCode = 1;
} finally {
  receipt.captureCloseBeforeEpochMs = Date.now();
  try {
    await context.close(); receipt.captureCloseAfterEpochMs = Date.now();
    if (video) {
      const file = path.join(out, 'neptune-v5-raw.webm'); await video.saveAs(file);
      const bytes = await fs.readFile(file);
      receipt.media = { file: path.basename(file), bytes: bytes.length, sha256: hash(bytes), cuts: [] };
    }
  } catch (error) { receipt.status = 'FAIL'; receipt.failures.push(error.stack ?? String(error)); process.exitCode = 1; }
  finally { await browser.close(); }
  receipt.completedAt = new Date().toISOString();
  // Precise observed intervals use the browser clock. verify.mjs adds measured
  // raw-video intervals with an explicitly retained capture-origin uncertainty.
  await fs.writeFile(path.join(out, 'shots.json'), JSON.stringify({ artifact: receipt.artifact, campaignIdentity: receipt.campaign?.result.campaignIdentity, source: receipt.localSource,
    clock: 'Observed performance.now in the application document; no requested dwell durations are substituted.', shots: receipt.shots }, null, 2) + '\n');
  const transcript = [
    'NEPTUNE Visual V5 — actual displayed presentation transcript',
    'Simulated, design-stage prototype; physical validation pending.',
    `Fixture: ${fixture}. Playback status: ${receipt.status}.`,
    'Times below are observed seconds since the Play presentation action completed; raw footage also retains all preparation and loading.',
    ...receipt.shots.map(item => `\n[${((item.readableBrowserTimeMs - (receipt.playActionAfter?.browserTimeMs ?? 0)) / 1000).toFixed(3)} s] ${item.heading ?? item.id}\n${item.caption ?? '[No readable caption reached]'}\nRequested marker ${item.requestedTimeS} s; displayed canonical boundary ${item.displayedTimeS} s.\nRun ${item.runId}; source ${item.sourceIdentity}.`),
  ].join('\n');
  await fs.writeFile(path.join(out, 'transcript.txt'), transcript + '\n');
  await persist();
  console.log(JSON.stringify({ status: receipt.status, out, shots: receipt.shots.length, media: receipt.media, failures: receipt.failures }));
}

/** Decode and seek the actual V5 recording. Never edits or retimes its frames.
 * node scripts/visual-v5/verify.mjs --recording=/external/capture --out=/external/verification
 * Optional --ffmpeg=/installed/playwright/ffmpeg binary (metadata inspection).
 */
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { argument, externalDirectory, hash } from './common.mjs';

const recordingDir = path.resolve(argument('recording') ?? ''), out = await externalDirectory(argument('out'));
assert(argument('recording'), 'Pass --recording=/absolute/capture-directory.');
const recording = JSON.parse(await fs.readFile(path.join(recordingDir, 'recording.json'), 'utf8'));
assert.equal(recording.status, 'PASS', 'Do not certify an unsuccessful recording.');
const file = path.join(recordingDir, recording.media.file), bytes = await fs.readFile(file);
assert.equal(hash(bytes), recording.media.sha256);
let ffmpeg = argument('ffmpeg');
if (!ffmpeg) {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright'));
  for (const entry of (await fs.readdir(cache)).filter(name => name.startsWith('ffmpeg-')).sort().reverse()) {
    const names = await fs.readdir(path.join(cache, entry));
    const name = names.find(value => /^ffmpeg(?:-mac|-linux|\.exe)?$/.test(value));
    if (name) { ffmpeg = path.join(cache, entry, name); break; }
  }
}
assert(ffmpeg, 'A local FFmpeg binary is required to inspect the encoder creation timestamp.');
const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
const metadata = probe.stderr ?? '', stamp = metadata.match(/creation_time\s*:\s*(\S+)/)?.[1];
const creationTimeMs = Date.parse(stamp ?? '');
assert(Number.isFinite(creationTimeMs), 'Recording must carry actual encoder creation_time metadata.');
const origin = recording.beforePlay.timeOriginMs;
assert(Number.isFinite(origin));
const predictedVideoTime = browserTimeMs => (origin + browserTimeMs - creationTimeMs) / 1000;
const receipt = {
  kind: 'V5 actual video playback and caption-frame verification', schemaVersion: 1,
  artifact: recording.artifact, recordingSha256: hash(await fs.readFile(path.join(recordingDir, 'recording.json'))),
  video: { file: recording.media.file, bytes: bytes.length, sha256: hash(bytes), encoderCreationTime: stamp },
  timingMethod: 'Encoder creation_time and observed browser timeOrigin/performance.now seed searches in the raw video. Actual decoded caption crops then bracket each readable interval; metadata-mapped navigation times are separately labeled estimates. No storyboard dwell substitutes for observation.',
  timingLimit: 'Video is 25 fps and recorder observation is sampled. Encoder metadata is not sufficient alone: decoded title/caption agreement and manual scene/time review are also required. Final stop-frame padding is not used as a timing anchor.',
  cuts: [], frames: [], failures: [],
};
const server = createServer((request, response) => {
  if (request.url === '/video.webm') {
    const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/), start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (start >= bytes.length || end < start) { response.writeHead(416); response.end(); return; }
    response.writeHead(match ? 206 : 200, { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(match ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) });
    createReadStream(file, { start, end }).pipe(response);
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Actual NEPTUNE V5 recording verification</title><style>html,body{margin:0;background:#0b141d}video{display:block;width:100vw;height:100vh;object-fit:contain}</style><video muted playsinline preload="auto" src="/video.webm"></video>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: recording.viewport, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  await page.evaluate(() => document.querySelector('video').play());
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.25);
  await page.evaluate(() => { const video = document.querySelector('video'); video.pause(); if (!Number.isFinite(video.duration)) video.currentTime = 1e10; });
  await page.waitForFunction(() => Number.isFinite(document.querySelector('video').duration));
  receipt.playback = await page.evaluate(() => { const video = document.querySelector('video'); return { durationS: video.duration, width: video.videoWidth, height: video.videoHeight, error: video.error, support: video.canPlayType('video/webm'), quality: video.getVideoPlaybackQuality() }; });
  receipt.browser = browser.version();
  assert(!receipt.playback.error && receipt.playback.width > 0);
  const seek = async timeS => {
    assert(timeS > 0 && timeS < receipt.playback.durationS);
    await page.evaluate(time => new Promise(resolve => {
      const video = document.querySelector('video');
      if (Math.abs(video.currentTime - time) < .001 && !video.seeking) { resolve(); return; }
      video.addEventListener('seeked', resolve, { once: true }); video.currentTime = time;
    }), timeS);
    return page.locator('video').screenshot();
  };
  const crop = rect => ({ left: Math.max(0, Math.floor(rect.x)), top: Math.max(0, Math.floor(rect.y)), width: Math.min(recording.viewport.width - Math.max(0, Math.floor(rect.x)), Math.floor(rect.width)), height: Math.min(recording.viewport.height - Math.max(0, Math.floor(rect.y)), Math.floor(rect.height)) });
  const references = new Map();
  for (const shot of recording.shots) {
    assert(shot.captionRect && shot.captionRect.y >= 0 && shot.captionRect.y + shot.captionRect.height <= recording.viewport.height, `Caption was not wholly visible for ${shot.id}`);
    references.set(shot.id, await sharp(path.join(recordingDir, shot.still)).resize(recording.viewport.width, recording.viewport.height).extract(crop(shot.captionRect)).removeAlpha().raw().toBuffer());
  }
  const compare = async (frame, shot) => {
    const reference = references.get(shot.id), actual = await sharp(frame).extract(crop(shot.captionRect)).removeAlpha().raw().toBuffer();
    assert.equal(reference.length, actual.length);
    let total = 0, count = 0, close = 0;
    // Evaluate bright caption glyphs, not a mostly identical dark background.
    for (let i = 0; i < reference.length; i += 3) {
      if ((reference[i] + reference[i + 1] + reference[i + 2]) / 3 < 145) continue;
      const delta = (Math.abs(reference[i] - actual[i]) + Math.abs(reference[i + 1] - actual[i + 1]) + Math.abs(reference[i + 2] - actual[i + 2])) / 3;
      total += delta; count++; if (delta <= 60) close++;
    }
    assert(count > 80, 'A meaningful text crop is required.');
    return { brightTextPixels: count, meanAbsoluteChannelDifference: total / count, fractionWithin60: close / count, matches: total / count <= 40 && close / count >= .85 };
  };
  const probes = [recording.shots[0], recording.shots[Math.floor(recording.shots.length / 2)], recording.shots.at(-1)];
  const offsets = [0, -.12, .12, -.25, .25, -.5, .5, -1, 1];
  let chosen = null;
  receipt.alignmentAttempts = [];
  for (const offsetS of offsets) {
    const results = [];
    for (const shot of probes) {
      const timeS = predictedVideoTime((shot.readableBrowserTimeMs + shot.endBrowserTimeMs) / 2) + offsetS;
      if (timeS <= 0 || timeS >= receipt.playback.durationS) { results.push({ matches: false }); continue; }
      results.push({ id: shot.id, timeS, ...await compare(await seek(timeS), shot) });
    }
    receipt.alignmentAttempts.push({ offsetS, results });
    if (results.every(result => result.matches)) { chosen = offsetS; break; }
  }
  assert(chosen !== null, 'Decoded title/caption crops did not match metadata-mapped observed intervals. Retain failure; inspect media before changing alignment.');
  receipt.alignmentOffsetS = chosen;
  receipt.encodedFPS = Number(metadata.match(/(\d+(?:\.\d+)?) fps/)?.[1]);
  assert(Number.isFinite(receipt.encodedFPS) && receipt.encodedFPS > 0);
  const frameIntervalS = 1 / receipt.encodedFPS;
  const boundary = async (shot, midpoint, direction) => {
    let matched = midpoint;
    const limit = direction < 0 ? Math.max(.001, midpoint - 15) : Math.min(receipt.playback.durationS - .001, midpoint + 15);
    for (let time = midpoint + direction * .25; direction < 0 ? time > limit : time < limit; time += direction * .25) {
      const result = await compare(await seek(time), shot);
      if (result.matches) { matched = time; continue; }
      let unmatched = time;
      while (Math.abs(matched - unmatched) > frameIntervalS) {
        const middle = (matched + unmatched) / 2;
        if ((await compare(await seek(middle), shot)).matches) matched = middle; else unmatched = middle;
      }
      return { matchedS: matched, unmatchedS: unmatched, bracketWidthS: Math.abs(matched - unmatched), boundedByMediaEdge: false };
    }
    const edge = direction < 0 ? .001 : receipt.playback.durationS - .001;
    assert(Math.abs(limit - edge) < .001, `Caption interval for ${shot.id} exceeded bounded decode search.`);
    return { matchedS: matched, unmatchedS: null, mediaEdgeS: edge, bracketWidthS: null, boundedByMediaEdge: true };
  };
  const mappedShots = [];
  for (const shot of recording.shots) {
    const startS = predictedVideoTime(shot.startedBrowserTimeMs) + chosen, readableStartS = predictedVideoTime(shot.readableBrowserTimeMs) + chosen, endS = predictedVideoTime(shot.endBrowserTimeMs) + chosen;
    const timeS = (readableStartS + endS) / 2, frame = await seek(timeS), comparison = await compare(frame, shot);
    const name = `decoded-${String(shot.index + 1).padStart(2, '0')}-${shot.id.replace(/[^a-z0-9-]/gi, '-')}.png`;
    await fs.writeFile(path.join(out, name), frame);
    receipt.frames.push({ shotId: shot.id, timeS, frame: name, sha256: hash(frame), comparison });
    assert(comparison.matches, `Actual decoded caption differs for ${shot.id}; preserve and review.`);
    const readableStart = await boundary(shot, timeS, -1), readableEnd = await boundary(shot, timeS, 1);
    mappedShots.push({ ...shot, videoInterval: {
      metadataMappedNavigationEstimateS: startS, metadataMappedReadableEstimateS: readableStartS, metadataMappedEndEstimateS: endS,
      decodedCaptionStart: readableStart, decodedCaptionEnd: readableEnd, representativeFrameS: timeS,
      timingQualifier: 'Caption appearance brackets are observed by seeking the unchanged raw video. Navigation estimates retain unmeasured encoder first-packet offset and are not frame-exact event times.'
    } });
  }
  await fs.writeFile(path.join(out, 'shots-video.json'), JSON.stringify({ artifact: recording.artifact, source: recording.localSource, video: receipt.video, timingMethod: receipt.timingMethod, cuts: [], shots: mappedShots }, null, 2) + '\n');
  receipt.status = 'PASS';
  receipt.manualReview = 'Pending inspection of decoded frames for scene, caption, canonical time, asset and controls; pixel checks do not replace human/model visual review.';
} catch (error) { receipt.status = 'FAIL'; receipt.failures.push(error.stack ?? String(error)); process.exitCode = 1; }
finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  receipt.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'video-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: receipt.status, out, frames: receipt.frames.length, failures: receipt.failures }));
}

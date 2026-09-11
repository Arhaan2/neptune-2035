/** Decode/play/seek the actual accepted application recording; output stays outside source. */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const argument = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = argument('input'), destination = argument('out');
assert(file && destination, 'Required: --input=/absolute/recording.webm --out=/absolute/external/evidence');
const out = path.resolve(destination), bytes = await fs.readFile(file), size = bytes.length;
await fs.mkdir(out, { recursive: true });
const server = createServer((request, response) => {
  if (request.url === '/recording.webm') {
    const match = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0, end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || end < start) { response.writeHead(416); response.end(); return; }
    response.writeHead(match ? 206 : 200, { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(match ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    createReadStream(file, { start, end }).pipe(response);
  } else {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>NEPTUNE recorded application verification</title><style>body{margin:0;background:#091b24}video{width:100vw;height:100vh;object-fit:contain}</style><video muted playsinline preload="auto" src="/recording.webm"></video>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  const initial = await page.evaluate(async () => {
    const video = document.querySelector('video'); await video.play();
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, error: video.error, support: video.canPlayType('video/webm') };
  });
  assert(initial.width > 0 && initial.height > 0 && !initial.error);
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.25);
  await page.evaluate(() => { const video = document.querySelector('video'); video.pause(); if (!Number.isFinite(video.duration)) video.currentTime = 1e10; });
  await page.waitForFunction(() => Number.isFinite(document.querySelector('video').duration) && document.querySelector('video').duration > 0);
  const duration = await page.evaluate(() => document.querySelector('video').duration);
  const inspected = [];
  for (const fraction of [0.1, 0.3, 0.6, 0.9]) {
    const time = duration * fraction;
    await page.evaluate(time => new Promise(resolve => { const video = document.querySelector('video'); video.addEventListener('seeked', resolve, { once: true }); video.currentTime = time; }), time);
    const frame = `decoded-${Math.round(fraction * 100)}.png`; await page.locator('video').screenshot({ path: path.join(out, frame) });
    inspected.push({ timeS: time, frame });
  }
  const receipt = { recordedFile: path.basename(file), bytes: size, sha256: createHash('sha256').update(bytes).digest('hex'), browser: await browser.version(), ...initial, duration, playbackAdvanced: true, inspected, checkedAt: new Date().toISOString() };
  await fs.writeFile(path.join(out, 'video-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); server.close(); }

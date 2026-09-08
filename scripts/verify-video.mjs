import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
const file = 'assets/demo/neptune-demo.mp4';
const { size } = await stat(file);
const server = createServer((req, res) => {
  if (req.url === '/demo.mp4') {
    const match = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    res.writeHead(match ? 206 : 200, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(match ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>NEPTUNE recording verification</title><style>body{margin:0;background:#091b24}video{width:1280px;height:720px}</style><video muted playsinline preload="auto" src="/demo.mp4"></video>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  const metadata = await page.evaluate(async () => {
    const v = document.querySelector('video');
    await v.play();
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight, error: v.error, codecSupport: v.canPlayType('video/mp4; codecs="avc1.64001f"') };
  });
  await page.waitForFunction(() => document.querySelector('video').currentTime > .5);
  await page.evaluate(() => document.querySelector('video').pause());
  for (const t of [2, 7, 12, 17, 23, 28]) {
    await page.evaluate(time => new Promise(resolve => {
      const v = document.querySelector('video');
      v.addEventListener('seeked', resolve, { once: true });
      v.currentTime = time;
    }), t);
    await page.locator('video').screenshot({ path: `assets/demo/verified-frame-${t}.png` });
  }
  if (metadata.duration < 29.9 || metadata.duration > 30.1 || metadata.width !== 1280 || metadata.height !== 720 || metadata.error) throw new Error('Unexpected video metadata');
  const capture = JSON.parse(await readFile('assets/demo/capture.json', 'utf8'));
  const result = { ...metadata, bytes: size, browser: await browser.version(), playbackAdvanced: true, inspectedSeekSeconds: [2, 7, 12, 17, 23, 28], capture };
  await writeFile('assets/demo/verification.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.close();
}

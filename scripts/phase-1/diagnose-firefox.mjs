/** Bounded synthetic browser diagnosis, never an acceptance gate or recording. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(import.meta.url), root = process.cwd();
const args = process.argv.slice(2), worker = args.includes('--worker');
const cleanupProbe = args.includes('--cleanup-probe');
const closeFallbackProbe = args.includes('--close-fallback-probe');
const out = path.resolve(args.find(a => a.startsWith('--out='))?.slice(6) ?? `artifacts/phase-1/firefox-diagnostic-${Date.now()}`);
const resultFile = path.join(out, 'diagnostic.json');
// The supervisor must never observe a truncated PID-registration snapshot.
const writeResult = value => {
  const temporary = `${resultFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temporary, resultFile);
};
const clean = value => String(value).replaceAll(root, '<checkout>').replaceAll(os.homedir(), '<home>')
  .replace(/https?:\/\/[^\s)]+/g, '<url>').slice(0, 1200);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

if (!worker) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out, { recursive: false });
  const started = performance.now();
  // Vite runs in this worker group. Playwright detaches Firefox into its own group;
  // the worker registers that group before browser operations begin.
  const child = spawn(process.execPath, [script, '--worker', `--out=${out}`, ...(cleanupProbe ? ['--cleanup-probe'] : []), ...(closeFallbackProbe ? ['--close-fallback-probe'] : [])], {
    cwd: root, env: process.env, detached: true, stdio: 'ignore',
  });
  const signalGroup = (pid, signal) => {
    try { process.kill(-pid, signal); return 'signalled'; }
    catch (error) { return error.code === 'ESRCH' ? 'absent' : error.code; }
  };
  const finish = new Promise(resolve => {
    child.once('error', error => resolve({ error: clean(error) }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  let watchdog, interrupt;
  const interrupted = new Promise(resolve => { interrupt = signal => resolve({ supervisorSignal: signal }); });
  const onInterrupt = () => interrupt('SIGINT'), onTerminate = () => interrupt('SIGTERM');
  process.once('SIGINT', onInterrupt); process.once('SIGTERM', onTerminate);
  const exit = await Promise.race([finish, interrupted, new Promise(resolve => {
    watchdog = setTimeout(() => resolve({ budgetExpired: true }), cleanupProbe ? 20_000 : 88_000);
  })]);
  clearTimeout(watchdog);
  let result;
  try { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')); }
  catch { result = { kind: 'diagnostic-only', status: 'INCOMPLETE', stages: [] }; }
  const groups = [...new Set([child.pid, ...(result.activeBrowserGroups ?? [])])];
  const cleanup = groups.map(pid => ({ pid, term: signalGroup(pid, 'SIGTERM') }));
  await wait(200);
  for (const group of cleanup) group.kill = signalGroup(group.pid, 'SIGKILL');
  await wait(200);
  for (const group of cleanup) group.finalCheck = signalGroup(group.pid, 0);
  result.supervisor = { ...exit, elapsedMs: performance.now() - started, budgetMs: cleanupProbe ? 21_000 : 89_000, cleanup, registeredGroupsAbsent: cleanup.every(group => group.finalCheck === 'absent') };
  if (exit.budgetExpired || exit.supervisorSignal || exit.code !== 0 || !result.supervisor.registeredGroupsAbsent) result.status = 'INCOMPLETE';
  writeResult(result);
  process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate);
  console.log(`Firefox diagnostic ${result.status}: ${path.relative(root, resultFile)}`);
  // Observed stalls remain data; the separate complete acceptance gate must run.
  process.exitCode = result.status === 'INCOMPLETE' ? 1 : 0;
} else {
  await diagnose();
}

async function diagnose() {
  const started = performance.now(), activeBudgetMs = 82_000;
  const result = {
    kind: 'diagnostic-only', status: 'INCOMPLETE', startedAt: new Date().toISOString(),
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    scriptSha256: createHash('sha256').update(fs.readFileSync(script)).digest('hex'),
    sourceStatus: clean(execFileSync('git', ['status', '--short'], { encoding: 'utf8' })),
    host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), node: process.version },
    viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1,
    limitations: [
      'Native 3-second observations and ordinary actions, not acceptance tests or a causal conclusion.',
      'Software WebRender changes browser compositing; WebGL renderer strings alone cannot establish the active compositor.',
      'Variants run sequentially in fresh browsers; cold module compilation and host load can affect comparisons.',
      'No screenshots, traces, recordings, observation imports, simulation steps, or external data are collected.',
    ],
    preferenceSources: [
      'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/modules/libpref/init/StaticPrefList.yaml#L8119-L8123',
      'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/gfx/config/gfxConfigManager.cpp#L167-L169',
      'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/gfx/thebes/gfxPlatform.cpp#L3350-L3396',
    ],
    stages: [], variants: [], activeBrowserGroups: [], cleanupProbe, closeFallbackProbe,
  };
  const save = () => writeResult(result);
  save();
  async function stage(name, operation, timeoutMs = 3000, list = result.stages) {
    const at = performance.now(), remaining = activeBudgetMs - (at - started);
    const record = { name, startedAfterMs: at - started };
    list.push(record); save();
    let timer;
    try {
      if (remaining <= 0) throw Error('Global diagnostic work budget exhausted');
      record.value = await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Diagnostic operation deadline exceeded')), Math.min(timeoutMs, remaining)); }),
      ]);
      record.outcome = 'completed';
      return record.value;
    } catch (error) {
      record.outcome = 'error'; record.error = clean(error); throw error;
    } finally { clearTimeout(timer); record.elapsedMs = performance.now() - at; save(); }
  }
  let vite, browser, browserServer, stopping = false;
  try {
    const supplied = process.env.NEPTUNE_BASE_URL || process.env.BASE_URL;
    let base = supplied || 'http://127.0.0.1:5183/';
    const url = new URL(base);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) throw Error('Diagnostic base URL must be a plain local HTTP URL');
    if (!supplied) {
      await stage('owned-vite-ready', async () => {
        const { createServer } = await import('vite');
        // Bind the actual owned server once. CLI colors and another process's
        // HTTP response cannot establish readiness for this server.
        vite = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 5183, strictPort: true, open: false } });
        if (stopping) { await vite.close(); throw Error('Diagnostic startup was cancelled'); }
        await vite.listen();
        if (stopping) { await vite.close(); throw Error('Diagnostic startup was cancelled'); }
        const address = vite.httpServer?.address();
        if (!vite.httpServer?.listening || !address || typeof address === 'string' || address.address !== '127.0.0.1' || address.port !== 5183) {
          throw Error('Owned Vite did not bind the required loopback socket');
        }
        for (;;) {
          if (stopping) throw Error('Diagnostic startup was cancelled');
          try {
            const response = await fetch(base, { signal: AbortSignal.timeout(500) });
            if (response.ok) return { port: address.port, address: address.address, listening: true, httpStatus: response.status, readiness: 'owned-vite-api' };
          } catch {}
          await wait(100);
        }
      }, 8000);
    }
    result.server = { owned: !supplied, port: Number(url.port) || 80 };
    const { firefox } = await import('playwright');
    const variants = [
      { name: 'headless-software-clock-60', prefs: { 'layout.frame_rate': 60 } },
      { name: 'headless-software-clock-60-software-webrender', prefs: { 'layout.frame_rate': 60, 'gfx.webrender.software': true } },
      { name: 'headless-default-clock', prefs: {} },
    ];
    for (const variant of variants) {
      if (performance.now() - started > activeBudgetMs - 10_000) break;
      const data = { ...variant, stages: [], pages: [] }; result.variants.push(data); save();
      try {
        await stage('launch-firefox', async () => {
          browserServer = await firefox.launchServer({ host: '127.0.0.1', headless: true, firefoxUserPrefs: variant.prefs, timeout: 5000 });
          result.activeBrowserGroups.push(browserServer.process().pid); save();
          browser = await firefox.connect(browserServer.wsEndpoint(), { timeout: 2000 });
          return { browserVersion: browser.version() };
        }, 7500, data.stages);
        if (cleanupProbe) {
          result.intentionalCleanupProbe = 'A real launched Firefox is left open until the supervisor deadline.'; save();
          await new Promise(() => {});
        }
        for (const scene of ['blank', 'legacy', 'twin']) {
          const pageData = { scene, stages: [] }; data.pages.push(pageData); save();
          let context;
          try {
            let page;
            await stage('create-isolated-page', async () => {
              context = await browser.newContext({ viewport: result.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
              page = await context.newPage(); page.setDefaultTimeout(3500);
              await page.addInitScript(observeNativeProgress);
            }, 3000, pageData.stages);
            await stage('navigate', async () => {
              const response = await page.goto(scene === 'blank' ? 'about:blank' : new URL(scene === 'legacy' ? '?legacy=1' : './', base).href, { waitUntil: 'domcontentloaded', timeout: 8000 });
              return { httpStatus: response?.status() ?? null };
            }, 8500, pageData.stages);
            await stage('bring-to-front', () => page.bringToFront(), 2000, pageData.stages);
            if (scene !== 'blank') {
              // Timer polling keeps readiness measurement separate from rAF stability.
              try { await stage('dom-ready', () => page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-ready') === 'true', null, { polling: 100, timeout: 4000 }).then(handle => handle.dispose()), 4500, pageData.stages); } catch {}
            }
            await stage('evaluate-before', () => page.evaluate(snapshot), 2500, pageData.stages);
            await stage('reset-native-counters', () => page.evaluate(() => window.__NEPTUNE_NATIVE_DIAGNOSTIC__.reset()), 2000, pageData.stages);
            await stage('native-observation-3000ms', () => wait(3000), 3100, pageData.stages);
            await stage('evaluate-after', () => page.evaluate(snapshot), 2500, pageData.stages);
            if (scene !== 'blank') {
              const button = page.getByRole('button', scene === 'twin' ? { name: 'Cooling close-up', exact: true } : { name: /^X-ray/ });
              try { await stage('normal-locator-click', () => button.click({ timeout: 3500 }), 4000, pageData.stages); } catch {}
              await stage('evaluate-after-click', () => page.evaluate(snapshot), 2500, pageData.stages);
            }
          } catch (error) { pageData.error = clean(error); }
          finally {
            if (context) await stage('close-context', () => context.close(), 1500, pageData.stages);
            save();
          }
        }
      } catch (error) { data.error = clean(error); }
      finally {
        if (browserServer) {
          const ownedServer = browserServer, pid = ownedServer.process().pid;
          try {
            if (closeFallbackProbe && result.variants.length === 1) {
              data.intentionalCloseFallbackProbe = 'Only the first graceful-close operation is stalled; the real Firefox remains open for public BrowserServer.kill().';
              save();
            }
            await stage('close-browser', () => closeFallbackProbe && result.variants.length === 1 ? new Promise(() => {}) : ownedServer.close(), 2000, data.stages);
          } catch {
            // Keep the graceful-close error in stages. A killed, verified-absent
            // browser cannot strand later fresh variants in the same process.
            await stage('force-kill-browser', () => ownedServer.kill(), 2000, data.stages);
          }
          await stage('verify-browser-group-absent', async () => {
            const deadline = performance.now() + 1000;
            do {
              try { process.kill(-pid, 0); }
              catch (error) {
                if (error.code === 'ESRCH') return { pid, groupAbsent: true };
                throw error;
              }
              await wait(25);
            } while (performance.now() < deadline);
            throw Error('Owned browser process group remains after cleanup');
          }, 1000, data.stages);
          result.activeBrowserGroups = result.activeBrowserGroups.filter(group => group !== pid);
          browser = undefined; browserServer = undefined;
        }
        save();
      }
    }
    result.status = result.variants.length === 3 && result.variants.every(v => v.pages.length === 3) ? 'COLLECTED' : 'INCOMPLETE';
  } catch (error) { result.error = clean(error); }
  finally {
    stopping = true;
    if (browserServer) await Promise.race([browserServer.close().catch(() => {}), wait(1000)]);
    if (vite) {
      try { await stage('close-owned-vite', () => vite.close(), 2000); }
      catch (error) { result.status = 'INCOMPLETE'; result.error = clean(error); }
    }
    result.completedAt = new Date().toISOString(); result.elapsedMs = performance.now() - started; save();
  }
}

function observeNativeProgress() {
  let start, rafCount, timerCount, maxRafGapMs, maxTimerGapMs, previousRaf, previousTimer;
  let lostEvents = 0, restoredEvents = 0;
  const reset = () => { start = performance.now(); rafCount = timerCount = maxRafGapMs = maxTimerGapMs = 0; previousRaf = previousTimer = start; };
  reset();
  const frame = now => { rafCount++; maxRafGapMs = Math.max(maxRafGapMs, now - previousRaf); previousRaf = now; requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  setInterval(() => { const now = performance.now(); timerCount++; maxTimerGapMs = Math.max(maxTimerGapMs, now - previousTimer); previousTimer = now; }, 100);
  document.addEventListener('webglcontextlost', () => { lostEvents++; }, true);
  document.addEventListener('webglcontextrestored', () => { restoredEvents++; }, true);
  window.__NEPTUNE_NATIVE_DIAGNOSTIC__ = {
    reset,
    read: () => ({ elapsedMs: performance.now() - start, rafCount, timerCount, maxRafGapMs, maxTimerGapMs, sinceLastRafMs: performance.now() - previousRaf, sinceLastTimerMs: performance.now() - previousTimer, lostEvents, restoredEvents }),
  };
}

function snapshot() {
  const canvas = document.querySelector('canvas[role="img"]');
  const gl = canvas?.getContext('webgl2'); // Existing rendered canvas only; no probe context is created.
  const extension = gl?.getExtension('WEBGL_debug_renderer_info');
  const scene = window.__NEPTUNE_TWIN_SCENE__ || window.__NEPTUNE_SCENE__;
  const keys = ['camera', 'target', 'drawCalls', 'calls', 'geometries', 'textures', 'objects', 'renderedModules', 'totalModules', 'renderedPlatforms', 'renderedRacks', 'renderedNodes', 'inside', 'focus', 'exploded', 'simulationTimeS'];
  return {
    native: window.__NEPTUNE_NATIVE_DIAGNOSTIC__?.read(),
    domReady: document.querySelector('main')?.getAttribute('data-ready') ?? null,
    documentReadyState: document.readyState, visibility: document.visibilityState, focused: document.hasFocus(), dpr: devicePixelRatio,
    canvas: canvas ? { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight } : null,
    webgl: gl ? { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION), unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null, unmaskedVendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null, attributes: gl.getContextAttributes(), contextLost: gl.isContextLost(), drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight } : null,
    scene: scene ? Object.fromEntries(keys.filter(key => key in scene).map(key => [key, scene[key]])) : null,
  };
}

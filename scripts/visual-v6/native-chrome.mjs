/** V6 installed-Chrome device runner. Read-only diagnostics; real UI owns all work. */
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 12000 });
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  argument,
  artifactIdentity,
  assertReadable,
  button,
  externalDirectory,
  observe,
  savedProjects,
} from '../visual-v5/common.mjs';
import {
  visibleControl,
  withVisibleControl,
} from '../../tests/browser/visible-controls.ts';
import { createTelemetryPublisher } from '../telemetry-publisher.mjs';

const url = argument('url'),
  mode = argument('mode') ?? 'startup';
assert(
  url && ['startup', 'frames', 'soak', 'capture', 'cycle-check'].includes(mode),
  'Pass --url, --out and --mode=startup|frames|soak|capture.',
);
const out = await externalDirectory(argument('out'));
const receipt = {
  schemaVersion: 1,
  phase: 'Visual V6',
  mode,
  url,
  startedAt: new Date().toISOString(),
  host: {
    cpu: os.cpus()[0]?.model,
    ramBytes: os.totalmem(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    node: process.version,
  },
  protocol: 'docs/visuals/V6-VALIDATION.md',
  instrumentation:
    'Read-only rAF/completed-frame sampler. No video/screenshots during startup/frames/soak; owner wrappers only in soak. No forced GC or cache clearing.',
  limits:
    'RAF is app cadence, not physical display or GPU completion. GPU/native memory and active timers unavailable. CDP DOM counts are checkpoint-only. Display refresh configuration is recorded separately.',
  budgets: {
    medianFPS: 55,
    p95FrameMs: 25,
    paths: 3,
    minimumPathMs: 60000,
    cycles: 20,
    soakMs: 600000,
  },
  browser: {
    product: 'Installed Google Chrome',
    channel: 'chrome',
    headless: false,
  },
  failures: [],
  errors: [],
  startups: [],
  paths: [],
  cycles: [],
  captures: [],
};
const persist = () =>
  fs.writeFile(
    path.join(out, 'measurement.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
const attempt = async (action, detail = {}) =>
  fs.appendFile(
    path.join(out, 'actions.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), action, ...detail }) + '\n',
  );
const browser = await chromium.launch({ channel: 'chrome', headless: false });
receipt.browser.version = browser.version();
let context, page, publisher, cdp;
let samplerSequence = 0;
const fail = (condition, message, detail) => {
  if (!condition) receipt.failures.push({ message, detail });
};
const scene = () => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__);
const panel = () => page.getByTestId('operator-walkthrough');
async function create(options = {}) {
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: receipt.nativeDPR,
    reducedMotion: 'no-preference',
    ...options,
  });
  if (!receipt.artifact)
    receipt.artifact = await artifactIdentity(context, url, out);
  await context.addInitScript(() => {
    const startup = {
      installedAtMs: performance.now(),
      firstCompletedSceneAtMs: null,
      firstEpoch: null,
    };
    window.__V6_STARTUP__ = startup;
    window.__V6_VISIBILITY__ = [
      {
        atMs: performance.now(),
        visibility: document.visibilityState,
        focused: document.hasFocus(),
      },
    ];
    document.addEventListener('visibilitychange', () =>
      window.__V6_VISIBILITY__.push({
        atMs: performance.now(),
        visibility: document.visibilityState,
        focused: document.hasFocus(),
      }),
    );
    const tick = () => {
      const s = window.__NEPTUNE_TWIN_SCENE__;
      if (s?.renderEpoch > 0) {
        startup.firstCompletedSceneAtMs = performance.now();
        startup.firstEpoch = s.renderEpoch;
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  if (['soak', 'cycle-check'].includes(mode))
    await context.addInitScript(() => {
      const counts = {
        workersCreated: 0,
        workersTerminated: 0,
        transportsCreated: 0,
        transportsClosed: 0,
        samples: [],
      };
      window.__V6_OWNERS__ = counts;
      const WorkerBase = window.Worker,
        EventSourceBase = window.EventSource;
      window.Worker = class extends WorkerBase {
        closed = false;
        constructor(...args) {
          super(...args);
          counts.workersCreated++;
        }
        terminate() {
          if (!this.closed) {
            this.closed = true;
            counts.workersTerminated++;
          }
          super.terminate();
        }
      };
      window.EventSource = class extends EventSourceBase {
        closed = false;
        constructor(...args) {
          super(...args);
          counts.transportsCreated++;
          this.addEventListener('message', (event) =>
            counts.samples.push(JSON.parse(event.data)),
          );
        }
        close() {
          if (!this.closed) {
            this.closed = true;
            counts.transportsClosed++;
          }
          super.close();
        }
      };
    });
  page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (error) =>
    receipt.errors.push({
      at: new Date().toISOString(),
      message: error.message,
    }),
  );
  await page.bringToFront();
  return page;
}
async function ready() {
  await expect(page.locator('main.twin-app')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await expect
    .poll(async () => (await scene())?.renderEpoch ?? 0)
    .toBeGreaterThan(3);
  assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
  assert.equal(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    false,
  );
}
async function settled() {
  let old,
    epoch = -1,
    stable = 0;
  await expect
    .poll(async () => {
      const s = await scene();
      if (!s || s.renderEpoch === epoch) return stable;
      epoch = s.renderEpoch;
      const pose = [...s.camera, ...s.target];
      stable =
        old &&
        pose.every((v, i) => Math.abs(v - old[i]) <= 1e-5) &&
        !s.cameraTransitioning
          ? stable + 1
          : 0;
      old = pose;
      return stable;
    })
    .toBeGreaterThanOrEqual(3);
  return scene();
}
async function click(name) {
  await attempt('click', { name });
  await withVisibleControl(
    page,
    page.getByRole('button', { name, exact: true, includeHidden: true }),
    (control) => control.click(),
  );
}
async function dock(name) {
  const b = await visibleControl(
    page,
    page.getByRole('button', { name, exact: true, includeHidden: true }),
  );
  if (
    (await b.getAttribute('aria-pressed')) !== 'true' &&
    (await b.getAttribute('aria-expanded')) !== 'true'
  )
    await click(name);
  if (await button(page, 'Expand inspector').isVisible())
    await click('Expand inspector');
}
async function select(id) {
  await dock('Assets');
  await page.getByLabel('Find asset ID', { exact: true }).fill(id);
  await page.getByLabel('Find asset ID', { exact: true }).press('Enter');
  await expect(page.locator('main')).toHaveAttribute('data-selected', id);
  await dock('Inspector');
}
async function details() {
  const summary = panel()
    .locator('summary')
    .filter({ hasText: /^Details$/ });
  if (!(await summary.locator('..').evaluate((e) => e.open)))
    await summary.click();
}
async function shot(label) {
  await details();
  await page
    .getByLabel('Presentation view', { exact: true })
    .selectOption({ label });
  await expect(panel()).toHaveAttribute('data-presentation-status', 'ready');
}
async function exportFile(kind) {
  const summary = page
    .locator('summary')
    .filter({ hasText: /^Project actions$/ });
  if (
    kind === 'project' &&
    !(await summary.locator('..').evaluate((e) => e.open))
  )
    await summary.click();
  const pending = page.waitForEvent('download');
  if (kind === 'project')
    await page
      .getByLabel('Export artifact', { exact: true })
      .selectOption('project');
  else await click('Export decision campaign');
  const d = await pending;
  assert.equal(await d.failure(), null);
  const data = JSON.parse(await fs.readFile(await d.path(), 'utf8'));
  if (kind === 'project') await summary.click();
  return data;
}
async function campaign(fixture = 'transfer', name = 'campaign') {
  await click('Compare');
  await page
    .getByLabel('Decision fixture', { exact: true })
    .selectOption(fixture);
  await click('Start decision campaign');
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute(
    'data-status',
    'completed',
    { timeout: 120000 },
  );
  const data = await exportFile('campaign');
  await fs.writeFile(
    path.join(out, `${name}.json`),
    JSON.stringify(data, null, 2) + '\n',
  );
  await click('Start result walkthrough');
  await expect(panel()).toHaveAttribute('data-status', 'ready');
  return data;
}
async function resources() {
  return page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => ({
      name: e.name,
      startTimeMs: e.startTime,
      durationMs: e.duration,
      transferSize: typeof e.transferSize === 'number' ? e.transferSize : null,
      encodedBodySize:
        typeof e.encodedBodySize === 'number' ? e.encodedBodySize : null,
      decodedBodySize:
        typeof e.decodedBodySize === 'number' ? e.decodedBodySize : null,
    })),
  );
}
async function identity() {
  return page.evaluate(() => {
    const c = document.querySelector('canvas'),
      r = c?.getBoundingClientRect(),
      s = window.__NEPTUNE_TWIN_SCENE__;
    return {
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      canvas: r
        ? {
            width: r.width,
            height: r.height,
            bufferWidth: c.width,
            bufferHeight: c.height,
            scaleX: c.width / r.width,
            scaleY: c.height / r.height,
          }
        : null,
      scene: s,
      currentTimeS: document.querySelector('main')?.dataset.time,
      displayedTimeS: document.querySelector('main')?.dataset.displayTime,
    };
  });
}
async function reveal() {
  await page.evaluate(() => {
    const data = {
      clickAtMs: null,
      readyAtMs: null,
      epoch: window.__NEPTUNE_TWIN_SCENE__?.renderEpoch ?? 0,
    };
    window.__V6_REVEAL__ = data;
    const b = [...document.querySelectorAll('button')].find(
      (e) => e.textContent.trim() === 'Cooling close-up',
    );
    b.addEventListener(
      'click',
      () => {
        data.clickAtMs = performance.now();
        const tick = () => {
          const s = window.__NEPTUNE_TWIN_SCENE__;
          if (s && s.renderEpoch > data.epoch && s.visualKit.status === 'ready')
            data.readyAtMs = performance.now();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { once: true, capture: true },
    );
  });
  await click('Cooling close-up');
  await expect
    .poll(() => page.evaluate(() => window.__V6_REVEAL__.readyAtMs))
    .not.toBeNull();
  return {
    ...(await page.evaluate(() => window.__V6_REVEAL__)),
    identity: await identity(),
    resources: await resources(),
  };
}

function summary(values) {
  const v = [...values].sort((a, b) => a - b),
    q = (p) =>
      v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : null;
  return {
    samples: v.length,
    medianMs: q(0.5),
    medianFPS: q(0.5) ? 1000 / q(0.5) : null,
    p95Ms: q(0.95),
    p99Ms: q(0.99),
    maxMs: v.at(-1) ?? null,
    stalls: Object.fromEntries(
      [50, 100, 250, 1000].map((n) => [
        `over${n}ms`,
        v.filter((x) => x > n).length,
      ]),
    ),
  };
}
async function sampleStart(label) {
  await page.evaluate((label) => {
    const d = {
      start: performance.now(),
      label,
      frames: [],
      changes: [],
      last: null,
      lastKey: '',
      stop: false,
    };
    window.__V6_FRAMES__ = d;
    const tick = (t) => {
      if (d.stop) return;
      const s = window.__NEPTUNE_TWIN_SCENE__,
        p = document.querySelector('[data-testid="operator-walkthrough"]'),
        record = p ? JSON.parse(p.dataset.presentationRecord) : null;
      const state = {
        label: d.label,
        visible: document.visibilityState,
        focused: document.hasFocus(),
        renderEpoch: s?.renderEpoch ?? null,
        transitioning: s?.cameraTransitioning ?? null,
        kit: s?.visualKit?.status ?? null,
        status: p?.dataset.presentationStatus ?? null,
        shot: record?.shotIndex ?? null,
        selected: s?.selectedId ?? null,
        timeS: s?.simulationTimeS ?? null,
      };
      const key = JSON.stringify({ ...state, renderEpoch: undefined });
      if (key !== d.lastKey) {
        d.changes.push({ atMs: t, state, record });
        d.lastKey = key;
      }
      if (d.last !== null)
        d.frames.push({ atMs: t, intervalMs: t - d.last, ...state });
      d.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, label);
}
async function preserveSampler(label) {
  if (!page || page.isClosed()) return;
  const data = await page.evaluate(() => window.__V6_FRAMES__ ?? null);
  if (data)
    await fs.writeFile(
      path.join(out, `sampler-${++samplerSequence}-${label}.json`),
      JSON.stringify(data) + '\n',
    );
}
async function label(value) {
  await preserveSampler('transition');
  await attempt('segment', { label: value });
  await page.evaluate((value) => {
    window.__V6_FRAMES__.label = value;
  }, value);
}
async function sampleStop(name) {
  const raw = await page.evaluate(() => {
    const d = window.__V6_FRAMES__;
    d.stop = true;
    return { ...d, end: performance.now() };
  });
  await fs.writeFile(
    path.join(out, `${name}-raw.json`),
    JSON.stringify(raw) + '\n',
  );
  const moving = {};
  for (const name of [...new Set(raw.frames.map((f) => f.label))].filter(
    (name) => name.endsWith('-moving'),
  )) {
    moving[name] = summary(
      raw.frames.filter((f) => f.label === name).map((f) => f.intervalMs),
    );
    fail(
      moving[name].medianFPS >= 55 && moving[name].p95Ms <= 25,
      `Moving frame target: ${name}`,
      moving[name],
    );
  }
  fail(
    raw.frames.every((f) => f.visible === 'visible'),
    'Hidden frame samples',
    name,
  );
  const result = {
    name,
    durationMs: raw.end - raw.start,
    overall: summary(raw.frames.map((f) => f.intervalMs)),
    moving,
    reading: summary(
      raw.frames
        .filter((f) => f.status === 'playing' && !f.transitioning)
        .map((f) => f.intervalMs),
    ),
    transitions: summary(
      raw.frames
        .filter((f) => f.transitioning || f.status === 'resolving')
        .map((f) => f.intervalMs),
    ),
    raw: `${name}-raw.json`,
  };
  return result;
}
async function orbit(ms = 15000) {
  await page.locator('canvas').focus();
  const before = await scene(),
    start = Date.now();
  let i = 0;
  while (Date.now() - start < ms) {
    await page.keyboard.press(i++ < ms / 1000 ? 'ArrowRight' : 'ArrowLeft');
    const next = start + i * 250 - Date.now();
    if (next > 0) await new Promise((r) => setTimeout(r, next));
  }
  const after = await scene();
  assert(
    Math.hypot(...before.camera.map((v, i) => v - after.camera[i])) > 1e-5,
    'Actual orbit must move camera',
  );
}
async function startup() {
  for (let i = 0; i < 3; i++) {
    await create();
    for (const condition of ['fresh-context', 'warm-reload']) {
      await attempt('startup', { i, condition });
      if (condition === 'fresh-context') await page.goto(url);
      else await page.reload();
      await ready();
      const before = await resources();
      assert(
        !before.some((x) => /\.glb(?:\?|$)/.test(x.name)),
        'Ordinary startup fetched a model',
      );
      const start = await page.evaluate(() => ({
        startup: window.__V6_STARTUP__,
        navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
      }));
      const load = await reveal();
      const visual = load.resources.filter((x) =>
        /\.glb(?:\?|$)|GLTFLoader/.test(x.name),
      );
      const encoded = visual.every((x) => x.encodedBodySize !== null)
        ? visual.reduce((s, x) => s + x.encodedBodySize, 0)
        : null;
      fail(
        encoded !== null && encoded <= 6 * 1024 * 1024,
        'First-reveal asset envelope',
        visual,
      );
      receipt.startups.push({
        index: i + 1,
        condition,
        ...start,
        load,
        observedEncodedVisualBytes: encoded,
      });
      await settled();
      load.settledIdentity = await identity();
      await persist();
    }
    await context.close();
    context = null;
  }
}
async function frames() {
  for (let i = 0; i < 3; i++) {
    await create();
    await page.goto(url);
    await ready();
    await settled();
    await sampleStart('default-campus-moving');
    await orbit();
    await label('default-reveal-transition');
    await reveal();
    await settled();
    await label('default-detail-moving');
    await orbit();
    await label('default-details-transition');
    await select('platform-001/module-02/cdu');
    await click('Cooling close-up');
    await settled();
    await click('Inside module');
    await settled();
    await click('Exit interior');
    await settled();
    await label('real-campaign-setup-and-load');
    await campaign('transfer', `path-${i + 1}-campaign`);
    await label('evaluated-transfer-autoplay');
    await click('Play presentation');
    await expect(panel()).toHaveAttribute(
      'data-presentation-status',
      'completed',
      { timeout: 240000 },
    );
    assertReadable(await observe(page));
    const result = await sampleStop(`path-${i + 1}`);
    fail(result.durationMs >= 60000, 'Path shorter than 60 seconds', result);
    result.final = await observe(page);
    result.resources = await resources();
    receipt.paths.push(result);
    await persist();
    await context.close();
    context = null;
  }
}
async function warmPose() {
  for (const label of [
    '2. Reveal the cooling system',
    '3. Separate fluid circuits',
    '4. Distribution to the racks',
  ])
    await shot(label);
  await shot('1. The evaluated design');
  await settled();
  return identity();
}
async function checkpoint(index) {
  const value = await identity();
  assert.equal(value.visibility, 'visible');
  assert.equal(value.scene.reducedMotion, false);
  assert.equal(
    await page.evaluate(() =>
      window.__V6_VISIBILITY__.every((x) => x.visibility === 'visible'),
    ),
    true,
    'Soak had a hidden document interval',
  );
  if (receipt.cycles.length)
    assert(
      value.scene.renderEpoch > receipt.cycles.at(-1).value.scene.renderEpoch,
      'Completed frames must advance throughout the soak',
    );
  const owners = await page.evaluate(() => {
    const { samples, ...counts } = window.__V6_OWNERS__;
    return {
      ...counts,
      sampleCount: samples.length,
      lastSequence: samples.at(-1)?.sequence ?? null,
    };
  });
  return {
    index,
    at: new Date().toISOString(),
    value,
    owners,
    dom: await cdp.send('Memory.getDOMCounters'),
    heap: await page.evaluate(() =>
      performance.memory
        ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
          }
        : null,
    ),
    savedCount: (await savedProjects(page)).length,
    requests: (await resources()).filter((x) => /\.glb(?:\?|$)/.test(x.name))
      .length,
  };
}
async function canonicalCampus() {
  if (await button(page, 'Presentation focus').isVisible())
    await click('Presentation focus');
  await shot('1. The evaluated design');
  await settled();
}
async function cycle(index) {
  await attempt('cycle-start', { index });
  // Keep the same loaded result and SSE mapping; repeated explicit loads intentionally save prior projects.
  if ((await panel().getAttribute('data-presentation-status')) !== 'paused')
    await click('Pause walkthrough');
  if (await button(page, 'Exit presentation focus').isVisible())
    await click('Exit presentation focus');
  await click('Explore');
  for (const module of ['01', '02']) {
    await select(`platform-001/module-${module}/cdu`);
    await click('Cooling close-up');
    await expect
      .poll(async () => (await scene()).visualKit.status)
      .toBe('ready');
    await click('Explode');
    await click('Explode');
  }
  for (const name of ['Data & replay', 'Inspector']) await dock(name);
  await click('Presentation focus');
  await click('Exit presentation focus');
  await canonicalCampus();
  await click('Play presentation');
  await expect(panel()).toHaveAttribute('data-presentation-status', 'playing');
  await click('Pause walkthrough');
  await click('Resume walkthrough');
  await expect(panel()).toHaveAttribute('data-presentation-status', 'playing');
  await click('Pause walkthrough');
  await click('Next walkthrough step');
  await expect(panel()).toHaveAttribute('data-status', 'ready');
  await click('Previous walkthrough step');
  await expect(panel()).toHaveAttribute('data-status', 'ready');
  const saved = await savedProjects(page);
  await details();
  await click('Restart presentation');
  assert.deepEqual(await savedProjects(page), saved);
  await canonicalCampus();
  await attempt('cycle-complete', { index });
  return checkpoint(index);
}
async function connect() {
  const loaded = await exportFile('project');
  await fs.writeFile(
    path.join(out, 'soak-loaded-project.json'),
    JSON.stringify(loaded, null, 2) + '\n',
  );
  await dock('Data & replay');
  const module = loaded.designSnapshot.modules[0].id;
  const sample = {
    assetId: module,
    metric: 'temperatureK',
    value: 310.15,
    unit: 'K',
    sourceId: 'generated:v6-retained-import',
    evidence: 'generated',
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    sequence: 0,
    quality: ['fixture-generated'],
    mappingVersion: loaded.designSnapshot.revision,
  };
  await page.getByLabel('Import telemetry CSV or JSON').setInputFiles({
    name: 'v6-retained.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([sample])),
  });
  await expect(
    page.getByText('1 accepted; 0 rejected.', { exact: false }),
  ).toBeVisible();
  await page
    .getByText('Raw imports and reset boundaries', { exact: true })
    .click();
  await click('Reset selected source sequence');
  const raw = await page.locator('.twin-data pre').innerText(),
    boundaries = await page
      .locator('.twin-data details')
      .filter({
        has: page
          .locator('summary')
          .filter({ hasText: /^Raw imports and reset boundaries$/ }),
      })
      .innerText();
  publisher = createTelemetryPublisher({
    mappingVersion: loaded.designSnapshot.revision,
    assetId: module,
    intervalMs: 1000,
    allowedOrigins: [new URL(url).origin],
  });
  await new Promise((r) => publisher.server.listen(0, '127.0.0.1', r));
  await page
    .getByLabel('Stream URL', { exact: true })
    .fill(`http://127.0.0.1:${publisher.server.address().port}/events`);
  await click('Connect stream');
  await expect(
    page.getByText('Accepted stream sample.', { exact: false }),
  ).toBeVisible();
  return {
    loaded,
    raw,
    boundaries,
    retained: Number(
      (await page.getByText(/retained replay window:/).innerText()).match(
        /retained replay window: (\d+)/,
      )?.[1],
    ),
    dataOwner: await page.locator('.twin-data').elementHandle(),
  };
}
async function soak() {
  await create();
  await page.goto(url);
  await ready();
  await campaign();
  cdp = await context.newCDPSession(page);
  await warmPose();
  const continuity = await connect();
  await dock('Inspector');
  await canonicalCampus();
  const owner = await page.locator('canvas').elementHandle();
  await cycle('warmup');
  receipt.baseline = await checkpoint('baseline');
  if (mode === 'cycle-check') {
    receipt.cycles.push(await cycle('diagnostic-only'));
    receipt.scope =
      'Harness preflight only; does not satisfy twenty cycles or ten-minute soak.';
    return;
  }
  await sampleStart('early-evaluated-moving');
  await orbit(10000);
  receipt.early = await sampleStop('early-motion');
  await canonicalCampus();
  const start = Date.now();
  let i = 0;
  while (i < 20 || Date.now() - start < 600000) {
    const cp = await cycle(++i);
    receipt.cycles.push(cp);
    const b = receipt.baseline;
    fail(
      cp.value.scene.geometries === b.value.scene.geometries &&
        cp.value.scene.textures === b.value.scene.textures,
      'Warmed GPU object inventory changed',
      {
        index: i,
        before: [b.value.scene.geometries, b.value.scene.textures],
        after: [cp.value.scene.geometries, cp.value.scene.textures],
      },
    );
    fail(
      JSON.stringify(cp.value.scene.visualKit.cache) ===
        JSON.stringify(b.value.scene.visualKit.cache),
      'Warmed cache grew',
      { index: i, cache: cp.value.scene.visualKit.cache },
    );
    fail(
      cp.owners.transportsCreated === b.owners.transportsCreated &&
        cp.owners.transportsClosed === b.owners.transportsClosed,
      'SSE transport replaced',
      { index: i, owners: cp.owners },
    );
    fail(
      cp.owners.workersCreated - cp.owners.workersTerminated ===
        b.owners.workersCreated - b.owners.workersTerminated,
      'Live worker ownership grew',
      { index: i, owners: cp.owners },
    );
    fail(cp.requests === b.requests, 'Duplicate warmed model request', {
      index: i,
    });
    fail(
      [...cp.value.scene.camera, ...cp.value.scene.target].every(
        (x, j) =>
          Math.abs(x - [...b.value.scene.camera, ...b.value.scene.target][j]) <=
          1e-5,
      ),
      'Equivalent campus pose changed',
      { index: i },
    );
    fail(cp.savedCount === b.savedCount, 'Saved projects accumulated', {
      index: i,
    });
    await persist();
  }
  receipt.soakDurationMs = Date.now() - start;
  receipt.visibilityLedger = await page.evaluate(
    () => window.__V6_VISIBILITY__,
  );
  receipt.domTrend = {
    early: receipt.cycles.slice(0, 5).map((x) => x.dom),
    late: receipt.cycles.slice(-5).map((x) => x.dom),
    disposition:
      'Review actual warmed counts; DOM counters include collectible objects and do not prove native memory safety.',
  };
  await sampleStart('late-evaluated-moving');
  await orbit(10000);
  receipt.late = await sampleStop('late-motion');
  await canonicalCampus();
  receipt.final = await checkpoint('final');
  fail(
    await owner.evaluate((e) => e === document.querySelector('canvas')),
    'Canvas owner remounted',
  );
  await click('Exit walkthrough');
  await dock('Data & replay');
  assert.equal(
    await page.locator('.twin-data pre').innerText(),
    continuity.raw,
  );
  assert.equal(
    await page
      .locator('.twin-data details')
      .filter({
        has: page
          .locator('summary')
          .filter({ hasText: /^Raw imports and reset boundaries$/ }),
      })
      .innerText(),
    continuity.boundaries,
  );
  assert(
    await continuity.dataOwner.evaluate(
      (e) => e === document.querySelector('.twin-data'),
    ),
    'DataPanel owner changed',
  );
  const retainedAfter = Number(
    (await page.getByText(/retained replay window:/).innerText()).match(
      /retained replay window: (\d+)/,
    )?.[1],
  );
  assert(
    retainedAfter > continuity.retained,
    'Application replay ingestion did not grow',
  );
  assert.equal(
    await page.getByLabel('Observation source', { exact: true }).inputValue(),
    'generated:local-publisher',
  );
  await expect(
    page.getByText('Accepted stream sample.', { exact: false }),
  ).toBeVisible();
  const samples = await page.evaluate(() => window.__V6_OWNERS__.samples);
  assert(
    samples.length > 20 &&
      samples.every(
        (s, i) =>
          s.sourceId === 'generated:local-publisher' &&
          s.evidence === 'generated' &&
          (!i || s.sequence > samples[i - 1].sequence),
      ),
  );
  receipt.sse = {
    retainedBefore: continuity.retained,
    retainedAfter,
    publisher: publisher.diagnostics,
    samples,
    raw: continuity.raw,
    resetBoundaries: continuity.boundaries,
  };
  await click('Disconnect');
  const finalProject = await exportFile('project');
  const normalize = (x) => {
    const value = structuredClone(x);
    if (value.checkpoint) value.checkpoint.state.solverMs = 0;
    return value;
  };
  assert.deepEqual(normalize(finalProject), normalize(continuity.loaded));
  receipt.canonicalCheckpointPreserved = true;
  await publisher.close();
  publisher = null;
  await persist();
}
async function capture(name) {
  await settled();
  const state = await identity();
  await page.screenshot({
    path: path.join(out, `${name}.png`),
    fullPage: true,
  });
  receipt.captures.push({ name, file: `${name}.png`, ...state });
  await persist();
}
async function captures() {
  await create();
  await page.goto(url);
  await ready();
  await capture('desktop-campus');
  await click('Close panel');
  await capture('desktop-campus-closed');
  await dock('Inspector');
  await select('platform-001/module-01/cdu');
  await click('Cooling close-up');
  await capture('desktop-cdu');
  await click('Explode');
  await capture('desktop-exploded');
  await click('Explode');
  await click('Campus view');
  await click('Operate');
  await page.getByLabel('Experiment', { exact: true }).selectOption('healthy');
  await page
    .getByLabel('Experiment initial conditions', { exact: true })
    .selectOption('cold');
  await click('Prepare experiment for stepping');
  await ready();
  await click('Step 10s');
  await ready();
  await page
    .getByLabel('Inspect history time in seconds', { exact: true })
    .fill('0');
  await click('Inspect history time');
  await expect(page.locator('main')).toHaveAttribute(
    'data-inspection-status',
    'resolved',
  );
  await capture('desktop-history');
  await click('Return to current state');
  await campaign('nominal', 'capture-nominal');
  await click('Exit walkthrough');
  await click('Compare');
  await capture('desktop-compare');
  await context.close();
  context = null;
  await create();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await ready();
  await capture('mobile-compact');
  await dock('Inspector');
  await capture('mobile-expanded');
  await select('platform-001/module-01/cdu');
  await click('Cooling close-up');
  await page
    .locator('summary')
    .filter({ hasText: /^Circuit legend$/ })
    .click();
  await capture('mobile-cdu-legend');
  for (const [width, height] of [
    [768, 1024],
    [844, 390],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await capture(`responsive-${width}-${height}`);
    fail(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Horizontal page overflow',
      { width, height },
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await capture('text-200-percent');
}
try {
  // Ordinary non-emulated window establishes actual device DPR before controlled runs.
  const natural = await browser.newContext({
      viewport: null,
      reducedMotion: 'no-preference',
    }),
    p = await natural.newPage();
  await p.goto(url);
  await expect
    .poll(() =>
      p.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.renderEpoch ?? 0),
    )
    .toBeGreaterThan(3);
  receipt.ordinaryWindow = await p.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    screen: [screen.width, screen.height],
    visibility: document.visibilityState,
  }));
  receipt.nativeDPR = receipt.ordinaryWindow.dpr;
  await p
    .getByRole('button', { name: 'Cooling close-up', exact: true })
    .click();
  await expect
    .poll(() =>
      p.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.visualKit.status),
    )
    .toBe('ready');
  await natural.close();
  receipt.source = {
    trackedClean: !execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=no'],
      { encoding: 'utf8' },
    ).trim(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
      encoding: 'utf8',
    }).trim(),
  };
  if (mode === 'startup') await startup();
  if (mode === 'frames') await frames();
  if (['soak', 'cycle-check'].includes(mode)) await soak();
  if (mode === 'capture') await captures();
} catch (error) {
  await preserveSampler('incomplete').catch((problem) => {
    receipt.failures.push({
      message: 'Sampler recovery failed: ' + problem.message,
    });
  });
  if (page && !page.isClosed())
    receipt.failureState = await identity().catch(() => null);
  receipt.failures.push({ message: error.stack ?? String(error) });
} finally {
  await publisher?.close();
  await context?.close();
  await browser.close();
  receipt.status =
    receipt.failures.length || receipt.errors.length ? 'FAIL' : 'PASS';
  receipt.completedAt = new Date().toISOString();
  await persist();
  console.log(
    JSON.stringify({
      status: receipt.status,
      out,
      mode,
      failures: receipt.failures,
      paths: receipt.paths.map((x) => ({
        name: x.name,
        overall: x.overall,
        moving: x.moving,
      })),
      cycles: receipt.cycles.length,
    }),
  );
  if (receipt.status !== 'PASS') process.exitCode = 1;
}

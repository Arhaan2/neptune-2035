import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { normalizeProject, parseProject, type CurrentProject } from '../../src/twin/persistence/project';
import type { DecisionExport } from '../../src/twin/decision/types';
import { expectNoHorizontalOverflow } from './layout';
import { openPanel, projectActions, withVisibleControl } from './visible-controls';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true, includeHidden: true });
const main = (page: Page) => page.locator('main.twin-app');
const panel = (page: Page) => page.getByTestId('operator-walkthrough');
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('neptune-v2-scenarios') ?? '[]'));
const activate = (page: Page, name: string) => withVisibleControl(page, button(page, name), control => control.click());

async function download(page: Page, action: () => Promise<unknown>) {
  const pending = page.waitForEvent('download'); await action();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const filename = await file.path();
  if (!filename) throw Error('Expected a native artifact download.');
  return fs.readFile(filename, 'utf8');
}
async function project(page: Page): Promise<CurrentProject> {
  await projectActions(page);
  const value = parseProject(await download(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project')));
  await page.locator('summary').filter({ hasText: /^Project actions$/ }).click();
  if (value.schemaVersion !== 3 || !value.checkpoint) throw Error('Current checkpoint required.');
  // Export uses the real project menu and therefore pauses active guidance.
  // Resume explicitly when returning to a manual inspection session.
  if (await panel(page).count() && await panel(page).getAttribute('data-auto-advance') === 'false' && await panel(page).getAttribute('data-presentation-status') === 'paused') {
    await button(page, 'Resume walkthrough').click();
    await expect(panel(page)).toHaveAttribute('data-presentation-status', /ready|completed/);
  }
  return value;
}
async function setup(page: Page, options: { fixture?: string; fallback?: boolean; normalMotion?: boolean } = {}) {
  await page.emulateMedia({ reducedMotion: options.normalMotion ? 'no-preference' : 'reduce' });
  await page.goto(options.fallback ? './?fallback=1' : './');
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await button(page, 'Compare').click();
  await page.getByLabel('Decision fixture', { exact: true }).selectOption(options.fixture ?? 'transfer');
  await activate(page, 'Start decision campaign');
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
}
async function enter(page: Page) {
  await activate(page, 'Start result walkthrough');
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
}
async function observation(page: Page) {
  return panel(page).evaluate(element => ({
    attributes: Object.fromEntries(Object.entries((element as HTMLElement).dataset)),
    record: JSON.parse(element.getAttribute('data-presentation-record') ?? 'null'),
    caption: element.querySelector('[data-testid="presentation-caption"]')?.textContent,
    scene: window.__NEPTUNE_TWIN_SCENE__,
    visibilityState: document.visibilityState,
  }));
}
async function readable(page: Page) {
  await expect.poll(async () => {
    const value = await observation(page), displayTime = await main(page).getAttribute('data-display-time');
    return Boolean(value.record && value.caption && value.scene && !value.scene.cameraTransitioning &&
      value.scene.renderEpoch > 0 && value.scene.simulationTimeS === Number(displayTime) &&
      value.scene.selectedId === await main(page).getAttribute('data-selected') &&
      (value.record.authoredKind ? value.attributes.readiness === 'authored' : ['authored', 'plan', 'procedural'].includes(value.attributes.readiness ?? '')));
  }).toBe(true);
  return observation(page);
}

test('VIS5 real Play advances an authored shot, pauses immediately and preserves final evidence on restart and exit', async ({ page }, info) => {
  const errors: string[] = [], fetched: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/visuals\/v[23]\/.*\.glb$/.test(request.url())) fetched.push(request.url()); });
  await setup(page, { normalMotion: true });
  expect(fetched).toEqual([]);
  const beforeSaved = await saved(page);
  await enter(page);
  const loaded = normalizeProject(await project(page));
  const loadedSaved = await saved(page);
  expect(loadedSaved).toHaveLength(beforeSaved.length + 1);
  const owner = await page.locator('canvas').elementHandle();
  const source = await panel(page).getAttribute('data-source-identity');
  expect(source).toBeTruthy();
  await button(page, 'Play presentation').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'playing');
  const first = await readable(page);
  const firstShot = Number(first.attributes.shotIndex);
  await expect.poll(async () => Number(await panel(page).getAttribute('data-shot-index'))).toBeGreaterThan(firstShot);
  await button(page, 'Pause walkthrough').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'paused');
  const paused = await observation(page);
  // Pausing a resolved frame retains its caption/source rather than replacing
  // a coherent story with a generic message. An in-flight pause may honestly
  // disclose the unresolved transition.
  if (paused.record.scene && paused.record.scene.status !== 'settling') expect(paused.caption).not.toContain('Guidance is paused');
  await button(page, 'Resume walkthrough').click();
  await button(page, 'Pause walkthrough').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'paused');
  await activate(page, 'Restart presentation');
  await expect(panel(page)).toHaveAttribute('data-shot-index', '0');
  await expect(panel(page)).toHaveAttribute('data-source-identity', source!);
  expect(await saved(page)).toEqual(loadedSaved);
  await button(page, 'Pause walkthrough').click();
  await button(page, 'Next walkthrough step').click();
  await expect(panel(page)).toHaveAttribute('data-step-index', '1');
  await button(page, 'Exit walkthrough').click();
  await expect(panel(page)).toHaveCount(0);
  await expect(main(page)).toHaveAttribute('data-inspection-mode', 'current');
  expect(normalizeProject(await project(page))).toEqual(loaded);
  expect(await saved(page)).toEqual(loadedSaved);
  expect(await owner!.evaluate(element => element === document.querySelector('canvas'))).toBe(true);
  expect(new Set(fetched).size).toBe(fetched.length);
  expect(errors).toEqual([]);
  await info.attach('V5-native-autoplay-purity', { body: JSON.stringify({ first, paused, loaded, savedCount: loadedSaved.length, fetched }), contentType: 'application/json' });
});

test('VIS5 held required authored detail does not consume reading dwell and late completion after exit cannot restore guidance', async ({ page }, info) => {
  let release!: () => void, requests = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/visuals/v2/pump.glb', async route => { requests++; await gate; await route.continue(); });
  try {
    await setup(page);
    await enter(page);
    const loaded = normalizeProject(await project(page));
    await button(page, 'Play presentation').click();
    await expect.poll(() => requests).toBe(1);
    await expect.poll(async () => (await observation(page)).scene?.visualKit.assets.find(item => item.kind === 'pump')?.status).toBe('loading');
    const held = await observation(page);
    expect(held.attributes.presentationStatus).toBe('resolving');
    expect(['pending', 'settling']).toContain(held.attributes.readiness);
    // A real user navigation supersedes the request while its fetch is held.
    await button(page, 'Pause walkthrough').click();
    await button(page, 'Next walkthrough step').click();
    await expect(panel(page)).toHaveAttribute('data-step-index', '1');
    await button(page, 'Exit walkthrough').click();
    release();
    await expect(panel(page)).toHaveCount(0);
    await expect(main(page)).toHaveAttribute('data-inspection-mode', 'current');
    await expect.poll(async () => (await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__))?.simulationTimeS).toBe(Number(await main(page).getAttribute('data-time')));
    expect(normalizeProject(await project(page))).toEqual(loaded);
    await info.attach('V5-delayed-detail-supersession', { body: JSON.stringify({ held, loaded, requests }), contentType: 'application/json' });
  } finally { release(); }
});

test('VIS5 real camera takeover pauses the presentation and preserves the manual pose until explicit resume', async ({ page }, info) => {
  await setup(page);
  await enter(page);
  await button(page, 'Play presentation').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'playing');
  const initial = await readable(page);
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const point = await canvas.evaluate(element => {
    const rect = element.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    return { x, y, owned: document.elementFromPoint(x, y) === element };
  });
  expect(point.owned).toBe(true);
  await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, 120);
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'paused');
  await expect.poll(async () => (await observation(page)).scene?.cameraControl).toBe('manual');
  const manual = await observation(page);
  await button(page, 'Exit presentation focus').click();
  await openPanel(page, 'Inspector');
  await page.setViewportSize({ width: 390, height: 844 });
  const after = await observation(page);
  expect(after.attributes.shotIndex).toBe(manual.attributes.shotIndex);
  expect(after.scene?.cameraControl).toBe('manual');
  await button(page, 'Resume walkthrough').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'playing');
  await readable(page);
  await button(page, 'Pause walkthrough').click();
  await info.attach('V5-native-camera-takeover', { body: JSON.stringify({ initial, manual, after }), contentType: 'application/json' });
});

test('VIS5 390px reduced-motion manual chapters retain keyboard access, actual boundaries and the final decision', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await enter(page);
  const loaded = normalizeProject(await project(page));
  await expect(panel(page)).toHaveAttribute('data-auto-advance', 'false');
  await expect(button(page, 'Exit walkthrough')).toBeVisible();
  const visited: unknown[] = [], count = Number(await panel(page).getAttribute('data-step-count'));
  for (let index = 0; index < count; index++) {
    await expect(panel(page)).toHaveAttribute('data-step-index', String(index));
    await expect(panel(page)).toHaveAttribute('data-status', index === count - 1 ? 'completed' : 'ready');
    await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
    await expectNoHorizontalOverflow(page, 390);
    await expect(button(page, 'Exit walkthrough')).toBeVisible();
    visited.push(await observation(page));
    if (index < count - 1) {
      await button(page, 'Next walkthrough step').focus();
      await expect(button(page, 'Next walkthrough step')).toBeFocused();
      await page.keyboard.press('Enter');
    }
  }
  await expect(button(page, 'Review evidence')).toBeVisible();
  await expect(button(page, 'Review evidence')).toBeInViewport();
  await expect(button(page, 'Exit walkthrough')).toBeInViewport();
  await info.attach('V5-mobile-complete', { body: await page.screenshot(), contentType: 'image/png' });
  await button(page, 'Exit walkthrough').click();
  expect(normalizeProject(await project(page))).toEqual(loaded);
  await info.attach('V5-mobile-manual-source-boundaries', { body: JSON.stringify(visited), contentType: 'application/json' });
});

for (const fixture of ['nominal', 'no-benefit-bus', 'no-benefit-source']) {
  test(`VIS5 ${fixture} ending follows completed campaign evidence and imported provenance`, async ({ page }, info) => {
    await setup(page, { fixture, fallback: true });
    const campaign: DecisionExport = JSON.parse(await download(page, () => activate(page, 'Export decision campaign')));
    await withVisibleControl(page, page.getByLabel('Import decision campaign', { exact: true }), control => control.setInputFiles({
      name: 'supplied-campaign.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(campaign)),
    }));
    await enter(page);
    const loaded = normalizeProject(await project(page));
    const count = Number(await panel(page).getAttribute('data-step-count'));
    for (let index = 0; index < count; index++) {
      await expect(panel(page)).toHaveAttribute('data-status', index === count - 1 ? 'completed' : 'ready');
      if (index < count - 1) await button(page, 'Next walkthrough step').click();
    }
    await expect(panel(page)).toContainText(/imported|supplied/i);
    await expect(panel(page)).toContainText(campaign.result.ranking.status);
    if (fixture !== 'nominal') await expect(panel(page)).toContainText('No evaluated candidate meets');
    expect(campaign.result.ranking.winnerIds).toEqual(fixture === 'nominal' ? ['ii-24'] : []);
    await info.attach(`V5-${fixture}-ending`, { body: await page.screenshot(), contentType: 'image/png' });
    await button(page, 'Exit walkthrough').click();
    expect(normalizeProject(await project(page))).toEqual(loaded);
  });
}

test('VIS5 failed prior-project storage blocks result loading and leaves the active experiment intact', async ({ page }, info) => {
  await setup(page, { fallback: true });
  const before = normalizeProject(await project(page));
  await page.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value as (key: string, value: string) => void;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'neptune-v2-scenarios') throw new DOMException('Intentional V5 prior-project quota fixture', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await activate(page, 'Start result walkthrough');
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(/quota|storage|save|retained/i);
  expect(normalizeProject(await project(page))).toEqual(before);
  await info.attach('V5-storage-failure-retains-active-project', { body: JSON.stringify(before), contentType: 'application/json' });
});

test('VIS5 delayed native history preserves the current camera until resolution and rejects a superseded request', async ({ page }, info) => {
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    const gate = { hold: false, pending: [] as (() => void)[], requests: 0 };
    (window as unknown as { __V5_HISTORY_GATE__: typeof gate }).__V5_HISTORY_GATE__ = gate;
    window.Worker = class extends OriginalWorker {
      postMessage(message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
        const request = message as { version?: number; request?: { timeS: number }; runIdentity?: string };
        const deliver = () => { if (Array.isArray(transfer)) super.postMessage(message, transfer); else super.postMessage(message, transfer); };
        if (gate.hold && request.version === 1 && request.request && request.runIdentity) {
          gate.requests++; gate.pending.push(deliver);
        } else deliver();
      }
    };
  });
  await setup(page); await enter(page);
  const initial = await readable(page);
  await page.evaluate(() => { (window as unknown as { __V5_HISTORY_GATE__: { hold: boolean } }).__V5_HISTORY_GATE__.hold = true; });
  await button(page, 'Next walkthrough step').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'loading');
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'resolving');
  const held = await observation(page);
  expect(held.record.elapsedReadingMs).toBe(0);
  expect(held.scene!.camera).toEqual(initial.scene!.camera);
  expect(held.scene!.target).toEqual(initial.scene!.target);
  await expect(page.getByTestId('presentation-caption')).toContainText('Resolving');
  await button(page, 'Next walkthrough step').click();
  await expect(panel(page)).toHaveAttribute('data-step-index', '2');
  const latestToken = await panel(page).getAttribute('data-request-token');
  await page.evaluate(() => {
    const gate = (window as unknown as { __V5_HISTORY_GATE__: { hold: boolean; pending: (() => void)[] } }).__V5_HISTORY_GATE__;
    gate.hold = false; gate.pending.splice(0).forEach(deliver => deliver());
  });
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  const resolved = await readable(page);
  expect(resolved.attributes.requestToken).toBe(latestToken);
  expect(resolved.record.stepIndex).toBe(2);
  await info.attach('V5-delayed-history-native-transport', { body: JSON.stringify({ initial, held, resolved }), contentType: 'application/json' });
});

test('VIS5 unavailable manual history remains honest and explicit Resume requests the supported chapter', async ({ page }, info) => {
  await setup(page); await enter(page);
  const loaded = normalizeProject(await project(page));
  await withVisibleControl(page, page.getByLabel('Inspect history time in seconds', { exact: true }), control => control.fill('0.3'));
  await activate(page, 'Inspect history time');
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'unavailable-history');
  await expect(main(page)).toHaveAttribute('data-display-time', '');
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'paused');
  await expect(page.getByTestId('presentation-caption')).not.toContainText('24 installed');
  await button(page, 'Resume walkthrough').click();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  await expect(main(page)).toHaveAttribute('data-display-time', '0');
  await button(page, 'Exit walkthrough').click();
  expect(normalizeProject(await project(page))).toEqual(loaded);
  await info.attach('V5-unavailable-manual-history-recovery', { body: JSON.stringify(loaded), contentType: 'application/json' });
});

test('VIS5 a live reduced-motion preference pauses autoplay and context loss retains the checkpoint', async ({ page }, info) => {
  await setup(page, { normalMotion: true }); await enter(page);
  const loaded = normalizeProject(await project(page));
  await button(page, 'Play presentation').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'playing');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'paused');
  const reduced = await observation(page);
  await button(page, 'Resume walkthrough').click();
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'playing');
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.reducedMotion)).toBe(true);
  const supported = await page.locator('canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2'), extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  });
  expect(supported).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'paused');
  await expect(page.getByText(/WebGL is unavailable or fallback was requested/)).toBeVisible();
  await button(page, 'Exit walkthrough').click();
  expect(normalizeProject(await project(page))).toEqual(loaded);
  await info.attach('V5-motion-preference-and-actual-context-loss', { body: JSON.stringify({ reduced, loaded }), contentType: 'application/json' });
});

test('VIS5 reused campaign IDs get a new source generation and price edits retain captured evidence', async ({ page }, info) => {
  await setup(page, { fallback: true });
  const campaign: DecisionExport = JSON.parse(await download(page, () => activate(page, 'Export decision campaign')));
  await enter(page);
  const original = await observation(page), checkpoint = (normalizeProject(await project(page)) as CurrentProject).checkpoint;
  await button(page, 'Compare').click();
  await withVisibleControl(page, page.getByLabel('Equipment cost multiplier', { exact: true }), async control => { await control.fill('1.2'); await control.press('Enter'); });
  const economic = await observation(page);
  expect(economic.record.evidenceIdentity).toBe(original.record.evidenceIdentity);
  expect(economic.record.sourceKey).toBe(original.record.sourceKey);
  expect((normalizeProject(await project(page)) as CurrentProject).checkpoint).toEqual(checkpoint);
  await button(page, 'Exit walkthrough').click();
  await button(page, 'Compare').click();
  expect(JSON.parse(await download(page, () => activate(page, 'Export decision campaign')))).toEqual(campaign);
  await withVisibleControl(page, page.getByLabel('Import decision campaign', { exact: true }), control => control.setInputFiles({ name: 'same-ids-supplied.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(campaign)) }));
  await enter(page);
  const imported = await observation(page);
  expect(imported.record.runId).toBe(original.record.runId);
  expect(imported.record.sourceKey).not.toBe(original.record.sourceKey);
  expect(imported.record.provenance).not.toBe('executed');
  await expect(panel(page)).toContainText('Imported supplied evidence');
  await info.attach('V5-reused-id-source-and-economic-capture', { body: JSON.stringify({ original, economic, imported }), contentType: 'application/json' });
});

import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  normalizeProject,
  parseProject,
} from '../../src/twin/persistence/project';
import { identity } from '../../src/twin/persistence/structure';
import type { DecisionExport } from '../../src/twin/decision/types';
import { projectActions } from './visible-controls';

const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByTestId('operator-walkthrough');
async function exported(page: Page, kind: 'project' | 'campaign') {
  if (kind === 'project') await projectActions(page);
  const pending = page.waitForEvent('download');
  if (kind === 'project')
    await page
      .getByLabel('Export artifact', { exact: true })
      .selectOption('project');
  else await button(page, 'Export decision campaign').click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const value = await fs.readFile((await download.path())!, 'utf8');
  if (kind === 'project')
    await page
      .locator('summary')
      .filter({ hasText: /^Project actions$/ })
      .click();
  return value;
}
async function prepare(page: Page, fixture = 'transfer') {
  page.setDefaultTimeout(12_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await expect(page.locator('main.twin-app')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await button(page, 'Compare').click();
  await page
    .getByLabel('Decision fixture', { exact: true })
    .selectOption(fixture);
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute(
    'data-status',
    'completed',
  );
  const campaign: DecisionExport = JSON.parse(await exported(page, 'campaign'));
  await button(page, 'Start result walkthrough').click();
  await expect(panel(page)).toHaveAttribute('data-status', 'ready');
  return campaign;
}

for (const fixture of [
  'transfer',
  'nominal',
  'no-benefit-bus',
  'no-benefit-source',
]) {
  test(`VIS6 ${fixture} completes every automatic shot with its own evidence and honest ending`, async ({
    page,
  }, info) => {
    // A complete authored presentation includes real dwell, history and camera
    // transitions. Only this journey gets 180s; each native action remains 12s.
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const campaign = await prepare(page, fixture);
    const expectedEvidenceIdentity = identity({
      campaign: campaign.campaign,
      result: campaign.result,
    });
    const loaded = normalizeProject(
      parseProject(await exported(page, 'project')),
    );
    const saved = await page.evaluate(() =>
      localStorage.getItem('neptune-v2-scenarios'),
    );
    // Restore guidance only if the real export menu paused this manual chapter.
    if (
      (await panel(page).getAttribute('data-presentation-status')) === 'paused'
    )
      await button(page, 'Resume walkthrough').click();
    await expect(panel(page)).toHaveAttribute('data-status', 'ready');
    await panel(page).evaluate((element) => {
      const samples: unknown[] = [];
      const read = () => {
        const record = JSON.parse(
          element.getAttribute('data-presentation-record') ?? 'null',
        );
        const scene = window.__NEPTUNE_TWIN_SCENE__;
        if (
          !record ||
          !['playing', 'completed'].includes(record.status) ||
          !scene ||
          scene.cameraTransitioning
        )
          return;
        samples.push({
          record,
          caption: element.querySelector('[data-testid="presentation-caption"]')
            ?.textContent,
          visibility: document.visibilityState,
          selected: scene.selectedId,
          timeS: scene.simulationTimeS,
          displayedTimeS: document
            .querySelector('main')
            ?.getAttribute('data-display-time'),
          renderEpoch: scene.renderEpoch,
        });
      };
      const observer = new MutationObserver(read);
      observer.observe(element, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });
      (
        window as unknown as {
          __V6_ENDING__: { samples: unknown[]; stop: () => void };
        }
      ).__V6_ENDING__ = { samples, stop: () => observer.disconnect() };
    });
    await button(page, 'Play presentation').click();
    await expect(panel(page)).toHaveAttribute(
      'data-presentation-status',
      'completed',
      { timeout: 150_000 },
    );
    const samples = await page.evaluate(() => {
      const monitor = (
        window as unknown as {
          __V6_ENDING__: {
            samples: {
              record: {
                shotIndex: number;
                sourceKey: string;
                runId: string;
                assetId: string;
                caption: string;
                displayedTimeS: number;
                evidenceIdentity: string;
              };
              caption: string;
              visibility: string;
              selected: string;
              timeS: number;
              displayedTimeS: string;
              renderEpoch: number;
            }[];
            stop: () => void;
          };
        }
      ).__V6_ENDING__;
      monitor.stop();
      return monitor.samples;
    });
    const count = Number(await panel(page).getAttribute('data-shot-count'));
    expect([
      ...new Set(samples.map((sample) => sample.record.shotIndex)),
    ]).toEqual(Array.from({ length: count }, (_, i) => i));
    expect(new Set(samples.map((sample) => sample.record.sourceKey)).size).toBe(
      1,
    );
    expect(new Set(samples.map((sample) => sample.record.runId)).size).toBe(1);
    for (const sample of samples) {
      expect(sample.visibility).toBe('visible');
      expect(sample.renderEpoch).toBeGreaterThan(0);
      expect(sample.timeS).toBe(Number(sample.displayedTimeS));
      expect(sample.selected).toBe(sample.record.assetId);
      expect(sample.caption).toBe(sample.record.caption);
      expect(sample.timeS).toBe(sample.record.displayedTimeS);
      expect(
        campaign.result.runs.some(
          (run) => run.id === sample.record.runId && run.status === 'completed',
        ),
      ).toBe(true);
      expect(sample.record.evidenceIdentity).toBe(
        expectedEvidenceIdentity,
      );
      expect(sample.caption).toBeTruthy();
      expect(sample.caption).not.toMatch(/unavailable|Guidance is paused/);
    }
    await expect(panel(page)).toContainText(campaign.result.ranking.status);
    if (fixture.startsWith('no-benefit')) {
      expect(campaign.result.ranking.winnerIds).toEqual([]);
      await expect(panel(page)).toContainText('No evaluated candidate meets');
    }
    expect(
      await page.evaluate(() => localStorage.getItem('neptune-v2-scenarios')),
    ).toBe(saved);
    await info.attach(`V6-${fixture}-automatic-ending`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await info.attach(`V6-${fixture}-automatic-records`, {
      body: JSON.stringify({ campaign, samples }),
      contentType: 'application/json',
    });
    await button(page, 'Exit walkthrough').click();
    expect(
      normalizeProject(parseProject(await exported(page, 'project'))),
    ).toEqual(loaded);
    expect(errors).toEqual([]);
  });
}

test('VIS6 active walkthrough restores authored interaction after intentional context loss without a stale owner', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await prepare(page);
  const loaded = normalizeProject(
    parseProject(await exported(page, 'project')),
  );
  const saved = await page.evaluate(() =>
    localStorage.getItem('neptune-v2-scenarios'),
  );
  if ((await panel(page).getAttribute('data-presentation-status')) === 'paused')
    await button(page, 'Resume walkthrough').click();
  await button(page, 'Play presentation').click();
  await expect(panel(page)).toHaveAttribute(
    'data-presentation-status',
    'playing',
  );
  const source = await panel(page).getAttribute('data-source-identity');
  const previous = await page.locator('canvas').elementHandle();
  expect(
    await page.locator('canvas').evaluate((canvas) => {
      const extension = (canvas as HTMLCanvasElement)
        .getContext('webgl2')
        ?.getExtension('WEBGL_lose_context');
      if (!extension) return false;
      extension.loseContext();
      return true;
    }),
  ).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute(
    'data-presentation-status',
    'paused',
  );
  await expect(
    page.getByText(/WebGL is unavailable or fallback was requested/),
  ).toBeVisible();
  await button(page, 'Restore 3D view').click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.renderEpoch ?? 0),
    )
    .toBeGreaterThan(3);
  expect(await previous!.evaluate((element) => element.isConnected)).toBe(
    false,
  );
  await button(page, 'Resume walkthrough').click();
  await expect(panel(page)).toHaveAttribute(
    'data-presentation-status',
    'playing',
  );
  await panel(page)
    .locator('summary')
    .filter({ hasText: /^Details$/ })
    .click();
  await page
    .getByLabel('Presentation view', { exact: true })
    .selectOption({ label: '2. Reveal the cooling system' });
  await expect(panel(page)).toHaveAttribute('data-readiness', 'authored');
  await expect(panel(page)).toHaveAttribute(
    'data-presentation-status',
    'ready',
  );
  expect(await panel(page).getAttribute('data-source-identity')).toBe(source);
  expect(
    await page.evaluate(() => localStorage.getItem('neptune-v2-scenarios')),
  ).toBe(saved);
  await info.attach('V6-intentional-context-restored', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await button(page, 'Exit walkthrough').click();
  expect(
    normalizeProject(parseProject(await exported(page, 'project'))),
  ).toEqual(loaded);
});

test('VIS6 normal-motion interior entry and waypoints settle without exterior orbit constraints', async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await expect(page.locator('main.twin-app')).toHaveAttribute(
    'data-ready',
    'true',
  );
  for (const module of ['01', '02']) {
    await button(page, 'Assets').click();
    await page
      .getByLabel('Find asset ID', { exact: true })
      .fill(`platform-001/module-${module}/cdu`);
    await page.getByLabel('Find asset ID', { exact: true }).press('Enter');
    await button(page, 'Inspector').click();
    await button(page, 'Cooling close-up').click();
    await expect
      .poll(() =>
        page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.cameraTransitioning),
      )
      .toBe(false);
    await button(page, 'Inside module').click();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          inside: window.__NEPTUNE_TWIN_SCENE__?.inside,
          transitioning: window.__NEPTUNE_TWIN_SCENE__?.cameraTransitioning,
        })),
      )
      .toEqual({ inside: true, transitioning: false });
    const previousEpoch = await page.evaluate(
      () => window.__NEPTUNE_TWIN_SCENE__!.renderEpoch,
    );
    await button(page, module === '01' ? 'Rack aisle' : 'Cooling bay').click();
    await expect
      .poll(() =>
        page.evaluate((epoch) => {
          const scene = window.__NEPTUNE_TWIN_SCENE__!;
          return scene.renderEpoch > epoch && !scene.cameraTransitioning;
        }, previousEpoch),
      )
      .toBe(true);
    const before = await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__!);
    expect(Math.abs(before.camera[1] - before.target[1])).toBeLessThan(0.00001);
    await page.locator('canvas').focus();
    await page.keyboard.down('w');
    await expect
      .poll(() =>
        page.evaluate((initial) => {
          const camera = window.__NEPTUNE_TWIN_SCENE__!.camera;
          return Math.hypot(
            ...camera.map((value, index) => value - initial[index]),
          );
        }, before.camera),
      )
      .toBeGreaterThan(0.05);
    await page.keyboard.up('w');
    await button(page, 'Exit interior').click();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          inside: window.__NEPTUNE_TWIN_SCENE__?.inside,
          transitioning: window.__NEPTUNE_TWIN_SCENE__?.cameraTransitioning,
        })),
      )
      .toEqual({ inside: false, transitioning: false });
  }
});

test('VIS6 dragging over a scene mesh preserves manual ownership while genuine authored clicks still select', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  const loaded = normalizeProject(parseProject(await exported(page, 'project')));
  const saved = await page.evaluate(() => localStorage.getItem('neptune-v2-scenarios'));
  const source = await panel(page).getAttribute('data-source-identity');
  const main = page.locator('main.twin-app');
  const snapshot = () => page.evaluate(() => {
    const scene = window.__NEPTUNE_TWIN_SCENE__;
    const element = document.querySelector('[data-testid="operator-walkthrough"]');
    if (!scene || !element) throw Error('Expected an actual rendered walkthrough');
    const record = JSON.parse(element.getAttribute('data-presentation-record')!) as {
      status: string; shotIndex: number; assetId: string; sourceKey: string;
      displayedTimeS: number; readiness: string; automatic: boolean; caption: string;
    };
    return { scene, record, selected: document.querySelector('main')!.getAttribute('data-selected'),
      currentTime: document.querySelector('main')!.getAttribute('data-time'),
      displayTime: document.querySelector('main')!.getAttribute('data-display-time'),
      caption: element.querySelector('[data-testid="presentation-caption"]')?.textContent,
      visibility: document.visibilityState, focused: document.hasFocus() };
  });
  const poseDelta = (a: {camera: number[]; target: number[]}, b: {camera: number[]; target: number[]}) =>
    Math.max(...a.camera.map((v, i) => Math.abs(v - b.camera[i])), ...a.target.map((v, i) => Math.abs(v - b.target[i])));
  const settled = async () => {
    let previous: Awaited<ReturnType<typeof snapshot>> | undefined, stable = 0;
    await expect.poll(async () => {
      const next = await snapshot();
      if (next.scene.cameraTransitioning) stable = 0;
      else if (previous && next.scene.renderEpoch !== previous.scene.renderEpoch)
        stable = poseDelta(next.scene, previous.scene) <= 1e-5 ? stable + 1 : 0;
      previous = next;
      return stable;
    }, { timeout: 12_000, intervals: [100] }).toBeGreaterThanOrEqual(3);
    return previous!;
  };
  const details = panel(page).locator('summary').filter({ hasText: /^Details$/ });
  if (!await details.locator('..').evaluate(e => (e as HTMLDetailsElement).open)) await details.click();
  await page.getByLabel('Presentation view', { exact: true }).selectOption({ label: '2. Reveal the cooling system' });
  await expect(panel(page)).toHaveAttribute('data-presentation-status', 'ready', { timeout: 12_000 });
  await expect(panel(page)).toHaveAttribute('data-readiness', 'authored', { timeout: 12_000 });
  await button(page, 'Play presentation').click();
  await expect.poll(async () => {
    const s = await snapshot();
    return s.record.status === 'playing' && s.record.shotIndex === 1 && s.record.readiness === 'authored' && !s.scene.cameraTransitioning;
  }, { timeout: 12_000 }).toBe(true);
  const before = await settled();
  expect(before.record.status).toBe('playing');
  expect(before.record.shotIndex).toBe(1);
  expect(before.record.automatic).toBe(true);
  expect(before.selected).toBe(before.record.assetId);
  expect(before.scene.selectedId).toBe(before.record.assetId);
  expect(before.scene.simulationTimeS).toBe(before.record.displayedTimeS);
  expect(before.caption).toBe(before.record.caption);
  expect(before.visibility).toBe('visible');
  expect(before.focused).toBe(true);

  type PointerRow = { type: string; trusted: boolean; x: number; y: number; buttons: number; delta: number; targetIsCanvas: boolean };
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const rows: {type: string; trusted: boolean; x: number; y: number; buttons: number; delta: number; targetIsCanvas: boolean}[] = [];
    let down = { x: 0, y: 0 };
    const read = (e: PointerEvent | MouseEvent) => {
      if (e.type === 'pointerdown') down = { x: e.clientX, y: e.clientY };
      rows.push({type:e.type,trusted:e.isTrusted,x:e.clientX,y:e.clientY,buttons:e.buttons,delta:Math.hypot(e.clientX-down.x,e.clientY-down.y),targetIsCanvas:e.target===canvas});
    };
    const types = ['pointerdown','pointermove','pointerup','click'] as const;
    for (const type of types) canvas.addEventListener(type,read,{capture:true,passive:true});
    (window as unknown as {__V6_DRAG_INPUT__: {rows: typeof rows; stop: () => void}}).__V6_DRAG_INPUT__ = {
      rows, stop: () => { for (const type of types) canvas.removeEventListener(type,read,true); },
    };
  });
  const trace: Record<string, unknown> = { before };
  try {
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw Error('Expected actual canvas bounds');
    // This is the intersected pump/platform route from native Safari069, not an
    // empty-ocean drag. Its before-fix run must reproduce the selection override.
    const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    expect(await page.evaluate(p => document.elementFromPoint(p.x,p.y)?.tagName, start)).toBe('CANVAS');
    await page.mouse.move(start.x,start.y);
    await page.mouse.down();
    try {
      for (let step = 1; step <= 8; step++) {
        await page.mouse.move(start.x + step * 10,start.y + step * 2.5);
        await page.waitForTimeout(31); // A single approximately250ms held drag.
      }
    } finally { await page.mouse.up(); }
    await expect(panel(page)).toHaveAttribute('data-presentation-status','paused',{timeout:12_000});
    await expect.poll(async () => (await snapshot()).scene.cameraControl,{timeout:12_000}).toBe('manual');
    const manual = await settled();trace.manual=manual;
    expect(manual.selected).toBe(before.selected);
    expect(manual.scene.selectedId).toBe(before.selected);
    expect(poseDelta(manual.scene,before.scene)).toBeGreaterThan(1e-5);
    await page.waitForTimeout(700);
    const held=await snapshot();trace.held=held;
    expect(held.scene.cameraControl).toBe('manual');
    expect(held.scene.cameraTransitioning).toBe(false);
    expect(poseDelta(held.scene,manual.scene)).toBeLessThanOrEqual(1e-5);
    expect(held.selected).toBe(before.selected);
    expect(held.record.shotIndex).toBe(before.record.shotIndex);
    expect(held.record.sourceKey).toBe(before.record.sourceKey);
    expect(held.currentTime).toBe(before.currentTime);
    const input=await page.evaluate(() => (window as unknown as {__V6_DRAG_INPUT__: {rows: PointerRow[]}}).__V6_DRAG_INPUT__.rows);
    trace.dragInput=input;
    expect(input.some(e=>e.type==='pointerdown'&&e.trusted&&e.buttons===1&&e.targetIsCanvas)).toBe(true);
    expect(input.some(e=>e.type==='pointermove'&&e.trusted&&e.buttons===1&&e.delta>2&&e.targetIsCanvas)).toBe(true);
    expect(input.some(e=>e.type==='pointerup'&&e.trusted&&e.buttons===0&&e.delta>2)).toBe(true);
    expect(input.some(e=>e.type==='click'&&e.trusted&&e.delta>2)).toBe(true);

    // A different real authored child remains pickable after the drag guard.
    const asset=held.scene.visualKit.assets.find(a=>a.kind==='cdu'&&a.assetId!==held.selected&&a.childWorldPoint&&a.renderedMeshes>0);
    if (!asset?.childWorldPoint) throw Error('Expected a different visible authored CDU surface');
    const currentBox=await page.locator('canvas').boundingBox();
    if (!currentBox) throw Error('Expected current canvas bounds');
    const camera=new PerspectiveCamera(46,currentBox.width/currentBox.height,.1,10000);
    camera.position.fromArray(held.scene.camera);camera.lookAt(new Vector3().fromArray(held.scene.target));camera.updateMatrixWorld();
    const point=new Vector3().fromArray(asset.childWorldPoint).project(camera);
    expect(Math.abs(point.x)).toBeLessThan(1);expect(Math.abs(point.y)).toBeLessThan(1);
    // Whole CSS pixels keep pointer and click event coordinates identical across engines.
    const clickPoint={x:Math.round(currentBox.x+(point.x+1)*currentBox.width/2),y:Math.round(currentBox.y+(1-point.y)*currentBox.height/2)};
    expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,clickPoint)).toBe('CANVAS');
    await page.mouse.click(clickPoint.x,clickPoint.y);
    await expect(main).toHaveAttribute('data-selected',asset.assetId,{timeout:12_000});
    await expect.poll(async()=>(await snapshot()).scene.selectedId,{timeout:12_000}).toBe(asset.assetId);
    trace.genuineClick={assetId:asset.assetId,point:clickPoint,after:await settled()};
    const clicks=await page.evaluate(()=>(window as unknown as {__V6_DRAG_INPUT__: {rows: PointerRow[]}}).__V6_DRAG_INPUT__.rows);
    expect(clicks.some(e=>e.type==='click'&&e.trusted&&e.delta===0&&e.targetIsCanvas)).toBe(true);
    expect(await panel(page).getAttribute('data-source-identity')).toBe(source);
    expect(await page.evaluate(()=>localStorage.getItem('neptune-v2-scenarios'))).toBe(saved);
    await button(page,'Resume walkthrough').click();
    await expect.poll(async()=>{const s=await snapshot();return s.record.status==='playing'&&s.record.shotIndex===1&&s.record.readiness==='authored'&&s.selected===before.selected&&!s.scene.cameraTransitioning;},{timeout:12_000}).toBe(true);
    trace.resumed=await snapshot();
    await button(page,'Exit walkthrough').click();
    expect(normalizeProject(parseProject(await exported(page,'project')))).toEqual(loaded);
    expect(await page.evaluate(()=>localStorage.getItem('neptune-v2-scenarios'))).toBe(saved);
    expect(errors).toEqual([]);
  } finally {
    trace.input=await page.evaluate(()=>{const m=(window as unknown as {__V6_DRAG_INPUT__: {rows: PointerRow[];stop:()=>void}}).__V6_DRAG_INPUT__;m.stop();return m.rows;});
    await info.attach('V6-intersected-mesh-drag-and-genuine-click',{body:JSON.stringify(trace),contentType:'application/json'});
  }
});

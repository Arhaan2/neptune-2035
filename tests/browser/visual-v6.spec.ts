import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
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

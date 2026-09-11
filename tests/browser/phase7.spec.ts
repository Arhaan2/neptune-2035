import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import type { DecisionExport, PlannedDecisionRun } from '../../src/twin/decision/types';
import { resolveAsset } from '../../src/twin/assets/design';
import { presentedPosition } from '../../src/scene/twinGeometry';
import type { Design } from '../../src/twin/types';
import type { SimulationState } from '../../src/twin/types';
import { advanceWithStep } from '../../src/twin/engine/simulation';
import { replayExperimentState } from '../../src/twin/experiment/runner';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const main = (page: Page) => page.locator('main.twin-app');
async function downloadJSON(page: Page, trigger: () => Promise<unknown>) {
  const pending = page.waitForEvent('download');
  await trigger();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  const file = await download.path();
  if (!file) throw Error('Native artifact download has no readable file.');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

test('PH7 C1 real canvas keeps failed selected pump and feeder visible through repeated camera arrangements', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await button(page, 'Design family III').click();
  await expect(button(page, 'Step 10s')).toBeEnabled();
  await expect(page.locator('canvas')).toBeVisible();
  const pump = 'platform-001/module-01/pump-duty';
  await page.getByLabel('Select equipment', { exact: true }).selectOption(pump);
  await button(page, 'Operate').click();
  await button(page, 'Trip selected asset').click();
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  const failed = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  const design = failed.designSnapshot as Design;
  for (const exploded of [false, true, false, true, false]) {
    if ((await button(page, 'Explode').getAttribute('aria-pressed')) !== String(exploded)) await button(page, 'Explode').click();
    await button(page, 'X-ray').click();
    await button(page, 'Campus context').click();
    await page.getByLabel('Select equipment', { exact: true }).selectOption(pump);
    const target = presentedPosition(resolveAsset(design, pump)!, exploded);
    await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ selectedId: pump, focus: 'selection', exploded, target: target.map(value => expect.closeTo(value, 5)) });
    await expect(page.getByTestId('asset-context')).toHaveAttribute('data-asset-id', pump);
    await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  }
  await page.locator('canvas').screenshot({ path: info.outputPath('failed-selected-pump-canvas.png') });
  await page.screenshot({ path: info.outputPath('failed-selected-pump-page.png'), fullPage: true });
  const afterViews = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(afterViews.checkpoint).toEqual(failed.checkpoint);
  const feeder = design.modules[0].powerDomainId;
  await page.getByLabel('Find asset ID', { exact: true }).fill(feeder);
  await button(page, 'Find').click();
  await button(page, 'Trip selected asset').click();
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__)).toMatchObject({ selectedId: feeder, focus: 'selection', target: resolveAsset(design, feeder)!.positionM.map(value => expect.closeTo(value, 5)) });
  await page.locator('canvas').screenshot({ path: info.outputPath('failed-selected-feeder-canvas.png') });
  await page.screenshot({ path: info.outputPath('failed-selected-feeder-page.png'), fullPage: true });
  const exported = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(exported.checkpoint.state.failedAssetIds).toContain(feeder);
  await info.attach('C1-canvas-state-and-camera', { body: JSON.stringify({ exported, scene: await page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__) }), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('PH7 C1 keyboard 375px fallback exposes pump identity connections and failure without mutating view evidence', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await button(page, 'Explore').focus();
  await page.keyboard.press('Enter');
  await expect(button(page, 'Explore')).toBeFocused();
  await expect(button(page, 'Explore')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCount(0);
  const pump = 'platform-001/module-01/pump-duty';
  await page.getByLabel('Select equipment', { exact: true }).selectOption(pump);
  await expect(page.getByTestId('asset-context')).toHaveAttribute('data-asset-id', pump);
  await expect(page.getByTestId('installed-spec')).toContainText('pump-reference');
  await expect(page.getByTestId('pump-operating-point')).toContainText('module equivalent');
  await expect(page.getByTestId('asset-context')).toContainText('power · connected');
  await expect(page.getByTestId('asset-context')).toContainText('technical · connected');
  await expect(page.getByTestId('asset-context')).toContainText('no seawater reaches computing equipment');
  await button(page, 'Operate').focus(); await page.keyboard.press('Enter');
  await button(page, 'Trip selected asset').focus(); await page.keyboard.press('Enter');
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  const picked = page.getByRole('button', { name: `pump duty, ${pump}, failed, selected`, exact: true });
  await expect(picked).toBeVisible();
  await picked.focus(); await page.keyboard.press('Enter');
  await expect(main(page)).toHaveAttribute('data-selected', pump);
  await page.getByLabel('Find asset ID', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await button(page, 'Find').click();
  await expect(main(page)).toHaveAttribute('data-selected', pump);
  await expect(page.locator('.twin-notice')).toContainText('Unknown asset ID');
  expect(await page.locator('.twin-inspector img').count()).toBe(0);
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: info.outputPath('C1-375px-keyboard-fallback.png'), fullPage: true });
});
async function setup(page: Page, fallback = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(fallback ? './?fallback=1' : './');
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await button(page, 'Compare').click();
  await expect(button(page, 'Start decision campaign')).toBeEnabled();
}

async function recordedTransfer(page: Page, fallback = true) {
  await setup(page, fallback);
  await button(page, 'Start decision campaign').click();
  await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
  const campaign: DecisionExport = await downloadJSON(page, () => button(page, 'Export decision campaign').click());
  await page.getByTestId('decision-row-iii-24').getByRole('button', { name: 'Inspect candidate', exact: true }).click();
  await button(page, 'Load selected candidate').click();
  await expect(button(page, 'Run selected experiment')).toBeEnabled();
  await button(page, 'Run selected experiment').click();
  await expect(main(page)).toHaveAttribute('data-time', '12');
  await expect(button(page, 'Step 10s')).toBeEnabled();
  const project = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  return { campaign, project, state: project.checkpoint.state as SimulationState, design: project.designSnapshot as Design };
}

test('PH7 C2 event inspection binds exact fractional scene controller and chart while preserving current experiment', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const { campaign, project, state, design } = await recordedTransfer(page, false);
  const expected = new Map<number, SimulationState>();
  advanceWithStep(design, replayExperimentState(design, state), state.timeS, [], state.integrationStepS, undefined, (timeS, copy) => expected.set(timeS, copy()));
  const transfer = state.transfer!.transitions.find(event => event.reason === 'TRANSFERRED')!;
  const fault = state.events.find(event => event.kind === 'trip')!;
  const events = page.getByTestId('operator-events');
  await events.locator(`[data-event-id="input:${fault.id}"] > button`).click();
  await expect(main(page)).toHaveAttribute('data-display-time', String(fault.timeS));
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
  await expect(page.getByTestId('asset-operating-status')).toHaveText('failed');
  await expect(page.getByTestId('phase5-transfer-status')).toContainText('waiting');
  await events.locator(`[data-event-id="transfer:${transfer.transitionId}"] > button`).click();
  await expect(main(page)).toHaveAttribute('data-display-time', String(transfer.timeS));
  await expect(main(page)).toHaveAttribute('data-time', String(state.timeS));
  await expect(main(page)).toHaveAttribute('data-inspection-mode', 'history');
  await expect(page.getByTestId('asset-context')).toHaveAttribute('data-time', String(transfer.timeS));
  await expect(page.getByTestId('inspection-context')).toContainText(`Current clock: ${state.timeS} s`);
  await expect(page.getByTestId('inspection-context')).toContainText(`Displayed scene and operating values: ${transfer.timeS} s`);
  await expect(page.getByRole('region', { name: 'Selected event explanation', exact: true })).toContainText(transfer.reason);
  await expect.poll(() => page.evaluate(() => window.__NEPTUNE_TWIN_SCENE__?.simulationTimeS)).toBe(transfer.timeS);
  const controller = page.getByTestId('phase5-transfer-status');
  await controller.getByText('Transfer transition and capacity evidence', { exact: true }).click();
  expect(JSON.parse((await controller.locator('pre').textContent())!)).toEqual(expected.get(transfer.timeS)!.transfer);
  await page.locator('canvas').screenshot({ path: info.outputPath('C2-exact-transfer-canvas.png') });
  await button(page, 'Inspect previous committed boundary').click();
  const previousTime = Math.max(...[...expected.keys()].filter(time => time < transfer.timeS));
  await expect(main(page)).toHaveAttribute('data-display-time', String(previousTime));
  await expect(controller).toContainText('waiting');
  await button(page, 'Inspect post-event boundary').click();
  await expect(main(page)).toHaveAttribute('data-display-time', String(transfer.timeS));
  const pump = `${design.modules.find(module => module.platformId === design.transfer!.routes[0].recipientPlatformId)!.id}/pump-duty`;
  await page.getByLabel('Find asset ID', { exact: true }).fill(pump); await button(page, 'Find').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'resolved');
  await expect(page.getByTestId('asset-context')).toHaveAttribute('data-asset-id', pump);
  const history = page.getByTestId('asset-history');
  await expect(history).toHaveAttribute('data-asset-id', pump);
  await history.getByText('Accessible trend values and units', { exact: true }).click();
  await expect(history.getByRole('table')).toContainText(String(transfer.timeS));
  await expect(history.getByRole('table')).toContainText('module-equivalent');
  expect((await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'))).checkpoint).toEqual(project.checkpoint);
  await button(page, 'Return to current state').click();
  await expect(main(page)).toHaveAttribute('data-inspection-mode', 'current');
  await expect(main(page)).toHaveAttribute('data-display-time', String(state.timeS));
  await button(page, 'Compare').click();
  expect(await downloadJSON(page, () => button(page, 'Export decision campaign').click())).toEqual(campaign);
  expect(errors).toEqual([]);
  await info.attach('C2-authoritative-source-and-transfer-boundary', { body: JSON.stringify({ project, transfer, expected: expected.get(transfer.timeS) }), contentType: 'application/json' });
});

test('PH7 C2 rapid history requests cancellation and design replacement discard old view results', async ({ page }, info) => {
  const { project, state } = await recordedTransfer(page);
  const time = page.getByLabel('Inspect history time in seconds', { exact: true });
  for (const target of ['2', '4.375', '0']) {
    await time.fill(target); await button(page, 'Inspect history time').click();
  }
  await expect(main(page)).toHaveAttribute('data-display-time', '0');
  await expect(main(page)).toHaveAttribute('data-time', String(state.timeS));
  await time.fill('4.3'); await button(page, 'Inspect history time').click();
  await expect(main(page)).toHaveAttribute('data-inspection-status', 'unavailable-history');
  await expect(main(page)).toHaveAttribute('data-display-time', '');
  await expect(page.getByTestId('asset-context')).toContainText('state unavailable');
  await button(page, 'Return to current state').click();
  await time.fill('12'); await button(page, 'Inspect history time').click();
  const cancel = button(page, 'Cancel history inspection');
  if (await cancel.isVisible()) await cancel.click();
  else await button(page, 'Return to current state').click();
  await expect(main(page)).toHaveAttribute('data-inspection-mode', 'current');
  expect((await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'))).checkpoint).toEqual(project.checkpoint);
  await time.fill('4.375'); await button(page, 'Inspect history time').click();
  await button(page, 'Design family II').click();
  await expect(button(page, 'Step 10s')).toBeEnabled();
  await expect(main(page)).toHaveAttribute('data-inspection-mode', 'current');
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await expect(main(page)).toHaveAttribute('data-display-time', '0');
  const replaced = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
  expect(replaced.designSnapshot.config.generation).toBe(2);
  expect(replaced.designSnapshot.revision).not.toBe(project.designSnapshot.revision);
  await info.attach('C2-history-source-isolation-after-replacement', { body: JSON.stringify({ original: project, replaced }), contentType: 'application/json' });
});

for (const editedInput of ['fixture', 'recovery policy'] as const) {
  test(`PH7 D01 historical candidate inspection preserves original evidence after ${editedInput} edit`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await setup(page);
    const before = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
    await button(page, 'Start decision campaign').click();
    await expect(page.getByTestId('decision-coverage')).toHaveAttribute('data-status', 'completed');
    const evidence: DecisionExport = await downloadJSON(page, () => button(page, 'Export decision campaign').click());
    const expected = evidence.result.plan.runs.find(run => run.candidateId === 'iii-24' && run.scenarioId === 'eligible-feeder' && run.sensitivityId === 'central')!;
    expect(expected).toBeDefined();
    if (editedInput === 'fixture') await page.getByLabel('Decision fixture', { exact: true }).selectOption('nominal');
    else await page.getByLabel('Decision recovery dwell seconds', { exact: true }).fill('8');
    await expect(page.getByTestId('decision-stale')).toBeVisible();
    await page.getByTestId('decision-row-iii-24').getByRole('button', { name: 'Inspect candidate', exact: true }).click();
    const inspection = page.getByRole('region', { name: 'Decision candidate inspection', exact: true });
    await inspection.getByText('Resolved design, fault targets and actual initialization', { exact: true }).click();
    const inspected: PlannedDecisionRun = JSON.parse((await inspection.locator('pre').textContent())!);
    await info.attach('historical-candidate-inspection', { body: JSON.stringify({ editedInput, expected, inspected, originalCampaign: evidence.campaign }), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath('historical-candidate-inspection.png'), fullPage: true });
    expect(inspected).toEqual(expected);
    await expect(page.getByLabel('Decision scenario', { exact: true })).toHaveValue(expected.scenarioId);
    const afterInspection = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
    expect(afterInspection.checkpoint).toEqual(before.checkpoint);
    expect(await downloadJSON(page, () => button(page, 'Export decision campaign').click())).toEqual(evidence);
    await button(page, 'Load selected candidate').click();
    await expect(button(page, 'Run selected experiment')).toBeEnabled();
    await button(page, 'Run selected experiment').click();
    await expect(main(page)).toHaveAttribute('data-time', String(expected.definition.durationS));
    await expect(main(page)).toHaveAttribute('data-ready', 'true');
    const loaded = await downloadJSON(page, () => page.getByLabel('Export artifact', { exact: true }).selectOption('project'));
    expect(loaded.checkpoint.state.experiment.definition).toEqual(expected.definition);
    expect(loaded.checkpoint.state.experiment.initialState).toEqual(expected.initialState);
    expect(loaded.checkpoint.state.events).toEqual(expected.definition.disturbances);
    expect(errors).toEqual([]);
    await info.attach('historical-candidate-executed-export', { body: JSON.stringify(loaded), contentType: 'application/json' });
  });
}

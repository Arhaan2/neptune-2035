import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import type { DecisionExport, PlannedDecisionRun } from '../../src/twin/decision/types';

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
async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?fallback=1');
  await expect(main(page)).toHaveAttribute('data-ready', 'true');
  await button(page, 'Compare').click();
  await expect(button(page, 'Start decision campaign')).toBeEnabled();
}

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

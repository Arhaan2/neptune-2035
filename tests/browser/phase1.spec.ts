import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import type { WorkerRequest, WorkerResponse } from '../../src/twin/types';

type PauseProbe = {
  hold: boolean;
  requests: WorkerRequest[];
  replies: { worker: Worker; response: WorkerResponse }[];
  release: () => void;
};

declare global {
  interface Window {
    phase1PauseProbe: PauseProbe;
  }
}

const main = (page: Page) => page.locator('main.twin-app');
async function load(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?fallback=1');
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
  const requested = page.getByRole('spinbutton', {
    name: 'Requested accelerators',
    exact: true,
  });
  await requested.fill('8');
  await requested.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
}
async function step(page: Page) {
  const before = Number(await main(page).getAttribute('data-time'));
  await page.getByRole('button', { name: 'Step 10s', exact: true }).click();
  await expect(main(page)).toHaveAttribute('data-time', String(before + 10));
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
}
async function projectText(page: Page, button?: string) {
  const downloading = page.waitForEvent('download');
  if (button)
    await page.getByRole('button', { name: button, exact: true }).click();
  else
    await page
      .getByLabel('Export artifact', { exact: true })
      .selectOption('project');
  const downloaded = await downloading;
  expect(await downloaded.failure()).toBeNull();
  const path = await downloaded.path();
  if (!path) throw Error('Project export missing.');
  return fs.readFile(path, 'utf8');
}
async function importText(page: Page, text: string) {
  await page.getByLabel('Import project', { exact: true }).setInputFiles({
    name: 'checkpoint.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
}

test('PH1-REP-02 Pause remains available during an advance and delayed real worker replies cannot move its checkpoint', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    const probe: PauseProbe = {
      hold: false,
      requests: [],
      replies: [],
      release() {
        this.hold = false;
        for (const { worker, response } of this.replies)
          worker.dispatchEvent(new MessageEvent('message', { data: response }));
        this.replies = [];
      },
    };
    window.phase1PauseProbe = probe;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener(
          'message',
          (event: MessageEvent<WorkerResponse>) => {
            if (!probe.hold) return;
            event.stopImmediatePropagation();
            probe.replies.push({
              worker: this,
              response: structuredClone(event.data),
            });
          },
        );
      }
      override postMessage(
        message: WorkerRequest,
        options?: StructuredSerializeOptions | Transferable[],
      ) {
        probe.requests.push(structuredClone(message));
        if (Array.isArray(options)) super.postMessage(message, options);
        else super.postMessage(message, options);
      }
    };
  });
  await load(page);
  await page.evaluate(() => {
    window.phase1PauseProbe.hold = true;
  });
  await page.getByRole('button', { name: 'Step 10s', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.phase1PauseProbe.replies.some(
          ({ response }) =>
            response.status === 'complete' && response.state?.timeS === 10,
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.phase1PauseProbe.release());
  await expect(main(page)).toHaveAttribute('data-time', '10');
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
  const before = JSON.parse(await projectText(page));
  await page.getByLabel('Simulation speed', { exact: true }).selectOption('20');
  await page.evaluate(() => {
    window.phase1PauseProbe.hold = true;
  });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.phase1PauseProbe.replies.some(
          ({ response }) =>
            response.status === 'complete' && response.state?.timeS === 30,
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeDisabled();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeEnabled();
  await pause.click();
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.phase1PauseProbe.replies.some(
          ({ response }) => response.status === 'cancelled',
        ),
      ),
    )
    .toBe(true);
  const sent = await page.evaluate(
    () => window.phase1PauseProbe.requests.length,
  );
  await page.evaluate(() => window.phase1PauseProbe.release());
  await page.waitForTimeout(1250);
  expect(
    await page.evaluate(() => window.phase1PauseProbe.requests.length),
  ).toBe(sent);
  await expect(main(page)).toHaveAttribute('data-time', '10');
  expect(JSON.parse(await projectText(page)).checkpoint).toEqual(
    before.checkpoint,
  );
  await page
    .getByRole('button', { name: 'Resume to 30s', exact: true })
    .click();
  await expect(main(page)).toHaveAttribute('data-time', '30');
  await expect(
    page.getByRole('button', { name: 'Start', exact: true }),
  ).toBeEnabled();
  expect(JSON.parse(await projectText(page)).checkpoint.state.timeS).toBe(30);
});

test('PH1-UI-01 saves complete checkpoints, recovers on refresh, and rejects malformed import transactionally', async ({
  page,
}) => {
  await load(page);
  await step(page);
  await page
    .getByRole('button', { name: 'Trip selected asset', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
  await step(page);
  const text = await projectText(page),
    project = JSON.parse(text);
  expect(project.schemaVersion).toBe(3);
  expect(project.checkpoint.state.timeS).toBe(20);
  await expect(page.getByTestId('checkpoint-storage')).toContainText(
    'Checkpoint saved locally at 20s',
  );
  await page.reload();
  await expect(page.getByTestId('checkpoint-recovery')).toContainText(
    'available at 20s',
  );
  await page
    .getByRole('button', { name: 'Recover saved checkpoint', exact: true })
    .click();
  await expect(main(page)).toHaveAttribute('data-time', '20');
  expect(JSON.parse(await projectText(page))).toEqual(project);
  await importText(page, '{"schemaVersion":3,"timeS":1e309}');
  await expect(page.locator('.twin-notice')).toContainText(
    /nonfinite|finite|field|kind/i,
  );
  await expect(main(page)).toHaveAttribute('data-time', '20');
  expect(JSON.parse(await projectText(page))).toEqual(project);
  await step(page);
  await page.getByRole('button', { name: 'Reset state', exact: true }).click();
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await importText(page, text);
  await expect(main(page)).toHaveAttribute('data-time', '20');
  expect(JSON.parse(await projectText(page))).toEqual(project);
});

test('PH1-UI-01 quota failure preserves last durable checkpoint and allows current manual export', async ({
  page,
}) => {
  await load(page);
  await step(page);
  await expect(page.getByTestId('checkpoint-storage')).toContainText(
    'saved locally at 10s',
  );
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(
      Storage.prototype,
      'setItem',
    )!.value as (this: Storage, key: string, value: string) => void;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'neptune-checkpoint-v3')
        throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await step(page);
  await expect(page.getByTestId('checkpoint-storage')).toContainText(
    'Checkpoint save failed',
  );
  await expect(page.getByTestId('checkpoint-storage')).toContainText(
    'Last successful local checkpoint: 10s',
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('neptune-checkpoint-v3')!).timeS,
    ),
  ).toBe(10);
  expect(JSON.parse(await projectText(page)).checkpoint.state.timeS).toBe(20);
});

test('PH1-COMP-01 legacy inspection and explicit recalculation preserve the original identity', async ({
  page,
}) => {
  await load(page);
  await step(page);
  const active = JSON.parse(await projectText(page));
  const legacy = {
    schemaVersion: 2,
    kind: 'neptune-project',
    design: active.design,
    events: active.events,
    timeS: 10,
    sourceMode: 'simulated',
    solverVersion: '2.0.0-rc.1',
  };
  await importText(page, JSON.stringify(legacy));
  await expect(page.getByTestId('project-compatibility')).toContainText(
    'Exact continuation is unavailable',
  );
  expect(
    JSON.parse(await projectText(page, 'Export original project')),
  ).toEqual(legacy);
  expect(JSON.parse(await projectText(page))).toEqual(active);
  await page
    .getByRole('button', {
      name: 'Recalculate with current model',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
  await expect
    .poll(
      async () =>
        JSON.parse(await projectText(page)).provenance.parent?.solverVersion,
    )
    .toBe('2.0.0-rc.1');
  const derived = JSON.parse(await projectText(page));
  expect(derived.provenance.parent.action).toBe('recalculate-current-model');
  expect(derived.solverVersion).not.toBe(legacy.solverVersion);
  expect(
    JSON.parse(await projectText(page, 'Export original project')),
  ).toEqual(legacy);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save current scenario locally', exact: true })
    .click();
  await step(page);
  await page
    .getByRole('button', { name: 'Save current scenario locally', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Compare last two saved', exact: true })
    .click();
  const cards = page.locator('.twin-comparison-grid article');
  await expect(cards).toHaveCount(2);
  const downloadPending = page.waitForEvent('download');
  await cards
    .first()
    .getByRole('button', { name: 'Export reproducible run', exact: true })
    .click();
  const downloadPath = await (await downloadPending).path();
  if (!downloadPath) throw Error('Comparison export missing.');
  const compared = JSON.parse(await fs.readFile(downloadPath, 'utf8'));
  expect(compared.provenance).toEqual(derived.provenance);
});

test('PH1-REP-02 replay cancellation retains a committed checkpoint and resume reaches the same target', async ({
  page,
}) => {
  await load(page);
  await page
    .getByRole('spinbutton', { name: 'Replay time in seconds', exact: true })
    .fill('3600');
  await page.getByRole('button', { name: 'Seek time', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel run', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await expect(page.locator('.twin-notice')).toContainText('Run cancelled');
  await expect(
    page.getByRole('button', { name: 'Cancel run', exact: true }),
  ).toHaveCount(0);
  const partial = JSON.parse(await projectText(page));
  expect(partial.timeS).toBeLessThan(3600);
  expect(partial.checkpoint.state.timeS).toBe(partial.timeS);
  expect(partial.execution.targetTimeS).toBe(3600);
  await page
    .getByRole('button', { name: 'Resume to 3600s', exact: true })
    .click();
  await expect(main(page)).toHaveAttribute('data-time', '3600', {
    timeout: 30_000,
  });
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
  const continued = JSON.parse(await projectText(page));
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled({ timeout: 30_000 });
  expect(JSON.parse(await projectText(page))).toEqual(continued);
});

test('PH1-REP-02 an actual worker error event keeps validated state and a new worker can continue', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    const tracked: Worker[] = [];
    Object.assign(window, { phase1Workers: tracked });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        tracked.push(this);
      }
    };
  });
  await load(page);
  await step(page);
  const before = JSON.parse(await projectText(page));
  await page.evaluate(() => {
    const tracked = (window as unknown as { phase1Workers: Worker[] })
      .phase1Workers;
    tracked
      .at(-1)!
      .dispatchEvent(
        new ErrorEvent('error', { message: 'Injected worker interruption' }),
      );
  });
  await expect(page.locator('.twin-notice')).toContainText(
    'Last received checkpoint at 10s retained',
  );
  expect(JSON.parse(await projectText(page))).toEqual(before);
  await step(page);
  await expect(main(page)).toHaveAttribute('data-time', '20');
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { phase1Workers: Worker[] }).phase1Workers.length,
    ),
  ).toBeGreaterThanOrEqual(2);
});

test('PH1-REP-02 import supersedes replay and a delivered stale worker response cannot overwrite it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    const records: { worker: Worker; response: unknown }[] = [];
    Object.assign(window, { phase1Responses: records });
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', (event) =>
          records.push({ worker: this, response: structuredClone(event.data) }),
        );
      }
    };
  });
  await load(page);
  const initial = await projectText(page);
  await step(page);
  await page
    .getByRole('spinbutton', { name: 'Replay time in seconds', exact: true })
    .fill('36000');
  await page.getByRole('button', { name: 'Seek time', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel run', exact: true }),
  ).toBeVisible();
  await importText(page, initial);
  await expect(main(page)).toHaveAttribute('data-time', '0');
  await page.evaluate(() => {
    const records = (
      window as unknown as {
        phase1Responses: {
          worker: Worker;
          response: { state?: { timeS: number }; status?: string };
        }[];
      }
    ).phase1Responses;
    const old = records.find(
      (record) =>
        record.response.status === 'complete' &&
        record.response.state?.timeS === 10,
    );
    if (!old) throw Error('No actual prior response captured.');
    old.worker.dispatchEvent(
      new MessageEvent('message', { data: structuredClone(old.response) }),
    );
  });
  await page.waitForTimeout(350);
  await expect(main(page)).toHaveAttribute('data-time', '0');
  expect(JSON.parse(await projectText(page))).toEqual(JSON.parse(initial));
  await step(page);
});

test('PH1-UI-01 unreadable recovery is retained until an explicit clear and manual export remains available', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('neptune-checkpoint-v3', '{"schemaVersion":999}'),
  );
  await load(page);
  await expect(
    page.getByText('Automatic saving is paused', { exact: false }),
  ).toBeVisible();
  await step(page);
  expect(
    await page.evaluate(() => localStorage.getItem('neptune-checkpoint-v3')),
  ).toBe('{"schemaVersion":999}');
  expect(JSON.parse(await projectText(page)).timeS).toBe(10);
  await page
    .getByRole('button', {
      name: 'Clear unavailable recovery and enable saving',
      exact: true,
    })
    .click();
  await expect(page.getByTestId('checkpoint-storage')).toContainText(
    'Checkpoint saved locally at 10s',
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('neptune-checkpoint-v3')!).timeS,
    ),
  ).toBe(10);
});

test('PH1-REP-01 exact restoration and UI replay preserve a fractional integration grid', async ({
  page,
}) => {
  await load(page);
  const initial = JSON.parse(await projectText(page));
  initial.checkpoint.state.integrationStepS = 0.25;
  await importText(page, JSON.stringify(initial));
  await expect(
    page.getByText('fixed 0.25s steps', { exact: false }),
  ).toBeVisible();
  await step(page);
  const stepped = JSON.parse(await projectText(page));
  expect(stepped.checkpoint.state.stepIndex).toBe(40);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Step 10s', exact: true }),
  ).toBeEnabled();
  expect(JSON.parse(await projectText(page))).toEqual(stepped);
  await page
    .getByRole('spinbutton', { name: 'Replay time in seconds', exact: true })
    .fill('4');
  await page.getByRole('button', { name: 'Seek time', exact: true }).click();
  await expect(main(page)).toHaveAttribute('data-time', '4');
  expect(JSON.parse(await projectText(page)).checkpoint.state.stepIndex).toBe(
    16,
  );
});

test('PH1-NUM-03 a stored scenario numeric overflow is rejected before JSON rewriting can turn it into null', async ({
  page,
}) => {
  await load(page);
  const active = JSON.parse(await projectText(page));
  const shelf = JSON.stringify([
    { name: 'Overflow fixture', project: active },
  ]).replaceAll('"budgetUSD":null', '"budgetUSD":1e309');
  await page.evaluate(
    (text) => localStorage.setItem('neptune-v2-scenarios', text),
    shelf,
  );
  await page.reload();
  await expect(
    page.getByText('Saved scenario recovery failed:', { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('neptune-v2-scenarios')),
  ).toBe(shelf);
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Overflow fixture', exact: true }),
  ).toHaveCount(0);
});

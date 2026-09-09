import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import {
  advance,
  advanceWithStep,
  initialize,
} from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { CONTRACT, STORAGE_KEY } from '../src/twin/persistence/limits';
import { identity } from '../src/twin/persistence/structure';
import { normalizeProject, projectFile } from '../src/twin/persistence/project';
import {
  readCheckpoint,
  writeCheckpoint,
} from '../src/twin/persistence/storage';
import type {
  OperationEvent,
  SimulationState,
  WorkerRequest,
  WorkerResponse,
} from '../src/twin/types';

const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const events: OperationEvent[] = [
  { id: 'grid-trip', timeS: 1, assetId: 'shore/grid', kind: 'trip' },
  {
    id: 'pump-trip',
    timeS: 2,
    assetId: `${design.modules[0].id}/pump-duty`,
    kind: 'trip',
  },
  {
    id: 'pump-restore',
    timeS: 4,
    assetId: `${design.modules[0].id}/pump-duty`,
    kind: 'restore',
  },
  {
    id: 'load-same-time',
    timeS: 4,
    assetId: 'shore/grid',
    kind: 'workload',
    value: 0.6,
  },
  { id: 'grid-restore', timeS: 8, assetId: 'shore/grid', kind: 'restore' },
];
const request = (patch: Partial<WorkerRequest> = {}): WorkerRequest => ({
  version: 2,
  requestId: 1,
  epoch: 1,
  kind: 'replay',
  design,
  events,
  durationS: 12,
  ...patch,
});
const normalized = (state: SimulationState) =>
  normalizeProject(projectFile(design, state));
async function run(patch: Partial<WorkerRequest>, now = () => 0) {
  const responses: WorkerResponse[] = [];
  const handler = createWorkerHandler(
    (r) => responses.push(r),
    async () => {},
    now,
  );
  await handler(request(patch));
  return responses;
}
function controlled() {
  const responses: WorkerResponse[] = [],
    waiters: (() => void)[] = [];
  let clock = 0;
  const handler = createWorkerHandler(
    (r) => responses.push(structuredClone(r)),
    () => new Promise<void>((resolve) => waiters.push(resolve)),
    () => clock,
  );
  return {
    handler,
    responses,
    waiters,
    tick: async () => {
      clock += CONTRACT.progressIntervalMs;
      const next = waiters.shift();
      expect(next).toBeDefined();
      next!();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('PH1-REP-01 committed worker stepping', () => {
  it.each([1, 2, 3, 9, 10])(
    'chunk size %is reproduces the same battery, startup and same-time event trajectory',
    async (chunkS) => {
      const expected = advance(design, initialize(design), 12, events);
      const responses = await run({ chunkS });
      expect(responses.at(-1)?.status).toBe('complete');
      expect(normalized(responses.at(-1)!.state!)).toEqual(
        normalized(expected),
      );
      for (const response of responses.filter((r) => r.status === 'progress')) {
        const intermediate = advance(
          design,
          initialize(design),
          response.state!.timeS,
          events,
        );
        expect(normalized(response.state!)).toEqual(normalized(intermediate));
      }
    },
  );
  it('resumes a fresh worker from a checkpoint during battery discharge and pending startup', async () => {
    const checkpoint = advance(design, initialize(design), 4, events);
    expect(checkpoint.modules[0].batteryWh).toBeLessThan(
      design.config.batteryWhPerModule,
    );
    expect(
      checkpoint.modules[0].startAtS[`${design.modules[0].id}/pump-duty`],
    ).toBeGreaterThan(4);
    const restored = await run({
      kind: 'restore',
      state: checkpoint,
      events: [],
      durationS: 0,
    });
    expect(restored.at(-1)?.state).toEqual(checkpoint);
    const resumed = await run({
      state: restored.at(-1)!.state,
      events: [],
      durationS: 8,
      chunkS: 3,
    });
    expect(normalized(resumed.at(-1)!.state!)).toEqual(
      normalized(advance(design, initialize(design), 12, events)),
    );
  });
});

describe('PH1-REP-02 operational cancellation, stale identity and resource failure', () => {
  it('cancel acknowledges the latest complete chunk and a fresh worker resumes it', async () => {
    const c = controlled();
    const job = c.handler(request({ durationS: 60, chunkS: 3 }));
    await c.tick(); // Event validation.
    await c.tick(); // First complete chunk.
    await c.handler(request({ kind: 'cancel', requestId: 2, epoch: 2 }));
    const cancelled = c.responses.at(-1)!;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.state?.timeS).toBe(3);
    await c.tick();
    await job;
    expect(c.responses.at(-1)).toBe(cancelled);
    const resumed = await run({
      state: cancelled.state,
      events: [],
      durationS: 57,
    });
    expect(normalized(resumed.at(-1)!.state!)).toEqual(
      normalized(advance(design, initialize(design), 60, events)),
    );
  });
  it('observes cancellation between event-validation batches without partially admitting history', async () => {
    const c = controlled();
    const many = Array.from(
      { length: CONTRACT.eventValidationBatch + 1 },
      (_, index): OperationEvent => ({
        id: `future-${index}`,
        timeS: 100,
        assetId: 'shore/grid',
        kind: 'workload',
        value: 0.5,
      }),
    );
    const job = c.handler(request({ events: many, durationS: 200 }));
    await c.tick();
    expect(c.waiters).toHaveLength(1);
    await c.handler(request({ kind: 'cancel', requestId: 2, epoch: 2 }));
    expect(c.responses.at(-1)?.state).toBeUndefined();
    await c.tick();
    await job;
    expect(c.responses.map((r) => r.status)).toEqual(['cancelled']);
  });
  it('ignores old epoch and duplicate request IDs after supersession', async () => {
    const responses: WorkerResponse[] = [];
    const handler = createWorkerHandler(
      (r) => responses.push(r),
      async () => {},
    );
    await handler(
      request({
        kind: 'initialize',
        durationS: 0,
        events: [],
        epoch: 2,
        requestId: 5,
      }),
    );
    await handler(
      request({
        kind: 'initialize',
        durationS: 0,
        events: [],
        epoch: 1,
        requestId: 6,
      }),
    );
    await handler(
      request({
        kind: 'initialize',
        durationS: 0,
        events: [],
        epoch: 2,
        requestId: 5,
      }),
    );
    expect(responses).toHaveLength(1);
    expect(responses[0].epoch).toBe(2);
  });
  it.each([-1, 0, 1])(
    'wall budget at limit %+d ms has an explicit resource outcome',
    async (offset) => {
      let elapsed = 0;
      const responses: WorkerResponse[] = [];
      const handler = createWorkerHandler(
        (r) => responses.push(r),
        async () => {
          elapsed = CONTRACT.maxJobWallMs + offset;
        },
        () => elapsed,
      );
      await handler(request({ events: [], durationS: 1 }));
      expect(responses.at(-1)?.status).toBe(
        offset < 0 ? 'complete' : 'resource-limited',
      );
      if (offset >= 0) {
        expect(responses.at(-1)?.diagnostic?.code).toBe('REPLAY_BUDGET');
        expect(responses.at(-1)?.state?.timeS).toBe(0);
      }
    },
  );
  it('invalid event and failed state admission do not publish replacement state', async () => {
    const initial = initialize(design),
      original = structuredClone(initial);
    const bad = await run({
      kind: 'advance',
      state: initial,
      events: [{ ...events[0], value: Infinity }],
    });
    expect(bad.at(-1)?.status).toBe('failed');
    expect(bad.at(-1)?.state).toBeUndefined();
    expect(initial).toEqual(original);
    const invalidState = structuredClone(initial);
    invalidState.modules[0].coolantK = Infinity;
    const invalid = await run({
      kind: 'advance',
      state: invalidState,
      events: [],
    });
    expect(invalid.at(-1)?.state).toBeUndefined();
    expect(invalid.at(-1)?.diagnostic?.kind).toBe('invalid-input');
  });
  it.each([0, 1, 2, 9, 10, 11])(
    'checks inclusive chunk limit for %is',
    async (chunkS) => {
      const responses = await run({ chunkS, durationS: 0, events: [] });
      expect(responses.at(-1)?.status).toBe(
        chunkS >= 1 && chunkS <= CONTRACT.maxChunkS ? 'complete' : 'failed',
      );
    },
  );
  it.each([NaN, Infinity, -Infinity, null, '1', undefined])(
    'does not coerce a supplied invalid duration %s',
    async (durationS) => {
      const responses = await run({ durationS: durationS as number });
      expect(responses.at(-1)?.diagnostic?.kind).toBe('invalid-input');
      expect(responses.at(-1)?.state).toBeUndefined();
    },
  );
});

describe('PH1-UI-01 atomic browser-storage boundary', () => {
  it('only reports success after a successful replacement and retains old durable data after quota failure', () => {
    let stored: string | null = null,
      reject = false;
    const storage = {
      getItem: (key: string) => {
        expect(key).toBe(STORAGE_KEY);
        return stored;
      },
      setItem: (key: string, value: string) => {
        expect(key).toBe(STORAGE_KEY);
        if (reject) throw new Error('Quota exceeded');
        stored = value;
      },
      removeItem: () => {
        stored = null;
      },
    };
    const first = projectFile(design, initialize(design));
    expect(writeCheckpoint(first, storage)).toMatchObject({
      ok: true,
      timeS: 0,
    });
    const previous = stored;
    reject = true;
    const later = projectFile(
      design,
      advance(design, initialize(design), 4, events),
    );
    expect(writeCheckpoint(later, storage)).toMatchObject({
      ok: false,
      diagnostic: { kind: 'storage-failure' },
    });
    expect(stored).toBe(previous);
    expect(readCheckpoint(storage).project).toEqual(first);
    expect(normalizeProject(later).timeS).toBe(4);
  });
});

describe('PH1-PER-02 worker admission boundaries', () => {
  it.each([
    CONTRACT.maxAdvanceS - 1,
    CONTRACT.maxAdvanceS,
    CONTRACT.maxAdvanceS + 1,
  ])(
    'advance duration %is is distinct from execution budget',
    async (durationS) => {
      let elapsed = 0;
      const responses: WorkerResponse[] = [];
      const handler = createWorkerHandler(
        (r) => responses.push(r),
        async () => {
          elapsed = CONTRACT.maxJobWallMs;
        },
        () => elapsed,
      );
      await handler(
        request({
          kind: 'advance',
          state: initialize(design),
          events: [],
          durationS,
        }),
      );
      expect(responses.at(-1)?.diagnostic?.kind).toBe(
        durationS <= CONTRACT.maxAdvanceS ? 'resource-limit' : 'invalid-input',
      );
    },
  );
  it.each([CONTRACT.horizonS - 1, CONTRACT.horizonS, CONTRACT.horizonS + 1])(
    'replay horizon %is is distinct from execution budget',
    async (durationS) => {
      let elapsed = 0;
      const responses: WorkerResponse[] = [];
      const handler = createWorkerHandler(
        (r) => responses.push(r),
        async () => {
          elapsed = CONTRACT.maxJobWallMs;
        },
        () => elapsed,
      );
      await handler(request({ events: [], durationS }));
      expect(responses.at(-1)?.diagnostic?.kind).toBe(
        durationS <= CONTRACT.horizonS ? 'resource-limit' : 'invalid-input',
      );
    },
  );
  it.each([CONTRACT.maxEvents - 1, CONTRACT.maxEvents, CONTRACT.maxEvents + 1])(
    'preserves or rejects all %i events without truncation',
    async (count) => {
      const future = Array.from(
        { length: count },
        (_, i): OperationEvent => ({
          id: `future-${i}`,
          timeS: CONTRACT.horizonS,
          assetId: 'shore/grid',
          kind: 'workload',
          value: 0.5,
        }),
      );
      const responses = await run({ events: future, durationS: 0 });
      if (count <= CONTRACT.maxEvents) {
        expect(responses.at(-1)?.status).toBe('complete');
        expect(responses.at(-1)?.state?.events).toHaveLength(count);
      } else {
        expect(responses.at(-1)?.diagnostic?.code).toBe('EVENT_COUNT');
        expect(responses.at(-1)?.state).toBeUndefined();
      }
    },
  );
  it.each([
    CONTRACT.maxChunkModuleSteps - 1,
    CONTRACT.maxChunkModuleSteps,
    CONTRACT.maxChunkModuleSteps + 1,
  ])(
    'bounds an atomic same-time event batch at %i module steps',
    async (count) => {
      const simultaneous = Array.from(
        { length: count },
        (_, i): OperationEvent => ({
          id: `same-${i}`,
          timeS: 0,
          assetId: 'shore/grid',
          kind: 'workload',
          value: 0.5,
        }),
      );
      const responses = await run({ events: simultaneous, durationS: 0 });
      if (count <= CONTRACT.maxChunkModuleSteps) {
        expect(responses.at(-1)?.status).toBe('complete');
        expect(responses.at(-1)?.state?.appliedEventIds).toHaveLength(count);
      } else {
        expect(responses.at(-1)?.diagnostic?.kind).toBe('resource-limit');
        expect(responses.at(-1)?.state).toBeUndefined();
        expect(simultaneous).toHaveLength(count);
      }
    },
  );
});

it('PH1-NUM-03 a failed worker timing calculation cannot corrupt the last validated physical checkpoint', async () => {
  const responses = await run({ events: [], durationS: 1 }, () => NaN);
  const result = responses.at(-1)!;
  expect(result.status).toBe('failed');
  expect(result.diagnostic?.kind).toBe('numerical-failure');
  expect(result.diagnostic?.code).toBe('WORKER_CLOCK');
  expect(result.state?.solverMs).toBe(0);
  expect(normalized(result.state!)).toEqual(
    normalized(advance(design, initialize(design), 1)),
  );
  expect(JSON.parse(JSON.stringify(result)).state.solverMs).toBe(0);
});

it.each([0.5, 0.25, 0.125] as const)(
  'PH1-REP-01 replay and restored continuation retain the %is integration grid',
  async (integrationStepS) => {
    const expected = advanceWithStep(
      design,
      initialize(design),
      12,
      events,
      integrationStepS,
    );
    const fresh = await run({ integrationStepS, chunkS: 3 });
    expect(normalized(fresh.at(-1)!.state!)).toEqual(normalized(expected));
    const checkpoint = advanceWithStep(
      design,
      initialize(design),
      4,
      events,
      integrationStepS,
    );
    const continued = await run({
      state: checkpoint,
      durationS: 8,
      events: [],
      integrationStepS,
      chunkS: 2,
    });
    expect(normalized(continued.at(-1)!.state!)).toEqual(normalized(expected));
    const mismatch = await run({
      state: checkpoint,
      durationS: 1,
      events: [],
      integrationStepS: 1,
    });
    expect(mismatch.at(-1)?.diagnostic?.code).toBe('INTEGRATION_STEP_MISMATCH');
    expect(mismatch.at(-1)?.state).toBeUndefined();
  },
);

it('PH1-NUM-02 exact worker restoration validates the full design before publishing state', async () => {
  const badDesign = structuredClone(design);
  badDesign.config.supplyW = Infinity;
  const checkpoint = initialize(design);
  checkpoint.designIdentity = identity(badDesign);
  const responses = await run({
    kind: 'restore',
    design: badDesign,
    state: checkpoint,
    events: [],
    durationS: 0,
  });
  expect(responses.at(-1)?.status).toBe('failed');
  expect(responses.at(-1)?.diagnostic?.kind).toBe('invalid-input');
  expect(responses.at(-1)?.state).toBeUndefined();
});

it.each([127, 128, 129])('PH1-PER-02 validates %i events with the declared bounded yielding cadence', async count => {
  let yields = 0; const responses: WorkerResponse[] = [];
  const handler = createWorkerHandler(r => responses.push(r), async () => { yields++; }, () => 0);
  const future: OperationEvent[] = Array.from({ length: count }, (_, i) => ({ id: `batch-${i}`, timeS: 1, kind: 'workload', assetId: 'shore/grid', value: 0.8 }));
  await handler(request({ events: future, durationS: 0 }));
  expect(yields).toBe(Math.ceil(count / CONTRACT.eventValidationBatch)); expect(responses.at(-1)?.state?.events).toHaveLength(count);
});

it.each([249, 250, 251])('PH1-REP-01 %ims progress cadence does not alter the numerical trajectory', async intervalMs => {
  let elapsed = 0; const responses: WorkerResponse[] = [];
  const handler = createWorkerHandler(r => responses.push(r), async () => { elapsed += intervalMs; }, () => elapsed);
  await handler(request({ events: [], durationS: 20, chunkS: 10 }));
  expect(responses.filter(r => r.status === 'progress')).toHaveLength(intervalMs < CONTRACT.progressIntervalMs ? 1 : 2);
  expect({ ...responses.at(-1)!.state!, solverMs: 0 }).toEqual(advance(design, initialize(design), 20));
});

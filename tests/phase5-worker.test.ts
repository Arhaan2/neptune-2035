import { describe, expect, it } from 'vitest';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { createTransferReferenceDesign } from '../src/twin/transfer/design';
import { validateState } from '../src/twin/persistence/state';
import type { WorkerRequest, WorkerResponse } from '../src/twin/types';

const design = createTransferReferenceDesign();
const definition = createExperimentDefinition(design, { id: 'phase5-worker', durationS: 12, disturbances: [{ id: 'feeder-trip', kind: 'trip', timeS: 2, assetId: design.transfer!.routes[0].originalFeederId }] });
const request = (patch: Partial<WorkerRequest> = {}): WorkerRequest => ({ version: 2, epoch: 1, requestId: 1, kind: 'replay', durationS: 12, design, experimentDefinition: definition, ...patch });
const expected = () => advance(design, initialize(design, definition), 12);

describe('PH5 G actual worker protocol transfer lifecycle', () => {
  it.each([1, 2, 3, 5, 12])('chunk size %is preserves exact transfer sequence/deadline and whole-run metrics', async chunkS => {
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(structuredClone(response)), async () => {}, () => 0)(request({ chunkS }));
    expect(responses.at(-1)?.status).toBe('complete');
    const final = responses.at(-1)!.state!, continuous = expected();
    expect(final.transfer).toEqual(continuous.transfer); expect(final.experiment).toEqual(continuous.experiment);
    expect(final.modules).toEqual(continuous.modules);
    for (const response of responses) if (response.state) expect(() => validateState(design, response.state)).not.toThrow();
  });
  it.each([3, 5])('restores a complete pending or transferred checkpoint into a fresh worker at t=%i', async seconds => {
    const state = advance(design, initialize(design, definition), seconds), responses: WorkerResponse[] = [];
    const handler = createWorkerHandler(response => responses.push(structuredClone(response)), async () => {}, () => 0);
    await handler(request({ kind: 'restore', state, experimentDefinition: undefined, durationS: 0, events: [] }));
    expect(responses.at(-1)?.state?.transfer).toEqual(state.transfer);
    await handler(request({ kind: 'advance', epoch: 1, requestId: 2, state: responses.at(-1)!.state, experimentDefinition: undefined, durationS: 12 - seconds, events: [] }));
    expect(responses.at(-1)?.status).toBe('complete');
    expect(responses.at(-1)?.state?.transfer).toEqual(expected().transfer);
    expect(responses.at(-1)?.state?.experiment).toEqual(expected().experiment);
  });
  it('duplicate/stale delivery cannot apply switching twice', async () => {
    const responses: WorkerResponse[] = [], handler = createWorkerHandler(response => responses.push(structuredClone(response)), async () => {}, () => 0);
    await handler(request({ epoch: 2, requestId: 3 })); const before = structuredClone(responses);
    await handler(request({ epoch: 2, requestId: 3 })); await handler(request({ epoch: 1, requestId: 4 }));
    expect(responses).toEqual(before); expect(responses.at(-1)!.state!.transfer!.transitionCounts.TRANSFERRED).toBe(1);
  });
  it('cancels during transfer delay, retains incomplete evidence and restarts under a fresh epoch', async () => {
    const responses: WorkerResponse[] = [], waiters: (() => void)[] = [];
    const handler = createWorkerHandler(response => responses.push(structuredClone(response)), () => new Promise<void>(resolve => waiters.push(resolve)), () => 0);
    const running = handler(request({ chunkS: 2 }));
    const tick = async () => { expect(waiters.length).toBeGreaterThan(0); waiters.shift()!(); await Promise.resolve(); await Promise.resolve(); };
    await tick(); await tick();
    await handler(request({ kind: 'cancel', epoch: 2, requestId: 2 }));
    const cancelled = responses.at(-1)!;
    expect(cancelled.status).toBe('cancelled'); expect(cancelled.state!.timeS).toBe(4);
    expect(cancelled.state!.transfer!.attempts[0]).toMatchObject({ status: 'waiting', deadlineS: 4.375, tieClosed: false });
    expect(cancelled.state!.experiment).toMatchObject({ status: 'cancelled', evaluation: { outcome: 'INCOMPLETE' }, metrics: { elapsedS: 4, shortfallAcceleratorS: 16 } });
    await tick(); await running; expect(responses.at(-1)).toBe(cancelled);
    const restarted: WorkerResponse[] = [];
    await createWorkerHandler(response => restarted.push(structuredClone(response)), async () => {}, () => 0)(request({ epoch: 3, requestId: 3 }));
    expect(restarted.at(-1)?.status).toBe('complete');
    expect(restarted.at(-1)?.state?.transfer).toEqual(expected().transfer);
    expect(restarted.at(-1)?.state?.experiment?.metrics.shortfallAcceleratorS).toBe(19);
  });
});

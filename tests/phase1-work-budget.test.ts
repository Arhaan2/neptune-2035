import { describe, expect, it, vi } from 'vitest';
import { CONTRACT } from '../src/twin/persistence/limits';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { createWorkerHandler } from '../src/twin/engine/worker';
import type { WorkerResponse } from '../src/twin/types';

// This tests the actual worker scheduling/resource branch with a controlled numerical kernel.
// Physical long histories and checkpoint trajectories use the real kernel in the other suites.
vi.mock('../src/twin/engine/simulation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/twin/engine/simulation')>();
  return { ...real, advance: ((design, state, duration, events = []) => duration === 0 ? real.advance(design, state, 0, events) : { ...state, timeS: state.timeS + duration, stepIndex: state.stepIndex + duration / state.integrationStepS }) as typeof real.advance };
});
describe('PH1-PER-02 worker work budget one-unit boundaries', () => {
  it.each([-1, 0, 1])('replay at 2,000,000 %+d module steps retains the correct completed boundary', async offset => {
    const responses: WorkerResponse[] = [], design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
    const handler = createWorkerHandler(r => responses.push(r), async () => {}, () => 0);
    await handler({ version: 2, requestId: 1, epoch: 1, kind: 'replay', design, durationS: CONTRACT.maxJobModuleSteps + offset });
    const final = responses.at(-1)!;
    expect(final.state!.timeS).toBe(CONTRACT.maxJobModuleSteps + Math.min(offset, 0));
    expect(final.status).toBe(offset <= 0 ? 'complete' : 'resource-limited');
    if (offset > 0) { expect(final.diagnostic?.code).toBe('REPLAY_BUDGET'); expect(final.progress?.completedWork).toBe(CONTRACT.maxJobModuleSteps); }
  }, 30_000);
});

import { describe, expect, it } from 'vitest';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { replayExperimentState } from '../src/twin/experiment/runner';
import { updateEconomicAssumptions, engineeringIdentity } from '../src/twin/catalog/equipment';
import { parseProject, projectFile, restoreProject, serializeProject, compatibilityFor } from '../src/twin/persistence/project';
import { validateState } from '../src/twin/persistence/state';
import { createTransferReferenceDesign } from '../src/twin/transfer/design';
import type { SimulationState } from '../src/twin/types';

const design = createTransferReferenceDesign(), feeder = design.transfer!.routes[0].originalFeederId;
const definition = createExperimentDefinition(design, { id: 'phase5-persistence', durationS: 12, disturbances: [{ id: 'feeder-trip', timeS: 2, kind: 'trip', assetId: feeder }] });
const run = (seconds = 12) => advance(design, initialize(design, definition), seconds);
const physical = (state: SimulationState) => { const { solverMs: _solverMs, ...rest } = state; return rest; };

describe('PH5 G complete checkpoint and deterministic replay', () => {
  it.each([0, 1, 2, 3, 4, 5, 8, 12])('roundtrips and resumes before isolation/during delay/after closure at t=%i', checkpointS => {
    const checkpoint = run(checkpointS), encoded = serializeProject(projectFile(design, checkpoint)), imported = parseProject(encoded);
    expect(serializeProject(imported)).toBe(encoded); expect(compatibilityFor(imported).canResume).toBe(true);
    const restored = restoreProject(imported);
    expect(restored.state.transfer).toEqual(checkpoint.transfer);
    expect(physical(advance(restored.design, restored.state, 12 - checkpointS))).toEqual(physical(run()));
    if (checkpointS >= 2 && checkpointS <= 4) expect(checkpoint.transfer!.attempts[0]).toMatchObject({ status: 'waiting', deadlineS: 4.375, originalClosed: false, tieClosed: false });
    if (checkpointS >= 5) expect(checkpoint.transfer!.splitTimesS).toEqual([4.375]);
  });
  it.each([1, 2, 3, 4, 6])('continuous and %is chunked execution preserve physical/metric/allocation state exactly', chunkS => {
    let state = initialize(design, definition);
    for (let t = 0; t < 12; t += chunkS) state = advance(design, state, chunkS);
    expect(physical(state)).toEqual(physical(run()));
  });
  it('replay starts from exported actual initial states and repeats switching exactly once', () => {
    const source = run(), initial = replayExperimentState(design, source), replayed = advance(design, initial, 12);
    expect(initial.transfer!.attempts[0]).toMatchObject({ status: 'normal', originalClosed: true, tieClosed: false });
    expect(initial.experiment!.initialState).toEqual(source.experiment!.initialState);
    expect(physical(replayed)).toEqual(physical(source));
    expect(replayed.transfer!.transitionCounts.TRANSFERRED).toBe(1);
  });
  it('duplicate already-applied event cannot add a switching action or metric interval', () => {
    const source = run(), repeated = advance(design, source, 0, [{ id: 'feeder-trip', timeS: 2, kind: 'trip', assetId: feeder }]);
    expect(physical(repeated)).toEqual(physical(source));
  });
  it('economics preserves operational state while policy edits reject stale checkpoints', () => {
    const checkpoint = run(3), repriced = updateEconomicAssumptions(design, { unitCostScale: 1.5 });
    expect(physical(advance(repriced, checkpoint, 9))).toEqual(physical(run()));
    const changed = structuredClone(design); changed.transfer!.delayS = 3; changed.revision = `edited-${engineeringIdentity(changed)}`;
    expect(() => advance(changed, checkpoint, 9)).toThrow();
    expect(() => projectFile(changed, checkpoint)).toThrow();
  });
  it('explicit new experiment identity initializes fresh switches and metrics', () => {
    const old = run(), freshDefinition = createExperimentDefinition(design, { id: 'phase5-new-run', durationS: 12, disturbances: definition.disturbances }), fresh = initialize(design, freshDefinition);
    expect(fresh.experiment!.definition.id).not.toBe(old.experiment!.definition.id);
    expect(fresh.experiment!.metrics.elapsedS).toBe(0); expect(fresh.transfer!.sequence).toBe(0);
    expect(fresh.transfer!.attempts.every(attempt => attempt.status === 'normal' && attempt.originalClosed && !attempt.tieClosed)).toBe(true);
  });
});

describe('PH5 G/H checkpoint corruption cannot fabricate switch or capacity evidence', () => {
  function rejects(mutate: (state: SimulationState) => void, seconds = 12) {
    const state = run(seconds); mutate(state); expect(() => validateState(design, state)).toThrow();
  }
  it('rejects a missing transfer extension', () => rejects(state => { delete state.transfer; }));
  it('rejects changed model binding', () => rejects(state => { state.transfer!.designIdentity = 'other-design'; }));
  it('rejects double supply', () => rejects(state => { state.transfer!.attempts[0].originalClosed = true; }));
  it('rejects changed deadline', () => rejects(state => { state.transfer!.attempts[0].deadlineS = 5.375; }, 3));
  it('rejects changed admitted watts rather than presenting unbound restoration', () => rejects(state => { state.transfer!.attempts[0].admittedW += 1; }));
  it('rejects transferred state claiming an unserved bundle', () => rejects(state => { state.transfer!.attempts[0].unservedW = 1; }));
  it('rejects missing live source reservation', () => rejects(state => {
    const resource = state.transfer!.resources.find(resource => resource.id === 'asset:shore/grid')!;
    resource.transferredW = 0; resource.headroomW = Math.max(0, resource.capacityW - resource.nativeW);
  }));
  it('rejects invented capacity even when internal arithmetic balances', () => rejects(state => {
    const resource = state.transfer!.resources.find(resource => resource.id === 'asset:shore/grid')!;
    resource.capacityW += 1; resource.headroomW += 1;
  }));
  it('rejects an invented resource identity', () => rejects(state => { state.transfer!.resources[0].id = 'asset:invented-capacity'; }));
  it('rejects missing donor evidence path', () => rejects(state => { state.transfer!.attempts[0].donorPath = []; }));
  it('rejects reversed original path evidence', () => rejects(state => { state.transfer!.attempts[0].originalPath.reverse(); }));
  it('rejects a current attempt contradicting its final recorded transition', () => rejects(state => { state.transfer!.transitions.at(-1)!.admittedW = 0; }));
});

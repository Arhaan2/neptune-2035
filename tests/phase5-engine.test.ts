import { describe, expect, it } from 'vitest';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { recoveryReport } from '../src/twin/experiment/metrics';
import { runFaultPair } from '../src/twin/experiment/runner';
import { engineeringIdentity } from '../src/twin/catalog/equipment';
import { createTransferReferenceDesign } from '../src/twin/transfer/design';
import { activePowerDesign, powerPath } from '../src/twin/transfer/topology';
import type { Design, OperationEvent, SimulationState } from '../src/twin/types';
import frozen from './fixtures/phase-5/frozen-expectations.json';

const reference = (options: Parameters<typeof createTransferReferenceDesign>[1] = {}) => createTransferReferenceDesign(3, options);
const trip = (assetId: string, timeS = 2, id = `trip-${assetId}`): OperationEvent => ({ id, assetId, timeS, kind: 'trip' });
const restore = (assetId: string, timeS: number): OperationEvent => ({ id: `restore-${assetId}`, assetId, timeS, kind: 'restore' });
const feeder = (design: Design) => design.transfer?.routes[0].originalFeederId ?? design.modules.find(module => module.platformId === 'platform-002')!.powerDomainId;
const definition = (design: Design, events: OperationEvent[] = [trip(feeder(design))], durationS = 12) => createExperimentDefinition(design, { id: 'independent-phase5', durationS, disturbances: events });
function run(design: Design, events?: OperationEvent[], durationS = 12) { return advance(design, initialize(design, definition(design, events, durationS)), durationS); }
function invariant(design: Design, state: SimulationState) {
  for (const attempt of state.transfer!.attempts) expect(attempt.originalClosed && attempt.tieClosed).toBe(false);
  for (const attempt of state.transfer!.transitions) expect(attempt.originalClosed && attempt.tieClosed).toBe(false);
  const active = activePowerDesign(design, state);
  for (const route of design.transfer!.routes) expect(powerPath(active, route.receivingBusId).supported || !state.transfer!.attempts.find(attempt => attempt.id === route.id)!.tieClosed).toBe(true);
  expect(new Set(state.transfer!.transitions.map(transition => transition.transitionId)).size).toBe(state.transfer!.transitions.length);
}

describe('PH5 A/B actual engine transfer versus same-assumption baselines', () => {
  it('matches frozen constant-load interruption area and separate recovery onset/confirmation', () => {
    const ii = createTransferReferenceDesign(2), iii = reference();
    expect(ii.config.workload).toBe(iii.config.workload); expect(ii.config.requestedAccelerators).toBe(iii.config.requestedAccelerators);
    const a = run(ii), b = run(iii), f = frozen.service;
    expect(a.experiment!.metrics.shortfallAcceleratorS).toBeCloseTo(f.generationIIShortfallAcceleratorS, 8);
    expect(b.experiment!.metrics.shortfallAcceleratorS).toBeCloseTo(f.generationIIIShortfallAcceleratorS, 8);
    expect(b.experiment!.metrics.serviceViolationS).toBe(f.generationIIIInterruptionS);
    expect(recoveryReport(b.experiment!.metrics, 'completed')).toMatchObject({ status: 'recovered', onsetTimeS: f.recoveryOnsetS, confirmationTimeS: f.recoveryConfirmationS });
    expect(summarize(ii, a).availableAccelerators).toBe(16); expect(summarize(iii, b).availableAccelerators).toBe(24);
    const attempt = b.transfer!.attempts[0];
    expect(attempt).toMatchObject({ status: 'transferred', reason: 'TRANSFERRED', originalClosed: false, tieClosed: true, unservedW: 0 });
    expect(b.transfer!.transitions.filter(transition => transition.id === attempt.id).map(transition => transition.reason)).toEqual(['FEEDER_FAULT', 'ISOLATION_CONFIRMED', 'EVALUATING', 'WAITING', 'TRANSFERRED']);
    expect(b.transfer!.transitions.find(transition => transition.reason === 'TRANSFERRED')!.timeS).toBe(4.375);
    invariant(iii, b);
  });
  it('reports architecture fault impact only against its own identical unfaulted initial checkpoint', () => {
    for (const generation of [2, 3] as const) {
      const design = createTransferReferenceDesign(generation), pair = runFaultPair(design, definition(design));
      expect(pair.comparison.status).toBe('comparable');
      expect(pair.faulted.experiment!.initialState).toEqual(pair.baseline.experiment!.initialState);
      expect(pair.baseline.experiment!.metrics.shortfallAcceleratorS).toBe(0);
      expect(pair.comparison.difference!.shortfallAcceleratorS).toBe(generation === 2 ? 80 : 19);
    }
  });
  it('same III hardware with disabled transfer has no controller restoration benefit', () => {
    const design = reference({ enabled: false }), state = run(design);
    expect(state.experiment!.metrics.shortfallAcceleratorS).toBe(80);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'blocked', reason: 'DISABLED', tieClosed: false, admittedW: 0 });
    expect(summarize(design, state).availableAccelerators).toBe(16); invariant(design, state);
  });
});

describe('PH5 C/F complete path eligibility and changing faults', () => {
  it.each([
    ['receivingBusId', 'RECEIVING_BUS_FAILED'], ['tieId', 'TIE_UNAVAILABLE'], ['donorBusId', 'DONOR_UNAVAILABLE'], ['isolatorId', 'ISOLATION_UNCONFIRMED'],
  ] as const)('refuses %s failure with reason %s', (field, reason) => {
    const design = reference(), route = design.transfer!.routes[0], state = run(design, [trip(feeder(design)), trip(route[field], 2, 'dependency-trip')]);
    expect(state.transfer!.attempts[0]).toMatchObject({ reason, tieClosed: false, admittedW: 0 });
    expect(state.modules.find(module => module.id.startsWith('platform-003/'))!.availableAccelerators).toBe(8);
    expect(state.failedAssetIds).toContain(route[field]); invariant(design, state);
  });
  it('common upstream source cannot supply independent-feed benefit', () => {
    const design = reference(), state = run(design, [trip(feeder(design)), trip('shore/grid', 2, 'shared-trip')]);
    expect(state.transfer!.attempts[0]).toMatchObject({ reason: 'COMMON_SOURCE_FAILED', tieClosed: false, admittedW: 0 });
    expect(summarize(design, state).availableAccelerators).toBe(0); invariant(design, state);
  });
  it('fault clearance during delay cancels pending closure safely', () => {
    const design = reference(), state = run(design, [trip(feeder(design)), restore(feeder(design), 3)]);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'blocked', reason: 'ORIGINAL_RESTORED', originalClosed: true, tieClosed: false, deadlineS: null });
    expect(state.transfer!.transitions.some(transition => transition.reason === 'TRANSFERRED')).toBe(false);
    expect(state.experiment!.metrics.shortfallAcceleratorS).toBe(8); invariant(design, state);
  });
  it.each(['donorBusId', 'tieId'] as const)('revalidates %s failure during pending delay', field => {
    const design = reference(), route = design.transfer!.routes[0], state = run(design, [trip(feeder(design)), trip(route[field], 3)]);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'lockout', reason: field === 'tieId' ? 'TIE_UNAVAILABLE' : 'DONOR_UNAVAILABLE', tieClosed: false, admittedW: 0, deadlineS: null });
    expect(state.transfer!.transitions.some(transition => transition.reason === 'TRANSFERRED')).toBe(false); invariant(design, state);
  });
  it.each([3, 4, 5])('orders a donor failure at t=%i around exact t4 closure without double supply', timeS => {
    const design = reference({ delayS: 2 }), route = design.transfer!.routes[0], state = run(design, [trip(feeder(design)), trip(route.donorBusId, timeS)]);
    expect(state.transfer!.transitions.filter(transition => transition.reason === 'TRANSFERRED')).toHaveLength(timeS <= 4 ? 0 : 1);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'lockout', reason: 'DONOR_UNAVAILABLE', tieClosed: false, admittedW: 0 }); invariant(design, state);
  });
  it('downstream distribution failure after closure remains failed and opens the transfer', () => {
    const design = reference(), module = design.modules.find(module => module.platformId === 'platform-002')!, assetId = `${module.id}/distribution`;
    const state = run(design, [trip(feeder(design)), trip(assetId, 5)]);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'lockout', reason: 'DOWNSTREAM_FAILED', tieClosed: false, admittedW: 0 });
    expect(state.failedAssetIds).toContain(assetId); expect(state.modules.find(candidate => candidate.id === module.id)!.availableAccelerators).toBe(0); invariant(design, state);
  });
  it('clearing original feeder after closure keeps the non-reverting single-supply path', () => {
    const design = reference(), state = run(design, [trip(feeder(design)), restore(feeder(design), 6)]);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'transferred', originalClosed: false, tieClosed: true });
    expect(state.transfer!.transitions.filter(transition => transition.reason === 'TRANSFERRED')).toHaveLength(1);
    expect(summarize(design, state).availableAccelerators).toBe(24); invariant(design, state);
  });
  it('a second feeder failure cannot retry a cancelled one-attempt route', () => {
    const design = reference(), state = run(design, [trip(feeder(design)), restore(feeder(design), 3), trip(feeder(design), 6, 'second-feeder-trip')]);
    expect(state.transfer!.transitions.filter(transition => transition.reason === 'FEEDER_FAULT')).toHaveLength(1);
    expect(state.transfer!.attempts[0].tieClosed).toBe(false); invariant(design, state);
  });
});

describe('PH5 D/H actual path limits and useful-service coupling', () => {
  it.each([0, 1])('an unavailable/insufficient tie capacity %i W never admits a fractional platform', capacity => {
    const design = reference(), route = design.transfer!.routes[0];
    design.connections.find(edge => edge.id === route.tieConnectionIds[0])!.capacity = capacity;
    design.revision = `test-limited-${engineeringIdentity(design)}`;
    const state = run(design), attempt = state.transfer!.attempts[0];
    expect(attempt).toMatchObject({ status: 'blocked', admittedW: 0, reason: capacity === 0 ? 'NO_HEADROOM' : 'INSUFFICIENT_HEADROOM' });
    expect(attempt.bindingResourceId).toBe(`edge:${route.tieConnectionIds[0]}`); expect(attempt.unservedW).toBeGreaterThan(capacity);
    expect(state.modules.find(module => module.id.startsWith('platform-002/'))!.energizedNodes).toBe(0); invariant(design, state);
  });
  it('required network failure prevents useful service after successful electrical transfer', () => {
    const design = reference(), state = run(design, [trip(feeder(design)), trip('shore/cluster-core', 3)]);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'transferred', tieClosed: true });
    expect(state.modules.find(module => module.id.startsWith('platform-002/'))!.energizedNodes).toBe(1);
    expect(summarize(design, state).availableAccelerators).toBe(0); invariant(design, state);
  });
});

import { describe, expect, it } from 'vitest';
import { engineeringIdentity } from '../src/twin/catalog/equipment';
import { buildDesign, DEFAULT_CONFIG, replaceEquipment } from '../src/twin/assets/design';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { createTransferReferenceDesign } from '../src/twin/transfer/design';
import { validateDesign } from '../src/twin/persistence/design';
import { parseProject, projectFile, restoreProject, serializeProject } from '../src/twin/persistence/project';
import type { Design, OperationEvent } from '../src/twin/types';
import frozen from './fixtures/phase-5/frozen-expectations.json';

/** Match a donor connection to the healthy measured required native load plus
 * one independently switchable recipient and an explicit watt margin. The
 * scalar expected admission is arithmetic; no production allocator is called. */
function donorFixture(marginW = 1) {
  const design = createTransferReferenceDesign(), healthy = initialize(design), route = design.transfer!.routes[0];
  const nativeModule = healthy.modules.find(module => module.id.startsWith(`${route.donorPlatformId}/`))!;
  const networkW = design.assets.find(asset => asset.id === `${route.donorPlatformId}/cluster`)!.ratings.capacityW;
  const transformerEfficiency = design.assets.find(asset => asset.id === `${route.donorPlatformId}/transformer`)!.ratings.efficiency;
  const nativeW = nativeModule.gridW + networkW / transformerEfficiency;
  const recipientW = healthy.transfer!.attempts[0].requestedW;
  const edge = design.connections.find(edge => edge.medium === 'power' && edge.to === route.donorBusId)!;
  edge.capacity = nativeW + recipientW + marginW;
  design.revision = `test-donor-${engineeringIdentity(design)}`;
  return { design, nativeW, recipientW, edgeId: edge.id, capacityW: edge.capacity };
}
const events = (design: Design): OperationEvent[] => design.transfer!.routes.map((route, index) => ({ id: `feeder-${index}`, kind: 'trip', timeS: 2, assetId: route.originalFeederId }));
function run(design: Design, disturbances: OperationEvent[] = events(design), durationS = 12) {
  const definition = createExperimentDefinition(design, { id: 'phase5-coupling', durationS, disturbances });
  return advance(design, initialize(design, definition), durationS);
}

describe('PH5 D/E/F real shared donor competition and changing headroom', () => {
  it('restores one of two independent eligible platforms with the frozen partial-history shortfall', () => {
    const fixture = donorFixture(), state = run(fixture.design), [a, b] = state.transfer!.attempts;
    expect(a).toMatchObject({ status: 'transferred', admittedW: fixture.recipientW, tieClosed: true });
    expect(b).toMatchObject({ status: 'blocked', admittedW: 0, reason: 'INSUFFICIENT_HEADROOM', bindingResourceId: `edge:${fixture.edgeId}` });
    expect(state.modules.map(module => module.availableAccelerators)).toEqual([8, 8, 0]);
    expect(state.experiment!.metrics.shortfallAcceleratorS).toBe(frozen.partialService.expected.shortfallAcceleratorS);
    const resource = state.transfer!.resources.find(resource => resource.id === `edge:${fixture.edgeId}`)!;
    expect(resource.nativeW).toBeCloseTo(fixture.nativeW, 6);
    expect(resource.transferredW).toBeCloseTo(fixture.recipientW, 6);
    expect(resource.headroomW).toBeCloseTo(1, 6);
    expect(resource.nativeW + resource.transferredW).toBeLessThanOrEqual(fixture.capacityW + 1e-6);
  });
  it('permutes route/module/asset/connection collections without changing stable-priority admission', () => {
    const a = donorFixture().design;
    for (const route of a.transfer!.routes) route.priority = 0;
    a.revision = `equal-priority-${engineeringIdentity(a)}`;
    const b = structuredClone(a);
    b.transfer!.routes.reverse(); b.modules.reverse(); b.assets.reverse(); b.connections.reverse(); b.revision = `permuted-${engineeringIdentity(b)}`;
    const left = run(a), right = run(b);
    const allocations = (state: ReturnType<typeof run>) => state.transfer!.attempts.map(attempt => ({ id: attempt.id, status: attempt.status, reason: attempt.reason, admittedW: attempt.admittedW, unservedW: attempt.unservedW })).sort((a, b) => a.id.localeCompare(b.id));
    expect(allocations(left)).toEqual(allocations(right));
    expect(left.experiment!.metrics.shortfallAcceleratorS).toBe(right.experiment!.metrics.shortfallAcceleratorS);
  });
  it.each([3, 6])('increased native demand at t=%i invalidates pending or live transfer while protecting native load', timeS => {
    const fixture = donorFixture(), design = fixture.design;
    const state = run(design, [events(design)[0], { id: 'native-workload-increase', kind: 'workload', timeS, assetId: 'shore/grid', value: 1 }]);
    expect(state.transfer!.attempts[0]).toMatchObject({ status: timeS === 3 ? 'blocked' : 'lockout', reason: timeS === 3 ? 'INSUFFICIENT_HEADROOM' : 'CAPACITY_SHED', tieClosed: false, admittedW: 0 });
    expect(state.transfer!.transitions.filter(transition => transition.reason === 'TRANSFERRED')).toHaveLength(timeS === 3 ? 0 : 1);
    expect(state.modules.find(module => module.id.startsWith('platform-001/'))!.availableAccelerators).toBe(8);
    expect(state.modules.find(module => module.id.startsWith('platform-003/'))!.availableAccelerators).toBe(8);
    expect(state.transfer!.resources.every(resource => resource.transferredW === 0)).toBe(true);
  });
});

describe('PH5 H real thermal coupling after electrical restoration', () => {
  it('keeps transferred topology while thermal controls limit useful whole-node service', () => {
    const design = createTransferReferenceDesign();
    design.modules = design.modules.map(module => ({ ...module, nodeCount: 160, rackCount: 40 }));
    design.assets = design.assets.map(asset => asset.type === 'module' ? { ...asset, ratings: { ...asset.ratings, nodeCount: 160, rackCount: 40 } } : asset);
    Object.assign(design, { nodeCount: 480, rackCount: 120, provisionedAccelerators: 3840, installedPeakITW: 5760000 });
    Object.assign(design.config, { requestedAccelerators: 3840, pumpSpeed: 0 });
    design.revision = `test-thermal-${engineeringIdentity(design)}`;
    const state = run(design, [events(design)[0]], 600), recipient = state.modules.find(module => module.id.startsWith('platform-002/'))!;
    expect(state.transfer!.attempts[0]).toMatchObject({ status: 'transferred', tieClosed: true });
    expect(recipient.gridW).toBeGreaterThan(0);
    expect(recipient.availableAccelerators).toBeLessThan(1280);
    expect(state.log.some(entry => entry.message.includes('Thermal hysteresis'))).toBe(true);
    expect(summarize(design, state).availableAccelerators).toBeLessThan(3840);
    expect(state.experiment!.metrics.shortfallAcceleratorS).toBeGreaterThan(1280 * 2.375);
  });
});

describe('PH5 V02 installed standby dependency and actual restoration demand', () => {
  it.each([63000, 64000])('accounts for the installed replacement standby pump at a %i W tie', capacityW => {
    let design = createTransferReferenceDesign();
    const module = design.modules.find(module => module.platformId === 'platform-002')!;
    design = replaceEquipment(design, `${module.id}/pump-standby`, 'pump-physical');
    const route = design.transfer!.routes[0];
    for (const edge of design.connections) if (route.tieConnectionIds.includes(edge.id)) edge.capacity = capacityW;
    design.revision = `standby-limit-${engineeringIdentity(design)}`;
    const state = run(design, [{ id: 'duty-fails', kind: 'trip', timeS: 0, assetId: `${module.id}/pump-duty` }, events(design)[0]], 20);
    const attempt = state.transfer!.attempts[0], recipient = state.modules.find(candidate => candidate.id === module.id)!;
    if (capacityW === 63000) {
      expect(attempt.status).not.toBe('transferred');
      expect(attempt.tieClosed).toBe(false); expect(attempt.admittedW).toBe(0); expect(attempt.unservedW).toBeGreaterThan(0);
    } else {
      expect(attempt.status).toBe('transferred'); expect(recipient.availableAccelerators).toBe(8);
      const platformNetworkW = design.assets.find(asset => asset.id === 'platform-002/cluster')!.ratings.capacityW;
      const donorEfficiency = design.assets.find(asset => asset.id === 'platform-001/transformer')!.ratings.efficiency;
      expect(attempt.admittedW + 1e-6).toBeGreaterThanOrEqual(recipient.gridW + platformNetworkW / donorEfficiency);
    }
  });
  it.each([125000, 126000])('protects native donor demand with replacement standby under a %i W shared feeder', capacityW => {
    let design = createTransferReferenceDesign();
    const donorModule = design.modules.find(module => module.platformId === 'platform-001')!;
    design = replaceEquipment(design, `${donorModule.id}/pump-standby`, 'pump-physical');
    const edge = design.connections.find(edge => edge.from === 'shore/grid' && edge.to === 'platform-001/transformer')!;
    edge.capacity = capacityW; design.revision = `native-standby-limit-${engineeringIdentity(design)}`;
    const state = run(design, [{ id: 'native-duty-fails', kind: 'trip', timeS: 0, assetId: `${donorModule.id}/pump-duty` }, events(design)[0]], 20);
    const attempt = state.transfer!.attempts[0], native = state.modules.find(module => module.id === donorModule.id)!;
    expect(native.availableAccelerators).toBe(8);
    if (capacityW === 125000) {
      expect(attempt.status).not.toBe('transferred'); expect(attempt.admittedW).toBe(0);
    } else {
      expect(attempt.status).toBe('transferred');
      expect(state.modules.find(module => module.id.startsWith('platform-002/'))!.availableAccelerators).toBe(8);
      const resource = state.transfer!.resources.find(resource => resource.id === `edge:${edge.id}`)!;
      const platformNetworkW = design.assets.find(asset => asset.id === 'platform-001/cluster')!.ratings.capacityW;
      const efficiency = design.assets.find(asset => asset.id === 'platform-001/transformer')!.ratings.efficiency;
      expect(resource.nativeW + 1e-6).toBeGreaterThanOrEqual(native.gridW + platformNetworkW / efficiency);
      expect(resource.nativeW + resource.transferredW).toBeLessThanOrEqual(capacityW + 1e-6);
    }
  });
});

describe('PH5 V03 complete proposed supply path conversion losses', () => {
  it.each([63000, 65000])('accounts for an additional valid donor transformer under a %i W tie', capacityW => {
    const design = createTransferReferenceDesign();
    const central = buildDesign({ ...DEFAULT_CONFIG, generation: 1, requestedAccelerators: 24 });
    const extraTransformer = structuredClone(central.assets.find(asset => asset.id === 'shore/transformer')!);
    const sourceConnection = structuredClone(central.connections.find(edge => edge.from === 'shore/grid' && edge.to === extraTransformer.id)!);
    design.assets.push(extraTransformer); design.connections.push(sourceConnection);
    const donorConnection = design.connections.find(edge => edge.from === 'shore/grid' && edge.to === 'platform-001/transformer')!;
    donorConnection.from = extraTransformer.id; donorConnection.id = `${extraTransformer.id}>platform-001/transformer:power`;
    const route = design.transfer!.routes[0];
    for (const edge of design.connections) if (route.tieConnectionIds.includes(edge.id)) edge.capacity = capacityW;
    design.revision = `extra-conversion-${engineeringIdentity(design)}`;
    expect(() => validateDesign(design)).not.toThrow();
    const healthy = initialize(design), initialRecipient = healthy.modules.find(module => module.id.startsWith('platform-002/'))!;
    const networkW = design.assets.find(asset => asset.id === 'platform-002/cluster')!.ratings.capacityW;
    const originalEfficiency = design.assets.find(asset => asset.id === 'platform-002/transformer')!.ratings.efficiency;
    // Independently add the declared extra conversion loss to healthy original
    // module + platform-network demand. No production transfer allocator is used.
    const expectedSourceW = (initialRecipient.gridW + networkW / originalEfficiency) / extraTransformer.ratings.efficiency;
    expect(expectedSourceW).toBeGreaterThan(63000); expect(expectedSourceW).toBeLessThan(65000);
    const definition = createExperimentDefinition(design, { id: `extra-conversion-${capacityW}`, durationS: 12, disturbances: [events(design)[0]] });
    const initial = initialize(design, definition), state = advance(design, initial, 12), attempt = state.transfer!.attempts[0];
    if (capacityW === 63000) {
      expect(attempt).toMatchObject({ status: 'blocked', reason: 'INSUFFICIENT_HEADROOM', admittedW: 0, tieClosed: false });
    } else {
      expect(attempt).toMatchObject({ status: 'transferred', tieClosed: true, unservedW: 0 });
      expect(attempt.admittedW).toBeCloseTo(expectedSourceW, 6);
      expect(state.modules.find(module => module.id.startsWith('platform-002/'))!.availableAccelerators).toBe(8);
    }
    const checkpoint = advance(design, initial, 3), restored = restoreProject(parseProject(serializeProject(projectFile(design, checkpoint))));
    const resumed = advance(design, restored.state, 9);
    expect(resumed.transfer).toEqual(state.transfer); expect(resumed.modules).toEqual(state.modules); expect(resumed.experiment).toEqual(state.experiment);
  });
});

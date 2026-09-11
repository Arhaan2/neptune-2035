import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { engineeringIdentity, resolveSpecification, updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { validateDesign } from '../src/twin/persistence/design';
import { diagnosticFor } from '../src/twin/safety';
import { initializeTransfer } from '../src/twin/transfer/controller';
import { createTransferReferenceDesign, validateTransferDesign, withTransferPreset } from '../src/twin/transfer/design';
import { activePowerDesign, powerPath } from '../src/twin/transfer/topology';
import type { Design } from '../src/twin/types';

const reference = () => createTransferReferenceDesign();
function invalid(mutate: (design: Design) => void, kind: 'invalid-input' | 'unsupported-configuration') {
  const design = reference(); mutate(design);
  try { validateDesign(design); throw Error('Malformed design unexpectedly passed.'); }
  catch (error) { expect(diagnosticFor(error).kind).toBe(kind); }
}

describe('PH5 architecture definition, inventory and compatibility', () => {
  it('keeps legacy Generation III unmodified until an explicit opt-in revision', () => {
    const old = buildDesign({ ...DEFAULT_CONFIG, generation: 3, requestedAccelerators: 5128 });
    const identity = engineeringIdentity(old), snapshot = structuredClone(old);
    expect(old.transfer).toBeUndefined(); expect(initializeTransfer(old)).toBeUndefined();
    const migrated = withTransferPreset(old);
    expect(migrated.transfer).toMatchObject({ version: 1, enabled: true, policy: 'platform-transfer-1', topology: 'single-hop-radial-1' });
    expect(engineeringIdentity(migrated)).not.toBe(identity); expect(old).toEqual(snapshot);
  });
  it.each([2, 3] as const)('installs valid sparse three-platform Generation%i reference with24 actual accelerators', generation => {
    const design = createTransferReferenceDesign(generation);
    expect(() => validateDesign(design)).not.toThrow();
    expect(design.modules.map(module => module.nodeCount)).toEqual([1, 1, 1]);
    expect(design.provisionedAccelerators).toBe(24); expect(design.config.requestedAccelerators).toBe(24);
    expect(new Set(design.modules.map(module => module.platformId)).size).toBe(3);
  });
  it('adds declared immutable generic equipment with mass dimensions and included price records', () => {
    const design = reference(), equipment = design.assets.filter(asset => asset.catalogId.startsWith('transfer-'));
    expect(equipment).toHaveLength(6);
    expect(equipment.reduce((sum, asset) => sum + asset.operationalMassKg!, 0)).toBe(2800);
    for (const asset of equipment) {
      const spec = resolveSpecification(design, asset.id);
      expect(asset.ratings).toEqual(spec.ratings); expect(asset.dimensionsM).toEqual(spec.dimensionsM);
      expect(asset.operationalMassKg).toBe(spec.operationalMassKg);
      expect(spec.evidence).toBe('assumed');
      expect(spec.assumptions.toLowerCase()).toContain('assumed generic');
      expect(design.equipment!.economics.specificationUnitUSD[`${spec.id}@${spec.version}`]).toBeGreaterThan(0);
    }
  });
  it('disabled controller keeps identical transfer hardware while deliberately changing engineering identity', () => {
    const enabled = reference(), disabled = createTransferReferenceDesign(3, { enabled: false });
    expect(disabled.assets).toEqual(enabled.assets); expect(disabled.connections).toEqual(enabled.connections);
    expect(disabled.modules).toEqual(enabled.modules); expect(disabled.config).toEqual(enabled.config);
    expect(engineeringIdentity(disabled)).not.toBe(engineeringIdentity(enabled));
  });
  it('economic edits preserve engineering identity including transfer policy', () => {
    const design = reference(), repriced = updateEconomicAssumptions(design, { unitCostScale: 1.5 });
    expect(engineeringIdentity(repriced)).toBe(engineeringIdentity(design));
    expect(repriced.transfer).toEqual(design.transfer);
  });
  it('active projection changes supply edges while retaining every physical asset and platform owner', () => {
    const design = reference(), transfer = initializeTransfer(design)!;
    const before = structuredClone(design), route = design.transfer!.routes[0], attempt = transfer.attempts[0];
    attempt.originalClosed = false; attempt.tieClosed = true; attempt.status = 'transferred';
    const active = activePowerDesign(design, { transfer });
    expect(active.assets).toEqual(before.assets); expect(active.modules).toEqual(before.modules);
    expect(powerPath(active, route.receivingBusId).supported).toBe(true);
    expect(powerPath(active, route.receivingBusId).assetIds).toContain(route.donorBusId);
    expect(powerPath(active, route.receivingBusId).assetIds).not.toContain(route.originalFeederId);
    expect(design).toEqual(before);
    for (const id of route.tieConnectionIds) expect(active.connections.find(edge => edge.id === id)!.enabled).toBe(true);
    expect(active.connections.find(edge => edge.id === route.originalConnectionId)!.enabled).toBe(false);
  });
  it('recognizes double-supply topology instead of interpreting it as independent capacity', () => {
    const design = reference(), transfer = initializeTransfer(design)!;
    transfer.attempts[0].tieClosed = true;
    const active = activePowerDesign(design, { transfer });
    expect(powerPath(active, design.transfer!.routes[0].receivingBusId).supported).toBe(false);
  });
});

describe('PH5 H design admission distinguishes invalid from unsupported', () => {
  it.each([NaN, Infinity, -0.125, 60.125])('rejects nonfinite/out-of-envelope delay %s', delayS => invalid(design => { design.transfer!.delayS = delayS; }, 'invalid-input'));
  it('marks a finite off-grid delay as unsupported', () => invalid(design => { design.transfer!.delayS = 0.1; }, 'unsupported-configuration'));
  it.each([0, 0.125, 2.375, 60])('accepts declared grid delay %s', delayS => {
    expect(() => validateDesign(createTransferReferenceDesign(3, { delayS }))).not.toThrow();
  });
  it.each(['originalFeederId', 'receivingBusId', 'donorBusId', 'isolatorId', 'tieId'] as const)('rejects malformed %s asset reference', field => invalid(design => { design.transfer!.routes[0][field] = 'missing'; }, 'invalid-input'));
  it.each(['tieId', 'isolatorId', 'receivingBusId'] as const)('rejects a valid same-owner %s asset masquerading as the original feeder', replacement => invalid(design => {
    const route = design.transfer!.routes[0]; route.originalFeederId = route[replacement];
  }, 'invalid-input'));
  it('rejects a physical owner mismatch', () => invalid(design => { design.assets.find(asset => asset.id === design.transfer!.routes[0].tieId)!.parentId = 'platform-001'; }, 'invalid-input'));
  it('rejects a normally closed tie before engine admission', () => invalid(design => { design.connections.find(edge => edge.id === design.transfer!.routes[0].tieConnectionIds[0])!.enabled = true; }, 'unsupported-configuration'));
  it('rejects a second energized original supply', () => invalid(design => {
    const route = design.transfer!.routes[0];
    const edge = structuredClone(design.connections.find(edge => edge.id === route.originalConnectionId)!);
    edge.id = 'extra-energized-feed'; edge.from = route.donorBusId; design.connections.push(edge);
  }, 'unsupported-configuration'));
  it.each([NaN, Infinity, -1])('rejects nonfinite or negative tie connection rating %s', capacity => invalid(design => { design.connections.find(edge => edge.id === design.transfer!.routes[0].tieConnectionIds[0])!.capacity = capacity; }, 'invalid-input'));
  it('rejects drift from a declared immutable tie rating', () => invalid(design => { design.assets.find(asset => asset.id === design.transfer!.routes[0].tieId)!.ratings.capacityW /= 2; }, 'invalid-input'));
  it('rejects duplicate recipient routes', () => invalid(design => { design.transfer!.routes.push(structuredClone(design.transfer!.routes[0])); }, 'invalid-input'));
  it('rejects unknown policy/version rather than silently enabling it', () => {
    const design = reference(); Object.assign(design.transfer!, { policy: 'future-transfer-policy' });
    expect(() => validateTransferDesign(design)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { allAssets, buildDesign, DEFAULT_CONFIG, resolveAsset, withNetworkConnectionEnabled, withNetworkPreset } from '../src/twin/assets/design';
import { billOfEquipment, conservationResiduals, engineeringReport, inventoryCSV, marineScreen } from '../src/twin/analysis/reports';
import { resolveSpecification } from '../src/twin/catalog/equipment';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { assessNetwork } from '../src/twin/solvers/network';
import { assessNetworkPower } from '../src/twin/solvers/network-power';
import { footprintBounds } from '../src/scene/twinGeometry';
import { parseProject, projectFile, restoreProject, serializeProject } from '../src/twin/persistence/project';
import type { Design, WorkerResponse } from '../src/twin/types';

const nominal = (generation: 1 | 2 = 1, count = 8) => withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, generation, requestedAccelerators: count }), 'scalable-reference');
const full = (design: Design) => design.modules.map(module => ({ id: module.id, energizedNodes: module.nodeCount }));

describe('Phase 3 equipment authority and actual consequences', () => {
  it('reconciles fixed core/platform/module envelopes, mass, inventory, costs and report projections', () => {
    const design = nominal(), expected = [
      ['shore/cluster-core', 8000, 400, [1.2, 2, 1.2], 120000],
      ['platform-001/cluster', 1500, 600, [2, 2, 1], 25000],
      ['platform-001/module-01/rack-network', 3000, 100, [1.1, 1.5, 0.6], 20000],
    ] as const;
    const inventory = inventoryCSV(design), report = engineeringReport(design, initialize(design));
    for (const [id, power, mass, dimensions, price] of expected) {
      const asset = resolveAsset(design, id)!, spec = resolveSpecification(design, id);
      expect(asset.catalogId).toBe(spec.id); expect(asset.revision).toBe(spec.version);
      expect(asset.ratings.capacityW).toBe(power); expect(asset.operationalMassKg).toBe(mass); expect(asset.dimensionsM).toEqual(dimensions);
      expect(spec.ratings.capacityW).toBe(power); expect(spec.operationalMassKg).toBe(mass); expect(spec.dimensionsM).toEqual(dimensions);
      const bounds = footprintBounds([asset]); expect(bounds.maxX - bounds.minX).toBeCloseTo(dimensions[0]); expect(bounds.maxZ - bounds.minZ).toBeCloseTo(dimensions[2]);
      expect(design.equipment!.economics.specificationUnitUSD[`${spec.id}@${spec.version}`]).toBe(price);
      const row = inventory.split('\n').find(line => line.startsWith(`"${id}"`))!;
      expect(row).toContain(`"${mass}"`); expect(row).toContain(spec.id); expect(report).toContain(spec.id);
    }
    const bill = billOfEquipment(design), networkRows = bill.rows.filter(row => row.scope.startsWith('Network:'));
    expect(networkRows.reduce((sum, row) => sum + row.totalUSD, 0)).toBe(165000);
    expect(bill.rows.some(row => row.scope === 'Networking')).toBe(false);
    expect(bill.completeWithinIncludedScope).toBe(true);
    const legacy = buildDesign(design.config);
    expect(bill.totalUSD - billOfEquipment(legacy).totalUSD).toBeCloseTo((165000 - 150000) * 1.2 * 1.25, 5);
    expect(report).toContain('shore mass stays outside marine totals');
    expect(report).toContain('platform');
    expect(marineScreen(withNetworkPreset(design, 'undersized-shared-core'))).toEqual(marineScreen(design));
    expect(Array.from(allAssets(design)).filter(asset => asset.type === 'network')).toHaveLength(3);
  });

  it('draws root network loads from the actual supply and module switch load from its critical bus in main and worker', async () => {
    const design = nominal(), legacy = buildDesign(design.config), power = assessNetworkPower(design);
    expect(power.allocations).toHaveLength(2);
    expect(power.allocations.find(allocation => allocation.assetId === 'shore/cluster-core')).toMatchObject({ requestedW: 8000, suppliedW: 8000, gridW: 8000, available: true });
    expect(power.allocations.find(allocation => allocation.assetId === 'platform-001/cluster')!.gridW).toBeCloseTo(1500 / 0.98, 8);
    expect(power.gridW).toBeCloseTo(8000 + 1500 / 0.98, 8);
    const state = initialize(design), old = initialize(legacy);
    expect(state.modules[0].gridW - old.modules[0].gridW).toBeCloseTo(3000 / (0.98 * 0.97), 7);
    expect(summarize(design, state).gridW).toBeCloseTo(state.modules[0].gridW + power.gridW, 7);
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'initialize', design });
    expect(responses.at(-1)?.status).toBe('complete'); expect(responses.at(-1)?.state).toEqual(state);
    const advanced = advance(design, state, 1);
    expect(advanced.gridEnergyWh).toBeCloseTo(summarize(design, advanced).gridW / 3600, 8);
    const residuals = conservationResiduals(design, advanced);
    expect(Math.abs(residuals.electricalNormalized)).toBeLessThan(1e-9); expect(Math.abs(residuals.thermalNormalized)).toBeLessThan(1e-9);
  });

  it('propagates an actual local supply failure while module batteries remain energized and unrelated domain works', () => {
    const design = nominal(2, 10000), first = design.modules[0], failed = `${first.platformId}/switchboard`;
    const power = assessNetworkPower(design, [failed]);
    expect(power.unavailableAssetIds).toEqual([first.networkDomainId]);
    const state = advance(design, initialize(design), 1, [{ id: 'local-power', timeS: 0, kind: 'trip', assetId: failed }]);
    const local = state.modules.filter(module => module.id.startsWith(`${first.platformId}/`));
    expect(local.every(module => module.energizedNodes > 0 && module.availableAccelerators === 0 && module.batteryDischargeW > 0)).toBe(true);
    expect(state.modules.filter(module => !module.id.startsWith(`${first.platformId}/`)).every(module => module.availableAccelerators > 0)).toBe(true);
    const evaluated = assessNetwork(design, full(design), [failed]);
    expect(evaluated.blockedDomainIds).toEqual([first.networkDomainId]);
    const restored = advance(design, state, 1, [{ id: 'local-power-restored', timeS: 1, kind: 'restore', assetId: failed }]);
    expect(restored.modules.every(module => module.availableAccelerators > 0)).toBe(true);
  });

  it('retains the common shore-grid dependency instead of claiming independent domains', () => {
    const design = nominal(2, 10000), power = assessNetworkPower(design, ['shore/grid']);
    expect(power.allocations.every(allocation => !allocation.available && allocation.suppliedW === 0)).toBe(true);
    expect(power.gridW).toBe(0);
    const state = advance(design, initialize(design), 1, [{ id: 'grid-failed', timeS: 0, kind: 'trip', assetId: 'shore/grid' }]);
    expect(state.modules.every(module => module.energizedNodes > 0 && module.availableAccelerators === 0)).toBe(true);
    expect(assessNetwork(design, full(design), ['shore/grid']).blockedDomainIds).toHaveLength(2);
  });

  it('persists disabled connection mapping as an explicit revision and rejects nonexistent link IDs', () => {
    const original = nominal(), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const changed = withNetworkConnectionEnabled(original, edge.id, false);
    expect(changed.revision).not.toBe(original.revision);
    expect(original.connections.find(connection => connection.id === edge.id)!.enabled).toBe(true);
    const restored = restoreProject(parseProject(serializeProject(projectFile(changed, initialize(changed)))));
    expect(restored.design.connections.find(connection => connection.id === edge.id)!.enabled).toBe(false);
    expect(restored.state.modules[0].availableAccelerators).toBe(0);
    expect(() => withNetworkConnectionEnabled(original, 'unknown-link', false)).toThrow(/link|mapping/i);
    expect(assessNetwork(withNetworkConnectionEnabled(changed, edge.id, true), full(original)).status).toBe('satisfied');
  });
});

import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, withNetworkPreset } from '../src/twin/assets/design';
import { assessNetwork, assessNetworkProvisioning } from '../src/twin/solvers/network';
import { initialize } from '../src/twin/engine/simulation';
import type { Design } from '../src/twin/types';

const full = (design: Design) => design.modules.map(module => ({ id: module.id, energizedNodes: module.nodeCount }));
const nominal = (requestedAccelerators = 10_000, external = true) => withNetworkPreset(buildDesign({
  ...DEFAULT_CONFIG, requestedAccelerators, requireExternalNetwork: external, supplyW: 10e9,
}), 'scalable-reference');
const budget = (design: Design, capacity: number): Design => ({ ...design, assets: design.assets.map(asset => asset.id === 'shore/cluster-core'
  ? { ...asset, ratings: { ...asset.ratings, switchingCapacityBitS: capacity } } : asset) });
const structural = (design: Design) => assessNetwork(design, full(design));
const sortedResources = (design: Design) => structural(design).resources.map(resource => ({ ...resource, domainIds: [...resource.domainIds].sort() })).sort((a, b) => a.resourceId.localeCompare(b.resourceId));

describe('Phase 3 independent fixed equipment and resource arithmetic', () => {
  it.each([
    [8, 1, 8, 3.2e12], [10_000, 1_250, 8, 3.2e12], [31_992, 3_999, 8, 3.2e12],
    [32_001, 4_001, 8, 3.2e12], [100_000, 12_500, 32, 12.8e12],
    [500_000, 62_500, 256, 25.6e12], [1_000_000, 125_000, 256, 25.6e12],
  ])('provisions %i accelerators using a finite catalog tier and satisfies every traversed resource', (requested, nodes, ports, switchBudget) => {
    const design = nominal(requested), result = assessNetworkProvisioning(design);
    expect(result.assessmentBasis).toBe('installed'); expect(result.status).toBe('satisfied');
    expect(result.energizedNodes).toBe(nodes);
    expect(result.clusterDemandBitS).toBe(nodes * 100_000_000);
    expect(result.externalDemandBitS).toBe(nodes * 1_000_000);
    const core = design.assets.find(asset => asset.id === 'shore/cluster-core')!;
    expect(core.ports.filter(port => port.medium === 'cluster' && port.direction === 'out')).toHaveLength(ports);
    expect(result.resources.find(resource => resource.resourceId === 'switch:shore/cluster-core')).toMatchObject({
      kind: 'switch', capacityBitS: switchBudget, demandBitS: nodes * 101_000_000,
      headroomBitS: switchBudget - nodes * 101_000_000,
    });
    expect(result.resources.length).toBeGreaterThan(design.modules.length);
    // Inspect every physical resource without creating hundreds of thousands of
    // matcher objects in the bounded million-accelerator case.
    const invalid = result.resources.filter(resource => resource.demandBitS > resource.capacityBitS
      || resource.headroomBitS !== resource.capacityBitS - resource.demandBitS
      || resource.maxUtilization === null || !Number.isFinite(resource.maxUtilization));
    expect(invalid).toEqual([]);
  });

  it('reports the intentionally undersized campus shared switch while individual 400G uplinks fit', () => {
    const design = withNetworkPreset(nominal(100_000), 'undersized-shared-core'), result = structural(design);
    expect(result.status).toBe('violated');
    expect(result.bottlenecks).toEqual([expect.objectContaining({
      resourceId: 'switch:shore/cluster-core', assetId: 'shore/cluster-core', capacityBitS: 400e9, demandBitS: 1.2625e12,
    })]);
    expect(result.blockedDomainIds).toHaveLength(20);
    expect(result.resources.filter(resource => resource.kind !== 'switch').every(resource => resource.demandBitS <= resource.capacityBitS)).toBe(true);
  });

  it('does not pool unused path capacity to cover an overloaded platform uplink', () => {
    const original = nominal(), first = original.modules[0].networkDomainId;
    const design = { ...original, connections: original.connections.map(connection => connection.medium === 'cluster' && connection.to === first ? { ...connection, capacity: 64.5e9 } : connection) };
    const result = structural(design);
    expect(result.blockedDomainIds).toEqual([first]);
    expect(result.bottlenecks).toEqual([expect.objectContaining({ demandBitS: 64.64e9, capacityBitS: 64.5e9, domainIds: [first] })]);
    const links = result.resources.filter(resource => resource.kind === 'edge');
    expect(links.reduce((sum, resource) => sum + resource.capacityBitS, 0)).toBeGreaterThan(result.clusterDemandBitS + result.externalDemandBitS);
  });

  it('requires both adequate ports and an adequate shared budget and combines originated/transit classes once', () => {
    const original = nominal(), insufficient = structural(budget(original, 126e9)), adequate = structural(budget(original, 126.25e9));
    expect(insufficient.status).toBe('violated');
    expect(insufficient.bottlenecks).toEqual([expect.objectContaining({ resourceId: 'switch:shore/cluster-core', demandBitS: 126.25e9, capacityBitS: 126e9 })]);
    expect(adequate.status).toBe('satisfied');
    expect(adequate.resources.find(resource => resource.resourceId === 'switch:shore/cluster-core')).toMatchObject({ demandBitS: 126.25e9, capacityBitS: 126.25e9, headroomBitS: 0, maxUtilization: 1 });
    const local = adequate.resources.find(resource => resource.resourceId === `switch:${original.modules[0].networkDomainId}`)!;
    expect(local.demandBitS).toBe(64.64e9);
  });

  it('does not present a zero-supply undersized campus as adequate provisioned networking', () => {
    const design = withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 100_000, supplyW: 0, batteryWhPerModule: 0, batteryMaxWPerModule: 0 }), 'undersized-shared-core');
    const state = initialize(design), instantaneous = assessNetwork(design, state.modules), installed = assessNetworkProvisioning(design);
    expect(instantaneous.assessmentBasis).toBe('energized'); expect(instantaneous.clusterDemandBitS).toBe(0);
    expect(installed.assessmentBasis).toBe('installed'); expect(installed.clusterDemandBitS).toBe(1.25e12); expect(installed.status).toBe('violated');
  });

  it('makes equivalent irrelevant asset and connection ordering deterministic', () => {
    const design = nominal(), reordered = { ...design, assets: [...design.assets].reverse(), connections: [...design.connections].reverse() };
    expect(sortedResources(reordered)).toEqual(sortedResources(design));
    expect(structural(reordered).blockedDomainIds).toEqual(structural(design).blockedDomainIds);
    expect(structural(reordered).status).toBe(structural(design).status);
  });
});

describe('Phase 3 bounded topology failures and invalid graphs', () => {
  it('isolates local disabled link loss and restores exactly without alternate routing', () => {
    const original = nominal(), domain = original.modules[0].networkDomainId;
    const disabled = { ...original, connections: original.connections.map(connection => connection.medium === 'cluster' && connection.to === domain ? { ...connection, enabled: false } : connection) };
    const result = structural(disabled);
    expect(result.status).toBe('violated'); expect(result.unreachableDomainIds).toEqual([domain]); expect(result.blockedDomainIds).toEqual([domain]);
    expect(result.unsupportedDomainIds).toEqual([]);
    const restored = { ...disabled, connections: disabled.connections.map(connection => ({ ...connection, enabled: original.connections.find(source => source.id === connection.id)!.enabled })) };
    expect(structural(restored)).toEqual(structural(original));
  });

  it('applies local switch failure and shared-core common-mode failure to the actual downstream domains', () => {
    const design = nominal(), local = design.modules[0].networkDomainId;
    expect(assessNetwork(design, full(design), [local]).blockedDomainIds).toEqual([local]);
    const shared = assessNetwork(design, full(design), ['shore/cluster-core']);
    expect(shared.unreachableDomainIds).toEqual([...new Set(design.modules.map(module => module.networkDomainId))].sort());
    expect(shared.blockedDomainIds).toEqual(shared.unreachableDomainIds);
    expect(assessNetwork(design, full(design), []).status).toBe('satisfied');
  });

  it.each([0, 1])('rejects multiple parents even with %i energized nodes in the first module', count => {
    const design = nominal(8), edge = design.connections.find(connection => connection.medium === 'cluster')!;
    const bad = { ...design, connections: [...design.connections, { ...edge, id: 'phase3-duplicate-parent' }] };
    const result = assessNetwork(bad, [{ id: design.modules[0].id, energizedNodes: count }]);
    expect(result.status).toBe('unsupported'); expect(result.unsupportedDomainIds).toEqual([design.modules[0].networkDomainId]);
  });

  it('rejects invalid graph numeric values even with zero allocations', () => {
    const design = nominal(8), zero = [{ id: design.modules[0].id, energizedNodes: 0 }];
    for (const value of [-1, NaN, Infinity]) expect(() => assessNetwork(budget(design, value), zero)).toThrow();
    const duplicate = { ...design, assets: [...design.assets, structuredClone(design.assets[0])] };
    expect(() => assessNetwork(duplicate, zero)).toThrow();
    const malformed = { ...design, connections: design.connections.map(connection => connection.medium === 'cluster' ? { ...connection, toPort: 'unknown-port' } : connection) };
    expect(() => assessNetwork(malformed, zero)).toThrowError(expect.objectContaining({
      diagnostic: expect.objectContaining({ kind: 'invalid-input', code: 'NETWORK_PORT_TOPOLOGY' }),
    }));
  });
});

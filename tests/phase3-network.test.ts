import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { assessNetwork, createNetworkEvaluator } from '../src/twin/solvers/network';
import type { Design } from '../src/twin/types';

// Independent acceptance arithmetic: these literals come from the Phase 3 brief,
// not the production profile or a simulation allocation affected by electricity.
const full = (design: Design) => design.modules.map(module => ({ id: module.id, energizedNodes: module.nodeCount }));
const legacy = (requestedAccelerators: number, external = false) => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators, requireExternalNetwork: external });

describe('Phase 3 independent legacy capacity baseline', () => {
  it.each([
    [8, 1, 0.1e9, 'satisfied'],
    [10_000, 1_250, 125e9, 'satisfied'],
    [31_992, 3_999, 399.9e9, 'satisfied'],
    [31_999, 4_000, 400e9, 'satisfied'],
    [32_000, 4_000, 400e9, 'satisfied'],
    [32_001, 4_001, 400.1e9, 'violated'],
    [32_008, 4_001, 400.1e9, 'violated'],
    [100_000, 12_500, 1.25e12, 'violated'],
  ] as const)('%i requested accelerators provision %i nodes offering %i bit/s: %s', (requested, nodes, demand, status) => {
    const design = legacy(requested), result = assessNetwork(design, full(design));
    expect(design.nodeCount).toBe(nodes);
    expect(design.provisionedAccelerators).toBe(nodes * 8);
    expect(result.energizedNodes).toBe(nodes);
    expect(result.clusterDemandBitS).toBe(demand);
    expect(result.status).toBe(status);
    if (status === 'violated') {
      expect(result.bottlenecks).toContainEqual(expect.objectContaining({
        assetId: 'shore/cluster-core', resourceId: 'port:shore/cluster-core:cluster-out',
        demandBitS: demand, capacityBitS: 400e9,
        domainIds: [...new Set(design.modules.map(module => module.networkDomainId))],
      }));
      expect(result.unreachableDomainIds).toEqual([]);
      expect(result.unsupportedDomainIds).toEqual([]);
    } else expect(result.bottlenecks).toEqual([]);
  });

  it('offers 1.25 Tbit/s cluster and 12.5 Gbit/s external for the fully energized campus', () => {
    const design = legacy(100_000, true), result = assessNetwork(design, full(design));
    expect(result.clusterDemandBitS).toBe(1.25e12);
    expect(result.externalDemandBitS).toBe(12.5e9);
    expect(result.status).toBe('violated');
  });

  it('combines the two classes exactly once on a shared local physical port', () => {
    const original = legacy(8, true), domain = original.modules[0].networkDomainId;
    const design = { ...original, assets: original.assets.map(asset => asset.id === domain
      ? { ...asset, ports: asset.ports.map(port => port.id === 'cluster-out' ? { ...port, capacity: 100.5e6 } : port) } : asset) };
    const result = assessNetwork(design, full(design));
    expect(result.bottlenecks).toContainEqual(expect.objectContaining({
      resourceId: `port:${domain}:cluster-out`, demandBitS: 101e6, capacityBitS: 100.5e6, domainIds: [domain],
    }));
    // Canonical lazy module links inherit the endpoint's smaller physical rating.
    expect(result.bottlenecks).toContainEqual(expect.objectContaining({
      resourceId: `edge:${domain}>${original.modules[0].id}/rack-network:cluster`, demandBitS: 101e6, capacityBitS: 100.5e6,
    }));
    expect(result.bottlenecks).toHaveLength(2);
  });

  it('keeps a valid undersized graph distinct from an unreachable graph and an unsupported graph', () => {
    const original = legacy(8), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const replaced = (patch: Partial<typeof edge>): Design => ({ ...original, connections: original.connections.map(connection => connection.id === edge.id ? { ...connection, ...patch } : connection) });
    const small = assessNetwork(replaced({ capacity: 0 }), full(original));
    expect(small.status).toBe('violated'); expect(small.maxUtilization).toBeNull();
    expect(small.bottlenecks).toContainEqual(expect.objectContaining({ resourceId: `edge:${edge.id}`, capacityBitS: 0, demandBitS: 100e6 }));
    const disconnected = assessNetwork(replaced({ enabled: false }), full(original));
    expect(disconnected.status).toBe('violated'); expect(disconnected.unreachableDomainIds).toEqual([original.modules[0].networkDomainId]);
    expect(disconnected.bottlenecks).toEqual([]);
    const ambiguous = assessNetwork({ ...original, connections: [...original.connections, { ...edge, id: 'independent-test-second-parent' }] }, full(original));
    expect(ambiguous.status).toBe('unsupported'); expect(ambiguous.unsupportedDomainIds).toEqual([original.modules[0].networkDomainId]);
  });

  it('returns finite zero-demand results at a zero-capacity resource and rejects invalid numbers', () => {
    const original = legacy(8), design = { ...original, connections: original.connections.map(connection => connection.medium === 'cluster' ? { ...connection, capacity: 0 } : connection) };
    expect(assessNetwork(design, [{ id: design.modules[0].id, energizedNodes: 0 }])).toMatchObject({
      energizedNodes: 0, clusterDemandBitS: 0, externalDemandBitS: 0, status: 'satisfied', maxUtilization: 0, bottlenecks: [],
    });
    for (const bad of [NaN, Infinity, -1]) {
      expect(() => createNetworkEvaluator({ ...original, connections: original.connections.map(connection => connection.medium === 'cluster' ? { ...connection, capacity: bad } : connection) })).toThrow();
      expect(() => createNetworkEvaluator(original, { clusterBitSPerNode: bad, externalBitSPerNode: 0 })).toThrow();
      expect(() => assessNetwork(original, [{ id: original.modules[0].id, energizedNodes: bad }])).toThrow();
    }
  });
});

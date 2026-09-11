import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, withNetworkConnectionEnabled, withNetworkPreset } from '../src/twin/assets/design';
import { assessNetwork, assessNetworkProvisioning, createNetworkEvaluator } from '../src/twin/solvers/network';
import { diagnosticFor } from '../src/twin/safety';
import type { Design } from '../src/twin/types';

const fixture = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, requireExternalNetwork: false });
const full = (design: Design) => design.modules.map(module => ({ id: module.id, energizedNodes: module.nodeCount }));
const idle = (design: Design) => design.modules.map(module => ({ id: module.id, energizedNodes: 0 }));

function disposition(design: Design, energized: boolean) {
  try { return assessNetwork(design, energized ? full(design) : idle(design)).status; }
  catch (error) { return diagnosticFor(error).kind; }
}

describe('Phase 3 graph admission remains visible without offered demand', () => {
  it.each([true, false])('does not accept a missing endpoint port with energized=%s', energized => {
    const original = fixture(), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const design = { ...original, connections: original.connections.map(connection => connection.id === edge.id ? { ...connection, toPort: 'missing-input-port' } : connection) };
    expect(['unsupported', 'unsupported-configuration', 'invalid-input']).toContain(disposition(design, energized));
  });

  it('rejects duplicate port identities before their first-match order can affect capacity', () => {
    const original = fixture();
    const design = { ...original, assets: original.assets.map(asset => asset.id === 'shore/cluster-core'
      ? { ...asset, ports: [...asset.ports, { ...asset.ports.find(port => port.id === 'cluster-out')!, capacity: 0 }] } : asset) };
    expect(() => createNetworkEvaluator(design)).toThrow();
  });

  it('does not accept malformed disabled links just because they carry no load', () => {
    const original = fixture(), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const design = { ...original, connections: original.connections.map(connection => connection.id === edge.id
      ? { ...connection, fromPort: 'missing-output-port', enabled: false } : connection) };
    expect(['unsupported', 'unsupported-configuration', 'invalid-input']).toContain(disposition(design, false));
  });

  it('distinguishes an unsupported cycle in an unreachable required domain from ordinary disconnection', () => {
    const original = fixture(), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const domain = original.assets.find(asset => asset.id === edge.to)!;
    const intermediary = { ...domain, id: 'disconnected-switch', name: 'Independent disconnected switch fixture' };
    const onward = { ...edge, id: 'fixture-onward', from: intermediary.id, fromPort: 'cluster-out' };
    const back = { ...edge, id: 'fixture-back', from: domain.id, fromPort: 'cluster-out', to: intermediary.id };
    const design = { ...original, assets: [...original.assets, intermediary], connections: [
      ...original.connections.filter(connection => connection.id !== edge.id), onward, back,
    ] };
    expect(['unsupported', 'unsupported-configuration']).toContain(disposition(design, true));
    expect(['unsupported', 'unsupported-configuration']).toContain(disposition(design, false));
  });

  it.each([true, false])('rejects ambiguous required parents in a disconnected domain, energized=%s', energized => {
    const original = fixture(), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const domain = original.assets.find(asset => asset.id === edge.to)!;
    const upstream = ['disconnected-a', 'disconnected-b'].map(id => ({ ...domain, id }));
    const design = { ...original, assets: [...original.assets, ...upstream], connections: [
      ...original.connections.filter(connection => connection.id !== edge.id),
      ...upstream.map(asset => ({ ...edge, id: `fixture-${asset.id}`, from: asset.id, fromPort: 'cluster-out' })),
    ] };
    expect(['unsupported', 'unsupported-configuration']).toContain(disposition(design, energized));
  });

  it('keeps valid zero-demand disconnection separate from its installed connectivity failure', () => {
    const original = fixture(), edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const design = { ...original, connections: original.connections.map(connection => connection.id === edge.id ? { ...connection, enabled: false } : connection) };
    expect(assessNetwork(design, idle(design))).toMatchObject({ status: 'satisfied', maxUtilization: 0 });
    expect(assessNetworkProvisioning(design)).toMatchObject({ assessmentBasis: 'installed', status: 'violated', unreachableDomainIds: [design.modules[0].networkDomainId] });
  });
});

describe('Phase 3 inspector and simulation evaluator agreement', () => {
  const nominal = (supplyW = 200e6) => withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, generation: 2, requestedAccelerators: 10_000, supplyW, requireExternalNetwork: true }), 'scalable-reference');

  it('applies the declared common and local root-switch power dependencies in the standalone evaluator', () => {
    const design = nominal(), allDomains = [...new Set(design.modules.map(module => module.networkDomainId))];
    expect(assessNetwork(design, full(design)).status).toBe('satisfied');
    expect(assessNetwork(design, full(design), ['shore/grid'])).toMatchObject({ status: 'violated', unreachableDomainIds: allDomains, bottlenecks: [] });
    expect(assessNetwork(design, full(design), [design.modules[0].powerDomainId])).toMatchObject({ status: 'violated', unreachableDomainIds: [design.modules[0].networkDomainId], bottlenecks: [] });
    expect(assessNetwork(design, full(design)).status).toBe('satisfied');
  });

  it('retains the generation-one shared power dependency across platform network domains', () => {
    const design = withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, generation: 1, requestedAccelerators: 10_000, supplyW: 200e6 }), 'scalable-reference');
    const allDomains = [...new Set(design.modules.map(module => module.networkDomainId))];
    expect(assessNetwork(design, full(design), ['shore/bus'])).toMatchObject({ status: 'violated', unreachableDomainIds: allDomains });
  });

  it('uses full installed demand independently of instantaneous supply and still respects disabled network links', () => {
    const design = nominal(0);
    expect(assessNetwork(design, full(design))).toMatchObject({ status: 'violated', clusterDemandBitS: 125e9, externalDemandBitS: 1.25e9 });
    expect(assessNetworkProvisioning(design)).toMatchObject({ status: 'satisfied', assessmentBasis: 'installed', clusterDemandBitS: 125e9, externalDemandBitS: 1.25e9 });
    const edge = design.connections.find(connection => connection.medium === 'cluster' && connection.to === design.modules[0].networkDomainId)!;
    const cut = withNetworkConnectionEnabled(design, edge.id, false);
    expect(assessNetworkProvisioning(cut)).toMatchObject({ status: 'violated', unreachableDomainIds: [design.modules[0].networkDomainId] });
  });

  it.each(['scalable-reference', 'undersized-shared-core'] as const)('preserves admission and limiting domains with resource materialization disabled: %s', preset => {
    const design = withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 32_008, supplyW: 200e6, requireExternalNetwork: true }), preset);
    for (const failed of [[], ['shore/grid'], [design.modules[0].networkDomainId]]) {
      const complete = createNetworkEvaluator(design)(full(design), failed);
      const compact = createNetworkEvaluator(design, undefined, { includeResources: false })(full(design), failed);
      expect(complete.resources.length).toBeGreaterThan(0);
      expect(compact).toEqual({ ...complete, resources: [] });
    }
  });
});

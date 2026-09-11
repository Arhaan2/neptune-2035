import { describe, expect, it } from 'vitest';
import { buildDesign, connectionsForModule, DEFAULT_CONFIG, moduleAssets, withNetworkPreset } from '../src/twin/assets/design';
import { createNetworkEvaluator } from '../src/twin/solvers/network';
import { diagnosticFor } from '../src/twin/safety';
import type { Design } from '../src/twin/types';

const fixture = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1_288 });
const allocations = (design: Design) => design.modules.map(module => ({ id: module.id, energizedNodes: module.nodeCount }));

describe('Phase 3 canonical network projection', () => {
  it.each(['legacy', 'scalable-reference', 'undersized-shared-core'] as const)('retains exact canonical inventory, connections and ordering for %s', preset => {
    const initial = fixture(), design = preset === 'legacy' ? initial : withNetworkPreset(initial, preset);
    for (const module of design.modules) {
      const full = moduleAssets(design, module.id);
      const network = moduleAssets(design, module.id, { networkOnly: true });
      expect(network).toEqual(full.filter(asset => ['network', 'rack', 'compute'].includes(asset.type)));
      const links = connectionsForModule(design, module.id).filter(connection => connection.medium === 'cluster' || connection.medium === 'external-network');
      expect(connectionsForModule(design, module.id, { assets: network, networkOnly: true })).toEqual(links);
      const attachment = moduleAssets(design, module.id, { networkOnly: true, attachmentOnly: true });
      expect(attachment).toEqual(full.filter(asset => asset.type === 'network'));
      expect(connectionsForModule(design, module.id, { assets: attachment, networkOnly: true, attachmentOnly: true })).toEqual(links.filter(connection => connection.from === module.networkDomainId));
    }
  });

  it.each([0, 1])('keeps malformed dormant stored endpoints visible with no required classes and %i energized nodes', energizedNodes => {
    const original = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, requireClusterNetwork: false, requireExternalNetwork: false });
    const edge = original.connections.find(connection => connection.medium === 'cluster')!;
    const design = { ...original, connections: original.connections.map(connection => connection.id === edge.id ? { ...connection, toPort: 'missing-port', enabled: false } : connection) };
    expect(() => createNetworkEvaluator(design, undefined, { includeResources: false })([{ id: design.modules[0].id, energizedNodes }])).toThrow(/compatible directional ports/);
  });

  it.each(['legacy', 'scalable-reference'] as const)('checks the actual dormant platform-to-module attachment for %s', preset => {
    const initial = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, requireClusterNetwork: false, requireExternalNetwork: false });
    const original = preset === 'legacy' ? initial : withNetworkPreset(initial, preset);
    const design = { ...original, assets: original.assets.map(asset => asset.id === original.modules[0].networkDomainId
      ? { ...asset, ports: asset.ports.map(port => port.medium === 'cluster' && port.direction === 'out' ? { ...port, direction: 'in' as const } : port) } : asset) };
    expect(() => createNetworkEvaluator(design, undefined, { includeResources: false })(allocations(design))).toThrow(/compatible directional ports/);
  });

  it('retains the full inspector projection when connectivity is optional and the simulation projection is compact', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, requireClusterNetwork: false, requireExternalNetwork: false });
    const complete = createNetworkEvaluator(design)(allocations(design));
    const compact = createNetworkEvaluator(design, undefined, { includeResources: false })(allocations(design));
    expect(complete.resources.length).toBeGreaterThan(0);
    expect(compact).toEqual({ ...complete, resources: [] });
  });

  it.each(['rack-01/node-01', 'rack-01'])('preserves optional compact allocation validation and recovery for failed %s', suffix => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 40, requireClusterNetwork: false, requireExternalNetwork: false });
    const complete = createNetworkEvaluator(design), compact = createNetworkEvaluator(design, undefined, { includeResources: false });
    const failed = [`${design.modules[0].id}/${suffix}`];
    const disposition = (evaluate: typeof compact, nodes: number, failures: string[]) => {
      try { return { ...evaluate([{ id: design.modules[0].id, energizedNodes: nodes }], failures), resources: [] }; }
      catch (error) { return diagnosticFor(error); }
    };
    // Reuse each evaluator: dormant validation must not cache an empty graph
    // that a later failure query mistakes for the complete operable inventory.
    expect(disposition(compact, 5, [])).toEqual(disposition(complete, 5, []));
    const fullInvalid = disposition(complete, 5, failed);
    expect(fullInvalid).toMatchObject({ kind: 'invalid-input', code: 'NETWORK_OPERABLE_INVENTORY' });
    expect(disposition(compact, 5, failed)).toEqual(fullInvalid);
    for (const nodes of [0, suffix.includes('/node-') ? 4 : 1]) {
      const expected = disposition(complete, nodes, failed);
      expect(expected).toMatchObject({ status: 'satisfied', energizedNodes: nodes });
      expect(disposition(compact, nodes, failed)).toEqual(expected);
    }
    expect(disposition(compact, 5, [])).toEqual(disposition(complete, 5, []));
  });
});

import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { assessNetwork, createNetworkEvaluator } from '../src/twin/solvers/network';
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
  });
});

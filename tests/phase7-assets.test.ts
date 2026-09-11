import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, resolveAsset } from '../src/twin/assets/design';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { createTransferReferenceDesign } from '../src/twin/transfer/design';
import { assetConnections, assetOperatingStatus, visualAssetStates } from '../src/twin/presentation/assets';

const design = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 72 });

describe('PH7 installed asset presentation retains authoritative state and topology', () => {
  it('distinguishes an unobserved global asset from an explicit failure without changing state', () => {
    const d = design(), initial = initialize(d);
    const before = structuredClone(initial);
    expect(assetOperatingStatus(null, 'shore/grid')).toBe('unknown');
    expect(assetOperatingStatus(initial, 'shore/grid')).toBe('unknown');
    expect(assetOperatingStatus(initial, 'not-installed')).toBe('unknown');
    expect(initial).toEqual(before);
    const failed = advance(d, initial, 1, [{ id: 'grid-trip', kind: 'trip', assetId: 'shore/grid', timeS: 1 }]);
    expect(assetOperatingStatus(failed, 'shore/grid')).toBe('failed');
    expect(visualAssetStates(failed)['shore/grid']).toBe('failed');
  });
  it.each(['pump-duty', 'pump-standby', 'pump-sea', 'cdu', 'hx', 'battery', 'distribution', 'rack-network'])('keeps the installed %s identity and actual controller state', suffix => {
    const d = design(), state = initialize(d), id = `${d.modules[0].id}/${suffix}`;
    expect(resolveAsset(d, id)).toBeDefined();
    expect(assetOperatingStatus(state, id)).toBe(state.modules[0].states[id]);
    expect(visualAssetStates(state)[id]).toBe(state.modules[0].states[id]);
  });
  it('explicit pump failure remains visible even if a retained module status disagrees', () => {
    const d = design(), state = initialize(d), id = `${d.modules[0].id}/pump-duty`;
    state.failedAssetIds.push(id);
    const before = structuredClone(state);
    expect(state.modules[0].states[id]).toBe('running');
    expect(assetOperatingStatus(state, id)).toBe('failed');
    expect(visualAssetStates(state)[id]).toBe('failed');
    expect(state).toEqual(before);
  });
  it('pump connection inspection returns only installed incident power and the correct fluid circuit', () => {
    const d = design(), state = initialize(d), prefix = d.modules[0].id;
    for (const [suffix, medium] of [['pump-duty', 'technical'], ['pump-sea', 'seawater']] as const) {
      const id = `${prefix}/${suffix}`, edges = assetConnections(d, state, id);
      expect(edges.length).toBeGreaterThan(0);
      expect(new Set(edges.map(edge => edge.medium))).toEqual(new Set(['power', medium]));
      for (const edge of edges) {
        expect(edge.from === id || edge.to === id).toBe(true);
        expect(resolveAsset(d, edge.from)).toBeDefined();
        expect(resolveAsset(d, edge.to)).toBeDefined();
      }
    }
    expect(assetConnections(d, state, '<img src=x onerror=alert(1)>')).toEqual([]);
  });
  it('historical receiving-bus connections reflect actual isolation and transfer while retaining physical ownership', () => {
    const d = createTransferReferenceDesign(3), route = d.transfer!.routes[0];
    const definition = createExperimentDefinition(d, { id: 'p7-asset-transfer', durationS: 12, disturbances: [{ id: 'feeder-trip', timeS: 2, kind: 'trip', assetId: route.originalFeederId }] });
    const initial = initialize(d, definition), waiting = advance(d, initial, 2), transferred = advance(d, waiting, 3);
    const originalDesign = structuredClone(d), final = structuredClone(transferred);
    const paths = [initial, waiting, transferred].map(state => assetConnections(d, state, route.receivingBusId).filter(edge => edge.medium === 'power' && edge.enabled).map(edge => edge.from));
    expect(paths[0]).toContain(route.isolatorId);
    expect(paths[1]).not.toContain(route.isolatorId);
    expect(paths[1]).not.toContain(route.tieId);
    expect(paths[2]).toContain(route.tieId);
    expect(paths[2]).not.toContain(route.isolatorId);
    expect(d).toEqual(originalDesign);
    expect(transferred).toEqual(final);
  });
});

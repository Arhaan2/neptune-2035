import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/phase-0/scenarios.json';
import {
  buildDesign,
  DEFAULT_CONFIG,
  loopGeometry,
  resolveAsset,
  replaceEquipment,
} from '../src/twin/assets/design';
import {
  advance,
  initialize,
  summarize,
  validateEvent,
} from '../src/twin/engine/simulation';
import {
  constraints,
  engineeringReport,
  resultsCSV,
  sizingAssessment,
} from '../src/twin/analysis/reports';
import { HARDWARE } from '../src/twin/catalog/reference';
import { solveHydraulics } from '../src/twin/solvers/hydraulic';
import {
  assessNetwork,
  NETWORK_ASSUMPTIONS,
} from '../src/twin/solvers/network';
import type { Design, DesignConfig, OperationEvent } from '../src/twin/types';

const small = (patch: Partial<DesignConfig> = {}) =>
  buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1280, ...patch });
function observe(design: Design, events: OperationEvent[]) {
  let state = advance(design, initialize(design), 0, events);
  const trace = [summarize(design, state)];
  while (state.timeS < 15) {
    state = advance(design, state, 1);
    trace.push(summarize(design, state));
  }
  return { state, trace };
}
function feederEvents(design: Design): OperationEvent[] {
  return [
    {
      id: 'feeder-loss',
      timeS: 5,
      kind: 'trip',
      assetId: design.modules[0].powerDomainId,
    },
    {
      id: 'feeder-recovery',
      timeS: 10,
      kind: 'restore',
      assetId: design.modules[0].powerDomainId,
    },
  ];
}

describe('PH1-REG-01 deferred Phase 0 findings remain explicit', () => {
  it('PH0-003 retains the 4000-node shared port boundary and reports the 4001-node design shortfall', () => {
    expect(HARDWARE.acceleratorsPerNode).toBe(8);
    expect(NETWORK_ASSUMPTIONS.clusterBitSPerNode).toBe(100e6);
    for (const id of ['network-at', 'network-above']) {
      const fixture = fixtures.scenarios.find((item) => item.id === id)!;
      const design = buildDesign(fixture.config as DesignConfig);
      const core = resolveAsset(design, 'shore/cluster-core')!;
      expect(core.ratings.capacityBitS).toBe(400e9);
      expect(
        core.ports.find((port) => port.id === 'cluster-out')?.capacity,
      ).toBe(400e9);
      const initial = initialize(design),
        stepped = advance(design, initial, 1);
      for (const state of [initial, stepped]) {
        const network = assessNetwork(
          design,
          state.modules,
          state.failedAssetIds,
        );
        expect(network.energizedNodes).toBe(fixture.expected.nodes);
        expect(network.clusterDemandBitS).toBe(
          fixture.expected.clusterDemandGbitS * 1e9,
        );
        expect(network.status).toBe(fixture.expected.networkStatus);
        expect(summarize(design, state).availableAccelerators).toBe(
          id === 'network-at' ? 32000 : 0,
        );
        if (id === 'network-above')
          expect(network.bottlenecks.map((item) => item.resourceId)).toEqual([
            'port:shore/cluster-core:cluster-out',
          ]);
      }
    }
  });
  it('PH0-004 reference equivalence remains while Phase 2 closes installed pump ownership', () => {
    const design = small(),
      module = design.modules[0],
      pump = resolveAsset(design, `${module.id}/pump-duty`)!;
    expect(pump.ratings.shutoffPa).toBe(250000);
    expect(pump.ratings.freeFlowM3S).toBe(0.1);
    expect(pump.ratings.efficiency).toBe(0.72);
    const base = {
      lengthM: loopGeometry(design, module).technicalLengthM,
      diameterM: 0.18,
      roughnessM: 0.000045,
      densityKgM3: 997,
      dynamicViscosityPaS: 0.000855,
      fittingsK: 12,
      equipmentDropPaAtReference: 80000,
      referenceFlowM3S: 0.05,
      pumpCount: 1,
      pumpSpeed: 1,
    };
    const explicit = solveHydraulics({
      ...base,
      shutoffPa: pump.ratings.shutoffPa,
      freeFlowM3S: pump.ratings.freeFlowM3S,
      efficiency: pump.ratings.efficiency,
    });
    expect(solveHydraulics(base)).toEqual(explicit);
    expect(initialize(design).modules[0].technicalFlowM3S).toBe(
      explicit.flowM3S,
    );
    expect('shutoffPa' in DEFAULT_CONFIG).toBe(false);
    // Phase 2 closes this ownership gap; unrelated Phase 1 deferrals remain below.
    const replaced = replaceEquipment(design, pump.id, 'pump-efficient');
    const before = initialize(design).modules[0];
    const after = initialize(replaced).modules[0];
    expect(after.technicalFlowM3S).toBe(before.technicalFlowM3S);
    expect(after.pressurePa).toBe(before.pressurePa);
    // Hydraulic work / efficiency: only the duty motor changes from .72 to .84.
    const technicalWorkW = before.pressurePa * before.technicalFlowM3S;
    expect(after.pumpPowerW).toBeCloseTo(
      before.pumpPowerW - technicalWorkW / 0.72 + technicalWorkW / 0.84,
      6,
    );
  });
  it('PH0-005 retains the genuine five-second outage and terminal-only passing assessment', () => {
    const design = small({ batteryWhPerModule: 0 }),
      events = feederEvents(design);
    const control = observe(design, []),
      fault = observe(design, events);
    expect(
      control.trace.every((point) => point.availableAccelerators === 1280),
    ).toBe(true);
    expect(
      fault.trace
        .filter((point) => point.timeS >= 5 && point.timeS < 10)
        .map((point) => point.availableAccelerators),
    ).toEqual([0, 0, 0, 0, 0]);
    expect(summarize(design, fault.state).availableAccelerators).toBe(1280);
    expect(fault.state.failedAssetIds).toEqual([]);
    expect(
      constraints(design, fault.state).find((item) => item.id === 'EL-02')
        ?.status,
    ).toBe('satisfied');
    expect(sizingAssessment(design, fault.state).passes).toBe(true);
    expect(fault.state.events.map((event) => event.id)).toEqual([
      'feeder-loss',
      'feeder-recovery',
    ]);
    expect(engineeringReport(design, fault.state)).toContain('feeder-loss');
    expect(
      fault.state.log.some(
        (entry) => entry.assetId === design.modules[0].powerDomainId,
      ),
    ).toBe(true);
    expect(summarize(design, fault.state)).not.toHaveProperty(
      'minimumAvailableAccelerators',
    );
    expect(resultsCSV(design, fault.state)).not.toMatch(
      /availableAccelerators|interruption/,
    );
  });
  it('PH0-006 preserves radial II/III fault behavior without inventing an automatic transfer benefit', () => {
    for (const generation of [2, 3] as const) {
      const design = small({
        generation,
        requestedAccelerators: 5128,
        batteryWhPerModule: 0,
      });
      const run = observe(design, feederEvents(design));
      expect(run.trace[0].availableAccelerators).toBe(5128);
      expect(
        run.trace
          .filter((point) => point.timeS >= 5 && point.timeS < 10)
          .map((point) => point.availableAccelerators),
      ).toEqual([8, 8, 8, 8, 8]);
      expect(run.trace.at(-1)?.availableAccelerators).toBe(5128);
      const ties = design.connections.filter(
        (connection) => connection.medium === 'power' && !connection.enabled,
      );
      expect(ties).toHaveLength(generation === 3 ? 1 : 0);
      if (generation === 3) {
        expect(ties[0].capacity).toBe(2.2e6);
        expect(() =>
          validateEvent(design, {
            id: 'transfer',
            timeS: 6,
            kind: 'close-tie',
            assetId: design.modules[0].powerDomainId,
          } as unknown as OperationEvent),
        ).toThrow(/Unsupported event kind/);
      }
    }
  });
});

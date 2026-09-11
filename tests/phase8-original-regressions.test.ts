import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { advance, initialize } from '../src/twin/engine/simulation';
import { normalizeProject, parseProject, projectFile, restoreProject, serializeProject } from '../src/twin/persistence/project';
import { CONTRACT } from '../src/twin/persistence/limits';
import { SimulationError } from '../src/twin/safety';
import { solveHydraulics } from '../src/twin/solvers/hydraulic';
import type { OperationEvent } from '../src/twin/types';

// Exact Phase 0 physical inputs; the historical runner overlays no production files.
// These assertions express corrected behavior, never an expected failure on current code.
describe('P8-ORIG original 23de38a behavioral defects', () => {
  it.each(['shutoffPa', 'freeFlowM3S'] as const)('PH0-001 rejects the original in-memory %s Infinity before solving', field => {
    const input = { lengthM: 58, diameterM: 0.18, roughnessM: 0.000045, densityKgM3: 997, dynamicViscosityPaS: 0.000855, fittingsK: 12, equipmentDropPaAtReference: 80000, referenceFlowM3S: 0.05, pumpCount: 1, pumpSpeed: 1, shutoffPa: 250000, freeFlowM3S: 0.1, efficiency: 0.72 };
    const control = solveHydraulics(input);
    expect(Object.values(control).every(Number.isFinite)).toBe(true);
    expect(Math.abs(control.headResidualPa)).toBeLessThan(0.01);
    try {
      solveHydraulics({ ...input, [field]: Infinity });
      throw Error('Nonfinite original pump rating was admitted.');
    } catch (error) {
      expect(error).toBeInstanceOf(SimulationError);
      expect((error as SimulationError).diagnostic).toMatchObject({ kind: 'invalid-input', code: 'INVALID_NUMBER', field });
    }
  });

  it('PH0-002 round-trips the original 1001 simultaneous applied commands and continues exactly', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, workload: 0 });
    for (const count of [999, 1000, 1001]) {
      const events: OperationEvent[] = Array.from({ length: count }, (_, i) => ({ id: `work-${String(i).padStart(5, '0')}`, timeS: 0, kind: 'workload', assetId: 'shore/grid', value: i % 2 ? 0.1 : 0 }));
      const state = advance(design, initialize(design), 0, events);
      expect(state.appliedEventIds).toHaveLength(count);
      const original = projectFile(design, state);
      const imported = parseProject(serializeProject(original));
      expect(normalizeProject(imported)).toEqual(normalizeProject(original));
      const restored = restoreProject(imported);
      expect(normalizeProject(projectFile(restored.design, advance(restored.design, restored.state, 1)))).toEqual(normalizeProject(projectFile(design, advance(design, state, 1))));
    }
  });

  it('PH0-002 round-trips the original supported 86401-second and 30-day scheduled boundaries', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, workload: 0 });
    for (const timeS of [86399, 86400, 86401, CONTRACT.horizonS]) {
      const state = advance(design, initialize(design), 0, [{ id: 'scheduled', kind: 'workload', assetId: 'shore/grid', timeS, value: 0 }]);
      const original = projectFile(design, state);
      expect(normalizeProject(parseProject(serializeProject(original)))).toEqual(normalizeProject(original));
    }
    expect(() => advance(design, initialize(design), 0, [{ id: 'outside', kind: 'workload', assetId: 'shore/grid', timeS: CONTRACT.horizonS + 1, value: 0 }])).toThrow(/2592000|30.day|horizon|timeS/);
  });
});

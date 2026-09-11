import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { constraints } from '../src/twin/analysis/reports';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import type { OperationEvent } from '../src/twin/types';

// This reproducer uses only APIs present in accepted Phase 3 (91a52ee).
// It remains useful after Phase 4: a healthy final state cannot erase observed interruption.
describe('Phase 4 accepted-baseline endpoint-only behavioral gap', () => {
  it('finishes healthy despite ten seconds of complete required-connectivity interruption', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
    const events: OperationEvent[] = [
      { id: 'baseline-gap-trip', timeS: 5, assetId: 'shore/cluster-core', kind: 'trip' },
      { id: 'baseline-gap-restore', timeS: 15, assetId: 'shore/cluster-core', kind: 'restore' },
    ];
    let state = advance(design, initialize(design), 0, events);
    let observedShortfallAcceleratorS = 0, observedInterruptionS = 0;
    const samples: { timeS: number; serviceable: number }[] = [];
    for (let second = 0; second < 20; second++) {
      // Independent left-held integration at the existing one-second committed grid.
      const serviceable = summarize(design, state).availableAccelerators;
      samples.push({ timeS: state.timeS, serviceable });
      observedShortfallAcceleratorS += Math.max(0, 8 - serviceable);
      observedInterruptionS += Number(serviceable < 8);
      state = advance(design, state, 1);
    }
    expect(samples.filter(sample => sample.serviceable === 0).map(sample => sample.timeS)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(observedShortfallAcceleratorS).toBe(80);
    expect(observedInterruptionS).toBe(10);
    expect(summarize(design, state)).toMatchObject({ timeS: 20, availableAccelerators: 8, energizedAccelerators: 8, curtailedAccelerators: 0 });
    const currentChecks = constraints(design, state);
    for (const id of ['EL-02', 'TH-01', 'NW-01', 'NW-02']) expect(currentChecks.find(check => check.id === id)?.status, id).toBe('satisfied');
    const sparseSnapshots = [summarize(design, initialize(design)), summarize(design, advance(design, initialize(design), 20, events))];
    expect(sparseSnapshots.every(snapshot => snapshot.availableAccelerators === 8)).toBe(true);
    // Log raw observations; no missing Phase 4 API is required to reproduce this gap.
    console.info(JSON.stringify({ baseline: '91a52eeff5a01fae3ef21cba7a8293b59e5c40fb', observedShortfallAcceleratorS, observedInterruptionS, final: summarize(design, state), sparseSnapshotCapacity: sparseSnapshots.map(sample => sample.availableAccelerators) }));
  });
});

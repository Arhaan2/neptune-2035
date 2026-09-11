import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, reconfigureDesign, withNetworkPreset } from '../src/twin/assets/design';
import { summarize } from '../src/twin/engine/simulation';
import { disturbanceFootprints } from '../src/twin/experiment/definition';
import { referenceExperiment, signatureDemonstration } from '../src/twin/experiment/demonstrations';
import { runExperiment } from '../src/twin/experiment/runner';
import { wholeExperimentReport } from '../src/twin/experiment/report';
import type { ExperimentDefinition } from '../src/twin/experiment/types';
import type { Design } from '../src/twin/types';

function measured(design: Design, definition: ExperimentDefinition) {
  const before = process.memoryUsage(), started = performance.now();
  const state = runExperiment(design, definition);
  const wallMs = performance.now() - started, after = process.memoryUsage();
  console.info(JSON.stringify({ evidence: 'phase4-supported-envelope', node: process.version, platform: process.platform, architecture: process.arch, requestedAccelerators: design.config.requestedAccelerators, moduleCount: design.modules.length, simulatedDurationS: definition.durationS, evaluationElapsedS: state.experiment!.metrics.elapsedS, wallMs, memoryObservation: { kind: 'process snapshots, not isolated peak allocation', rssBefore: before.rss, rssAfter: after.rss, heapUsedBefore: before.heapUsed, heapUsedAfter: after.heapUsed, processMaxRss: process.resourceUsage().maxRSS }, status: state.experiment!.status }));
  return state;
}

describe('PH4 real-engine signature and bounded execution envelope', () => {
  it('shows virtually identical final temperatures while exposing materially different complete-run interruptions', () => {
    const fixtures = signatureDemonstration();
    expect(fixtures.map(fixture => fixture.design.config.standbyPumps)).toEqual([0, 1]);
    for (const fixture of fixtures) {
      expect(fixture.design.config.requestedAccelerators).toBe(1280);
      expect(fixture.design.config.workload).toBe(1);
      expect(fixture.definition.durationS).toBe(1800);
      expect(fixture.definition.disturbances.map(event => [event.kind, event.timeS, event.assetId])).toEqual([['trip', 30, 'platform-001/module-01/pump-duty'], ['restore', 300, 'platform-001/module-01/pump-duty']]);
      expect(disturbanceFootprints(fixture.design, fixture.definition)[0]).toMatchObject({ installedAcceleratorsInScope: 1280, fractionOfInstalled: 1 });
    }
    const [unprotected, protectedRun] = fixtures.map(fixture => measured(fixture.design, fixture.definition));
    expect(unprotected.experiment!.status).toBe('completed');
    expect(protectedRun.experiment!.status).toBe('completed');
    expect(unprotected.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 79360, serviceViolationS: 124, firstServiceViolationS: 240 });
    expect(unprotected.experiment!.metrics.minServiceable).toMatchObject({ value: 640 });
    expect(protectedRun.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 0, serviceViolationS: 0, minServiceable: { value: 1280 } });
    const finals = [summarize(fixtures[0].design, unprotected), summarize(fixtures[1].design, protectedRun)];
    expect(finals.map(summary => summary.availableAccelerators)).toEqual([1280, 1280]);
    expect(Math.abs(finals[0].maxCoolantK - finals[1].maxCoolantK)).toBeLessThan(0.01);
    expect(Math.abs(unprotected.modules[0].airK - protectedRun.modules[0].airK)).toBeLessThan(0.1);
    expect(unprotected.experiment!.metrics.maxCoolant!.value).toBeCloseTo(320.48382684974, 6);
    expect(protectedRun.experiment!.metrics.maxCoolant!.value).toBeCloseTo(303.67182668317, 6);
    expect(unprotected.experiment!.metrics.traceTruncated).toBe(true);
    expect(unprotected.experiment!.metrics.elapsedS).toBe(1800);
    // Persisted metrics retain their violation-relative time contract; the report
    // must explicitly distinguish the earlier t30 fault from the t240 violation.
    const report = wholeExperimentReport(unprotected);
    expect(report.available).toBe(true);
    if (!report.available) throw Error('Expected whole-experiment recovery report.');
    expect(report.recovery).toMatchObject({ referenceEventId: 'signature-duty-trip', referenceEventTimeS: 30, violationOnsetTimeS: 240, onsetTimeS: 364, confirmationTimeS: 369, onsetFromEventS: 334, confirmationFromEventS: 339 });
  });
  it('executes a real 100000-accelerator reference outage within the existing bounded runner', () => {
    const seed = withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 }), 'scalable-reference');
    const design = reconfigureDesign(seed, { requestedAccelerators: 100000, supplyW: 1e9 });
    const state = measured(design, referenceExperiment(design));
    expect(state.experiment!.status).toBe('completed');
    expect(state.timeS).toBe(20);
    expect(state.experiment!.metrics).toMatchObject({ elapsedS: 20, shortfallAcceleratorS: 1000000, serviceViolationS: 10, minServiceable: { value: 0 } });
    expect(summarize(design, state).availableAccelerators).toBe(100000);
  });
});

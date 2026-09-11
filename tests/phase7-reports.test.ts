import { expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, withNetworkPreset } from '../src/twin/assets/design';
import { engineeringReport } from '../src/twin/analysis/reports';
import { initialize } from '../src/twin/engine/simulation';

it('PH7 D09 engineering report header states the full qualifier even without experiment metadata', () => {
  const legacy = buildDesign({ ...DEFAULT_CONFIG, generation: 1, requestedAccelerators: 8 });
  const installed = withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, generation: 2, requestedAccelerators: 8 }), 'scalable-reference');
  for (const design of [legacy, installed]) {
    const state = initialize(design);
    expect(state.experiment).toBeUndefined();
    const header = engineeringReport(design, state).split('## Inputs and provenance')[0];
    expect(header).toContain('Simulated, design-stage prototype; physical validation pending.');
  }
});

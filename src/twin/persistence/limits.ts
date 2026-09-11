/** One admission contract. Inclusive maxima; execution budgets are not project validity. */
export const CONTRACT = Object.freeze({
  projectSchema: 3 as const,
  stateSchema: 3 as const,
  horizonS: 30 * 86400,
  maxEvents: 10_000,
  maxAdvanceS: 86400,
  maxProjectBytes: 64 * 1024 * 1024,
  maxDepth: 24,
  maxStructuralItems: 4_000_000,
  maxModules: 6250,
  maxDesignAssets: 50_005,
  maxConnections: 50_004,
  maxLogEntries: 1000,
  maxEventIdLength: 100,
  maxAssetIdLength: 180,
  maxStringLength: 4096,
  maxPendingStartupS: 8,
  maxChunkS: 10,
  maxChunkModuleSteps: 8000,
  maxJobModuleSteps: 2_000_000,
  maxJobWallMs: 120_000,
  progressIntervalMs: 250,
  eventValidationBatch: 128,
  maxSavedScenarios: 8,
});
export const INTEGRATION_STEPS = [1, 0.5, 0.25, 0.125] as const;
export type IntegrationStep = typeof INTEGRATION_STEPS[number];
export const MODEL_ID = 'neptune-reference-3';
export const ALGORITHM_ID = 'committed-boundary-1';
export const STORAGE_KEY = 'neptune-checkpoint-v3';

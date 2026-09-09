/** Serializable failures shared by numerical, persistence and worker boundaries. */
export type FailureKind = 'invalid-input' | 'unsupported-configuration' | 'numerical-failure' | 'resource-limit' | 'storage-failure';
export interface FailureDiagnostic {
  kind: FailureKind;
  code: string;
  message: string;
  field?: string;
  assetId?: string;
  unit?: string;
  details?: Record<string, string | number | boolean | null>;
}
export class SimulationError extends Error {
  readonly diagnostic: FailureDiagnostic;
  constructor(diagnostic: FailureDiagnostic) {
    super(diagnostic.message);
    this.name = 'SimulationError';
    this.diagnostic = { ...diagnostic, ...(diagnostic.details ? { details: Object.fromEntries(Object.entries(diagnostic.details).map(([key, value]) => [key, typeof value === 'number' && !Number.isFinite(value) ? String(value) : value])) } : {}) };
  }
}
export function failure(kind: FailureKind, code: string, message: string, context: Omit<FailureDiagnostic, 'kind' | 'code' | 'message'> = {}): never {
  throw new SimulationError({ kind, code, message, ...context });
}
export function diagnosticFor(error: unknown): FailureDiagnostic {
  return error instanceof SimulationError ? error.diagnostic : { kind: 'numerical-failure', code: 'UNEXPECTED_FAILURE', message: error instanceof Error ? error.message : 'Unexpected simulation failure; last validated state retained.' };
}
export function finiteNumber(value: unknown, field: string, options: { min?: number; max?: number; integer?: boolean; unit?: string } = {}): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (options.integer && !Number.isSafeInteger(value)) || value < (options.min ?? -Number.MAX_VALUE) || value > (options.max ?? Number.MAX_VALUE)) {
    failure('invalid-input', 'INVALID_NUMBER', `${field} must be a finite ${options.integer ? 'integer ' : ''}number within limits${options.min === undefined ? '' : ` >= ${options.min}`}${options.max === undefined ? '' : ` <= ${options.max}`}${options.unit ? ` ${options.unit}` : ''}.`, { field, unit: options.unit, details: { received: typeof value === 'number' ? String(value) : typeof value } });
  }
}
export function finiteOutputs<T extends object>(result: T, boundary: string): T {
  for (const [field, value] of Object.entries(result)) if (typeof value === 'number' && !Number.isFinite(value)) failure('numerical-failure', 'NONFINITE_OUTPUT', `${boundary} produced a nonfinite ${field}; no result committed.`, { field, details: { boundary, value: String(value) } });
  return result;
}

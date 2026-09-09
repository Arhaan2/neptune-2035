import { STORAGE_KEY } from './limits';
import { parseProject, serializeProject } from './project';
import type { CurrentProject, ProjectFile } from './types';
import { SimulationError, type FailureDiagnostic } from '../safety';

export interface CheckpointStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type StorageCommit =
  | { ok: true; timeS: number; bytes: number }
  | { ok: false; diagnostic: FailureDiagnostic };
const storageDiagnostic = (
  action: string,
  error: unknown,
): FailureDiagnostic => ({
  kind: 'storage-failure',
  code: 'CHECKPOINT_STORAGE',
  message: `${action} failed. ${error instanceof Error ? error.message : 'Browser storage is unavailable.'} Export a project file to preserve the current checkpoint.`,
});

/** A single synchronous replacement is atomic: acknowledgement follows the successful write. */
export function writeCheckpoint(
  project: CurrentProject,
  storage?: CheckpointStorage,
): StorageCommit {
  const text = serializeProject(project);
  try {
    (storage ?? localStorage).setItem(STORAGE_KEY, text);
    return {
      ok: true,
      timeS: project.timeS,
      bytes: new TextEncoder().encode(text).byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      diagnostic: storageDiagnostic('Checkpoint save', error),
    };
  }
}
export function readCheckpoint(storage?: CheckpointStorage): {
  project: ProjectFile | null;
  diagnostic?: FailureDiagnostic;
} {
  try {
    const text = (storage ?? localStorage).getItem(STORAGE_KEY);
    return { project: text === null ? null : parseProject(text) };
  } catch (error) {
    return {
      project: null,
      diagnostic:
        error instanceof SimulationError
          ? {
              ...error.diagnostic,
              message: `Recovery checkpoint rejected. ${error.diagnostic.message} Stored data was retained.`,
            }
          : storageDiagnostic('Checkpoint recovery', error),
    };
  }
}
export function discardCheckpoint(
  storage?: CheckpointStorage,
): FailureDiagnostic | null {
  try {
    (storage ?? localStorage).removeItem(STORAGE_KEY);
    return null;
  } catch (error) {
    return storageDiagnostic('Checkpoint removal', error);
  }
}

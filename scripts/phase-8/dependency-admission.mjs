/** One reviewed build-time addition; the caller must first verify the clean Phase 7 commit/tree. */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const VALIDATOR_NAME = 'gltf-validator';
const VALIDATOR_PATH = `node_modules/${VALIDATOR_NAME}`;
const VALIDATOR_PIN = '2.0.0-dev.3.10';
const VALIDATOR_ENTRY = Object.freeze({
  version: VALIDATOR_PIN,
  resolved: 'https://registry.npmjs.org/gltf-validator/-/gltf-validator-2.0.0-dev.3.10.tgz',
  integrity: 'sha512-odJ4k0tRkGXiDGn78yDBg+fBbAIvBnXxh3RwAta0emSxGtyagFE8B4xELB1oYe3S5RD8Ci3uZAsZaascH2LAEQ==',
  dev: true,
  license: 'Apache-2.0',
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function assessHistoricalDependencies({ legacyPackageJSON, currentPackageJSON, legacyLockJSON, currentLockJSON }) {
  const record = {
    policy: 'unchanged-or-exact-visual-v2-gltf-validator-addition',
    status: 'FAIL', mode: null,
    legacy: { packageSha256: hash(legacyPackageJSON), lockSha256: hash(legacyLockJSON) },
    current: { packageSha256: hash(currentPackageJSON), lockSha256: hash(currentLockJSON) },
    admissionLedger: [], unchangedRemainder: false,
    comparison: 'Deep-strict equality of every remaining package.json and package-lock.json field; no runtime-only filtering.',
  };
  try {
    const legacyPackage = JSON.parse(legacyPackageJSON), currentPackage = JSON.parse(currentPackageJSON);
    const legacyLock = JSON.parse(legacyLockJSON), currentLock = JSON.parse(currentLockJSON);
    if (isDeepStrictEqual(legacyPackage, currentPackage) && isDeepStrictEqual(legacyLock, currentLock)) {
      record.mode = 'unchanged';
    } else {
      if (Object.hasOwn(legacyPackage.devDependencies ?? {}, VALIDATOR_NAME)
        || Object.hasOwn(legacyLock.packages?.['']?.devDependencies ?? {}, VALIDATOR_NAME)
        || Object.hasOwn(legacyLock.packages ?? {}, VALIDATOR_PATH)) {
        throw Error('The admitted validator must be absent from the original package and lockfile.');
      }
      if (currentPackage.devDependencies?.[VALIDATOR_NAME] !== VALIDATOR_PIN
        || currentLock.packages?.['']?.devDependencies?.[VALIDATOR_NAME] !== VALIDATOR_PIN
        || !isDeepStrictEqual(currentLock.packages?.[VALIDATOR_PATH], VALIDATOR_ENTRY)) {
        throw Error('Only the exact pinned build-time gltf-validator root declarations and complete reviewed lock entry are admitted.');
      }
      delete currentPackage.devDependencies[VALIDATOR_NAME];
      delete currentLock.packages[''].devDependencies[VALIDATOR_NAME];
      delete currentLock.packages[VALIDATOR_PATH];
      if (!isDeepStrictEqual(legacyPackage, currentPackage) || !isDeepStrictEqual(legacyLock, currentLock)) {
        throw Error('Historical/current package or lockfile differs beyond the three admitted validator additions.');
      }
      record.mode = 'visual-v2-validator-only';
      record.admissionLedger = [
        { file: 'package.json', path: ['devDependencies', VALIDATOR_NAME], old: null, new: VALIDATOR_PIN },
        { file: 'package-lock.json', path: ['packages', '', 'devDependencies', VALIDATOR_NAME], old: null, new: VALIDATOR_PIN },
        { file: 'package-lock.json', path: ['packages', VALIDATOR_PATH], old: null, new: { ...VALIDATOR_ENTRY } },
      ];
    }
    record.unchangedRemainder = true;
    record.status = 'PASS';
  } catch (problem) {
    record.error = problem instanceof Error ? problem.message : String(problem);
  }
  return record;
}

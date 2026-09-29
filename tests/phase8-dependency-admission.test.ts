import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

type Package = { name: string; dependencies: Record<string, string>; devDependencies: Record<string, string>; scripts: Record<string, string> };
type Entry = { version?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; [field: string]: unknown };
type Lock = { name: string; lockfileVersion: number; packages: Record<string, Entry> };
type Documents = { legacyPackage: Package; currentPackage: Package; legacyLock: Lock; currentLock: Lock };
type Inputs = { legacyPackageJSON: string; currentPackageJSON: string; legacyLockJSON: string; currentLockJSON: string };
type Assessment = {
  status: 'PASS' | 'FAIL'; mode: string | null; error?: string; unchangedRemainder: boolean;
  legacy: { packageSha256: string; lockSha256: string }; current: { packageSha256: string; lockSha256: string };
  admissionLedger: { file: string; path: string[]; old: null; new: unknown }[];
};
let assess: (inputs: Inputs) => Assessment;
const pin = '2.0.0-dev.3.10', validatorPath = 'node_modules/gltf-validator';
const validatorEntry = {
  version: pin, resolved: 'https://registry.npmjs.org/gltf-validator/-/gltf-validator-2.0.0-dev.3.10.tgz',
  integrity: 'sha512-odJ4k0tRkGXiDGn78yDBg+fBbAIvBnXxh3RwAta0emSxGtyagFE8B4xELB1oYe3S5RD8Ci3uZAsZaascH2LAEQ==',
  dev: true, license: 'Apache-2.0',
};
function documents(addValidator = true): Documents {
  const legacyPackage: Package = { name: 'historical-fixture', dependencies: { runtime: '1.0.0' }, devDependencies: { compiler: '2.0.0' }, scripts: { build: 'compiler build' } };
  const legacyLock: Lock = { name: legacyPackage.name, lockfileVersion: 3, packages: {
    '': { name: legacyPackage.name, dependencies: { ...legacyPackage.dependencies }, devDependencies: { ...legacyPackage.devDependencies } },
    'node_modules/runtime': { version: '1.0.0', integrity: 'runtime-integrity', dependencies: { nested: '3.0.0' } },
    'node_modules/compiler': { version: '2.0.0', integrity: 'compiler-integrity', dev: true },
    'node_modules/runtime/node_modules/nested': { version: '3.0.0', integrity: 'nested-integrity' },
  } };
  const currentPackage = structuredClone(legacyPackage), currentLock = structuredClone(legacyLock);
  if (addValidator) {
    currentPackage.devDependencies['gltf-validator'] = pin;
    currentLock.packages[''].devDependencies!['gltf-validator'] = pin;
    currentLock.packages[validatorPath] = { ...validatorEntry };
  }
  return { legacyPackage, currentPackage, legacyLock, currentLock };
}
const encode = (value: Documents): Inputs => ({
  legacyPackageJSON: JSON.stringify(value.legacyPackage), currentPackageJSON: JSON.stringify(value.currentPackage),
  legacyLockJSON: JSON.stringify(value.legacyLock), currentLockJSON: JSON.stringify(value.currentLock),
});
beforeAll(async () => {
  const moduleURL = new URL('../scripts/phase-8/dependency-admission.mjs', import.meta.url).href;
  assess = (await import(/* @vite-ignore */ moduleURL)).assessHistoricalDependencies;
});

describe('historical dependency admission stays narrower than a dependency migration', () => {
  it('accepts unchanged complete package and lock content without claiming an admission', () => {
    const result = assess(encode(documents(false)));
    expect(result).toMatchObject({ status: 'PASS', mode: 'unchanged', unchangedRemainder: true, admissionLedger: [] });
    expect(result.current).toEqual(result.legacy);
  });

  it('admits only three exact additions, records the complete entry and hashes the untouched input bytes', () => {
    const input = encode(documents()), before = structuredClone(input), result = assess(input);
    expect(result).toMatchObject({ status: 'PASS', mode: 'visual-v2-validator-only', unchangedRemainder: true });
    expect(result.admissionLedger).toEqual([
      { file: 'package.json', path: ['devDependencies', 'gltf-validator'], old: null, new: pin },
      { file: 'package-lock.json', path: ['packages', '', 'devDependencies', 'gltf-validator'], old: null, new: pin },
      { file: 'package-lock.json', path: ['packages', validatorPath], old: null, new: validatorEntry },
    ]);
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    expect(result.legacy).toEqual({ packageSha256: hash(input.legacyPackageJSON), lockSha256: hash(input.legacyLockJSON) });
    expect(result.current).toEqual({ packageSha256: hash(input.currentPackageJSON), lockSha256: hash(input.currentLockJSON) });
    expect(input).toEqual(before);
  });

  it.each<[string, (value: Documents) => void]>([
    ['existing dependency version', value => { value.currentLock.packages['node_modules/runtime'].version = '1.0.1'; }],
    ['existing dependency integrity', value => { value.currentLock.packages['node_modules/compiler'].integrity = 'replacement'; }],
    ['root runtime declaration', value => { value.currentPackage.dependencies.runtime = '1.0.1'; value.currentLock.packages[''].dependencies!.runtime = '1.0.1'; }],
    ['unrelated root dev declaration', value => { value.currentPackage.devDependencies.compiler = '2.0.1'; value.currentLock.packages[''].devDependencies!.compiler = '2.0.1'; }],
    ['unrelated dev addition', value => { value.currentPackage.devDependencies.other = '1.0.0'; value.currentLock.packages[''].devDependencies!.other = '1.0.0'; value.currentLock.packages['node_modules/other'] = { version: '1.0.0', dev: true }; }],
    ['nested transitive package', value => { value.currentLock.packages['node_modules/runtime/node_modules/nested'].version = '3.0.1'; }],
    ['transitive dependency edge', value => { value.currentLock.packages['node_modules/runtime'].dependencies!.nested = '3.0.1'; }],
    ['nondependency package script', value => { value.currentPackage.scripts.build = 'different build'; }],
    ['top-level lock metadata', value => { value.currentLock.lockfileVersion = 2; }],
    ['package-only validator absence', value => { delete value.currentPackage.devDependencies['gltf-validator']; }],
    ['lock-root validator absence', value => { delete value.currentLock.packages[''].devDependencies!['gltf-validator']; }],
    ['leaf entry absence', value => { delete value.currentLock.packages[validatorPath]; }],
    ['nonexact package pin', value => { value.currentPackage.devDependencies['gltf-validator'] = `^${pin}`; }],
    ['nonexact lock-root pin', value => { value.currentLock.packages[''].devDependencies!['gltf-validator'] = `^${pin}`; }],
    ['validator previously in package', value => { value.legacyPackage.devDependencies['gltf-validator'] = pin; }],
    ['validator previously in lock root', value => { value.legacyLock.packages[''].devDependencies!['gltf-validator'] = pin; }],
    ['validator previously in lock entry', value => { value.legacyLock.packages[validatorPath] = { ...validatorEntry }; }],
  ])('rejects %s even with the permitted validator entry present', (_label, change) => {
    const value = documents(); change(value);
    expect(assess(encode(value))).toMatchObject({ status: 'FAIL', unchangedRemainder: false, admissionLedger: [] });
  });

  it.each<[string, unknown]>([
    ['version', '2.0.0-dev.3.9'], ['resolved', 'https://example.invalid/validator.tgz'], ['integrity', 'replacement'],
    ['dev', false], ['license', 'MIT'], ['dependencies', { extra: '1.0.0' }], ['hasInstallScript', true],
  ])('rejects a changed or added validator entry field: %s', (field, replacement) => {
    const value = documents(); value.currentLock.packages[validatorPath][field] = replacement;
    expect(assess(encode(value)).status).toBe('FAIL');
    delete value.currentLock.packages[validatorPath][field];
    if (field in validatorEntry) expect(assess(encode(value)).status).toBe('FAIL');
  });

  it('does not let an unchanged lock hide a changed package, and fails malformed JSON closed', () => {
    const value = documents(false); value.currentPackage.dependencies.runtime = '1.0.1';
    expect(assess(encode(value)).status).toBe('FAIL');
    expect(assess({ ...encode(documents()), currentLockJSON: '{' })).toMatchObject({ status: 'FAIL', unchangedRemainder: false, admissionLedger: [] });
  });
});

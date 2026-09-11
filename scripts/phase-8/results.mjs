/** Shared evidence records. Thresholds were frozen before Phase 8 judged runs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const argument = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
export const tolerances = Object.freeze({
  componentResidualW: 1e-5, normalizedResidual: 1e-9,
  hydraulicFlowM3S: 1e-10, hydraulicPressurePa: 0.01,
  exchangerBenchmarkW: 1e-7, exchangerNearEqualW: 1e-4, exchangerStreamsW: 1e-6,
  independentAirK: 1e-7, batteryWh: 1e-8,
  coupledTemperatureK: 0.001, coupledEnergyWh: 0.001,
  integratedMetric: 1e-8,
});
export async function sourceIdentity() {
  return { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
    lockSha256: sha256(await fs.readFile(path.join(root, 'package-lock.json'))), node: process.version,
    trackedClean: !git('status', '--porcelain', '--untracked-files=no') };
}
export function resultSet() {
  const checks = [];
  return {
    checks,
    numeric(id, actual, expected, absoluteTolerance, unit, context = {}) {
      const error = actual - expected;
      const finite = [actual, expected, absoluteTolerance].every(Number.isFinite) && absoluteTolerance >= 0;
      checks.push({ id, unit, actual, expected, error, absoluteError: Math.abs(error),
        relativeError: expected === 0 ? null : Math.abs(error / expected), absoluteTolerance,
        relativeTolerance: 0, nearZeroTreatment: 'absolute tolerance; relative error unavailable for zero reference',
        ...context, outcome: finite && Math.abs(error) <= absoluteTolerance ? 'PASS' : 'FAIL' });
    },
    exact(id, actual, expected, context = {}) {
      checks.push({ id, actual, expected, ...context,
        outcome: JSON.stringify(actual) === JSON.stringify(expected) ? 'PASS' : 'FAIL' });
    },
    residuals(id, components, context = {}) {
      for (const component of components) {
        const denominatorW = Math.max(1, component.denominatorW);
        this.numeric(`${id}/${component.id}/absolute`, component.residualW, 0, tolerances.componentResidualW, 'W', { denominatorW });
        this.numeric(`${id}/${component.id}/normalized`, component.residualW / denominatorW, 0, tolerances.normalizedResidual, '1', { denominatorW });
      }
      return { id, componentCount: components.length,
        signedTotalW: components.reduce((sum, row) => sum + row.residualW, 0),
        sumAbsoluteW: components.reduce((sum, row) => sum + Math.abs(row.residualW), 0),
        maximumAbsoluteW: Math.max(0, ...components.map(row => Math.abs(row.residualW))), ...context };
    },
  };
}
export async function writeResults(out, kind, startedIdentity, set, extra = {}, error = null) {
  const finalIdentity = await sourceIdentity();
  const unchanged = startedIdentity.commit === finalIdentity.commit && startedIdentity.tree === finalIdentity.tree
    && startedIdentity.trackedClean && finalIdentity.trackedClean;
  const status = !error && unchanged && set.checks.length > 0 && set.checks.every(check => check.outcome === 'PASS') ? 'PASS' : 'FAIL';
  const report = { kind, schemaVersion: 1, sourceIdentity: startedIdentity, finalIdentity, unchanged,
    qualification: 'Simulated, design-stage prototype; physical validation pending.',
    evidenceBasis: 'numerical/software verification; generated simulation evidence, not measured equipment data',
    tolerances, ...extra, checks: set.checks, error, status };
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, `${kind}.json`), JSON.stringify(report, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value, 2) + '\n');
  const failed = set.checks.filter(check => check.outcome !== 'PASS');
  const lines = [`# ${kind}`, '', `Outcome: **${status}**; ${set.checks.length - failed.length}/${set.checks.length} checks passed.`, '',
    `Source: \`${startedIdentity.commit}\`; tree: \`${startedIdentity.tree}\`.`, '',
    report.qualification, '', 'Accounting precision is not physical accuracy. Absolute thresholds and units are embedded with every numerical check.',
    ...(error ? ['', `Execution error: ${error}`] : []),
    ...(failed.length ? ['', 'Failed checks:', '', ...failed.map(check => `- ${check.id}: ${JSON.stringify(check)}`)] : [])];
  await fs.writeFile(path.join(out, `${kind}.md`), lines.join('\n') + '\n');
  console.log(`${kind}: ${status}; ${set.checks.length} checks; ${failed.length} failed.`);
  if (status !== 'PASS') process.exitCode = 1;
  return report;
}

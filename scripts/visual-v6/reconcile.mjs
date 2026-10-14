/** Reconcile discovered Playwright test identities with one complete set of reports. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const arg = (k) =>
  process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3);
const discovery = arg('discovery'),
  reports = arg('reports'),
  out = arg('out');
assert(
  discovery && reports && out,
  'Pass --discovery=JSON --reports=DIR --out=NEW_JSON.',
);
function collect(report) {
  const result = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) {
        const file = (spec.file ?? suite.file)
          .replaceAll('\\', '/')
          .split('tests/browser/')
          .at(-1);
        result.push({
          key: JSON.stringify([test.projectName, file, spec.title]),
          project: test.projectName,
          file,
          title: spec.title,
          expectedStatus: test.expectedStatus,
          status: test.status,
          results: (test.results ?? []).map((x) => ({
            status: x.status,
            retry: x.retry,
            duration: x.duration,
          })),
        });
      }
    for (const sub of suite.suites ?? []) visit(sub);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return result;
}
async function files(dir) {
  const found = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) found.push(...(await files(p)));
    else if (e.name === 'browser.json') found.push(p);
  }
  return found;
}
const expected = collect(JSON.parse(await fs.readFile(discovery, 'utf8'))),
  observed = [];
for (const file of await files(reports)) {
  const report = JSON.parse(await fs.readFile(file, 'utf8'));
  observed.push(
    ...collect(report).map((test) => ({
      ...test,
      report: path.relative(reports, file),
    })),
  );
}
const counts = new Map();
for (const item of observed)
  counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
const exclusions = observed.filter((x) =>
  x.results.some((r) => r.status === 'skipped'),
);
const errors = [];
for (const item of expected)
  if (counts.get(item.key) !== 1)
    errors.push({
      kind: 'missing-or-duplicate',
      key: item.key,
      count: counts.get(item.key) ?? 0,
    });
for (const item of observed) {
  if (!expected.some((x) => x.key === item.key))
    errors.push({ kind: 'undiscovered', key: item.key });
  if (item.results.length !== 1 || item.results[0].retry !== 0)
    errors.push({
      kind: 'retries-or-missing-execution',
      key: item.key,
      results: item.results,
    });
  if (item.results[0]?.status === 'skipped') {
    if (
      !['chromium', 'webkit'].includes(item.project) ||
      item.title !== 'public prototype large-campus functional Step 10s'
    )
      errors.push({ kind: 'unauthorized-exclusion', key: item.key });
  } else if (item.results[0]?.status !== 'passed' || item.status !== 'expected')
    errors.push({ kind: 'failed', ...item });
}
if (exclusions.length !== 2)
  errors.push({ kind: 'exclusion-set-changed', exclusions });
const receipt = {
  schemaVersion: 1,
  at: new Date().toISOString(),
  status: errors.length ? 'FAIL' : 'PASS',
  discovered: expected.length,
  observed: observed.length,
  passed: observed.filter((x) => x.results[0]?.status === 'passed').length,
  exclusions,
  errors,
  tests: observed,
};
await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    status: receipt.status,
    discovered: receipt.discovered,
    observed: receipt.observed,
    passed: receipt.passed,
    excluded: exclusions.length,
    errors,
  }),
);
if (errors.length) process.exitCode = 1;

/** Finite hosted Firefox observations. Every execution has its own raw files. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
const root = process.cwd(), out = path.resolve('artifacts/campus-batch');
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out, { recursive: false });
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const stability = process.argv.includes('--stability');
const count = stability ? 20 : 10, results = [];
const plan = { sourceSha, mode: stability ? 'stability' : 'diagnostic', count, completionBudgetMs: stability ? 20000 : 40000, acknowledgementBudgetMs: 3000, retries: 0, stop: stability ? 'all twenty executions; any failure rejects the batch' : 'first failed execution or measured completion exceeding original 12-second assertion budget', paths: ['fresh large-campus Step 10s', 'context cameras, keyboard interior'], platform: process.platform, arch: process.arch, node: process.version };
await fs.writeFile(path.join(out, 'plan.json'), JSON.stringify(plan, null, 2));
for (let n=0; n<count; n++) {
  const dir = path.join(out, String(n+1).padStart(2, '0')); await fs.mkdir(dir);
  const run = spawnSync('npx', ['playwright', 'test', 'tests/browser/twin.spec.ts', '--project=firefox', '--retries=0', '--grep', plan.paths[n%2], `--output=${dir}/test-results`], { env: { ...process.env, NEPTUNE_CAMPUS_OBSERVE: stability ? '0' : '1', NEPTUNE_CAMPUS_DIAGNOSTICS: '1', NEPTUNE_BROWSER_REPORT: `${dir}/browser-results.json` }, encoding: 'utf8', timeout: 180000, maxBuffer: 20e6 });
  await fs.writeFile(path.join(dir, 'console.log'), (run.stdout ?? '') + (run.stderr ?? ''));
  const latencies = [];
  for (const name of await fs.readdir(dir, { recursive: true })) {
    if (!name.endsWith('.json') || name === 'browser-results.json') continue;
    try { const value = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')); if ('originalAssertionBudgetMs' in value) latencies.push(value); } catch {}
  }
  // Playwright JSON bodies can be inline base64 rather than separate attachments.
  try {
    const report = JSON.parse(await fs.readFile(`${dir}/browser-results.json`, 'utf8'));
    const walk = suites => { for (const s of suites) { for (const spec of s.specs ?? []) for (const t of spec.tests) for (const r of t.results) for (const a of r.attachments ?? []) if (a.name === 'campus-latency' && a.body) latencies.push(JSON.parse(Buffer.from(a.body,'base64').toString())); walk(s.suites ?? []); } }; walk(report.suites);
  } catch {}
  results.push({ execution: n+1, path: plan.paths[n%2], exitCode: run.status, error: run.error?.message, latencies });
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.at(-1)));
  if (!stability && (run.status !== 0 || latencies.some(x => x.elapsedMs > 12000))) break;
}

if (stability && (results.length !== 20 || results.some(r => r.exitCode !== 0 || r.latencies.length !== 1 || r.latencies[0].elapsedMs > 20000 || r.latencies[0].acknowledgedMs > 3000 || r.latencies[0].time !== '10' || !r.latencies[0].stepEnabled))) process.exitCode = 1;

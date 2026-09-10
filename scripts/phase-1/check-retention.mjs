/** Deliberate failed harness case. Never an acceptance pass; transient test is removed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { retainBrowser } from './retain-browser.mjs';
const testPath='tests/browser/retention-harness.spec.ts';
const out=path.resolve('artifacts/retention-harness');
await fs.writeFile(testPath, `import { test, expect } from '@playwright/test';\ntest('intentional retention harness failure', async ({page}, info) => { await page.setContent('<h1>Diagnostic retention harness</h1>'); await info.attach('worker-diagnostic-fixture', { body: 'bounded harness attachment', contentType: 'text/plain' }); expect(false).toBe(true); });\n`, { flag: 'wx' });
let run;
try {
  run=spawnSync('npx',['playwright','test',testPath,'--project=firefox','--retries=0'],{encoding:'utf8',timeout:60000,maxBuffer:10e6});
} finally { await fs.unlink(testPath); }
await retainBrowser(process.cwd(),out,{kind:'intentional harness failure, not acceptance',originalTestExitCode:run.status});
await fs.writeFile(path.join(out,'console.log'),(run.stdout??'')+(run.stderr??''));
const files=await fs.readdir(out,{recursive:true});
const traces=files.filter(p=>p.endsWith('trace.zip')), screenshots=files.filter(p=>p.endsWith('.png'));
if(run.status!==1 || !traces.length || !screenshots.length) throw Error('Missing expected failed case, trace or screenshot');
for(const p of traces) execFileSync('unzip',['-t',path.join(out,p)]);
for(const p of screenshots) if((await fs.stat(path.join(out,p))).size<100) throw Error('Empty screenshot');
await fs.writeFile(path.join(out,'check.json'),JSON.stringify({harness:'PASS',acceptance:false,originalTestExitCode:run.status,traces,screenshots,transientTestRemoved:true},null,2));
console.log('Harness retained readable trace ZIP and nonempty screenshot; original test failed as intended.');

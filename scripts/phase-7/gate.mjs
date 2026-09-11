/** Execute the mandatory gate in an already isolated, clean, exact-commit checkout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = path.resolve(arg('out') ?? 'artifacts/phase-7-gate');
const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
if(git('status','--porcelain','--untracked-files=no'))throw Error('Freeze tracked changes before the acceptance gate.');
await fs.mkdir(out,{recursive:true});
const identity={commit:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),startedAt:new Date().toISOString(),node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim(),lockSha256:createHash('sha256').update(await fs.readFile('package-lock.json')).digest('hex')};
const commands=[];const servers=[];
async function run(name,command,args,env={}){
 const begin=Date.now();const output=await fs.open(path.join(out,`${name}.log`),'w');
 const child=spawn(command,args,{env:{...process.env,...env},stdio:['ignore',output.fd,output.fd]});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});await output.close();
 commands.push({name,command:[command,...args],env,exitCode:code,elapsedMs:Date.now()-begin,log:`${name}.log`});console.log(`${name}: ${code}`);
 if(code!==0)throw Error(`${name} failed; native log retained.`);
}
async function server(name,args,url){
 const log=await fs.open(path.join(out,`${name}.log`),'w');
 const child=spawn(process.execPath,args,{stdio:['ignore',log.fd,log.fd]});servers.push({child,log});
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error(`${name} exited before readiness.`);
  try{if((await fetch(url)).ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error(`${name} failed condition-based readiness.`);
}
let error=null;
try{
 await run('npm-ci','npm',['ci']);
 await run('typecheck','npm',['run','typecheck']);
 await run('lint','npm',['run','lint']);
 await server('unit-server',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],'http://127.0.0.1:5173/');
 await run('unit','npm',['test','--','--reporter=default','--reporter=json',`--outputFile=${path.join(out,'unit.json')}`],{NEPTUNE_TELEMETRY_BROWSER:'1',NEPTUNE_TELEMETRY_APP:'1'});
 await run('build','npm',['run','build']);
 await run('package','npm',['run','package:preview']);
 await fs.copyFile('dist/build-manifest.json',path.join(out,'tested-build-manifest.json'));
 await fs.copyFile('dist/release.json',path.join(out,'tested-release.json'));
 await run('archive','tar',['-cf',path.join(out,'tested-build.tar'),'-C','dist','.']);
 await server('production-server',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],'http://127.0.0.1:4173/');
 await run('browser','npx',['playwright','test','tests/browser/prototype.spec.ts','tests/browser/phase2.spec.ts','tests/browser/phase3.spec.ts','tests/browser/phase4.spec.ts','tests/browser/phase5.spec.ts','tests/browser/phase6.spec.ts','tests/browser/phase7.spec.ts','--retries=0'],{NEPTUNE_BASE_URL:'http://127.0.0.1:4173/',NEPTUNE_BROWSER_REPORT:path.join(out,'browser.json')});
}catch(problem){error=String(problem);console.error(error);process.exitCode=1;}
finally{
 for(const {child,log} of servers){child.kill('SIGTERM');await log.close();}
 const unchanged=identity.commit===git('rev-parse','HEAD')&&identity.tree===git('rev-parse','HEAD^{tree}')&&!git('status','--porcelain','--untracked-files=no');
 const receipt={...identity,completedAt:new Date().toISOString(),commands,error,unchanged,status:error||!unchanged?'FAIL':'PASS'};
 await fs.writeFile(path.join(out,'gate.json'),JSON.stringify(receipt,null,2)+'\n');
 if(!unchanged)process.exitCode=1;
}

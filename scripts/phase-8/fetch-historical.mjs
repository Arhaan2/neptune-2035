/** Recover immutable historical expected outputs; never regenerate them from current code. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const arg=key=>process.argv.find(v=>v.startsWith(`--${key}=`))?.slice(key.length+3);
const out=path.resolve(arg('out')??'artifacts/phase-8-history');
const url='https://github.com/Arhaan2/neptune-2035/releases/download/phase-7-2026-09-11/phase-7-evidence.zip';
const expected='1060e1debeea9a960dc0bf558ba9c0e08fd4b0f72a171684d84b020a0988ba75';
await fs.mkdir(out,{recursive:true});
const archive=arg('archive')?path.resolve(arg('archive')):path.join(out,'phase-7-evidence.zip');
if(!arg('archive')){
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
 assert.equal(response.status,200,'Anonymous historical release download');
 await fs.writeFile(archive,Buffer.from(await response.arrayBuffer()));
}
const actual=createHash('sha256').update(await fs.readFile(archive)).digest('hex');
assert.equal(actual,expected,'Immutable Phase 7 evidence archive SHA-256');
const extraction=JSON.parse(execFileSync('python3',['-c',`
import zipfile, pathlib, hashlib, json, sys
out=pathlib.Path(sys.argv[2]); rows=[]
with zipfile.ZipFile(sys.argv[1]) as z:
 for name in ['nominal','transfer','no-benefit-bus','no-benefit-source','sizing','sensitivity']:
  source='phase-7-evidence/local-final-2/reproduce-'+name+'/campaign.json'
  data=z.read(source)
  target=out/('reproduce-'+name)/'campaign.json'
  target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(data)
  rows.append({'fixture':name,'archiveEntry':source,'path':str(target.relative_to(out)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
print(json.dumps(rows))
`,archive,out],{encoding:'utf8'}));
const receipt={kind:'neptune-phase8-historical-inputs',version:1,sourceURL:url,archiveSHA256:actual,verifiedAt:new Date().toISOString(),files:extraction,status:'PASS'};
await fs.writeFile(path.join(out,'historical-inputs.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

/** Recompute portable decision evidence through the real engine in this checkout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('../../', import.meta.url));
const argument = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length+3);
const input = argument('input'), fixture = argument('fixture');
if(Boolean(input) === Boolean(fixture))throw Error('Use exactly one of --input=export.json or --fixture=transfer|nominal|sizing|sensitivity|no-benefit-bus|no-benefit-source.');
const output = path.resolve(argument('out') ?? 'artifacts/phase-6-reproduction');
const server = await createServer({root,configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true}});
try {
 const api = await server.ssrLoadModule('/src/twin/decision/index.ts');
 let supplied = null;
 if(input){const stat=await fs.stat(input);if(stat.size>64*1024*1024)throw Error('Input exceeds 64 MiB.');supplied=api.importDecisionCampaign(await fs.readFile(input,'utf8'));}
 const campaign = supplied?.campaign ?? api.createDecisionCampaign(fixture);
 api.validateDecisionCampaign(campaign);
 const plan = api.planDecisionCampaign(campaign);
 console.log(`Recomputing ${plan.totalRuns} declared runs: ${plan.candidates} candidates, ${plan.scenarios} scenarios, ${plan.sensitivities} cases. No stored winner is trusted.`);
 const result = await api.runDecisionCampaign(campaign,{concurrency:1});
 const comparison = supplied ? api.compareReproduction(supplied,result) : null;
 const git = (...args) => execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
 const sourceIdentity={commit:git('rev-parse','HEAD'),sourceTree:git('rev-parse','HEAD^{tree}')};
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'campaign.json'),api.exportDecisionCampaign(campaign,result,sourceIdentity));
 await fs.writeFile(path.join(output,'report.md'),api.decisionReport(campaign,result));
 const receipt={kind:'neptune-decision-reproduction',version:1,sourceIdentity,executedAt:new Date().toISOString(),inputKind:supplied?'imported-supplied-evidence':'named-fixture',coverage:result.coverage,status:result.status,ranking:result.ranking,sensitivityConclusion:result.sensitivityConclusion,comparison};
 await fs.writeFile(path.join(output,'reproduction.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
 if(result.status!=='completed'||(comparison&&!comparison.matches))process.exitCode=1;
} finally { await server.close(); }

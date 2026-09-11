import { identity, keys, preflightJSON, record, safeJSON, string, validateStructure } from '../persistence/structure';
import { validateState } from '../persistence/state';
import { validateExperimentDefinition } from '../experiment/definition';
import { finiteNumber } from '../safety';
import { experimentRecoveryReport } from '../experiment/report';
import { constraints } from '../analysis/reports';
import { summarize } from '../engine/simulation';
import { validateDecisionCampaign, decisionCampaignIdentity } from './contract';
import { assembleDecisionResult, planDecisionCampaign } from './runner';
import { DECISION_LIMITS, DECISION_VERSION, type DecisionCampaign, type DecisionExport, type DecisionResult } from './types';

function contentIdentity(campaign:DecisionCampaign,result:DecisionResult,sourceIdentity:DecisionExport['sourceIdentity']):string {
  // Evidence origin label changes on import; the supplied numerical payload does not.
  return identity({campaign,result:{...result,provenance:'executed'},sourceIdentity});
}
function normalizedResult(result:DecisionResult){return {...result,provenance:'executed',runs:[...result.runs].sort((a,b)=>a.id.localeCompare(b.id)),evaluations:[...result.evaluations].sort((a,b)=>`${a.candidateId}:${a.sensitivityId}`.localeCompare(`${b.candidateId}:${b.sensitivityId}`))};}
export function validateDecisionResult(campaign:DecisionCampaign,value:unknown):asserts value is DecisionResult {
  validateStructure(value);record(value,'decision result');keys(value,['version','campaignIdentity','provenance','status','plan','runs','evaluations','ranking','sensitivityRankings','sensitivityConclusion','coverage'],'decision result');
  const result=value as unknown as DecisionResult;
  if(result.version!==DECISION_VERSION||result.campaignIdentity!==decisionCampaignIdentity(campaign)||!['executed','imported-supplied-evidence'].includes(result.provenance)||!['completed','cancelled','incomplete'].includes(result.status))throw Error('Decision result version, input identity, provenance or status mismatch.');
  const planned=planDecisionCampaign(campaign);
  if(identity(result.plan)!==identity(planned))throw Error('Resolved designs, scenario targets, initial checkpoints or matrix differ from campaign definitions.');
  if(!Array.isArray(result.runs)||result.runs.length>planned.totalRuns||new Set(result.runs.map(r=>r.id)).size!==result.runs.length)throw Error('Duplicate or out-of-envelope decision run evidence.');
  for(const run of result.runs){
    record(run,'run evidence');keys(run,['id','candidateId','scenarioId','sensitivityId','status','reason','state','peakSupply','hardConstraints','recovery','incrementalShortfallAcceleratorS'],'run evidence');
    const definition=planned.runs.find(r=>r.id===run.id);
    if(!definition||run.candidateId!==definition.candidateId||run.scenarioId!==definition.scenarioId||run.sensitivityId!==definition.sensitivityId)throw Error('Evidence run does not match a declared matrix cell.');
    if(!['invalid','unsupported','numerical-failure','cancelled','resource-limited','incomplete','completed'].includes(run.status))throw Error('Unsupported run execution status.');
    if(run.reason!==null)string(run.reason,'run reason');
    if(run.state!==null){validateState(definition.design,run.state);if(!run.state.experiment)throw Error('Whole-run evidence is mandatory.');validateExperimentDefinition(definition.design,run.state.experiment.definition);if(identity(run.state.experiment.definition)!==identity(definition.definition)||run.state.experiment.initialStateIdentity!==definition.initialStateIdentity||identity(run.state.experiment.initialState)!==definition.initialStateIdentity)throw Error('Run definition or actual initialization differs.');if(run.status==='completed'&&run.state.experiment.status!=='completed')throw Error('Completed evidence contains an incomplete physical run.');}
    else if(run.status==='completed')throw Error('Completed run cannot omit whole-run metrics.');
    if(run.peakSupply!==null){record(run.peakSupply,'peak supply');keys(run.peakSupply,['value','timeS','assetId','samples'],'peak supply');finiteNumber(run.peakSupply.value,'peak upstream supply',{min:0,max:10e9});finiteNumber(run.peakSupply.timeS,'peak time',{min:0,max:definition.definition.durationS});finiteNumber(run.peakSupply.samples,'dispatch observations',{min:1,max:100000,integer:true});if(run.peakSupply.assetId!=='shore/grid')throw Error('Supply peak must refer to upstream grid.');}
    else if(run.status==='completed')throw Error('Completed evidence cannot omit canonical upstream observations.');
    if(!Array.isArray(run.hardConstraints)||run.hardConstraints.length>16)throw Error('Malformed hard model screens.');
    for(const check of run.hardConstraints){record(check,'hard constraint');keys(check,['id','title','status','detail','assetId'],'hard constraint');for(const field of ['id','title','detail'] as const)string(check[field],`hard constraint ${field}`);if(!['satisfied','violated','unsupported','unassessed'].includes(check.status))throw Error('Invalid model screen status.');}
    if(run.state!==null&&(run.recovery!==null||run.status==='completed')&&identity(run.recovery)!==identity(experimentRecoveryReport(run.state)))throw Error('Recovery report differs from raw whole-run recovery evidence.');
    if(run.status==='completed'){
      const expectedScreens=constraints(definition.design,definition.initialState).filter(c=>['EL-01','GE-01','NW-03'].includes(c.id));
      if(identity(run.hardConstraints)!==identity(expectedScreens))throw Error('Installed hard model screens differ from the resolved design.');
      const observedBoundary=Math.max(summarize(definition.design,definition.initialState).gridW,summarize(definition.design,run.state!).gridW);
      if(run.peakSupply!.value+campaign.tolerances.watts<observedBoundary)throw Error('Supplied peak draw is below an actual initial or final boundary.');
    }
    if(run.incrementalShortfallAcceleratorS!==null)finiteNumber(run.incrementalShortfallAcceleratorS,'incremental shortfall');
  }
  const derived=assembleDecisionResult(campaign,planned,result.runs,result.status==='cancelled');
  if(identity(normalizedResult(result))!==identity(normalizedResult(derived)))throw Error('Stored coverage, paired metrics, constraints or rankings disagree with the supplied raw evidence. Recompute to assess mismatches.');
}
export function exportDecisionCampaign(campaign:DecisionCampaign,result:DecisionResult,sourceIdentity:DecisionExport['sourceIdentity']={sourceTree:'unrecorded',commit:'unrecorded'}):string {
  validateDecisionCampaign(campaign);validateDecisionResult(campaign,result);
  for(const [field,value] of Object.entries(sourceIdentity)){string(value,field,160);if(value.includes('/')||value.includes('\\'))throw Error('Source identity must be portable, not a filesystem path.');}
  return safeJSON({kind:'neptune-decision-evidence',version:DECISION_VERSION,campaign,result,evidenceIdentity:contentIdentity(campaign,result,sourceIdentity),sourceIdentity} satisfies DecisionExport);
}
export function importDecisionCampaign(text:string):DecisionExport {
  if(typeof text!=='string'||text.length>DECISION_LIMITS.bytes)throw Error('Decision import exceeds byte envelope.');preflightJSON(text);
  const parsed:unknown=JSON.parse(text);record(parsed,'decision evidence');keys(parsed,['kind','version','campaign','result','evidenceIdentity','sourceIdentity'],'decision evidence');
  if(parsed.kind!=='neptune-decision-evidence'||parsed.version!==DECISION_VERSION)throw Error('Unsupported decision export version.');
  validateDecisionCampaign(parsed.campaign);validateDecisionResult(parsed.campaign,parsed.result);
  record(parsed.sourceIdentity,'source identity');keys(parsed.sourceIdentity,['sourceTree','commit'],'source identity');for(const field of ['sourceTree','commit']){string(parsed.sourceIdentity[field],field,160);if((parsed.sourceIdentity[field] as string).includes('/')||(parsed.sourceIdentity[field] as string).includes('\\'))throw Error('Source identity must not contain private paths.');}
  const data=parsed as unknown as DecisionExport;
  if(data.evidenceIdentity!==contentIdentity(data.campaign,data.result,data.sourceIdentity))throw Error('Evidence identity mismatch: supplied campaign/results were changed.');
  return {...data,result:{...data.result,provenance:'imported-supplied-evidence'}};
}
export function compareReproduction(expected:DecisionExport,recomputed:DecisionResult):{matches:boolean;differences:string[]} {
  const differences:string[]=[];const campaign=expected.campaign;
  if(recomputed.provenance!=='executed')differences.push('Reproduction requires newly executed evidence, not imported supplied results.');
  const toleranceFor=(path:string,parentUnit?:string):number=>{
    const field=path.replace(/\[\d+\]/g,'').split('.').at(-1)!;
    // Definitions, actual initial states in the plan, thresholds and declared tolerances are identities.
    if(path.startsWith('result.plan.')||['threshold','tolerance','version','schemaVersion','extensionVersion','integrationStepS'].includes(field))return 0;
    if(/Count$|^count$|^samples$|^stepIndex$|^committedIntervals$|^traceSamplesSeen$|^committedStepIndex$|^completedRuns$|^requiredRuns$|^completed$|^planned$|^fullyEvaluatedCandidates$|^workload$/.test(field))return 0;
    if(field.endsWith('Nodes')||field.endsWith('Accelerators')||field==='requiredAccelerators'||field==='serviceableAccelerators'||path.includes('.minServiceable.value'))return campaign.tolerances.accelerators;
    if(['actual','margin'].includes(field)&&parentUnit){const units:Record<string,number>={'s':campaign.tolerances.seconds,'W':campaign.tolerances.watts,'USD':campaign.tolerances.USD,'accelerator-s':campaign.tolerances.acceleratorSeconds,'boolean':0};if(parentUnit in units)return units[parentUnit];}
    if(field.endsWith('AcceleratorS'))return campaign.tolerances.acceleratorSeconds;
    if(field.endsWith('K')||/\.max(?:Coolant|Air)\.value$/.test(path))return campaign.tolerances.kelvin;
    if(field.endsWith('PerS')||field.endsWith('M3S')||field.endsWith('BitS'))return 1e-6;
    if(field.endsWith('S')||path.includes('.startAtS.'))return campaign.tolerances.seconds;
    if(field.endsWith('W')||path.endsWith('.peakSupply.value'))return campaign.tolerances.watts;
    if(field.endsWith('USD')||path.includes('.includedCost.')&&['equipment','installation','contingency'].includes(field))return campaign.tolerances.USD;
    // Wh, geometric coordinates, continuous controller values and residual rates use the declared
    // absolute reproduction fallback. This never applies to counts, times, powers or money above.
    return 1e-6;
  };
  const visit=(a:unknown,b:unknown,path:string,parentUnit?:string):void=>{
    if(differences.length>=100)return;
    if(typeof a==='number'&&typeof b==='number'){if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>toleranceFor(path,parentUnit))differences.push(`${path}: ${a} != ${b}`);return;}
    if(a===b)return;
    if(Array.isArray(a)&&Array.isArray(b)){if(a.length!==b.length){differences.push(`${path}: length ${a.length} != ${b.length}`);return;}a.forEach((v,i)=>visit(v,b[i],`${path}[${i}]`,parentUnit));return;}
    if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>;const keys=[...new Set([...Object.keys(aa),...Object.keys(bb)])].sort();for(const key of keys){if(key==='solverMs')continue;visit(aa[key],bb[key],`${path}.${key}`,typeof aa.unit==='string'?aa.unit:parentUnit);}return;}
    differences.push(`${path}: ${String(a)} != ${String(b)}`);
  };
  visit(normalizedResult(expected.result),normalizedResult(recomputed),'result');
  return {matches:differences.length===0,differences};
}
const display=(value:number|null)=>value===null?'unavailable':String(value);
export function decisionReport(campaign:DecisionCampaign,result:DecisionResult,sourceIdentity:DecisionExport['sourceIdentity']={sourceTree:'unrecorded',commit:'unrecorded'}):string {
  const winnerRows=result.evaluations.filter(e=>e.sensitivityId==='central'&&result.ranking.winnerIds.includes(e.candidateId));
  const limiting=winnerRows.flatMap(e=>e.requirements.filter(r=>r.class==='operating'&&r.threshold>0&&r.actual!==null).sort((a,b)=>(a.margin??Infinity)/Math.max(1,a.threshold)-(b.margin??Infinity)/Math.max(1,b.threshold)).slice(0,3).map(r=>`${e.candidateId}: ${r.id}, ${display(r.actual)} ${r.unit} <= ${r.threshold}; margin ${display(r.margin)} (${r.scenarioId})`));
  const narrative=`# NEPTUNE Phase 6 decision report\n\n${campaign.qualifier}\n\n${result.provenance==='imported-supplied-evidence'?'Imported supplied evidence; not a trusted newly executed cache.':'Canonical simulated engine execution.'}\n\nObjective: ${campaign.objective.mode}; ${campaign.objective.direction} ${campaign.objective.unit}. Ranking included-cost basis: ${campaign.objective.rankingCostBasis}; budget basis: ${campaign.objective.budgetBasis}. Status: **${result.ranking.status}**. ${result.ranking.winnerIds.length?`Preferred evaluated candidate(s): **${result.ranking.winnerIds.join(', ')}**.`:'No compliant recommendation.'} ${!result.ranking.scopeComplete?'Results are provisional; the full declared search remains unresolved.':''}\n\nScope: ${campaign.candidates.length} declared candidates × ${campaign.scenarios.length} scenarios × ${campaign.sensitivities.length} assumptions. Completed ${result.coverage.completed}/${result.coverage.planned} runs; fully evaluated candidates ${result.coverage.fullyEvaluatedCandidates}/${campaign.candidates.length}. Matching baseline references: ${result.plan.sharedBaselines}. No unevaluated capacities inferred.\n\n${limiting.length?'Limiting assessed requirements:\n\n'+limiting.map(x=>`- ${x}`).join('\n'):'No passing candidate with a limiting requirement to report.'}\n\n${result.sensitivityConclusion}\n\n${campaign.sensitivityNote}\n\n## Evaluated candidates\n\n| Candidate | Assumption | Requested accelerators | Included cost USD | Budget amount USD | Execution | Feasibility | Unmet accelerator-s | Total interruption s | Longest s | Confirmed recovery absolute s | Thermal violation s | Peak supply W |\n| --- | --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${result.evaluations.map(e=>`| ${e.candidateId} | ${e.sensitivityId} | ${e.workload} | ${e.includedCost.completeWithinIncludedScope?e.includedCost.totalUSD:'unknown included price'} | ${e.budgetCostUSD} | ${e.execution} | ${e.feasibility} | ${display(e.worst.shortfallAcceleratorS)} | ${display(e.worst.totalInterruptionS)} | ${display(e.worst.longestInterruptionS)} | ${display(e.worst.recoveryConfirmationS)} | ${display(e.worst.thermalViolationS)} | ${display(e.worst.peakSupplyW)} |`).join('\n')}\n\n## Whole-run outcomes and original policy\n\nThe original Phase4/5 zero-outage outcome is preserved. Phase6 applies its separately versioned requirements to these raw whole-run metrics; restored Phase5 FAIL may pass Phase6. Thermal claims cover only the observed cold interval; settling was not requested or achieved by an assessed settling policy.\n\n| Run | Status | Observation s | Original outcome | Total loss accelerator-s | Incremental fault-minus-baseline loss | Recovery onset s | Dwell confirmation s |\n| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |\n${result.runs.map(r=>`| ${r.id} | ${r.status} | ${r.state?.experiment?.metrics.elapsedS??'unavailable'} | ${r.state?.experiment?.evaluation.outcome??'unavailable'} | ${r.state?.experiment?.metrics.shortfallAcceleratorS??'unavailable'} | ${display(r.incrementalShortfallAcceleratorS)} | ${display(r.recovery?.onsetTimeS??null)} | ${display(r.recovery?.confirmationTimeS??null)} |`).join('\n')}\n\n## Requirement margins and failure reasons\n\n${result.evaluations.map(e=>`### ${e.candidateId} · ${e.sensitivityId}\n\n| Requirement / class | Scenario | Actual | Threshold / comparison | Tolerance | Signed margin | Status | Assets / time |\n| --- | --- | ---: | --- | ---: | ---: | --- | --- |\n${e.requirements.map(r=>`| ${r.id} / ${r.class} | ${r.scenarioId??'campaign'} | ${display(r.actual)} ${r.unit} | ${r.operator} ${r.threshold} | ${r.tolerance} | ${display(r.margin)} | ${r.status} | ${r.assetIds.join(', ')} / ${display(r.timeS)} s |`).join('\n')}\n\n${e.reasons.length?e.reasons.map(reason=>`- ${reason}`).join('\n'):'All evaluated requirements satisfied under this assumption.'}`).join('\n\n')}\n\n## Cost basis and unassessed conditions\n\nUSD included equipment from authoritative billOfEquipment; installation20% of equipment, then contingency25% of equipment plus installation. Upper-bound budget/rank uses the original central included estimate times1.5 once, including the cost-upper case. Unknown costs never equal zero. No cost is an ownership-cost estimate or construction quote.\n\n${campaign.exclusions.map(x=>`- ${x}`).join('\n')}\n\n## Reproducibility\n\nCampaign ${campaign.id}, input identity ${result.campaignIdentity}, decision ${DECISION_VERSION}, solver ${campaign.versions.solver}, metrics ${campaign.versions.metrics}. Exported machine-readable evidence retains portable designs/specifications, resolved fault footprints, actual initial checkpoints, complete aggregate metrics and all unresolved/infeasible rows. Recompute with the repository decision reproduction command; supplied outcomes are not execution proof.\n`;
  const costs=result.evaluations.map(e=>`### ${e.candidateId} · ${e.sensitivityId} included-cost detail

Equipment ${e.includedCost.equipment} USD; installation ${e.includedCost.installation} USD; contingency ${e.includedCost.contingency} USD; total ${e.includedCost.totalUSD} USD. Economic identity ${e.includedCost.economicIdentity}, assumption date ${e.includedCost.date}. ${e.includedCost.exclusions}

| Included scope | Whole quantity | Unit USD | Total USD |
| --- | ---: | ---: | ---: |
${e.includedCost.rows.map(row=>`| ${row.scope} | ${row.count} | ${row.unitUSD} | ${row.totalUSD} |`).join('\n')}`).join('\n\n');
  return narrative+`
## Source and complete portable evidence appendix

Source tree: ${sourceIdentity.sourceTree}. Commit: ${sourceIdentity.commit}. These source identities are supplied by the exporting build; an unrecorded identity is explicitly unknown.

${costs}

### Complete campaign definitions and resolved candidate specifications

The following versioned definition is part of this report and retains the objective, thresholds, units, assumptions, exclusions, bounded execution, and every candidate's actual installed design/specification snapshot.

\`\`\`json
${JSON.stringify(campaign,null,2)}
\`\`\`

### Every planned run, actual initial state, and resolved disturbance footprint

Each cell includes its portable resolved design (including sensitivity inputs), exact experiment definition, actual initial physical checkpoint, identity, and affected assets/workload. Unexecuted cells remain present.

\`\`\`json
${JSON.stringify(result.plan,null,2)}
\`\`\`

### Complete raw whole-run outcomes and evaluated policies

Authoritative whole-run aggregates, original Phase4/5 evaluation, recovery episodes and confirmation, terminal physical checkpoints, all requirement evaluations and every sensitivity ranking follow. Visualization traces are bounded and are not the boundary of this evidence. Imported outcomes remain supplied evidence until a new canonical execution reproduces them.

\`\`\`json
${JSON.stringify({status:result.status,provenance:result.provenance,runs:result.runs,evaluations:result.evaluations,ranking:result.ranking,sensitivityRankings:result.sensitivityRankings,sensitivityConclusion:result.sensitivityConclusion,coverage:result.coverage},null,2)}
\`\`\`
`;

}

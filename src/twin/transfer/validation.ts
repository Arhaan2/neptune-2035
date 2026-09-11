import { engineeringIdentity } from '../catalog/equipment';
import { transferRestorationDemands } from '../engine/simulation';
import { failure, finiteNumber } from '../safety';
import { array, keys, record } from '../persistence/structure';
import type { Design, SimulationState } from '../types';
import { transferRefusal } from './controller';
import { planTransfers, restorationRequestedW } from './dispatch';
import { activePowerDesign, powerPath, powerResources } from './topology';
import { TRANSFER_POLICY, TRANSFER_TOPOLOGY, type TransferAttempt, type TransferTransition } from './types';
const statuses=['normal','detected','isolated','evaluating','waiting','transferred','blocked','lockout'];
const reasons=['NORMAL','FEEDER_FAULT','ISOLATION_CONFIRMED','EVALUATING','WAITING','TRANSFERRED','DISABLED','RECEIVING_BUS_FAILED','DOWNSTREAM_FAILED','COMMON_SOURCE_FAILED','DONOR_UNAVAILABLE','TIE_UNAVAILABLE','ISOLATION_UNCONFIRMED','ORIGINAL_RESTORED','NO_HEADROOM','INSUFFICIENT_HEADROOM','PATH_UNAVAILABLE','CAPACITY_SHED'];
const attemptKeys=['id','attemptId','status','reason','detectedAtS','deadlineS','originalClosed','tieClosed','requestedW','accelerators','originalPath','donorPath','admittedW','unservedW','bindingResourceId','headroomW'];
const legalNext:Record<string,string[]>={normal:['detected','blocked'],detected:['isolated','lockout'],isolated:['evaluating'],evaluating:['waiting','blocked'],waiting:['transferred','blocked','lockout'],transferred:['lockout'],blocked:[],lockout:[]};
const refusalReasons=['DISABLED','RECEIVING_BUS_FAILED','DOWNSTREAM_FAILED','COMMON_SOURCE_FAILED','DONOR_UNAVAILABLE','TIE_UNAVAILABLE','PATH_UNAVAILABLE'];
const stateReasons:Record<string,string[]>={normal:['NORMAL'],detected:['FEEDER_FAULT'],isolated:['ISOLATION_CONFIRMED'],evaluating:['EVALUATING'],waiting:['WAITING'],transferred:['TRANSFERRED'],blocked:[...refusalReasons,'ORIGINAL_RESTORED','NO_HEADROOM','INSUFFICIENT_HEADROOM'],lockout:[...refusalReasons,'ISOLATION_UNCONFIRMED','CAPACITY_SHED']};
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-7;
export function validateTransferState(design:Design,state:SimulationState):void {
  const t=state.transfer;
  if(!design.transfer){if(t!==undefined)failure('invalid-input','TRANSFER_LEGACY','Legacy design cannot contain active transfer state.');return;}
  if(!t)failure('invalid-input','TRANSFER_MISSING','Opt-in transfer design requires its complete controller checkpoint.');
  record(t,'transfer state');keys(t,['version','policy','topology','designIdentity','splitTimesS','attempts','sequence','transitions','transitionsTruncated','transitionCounts','resources'],'transfer state');
  if(t.version!==1||t.policy!==TRANSFER_POLICY||t.topology!==TRANSFER_TOPOLOGY||t.designIdentity!==engineeringIdentity(design))failure('invalid-input','TRANSFER_STATE_BINDING','Transfer checkpoint does not match its design/policy/topology.');
  array(t.splitTimesS,'transfer split boundaries',256);let previous=0;
  for(const time of t.splitTimesS){finiteNumber(time,'transfer split time',{min:previous,max:state.timeS});if(time<=previous||Number.isInteger(time/state.integrationStepS)||!Number.isInteger(time/0.125))failure('invalid-input','TRANSFER_SPLIT','Transfer internal split boundaries must be ordered off-step eighth-second timestamps.');previous=time;}
  finiteNumber(t.sequence,'transfer sequence',{min:0,max:2560,integer:true});array(t.attempts,'transfer attempts',256);
  if(t.attempts.length!==design.transfer.routes.length)failure('invalid-input','TRANSFER_ATTEMPTS','Transfer checkpoint recipient inventory differs.');
  const routes=new Map(design.transfer.routes.map(r=>[r.id,r])),knownResources=new Set(powerResources(design).map(r=>r.id));
  const validateSnapshot=(a:TransferAttempt,historical=false)=>{
    const r=routes.get(a.id);if(!r)failure('invalid-input','TRANSFER_ATTEMPTS','Unknown transfer recipient.');
    if(!statuses.includes(a.status)||!stateReasons[a.status]?.includes(a.reason))failure('invalid-input','TRANSFER_STATUS','Transfer reason must correspond to its controller state.');
    if(typeof a.originalClosed!=='boolean'||typeof a.tieClosed!=='boolean'||a.originalClosed&&a.tieClosed||a.tieClosed!==(a.status==='transferred'))failure('invalid-input','TRANSFER_SWITCHES','Transfer positions violate single supply or disagree with controller state.');
    for(const key of ['requestedW','admittedW','unservedW','headroomW','accelerators'] as const)finiteNumber(a[key],`transfer.${key}`,{min:0});
    if(a.status==='transferred'?!close(a.admittedW,a.requestedW)||a.unservedW!==0:a.admittedW!==0)failure('invalid-input','TRANSFER_ALLOCATION','An admitted transfer must serve its whole requested bundle; an open tie has no admitted load.');
    if(a.status==='normal'&&a.unservedW!==0||historical&&a.status!=='normal'&&a.status!=='transferred'&&!close(a.unservedW,a.reason==='ORIGINAL_RESTORED'?0:a.requestedW))failure('invalid-input','TRANSFER_SHORTFALL','Transfer snapshot shortfall disagrees with its switching outcome.');
    const accelerators=design.modules.filter(m=>m.platformId===r.recipientPlatformId).reduce((n,m)=>n+m.nodeCount*8,0);if(a.accelerators!==accelerators)failure('invalid-input','TRANSFER_INVENTORY','Transfer inventory differs from its physical platform.');
    for(const [path,expected] of [[a.originalPath,powerPath(design,r.receivingBusId).assetIds],[a.donorPath,powerPath(design,r.donorBusId).assetIds]]){array(path,'transfer path',50);if(JSON.stringify(path)!==JSON.stringify(expected))failure('invalid-input','TRANSFER_PATH','Transfer evidence must retain the complete ordered installed supply path.');}
    if(a.bindingResourceId!==null&&(typeof a.bindingResourceId!=='string'||!knownResources.has(a.bindingResourceId)&&a.bindingResourceId!==`bundle:${a.id}:module-distribution`))failure('invalid-input','TRANSFER_RESOURCE','Invalid binding resource.');
  };
  const ids=new Set<string>(),active=activePowerDesign(design,state);
  for(const a of t.attempts){record(a,'transfer attempt');keys(a,attemptKeys,'transfer attempt');const r=routes.get(a.id);
    if(!r||ids.has(a.id))failure('invalid-input','TRANSFER_ATTEMPTS','Unknown or duplicate transfer recipient.');ids.add(a.id);validateSnapshot(a);
    if(['detected','isolated','evaluating'].includes(a.status))failure('invalid-input','TRANSFER_UNCOMMITTED','Checkpoint must follow completion of the boundary controller.');
    if(a.status==='normal'){if(a.attemptId!==null||a.detectedAtS!==null||a.deadlineS!==null||!a.originalClosed||a.tieClosed)failure('invalid-input','TRANSFER_NORMAL','Normal controller has invalid attempt/switch history.');}
    else{if(a.attemptId!==`${a.id}:attempt-1`||a.detectedAtS===null)failure('invalid-input','TRANSFER_ATTEMPT_ID','Transfer attempt identity missing.');finiteNumber(a.detectedAtS,'transfer detectedAtS',{min:0,max:state.timeS});if(!state.events.some(e=>e.timeS===a.detectedAtS&&[r.originalFeederId,r.receivingBusId,'shore/grid'].includes(e.assetId)&&['trip','maintenance'].includes(e.kind)&&state.appliedEventIds.includes(e.id)))failure('invalid-input','TRANSFER_FAULT_BINDING','Transfer detection requires the actual applied feeder fault.');}
    if(a.status==='waiting'){if(a.deadlineS!==a.detectedAtS!+design.transfer.delayS||a.deadlineS<=state.timeS||a.originalClosed)failure('invalid-input','TRANSFER_DEADLINE','Pending deadline must match the detected fault and policy, with isolation confirmed.');}
    else if(a.deadlineS!==null)failure('invalid-input','TRANSFER_DEADLINE','Only waiting transfers may retain a pending deadline.');
    if(a.tieClosed&&(transferRefusal(design,state,a.id)!==null||!powerPath(active,r.receivingBusId).supported))failure('invalid-input','TRANSFER_LIVE_FAULT','Closed transfer path is failed, ineligible or unsupported.');
  }
  array(t.transitions,'transfer transitions',1000);if(typeof t.transitionsTruncated!=='boolean'||t.transitions.length>t.sequence||!t.transitionsTruncated&&t.transitions.length!==t.sequence)failure('invalid-input','TRANSFER_RETENTION','Transfer transition counts/retention disagree.');
  let seq=t.sequence-t.transitions.length,time=-1;const last=new Map<string,TransferTransition>(),retainedCounts=new Map<string,number>();
  for(const e of t.transitions){record(e,'transfer transition');keys(e,[...attemptKeys,'sequence','transitionId','timeS','previous','affectedAssetIds'],'transfer transition');
    if(e.sequence!==++seq||e.transitionId!==`${e.id}:${e.sequence}`||!ids.has(e.id)||!statuses.includes(e.previous)||!legalNext[e.previous]?.includes(e.status))failure('invalid-input','TRANSFER_TRANSITION','Transfer sequence, identity or state transition disagrees.');
    finiteNumber(e.timeS,'transfer transition time',{min:Math.max(0,time),max:state.timeS});time=e.timeS;validateSnapshot(e,true);
    if(e.attemptId!==`${e.id}:attempt-1`||e.detectedAtS===null)failure('invalid-input','TRANSFER_ATTEMPT_ID','Historical transfer attempt identity missing.');finiteNumber(e.detectedAtS,'transfer detectedAtS',{min:0,max:e.timeS});
    if(e.status==='waiting'?e.deadlineS!==e.detectedAtS+design.transfer.delayS||e.deadlineS<e.timeS:e.deadlineS!==null)failure('invalid-input','TRANSFER_DEADLINE','Historical transfer deadline disagrees with its policy/state.');
    if((e.status==='transferred'||e.previous==='waiting'&&['NO_HEADROOM','INSUFFICIENT_HEADROOM'].includes(e.reason))&&e.timeS!==e.detectedAtS+design.transfer.delayS)failure('invalid-input','TRANSFER_CLOSURE_TIME','A deadline allocation or closure must occur at its configured transfer deadline.');
    const r=routes.get(e.id)!,prior=last.get(e.id);if(prior?e.previous!==prior.status||e.detectedAtS!==prior.detectedAtS:!t.transitionsTruncated&&e.previous!=='normal')failure('invalid-input','TRANSFER_TRANSITION_CHAIN','Retained transfer transitions do not form a continuous attempt.');
    if(JSON.stringify(e.affectedAssetIds)!==JSON.stringify([r.originalFeederId,r.receivingBusId,r.donorBusId,r.tieId,r.isolatorId]))failure('invalid-input','TRANSFER_TRANSITION_ASSETS','Transfer transition scope differs from its installed route.');
    last.set(e.id,e);retainedCounts.set(e.reason,(retainedCounts.get(e.reason)??0)+1);
  }
  for(const a of t.attempts){const e=last.get(a.id);if(!e){if(!t.transitionsTruncated&&a.status!=='normal')failure('invalid-input','TRANSFER_HISTORY_MISSING','Current attempt is missing its transition history.');continue;}
    // Current demand/headroom can change without another switch transition. Validate
    // historical numeric snapshots internally; only stable state fields must agree.
    for(const key of ['attemptId','status','reason','detectedAtS','deadlineS','originalClosed','tieClosed','accelerators'] as const)if(a[key]!==e[key])failure('invalid-input','TRANSFER_CURRENT_HISTORY','Current transfer state disagrees with its last recorded transition.');
    // An open-tie decision retains its last evaluated shortfall/headroom even
    // while requestedW tracks newer workload inputs. Those supplied decision
    // values must remain bound to the same retained outcome snapshot.
    if(a.status!=='transferred'&&(!close(a.unservedW,e.unservedW)||!close(a.headroomW,e.headroomW)||a.bindingResourceId!==e.bindingResourceId))failure('invalid-input','TRANSFER_DECISION_HISTORY','Current open-tie decision evidence differs from its retained outcome.');
  }
  record(t.transitionCounts,'transfer counts');let count=0;for(const [reason,n] of Object.entries(t.transitionCounts)){if(!reasons.includes(reason))failure('invalid-input','TRANSFER_REASON','Unknown cumulative reason.');finiteNumber(n,'transfer reason count',{min:retainedCounts.get(reason)??0,integer:true});count+=n;}if(count!==t.sequence||[...retainedCounts].some(([reason,n])=>(t.transitionCounts[reason as keyof typeof t.transitionCounts]??0)<n))failure('invalid-input','TRANSFER_COUNTS','Cumulative transfer count disagrees with retained history.');
  // Recompute only the current allocation, using the engine's same demand helper.
  // Include refused deadline requests whose zero allocation remains in this boundary's
  // ledger. Initial dry refusals intentionally have no committed resource reservation.
  const candidates=t.attempts.filter(a=>a.status==='transferred'||(['NO_HEADROOM','INSUFFICIENT_HEADROOM','CAPACITY_SHED'].includes(a.reason)&&last.get(a.id)?.timeS===state.timeS&&['waiting','transferred'].includes(last.get(a.id)!.previous)));
  const demands=transferRestorationDemands(design,state),expected=planTransfers(design,state,demands,candidates),expectedResources=new Map(expected.resources.map(r=>[r.id,r]));
  for(const a of t.attempts)if(!close(a.requestedW,restorationRequestedW(design,demands,a.id)))failure('invalid-input','TRANSFER_REQUEST_BINDING','Current transfer demand differs from the installed bundle and runtime inputs.');
  for(const result of expected.allocations){const a=t.attempts.find(a=>a.id===result.id)!;for(const key of ['admittedW','unservedW','headroomW'] as const)if(!close(a[key],result[key]))failure('invalid-input','TRANSFER_ALLOCATION_BINDING','Current transfer allocation differs from the authoritative shared-resource plan.');if(a.bindingResourceId!==result.bindingResourceId)failure('invalid-input','TRANSFER_ALLOCATION_BINDING','Current binding resource differs from the shared-resource plan.');}
  array(t.resources,'transfer resources',200000);if(t.resources.length!==expectedResources.size)failure('invalid-input','TRANSFER_RESOURCE_INVENTORY','Transfer resource inventory differs from the current installed allocation.');
  const resources=new Set<string>();for(const r of t.resources){record(r,'transfer resource');keys(r,['id','capacityW','nativeW','transferredW','headroomW'],'transfer resource');const expected=expectedResources.get(r.id);if(typeof r.id!=='string'||resources.has(r.id)||!expected)failure('invalid-input','TRANSFER_RESOURCE','Invalid, unknown or duplicate transfer resource.');resources.add(r.id);for(const k of ['capacityW','nativeW','transferredW','headroomW'] as const){finiteNumber(r[k],`transfer resource ${k}`,{min:0});if(!close(r[k],expected[k]))failure('invalid-input','TRANSFER_RESOURCE_BINDING','Transfer resource rating, native load or live reservation differs from the authoritative current plan.',{assetId:r.id,field:k});}}
}

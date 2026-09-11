import { engineeringIdentity } from '../catalog/equipment';
import { failure, finiteNumber } from '../safety';
import { array, keys, record } from '../persistence/structure';
import type { Design, SimulationState } from '../types';
import { TRANSFER_POLICY, TRANSFER_TOPOLOGY } from './types';
const statuses=['normal','detected','isolated','evaluating','waiting','transferred','blocked','lockout'];
const reasons=['NORMAL','FEEDER_FAULT','ISOLATION_CONFIRMED','EVALUATING','WAITING','TRANSFERRED','DISABLED','RECEIVING_BUS_FAILED','DOWNSTREAM_FAILED','COMMON_SOURCE_FAILED','DONOR_UNAVAILABLE','TIE_UNAVAILABLE','ISOLATION_UNCONFIRMED','ORIGINAL_RESTORED','NO_HEADROOM','INSUFFICIENT_HEADROOM','PATH_UNAVAILABLE','CAPACITY_SHED'];
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
  const ids=new Set<string>();
  for(const a of t.attempts){record(a,'transfer attempt');keys(a,['id','attemptId','status','reason','detectedAtS','deadlineS','originalClosed','tieClosed','requestedW','accelerators','originalPath','donorPath','admittedW','unservedW','bindingResourceId','headroomW'],'transfer attempt');const r=design.transfer.routes.find(r=>r.id===a.id);
    if(!r||ids.has(a.id))failure('invalid-input','TRANSFER_ATTEMPTS','Unknown or duplicate transfer recipient.');ids.add(a.id);
    if(!statuses.includes(a.status)||!reasons.includes(a.reason))failure('invalid-input','TRANSFER_STATUS','Unknown transfer state/reason.');
    if(typeof a.originalClosed!=='boolean'||typeof a.tieClosed!=='boolean'||a.originalClosed&&a.tieClosed||a.tieClosed!==(a.status==='transferred'))failure('invalid-input','TRANSFER_SWITCHES','Transfer positions violate single supply or disagree with controller state.');
    for(const key of ['requestedW','admittedW','unservedW','headroomW','accelerators'] as const)finiteNumber(a[key],`transfer.${key}`,{min:0});
    const accelerators=design.modules.filter(m=>m.platformId===r.recipientPlatformId).reduce((n,m)=>n+m.nodeCount*8,0);if(a.accelerators!==accelerators)failure('invalid-input','TRANSFER_INVENTORY','Transfer inventory differs from its physical platform.');
    if(a.status==='normal'){if(a.attemptId!==null||a.detectedAtS!==null||a.deadlineS!==null||!a.originalClosed||a.tieClosed)failure('invalid-input','TRANSFER_NORMAL','Normal controller has invalid attempt/switch history.');}
    else{if(a.attemptId!==`${a.id}:attempt-1`||a.detectedAtS===null)failure('invalid-input','TRANSFER_ATTEMPT_ID','Transfer attempt identity missing.');finiteNumber(a.detectedAtS,'transfer detectedAtS',{min:0,max:state.timeS});if(!state.events.some(e=>e.timeS===a.detectedAtS&&[r.originalFeederId,r.receivingBusId,'shore/grid'].includes(e.assetId)&&['trip','maintenance'].includes(e.kind)&&state.appliedEventIds.includes(e.id)))failure('invalid-input','TRANSFER_FAULT_BINDING','Transfer detection requires the actual applied feeder fault.');}
    if(a.status==='waiting'){if(a.deadlineS!==a.detectedAtS!+design.transfer.delayS||a.deadlineS<=state.timeS||a.originalClosed)failure('invalid-input','TRANSFER_DEADLINE','Pending deadline must match the detected fault and policy, with isolation confirmed.');}
    else if(a.deadlineS!==null)failure('invalid-input','TRANSFER_DEADLINE','Only waiting transfers may retain a pending deadline.');
    if(a.tieClosed&&(state.failedAssetIds.includes(r.tieId)||state.failedAssetIds.includes(r.isolatorId)||state.failedAssetIds.includes(r.receivingBusId)||state.failedAssetIds.includes('shore/grid')))failure('invalid-input','TRANSFER_LIVE_FAULT','Closed transfer path contains a failed required device.');
    if(a.bindingResourceId!==null&&typeof a.bindingResourceId!=='string')failure('invalid-input','TRANSFER_RESOURCE','Invalid binding resource.');
    for(const path of [a.originalPath,a.donorPath]){array(path,'transfer path',50);for(const id of path)if(!design.assets.some(asset=>asset.id===id))failure('invalid-input','TRANSFER_PATH','Transfer evidence has an unknown path asset.');}
  }
  array(t.transitions,'transfer transitions',1000);if(typeof t.transitionsTruncated!=='boolean'||t.transitions.length>t.sequence||!t.transitionsTruncated&&t.transitions.length!==t.sequence)failure('invalid-input','TRANSFER_RETENTION','Transfer transition counts/retention disagree.');
  let seq=t.sequence-t.transitions.length,time=-1;
  for(const e of t.transitions){record(e,'transfer transition');if(e.sequence!==++seq||e.transitionId!==`${e.id}:${e.sequence}`||!ids.has(e.id)||!statuses.includes(e.previous)||!statuses.includes(e.status)||!reasons.includes(e.reason))failure('invalid-input','TRANSFER_TRANSITION','Transfer sequence or identity disagrees.');finiteNumber(e.timeS,'transfer transition time',{min:Math.max(0,time),max:state.timeS});time=e.timeS;if(e.tieClosed&&e.originalClosed)failure('invalid-input','TRANSFER_TRANSITION_MESH','Historical transition contains double supply.');}
  record(t.transitionCounts,'transfer counts');let count=0;for(const [reason,n] of Object.entries(t.transitionCounts)){if(!reasons.includes(reason))failure('invalid-input','TRANSFER_REASON','Unknown cumulative reason.');finiteNumber(n,'transfer reason count',{min:0,integer:true});count+=n;}if(count!==t.sequence)failure('invalid-input','TRANSFER_COUNTS','Cumulative transfer count disagrees with sequence.');
  array(t.resources,'transfer resources',200000);const resources=new Set<string>();for(const r of t.resources){record(r,'transfer resource');keys(r,['id','capacityW','nativeW','transferredW','headroomW'],'transfer resource');if(typeof r.id!=='string'||resources.has(r.id))failure('invalid-input','TRANSFER_RESOURCE','Invalid/duplicate transfer resource.');resources.add(r.id);for(const k of ['capacityW','nativeW','transferredW','headroomW'] as const)finiteNumber(r[k],`transfer resource ${k}`,{min:0});if(r.transferredW>Math.max(0,r.capacityW-r.nativeW)+1e-7||Math.abs(r.headroomW-Math.max(0,r.capacityW-r.nativeW-r.transferredW))>1e-7)failure('invalid-input','TRANSFER_OVERSPENT','Transfer resource usage exceeds real headroom.');}
}

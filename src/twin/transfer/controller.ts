import { engineeringIdentity } from '../catalog/equipment';
import { failure, finiteNumber } from '../safety';
import type { Design, SimulationState } from '../types';
import { activePowerDesign, powerPath } from './topology';
import { TRANSFER_POLICY, TRANSFER_TOPOLOGY, type TransferAllocation, type TransferBundle, type TransferResource, type TransferResourceUsage, type TransferState, type TransferAttempt, type TransferStatus, type TransferReason } from './types';
const stable=(a:string,b:string)=>a<b?-1:a>b?1:0;
/** Atomic indivisible admission; input collection order never decides priority. */
export function allocateTransferBundles(resources:TransferResource[],bundles:TransferBundle[]):{allocations:TransferAllocation[];resources:TransferResourceUsage[]} {
  const used=new Map<string,TransferResourceUsage>();
  for(const r of resources){finiteNumber(r.capacityW,'transfer.capacityW',{min:0});finiteNumber(r.nativeW,'transfer.nativeW',{min:0});if(used.has(r.id))failure('invalid-input','TRANSFER_RESOURCE_DUPLICATE','Duplicate transfer resource.');used.set(r.id,{...r,transferredW:0,headroomW:Math.max(0,r.capacityW-r.nativeW)});}
  const ids=new Set<string>();const allocations:TransferAllocation[]=[];
  for(const b of [...bundles].sort((a,b)=>a.priority-b.priority||stable(a.id,b.id))){
    finiteNumber(b.requestedW,'transfer.requestedW',{min:0});finiteNumber(b.priority,'transfer.priority',{min:0,max:1e6,integer:true});if(ids.has(b.id))failure('invalid-input','TRANSFER_BUNDLE_DUPLICATE','Duplicate transfer bundle.');ids.add(b.id);
    if(new Set(b.resourceIds).size!==b.resourceIds.length)failure('invalid-input','TRANSFER_RESOURCE_PATH_DUPLICATE','A transfer bundle must reference each physical resource only once.',{assetId:b.id});
    const path=b.resourceIds.map(id=>{const r=used.get(id);if(!r)failure('invalid-input','TRANSFER_RESOURCE_REFERENCE','Missing transfer resource.',{assetId:id});return r;});
    if(!path.length)failure('invalid-input','TRANSFER_RESOURCE_EMPTY','Transfer requires a complete resource path.');
    const binding=[...path].sort((a,b)=>a.headroomW-b.headroomW||stable(a.id,b.id))[0],headroomW=binding.headroomW,admitted=b.requestedW<=headroomW+1e-7;
    if(admitted)for(const r of path){r.transferredW+=b.requestedW;r.headroomW=Math.max(0,r.capacityW-r.nativeW-r.transferredW);}
    allocations.push({id:b.id,admittedW:admitted?b.requestedW:0,unservedW:admitted?0:b.requestedW,bindingResourceId:admitted?null:binding.id,headroomW});
  }
  return{allocations,resources:[...used.values()].sort((a,b)=>stable(a.id,b.id))};
}
export function initializeTransfer(design:Design):TransferState|undefined {
  if(!design.transfer)return;
  return{version:1,policy:TRANSFER_POLICY,topology:TRANSFER_TOPOLOGY,designIdentity:engineeringIdentity(design),splitTimesS:[],sequence:0,transitions:[],transitionsTruncated:false,transitionCounts:{},resources:[],attempts:design.transfer.routes.map(r=>({id:r.id,attemptId:null,status:'normal',reason:'NORMAL',detectedAtS:null,deadlineS:null,originalClosed:true,tieClosed:false,requestedW:0,accelerators:design.modules.filter(m=>m.platformId===r.recipientPlatformId).reduce((n,m)=>n+m.nodeCount*8,0),originalPath:powerPath(design,r.receivingBusId).assetIds,donorPath:powerPath(design,r.donorBusId).assetIds,admittedW:0,unservedW:0,bindingResourceId:null,headroomW:0}))};
}
export function nextTransferDeadline(state:SimulationState):number {return Math.min(Infinity,...(state.transfer?.attempts.filter(a=>a.status==='waiting'&&a.deadlineS!==null&&a.deadlineS>state.timeS).map(a=>a.deadlineS!)??[]));}
function transition(design:Design,state:SimulationState,a:TransferAttempt,status:TransferStatus,reason:TransferReason){
  const t=state.transfer!,route=design.transfer!.routes.find(r=>r.id===a.id)!,previous=a.status;a.status=status;a.reason=reason;t.sequence++;t.transitionCounts[reason]=(t.transitionCounts[reason]??0)+1;
  t.transitions.push({...structuredClone(a),sequence:t.sequence,transitionId:`${a.id}:${t.sequence}`,timeS:state.timeS,previous,affectedAssetIds:[route.originalFeederId,route.receivingBusId,route.donorBusId,route.tieId,route.isolatorId]});
  if(t.transitions.length>1000){t.transitions.splice(0,t.transitions.length-1000);t.transitionsTruncated=true;}
}
export function transferRefusal(design:Design,state:SimulationState,id:string):TransferReason|null {
  const r=design.transfer!.routes.find(r=>r.id===id)!,failed=new Set(state.failedAssetIds);
  if(!design.transfer!.enabled)return'DISABLED';
  if(failed.has('shore/grid'))return'COMMON_SOURCE_FAILED';
  if(failed.has(r.receivingBusId)||failed.has(r.recipientPlatformId))return'RECEIVING_BUS_FAILED';
  if(failed.has(r.isolatorId))return'ISOLATION_UNCONFIRMED';
  if(failed.has(r.tieId))return'TIE_UNAVAILABLE';
  if(failed.has(r.donorPlatformId))return'DONOR_UNAVAILABLE';
  const donor=powerPath(design,r.donorBusId);
  if(!donor.supported||donor.assetIds.some(id=>failed.has(id)))return'DONOR_UNAVAILABLE';
  // A source switch cannot repair failed receiving distribution/storage or module isolation.
  if(design.modules.some(m=>m.platformId===r.recipientPlatformId&&[m.id,`${m.id}/distribution`,`${m.id}/battery`].some(id=>failed.has(id))))return'DOWNSTREAM_FAILED';
  const original=design.connections.find(e=>e.id===r.originalConnectionId);
  if(!original||!original.enabled||r.tieConnectionIds.some(id=>!design.connections.some(e=>e.id===id)))return'PATH_UNAVAILABLE';
  return null;
}
/** Called after all external inputs at a boundary. The allocator callback uses the proposed active route. */
export function updateTransfer(design:Design,state:SimulationState,allocate:(candidates:TransferAttempt[])=>ReturnType<typeof allocateTransferBundles>,requested:(id:string)=>number) {
  if(!design.transfer||!state.transfer)return;
  const attempts=[...state.transfer.attempts].sort((a,b)=>{const ar=design.transfer!.routes.find(r=>r.id===a.id)!,br=design.transfer!.routes.find(r=>r.id===b.id)!;return ar.priority-br.priority||stable(a.id,b.id);});
  for(const a of attempts){
    a.requestedW=requested(a.id);const route=design.transfer.routes.find(r=>r.id===a.id)!;
    if(a.status==='normal'&&!state.failedAssetIds.includes(route.originalFeederId)&&(state.failedAssetIds.includes(route.receivingBusId)||state.failedAssetIds.includes('shore/grid'))){
      a.attemptId=`${a.id}:attempt-1`;a.detectedAtS=state.timeS;a.unservedW=a.requestedW;transition(design,state,a,'blocked',state.failedAssetIds.includes('shore/grid')?'COMMON_SOURCE_FAILED':'RECEIVING_BUS_FAILED');
    }
    if(a.status==='normal'&&state.failedAssetIds.includes(route.originalFeederId)){
      a.attemptId=`${a.id}:attempt-1`;a.detectedAtS=state.timeS;a.unservedW=a.requestedW;transition(design,state,a,'detected','FEEDER_FAULT');
      if(state.failedAssetIds.includes(route.isolatorId)){transition(design,state,a,'lockout','ISOLATION_UNCONFIRMED');continue;}
      a.originalClosed=false;transition(design,state,a,'isolated','ISOLATION_CONFIRMED');transition(design,state,a,'evaluating','EVALUATING');
      const refusal=transferRefusal(design,state,a.id);if(refusal){transition(design,state,a,'blocked',refusal);continue;}
      a.deadlineS=state.timeS+design.transfer.delayS;transition(design,state,a,'waiting','WAITING');
    }
    if(a.status==='waiting'||a.status==='transferred'){
      const refusal=transferRefusal(design,state,a.id);
      if(refusal){a.tieClosed=false;a.admittedW=0;a.unservedW=a.requestedW;a.deadlineS=null;transition(design,state,a,'lockout',refusal);continue;}
      if(a.status==='waiting'&&!state.failedAssetIds.includes(route.originalFeederId)){a.originalClosed=true;a.deadlineS=null;a.unservedW=0;transition(design,state,a,'blocked','ORIGINAL_RESTORED');}
    }
  }
  const candidates=attempts.filter(a=>a.status==='transferred'||a.status==='waiting'&&a.deadlineS!==null&&a.deadlineS<=state.timeS+1e-9);
  const result=allocate(candidates);state.transfer.resources=result.resources;
  for(const a of candidates){
    Object.assign(a,result.allocations.find(r=>r.id===a.id)!);a.deadlineS=null;
    if(a.unservedW>0){const was=a.status==='transferred';a.tieClosed=false;transition(design,state,a,was?'lockout':'blocked',was?'CAPACITY_SHED':a.headroomW<=1e-7?'NO_HEADROOM':'INSUFFICIENT_HEADROOM');}
    else if(a.status!=='transferred'){
      if(a.originalClosed)failure('numerical-failure','TRANSFER_DOUBLE_SUPPLY','Original source must be confirmed isolated before tie closure.');
      a.tieClosed=true;transition(design,state,a,'transferred','TRANSFERRED');
    }
  }
  for(const a of attempts)if(a.tieClosed&&a.originalClosed)failure('numerical-failure','TRANSFER_DOUBLE_SUPPLY','Transfer interlock invariant violated.');
  const active=activePowerDesign(design,state);
  for(const r of design.transfer.routes)if(state.transfer.attempts.find(a=>a.id===r.id)!.tieClosed&&!powerPath(active,r.receivingBusId).supported)failure('numerical-failure','TRANSFER_RADIAL','Closed transfer path must remain radial.');
}

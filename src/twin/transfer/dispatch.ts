import type { Design, SimulationState } from '../types';
import type { TransferAttempt } from './types';
import { allocateTransferBundles } from './controller';
import { activePowerDesign, powerPath, powerResources } from './topology';
export interface RestorableDemand { id:string; platformId:string; domainId:string; requestedW:number; moduleLimitW:number }
function networkDemand(design:Design,platformId:string):number {const n=design.assets.find(a=>a.id===`${platformId}/cluster`);return design.equipment?.networkDesign&&n?n.ratings.capacityW/powerPath(design,design.modules.find(m=>m.platformId===platformId)!.powerDomainId).efficiency:0;}
export function restorationRequestedW(design:Design,demands:RestorableDemand[],routeId:string):number {const r=design.transfer!.routes.find(r=>r.id===routeId)!;return demands.filter(d=>d.platformId===r.recipientPlatformId).reduce((n,d)=>n+d.requestedW,0)+networkDemand(design,r.recipientPlatformId);}
/** Reserve complete native required loads, then atomically admit proposed whole recipients. */
export function planTransfers(design:Design,state:SimulationState,demands:RestorableDemand[],candidates:TransferAttempt[]) {
  const proposed=structuredClone(state.transfer!);for(const a of proposed.attempts)if(candidates.some(c=>c.id===a.id)){a.originalClosed=false;a.tieClosed=true;}
  const active=activePowerDesign(design,{transfer:proposed}),resources=powerResources(active),map=new Map(resources.map(r=>[r.id,r])),failed=new Set(state.failedAssetIds);
  const recipientPlatforms=new Set(candidates.map(a=>design.transfer!.routes.find(r=>r.id===a.id)!.recipientPlatformId));
  const reserve=(path:string[],w:number)=>{for(const id of path){const r=map.get(id);if(r)r.nativeW+=w;}};
  for(const d of demands){if(recipientPlatforms.has(d.platformId))continue;const path=powerPath(active,d.domainId);if(path.supported&&!path.assetIds.some(id=>failed.has(id))&&!failed.has(d.platformId)&&!failed.has(d.id))reserve(path.resourceIds,Math.min(d.requestedW,d.moduleLimitW));}
  if(design.equipment?.networkDesign){
    const core=design.assets.find(a=>a.id==='shore/cluster-core')!;if(!failed.has(core.id)&&!failed.has('shore/grid'))reserve(['asset:shore/grid'],core.ratings.capacityW);
    for(const pid of new Set(design.modules.map(m=>m.platformId))){if(recipientPlatforms.has(pid)||failed.has(`${pid}/cluster`)||failed.has(pid))continue;const path=powerPath(active,design.modules.find(m=>m.platformId===pid)!.powerDomainId);if(path.supported&&!path.assetIds.some(id=>failed.has(id)))reserve(path.resourceIds,networkDemand(active,pid));}
  }
  const bundles=candidates.map(a=>{
    const r=design.transfer!.routes.find(r=>r.id===a.id)!,path=powerPath(active,r.receivingBusId),requestedW=restorationRequestedW(active,demands,a.id),local=demands.filter(d=>d.platformId===r.recipientPlatformId),localLimit=Math.min(...local.map(d=>d.requestedW>0?d.moduleLimitW/d.requestedW*requestedW:Infinity));
    const moduleResource={id:`bundle:${a.id}:module-distribution`,capacityW:Number.isFinite(localLimit)?localLimit:design.config.supplyW,nativeW:0};resources.push(moduleResource);
    return{id:a.id,priority:r.priority,requestedW,resourceIds:[...path.resourceIds,moduleResource.id]};
  });
  return allocateTransferBundles(resources,bundles);
}
/** Dispatch all active physical loads once. Native and network requirements precede transferred modules and charging. */
export function allocateActiveGrid(design:Design,state:SimulationState,demands:(RestorableDemand&{gridLive:boolean;maxChargeW:number})[],networkAllocations:{assetId:string;gridW:number;domainId:string}[]):number[] {
  const resources=powerResources(design),map=new Map(resources.map(r=>[r.id,r.capacityW])),spent=new Map<string,number>(),paths=demands.map(d=>powerPath(design,d.domainId).resourceIds),grid=demands.map(()=>0);
  const spend=(ids:string[],w:number)=>{for(const id of ids)spent.set(id,(spent.get(id)??0)+w);};
  const headroom=(ids:string[])=>Math.max(0,Math.min(...ids.map(id=>(map.get(id)??0)-(spent.get(id)??0))));
  for(const n of networkAllocations){if(n.gridW===0)continue;const path=n.assetId==='shore/cluster-core'?['asset:shore/grid']:powerPath(design,design.modules.find(m=>m.platformId===n.assetId.split('/')[0])!.powerDomainId).resourceIds;spend(path,n.gridW);}
  const transferred=new Map(design.transfer!.routes.map(r=>[r.recipientPlatformId,state.transfer!.attempts.find(a=>a.id===r.id)]));
  const order=demands.map((d,i)=>({d,i})).sort((a,b)=>Number(transferred.get(a.d.platformId)?.tieClosed??false)-Number(transferred.get(b.d.platformId)?.tieClosed??false)||a.d.id.localeCompare(b.d.id));
  for(const {d,i} of order){if(!d.gridLive)continue;grid[i]=Math.min(d.requestedW,d.moduleLimitW,headroom(paths[i]));spend(paths[i],grid[i]);}
  for(const {d,i} of order){if(!d.gridLive)continue;const charge=Math.min(d.maxChargeW,Math.max(0,d.moduleLimitW-grid[i]),headroom(paths[i]));grid[i]+=charge;spend(paths[i],charge);}
  return grid;
}

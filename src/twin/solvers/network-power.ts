import type { Design } from '../types';
import { finiteNumber } from '../safety';

export interface NetworkPowerAllocation { assetId:string; requestedW:number; suppliedW:number; gridW:number; domainId:string; dependencyIds:string[]; available:boolean }
export interface NetworkPowerAssessment { allocations:NetworkPowerAllocation[]; gridW:number; domainGridW:Map<string,number>; unavailableAssetIds:string[] }
/** Root switches have no UPS: fixed critical loads are served before module/charging requests. */
export function createNetworkPowerEvaluator(design:Design) {
  const assets=new Map(design.assets.map(a=>[a.id,a]));
  const loads=design.equipment?.networkDesign?design.assets.filter(a=>a.type==='network').sort((a,b)=>a.id==='shore/cluster-core'?-1:b.id==='shore/cluster-core'?1:a.id.localeCompare(b.id)).map(asset=>{
    const dependencies:string[]=[asset.id,...(asset.parentId?[asset.parentId]:[])],resources:{id:string;capacity:number;factor:number}[]=[];
    let id=asset.id,efficiency=1,supported=true,domainId='shore/grid';
    const visited=new Set<string>();
    while(id!=='shore/grid'){
      if(visited.has(id)){supported=false;break;}visited.add(id);
      const edges=design.connections.filter(e=>e.medium==='power'&&e.to===id&&e.enabled);
      if(edges.length!==1){supported=false;break;}
      const edge=edges[0],source=assets.get(edge.from),target=assets.get(edge.to);
      if(!source||!target){supported=false;break;}
      const output=source.ports.find(p=>p.id===edge.fromPort),input=target.ports.find(p=>p.id===edge.toPort);
      if(!output||!input||output.medium!=='power'||input.medium!=='power'||output.direction==='in'||input.direction==='out'){supported=false;break;}
      if(target.type==='transformer')efficiency*=target.ratings.efficiency;
      for(const [resourceId,capacity] of [[`edge:${edge.id}`,edge.capacity],[`port:${source.id}:${output.id}`,output.capacity],[`port:${target.id}:${input.id}`,input.capacity]] as const){finiteNumber(capacity,'network power capacity',{min:0,unit:'W'});resources.push({id:resourceId,capacity,factor:1/efficiency});}
      dependencies.push(source.id);id=source.id;
      if(design.modules.some(m=>m.powerDomainId===id))domainId=id;
    }
    finiteNumber(asset.ratings.capacityW,'network power draw',{min:0,unit:'W'});finiteNumber(efficiency,'network power conversion efficiency',{min:Number.MIN_VALUE,max:1});
    return {asset,dependencies,resources,supported,domainId,efficiency};
  }):[];
  return (failedAssetIds:readonly string[]=[]):NetworkPowerAssessment=>{
    const failed=new Set(failedAssetIds),spent=new Map<string,number>(),domainGridW=new Map<string,number>();let gridW=0;
    const allocations=loads.map(load=>{
      const requestedW=load.asset.ratings.capacityW,sourceW=requestedW/load.efficiency;
      const available=load.supported&&!load.dependencies.some(id=>failed.has(id))&&gridW+sourceW<=design.config.supplyW+1e-7&&load.resources.every(r=>(spent.get(r.id)??0)+requestedW*r.factor<=r.capacity+1e-7);
      if(available){gridW+=sourceW;for(const r of load.resources)spent.set(r.id,(spent.get(r.id)??0)+requestedW*r.factor);if(load.domainId!=='shore/grid')domainGridW.set(load.domainId,(domainGridW.get(load.domainId)??0)+sourceW);}
      return {assetId:load.asset.id,requestedW,suppliedW:available?requestedW:0,gridW:available?sourceW:0,domainId:load.domainId,dependencyIds:load.dependencies,available};
    });
    return {allocations,gridW,domainGridW,unavailableAssetIds:allocations.filter(a=>!a.available).map(a=>a.assetId)};
  };
}
export function assessNetworkPower(design:Design,failedAssetIds:readonly string[]=[]):NetworkPowerAssessment { return createNetworkPowerEvaluator(design)(failedAssetIds); }

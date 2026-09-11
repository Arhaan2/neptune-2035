import type { Design, SimulationState } from '../types';
import type { PowerPath, TransferResource } from './types';
/** A solver projection changes connection positions only; installed assets retain ownership and IDs. */
export function activePowerDesign(design:Design,state:Pick<SimulationState,'transfer'>):Design {
  if(!design.transfer||!state.transfer)return design;
  const positions=new Map<string,boolean>();
  for(const route of design.transfer.routes){const a=state.transfer.attempts.find(a=>a.id===route.id);if(!a)continue;positions.set(route.originalConnectionId,a.originalClosed);for(const id of route.tieConnectionIds)positions.set(id,a.tieClosed);}
  return {...design,connections:design.connections.map(e=>positions.has(e.id)?{...e,enabled:positions.get(e.id)!}:e)};
}
export function powerPath(design:Design,startId:string):PowerPath {
  const assetIds:string[]=[],resourceIds:string[]=[];let id=startId,efficiency=1;
  const assets=new Map(design.assets.map(a=>[a.id,a]));
  while(true){
    if(assetIds.includes(id))return{assetIds,resourceIds,supported:false,efficiency};
    assetIds.push(id);const asset=assets.get(id);if(!asset)return{assetIds,resourceIds,supported:false,efficiency};
    resourceIds.push(`asset:${id}`);if(asset.type==='transformer')efficiency*=asset.ratings.efficiency;
    if(id==='shore/grid')return{assetIds,resourceIds,supported:true,efficiency};
    const edges=design.connections.filter(e=>e.medium==='power'&&e.enabled&&e.to===id);
    if(edges.length!==1)return{assetIds,resourceIds,supported:false,efficiency};
    const edge=edges[0];resourceIds.push(`edge:${edge.id}`,`port:${edge.from}:${edge.fromPort}`,`port:${edge.to}:${edge.toPort}`);id=edge.from;
  }
}
/** Power ratings are input/source-equivalent limits; this conservatively includes downstream conversion losses. */
export function powerResources(design:Design):TransferResource[] {
  const values=new Map<string,number>();
  for(const a of design.assets){values.set(`asset:${a.id}`,a.id==='shore/grid'?design.config.supplyW:a.ratings.capacityW??design.config.supplyW);for(const p of a.ports.filter(p=>p.medium==='power'))values.set(`port:${a.id}:${p.id}`,p.capacity);}
  for(const e of design.connections.filter(e=>e.medium==='power'))values.set(`edge:${e.id}`,e.capacity);
  return [...values].map(([id,capacityW])=>({id,capacityW,nativeW:0}));
}

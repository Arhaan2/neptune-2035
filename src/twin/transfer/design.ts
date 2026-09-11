import { buildDesign, DEFAULT_CONFIG, withNetworkPreset } from '../assets/design';
import { catalogSpecification, engineeringIdentity, equipmentFor } from '../catalog/equipment';
import { failure, finiteNumber } from '../safety';
import type { Asset, Connection, Design } from '../types';
import { array, keys, record } from '../persistence/structure';
import { powerPath } from './topology';
import { TRANSFER_POLICY, TRANSFER_TOPOLOGY, type TransferRoute } from './types';
function switchAsset(design:Design,id:string,parentId:string,catalogId:string):Asset {
  const s=catalogSpecification(catalogId),parent=design.assets.find(a=>a.id===parentId)!;
  return{id,type:'switchboard',name:s.name,parentId,catalogId:s.id,revision:s.version,dimensionsM:[...s.dimensionsM!],positionM:[...parent.positionM],operationalMassKg:s.operationalMassKg,ratings:{...s.ratings},ports:['in','out'].map(direction=>({id:`power-${direction}`,medium:'power',direction:direction as 'in'|'out',capacity:s.ratings.capacityW,unit:'W'})),failureDomain:parentId,provenance:[s.source]};
}
function edge(from:Asset,to:Asset,enabled=true):Connection {return{id:`${from.id}>${to.id}:power`,from:from.id,to:to.id,fromPort:'power-out',toPort:'power-in',medium:'power',capacity:Math.min(from.ratings.capacityW,to.ratings.capacityW),enabled,routeM:[[...from.positionM],[...to.positionM]],allowanceM:0};}
/** Explicit migration. Default first platform donates to every other platform; relationships are persisted. */
export function withTransferPreset(input:Design,options:{enabled?:boolean;delayS?:number;donorPlatformId?:string;recipientPlatformIds?:string[]}={}):Design {
  if(input.config.generation!==3||input.transfer)failure('unsupported-configuration','TRANSFER_PRESET','Transfer preset requires a non-transferring Generation III design.');
  const design=structuredClone(input),equipment=equipmentFor(design);design.equipment=equipment;
  for(const id of ['transfer-tie-reference','transfer-isolator-reference','transfer-bus-reference']){const s=catalogSpecification(id);if(!equipment.specifications.some(x=>x.id===id))equipment.specifications.push(structuredClone(s));equipment.economics.specificationUnitUSD[`${id}@1.0.0`]=id==='transfer-tie-reference'?50_000:id==='transfer-isolator-reference'?20_000:10_000;}
  const platforms=design.assets.filter(a=>a.type==='platform').map(a=>a.id).sort(),donor=options.donorPlatformId??platforms[0],recipients=options.recipientPlatformIds??platforms.filter(id=>id!==donor);
  if(!platforms.includes(donor)||!recipients.length||recipients.some(id=>!platforms.includes(id)||id===donor)||new Set(recipients).size!==recipients.length)failure('invalid-input','TRANSFER_PLATFORMS','Transfer requires a known donor and distinct recipient platforms.');
  design.connections=design.connections.filter(e=>e.medium!=='power'||e.enabled);const routes:TransferRoute[]=[];
  for(const [priority,pid] of [...recipients].sort().entries()){
    const original=design.assets.find(a=>a.id===design.modules.find(m=>m.platformId===pid)!.powerDomainId)!,donorBus=design.assets.find(a=>a.id===design.modules.find(m=>m.platformId===donor)!.powerDomainId)!;
    const bus=switchAsset(design,`${pid}/receiving-bus`,pid,'transfer-bus-reference'),isolator=switchAsset(design,`${pid}/transfer-isolator`,pid,'transfer-isolator-reference'),tie=switchAsset(design,`${pid}/transfer-tie`,pid,'transfer-tie-reference');
    design.assets.push(bus,isolator,tie);
    const originalEdge=edge(isolator,bus),tieEdges=[edge(donorBus,tie,false),edge(tie,bus,false)];
    design.connections=design.connections.map(e=>e.medium==='power'&&e.from===original.id&&design.assets.find(a=>a.id===e.to)?.type==='network'?{...e,from:bus.id,id:`${bus.id}>${e.to}:power`}:e);
    design.connections.push(edge(original,isolator),originalEdge,...tieEdges);
    design.modules=design.modules.map(m=>m.platformId===pid?{...m,powerDomainId:bus.id}:m);
    routes.push({id:`${pid}:transfer`,recipientPlatformId:pid,donorPlatformId:donor,originalFeederId:original.id,receivingBusId:bus.id,donorBusId:donorBus.id,isolatorId:isolator.id,tieId:tie.id,originalConnectionId:originalEdge.id,tieConnectionIds:tieEdges.map(e=>e.id),priority});
  }
  design.transfer={version:1,preset:'platform-transfer-reference',policy:TRANSFER_POLICY,topology:TRANSFER_TOPOLOGY,enabled:options.enabled??true,delayS:options.delayS??2.375,routes};
  if(!design.sourceIds.includes('transfer-reference-v1'))design.sourceIds.push('transfer-reference-v1');
  validateTransferDesign(design);design.revision=`transfer-v1-${engineeringIdentity(design)}`;return design;
}
export function validateTransferDesign(design:Design):void {
  const t=design.transfer;if(!t)return;record(t,'transfer');keys(t,['version','preset','policy','topology','enabled','delayS','routes'],'transfer');
  if(t.version!==1||t.preset!=='platform-transfer-reference'||t.policy!==TRANSFER_POLICY||t.topology!==TRANSFER_TOPOLOGY||design.config.generation!==3)failure('unsupported-configuration','TRANSFER_VERSION','Unsupported transfer design/policy/topology version.');
  if(typeof t.enabled!=='boolean')failure('invalid-input','TRANSFER_ENABLED','Transfer enabled must be boolean.');finiteNumber(t.delayS,'transfer.delayS',{min:0,max:60});if(!Number.isInteger(t.delayS/0.125))failure('unsupported-configuration','TRANSFER_DELAY_GRID','Transfer delay must be a multiple of 0.125 s.');
  array(t.routes,'transfer.routes',256);if(!t.routes.length)failure('invalid-input','TRANSFER_ROUTES','Transfer requires at least one recipient.');
  const recipients=new Set<string>(),ids=new Set<string>(),assets=new Map(design.assets.map(a=>[a.id,a]));
  for(const r of t.routes){record(r,'transfer route');keys(r,['id','recipientPlatformId','donorPlatformId','originalFeederId','receivingBusId','donorBusId','isolatorId','tieId','originalConnectionId','tieConnectionIds','priority'],'transfer route');
    if(typeof r.id!=='string'||r.id.length>180||ids.has(r.id)||recipients.has(r.recipientPlatformId))failure('invalid-input','TRANSFER_ROUTE_DUPLICATE','Transfer route IDs and recipients must be unique.');ids.add(r.id);recipients.add(r.recipientPlatformId);
    finiteNumber(r.priority,'transfer.priority',{min:0,max:1e6,integer:true});
    for(const id of [r.recipientPlatformId,r.donorPlatformId,r.originalFeederId,r.receivingBusId,r.donorBusId,r.isolatorId,r.tieId])if(!assets.has(id))failure('invalid-input','TRANSFER_REFERENCE','Unknown transfer asset.',{assetId:id});
    const equipmentIds=[r.originalFeederId,r.receivingBusId,r.donorBusId,r.isolatorId,r.tieId];
    if(new Set(equipmentIds).size!==equipmentIds.length||equipmentIds.some(id=>assets.get(id)!.type!=='switchboard'))failure('invalid-input','TRANSFER_EQUIPMENT_ROLE','Transfer feeder, buses, isolator and tie must be distinct electrical switching assets.');
    for(const [id,catalogId] of [[r.receivingBusId,'transfer-bus-reference'],[r.isolatorId,'transfer-isolator-reference'],[r.tieId,'transfer-tie-reference']])if(assets.get(id)!.catalogId!==catalogId)failure('invalid-input','TRANSFER_EQUIPMENT_ROLE','Transfer equipment must retain its declared hardware role.',{assetId:id});
    if(r.recipientPlatformId===r.donorPlatformId||assets.get(r.recipientPlatformId)!.type!=='platform'||assets.get(r.donorPlatformId)!.type!=='platform')failure('unsupported-configuration','TRANSFER_PLATFORM','Donor and recipient must be distinct physical platforms.');
    for(const id of [r.originalFeederId,r.receivingBusId,r.isolatorId,r.tieId])if(assets.get(id)!.parentId!==r.recipientPlatformId)failure('invalid-input','TRANSFER_OWNERSHIP','Recipient equipment must retain its physical owner.');
    if(assets.get(r.donorBusId)!.parentId!==r.donorPlatformId||design.modules.some(m=>m.platformId===r.recipientPlatformId&&m.powerDomainId!==r.receivingBusId))failure('invalid-input','TRANSFER_DOMAIN','Transfer domains disagree with physical modules.');
    const original=design.connections.find(e=>e.id===r.originalConnectionId);array(r.tieConnectionIds,'tie connections',2);
    if(!original||original.medium!=='power'||original.from!==r.isolatorId||original.to!==r.receivingBusId||!original.enabled||r.tieConnectionIds.length!==2)failure('invalid-input','TRANSFER_CONNECTION','Invalid original isolation connection.');
    const feederConnections=design.connections.filter(e=>e.medium==='power'&&e.enabled&&e.to===r.isolatorId);
    if(feederConnections.length!==1||feederConnections[0].from!==r.originalFeederId)failure('invalid-input','TRANSFER_FEEDER_CONNECTION','The declared original feeder must supply the isolator directly through its sole energized input.');
    for(const [i,id] of r.tieConnectionIds.entries()){const e=design.connections.find(e=>e.id===id);if(!e||e.medium!=='power'||e.enabled||e.from!==(i===0?r.donorBusId:r.tieId)||e.to!==(i===0?r.tieId:r.receivingBusId))failure('unsupported-configuration','TRANSFER_TIE_TOPOLOGY','Transfer ties must have the declared normally-open donor/tie/bus route.');}
    for(const id of [r.receivingBusId,r.donorBusId])if(!powerPath(design,id).supported)failure('unsupported-configuration','TRANSFER_RADIAL','Transfer requires single-supply radial original and donor paths.');
  }
  for(const r of t.routes)if(recipients.has(r.donorPlatformId))failure('unsupported-configuration','TRANSFER_CHAIN','Donors cannot themselves be recipients; chained/meshed transfer is unsupported.');
  for(const m of design.modules)if(!powerPath(design,m.powerDomainId).supported)failure('unsupported-configuration','TRANSFER_RADIAL','Every electrical domain must have a radial native supply.');
}
/** Three separately switched, sparsely populated platforms for fast real-engine demonstrations. */
export function createTransferReferenceDesign(generation:2|3=3,options:{enabled?:boolean;delayS?:number;representative?:boolean}={}):Design {
  let design=withNetworkPreset(buildDesign({...DEFAULT_CONFIG,generation,requestedAccelerators:10248,supplyW:30e6,batteryWhPerModule:0,batteryMaxWPerModule:0,workload:0.8,requireExternalNetwork:true}),'scalable-reference');
  if(!options.representative){
    const modules=design.modules.filter((m,i,all)=>all.findIndex(x=>x.platformId===m.platformId)===i).map(m=>({...m,nodeCount:1,rackCount:1})),ids=new Set(modules.map(m=>m.id));
    design={...design,modules,assets:design.assets.filter(a=>a.type!=='module'||ids.has(a.id)).map(a=>a.type==='module'?{...a,ratings:{...a.ratings,nodeCount:1,rackCount:1}}:a),nodeCount:3,rackCount:3,provisionedAccelerators:24,installedPeakITW:36_000,config:{...design.config,requestedAccelerators:24}};
  }
  design.revision=`phase5-reference-${engineeringIdentity(design)}`;
  return generation===3?withTransferPreset(design,options):design;
}

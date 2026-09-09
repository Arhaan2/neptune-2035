import { HARDWARE as H } from '../catalog/reference';
import type { Asset, AssetType, Connection, Design, DesignConfig, Medium, ModuleSpec, Vec3 } from '../types';
import { failure, finiteNumber, finiteOutputs } from '../safety';

export const DEFAULT_CONFIG: DesignConfig = {
  schemaVersion: 2, generation: 1, requestedAccelerators: 10_000, supplyW: 30e6,
  standbyPumps: 1, seawaterK: 291.15, workload: 0.8, idleFraction: 0.3,
  exchangerUAWPerK: 350_000, foulingResistanceKPerW: 0, batteryWhPerModule: 400_000,
  batteryMaxWPerModule: 2_200_000, pumpSpeed: 1,
  requireExternalNetwork: false, requireClusterNetwork: true, budgetUSD: null,
};
export function validateConfig(raw: unknown): DesignConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Design must be an object.');
  const v = raw as Record<string, unknown>;
  if (v.schemaVersion !== 2) throw Error('Unsupported design schema. Legacy PUE scenarios must open in Legacy mode.');
  const bounds: Record<string, [number, number]> = { generation:[1,3], requestedAccelerators:[8,1_000_000], supplyW:[0,10e9], standbyPumps:[0,1], seawaterK:[275.15,311.15], workload:[0,1], idleFraction:[0.1,0.8], exchangerUAWPerK:[10_000,2e6], foulingResistanceKPerW:[0,0.0001], batteryWhPerModule:[0,2e6], batteryMaxWPerModule:[0,5e6], pumpSpeed:[0,1.2] };
  for (const [k,[min,max]] of Object.entries(bounds)) if (typeof v[k] !== 'number' || !Number.isFinite(v[k]) || v[k] < min || v[k] > max) throw Error(`${k} must be finite within ${min}–${max}.`);
  for (const k of ['generation','requestedAccelerators','standbyPumps']) if (!Number.isInteger(v[k])) throw Error(`${k} must be an integer.`);
  for (const k of ['requireExternalNetwork','requireClusterNetwork']) if (typeof v[k] !== 'boolean') throw Error(`${k} must be true or false.`);
  if (v.budgetUSD !== null && (typeof v.budgetUSD !== 'number' || !Number.isFinite(v.budgetUSD) || v.budgetUSD < 0 || v.budgetUSD > 1e13)) throw Error('Budget must be null or a finite nonnegative USD amount.');
  return Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(k=>[k,v[k]])) as unknown as DesignConfig;
}
export function revisionFor(config: DesignConfig) {
  let hash = 2166136261;
  for (const c of JSON.stringify(config)) hash = Math.imul(hash ^ c.charCodeAt(0),16777619) >>> 0;
  return `reference-v2-${hash.toString(16).padStart(8,'0')}`;
}
const pad = (n:number,w=2)=>String(n).padStart(w,'0');
function asset(id:string,type:AssetType,parentId:string|null,positionM:Vec3,dimensionsM:Vec3,mass:number|null,ratings:Record<string,number>={},failureDomain=parentId??id):Asset {
  const media:Medium[] = type==='pump'||type==='valve'||type==='pipe'? [id.includes('sea')?'seawater':'technical'] : type==='exchanger'?['technical','seawater']:['cdu','rack','compute'].includes(type)?['technical']:[];
  if (['pump','cdu','rack','compute','battery','transformer','switchboard','network','external'].includes(type)) media.push(type==='external'&&id.includes('fiber')?'external-network':'power');
  if (type==='network'||type==='compute'||type==='rack') media.push('cluster');
  if (type==='network') media.push('external-network');
  return {id,type,name:id.split('/').at(-1)!.replaceAll('-',' '),parentId,catalogId:type==='compute'?'generic-hardware-v2':type==='platform'||type==='hull'||type==='module'?'layout-v2':'equipment-v2',revision:'2.0.0',dimensionsM,positionM,operationalMassKg:mass,ratings,failureDomain,provenance:[type==='compute'?'generic-hardware-v2':'equipment-v2'],ports:[...new Set(media)].flatMap(medium=>['in','out'].map(direction=>({id:`${medium}-${direction}`,medium,direction:direction as 'in'|'out',capacity:medium==='power'?(ratings.capacityW??1e9):medium.includes('network')||medium==='cluster'?400e9:0.3,unit:medium==='power'?'W':medium.includes('network')||medium==='cluster'?'bit/s':'m³/s'})))};
}
function connect(a:Asset,b:Asset,medium:Medium,capacity:number,allowanceM=0):Connection {
  const [x,y,z]=a.positionM,[xx,yy,zz]=b.positionM;
  return {id:`${a.id}>${b.id}:${medium}`,from:a.id,to:b.id,fromPort:`${medium}-out`,toPort:`${medium}-in`,medium,capacity:Math.min(capacity,a.ports.find(p=>p.id===`${medium}-out`)?.capacity??capacity,b.ports.find(p=>p.id===`${medium}-in`)?.capacity??capacity),enabled:true,routeM:[[x,y,z],[xx,y,z],[xx,yy,z],[xx,yy,zz]],allowanceM};
}
export function buildDesign(input:DesignConfig):Design {
  const config=validateConfig(input), nodeCount=Math.ceil(config.requestedAccelerators/H.acceleratorsPerNode),rackCount=Math.ceil(nodeCount/H.nodesPerRack);
  const moduleCount=Math.ceil(rackCount/H.racksPerModule),platformCount=Math.ceil(moduleCount/H.modulesPerPlatform);
  const assets:Asset[]=[],connections:Connection[]=[],modules:ModuleSpec[]=[];
  const grid=asset('shore/grid','external',null,[-65,3,0],[4,5,8],null,{capacityW:config.supplyW},'shore/grid');
  const fiber=asset('shore/fiber','external',null,[-65,3,12],[2,2,2],null,{},'shore/fiber');
  const clusterCore=asset('shore/cluster-core','network',null,[-58,3,16],[2,2,2],null,{capacityBitS:400e9,capacityW:3000},'shore/cluster-core');
  assets.push(grid,fiber,clusterCore);
  const columnCount=config.generation===1?platformCount:Math.ceil(Math.sqrt(platformCount));
  let central:Asset|undefined;
  if(config.generation===1){
    const tx=asset('shore/transformer','transformer',null,[-55,3,-8],[4,4,6],null,{capacityW:config.supplyW,efficiency:0.98},'shore/bus');
    central=asset('shore/bus','switchboard',null,[-50,3,0],[3,3,5],null,{capacityW:config.supplyW},'shore/bus');
    assets.push(tx,central);connections.push(connect(grid,tx,'power',config.supplyW),connect(tx,central,'power',config.supplyW));
  }
  for(let p=0;p<platformCount;p++){
    const pid=`platform-${pad(p+1,3)}`;
    const x=(p%columnCount)*70, z=Math.floor(p/columnCount)*42+(config.generation===3?Math.floor((p%columnCount)/2)*12:0);
    const platform=asset(pid,'platform',null,[x,1.6,z],[58,0.8,28],200_000,{deckLimitKgM2:2500});assets.push(platform);
    assets.push(asset(`${pid}/hull-port`,'hull',pid,[x,-0.9,z-10],[58,5,6],180_000,{depthM:5}),asset(`${pid}/hull-starboard`,'hull',pid,[x,-0.9,z+10],[58,5,6],180_000,{depthM:5}));
    const powerId=config.generation===1?'shore/bus':config.generation===2?`${pid}/switchboard`:`${pid}/segment-feeder`;
    if(!central){
      const tx=asset(`${pid}/transformer`,'transformer',pid,[x-27,3,z],[3,3,4],8000,{capacityW:8.8e6,efficiency:0.98},powerId);
      const bus=asset(powerId,'switchboard',pid,[x+27,3,z],[2,2,4],1800,{capacityW:8.8e6},powerId);
      assets.push(tx,bus);connections.push(connect(grid,tx,'power',8.8e6,8),connect(tx,bus,'power',8.8e6,4));
      if(config.generation===3&&p%2===1){
        const prior=assets.find(a=>a.id===`platform-${pad(p,3)}/segment-feeder`)!;
        connections.push({...connect(prior,bus,'power',2.2e6,10),enabled:false});
      }
    }
    const net=asset(`${pid}/cluster`,'network',pid,[x,3,z+13],[2,2,1],600,{capacityBitS:400e9},`${pid}/cluster`);
    assets.push(net);connections.push(connect(fiber,net,'external-network',100e9,10),connect(clusterCore,net,'cluster',400e9,10));
    for(let j=0;j<4&&modules.length<moduleCount;j++){
      const mindex=modules.length,mid=`${pid}/module-${pad(j+1)}`, n=Math.min(160,nodeCount-mindex*160);
      const positionM:Vec3=[x+(j%2===0?-13:13),4,z+(j<2?-6:6)];
      const m:ModuleSpec={id:mid,platformId:pid,powerDomainId:powerId,networkDomainId:net.id,nodeCount:n,rackCount:Math.ceil(n/4),positionM};modules.push(m);
      assets.push(asset(mid,'module',pid,[...positionM],[24,4,10],50_000,{nodeCount:n,rackCount:m.rackCount,capacityW:1.92e6},powerId));
    }
  }
  const design:Design={schemaVersion:2,revision:revisionFor(config),config,assets,connections,modules,nodeCount,rackCount,provisionedAccelerators:nodeCount*8,installedPeakITW:nodeCount*H.nodePeakW,sourceIds:['generic-hardware-v2','layout-v2','equipment-v2','entu','seawater']};
  // Water surface is y=0. Float each complete inventory using its true two-pontoon waterplane.
  // Pipe water mass depends weakly on intake lift; four fixed-point updates resolve that geometry coupling.
  for(let iteration=0;iteration<4;iteration++){
    const masses=new Map<string,number>();
    for(const a of allAssets(design))if(a.id.startsWith('platform-')){const p=a.id.split('/')[0];masses.set(p,(masses.get(p)??0)+(a.operationalMassKg??0));}
    for(const [pid,mass] of masses){
      const hulls=assets.filter(a=>a.parentId===pid&&a.type==='hull');
      const area=hulls.reduce((s,a)=>s+a.dimensionsM[0]*a.dimensionsM[2],0),draft=mass/(1025*area);
      const delta=-draft-(hulls[0].positionM[1]-hulls[0].dimensionsM[1]/2);
      for(const a of assets)if(a.id===pid||a.id.startsWith(`${pid}/`))a.positionM[1]+=delta;
      for(const m of modules)if(m.platformId===pid)m.positionM[1]+=delta;
    }
  }
  for(const edge of connections){const a=assets.find(a=>a.id===edge.from)!,b=assets.find(a=>a.id===edge.to)!;edge.routeM=connect(a,b,edge.medium,edge.capacity,edge.allowanceM).routeM;}
  return design;
}
export function moduleAssets(design:Design,moduleId:string):Asset[]{
  const m=design.modules.find(m=>m.id===moduleId);if(!m)return[];
  const [x,,z]=m.positionM, id=m.id,dy=m.positionM[1]-4;
  const a=(suffix:string,t:AssetType,offset:Vec3,size:Vec3,mass:number|null,ratings:Record<string,number>={})=>asset(`${id}/${suffix}`,t,id,[x+offset[0],offset[1]+dy,z+offset[2]],size,mass,ratings,m.powerDomainId);
  const support=[
    a('pump-duty','pump',[9,2.6,-3.5],[1.2,1.2,0.8],180,{capacityW:45_000,shutoffPa:250_000,freeFlowM3S:0.1,efficiency:0.72}),
    a('pump-sea','pump',[10.5,2.6,-3.5],[1.2,1.2,0.8],180,{capacityW:45_000,shutoffPa:250_000,freeFlowM3S:0.1,efficiency:0.72}),
    a('hx','exchanger',[10,3.1,1.5],[2,2.2,1.4],1800,{UAWPerK:design.config.exchangerUAWPerK}),
    a('cdu','cdu',[9,3,-1.5],[1.2,2,1.1],500,{capacityW:3000}),
    a('valve-tech','valve',[8,2.3,-1.5],[0.3,0.4,0.3],15,{opening:1}),
    a('valve-sea','valve',[11,2.3,-1.5],[0.3,0.4,0.3],15,{opening:1}),
    a('pipe-tech','pipe',[-0.5,2.2,0],[19.18,0.18,9.18],400+(routeLengthM(loopRouteM(m))+loopGeometry(design,m).rackBranchesM)*Math.PI*0.09**2*997,{diameterM:0.18,lengthM:loopGeometry(design,m).technicalLengthM,roughnessM:0.000045}),
    a('pipe-sea','pipe',[11.4,2.2,0],[0.18,0.18,8],120+loopGeometry(design,m).seawaterLengthM*Math.PI*0.09**2*1025,{diameterM:0.18,lengthM:loopGeometry(design,m).seawaterLengthM,roughnessM:0.000045}),
    a('battery','battery',[10,3,3.6],[2.2,2,1.4],design.config.batteryWhPerModule/130+300,{energyWh:design.config.batteryWhPerModule,capacityW:2.2e6,storageMaxW:design.config.batteryMaxWPerModule,efficiency:0.95}),
    a('distribution','switchboard',[7.5,3,3.6],[1.4,2,1.4],500,{capacityW:2.2e6}),
    a('rack-network','network',[7.5,3,-3.6],[1.1,1.5,0.6],100,{capacityBitS:400e9,capacityW:3000}),
  ];
  if(design.config.standbyPumps)support.push(a('pump-standby','pump',[9,2.6,-2.5],[1.2,1.2,0.8],180,{capacityW:45_000,shutoffPa:250_000,freeFlowM3S:0.1,efficiency:0.72}));
  for(let r=0;r<m.rackCount;r++){
    const rid=`${id}/rack-${pad(r+1)}`,nx=Math.min(4,m.nodeCount-r*4),pos:Vec3=[x-9.1+(r%20)*0.8,3.1+dy,z+(r<20?-2.3:2.3)];
    const rack=asset(rid,'rack',id,pos,[0.6,2.2,1.2],150,{capacityW:48_000,slotsU:48,occupiedU:nx*10,nodes:nx},m.powerDomainId);support.push(rack);
    for(let n=0;n<nx;n++)support.push(asset(`${rid}/node-${pad(n+1)}`,'compute',rid,[pos[0],2.25+dy+n*0.445,pos[2]],[0.48,0.4445,0.95],120,{capacityW:12_000,accelerators:8,heightU:10,liquidCaptureFraction:0.9},m.powerDomainId));
  }
  return support;
}
export function resolveAsset(design:Design,id:string):Asset|undefined {
  const existing=design.assets.find(a=>a.id===id);if(existing)return existing;
  const match=id.match(/^(platform-\d{3,}\/module-\d{2})\//);return match?moduleAssets(design,match[1]).find(a=>a.id===id):undefined;
}
export function* allAssets(design:Design):Iterable<Asset>{yield*design.assets;for(const m of design.modules)yield*moduleAssets(design,m.id);}
export function connectionsForModule(design:Design,moduleId:string):Connection[]{
  const m=design.modules.find(m=>m.id===moduleId);if(!m)return[];
  const list=moduleAssets(design,moduleId),get=(suffix:string)=>list.find(a=>a.id===`${moduleId}/${suffix}`)!;
  const bus=resolveAsset(design,m.powerDomainId)!,net=resolveAsset(design,m.networkDomainId)!;
  const c:Connection[]=[connect(bus,get('battery'),'power',2.2e6,4),connect(get('battery'),get('distribution'),'power',2.2e6,2),connect(net,get('rack-network'),'cluster',400e9,4)];
  for(const p of list.filter(a=>a.type==='pump'||a.type==='cdu'||a.type==='network'))c.push(connect(get('distribution'),p,'power',p.ratings.capacityW??3000,2));
  for(const rack of list.filter(a=>a.type==='rack')){
    c.push(connect(get('distribution'),rack,'power',48_000,2),connect(get('rack-network'),rack,'cluster',100e9,1));
    c.push(connect(get('cdu'),rack,'technical',0.005,1.2),connect(rack,get('hx'),'technical',0.005,1.2));
    for(const n of list.filter(a=>a.parentId===rack.id))c.push(connect(rack,n,'power',12_000,0.5),connect(rack,n,'cluster',100e9,0.5));
  }
  for(const pump of list.filter(a=>a.id.endsWith('pump-duty')||a.id.endsWith('pump-standby'))){c.push(connect(get('pipe-tech'),pump,'technical',0.1),connect(pump,get('valve-tech'),'technical',0.1));}
  c.push(connect(get('valve-tech'),get('cdu'),'technical',0.2),connect(get('cdu'),get('hx'),'technical',0.2),connect(get('hx'),get('pipe-tech'),'technical',0.2));
  c.push(connect(get('pipe-sea'),get('pump-sea'),'seawater',0.1),connect(get('pump-sea'),get('valve-sea'),'seawater',0.1),connect(get('valve-sea'),get('hx'),'seawater',0.1),connect(get('hx'),get('pipe-sea'),'seawater',0.1));
  return c;
}
/** Canonical orthogonal header/riser template, independent of all view transforms. */
export function loopRouteM(m:ModuleSpec):Vec3[]{
  const [x,y,z]=m.positionM,h=y-1.8;
  return [[x+9,h,z-3.5],[x+9,h,z-4.5],[x-10,h,z-4.5],[x-10,h,z+4.5],[x+9,h,z+4.5],[x+9,h,z-3.5]];
}
export function routeLengthM(points:Vec3[]){
  if(!Array.isArray(points)||points.length>64)failure('invalid-input','ROUTE_POINTS','Route must contain at most 64 three-coordinate points.');
  for(const p of points){if(!Array.isArray(p)||p.length!==3)failure('invalid-input','ROUTE_VECTOR','Route point must have three coordinates.');for(const n of p)finiteNumber(n,'route coordinate',{unit:'m'});}
  return finiteOutputs({lengthM:points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((v,j)=>v-points[i][j])),0)},'route geometry').lengthM;
}
export function loopGeometry(_design:Design,m:ModuleSpec){
  const rackBranchesM=m.rackCount*2*1.2; // parallel branch wetted mass length; solver equivalent path takes one branch
  return finiteOutputs({technicalLengthM:routeLengthM(loopRouteM(m))+2*1.2,seawaterLengthM:2*(m.positionM[1]+3)+8,rackBranchesM},'loop geometry');
}
export function packingIssues(design:Design):string[]{
  const issues:string[]=[];
  for(const m of design.modules){
    const boxes=moduleAssets(design,m.id).filter(a=>['rack','pump','exchanger','cdu','battery','switchboard','network'].includes(a.type));
    for(const a of boxes){
      if(Math.abs(a.positionM[0]-m.positionM[0])+a.dimensionsM[0]/2>12+1e-8||Math.abs(a.positionM[1]-m.positionM[1])+a.dimensionsM[1]/2>2+1e-8||Math.abs(a.positionM[2]-m.positionM[2])+a.dimensionsM[2]/2>5+1e-8)issues.push(`${a.id} exceeds module envelope`);
    }
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];if([0,1,2].every(k=>Math.abs(a.positionM[k]-b.positionM[k])<(a.dimensionsM[k]+b.dimensionsM[k])/2-1e-8))issues.push(`${a.id} overlaps ${b.id}`);
    }
  }
  return issues;
}
export function validateGraph(design:Design):string[]{
  const issues:string[]=[];
  const inventory=[...allAssets(design)],allIds=new Set(inventory.map(a=>a.id)),ids=new Set<string>();
  for(const a of inventory){if(ids.has(a.id))issues.push(`${a.id}: duplicate asset ID`);ids.add(a.id);if(a.parentId&&!allIds.has(a.parentId))issues.push(`${a.id}: unknown parent`);}
  const check=(c:Connection,assets:Map<string,Asset>)=>{
    const a=assets.get(c.from),b=assets.get(c.to);
    if(!a||!b){issues.push(`${c.id}: unknown endpoint`);return;}
    const ap=a.ports.find(p=>p.id===c.fromPort),bp=b.ports.find(p=>p.id===c.toPort);
    if(!ap||!bp||ap.medium!==c.medium||bp.medium!==c.medium)issues.push(`${c.id}: incompatible ports`);
    if(c.capacity<0||!Number.isFinite(c.capacity))issues.push(`${c.id}: invalid capacity`);
    if(ap&&bp&&(ap.direction==='in'||bp.direction==='out'))issues.push(`${c.id}: incompatible port directions`);
    if(ap&&bp&&c.capacity>Math.min(ap.capacity,bp.capacity)+1e-8)issues.push(`${c.id}: connection exceeds port capacity`);
  };
  const root=new Map(design.assets.map(a=>[a.id,a]));design.connections.forEach(c=>check(c,root));
  for(const m of design.modules){const map=new Map([...root,...moduleAssets(design,m.id).map(a=>[a.id,a] as const)]);connectionsForModule(design,m.id).forEach(c=>check(c,map));}
  return issues;
}

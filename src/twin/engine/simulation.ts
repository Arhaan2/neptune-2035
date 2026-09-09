import { loopGeometry, resolveAsset } from '../assets/design';
import { SOLVER_VERSION, TWIN_SCHEMA, type Asset, type Design, type ModuleSpec, type ModuleState, type OperationEvent, type SimulationState, type Summary } from '../types';
import { allocateGrid, ELECTRICAL_ASSUMPTIONS as E, GRID_EFFICIENCY, nodeDrawW, solveElectrical } from '../solvers/electrical';
import { solveHydraulics, type HydraulicResult } from '../solvers/hydraulic';
import { advanceThermal } from '../solvers/thermal';
import { createNetworkEvaluator, type NetworkIssue } from '../solvers/network';

const MAX_EVENTS = 10_000, MAX_LOG = 1000, MAX_DURATION_S = 86_400;
const ZERO_HYDRAULIC: HydraulicResult = { flowM3S:0, pressurePa:0, electricalW:0, reynolds:0, darcyFactor:0, headResidualPa:0, massResidualKgS:0, iterations:0 };
interface ModuleContext { module:ModuleSpec; ancestors:string[]; pathCapacityW:number; supported:boolean; technicalLengthM:number; seawaterLengthM:number }
interface Context { modules:ModuleContext[]; assets:Map<string,Asset>; hydraulicCache:Map<string,HydraulicResult>; network:ReturnType<typeof createNetworkEvaluator> }
function context(design:Design):Context {
  const assets = new Map(design.assets.map(a => [a.id,a]));
  const incoming = new Map<string,typeof design.connections>();
  for (const edge of design.connections) if (edge.medium === 'power' && edge.enabled) incoming.set(edge.to,[...(incoming.get(edge.to)??[]),edge]);
  return { assets, hydraulicCache:new Map(), network:createNetworkEvaluator(design), modules:design.modules.map(module => {
    const ancestors:string[]=[]; let id=module.powerDomainId, capacity=design.config.supplyW, supported=true;
    while (id !== 'shore/grid') {
      if (ancestors.includes(id)) { supported=false; break; }
      ancestors.push(id);
      const a=assets.get(id), edges=incoming.get(id)??[];
      if (!a || edges.length!==1) { supported=false; break; }
      capacity=Math.min(capacity,a.ratings.capacityW??Infinity,edges[0].capacity); id=edges[0].from;
    }
    ancestors.push('shore/grid');
    return { module, ancestors, pathCapacityW:capacity, supported, ...loopGeometry(design,module) };
  }) };
}
function appendLog(state:SimulationState, assetId:string, message:string, kind:'command'|'controller'|'warning', affectedIds:string[]) {
  state.log.push({timeS:state.timeS,assetId,message,kind,affectedIds});
  if(state.log.length>MAX_LOG)state.log.splice(0,state.log.length-MAX_LOG);
}
function affectedModules(ctx:Context, id:string):string[] {
  return ctx.modules.filter(c=>id==='shore/fiber'||id==='shore/cluster-core'||c.ancestors.includes(id)||c.module.networkDomainId===id||c.module.platformId===id||id===c.module.id||id.startsWith(`${c.module.id}/`)).map(c=>c.module.id);
}
export function validateEvent(design:Design, event:OperationEvent):void {
  if(!event||typeof event!=='object'||typeof event.id!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(event.id))throw Error('Event requires a bounded stable alphanumeric ID');
  if(!Number.isInteger(event.timeS)||event.timeS<0||event.timeS>30*86400)throw Error('Event time must be an integer second within the 30-day replay horizon');
  if(typeof event.assetId!=='string'||event.assetId.length>180)throw Error('Invalid event asset ID');
  const asset=resolveAsset(design,event.assetId);if(!asset)throw Error(`Unknown event asset: ${event.assetId}`);
  const bounds:Partial<Record<OperationEvent['kind'],[number,number]>>={workload:[0,1],seawater:[275.15,311.15],fouling:[0,0.0001],'pump-speed':[0,1.2]};
  const limit=bounds[event.kind];
  if(limit){
    if(event.assetId!=='shore/grid')throw Error(`${event.kind} is a recorded facility boundary command; assetId must be shore/grid`);
    if(typeof event.value!=='number'||!Number.isFinite(event.value)||event.value<limit[0]||event.value>limit[1])throw Error(`${event.kind} outside supported limits ${limit.join('–')}`);
  }else if(['trip','restore','maintenance'].includes(event.kind)){
    if(['hull'].includes(asset.type)||(asset.type==='platform'&&event.kind==='trip'))throw Error(`Unsupported operational command for ${asset.type}; platform maintenance is supported`);
    if(event.value!==undefined)throw Error('Failure/restoration commands do not accept a numeric value');
  }else throw Error(`Unsupported event kind: ${String(event.kind)}`);
}
function mergeEvents(design:Design,state:SimulationState,events:OperationEvent[]) {
  if(state.events.length+events.length>MAX_EVENTS*2)throw Error('Event history exceeds 10000 entries');
  const merged=new Map(state.events.map(e=>[e.id,e]));
  for(const event of events){
    validateEvent(design,event);
    const existing=merged.get(event.id);
    if(existing&&JSON.stringify(existing)!==JSON.stringify(event))throw Error(`Conflicting event ID ${event.id}`);
    if(!existing&&event.timeS<state.timeS)throw Error('An event in the past requires replay');
    merged.set(event.id,{...event});
  }
  if(merged.size>MAX_EVENTS)throw Error('Event history exceeds 10000 entries');
  state.events=[...merged.values()].sort((a,b)=>a.timeS-b.timeS||a.id.localeCompare(b.id));
}
function applyEvents(design:Design,state:SimulationState,ctx:Context) {
  const applied=new Set(state.appliedEventIds);
  for(const event of state.events){
    if(event.timeS>state.timeS+1e-8)break;
    if(applied.has(event.id))continue;
    validateEvent(design,event);
    if(event.kind==='workload')state.workload=event.value!;
    else if(event.kind==='seawater')state.seawaterK=event.value!;
    else if(event.kind==='fouling')state.foulingResistanceKPerW=event.value!;
    else if(event.kind==='pump-speed')state.pumpSpeed=event.value!;
    else {
      const failed=new Set(state.failedAssetIds);
      if(event.kind==='restore')failed.delete(event.assetId);else failed.add(event.assetId);
      state.failedAssetIds=[...failed].sort();
      for(const m of state.modules)if(event.assetId===m.id||event.assetId.startsWith(`${m.id}/`)){
        m.states[event.assetId]=event.kind==='restore'?'available':event.kind==='maintenance'?'maintenance':'failed';
        if(event.kind==='restore'&&event.assetId.endsWith('/pump-duty')){m.states[event.assetId]='starting';m.startAtS[event.assetId]=state.timeS+3;}
      }
    }
    const affected=affectedModules(ctx,event.assetId);
    appendLog(state,event.assetId,`${event.kind}${event.value===undefined?'':` = ${event.value} ${event.kind==='seawater'?'K':event.kind==='fouling'?'K/W':'fraction'}`}; ${affected.length} module(s) in dependency scope`,'command',affected);
    state.appliedEventIds.push(event.id);
  }
}
function controller(state:SimulationState,m:ModuleState,design:Design,disabled:boolean,techBlocked:boolean) {
  const failure=new Set(state.failedAssetIds),duty=`${m.id}/pump-duty`,standby=`${m.id}/pump-standby`;
  const setState=(id:string,next:ModuleState['states'][string],message:string)=>{
    if(m.states[id]!==next){m.states[id]=next;appendLog(state,id,message,'controller',[m.id]);}
  };
  if(disabled){for(const id of [duty,standby,`${m.id}/pump-sea`])if(m.states[id]&&!failure.has(id))setState(id,'isolated','Module isolation removes load and pump power');return;}
  if(techBlocked||state.pumpSpeed===0){
    for(const id of [duty,standby])if(m.states[id]&&!failure.has(id))setState(id,techBlocked?'isolated':id===standby?'standby':'available',techBlocked?'Closed technical path interlock disables pump motor':'Zero speed command disables pump motor');
  }
  if(!techBlocked&&state.pumpSpeed>0&&!failure.has(duty)){
    if(m.states[duty]==='starting'&&state.timeS<(m.startAtS[duty]??0)){} // hold declared restart delay
    else setState(duty,'running','Duty pump enabled');
  }
  if(!techBlocked&&state.pumpSpeed>0&&design.config.standbyPumps&&!failure.has(standby)){
    if(m.states[duty]==='running')setState(standby,'standby','Duty restored; redundant pump held in standby');
    else if(m.states[standby]==='starting'&&state.timeS>=(m.startAtS[standby]??Infinity))setState(standby,'running','Standby startup delay elapsed; parallel branch enabled');
    else if(m.states[standby]!=='starting'&&m.states[standby]!=='running'){
      m.startAtS[standby]=state.timeS+8;setState(standby,'starting','Duty unavailable; standby startup scheduled after 8 seconds');
    }
  }
  const old=m.throttle;
  if(m.coolantK>=328.15||m.airK>=323.15)m.throttle=0;
  else if(m.throttle===0&&m.coolantK<318.15&&m.airK<313.15)m.throttle=0.5;
  else if(m.throttle>0.5&&(m.coolantK>=318.15||m.airK>=313.15))m.throttle=0.5;
  else if(m.throttle===0.5&&m.coolantK<313.15&&m.airK<308.15)m.throttle=1;
  if(old!==m.throttle)appendLog(state,m.id,`Thermal hysteresis changes permitted whole-node fraction ${old} → ${m.throttle}; bulk coolant ${m.coolantK.toFixed(2)} K, air ${m.airK.toFixed(2)} K`,'controller',[m.id]);
}
function circuit(ctx:ModuleContext,medium:'technical'|'seawater',pumps:number,speed:number,cache:Map<string,HydraulicResult>):HydraulicResult {
  if(!pumps||!speed)return ZERO_HYDRAULIC;
  const length=medium==='technical'?ctx.technicalLengthM:ctx.seawaterLengthM,key=`${medium}:${length}:${pumps}:${speed}`,cached=cache.get(key);
  if(cached)return cached;
  const result=solveHydraulics({lengthM:length,diameterM:0.18,roughnessM:0.000045,
    densityKgM3:medium==='technical'?997:1025,dynamicViscosityPaS:medium==='technical'?0.000855:0.00108,
    fittingsK:medium==='technical'?12:10,equipmentDropPaAtReference:medium==='technical'?80_000:55_000,
    referenceFlowM3S:0.05,pumpCount:pumps,pumpSpeed:speed});
  cache.set(key,result);return result;
}
function resolveStep(design:Design,state:SimulationState,ctx:Context,dtS:number,runController:boolean) {
  const failed=new Set(state.failedAssetIds);
  const demands=ctx.modules.map((c,i)=>{
    const m=state.modules[i],id=m.id;
    const disabled=failed.has(id)||failed.has(c.module.platformId)||failed.has(`${id}/distribution`)||failed.has(`${id}/battery`);
    const isFailed=(suffix:string)=>failed.has(`${id}/${suffix}`);
    const techBlocked=disabled||isFailed('hx')||isFailed('cdu')||isFailed('valve-tech')||isFailed('pipe-tech');
    const seaBlocked=disabled||isFailed('hx')||isFailed('valve-sea')||isFailed('pipe-sea');
    if(runController)controller(state,m,design,disabled,techBlocked);
    const pumps=techBlocked?0:Number(m.states[`${id}/pump-duty`]==='running')+Number(m.states[`${id}/pump-standby`]==='running');
    const technical=circuit(c,'technical',pumps,state.pumpSpeed,ctx.hydraulicCache);
    const seawater=circuit(c,'seawater',seaBlocked||isFailed('pump-sea')?0:1,state.pumpSpeed,ctx.hydraulicCache);
    let operableNodes=c.module.nodeCount;
    const failedRacks=new Set([...failed].filter(f=>f.startsWith(`${id}/rack-`)&&/^rack-\d+$/.test(f.slice(id.length+1))));
    for(const rid of failedRacks){const rack=Number(rid.split('/rack-')[1]);operableNodes-=Math.min(4,Math.max(0,c.module.nodeCount-(rack-1)*4));}
    for(const f of failed)if(f.startsWith(`${id}/rack-`)&&f.includes('/node-')&&!failedRacks.has(f.split('/node-')[0]))operableNodes--;
    const desiredNodes=disabled?0:Math.max(0,Math.floor(operableNodes*m.throttle));
    const criticalW=technical.electricalW+seawater.electricalW+E.controlsWPerModule+E.fanWPerModule;
    const gridLive=!disabled&&c.supported&&!c.ancestors.some(a=>failed.has(a));
    // Spare upstream power may recharge storage only after module loads; solveElectrical forbids simultaneous charge/discharge.
    const maxChargeW=Math.min(design.config.batteryMaxWPerModule,Math.max(0,design.config.batteryWhPerModule-m.batteryWh)*3600/(E.chargeEfficiency*(dtS||1)))/GRID_EFFICIENCY;
    return {c,m,disabled,techBlocked,seaBlocked,technical,seawater,networkAvailable:true,desiredNodes,criticalW,gridLive,maxChargeW};
  });
  const domainLimits=new Map<string,number>();
  for(const d of demands)domainLimits.set(d.c.module.powerDomainId,d.c.pathCapacityW);
  const supply=failed.has('shore/grid')?0:design.config.supplyW;
  const blockedDomains=new Set<string>(),networkIssues=new Map<string,NetworkIssue>();
  const planElectrical=()=>{
    for(const d of demands)d.networkAvailable=!blockedDomains.has(d.c.module.networkDomainId);
    const requests=demands.map(d=>({domainId:d.c.module.powerDomainId,requestedW:d.gridLive?(d.desiredNodes*nodeDrawW(state.workload,design.config.idleFraction,d.networkAvailable)+d.criticalW)/GRID_EFFICIENCY:0,moduleLimitW:2.2e6}));
    let grid=allocateGrid(requests,supply,domainLimits);
    // Charge only after allocating loads; every trial uses the unchanged beginning-of-step stored energy.
    const spentByDomain=new Map<string,number>();
    demands.forEach((d,i)=>spentByDomain.set(d.c.module.powerDomainId,(spentByDomain.get(d.c.module.powerDomainId)??0)+grid[i]));
    const remainingDomains=new Map([...domainLimits].map(([id,limit])=>[id,Math.max(0,limit-(spentByDomain.get(id)??0))]));
    const charging=allocateGrid(demands.map((d,i)=>({domainId:d.c.module.powerDomainId,requestedW:d.gridLive?d.maxChargeW:0,moduleLimitW:Math.max(0,2.2e6-grid[i])})),Math.max(0,supply-grid.reduce((a,b)=>a+b,0)),remainingDomains);
    grid=grid.map((p,i)=>p+charging[i]);
    return demands.map((d,i)=>solveElectrical({desiredNodes:d.desiredNodes,workload:state.workload,idleFraction:design.config.idleFraction,networkAvailable:d.networkAvailable,
      criticalLoadW:d.criticalW,gridAvailableW:grid[i],batteryWh:d.m.batteryWh,batteryCapacityWh:design.config.batteryWhPerModule,
      batteryMaxW:design.config.batteryMaxWPerModule,batteryAvailable:!failed.has(`${d.m.id}/battery`),isolated:d.disabled,dtS}));
  };
  let electricalPlan=planElectrical();
  // Offered demand is based on energized inventory even while jobs wait. This avoids idle/overload oscillation.
  // Blocking is monotone within a timestep and releases on the next solve when the constraint clears.
  for(let pass=0;pass<8;pass++){
    const assessment=ctx.network(electricalPlan.map((e,i)=>({id:demands[i].m.id,energizedNodes:e.energizedNodes})),state.failedAssetIds);
    for(const issue of assessment.issues)networkIssues.set(issue.resourceId,issue);
    const newlyBlocked=assessment.blockedDomainIds.filter(id=>!blockedDomains.has(id));
    if(newlyBlocked.length===0)break;
    for(const id of newlyBlocked)blockedDomains.add(id);
    if(pass===7){
      for(const d of demands)blockedDomains.add(d.c.module.networkDomainId);
      networkIssues.set('coupling-limit',{assetId:'shore/cluster-core',resourceId:'coupling-limit',reason:'Network/electrical coupling exceeded eight passes; required job domains conservatively unavailable (unsupported dispatch)',domainIds:[...blockedDomains]});
    }
    electricalPlan=planElectrical();
  }
  for(let i=0;i<demands.length;i++){
    const d=demands[i],m=d.m,electrical=electricalPlan[i];
    // Binary circuit coupling converges in one correction: no critical power means both pump curves are disabled.
    const technical=electrical.criticalPowered?d.technical:ZERO_HYDRAULIC,seawater=electrical.criticalPowered?d.seawater:ZERO_HYDRAULIC;
    const thermal=advanceThermal({coolantK:m.coolantK,airK:m.airK,itW:electrical.itW,facilityW:electrical.facilityW,
      technicalPumpW:technical.electricalW,seawaterPumpW:seawater.electricalW,technicalFlowM3S:technical.flowM3S,seawaterFlowM3S:seawater.flowM3S,
      seawaterK:state.seawaterK,exchangerUAWPerK:design.config.exchangerUAWPerK,foulingResistanceKPerW:state.foulingResistanceKPerW,fanPowered:electrical.criticalPowered,dtS});
    Object.assign(m,{coolantK:thermal.coolantK,airK:thermal.airK,batteryWh:electrical.batteryWh,itW:electrical.itW,facilityW:electrical.facilityW,
      gridW:electrical.gridW,batteryDischargeW:electrical.batteryDischargeW,batteryChargeW:electrical.batteryChargeW,
      technicalFlowM3S:technical.flowM3S,seawaterFlowM3S:seawater.flowM3S,pumpPowerW:technical.electricalW+seawater.electricalW,
      rejectedHeatW:thermal.rejectedHeatW,thermalResidualW:thermal.residualW,electricalResidualW:electrical.residualW,
      technicalOutletK:thermal.technicalOutletK,seawaterOutletK:thermal.seawaterOutletK,pressurePa:technical.pressurePa,
      energizedNodes:electrical.energizedNodes,availableAccelerators:d.networkAvailable?electrical.energizedNodes*8:0});
    for(const suffix of ['pump-duty','pump-standby','pump-sea','cdu','hx','battery','distribution','rack-network']){
      const id=`${m.id}/${suffix}`;
      if(suffix==='pump-standby'&&!design.config.standbyPumps)continue;
      if(failed.has(id)){if(m.states[id]!=='maintenance')m.states[id]='failed';}
      else if(d.disabled)m.states[id]='isolated';
      else if(suffix==='pump-sea')m.states[id]=d.seaBlocked?'isolated':seawater.flowM3S>0?'running':'available';
      else if(suffix.startsWith('pump-')){if(!electrical.criticalPowered&&m.states[id]==='running')m.states[id]='available';}
      else if(suffix==='hx')m.states[id]=technical.flowM3S>0&&seawater.flowM3S>0?'running':'available';
      else m.states[id]=electrical.criticalPowered?'running':'available';
    }
    const warnings:string[]=[];
    if(!d.c.supported)warnings.push('Unsupported power topology: requires an enabled radial upstream path');
    if(!d.networkAvailable){
      const causes=[...networkIssues.values()].filter(issue=>issue.domainIds.includes(d.c.module.networkDomainId));
      warnings.push(...causes.map(issue=>`${issue.reason}; whole job domain ${d.c.module.networkDomainId} unavailable; energized nodes retain idle draw`));
    }
    if(electrical.energizedNodes<d.c.module.nodeCount)warnings.push(`${d.c.module.nodeCount-electrical.energizedNodes} whole compute nodes curtailed or isolated`);
    if(technical.flowM3S===0&&electrical.itW>0)warnings.push('Technical coolant flow lost; heat accumulating in bulk thermal node');
    if(seawater.flowM3S===0&&electrical.itW>0)warnings.push('Seawater heat rejection unavailable');
    if(m.throttle<1)warnings.push(`Thermal controller limits permitted whole nodes to ${m.throttle*100}%`);
    if(electrical.batteryDischargeW>0)warnings.push('UPS discharging: finite power and energy, 10% reserve');
    if(!d.gridLive&&!d.disabled&&!electrical.criticalPowered)warnings.push('UPS cannot support the minimum critical load at its remaining power/energy limit');
    if(!d.gridLive&&!d.disabled&&m.batteryWh<=design.config.batteryWhPerModule*0.1+1e-7)warnings.push('UPS reserve reached; no guaranteed ride-through');
    if(Math.abs(electrical.normalizedResidual)>1e-9||Math.abs(thermal.normalizedResidual)>1e-9)warnings.push('Conservation tolerance exceeded');
    if(Math.abs(technical.headResidualPa)>0.01||Math.abs(seawater.headResidualPa)>0.01)warnings.push('Hydraulic operating point did not meet 0.01 Pa head tolerance');
    for(const warning of warnings)if(!m.warnings.includes(warning)){
      const cause=[...networkIssues.values()].find(issue=>warning.startsWith(issue.reason));
      appendLog(state,cause?.assetId??m.id,warning,'warning',cause?demands.filter(d=>cause.domainIds.includes(d.c.module.networkDomainId)).map(d=>d.m.id):[m.id]);
    }
    m.warnings=warnings;
    state.facilityEnergyWh+=electrical.facilityW*dtS/3600;state.itEnergyWh+=electrical.itW*dtS/3600;state.gridEnergyWh+=electrical.gridW*dtS/3600;
  }
}
export function initialize(design:Design):SimulationState {
  if(design.schemaVersion!==TWIN_SCHEMA||design.modules.length===0||design.modules.length>6250)throw Error('Unsupported design schema or module count');
  const modules:ModuleState[]=design.modules.map(m=>({id:m.id,coolantK:303.15,airK:298.15,batteryWh:design.config.batteryWhPerModule,throttle:1,
    states:{[m.id]:'available',[`${m.id}/pump-duty`]:'running',...(design.config.standbyPumps?{[`${m.id}/pump-standby`]:'standby' as const}:{}),[`${m.id}/pump-sea`]:'running'},startAtS:{},
    technicalFlowM3S:0,seawaterFlowM3S:0,pumpPowerW:0,itW:0,facilityW:0,gridW:0,batteryDischargeW:0,batteryChargeW:0,
    rejectedHeatW:0,thermalResidualW:0,electricalResidualW:0,technicalOutletK:303.15,seawaterOutletK:design.config.seawaterK,pressurePa:0,
    energizedNodes:0,availableAccelerators:0,warnings:[]}));
  const state:SimulationState={schemaVersion:TWIN_SCHEMA,designRevision:design.revision,solverVersion:SOLVER_VERSION,timeS:0,modules,events:[],log:[],
    facilityEnergyWh:0,itEnergyWh:0,gridEnergyWh:0,appliedEventIds:[],workload:design.config.workload,seawaterK:design.config.seawaterK,
    foulingResistanceKPerW:design.config.foulingResistanceKPerW,pumpSpeed:design.config.pumpSpeed,failedAssetIds:[],solverMs:0};
  resolveStep(design,state,context(design),0,true);return state;
}
export function advanceWithStep(design:Design,input:SimulationState,durationS:number,events:OperationEvent[]=[],maxStepS=1):SimulationState {
  if(input.schemaVersion!==TWIN_SCHEMA||input.designRevision!==design.revision||input.solverVersion!==SOLVER_VERSION)throw Error('Simulation revision mismatch; reinitialize after design changes');
  if(!Number.isInteger(durationS)||durationS<0||durationS>MAX_DURATION_S||input.timeS+durationS>30*86400)throw Error('Advance duration must be an integer within 0–86400 seconds and the 30-day horizon');
  if(![1,0.5,0.25,0.125].includes(maxStepS))throw Error('Verification timestep must be 1, 0.5, 0.25, or 0.125 seconds');
  if(!Number.isInteger(input.timeS)||input.timeS<0||![input.facilityEnergyWh,input.itEnergyWh,input.gridEnergyWh].every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid simulation clock or energy accumulator');
  if(!Array.isArray(input.modules)||!Array.isArray(input.events)||!Array.isArray(input.appliedEventIds)||!Array.isArray(input.failedAssetIds)||!Array.isArray(input.log))throw Error('Invalid simulation arrays');
  if(input.modules.some(m=>![m.coolantK,m.airK,m.batteryWh,m.throttle].every(Number.isFinite)||m.coolantK<273.15||m.coolantK>373.15||m.airK<250||m.airK>373.15||m.batteryWh<0||m.batteryWh>design.config.batteryWhPerModule||![0,0.5,1].includes(m.throttle)))throw Error('Invalid bounded numerical module state');
  if(input.modules.length!==design.modules.length||input.modules.some((m,i)=>m.id!==design.modules[i].id))throw Error('Simulation inventory mismatch');
  const state:SimulationState={...input,modules:input.modules.map(m=>({...m,states:{...m.states},startAtS:{...m.startAtS},warnings:[...m.warnings]})),events:input.events.map(e=>({...e})),log:[...input.log],appliedEventIds:[...input.appliedEventIds],failedAssetIds:[...input.failedAssetIds],solverMs:0};
  mergeEvents(design,state,events);const ctx=context(design),end=state.timeS+durationS;
  while(state.timeS<end-1e-8){
    applyEvents(design,state,ctx);
    const dt=Math.min(maxStepS,end-state.timeS);
    resolveStep(design,state,ctx,dt,true);state.timeS+=dt;
  }
  applyEvents(design,state,ctx);resolveStep(design,state,ctx,0,true);
  return state;
}
export function advance(design:Design,state:SimulationState,durationS:number,events:OperationEvent[]=[]):SimulationState{return advanceWithStep(design,state,durationS,events,1);}
export function replay(design:Design,events:OperationEvent[],durationS:number):SimulationState{return advance(design,initialize(design),durationS,events);}
export function summarize(design:Design,state:SimulationState):Summary {
  const sum=(key:keyof Pick<ModuleState,'itW'|'facilityW'|'gridW'|'pumpPowerW'|'availableAccelerators'|'batteryWh'|'electricalResidualW'|'thermalResidualW'>)=>state.modules.reduce((n,m)=>n+m[key],0);
  const itW=sum('itW'),facilityW=sum('facilityW'),energizedAccelerators=state.modules.reduce((n,m)=>n+m.energizedNodes*8,0);
  return {timeS:state.timeS,itW,facilityW,gridW:sum('gridW'),pumpPowerW:sum('pumpPowerW'),availableAccelerators:sum('availableAccelerators'),energizedAccelerators,
    curtailedAccelerators:Math.max(0,design.provisionedAccelerators-energizedAccelerators),maxCoolantK:Math.max(...state.modules.map(m=>m.coolantK)),batteryWh:sum('batteryWh'),
    instantaneousPUE:itW>0?facilityW/itW:null,energyPUE:state.itEnergyWh>0?state.facilityEnergyWh/state.itEnergyWh:null,
    electricalResidualW:sum('electricalResidualW'),thermalResidualW:sum('thermalResidualW'),warnings:[...new Set(state.modules.flatMap(m=>m.warnings))]};
}

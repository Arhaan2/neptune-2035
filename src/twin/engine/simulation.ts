import { activePowerDesign } from '../transfer/topology';
import { initializeTransfer, nextTransferDeadline, updateTransfer } from '../transfer/controller';
import { allocateActiveGrid, planTransfers, restorationRequestedW, type RestorableDemand } from '../transfer/dispatch';
import type { ExperimentDefinition } from '../experiment/types';
import { attachExperiment, beginInterval, commitExperimentInterval, admitExperimentInputs, prepareExperimentBoundary, finishExperimentBoundary, recordExperimentEvent, recordExperimentController, experimentFinished } from '../experiment/runtime';
import { resolveModuleEngineering, resolveSpecification, equipmentFor, engineeringIdentity, MODEL_BOUNDARIES as B, type ComponentSpecification } from '../catalog/equipment';
import { loopGeometry } from '../assets/design';
import { SOLVER_VERSION, type Asset, type Design, type ModuleSpec, type ModuleState, type OperationEvent, type SimulationState, type Summary } from '../types';
import { allocateGrid, nodeDrawW, solveElectrical } from '../solvers/electrical';
import { solveHydraulics, type HydraulicResult } from '../solvers/hydraulic';
import { advanceThermal } from '../solvers/thermal';
import { createNetworkPowerEvaluator, assessNetworkPower } from '../solvers/network-power';
import { createNetworkEvaluator, type NetworkIssue } from '../solvers/network';

import { CONTRACT, INTEGRATION_STEPS, type IntegrationStep } from '../persistence/limits';
import { validateDesign } from '../persistence/design';
import { validateState } from '../persistence/state';
import { mergeEventHistory } from '../persistence/events';
import { projectFile } from '../persistence/project';
import { safeJSON } from '../persistence/structure';
import { failure, finiteNumber, finiteOutputs, diagnosticFor } from '../safety';
export { validateState } from '../persistence/state';
export { validateEvent } from '../persistence/events';
const MAX_LOG = CONTRACT.maxLogEntries;
const ZERO_HYDRAULIC: HydraulicResult = { flowM3S:0, pressurePa:0, electricalW:0, reynolds:0, darcyFactor:0, headResidualPa:0, massResidualKgS:0, iterations:0 };
interface ModuleContext { equipment:ReturnType<typeof resolveModuleEngineering>; module:ModuleSpec; ancestors:string[]; pathCapacityW:number; supported:boolean; technicalLengthM:number; seawaterLengthM:number }
interface Context { activeKey?:string; active?:Context; modules:ModuleContext[]; assets:Map<string,Asset>; hydraulicCache:Map<string,HydraulicResult>; network:ReturnType<typeof createNetworkEvaluator>; networkPower:ReturnType<typeof createNetworkPowerEvaluator> }
function context(design:Design):Context {
  const assets = new Map(design.assets.map(a => [a.id,a]));
  const incoming = new Map<string,typeof design.connections>();
  for (const edge of design.connections) if (edge.medium === 'power' && edge.enabled) incoming.set(edge.to,[...(incoming.get(edge.to)??[]),edge]);
  return { assets, hydraulicCache:new Map(), network:createNetworkEvaluator(design,undefined,{includeResources:false,...(design.transfer?{ignorePower:true}:{})}), networkPower:createNetworkPowerEvaluator(design), modules:design.modules.map(module => {
    const ancestors:string[]=[]; let id=module.powerDomainId, capacity=design.config.supplyW, supported=true;
    while (id !== 'shore/grid') {
      if (ancestors.includes(id)) { supported=false; break; }
      ancestors.push(id);
      const a=assets.get(id), edges=incoming.get(id)??[];
      if (!a || edges.length!==1) { supported=false; break; }
      capacity=Math.min(capacity,a.ratings.capacityW??Infinity,edges[0].capacity); id=edges[0].from;
    }
    ancestors.push('shore/grid');
    return { equipment:resolveModuleEngineering(design,module.id), module, ancestors, pathCapacityW:capacity, supported, ...loopGeometry(design,module) };
  }) };
}
function appendLog(state:SimulationState, assetId:string, message:string, kind:'command'|'controller'|'warning', affectedIds:string[]) {
  const entry={timeS:state.timeS,assetId,message,kind,affectedIds};
  state.log.push(entry);recordExperimentController(state,entry);
  if(state.log.length>MAX_LOG)state.log.splice(0,state.log.length-MAX_LOG);
}
function affectedModules(ctx:Context, id:string):string[] {
  return ctx.modules.filter(c=>id==='shore/fiber'||id==='shore/cluster-core'||c.ancestors.includes(id)||c.module.networkDomainId===id||c.module.platformId===id||id===c.module.id||id.startsWith(`${c.module.id}/`)).map(c=>c.module.id);
}
function applyEvents(design:Design,state:SimulationState,ctx:Context) {
  let count=0;
  for(const event of state.events.slice(state.appliedEventIds.length)){
    if(event.timeS>state.timeS+1e-8)break;

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
        if(event.kind==='restore'&&event.assetId.endsWith('/pump-duty')){m.states[event.assetId]='starting';m.startAtS[event.assetId]=state.timeS+equipmentFor(design).controlPolicy.dutyRestartS;}
      }
    }
    recordExperimentEvent(state,event);
    const affected=affectedModules(ctx,event.assetId);
    appendLog(state,event.assetId,`${event.kind}${event.value===undefined?'':` = ${event.value} ${event.kind==='seawater'?'K':event.kind==='fouling'?'K/W':'fraction'}`}; ${affected.length} module(s) in dependency scope`,'command',affected);
    state.appliedEventIds.push(event.id);
    if(!design.transfer)resolveStep(design,state,ctx,0,true);count++;
  }
  if(count&&design.transfer)resolveStep(design,state,ctx,0,true);
  return count;
}
type EquipmentTransition={next:ModuleState['states'][string];message:string};
function controller(state:SimulationState,m:ModuleState,design:Design,disabled:boolean,techBlocked:boolean,transitions:Map<string,EquipmentTransition>) {
  const failure=new Set(state.failedAssetIds),duty=`${m.id}/pump-duty`,standby=`${m.id}/pump-standby`;
  const setState=(id:string,next:ModuleState['states'][string],message:string)=>{
    if(m.states[id]!==next){m.states[id]=next;transitions.set(id,{next,message});}
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
      m.startAtS[standby]=state.timeS+equipmentFor(design).controlPolicy.standbyStartS;setState(standby,'starting','Duty unavailable; standby startup scheduled after 8 seconds');
    }
  }
  const old=m.throttle,policy=equipmentFor(design).controlPolicy;
  if(m.coolantK>=policy.tripCoolantK||m.airK>=policy.tripAirK)m.throttle=0;
  else if(m.throttle===0&&m.coolantK<policy.restartCoolantK&&m.airK<policy.restartAirK)m.throttle=0.5;
  else if(m.throttle>0.5&&(m.coolantK>=policy.restartCoolantK||m.airK>=policy.restartAirK))m.throttle=0.5;
  else if(m.throttle===0.5&&m.coolantK<policy.fullCoolantK&&m.airK<policy.fullAirK)m.throttle=1;
  if(old!==m.throttle)appendLog(state,m.id,`Thermal hysteresis changes permitted whole-node fraction ${old} → ${m.throttle}; bulk coolant ${m.coolantK.toFixed(2)} K, air ${m.airK.toFixed(2)} K`,'controller',[m.id]);
}
function circuit(ctx:ModuleContext,medium:'technical'|'seawater',active:ComponentSpecification[],speed:number,cache:Map<string,HydraulicResult>):HydraulicResult {
  if(!active.length||!speed)return ZERO_HYDRAULIC;
  const first=active[0].ratings;
  if(active.some(p=>p.ratings.shutoffPa!==first.shutoffPa||p.ratings.freeFlowM3S!==first.freeFlowM3S))failure('unsupported-configuration','PARALLEL_PUMP_CURVES','Simultaneously active pumps require matching curves in the implemented parallel-pump solver.');
  const length=medium==='technical'?ctx.technicalLengthM:ctx.seawaterLengthM,pipe=ctx.equipment.pipe.ratings;
  const efficiency=active.length/active.reduce((sum,p)=>sum+1/p.ratings.efficiency,0);
  const key=JSON.stringify([medium,length,pipe,active.map(p=>[p.id,p.version,p.ratings]),speed]),cached=cache.get(key);
  if(cached)return cached;
  const result=solveHydraulics({lengthM:length,diameterM:pipe.diameterM,roughnessM:pipe.roughnessM,
    densityKgM3:medium==='technical'?B.technicalDensityKgM3:B.seawaterDensityKgM3,dynamicViscosityPaS:medium==='technical'?B.technicalDynamicViscosityPaS:B.seawaterDynamicViscosityPaS,
    fittingsK:medium==='technical'?B.technicalFittingsK:B.seawaterFittingsK,equipmentDropPaAtReference:medium==='technical'?B.technicalEquipmentDropPa:B.seawaterEquipmentDropPa,
    referenceFlowM3S:B.referenceFlowM3S,pumpCount:active.length,pumpSpeed:speed,shutoffPa:first.shutoffPa,freeFlowM3S:first.freeFlowM3S,efficiency});
  cache.set(key,result);return result;
}
/** Current full restoration demand only; no time integration or checkpoint validation. */
export function transferRestorationDemands(design:Design,state:SimulationState,ctx:Context=context(design)):RestorableDemand[] {
  const failed=new Set(state.failedAssetIds);
  return ctx.modules.map((c,i)=>{
    const id=c.module.id,m=state.modules[i],duty=`${id}/pump-duty`,standby=`${id}/pump-standby`,isFailed=(suffix:string)=>failed.has(`${id}/${suffix}`);
    const disabled=failed.has(id)||failed.has(c.module.platformId)||isFailed('distribution')||isFailed('battery');
    const techBlocked=disabled||isFailed('hx')||isFailed('cdu')||isFailed('valve-tech')||isFailed('pipe-tech'),seaBlocked=disabled||isFailed('hx')||isFailed('valve-sea')||isFailed('pipe-sea')||isFailed('pump-sea');
    const dutyPending=m.states[duty]==='starting'&&state.timeS<(m.startAtS[duty]??0),standbyOperating=m.states[standby]==='running'||m.states[standby]==='starting'&&(m.startAtS[standby]??Infinity)<(m.startAtS[duty]??0);
    const pumps=techBlocked?[]:[...(!failed.has(duty)?[c.equipment.dutyPump]:[]),...(c.equipment.standbyPump&&!failed.has(standby)&&(failed.has(duty)||dutyPending&&standbyOperating)?[c.equipment.standbyPump]:[])];
    // Reserve full power for the installed pump that can restore this circuit,
    // including its pending startup. Duty restart may replace an active standby;
    // budget the larger of those successive loads, never invented parallel flow.
    const technical=pumps.map(p=>circuit(c,'technical',[p],state.pumpSpeed,ctx.hydraulicCache)).reduce((a,b)=>a.electricalW>=b.electricalW?a:b,ZERO_HYDRAULIC),seawater=circuit(c,'seawater',seaBlocked?[]:[c.equipment.seaPump],state.pumpSpeed,ctx.hydraulicCache);
    return{id,platformId:c.module.platformId,domainId:c.module.powerDomainId,requestedW:(c.module.nodeCount*nodeDrawW(state.workload,design.config.idleFraction,true,c.equipment.electrical.nodePeakW)+technical.electricalW+seawater.electricalW+c.equipment.cdu.ratings.capacityW+c.equipment.moduleSupport.ratings.capacityW+(c.equipment.network?.ratings.capacityW??0))/c.equipment.electrical.gridEfficiency,moduleLimitW:c.equipment.moduleLimitW};
  });
}
function resolveStep(design:Design,state:SimulationState,ctx:Context,dtS:number,runController:boolean) {
  if(design.transfer&&state.transfer){
    if(runController){
      const restoration=transferRestorationDemands(design,state,ctx);
      const previous=state.transfer.sequence;
      updateTransfer(design,state,candidates=>planTransfers(design,state,restoration,candidates),id=>restorationRequestedW(design,restoration,id));
      for(const e of state.transfer.transitions.filter(e=>e.sequence>previous)){const route=design.transfer.routes.find(r=>r.id===e.id)!;appendLog(state,route.tieId,`Transfer ${e.previous} → ${e.status}: ${e.reason}; admitted ${e.admittedW} W; unserved ${e.unservedW} W`,'controller',design.modules.filter(m=>m.platformId===route.recipientPlatformId).map(m=>m.id));}
    }
    const key=state.transfer.attempts.map(a=>`${a.id}:${a.originalClosed}:${a.tieClosed}`).join('|');
    if(ctx.activeKey!==key){ctx.activeKey=key;ctx.active=context(activePowerDesign(design,state));}
    design=activePowerDesign(design,state);ctx=ctx.active!;
  }
  const failed=new Set(state.failedAssetIds);
  const demands=ctx.modules.map((c,i)=>{
    const m=state.modules[i],id=m.id;
    const disabled=failed.has(id)||failed.has(c.module.platformId)||failed.has(`${id}/distribution`)||failed.has(`${id}/battery`);
    const isFailed=(suffix:string)=>failed.has(`${id}/${suffix}`);
    const techBlocked=disabled||isFailed('hx')||isFailed('cdu')||isFailed('valve-tech')||isFailed('pipe-tech');
    const seaBlocked=disabled||isFailed('hx')||isFailed('valve-sea')||isFailed('pipe-sea');
    const previousStates={...m.states},transitions=new Map<string,EquipmentTransition>();
    if(runController)controller(state,m,design,disabled,techBlocked,transitions);
    const pumps=techBlocked?[]:[...(m.states[`${id}/pump-duty`]==='running'?[c.equipment.dutyPump]:[]),...(m.states[`${id}/pump-standby`]==='running'&&c.equipment.standbyPump?[c.equipment.standbyPump]:[])];
    const technical=circuit(c,'technical',pumps,state.pumpSpeed,ctx.hydraulicCache);
    const seawater=circuit(c,'seawater',seaBlocked||isFailed('pump-sea')?[]:[c.equipment.seaPump],state.pumpSpeed,ctx.hydraulicCache);
    let operableNodes=c.module.nodeCount;
    const failedRacks=new Set([...failed].filter(f=>f.startsWith(`${id}/rack-`)&&/^rack-\d+$/.test(f.slice(id.length+1))));
    for(const rid of failedRacks){const rack=Number(rid.split('/rack-')[1]);operableNodes-=Math.min(4,Math.max(0,c.module.nodeCount-(rack-1)*4));}
    for(const f of failed)if(f.startsWith(`${id}/rack-`)&&f.includes('/node-')&&!failedRacks.has(f.split('/node-')[0]))operableNodes--;
    const desiredNodes=disabled?0:Math.max(0,Math.floor(operableNodes*m.throttle));
    const criticalW=technical.electricalW+seawater.electricalW+c.equipment.cdu.ratings.capacityW+c.equipment.moduleSupport.ratings.capacityW+(isFailed('rack-network')?0:c.equipment.network?.ratings.capacityW??0);
    const gridLive=!disabled&&c.supported&&!c.ancestors.some(a=>failed.has(a));
    // Spare upstream power may recharge storage only after module loads; solveElectrical forbids simultaneous charge/discharge.
    const maxChargeW=Math.min(c.equipment.battery.ratings.storageMaxW,Math.max(0,c.equipment.battery.ratings.energyWh-m.batteryWh)*3600/(c.equipment.electrical.chargeEfficiency*(dtS||1)))/c.equipment.electrical.gridEfficiency;
    return {c,m,disabled,techBlocked,seaBlocked,technical,seawater,networkAvailable:true,desiredNodes,criticalW,gridLive,maxChargeW,previousStates,transitions};
  });
  const networkPower=ctx.networkPower(state.failedAssetIds);
  const domainLimits=new Map<string,number>();
  for(const d of demands)domainLimits.set(d.c.module.powerDomainId,Math.max(0,d.c.pathCapacityW-(networkPower.domainGridW.get(d.c.module.powerDomainId)??0)));
  const supply=failed.has('shore/grid')?0:Math.max(0,design.config.supplyW-networkPower.gridW);
  const blockedDomains=new Set<string>(),networkIssues=new Map<string,NetworkIssue>();
  const planElectrical=()=>{
    for(const d of demands)d.networkAvailable=!blockedDomains.has(d.c.module.networkDomainId);
    const requests=demands.map(d=>({domainId:d.c.module.powerDomainId,requestedW:d.gridLive?(d.desiredNodes*nodeDrawW(state.workload,design.config.idleFraction,d.networkAvailable,d.c.equipment.electrical.nodePeakW)+d.criticalW)/d.c.equipment.electrical.gridEfficiency:0,moduleLimitW:d.c.equipment.moduleLimitW}));
    let grid=allocateGrid(requests,supply,domainLimits);
    // Charge only after allocating loads; every trial uses the unchanged beginning-of-step stored energy.
    const spentByDomain=new Map<string,number>();
    demands.forEach((d,i)=>spentByDomain.set(d.c.module.powerDomainId,(spentByDomain.get(d.c.module.powerDomainId)??0)+grid[i]));
    const remainingDomains=new Map([...domainLimits].map(([id,limit])=>[id,Math.max(0,limit-(spentByDomain.get(id)??0))]));
    const charging=allocateGrid(demands.map((d,i)=>({domainId:d.c.module.powerDomainId,requestedW:d.gridLive?d.maxChargeW:0,moduleLimitW:Math.max(0,d.c.equipment.moduleLimitW-grid[i])})),Math.max(0,supply-grid.reduce((a,b)=>a+b,0)),remainingDomains);
    grid=grid.map((p,i)=>p+charging[i]);
    if(design.transfer)grid=allocateActiveGrid(design,state,demands.map((d,i)=>({id:d.m.id,platformId:d.c.module.platformId,domainId:d.c.module.powerDomainId,requestedW:requests[i].requestedW,moduleLimitW:d.c.equipment.moduleLimitW,gridLive:d.gridLive,maxChargeW:d.maxChargeW})),networkPower.allocations);
    return demands.map((d,i)=>solveElectrical({equipment:d.c.equipment.electrical,desiredNodes:d.desiredNodes,workload:state.workload,idleFraction:design.config.idleFraction,networkAvailable:d.networkAvailable,
      criticalLoadW:d.criticalW,gridAvailableW:grid[i],batteryWh:d.m.batteryWh,batteryCapacityWh:d.c.equipment.battery.ratings.energyWh,
      batteryMaxW:d.c.equipment.battery.ratings.storageMaxW,batteryAvailable:!failed.has(`${d.m.id}/battery`),isolated:d.disabled,dtS}));
  };
  let electricalPlan=planElectrical();
  // Offered demand is based on energized inventory even while jobs wait. This avoids idle/overload oscillation.
  // Blocking is monotone within a timestep and releases on the next solve when the constraint clears.
  for(let pass=0;pass<8;pass++){
    const assessment=ctx.network(electricalPlan.map((e,i)=>({id:demands[i].m.id,energizedNodes:e.energizedNodes})),[...state.failedAssetIds,...networkPower.unavailableAssetIds,...(design.equipment?.networkDesign?electricalPlan.flatMap((e,i)=>e.criticalPowered?[]:[`${demands[i].m.id}/rack-network`]):[])]);
    for(const issue of assessment.issues)networkIssues.set(issue.resourceId,issue);
    const newlyBlocked=assessment.blockedDomainIds.filter(id=>!blockedDomains.has(id));
    if(newlyBlocked.length===0)break;
    for(const id of newlyBlocked)blockedDomains.add(id);
    if(pass===7){
      failure('numerical-failure','DISPATCH_NONCONVERGENCE','Network/electrical coupling exceeded eight passes; last validated state retained.',{assetId:'shore/cluster-core',details:{iterations:8}});
    }
    electricalPlan=planElectrical();
  }
  state.facilityEnergyWh+=networkPower.gridW*dtS/3600;state.gridEnergyWh+=networkPower.gridW*dtS/3600;
  for(let i=0;i<demands.length;i++){
    const d=demands[i],m=d.m,electrical=electricalPlan[i];
    // Binary circuit coupling converges in one correction: no critical power means both pump curves are disabled.
    const technical=electrical.criticalPowered?d.technical:ZERO_HYDRAULIC,seawater=electrical.criticalPowered?d.seawater:ZERO_HYDRAULIC;
    const thermal=advanceThermal({coolantK:m.coolantK,airK:m.airK,itW:electrical.itW,facilityW:electrical.facilityW,
      technicalPumpW:technical.electricalW,seawaterPumpW:seawater.electricalW,technicalFlowM3S:technical.flowM3S,seawaterFlowM3S:seawater.flowM3S,
      seawaterK:state.seawaterK,exchangerUAWPerK:d.c.equipment.exchanger.ratings.UAWPerK,liquidCaptureFraction:d.c.equipment.compute.ratings.liquidCaptureFraction,foulingResistanceKPerW:state.foulingResistanceKPerW,fanPowered:electrical.criticalPowered,dtS});
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
      else if(suffix.startsWith('pump-')){if(!electrical.criticalPowered&&(m.states[id]==='running'||m.states[id]==='starting'))m.states[id]='available';}
      else if(suffix==='hx')m.states[id]=technical.flowM3S>0&&seawater.flowM3S>0?'running':'available';
      else m.states[id]=electrical.criticalPowered?'running':'available';
    }
    // Controller state is provisional until its motor receives power. Publish only final transitions.
    for(const suffix of ['pump-duty','pump-standby','pump-sea']){
      const id=`${m.id}/${suffix}`,before=d.previousStates[id],after=m.states[id],transition=d.transitions.get(id);
      if(before===after||after===undefined)continue;
      if(!electrical.criticalPowered&&after==='available'&&(before==='running'||before==='starting')){
        appendLog(state,id,'Pump not powered: critical bus unavailable; motor stopped','controller',[m.id]);
      }else if(after==='running'&&d.previousStates[`${m.id}/distribution`]==='available'){
        appendLog(state,id,`Pump power restored; ${transition?.message??'seawater pump enabled'}`,'controller',[m.id]);
      }else if(transition?.next===after)appendLog(state,id,transition.message,'controller',[m.id]);
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
    if(!d.gridLive&&!d.disabled&&m.batteryWh<=d.c.equipment.battery.ratings.energyWh*d.c.equipment.electrical.batteryReserveFraction+1e-7)warnings.push('UPS reserve reached; no guaranteed ride-through');
    if(Math.abs(electrical.normalizedResidual)>1e-9||Math.abs(thermal.normalizedResidual)>1e-9)failure('numerical-failure','CONSERVATION_RESIDUAL','Conservation tolerance exceeded; no state committed.',{assetId:m.id,details:{electrical:electrical.normalizedResidual,thermal:thermal.normalizedResidual,tolerance:1e-9}});
    if(Math.abs(technical.headResidualPa)>0.01||Math.abs(seawater.headResidualPa)>0.01)failure('numerical-failure','HYDRAULIC_RESIDUAL','Hydraulic operating point did not meet 0.01 Pa head tolerance.',{assetId:m.id,unit:'Pa'});
    for(const warning of warnings)if(!m.warnings.includes(warning)){
      const cause=[...networkIssues.values()].find(issue=>warning.startsWith(issue.reason));
      appendLog(state,cause?.assetId??m.id,warning,'warning',cause?demands.filter(d=>cause.domainIds.includes(d.c.module.networkDomainId)).map(d=>d.m.id):[m.id]);
    }
    m.warnings=warnings;
    state.facilityEnergyWh+=electrical.facilityW*dtS/3600;state.itEnergyWh+=electrical.itW*dtS/3600;state.gridEnergyWh+=electrical.gridW*dtS/3600;
  }
}
export function initialize(design:Design,definition?:ExperimentDefinition):SimulationState {
  validateDesign(design);
  const modules:ModuleState[]=design.modules.map(m=>({id:m.id,coolantK:equipmentFor(design).controlPolicy.initialCoolantK,airK:equipmentFor(design).controlPolicy.initialAirK,batteryWh:resolveSpecification(design,`${m.id}/battery`).ratings.energyWh*equipmentFor(design).controlPolicy.initialBatteryFraction,throttle:1,
    states:{[m.id]:'available',[`${m.id}/pump-duty`]:'running',...(design.config.standbyPumps?{[`${m.id}/pump-standby`]:'standby' as const}:{}),[`${m.id}/pump-sea`]:'running'},startAtS:{},
    technicalFlowM3S:0,seawaterFlowM3S:0,pumpPowerW:0,itW:0,facilityW:0,gridW:0,batteryDischargeW:0,batteryChargeW:0,
    rejectedHeatW:0,thermalResidualW:0,electricalResidualW:0,technicalOutletK:303.15,seawaterOutletK:design.config.seawaterK,pressurePa:0,
    energizedNodes:0,availableAccelerators:0,warnings:[]}));
  const state:SimulationState={schemaVersion:CONTRACT.stateSchema,designRevision:design.revision,designIdentity:engineeringIdentity(design),solverVersion:SOLVER_VERSION,timeS:0,integrationStepS:1,stepIndex:0,modules,events:[],log:[],
    facilityEnergyWh:0,itEnergyWh:0,gridEnergyWh:0,appliedEventIds:[],workload:design.config.workload,seawaterK:design.config.seawaterK,
    foulingResistanceKPerW:design.config.foulingResistanceKPerW,pumpSpeed:design.config.pumpSpeed,failedAssetIds:[],solverMs:0};
  if(design.transfer)state.transfer={...initializeTransfer(design)!,splitTimesS:[]};
  const ctx=context(design);resolveStep(design,state,ctx,0,true);
  if(definition){state.integrationStepS=definition.integrationStepS;attachExperiment(design,state,definition);applyEvents(design,state,ctx);finishExperimentBoundary(state);}
  validateCandidate(design,state);return state;
}
/** Begin a replay from its saved physical initial checkpoint, committing t=0 atomically. */
export function initializeExperimentFromState(design:Design,initialState:SimulationState,definition:ExperimentDefinition):SimulationState {
  validateDesign(design);validateState(design,initialState);
  const state=structuredClone(initialState);
  attachExperiment(design,state,definition);
  applyEvents(design,state,context(design));
  finishExperimentBoundary(state);
  validateCandidate(design,state);
  return state;
}
function validateCandidate(design:Design,state:SimulationState) {
  try { projectFile(design,state); }
  catch(error) { const cause=diagnosticFor(error);failure('numerical-failure','INVALID_CANDIDATE',`Candidate state was not committed: ${cause.message}`,{field:cause.field,assetId:cause.assetId,details:{cause: cause.code}}); }
}
/** Work counts per-module timesteps and per-event boundary dispatches, independent of wall time. */
export function advanceWork(design:Design,state:SimulationState,durationS:number,events:OperationEvent[]=[],stepS:number=state.integrationStepS):number {
  const applied=new Set(state.appliedEventIds),existing=new Set(state.events.map(e=>e.id));
  const due=state.events.filter(e=>e.timeS<=state.timeS+durationS&&!applied.has(e.id)).length+events.filter(e=>!existing.has(e.id)&&e.timeS<=state.timeS+durationS).length;
  return design.modules.length*(durationS/stepS+due);
}
export interface SimulationDispatchObservation { timeS:number; endTimeS:number; gridW:number; phase:'boundary'|'interval' }
/** Optional observer reports canonical dispatch, including transfer substeps; it never changes state. */
export type SimulationDispatchObserver=(observation:SimulationDispatchObservation)=>void;
function upstreamGridW(design:Design,state:SimulationState):number {return state.modules.reduce((sum,module)=>sum+module.gridW,0)+assessNetworkPower(activePowerDesign(design,state),state.failedAssetIds).gridW;}
export function advanceWithStep(design:Design,input:SimulationState,durationS:number,events:OperationEvent[]=[],maxStepS?:number,observer?:SimulationDispatchObserver):SimulationState {
  validateDesign(design);validateState(design,input);
  maxStepS ??= input.integrationStepS;
  finiteNumber(durationS,'advance.durationS',{min:0,max:CONTRACT.maxAdvanceS,integer:true,unit:'s'});
  if(input.timeS+durationS>CONTRACT.horizonS)failure('invalid-input','PROJECT_HORIZON','Advance exceeds the 30-day project horizon.',{unit:'s',details:{max:CONTRACT.horizonS}});
  if(!INTEGRATION_STEPS.includes(maxStepS as IntegrationStep))failure('invalid-input','INTEGRATION_STEP','Verification timestep must be 1, 0.5, 0.25, or 0.125 seconds.');
  if(maxStepS!==input.integrationStepS&&(input.timeS!==0||input.events.length!==0))failure('invalid-input','INTEGRATION_CHANGE','Continuation must retain the checkpoint integration step.');
  const history=mergeEventHistory(design,input.events,events,input.timeS);
  const work=advanceWork(design,input,durationS,events,maxStepS);
  if(work>CONTRACT.maxJobModuleSteps)failure('resource-limit','ADVANCE_WORK','Valid scenario exceeds the per-call execution budget; retain/export it and use bounded worker chunks.',{details:{work,max:CONTRACT.maxJobModuleSteps}});
  // Validate project allocation before numerical work. New events are validated history, not yet applied.
  const state:SimulationState={...input,integrationStepS:maxStepS as IntegrationStep,modules:input.modules.map(m=>({...m,states:{...m.states},startAtS:{...m.startAtS},warnings:[...m.warnings]})),events:history,log:input.log.map(e=>({...e,affectedIds:[...e.affectedIds]})),appliedEventIds:[...input.appliedEventIds],failedAssetIds:[...input.failedAssetIds],solverMs:0,...(input.experiment?{experiment:structuredClone(input.experiment)}:{}),...(input.transfer?{transfer:structuredClone(input.transfer)}:{})};
  admitExperimentInputs(state,events);
  if(state.experiment&&['paused','resource-limited'].includes(state.experiment.status)){state.experiment.status=state.experiment.originTimeS===null?'warming':'running';state.experiment.reason=null;}
  safeJSON({designSnapshot:design,events:history,checkpoint:{state}});
  const ctx=context(design),end=state.timeS+durationS;
  const initiallyApplied=applyEvents(design,state,ctx);
  if(durationS===0&&!initiallyApplied)resolveStep(design,state,ctx,0,false);
  finishExperimentBoundary(state);
  observer?.({timeS:state.timeS,endTimeS:state.timeS,gridW:upstreamGridW(design,state),phase:'boundary'});
  while(state.timeS<end&&!experimentFinished(state)){
    // Each fixed step starts at a committed boundary; chunk endpoints add no controller transitions.
    const before=beginInterval(state);
    const dtS=design.transfer?Math.min(end-state.timeS,maxStepS-(state.timeS%maxStepS),nextTransferDeadline(state)-state.timeS):maxStepS;
    resolveStep(design,state,ctx,dtS,false);
    observer?.({timeS:state.timeS,endTimeS:state.timeS+dtS,gridW:upstreamGridW(design,state),phase:'interval'});
    if(state.experiment){const energy={batteryDischargeWh:0,batteryChargeWh:0,batteryLossWh:0};for(let i=0;i<state.modules.length;i++){const m=state.modules[i],e=ctx.modules[i].equipment.electrical;energy.batteryDischargeWh+=m.batteryDischargeW*dtS/3600;energy.batteryChargeWh+=m.batteryChargeW*dtS/3600;energy.batteryLossWh+=(m.batteryDischargeW*(1/e.dischargeEfficiency-1)+m.batteryChargeW*(1-e.chargeEfficiency))*dtS/3600;}commitExperimentInterval(state,before,dtS,energy);}
    state.timeS+=dtS;
    if(design.transfer){state.stepIndex=Math.floor(state.timeS/maxStepS);if(state.timeS%maxStepS!==0&&!state.transfer!.splitTimesS.includes(state.timeS))state.transfer!.splitTimesS.push(state.timeS);}else state.stepIndex++;
    const warming=state.experiment?.originTimeS===null;
    if(warming)resolveStep(design,state,ctx,0,true);
    prepareExperimentBoundary(design,state);
    if(!applyEvents(design,state,ctx)&&!warming)resolveStep(design,state,ctx,0,true);
    finishExperimentBoundary(state);
    observer?.({timeS:state.timeS,endTimeS:state.timeS,gridW:upstreamGridW(design,state),phase:'boundary'});
    finiteOutputs(state,'simulation accumulators');
  }
  validateCandidate(design,state);return state;
}
export function advance(design:Design,state:SimulationState,durationS:number,events:OperationEvent[]=[]):SimulationState{return advanceWithStep(design,state,durationS,events);}
export function replay(design:Design,events:OperationEvent[],durationS:number):SimulationState{return advance(design,initialize(design),durationS,events);}
export function summarize(design:Design,state:SimulationState):Summary {
  validateState(design,state);
  const sum=(key:keyof Pick<ModuleState,'itW'|'facilityW'|'gridW'|'pumpPowerW'|'availableAccelerators'|'batteryWh'|'electricalResidualW'|'thermalResidualW'>)=>state.modules.reduce((n,m)=>n+m[key],0);
  const rootNetworkW=assessNetworkPower(activePowerDesign(design,state),state.failedAssetIds).gridW;
  const itW=sum('itW'),facilityW=sum('facilityW')+rootNetworkW,energizedAccelerators=state.modules.reduce((n,m)=>n+m.energizedNodes*8,0);
  return finiteOutputs({timeS:state.timeS,itW,facilityW,gridW:upstreamGridW(design,state),pumpPowerW:sum('pumpPowerW'),availableAccelerators:sum('availableAccelerators'),energizedAccelerators,
    curtailedAccelerators:Math.max(0,design.provisionedAccelerators-energizedAccelerators),maxCoolantK:Math.max(...state.modules.map(m=>m.coolantK)),batteryWh:sum('batteryWh'),
    instantaneousPUE:itW>0?facilityW/itW:null,energyPUE:state.itEnergyWh>0?state.facilityEnergyWh/state.itEnergyWh:null,
    electricalResidualW:sum('electricalResidualW'),thermalResidualW:sum('thermalResidualW'),warnings:[...new Set(state.modules.flatMap(m=>m.warnings))]},'simulation summary');
}

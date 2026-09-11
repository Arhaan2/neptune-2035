import { activePowerDesign } from '../transfer/topology';
import { wholeExperimentReport } from '../experiment/report';
import { COST_ASSUMPTIONS, resolveModuleEngineering, resolveSpecification, equipmentFor, engineeringIdentity, economicIdentity } from '../catalog/equipment';
export { COST_ASSUMPTIONS } from '../catalog/equipment';
import { allAssets, buildDesign, reconfigureDesign, connectionsForModule, moduleAssets, packingIssues } from '../assets/design';
import { REFERENCE_SOURCES } from '../catalog/reference';
import { advance, initialize, replay, summarize } from '../engine/simulation';
import { solveExchanger, THERMAL_ASSUMPTIONS as T } from '../solvers/thermal';
import { assessNetwork, assessNetworkProvisioning } from '../solvers/network';
import { assessNetworkPower } from '../solvers/network-power';
import { finiteNumber, finiteOutputs } from '../safety';
import { validateDesign } from '../persistence/design';
import { validateState } from '../persistence/state';
export { projectFile, parseProject } from '../persistence/project';
export type { ProjectFile } from '../persistence/types';
import type { Constraint, Design, DesignConfig, OperationEvent, SimulationState } from '../types';

export function billOfEquipment(design:Design,unitCostScale=equipmentFor(design).economics.unitCostScale){
  validateDesign(design);finiteNumber(unitCostScale,'unitCostScale',{min:0});
  const c=COST_ASSUMPTIONS,platforms=design.assets.filter(a=>a.type==='platform').length;
  let standbyPumps=0,storageKWh=0,pumpPriceAdjustmentUSD=0,storagePriceUSD=0;
  const economics=equipmentFor(design).economics,phase3=!!design.equipment?.networkDesign;
  const missingCostAssetIds:string[]=[],networkItems=new Map<string,{name:string;count:number;unitUSD:number}>();
  if(phase3)for(const asset of allAssets(design)){if(asset.type!=='network')continue;const key=`${asset.catalogId}@${asset.revision}`,price=economics.specificationUnitUSD[key];if(price===undefined){missingCostAssetIds.push(asset.id);continue;}const item=networkItems.get(key);if(item)item.count++;else networkItems.set(key,{name:asset.name,count:1,unitUSD:price});}
  for(const m of design.modules)for(const a of moduleAssets(design,m.id)){
    if(a.type==='pump'&&a.id.endsWith('/pump-standby'))standbyPumps++;
    if(a.type==='pump'){const included=economics.specificationUnitUSD[`${a.catalogId}@${a.revision}`];if(included!==undefined)pumpPriceAdjustmentUSD+=included-c.standbyPumpUSD;}
    if(a.type==='battery'){storageKWh+=a.ratings.energyWh/1000;storagePriceUSD+=economics.specificationUnitUSD[`${a.catalogId}@${a.revision}`]??a.ratings.energyWh/1000*c.storagePerKWhUSD;}
  }
  const rows=[['Compute',design.nodeCount,c.computeUSD],['Racks',design.rackCount,c.rackUSD],['Platform + assumed hull scope',platforms,c.platformUSD],['Cooling base (duty + seawater pumps, HX, CDU)',design.modules.length,c.coolingPerModuleUSD],['Optional standby pumps',standbyPumps,c.standbyPumpUSD],['Electrical base (excludes battery storage)',design.modules.length,c.electricalPerModuleUSD],['Installed battery storage (kWh)',storageKWh,storageKWh>0?storagePriceUSD/storageKWh:0],...(phase3?[]:[['Networking',design.modules.length,c.networkingPerModuleUSD]])].map(([scope,count,unitUSD])=>({scope:String(scope),count:Number(count),unitUSD:Number(unitUSD)*unitCostScale,totalUSD:Number(count)*Number(unitUSD)*unitCostScale}));
  for(const item of networkItems.values())rows.push({scope:`Network: ${item.name} (link allowance included)`,count:item.count,unitUSD:item.unitUSD*unitCostScale,totalUSD:item.count*item.unitUSD*unitCostScale});
  if(pumpPriceAdjustmentUSD!==0)rows.push({scope:'Installed pump specification price adjustment',count:1,unitUSD:pumpPriceAdjustmentUSD*unitCostScale,totalUSD:pumpPriceAdjustmentUSD*unitCostScale});
  for(const asset of design.assets.filter(a=>a.catalogId.startsWith('transfer-'))){const price=economics.specificationUnitUSD[`${asset.catalogId}@${asset.revision}`];if(price===undefined)missingCostAssetIds.push(asset.id);else rows.push({scope:`Transfer: ${asset.name}`,count:1,unitUSD:price*unitCostScale,totalUSD:price*unitCostScale});}
  const equipment=rows.reduce((s,r)=>s+r.totalUSD,0),installation=equipment*c.installationFraction,contingency=(equipment+installation)*c.contingencyFraction;
  rows.forEach(row=>finiteOutputs(row,'cost row'));
  const rangeUSD=[(equipment+installation+contingency)*0.7,(equipment+installation+contingency)*1.5];finiteOutputs(rangeUSD,'cost range');
  return finiteOutputs({missingCostAssetIds,completeWithinIncludedScope:missingCostAssetIds.length===0,networkAccounting:phase3?'Itemized switches including reference link/transceiver allowances replace the full legacy networking-per-module allowance. Shore switch heat is outside module thermal assessment; shore mass stays outside marine totals.':'Original bundled networking allowance retained.',rows,equipment,installation,contingency,totalUSD:equipment+installation+contingency,rangeUSD,date:economics.date,economicIdentity:economicIdentity(design),exclusions:economics.exclusions},'bill of equipment');
}
export function marineScreen(design:Design){
  const masses=new Map<string,number>(),missing:string[]=[];
  for(const platform of design.assets.filter(a=>a.type==='platform'))masses.set(platform.id,0);
  for(const a of allAssets(design)){
    if(!a.id.startsWith('platform-'))continue;
    const pid=a.id.split('/')[0];
    if(a.operationalMassKg===null||!Number.isFinite(a.operationalMassKg)||a.operationalMassKg<0)missing.push(a.id);else masses.set(pid,(masses.get(pid)??0)+a.operationalMassKg);
  }
  return [...masses].map(([platformId,massKg])=>{
    const hulls=design.assets.filter(a=>a.parentId===platformId&&a.type==='hull'),deck=design.assets.find(a=>a.id===platformId);
    const supportedGeometry=hulls.length===2&&hulls.every(a=>a.dimensionsM.every(n=>Number.isFinite(n)&&n>0))&&!!deck&&deck.dimensionsM.every(n=>Number.isFinite(n)&&n>0);
    const waterplaneM2=supportedGeometry?hulls.reduce((sum,a)=>sum+a.dimensionsM[0]*a.dimensionsM[2],0):null;
    const depthM=supportedGeometry?Math.min(...hulls.map(a=>a.dimensionsM[1])):null;
    const draftM=waterplaneM2===null?null:massKg/(1025*waterplaneM2),freeboardM=depthM===null||draftM===null?null:depthM-draftM;
    const deckLoadKgM2=supportedGeometry?(massKg-hulls.reduce((sum,a)=>sum+(a.operationalMassKg??0),0))/(deck!.dimensionsM[0]*deck!.dimensionsM[2]):null;
    return finiteOutputs({platformId,massKg,waterplaneM2,draftM,freeboardM,supportedGeometry,missing:missing.filter(id=>id.startsWith(`${platformId}/`)||id===platformId),deckLoadKgM2},'marine screen');
  });
}
/** Full installed-peak electrical check: storage reserve and local jobs prevent either battery support or network-idle draw from hiding a supply shortage. */
function peakAllocation(design:Design){
  const peakDesign={...design,config:{...design.config,requireClusterNetwork:false,requireExternalNetwork:false,workload:1}};
  const initial=initialize(peakDesign);
  return summarize(peakDesign,advance(peakDesign,{...initial,modules:initial.modules.map(m=>({...m,batteryWh:resolveSpecification(design,`${m.id}/battery`).ratings.energyWh*equipmentFor(design).controlPolicy.batteryReserveFraction}))},0));
}
function peakCooling(design:Design,state:SimulationState){
  return state.modules.map((m,index)=>{
    const equipment=resolveModuleEngineering(design,m.id),peakITW=design.modules[index].nodeCount*equipment.compute.ratings.capacityW;
    // Derive hydraulic-to-electrical work using the same declared pump efficiency as the hydraulic model.
    const active=[...(m.states[`${m.id}/pump-duty`]==='running'?[equipment.dutyPump]:[]),...(m.states[`${m.id}/pump-standby`]==='running'&&equipment.standbyPump?[equipment.standbyPump]:[])];
    const technicalPumpW=active.length?m.pressurePa*m.technicalFlowM3S*active.reduce((sum,p)=>sum+1/p.ratings.efficiency,0)/active.length:0;
    const liquidRequiredW=peakITW*equipment.compute.ratings.liquidCaptureFraction+technicalPumpW*T.pumpToFluidFraction;
    const hx=solveExchanger({technicalInletK:318.15,seawaterInletK:state.seawaterK,technicalFlowM3S:m.technicalFlowM3S,seawaterFlowM3S:m.seawaterFlowM3S,cleanUAWPerK:equipment.exchanger.ratings.UAWPerK,foulingResistanceKPerW:state.foulingResistanceKPerW});
    const peakBusW=peakITW+m.pumpPowerW+equipment.cdu.ratings.capacityW+equipment.moduleSupport.ratings.capacityW+(equipment.network?.ratings.capacityW??0);
    const airRequiredW=peakBusW/Math.min(equipment.electrical.gridEfficiency,equipment.electrical.dischargeEfficiency)-peakITW*equipment.compute.ratings.liquidCaptureFraction-m.pumpPowerW*T.pumpToFluidFraction;
    const airCapacityW=(T.passiveAirConductanceWK+T.fanAirConductanceWK)*(313.15-T.ambientK);
    return {assetId:m.id,liquidRequiredW,liquidCapacityW:hx.heatW,airRequiredW,airCapacityW,passes:m.technicalFlowM3S>0&&m.seawaterFlowM3S>0&&hx.heatW>=liquidRequiredW&&airCapacityW>=airRequiredW};
  });
}
export function constraints(design:Design,state:SimulationState):Constraint[]{
  const s=summarize(design,state),packing=packingIssues(design),marine=marineScreen(design),peak=peakAllocation(design),cooling=peakCooling(design,state),network=assessNetwork(activePowerDesign(design,state),state.modules,state.failedAssetIds),provisioning=assessNetworkProvisioning(design),traffic=equipmentFor(design).workloadProfile;
  const marineKnown=marine.length>0&&marine.every(m=>m.supportedGeometry&&m.missing.length===0),freeboards=marine.flatMap(m=>m.freeboardM===null?[]:[m.freeboardM]);
  const electricalUnsupported=peak.warnings.some(w=>w.includes('Unsupported power topology'));
  return [
    {id:'EL-01',title:'Installed electrical capacity at peak',status:electricalUnsupported?'unsupported':peak.energizedAccelerators===design.provisionedAccelerators?'satisfied':'violated',detail:`Full workload irrespective of network job blocking, cooling and conversion at configured pump speed, with storage held at reserve: ${peak.energizedAccelerators}/${design.provisionedAccelerators} accelerators energizable through rated source/feeders. Installed IT peak ${(design.installedPeakITW/1e6).toFixed(2)} MW; supply ${(design.config.supplyW/1e6).toFixed(2)} MW.`},
    {id:'EL-02',title:'Current load allocation',status:s.curtailedAccelerators===0?'satisfied':'violated',detail:`${s.energizedAccelerators} energized; ${s.availableAccelerators} workload accessible; ${s.curtailedAccelerators} accelerators not energized.`},
    {id:'TH-01',title:'Current bulk coolant and residual air',status:state.modules.some(m=>m.coolantK>=318.15||m.airK>=313.15||m.throttle<1)?'violated':'satisfied',detail:`Maximum coolant ${(s.maxCoolantK-273.15).toFixed(2)} °C at t=${s.timeS}s. Bulk states and thermal-controller curtailment; not GPU junction temperature.`},
    {id:'TH-02',title:'Peak cooling at declared bulk limits',status:cooling.every(m=>m.passes)?'satisfied':'violated',detail:`${cooling.filter(m=>m.passes).length}/${cooling.length} modules can reject whole-server peak heat at 318.15 K coolant and 313.15 K air using current achieved flows, seawater and fouling. Equivalent-loop steady boundary screen, with assumed air conductance; no CFD certification.`},
    {id:'GE-01',title:'Equipment envelope and overlap',status:packing.length?'violated':'satisfied',detail:packing.slice(0,6).join('; ')||'Declared racks/support equipment fit module bounding boxes without overlaps. Service aisles screened by reference layout; fire code unassessed.'},
    {id:'MA-01',title:'Rectangular pontoon displacement',status:!marineKnown?'unassessed':marine.some(m=>m.freeboardM!==null&&m.freeboardM<1)?'violated':'satisfied',detail:marineKnown?`Minimum modeled freeboard ${Math.min(...freeboards).toFixed(2)} m, with 1 m declared reserve. Buoyancy only.`:'Unknown major mass or unsupported/missing two-pontoon geometry; displacement cannot receive a passing status.'},
    {id:'MA-02',title:'Declared deck load',status:!marineKnown?'unassessed':marine.some(m=>m.deckLoadKgM2!==null&&m.deckLoadKgM2>design.assets.find(a=>a.id===m.platformId)!.ratings.deckLimitKgM2)?'violated':'satisfied',detail:'Average supported deck load uses the actual declared deck area and its declared deckLimitKgM2 rating; local point loads and structure unassessed. Unknown mass does not pass.'},
    {id:'NW-01',title:'Workload connectivity',status:network.unsupportedDomainIds.length?'unsupported':network.unreachableDomainIds.length?'violated':s.energizedAccelerators===0?'unassessed':'satisfied',detail:`Cluster required: ${design.config.requireClusterNetwork}; external required: ${design.config.requireExternalNetwork}. Enabled typed-graph paths and failed assets: ${network.unreachableDomainIds.length} unreachable job domains; ${network.unsupportedDomainIds.length} unsupported domains. With no energized compute, current workload reachability is not demonstrated.`},
    {id:'NW-02',title:'Network demand bottleneck',status:state.modules.some(m=>m.warnings.some(w=>w.includes('coupling exceeded eight passes')))?'unsupported':network.status,detail:`Assumed profile ${traffic.id}: ${traffic.clusterBitSPerNode/1e6} Mbit/s cluster + ${traffic.externalBitSPerNode/1e6} Mbit/s external per energized node when each class is required. Declared demand ${(network.clusterDemandBitS/1e9).toFixed(3)} / ${(network.externalDemandBitS/1e9).toFixed(3)} Gbit/s (cluster / external); ${network.energizedNodes} energized nodes. ${network.bottlenecks.length} overloaded edge/port/shared-switch resources; ${network.blockedDomainIds.length} whole job domains unavailable. ${network.issues.slice(0,4).map(i=>i.reason).join('; ')} Zero energized nodes gives zero offered demand. Capacity acceptance is not delivered throughput, packet latency or training speed.`},
    {id:'NW-03',title:'Installed network provisioning',status:provisioning.status,detail:`Full installed inventory, independently of current energized nodes or supply: ${design.nodeCount} nodes offer ${(provisioning.clusterDemandBitS/1e9).toFixed(3)} Gbit/s cluster and ${(provisioning.externalDemandBitS/1e9).toFixed(3)} Gbit/s external. ${provisioning.bottlenecks.length} overloaded resources. ${provisioning.issues.slice(0,4).map(i=>i.reason).join('; ')} Ratings are finite synthetic reference assumptions; no training-performance prediction.`},
    {id:'MA-03',title:'Marine survival and site permission',status:'unassessed',detail:'Intact/damage stability, mooring, fatigue, storms, corrosion, thermal discharge and environmental permissions require independent studies.'},
    {id:'VV-01',title:'Physical calibration / commissioning',status:'unassessed',detail:'Calibration/physical validation pending. No identified facility, compatible measured time series, sensor calibration or commissioning acceptance.'},
  ];
}
/** Bounded scenario acceptance across implemented cuts; unmodeled marine analyses remain excluded. */
export function sizingAssessment(design:Design,state:SimulationState,budgetUSD:number|null=design.config.budgetUSD,costScale=1){
  if(budgetUSD!==null)finiteNumber(budgetUSD,'budgetUSD',{min:0,max:1e13,unit:'USD'});
  const checks=constraints(design,state),required=new Set(['EL-01','EL-02','TH-01','TH-02','GE-01','MA-01','MA-02','NW-01','NW-02','NW-03']);
  const failures=checks.filter(c=>required.has(c.id)&&c.status!=='satisfied').map(c=>`${c.id}: ${c.status}`),cost=billOfEquipment(design,costScale);
  if(!cost.completeWithinIncludedScope)failures.push('Included cost is incomplete: unknown installed network prices');
  if(budgetUSD!==null&&cost.totalUSD>budgetUSD)failures.push('Included-scope cost exceeds budget');
  return {passes:failures.length===0,failures,checks,includedCostUSD:cost.totalUSD,unassessed:checks.filter(c=>!required.has(c.id)&&c.status==='unassessed').map(c=>c.id)};
}
export function csvCell(value:unknown){const s=value===null||value===undefined?'':typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'||typeof value==='bigint'?`${value}`:typeof value==='object'?JSON.stringify(value):'';return `"${(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')}"`;}
export function resultsCSV(design:Design,state:SimulationState){
  validateDesign(design);validateState(design,state);
  const columns=['assetId','designRevision','solverVersion','simulatedTimeS','coolantK','technicalFlowM3S','seawaterFlowM3S','itW','facilityW','batteryWh','electricalResidualW','thermalResidualW'];
  return [columns,...state.modules.map(m=>[m.id,design.revision,state.solverVersion,state.timeS,m.coolantK,m.technicalFlowM3S,m.seawaterFlowM3S,m.itW,m.facilityW,m.batteryWh,m.electricalResidualW,m.thermalResidualW])].map(row=>row.map(csvCell).join(',')).join('\n');
}
export function inventoryCSV(design:Design){validateDesign(design);return [['assetId','type','parent','catalog','specificationVersion','widthM','heightM','depthM','massKg','ratingsSI','evidence'],...Array.from(allAssets(design),a=>[a.id,a.type,a.parentId??'',a.catalogId,a.revision,...a.dimensionsM,a.operationalMassKg??'unknown',JSON.stringify(a.ratings),'assumed'])].map(r=>r.map(csvCell).join(',')).join('\n');}
export function conservationResiduals(design:Design,state:SimulationState,observedSummary?:ReturnType<typeof summarize>){
  const s=observedSummary??summarize(design,state);
  let electricalInputW=assessNetworkPower(activePowerDesign(design,state),state.failedAssetIds).gridW;
  let electricalSumAbsoluteResidualW=0,electricalMaxAbsoluteResidualW=0,electricalMaxAbsoluteNormalized=0;
  let thermalSumAbsoluteResidualW=0,thermalMaxAbsoluteResidualW=0,thermalMaxAbsoluteNormalized=0;
  for(const m of state.modules){
    const depletionW=m.batteryDischargeW/resolveModuleEngineering(design,m.id).electrical.dischargeEfficiency;
    electricalInputW=electricalInputW+m.gridW+depletionW;
    const electricalAbsoluteW=Math.abs(m.electricalResidualW),thermalAbsoluteW=Math.abs(m.thermalResidualW);
    electricalSumAbsoluteResidualW+=electricalAbsoluteW;
    electricalMaxAbsoluteResidualW=Math.max(electricalMaxAbsoluteResidualW,electricalAbsoluteW);
    thermalSumAbsoluteResidualW+=thermalAbsoluteW;
    thermalMaxAbsoluteResidualW=Math.max(thermalMaxAbsoluteResidualW,thermalAbsoluteW);
    // Normalize each component before taking the maximum so other modules cannot dilute its error.
    electricalMaxAbsoluteNormalized=Math.max(electricalMaxAbsoluteNormalized,electricalAbsoluteW/Math.max(1,m.gridW+depletionW));
    thermalMaxAbsoluteNormalized=Math.max(thermalMaxAbsoluteNormalized,thermalAbsoluteW/Math.max(1,m.facilityW));
  }
  const electricalDenominatorW=Math.max(1,electricalInputW),thermalDenominatorW=Math.max(1,s.facilityW);
  return {electricalResidualW:s.electricalResidualW,electricalNormalized:s.electricalResidualW/electricalDenominatorW,thermalResidualW:s.thermalResidualW,thermalNormalized:s.thermalResidualW/thermalDenominatorW,electricalDenominatorW,thermalDenominatorW,
    electricalSumAbsoluteResidualW,electricalMaxAbsoluteResidualW,electricalSumAbsoluteNormalized:electricalSumAbsoluteResidualW/electricalDenominatorW,electricalMaxAbsoluteNormalized,
    thermalSumAbsoluteResidualW,thermalMaxAbsoluteResidualW,thermalSumAbsoluteNormalized:thermalSumAbsoluteResidualW/thermalDenominatorW,thermalMaxAbsoluteNormalized};
}
export function engineeringReport(design:Design,state:SimulationState,costScale=equipmentFor(design).economics.unitCostScale){
  const s=summarize(design,state),c=constraints(design,state),cost=billOfEquipment(design,costScale),residuals=conservationResiduals(design,state),traffic=equipmentFor(design).workloadProfile,network=assessNetworkProvisioning(design);
  return `# NEPTUNE v2 engineering scenario\n\nDesign-stage digital twin · Simulated operation\n\nSimulated, design-stage prototype; physical validation pending.\n\nCreator: Arhaan Aggarwal. Design ${design.revision}; solver ${state.solverVersion}; simulated interval 0–${state.timeS} s. No physical counterpart or measured validation is asserted.\n\n## Inputs and provenance\n\n\`\`\`json\n${JSON.stringify(design.config,null,2)}\n\`\`\`\n\n## Installed specifications and configuration ownership\n\nEngineering fingerprint ${engineeringIdentity(design)}; economic identity ${economicIdentity(design)}. Asset IDs are stable logical slots; installed equipment identity includes specification version and design revision. Hardware replacement starts a separate experiment; prior events and observations remain attached to their old revision.\n\nComponent records own equipment ratings/envelopes/mass. Existing config owns workload requested service/idle fraction and environment seawater/fouling; controller and network-demand records below retain existing behavior. Economic assumptions are separate from physical state.\n\n\`\`\`json\n${JSON.stringify(equipmentFor(design),null,2)}\n\`\`\`\n\n## Network design demand\n\n${network.assessmentBasis}: ${network.energizedNodes} installed nodes, ${network.clusterDemandBitS} bit/s cluster and ${network.externalDemandBitS} bit/s external. Status ${network.status}; capacity assessment is independent of instantaneous energized-node allocation. ${network.bottlenecks.map(b=>`${b.resourceId}: ${b.demandBitS} / ${b.capacityBitS} bit/s; domains ${b.domainIds.join(', ')}`).join('; ')}\n\n${cost.networkAccounting} Root/platform network power uses its declared radial supply without UPS; module switching power consumes its existing critical bus and bulk thermal allowance.\n\n## Results (SI)\n\n\`\`\`json\n${JSON.stringify(s,null,2)}\n\`\`\`\n\n## Equations and boundary\n\nWhole-server IT draw = energized units × installed compute specification peak W × (idle fraction + (1 − idle fraction) × workload). Power capacity allocation includes cooling and losses. Battery ΔE = (η_charge P_charge − P_discharge / η_discharge) Δt / 3600. Hydraulic work = Δp Q / η. Counterflow HX: Q = ε C_min ΔT; NTU = UA / C_min; fouling: UA_eff = 1/(1/UA + R_f). Thermal storage: C dT/dt = Q_generated − Q_removed. Pontoon draft = supported mass / (ρ × actual waterplane). Energy PUE = facility energy / IT energy over 0–${state.timeS}s; zero denominator undefined.\n\n## Constraints\n\n${c.map(x=>`- ${x.id} ${x.title}: **${x.status}** — ${x.detail}`).join('\n')}\n\n## Cost assumptions\n\nDated ${cost.date}; editable cost multiplier ${costScale}; ${cost.completeWithinIncludedScope?'included scope estimate':'known included-scope subtotal; missing prices for '+cost.missingCostAssetIds.join(', ')} USD ${Math.round(cost.totalUSD)}. Range ${cost.rangeUSD.map(Math.round).join('–')} is a paired assumption range, not a statistical confidence interval. ${cost.exclusions} Base electrical allowance excludes separately counted storage. Storage uses the installed specification price when declared; the legacy configured-storage adapter retains its USD ${COST_ASSUMPTIONS.storagePerKWhUSD}/kWh assumption. Cooling and standby base rows include USD ${COST_ASSUMPTIONS.standbyPumpUSD}/pump; the specification price adjustment replaces that amount once for each installed pump. ${cost.networkAccounting} Other class allowances retain their dated reference scope.\n\n## Included cost breakdown\n\n| Scope | Quantity | Assumed unit USD | Total USD |\n| --- | ---: | ---: | ---: |\n${cost.rows.map(r=>`| ${r.scope} | ${r.count} | ${Math.round(r.unitUSD)} | ${Math.round(r.totalUSD)} |`).join('\n')}\n| Installation | 20% of equipment | — | ${Math.round(cost.installation)} |\n| Contingency | 25% of equipment + installation | — | ${Math.round(cost.contingency)} |\n\n## Numerical evidence\n\nElectrical signed total residual ${residuals.electricalResidualW} W; sum of absolute module residuals ${residuals.electricalSumAbsoluteResidualW} W; maximum absolute module residual ${residuals.electricalMaxAbsoluteResidualW} W. Signed total and sum of absolute residuals are ${residuals.electricalNormalized} and ${residuals.electricalSumAbsoluteNormalized}, respectively, normalized by max(1 W, total grid input + battery energy-depletion power). Maximum absolute component-normalized electrical residual: ${residuals.electricalMaxAbsoluteNormalized}.\n\nThermal signed total residual ${residuals.thermalResidualW} W; sum of absolute module residuals ${residuals.thermalSumAbsoluteResidualW} W; maximum absolute module residual ${residuals.thermalMaxAbsoluteResidualW} W. Signed total and sum of absolute residuals are ${residuals.thermalNormalized} and ${residuals.thermalSumAbsoluteNormalized}, respectively, normalized by max(1 W, total facility heat sources). Maximum absolute component-normalized thermal residual: ${residuals.thermalMaxAbsoluteNormalized}.\n\nEach component is normalized before taking the maximum, using max(1 W, module grid input + battery energy-depletion power) for electrical and max(1 W, module facility heat sources) for thermal. Absolute sums and maxima prevent opposing module errors from cancelling; aggregate totals do not replace component checks. Aggregate denominators include separately assessed root/platform network auxiliary input; component residuals cover modules. Inspect docs/v2/MODELS.md and tests for declared tolerances. Software and numerical verification are separate from empirical validation. Calibration/physical validation pending.\n\n## Sources / assumptions\n\n- ${traffic.id} [assumed], revision ${traffic.revision}, ${traffic.date}: cluster ${traffic.clusterBitSPerNode} bit/s/node; external ${traffic.externalBitSPerNode} bit/s/node. ${traffic.scope}\n${REFERENCE_SOURCES.map(r=>`- ${r.id} [${r.evidence}] ${r.title}: ${r.claim} Scope limit: ${r.limit}${r.url?` ${r.url}`:''}`).join('\n')}\n\n## Whole-experiment evaluation\n\n\`\`\`json\n${JSON.stringify(wholeExperimentReport(state),null,2)}\n\`\`\`\n\n## Events\n\n\`\`\`json\n${JSON.stringify(state.events,null,2)}\n\`\`\`\n\nRaw observations, secrets and private data are excluded from this default artifact. Geometry is dimensioned visualization, not manufacturing CAD.\n`;
}
export function signatureEvents(design:Design,moduleId=design.modules[0].id):OperationEvent[]{return [{id:'load',timeS:0,kind:'workload',assetId:'shore/grid',value:1},{id:'trip',timeS:30,kind:'trip',assetId:`${moduleId}/pump-duty`},{id:'restore',timeS:180,kind:'restore',assetId:`${moduleId}/pump-duty`}];}
export function compareRedundancy(design:Design,durationS=240){return [0,1].map(standbyPumps=>{const d=reconfigureDesign(design,{standbyPumps:standbyPumps as 0|1},{removedOverrides:'omit-in-derived-design'});const s=replay(d,signatureEvents(d),durationS);return {design:d,state:s,summary:summarize(d,s)};});}
export function sizingCandidates(config:DesignConfig,maxPlatforms:number,installedDesign?:Design){
  if(!Number.isInteger(maxPlatforms)||maxPlatforms<1||maxPlatforms>200)throw Error('Sizing supports 1–200 platforms.');
  // Bounded discrete search, not a proof of global optimality.
  return [...new Set([1,2,4,8,16,32,64,128,200,maxPlatforms].filter(n=>n<=maxPlatforms))].sort((a,b)=>a-b).map(platforms=>installedDesign?reconfigureDesign(installedDesign,{requestedAccelerators:Math.min(1_000_000,platforms*4*40*4*8)}):buildDesign({...config,requestedAccelerators:Math.min(1_000_000,platforms*4*40*4*8)}));
}
export function topologyForSelection(design:Design,id:string){const m=design.modules.find(m=>id===m.id||id.startsWith(`${m.id}/`));return [...design.connections,...(m?connectionsForModule(design,m.id):[])];}

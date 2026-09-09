import { allAssets, buildDesign, connectionsForModule, moduleAssets, packingIssues, validateConfig } from '../assets/design';
import { REFERENCE_SOURCES } from '../catalog/reference';
import { advance, initialize, replay, summarize, validateEvent } from '../engine/simulation';
import { ELECTRICAL_ASSUMPTIONS as E, GRID_EFFICIENCY } from '../solvers/electrical';
import { solveExchanger, THERMAL_ASSUMPTIONS as T } from '../solvers/thermal';
import { assessNetwork, NETWORK_ASSUMPTIONS } from '../solvers/network';
import { SOLVER_VERSION } from '../types';
import type { Constraint, Design, DesignConfig, OperationEvent, SimulationState } from '../types';

export const COST_ASSUMPTIONS = Object.freeze({date:'2026-09-08', computeUSD:250_000, rackUSD:5000, platformUSD:8e6, coolingPerModuleUSD:575_000, standbyPumpUSD:25_000, electricalPerModuleUSD:600_000, storagePerKWhUSD:500, networkingPerModuleUSD:150_000, installationFraction:0.2, contingencyFraction:0.25});
export function billOfEquipment(design:Design,unitCostScale=1){
  if(!Number.isFinite(unitCostScale)||unitCostScale<0)throw Error('Cost scale must be finite and nonnegative');
  const c=COST_ASSUMPTIONS,platforms=design.assets.filter(a=>a.type==='platform').length;
  let standbyPumps=0,storageKWh=0;
  for(const m of design.modules)for(const a of moduleAssets(design,m.id)){
    if(a.type==='pump'&&a.id.endsWith('/pump-standby'))standbyPumps++;
    if(a.type==='battery')storageKWh+=(a.ratings.energyWh??0)/1000;
  }
  const rows=[['Compute',design.nodeCount,c.computeUSD],['Racks',design.rackCount,c.rackUSD],['Platform + assumed hull scope',platforms,c.platformUSD],['Cooling base (duty + seawater pumps, HX, CDU)',design.modules.length,c.coolingPerModuleUSD],['Optional standby pumps',standbyPumps,c.standbyPumpUSD],['Electrical base (excludes battery storage)',design.modules.length,c.electricalPerModuleUSD],['Installed battery storage (kWh)',storageKWh,c.storagePerKWhUSD],['Networking',design.modules.length,c.networkingPerModuleUSD]].map(([scope,count,unitUSD])=>({scope:String(scope),count:Number(count),unitUSD:Number(unitUSD)*unitCostScale,totalUSD:Number(count)*Number(unitUSD)*unitCostScale}));
  const equipment=rows.reduce((s,r)=>s+r.totalUSD,0),installation=equipment*c.installationFraction,contingency=(equipment+installation)*c.contingencyFraction;
  return {rows,equipment,installation,contingency,totalUSD:equipment+installation+contingency,rangeUSD:[(equipment+installation+contingency)*0.7,(equipment+installation+contingency)*1.5],date:c.date,exclusions:'Land, shore/grid works, finance, permits, taxes, mooring, operations, replacement, proprietary hardware options. Illustrative assumptions; no vendor quotations.'};
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
    return {platformId,massKg,waterplaneM2,draftM,freeboardM,supportedGeometry,missing:missing.filter(id=>id.startsWith(`${platformId}/`)||id===platformId),deckLoadKgM2};
  });
}
/** Full installed-peak electrical check: storage reserve and local jobs prevent either battery support or network-idle draw from hiding a supply shortage. */
function peakAllocation(design:Design){
  const peakDesign={...design,config:{...design.config,requireClusterNetwork:false,requireExternalNetwork:false}};
  const initial=initialize(peakDesign);
  return summarize(peakDesign,advance(peakDesign,{...initial,workload:1,modules:initial.modules.map(m=>({...m,batteryWh:design.config.batteryWhPerModule*E.batteryReserveFraction}))},0));
}
function peakCooling(design:Design,state:SimulationState){
  return state.modules.map((m,index)=>{
    const peakITW=design.modules[index].nodeCount*E.nodePeakW;
    // Derive hydraulic-to-electrical work using the same declared pump efficiency as the hydraulic model.
    const technicalPumpW=m.pressurePa*m.technicalFlowM3S/0.72;
    const liquidRequiredW=peakITW*T.liquidCapture+technicalPumpW*T.pumpToFluidFraction;
    const hx=solveExchanger({technicalInletK:318.15,seawaterInletK:state.seawaterK,technicalFlowM3S:m.technicalFlowM3S,seawaterFlowM3S:m.seawaterFlowM3S,cleanUAWPerK:design.config.exchangerUAWPerK,foulingResistanceKPerW:state.foulingResistanceKPerW});
    const peakBusW=peakITW+m.pumpPowerW+E.controlsWPerModule+E.fanWPerModule;
    const airRequiredW=peakBusW/Math.min(GRID_EFFICIENCY,E.dischargeEfficiency)-peakITW*T.liquidCapture-m.pumpPowerW*T.pumpToFluidFraction;
    const airCapacityW=(T.passiveAirConductanceWK+T.fanAirConductanceWK)*(313.15-T.ambientK);
    return {assetId:m.id,liquidRequiredW,liquidCapacityW:hx.heatW,airRequiredW,airCapacityW,passes:m.technicalFlowM3S>0&&m.seawaterFlowM3S>0&&hx.heatW>=liquidRequiredW&&airCapacityW>=airRequiredW};
  });
}
export function constraints(design:Design,state:SimulationState):Constraint[]{
  const s=summarize(design,state),packing=packingIssues(design),marine=marineScreen(design),peak=peakAllocation(design),cooling=peakCooling(design,state),network=assessNetwork(design,state.modules,state.failedAssetIds);
  const marineKnown=marine.length>0&&marine.every(m=>m.supportedGeometry&&m.missing.length===0),freeboards=marine.flatMap(m=>m.freeboardM===null?[]:[m.freeboardM]);
  const electricalUnsupported=peak.warnings.some(w=>w.includes('Unsupported power topology'));
  return [
    {id:'EL-01',title:'Installed electrical capacity at peak',status:electricalUnsupported?'unsupported':peak.energizedAccelerators===design.provisionedAccelerators?'satisfied':'violated',detail:`Full workload irrespective of network job blocking, cooling and conversion at configured pump speed, with storage held at reserve: ${peak.energizedAccelerators}/${design.provisionedAccelerators} accelerators energizable through rated source/feeders. Installed IT peak ${(design.installedPeakITW/1e6).toFixed(2)} MW; supply ${(design.config.supplyW/1e6).toFixed(2)} MW.`},
    {id:'EL-02',title:'Current load allocation',status:s.curtailedAccelerators===0?'satisfied':'violated',detail:`${s.energizedAccelerators} energized; ${s.availableAccelerators} workload accessible; ${s.curtailedAccelerators} accelerators not energized.`},
    {id:'TH-01',title:'Current bulk coolant and residual air',status:state.modules.some(m=>m.coolantK>=318.15||m.airK>=313.15||m.throttle<1)?'violated':'satisfied',detail:`Maximum coolant ${(s.maxCoolantK-273.15).toFixed(2)} °C at t=${s.timeS}s. Bulk states and thermal-controller curtailment; not GPU junction temperature.`},
    {id:'TH-02',title:'Peak cooling at declared bulk limits',status:cooling.every(m=>m.passes)?'satisfied':'violated',detail:`${cooling.filter(m=>m.passes).length}/${cooling.length} modules can reject whole-server peak heat at 318.15 K coolant and 313.15 K air using current achieved flows, seawater and fouling. Equivalent-loop steady boundary screen, with assumed air conductance; no CFD certification.`},
    {id:'GE-01',title:'Equipment envelope and overlap',status:packing.length?'violated':'satisfied',detail:packing.slice(0,6).join('; ')||'Declared racks/support equipment fit module bounding boxes without overlaps. Service aisles screened by reference layout; fire code unassessed.'},
    {id:'MA-01',title:'Rectangular pontoon displacement',status:!marineKnown?'unassessed':marine.some(m=>m.freeboardM!==null&&m.freeboardM<1)?'violated':'satisfied',detail:marineKnown?`Minimum modeled freeboard ${Math.min(...freeboards).toFixed(2)} m, with 1 m declared reserve. Buoyancy only.`:'Unknown major mass or unsupported/missing two-pontoon geometry; displacement cannot receive a passing status.'},
    {id:'MA-02',title:'Declared deck load',status:!marineKnown?'unassessed':marine.some(m=>m.deckLoadKgM2!==null&&m.deckLoadKgM2>2500)?'violated':'satisfied',detail:'Average supported deck load uses the actual declared deck area and assumed 2500 kg/m² limit; local point loads and structure unassessed. Unknown mass does not pass.'},
    {id:'NW-01',title:'Workload connectivity',status:network.unsupportedDomainIds.length?'unsupported':network.unreachableDomainIds.length?'violated':s.energizedAccelerators===0?'unassessed':'satisfied',detail:`Cluster required: ${design.config.requireClusterNetwork}; external required: ${design.config.requireExternalNetwork}. Enabled typed-graph paths and failed assets: ${network.unreachableDomainIds.length} unreachable job domains; ${network.unsupportedDomainIds.length} unsupported domains. With no energized compute, current workload reachability is not demonstrated.`},
    {id:'NW-02',title:'Network demand bottleneck',status:state.modules.some(m=>m.warnings.some(w=>w.includes('coupling exceeded eight passes')))?'unsupported':network.status,detail:`Assumed profile ${NETWORK_ASSUMPTIONS.id}: ${NETWORK_ASSUMPTIONS.clusterBitSPerNode/1e6} Mbit/s cluster + ${NETWORK_ASSUMPTIONS.externalBitSPerNode/1e6} Mbit/s external per energized node when each class is required. Declared demand ${(network.clusterDemandBitS/1e9).toFixed(3)} / ${(network.externalDemandBitS/1e9).toFixed(3)} Gbit/s (cluster / external); ${network.energizedNodes} energized nodes. ${network.bottlenecks.length} overloaded edge/port resources; ${network.blockedDomainIds.length} whole job domains unavailable. ${network.issues.slice(0,4).map(i=>i.reason).join('; ')} Zero energized nodes gives zero offered demand. Capacity acceptance is not delivered throughput, packet latency or training speed.`},
    {id:'MA-03',title:'Marine survival and site permission',status:'unassessed',detail:'Intact/damage stability, mooring, fatigue, storms, corrosion, thermal discharge and environmental permissions require independent studies.'},
    {id:'VV-01',title:'Physical calibration / commissioning',status:'unassessed',detail:'Calibration/physical validation pending. No identified facility, compatible measured time series, sensor calibration or commissioning acceptance.'},
  ];
}
/** Bounded scenario acceptance across implemented cuts; unmodeled marine analyses remain excluded. */
export function sizingAssessment(design:Design,state:SimulationState,budgetUSD:number|null=design.config.budgetUSD,costScale=1){
  const checks=constraints(design,state),required=new Set(['EL-01','EL-02','TH-01','TH-02','GE-01','MA-01','MA-02','NW-01','NW-02']);
  const failures=checks.filter(c=>required.has(c.id)&&c.status!=='satisfied').map(c=>`${c.id}: ${c.status}`),cost=billOfEquipment(design,costScale);
  if(budgetUSD!==null&&cost.totalUSD>budgetUSD)failures.push('Included-scope cost exceeds budget');
  return {passes:failures.length===0,failures,checks,includedCostUSD:cost.totalUSD,unassessed:checks.filter(c=>!required.has(c.id)&&c.status==='unassessed').map(c=>c.id)};
}
export interface ProjectFile {schemaVersion:2; kind:'neptune-project'; design:DesignConfig; events:OperationEvent[]; timeS:number; sourceMode:'simulated'; solverVersion:string}
export function projectFile(design:Design,state:SimulationState):ProjectFile {return {schemaVersion:2,kind:'neptune-project',design:design.config,events:state.events,timeS:state.timeS,sourceMode:'simulated',solverVersion:state.solverVersion};}
export function parseProject(text:string):ProjectFile{
  if(text.length>2_000_000)throw Error('Project file exceeds 2 MB limit.');
  const parsed:unknown=JSON.parse(text);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Project must be an object');
  const v=parsed as ProjectFile;
  if(v.schemaVersion!==2||v.kind!=='neptune-project'||v.sourceMode!=='simulated')throw Error('Unsupported project kind/version/source mode. Open v1 shared links in Legacy mode.');
  const design=validateConfig(v.design);
  if(v.solverVersion!==SOLVER_VERSION)throw Error(`Unsupported solver version: expected ${SOLVER_VERSION}; explicit migration/recalculation required.`);
  if(!Number.isInteger(v.timeS)||v.timeS<0||v.timeS>86_400||!Array.isArray(v.events)||v.events.length>1000)throw Error('Time or event count exceeds replay bounds.');
  for(const e of v.events)if(!e||typeof e.id!=='string'||e.id.length>160||typeof e.assetId!=='string'||e.assetId.length>160||!Number.isInteger(e.timeS)||e.timeS<0||e.timeS>86_400||!['trip','restore','maintenance','workload','seawater','fouling','pump-speed'].includes(e.kind)||('value'in e&&(!Number.isFinite(e.value)||typeof e.value!=='number')))throw Error('Invalid event record.');
  if(new Set(v.events.map(e=>e.id)).size!==v.events.length)throw Error('Duplicate event IDs.');
  const canonical=buildDesign(design);for(const event of v.events)validateEvent(canonical,event);
  return {schemaVersion:2,kind:'neptune-project',design,events:v.events.map(e=>({id:e.id,timeS:e.timeS,kind:e.kind,assetId:e.assetId,...(e.value===undefined?{}:{value:e.value})})),timeS:v.timeS,sourceMode:'simulated',solverVersion:String(v.solverVersion).slice(0,60)};
}
export function csvCell(value:unknown){const s=value===null||value===undefined?'':typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'||typeof value==='bigint'?`${value}`:typeof value==='object'?JSON.stringify(value):'';return `"${(/^[\s]*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')}"`;}
export function resultsCSV(design:Design,state:SimulationState){
  const columns=['assetId','designRevision','solverVersion','simulatedTimeS','coolantK','technicalFlowM3S','seawaterFlowM3S','itW','facilityW','batteryWh','electricalResidualW','thermalResidualW'];
  return [columns,...state.modules.map(m=>[m.id,design.revision,state.solverVersion,state.timeS,m.coolantK,m.technicalFlowM3S,m.seawaterFlowM3S,m.itW,m.facilityW,m.batteryWh,m.electricalResidualW,m.thermalResidualW])].map(row=>row.map(csvCell).join(',')).join('\n');
}
export function inventoryCSV(design:Design){return [['assetId','type','parent','catalog','widthM','heightM','depthM','massKg','evidence'],...Array.from(allAssets(design),a=>[a.id,a.type,a.parentId??'',a.catalogId,...a.dimensionsM,a.operationalMassKg??'unknown','assumed'])].map(r=>r.map(csvCell).join(',')).join('\n');}
export function conservationResiduals(design:Design,state:SimulationState){
  const s=summarize(design,state),electricalInputW=state.modules.reduce((n,m)=>n+m.gridW+m.batteryDischargeW/E.dischargeEfficiency,0);
  return {electricalResidualW:s.electricalResidualW,electricalNormalized:s.electricalResidualW/Math.max(1,electricalInputW),thermalResidualW:s.thermalResidualW,thermalNormalized:s.thermalResidualW/Math.max(1,s.facilityW),electricalDenominatorW:Math.max(1,electricalInputW),thermalDenominatorW:Math.max(1,s.facilityW)};
}
export function engineeringReport(design:Design,state:SimulationState,costScale=1){
  const s=summarize(design,state),c=constraints(design,state),cost=billOfEquipment(design,costScale),residuals=conservationResiduals(design,state);
  return `# NEPTUNE v2 engineering scenario\n\nDesign-stage digital twin · Simulated operation\n\nCreator: Arhaan Aggarwal. Design ${design.revision}; solver ${state.solverVersion}; simulated interval 0–${state.timeS} s. No physical counterpart or measured validation is asserted.\n\n## Inputs and provenance\n\n\`\`\`json\n${JSON.stringify(design.config,null,2)}\n\`\`\`\n\n## Results (SI)\n\n\`\`\`json\n${JSON.stringify(s,null,2)}\n\`\`\`\n\n## Equations and boundary\n\nWhole-server IT draw = energized units × 12000 W × (idle fraction + (1 − idle fraction) × workload). Power capacity allocation includes cooling and losses. Battery ΔE = (η_charge P_charge − P_discharge / η_discharge) Δt / 3600. Hydraulic work = Δp Q / η. Counterflow HX: Q = ε C_min ΔT; NTU = UA / C_min; fouling: UA_eff = 1/(1/UA + R_f). Thermal storage: C dT/dt = Q_generated − Q_removed. Pontoon draft = supported mass / (ρ × actual waterplane). Energy PUE = facility energy / IT energy over 0–${state.timeS}s; zero denominator undefined.\n\n## Constraints\n\n${c.map(x=>`- ${x.id} ${x.title}: **${x.status}** — ${x.detail}`).join('\n')}\n\n## Cost assumptions\n\nDated ${cost.date}; editable cost multiplier ${costScale}; included scope estimate USD ${Math.round(cost.totalUSD)}. Range ${cost.rangeUSD.map(Math.round).join('–')} is a paired assumption range, not a statistical confidence interval. ${cost.exclusions} Base electrical allowance excludes separately counted installed storage at assumed USD ${COST_ASSUMPTIONS.storagePerKWhUSD}/kWh; base cooling includes duty/seawater pumps but excludes the optional standby pump at assumed USD ${COST_ASSUMPTIONS.standbyPumpUSD}/unit.\n\n## Included cost breakdown\n\n| Scope | Quantity | Assumed unit USD | Total USD |\n| --- | ---: | ---: | ---: |\n${cost.rows.map(r=>`| ${r.scope} | ${r.count} | ${Math.round(r.unitUSD)} | ${Math.round(r.totalUSD)} |`).join('\n')}\n| Installation | 20% of equipment | — | ${Math.round(cost.installation)} |\n| Contingency | 25% of equipment + installation | — | ${Math.round(cost.contingency)} |\n\n## Numerical evidence\n\nElectrical residual ${residuals.electricalResidualW} W (${residuals.electricalNormalized} normalized by max(1 W, total grid input + battery energy-depletion power)); thermal residual ${residuals.thermalResidualW} W (${residuals.thermalNormalized} normalized by max(1 W, total facility heat sources)). Inspect docs/v2/MODELS.md and tests for declared tolerances. Software and numerical verification are separate from empirical validation. Calibration/physical validation pending.\n\n## Sources / assumptions\n\n- ${NETWORK_ASSUMPTIONS.id} [assumed], revision ${NETWORK_ASSUMPTIONS.revision}, ${NETWORK_ASSUMPTIONS.date}: cluster ${NETWORK_ASSUMPTIONS.clusterBitSPerNode} bit/s/node; external ${NETWORK_ASSUMPTIONS.externalBitSPerNode} bit/s/node. ${NETWORK_ASSUMPTIONS.scope}\n${REFERENCE_SOURCES.map(r=>`- ${r.id} [${r.evidence}] ${r.title}: ${r.claim} Scope limit: ${r.limit}${r.url?` ${r.url}`:''}`).join('\n')}\n\n## Events\n\n\`\`\`json\n${JSON.stringify(state.events,null,2)}\n\`\`\`\n\nRaw observations, secrets and private data are excluded from this default artifact. Geometry is dimensioned visualization, not manufacturing CAD.\n`;
}
export function signatureEvents(design:Design,moduleId=design.modules[0].id):OperationEvent[]{return [{id:'load',timeS:0,kind:'workload',assetId:'shore/grid',value:1},{id:'trip',timeS:30,kind:'trip',assetId:`${moduleId}/pump-duty`},{id:'restore',timeS:180,kind:'restore',assetId:`${moduleId}/pump-duty`}];}
export function compareRedundancy(design:Design,durationS=240){return [0,1].map(standbyPumps=>{const d=buildDesign({...design.config,standbyPumps:standbyPumps as 0|1});const s=replay(d,signatureEvents(d),durationS);return {design:d,state:s,summary:summarize(d,s)};});}
export function sizingCandidates(config:DesignConfig,maxPlatforms:number){
  if(!Number.isInteger(maxPlatforms)||maxPlatforms<1||maxPlatforms>200)throw Error('Sizing supports 1–200 platforms.');
  // Bounded discrete search, not a proof of global optimality.
  return [...new Set([1,2,4,8,16,32,64,128,200,maxPlatforms].filter(n=>n<=maxPlatforms))].sort((a,b)=>a-b).map(platforms=>buildDesign({...config,requestedAccelerators:Math.min(1_000_000,platforms*4*40*4*8)}));
}
export function topologyForSelection(design:Design,id:string){const m=design.modules.find(m=>id===m.id||id.startsWith(`${m.id}/`));return [...design.connections,...(m?connectionsForModule(design,m.id):[])];}

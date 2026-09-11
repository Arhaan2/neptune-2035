import type { Asset, AssetType, Design, DesignConfig, Vec3 } from '../types';
import { SOLVER_VERSION } from '../types';
import { failure, finiteNumber } from '../safety';
import { identity, keys, record, string, array } from '../persistence/structure';
import { PHASE3_TRAFFIC_PROFILE, type NetworkDesignConfiguration } from '../network-contract';
import { ALGORITHM_ID, MODEL_ID } from '../persistence/limits';

/** Small synthetic reference catalog. These records are assumptions, not vendor data. */
export type EquipmentRole = 'pump' | 'compute' | 'battery' | 'distribution' | 'exchanger' | 'cdu' | 'pipe' | 'transformer' | 'shoreTransformer' | 'moduleSupport';
export interface SpecificationReference { id: string; version: string }
export interface ComponentSpecification extends SpecificationReference {
  name: string; type: AssetType; compatibility: string;
  dimensionsM: Vec3 | null; operationalMassKg: number | null;
  ratings: Record<string, number>; units: Record<string, string>;
  evidence: 'assumed'; source: string; assumptions: string;
}
export const CONTROL_POLICY = Object.freeze({ id: 'reference-controller', version: '1.0.0', dutyRestartS: 3, standbyStartS: 8, batteryReserveFraction: 0.1, initialCoolantK: 303.15, initialAirK: 298.15, initialBatteryFraction: 1, tripCoolantK: 328.15, tripAirK: 323.15, restartCoolantK: 318.15, restartAirK: 313.15, fullCoolantK: 313.15, fullAirK: 308.15 });
export const TRAFFIC_PROFILE = Object.freeze({ id:'illustrative-job-traffic-v1', revision:'1.0.0', evidence:'assumed', date:'2026-09-08', clusterBitSPerNode:100e6, externalBitSPerNode:1e6, scope:'Simultaneous one-direction source-to-node offered demand per energized node; optional network classes carry no required-job demand. No packet, latency, training-speed or delivered-throughput prediction.' });
export const MODEL_BOUNDARIES = Object.freeze({ id: 'reference-boundaries-1', technicalDensityKgM3: 997, seawaterDensityKgM3: 1025, technicalDynamicViscosityPaS: 0.000855, seawaterDynamicViscosityPaS: 0.00108, technicalFittingsK: 12, seawaterFittingsK: 10, technicalEquipmentDropPa: 80_000, seawaterEquipmentDropPa: 55_000, referenceFlowM3S: 0.05 });
export const COST_ASSUMPTIONS = Object.freeze({date:'2026-09-08', computeUSD:250_000, rackUSD:5000, platformUSD:8e6, coolingPerModuleUSD:575_000, standbyPumpUSD:25_000, electricalPerModuleUSD:600_000, storagePerKWhUSD:500, networkingPerModuleUSD:150_000, installationFraction:0.2, contingencyFraction:0.25});
export interface EconomicAssumptions { version: 1; date: string; unitCostScale: number; specificationUnitUSD: Record<string, number>; exclusions: string }
export interface EquipmentConfiguration {
  schemaVersion: 1; defaults: Record<EquipmentRole, SpecificationReference>; overrides: Record<string, SpecificationReference>;
  specifications: ComponentSpecification[]; controlPolicy: typeof CONTROL_POLICY; workloadProfile: typeof TRAFFIC_PROFILE | typeof PHASE3_TRAFFIC_PROFILE; networkDesign?:NetworkDesignConfiguration;
  economics: EconomicAssumptions;
}
const units: Record<string, string> = {capacityW:'W',shutoffPa:'Pa',freeFlowM3S:'m³/s',efficiency:'1',energyWh:'Wh',storageMaxW:'W',chargeEfficiency:'1',dischargeEfficiency:'1',accelerators:'count',heightU:'U',liquidCaptureFraction:'1',UAWPerK:'W/K',diameterM:'m',roughnessM:'m',portCapacityBitS:'bit/s',switchingCapacityBitS:'bit/s',downlinkPortCount:'count'};
function spec(id:string,name:string,type:AssetType,compatibility:string,dimensionsM:Vec3|null,operationalMassKg:number|null,ratings:Record<string,number>,assumptions='Synthetic reference values retained from the Phase 1 model; no vendor validation or physical calibration.'):ComponentSpecification {
  return {id,version:'1.0.0',name,type,compatibility,dimensionsM,operationalMassKg,ratings,units:Object.fromEntries(Object.keys(ratings).map(k=>[k,units[k]])),evidence:'assumed',source:id.startsWith('network-')?'network-reference-v3':'equipment-v2',assumptions};
}
const networkAssumptions='Synthetic fixed reference switch specification, not vendor validated. All network rates describe one source-to-node direction; shared fabric counts each traversal once. Shore equipment mass is outside floating-platform totals; root switch heat is outside the module thermal model. Link transceivers and cabling are included in the reference switch cost allowance; independent routing, installation and cooling certification are not assessed.';
export const REFERENCE_CATALOG: readonly ComponentSpecification[] = [
  spec('transfer-tie-reference','Reference normally-open transfer tie','switchboard','transfer-switch-v1',[1.5,2,1],700,{capacityW:8.8e6},'Assumed generic rating, dimensions and mass. Zero incremental losses/auxiliaries in this bounded simulation; switching/protection/cable validation excluded.'),
  spec('transfer-isolator-reference','Reference original-path isolator','switchboard','transfer-switch-v1',[1,2,1],400,{capacityW:8.8e6},'Assumed generic rating, dimensions and mass; physical isolation confirmation is simulated. Zero incremental losses/auxiliaries.'),
  spec('transfer-bus-reference','Reference receiving bus','switchboard','transfer-switch-v1',[1,2,1],300,{capacityW:8.8e6},'Assumed generic receiving bus; no vendor specification. Zero incremental losses/auxiliaries.'),
  spec('transformer-reference','Reference platform transformer','transformer','reference-transformer-v1',[3,3,4],8000,{capacityW:8.8e6,efficiency:0.98}),
  spec('shoreTransformer-reference','Reference shore transformer','transformer','reference-shore-transformer-v1',[4,4,6],null,{capacityW:30e6,efficiency:0.98},'Shore mass unknown/outside floating boundary; nominal capacity follows the legacy source-sizing assumption. No independently validated transformer rating.'),
  spec('moduleSupport-reference','Reference module fan auxiliary','external','reference-module-support-v1',null,null,{capacityW:15000},'Existing 15 kW module fan auxiliary allowance. No standalone fan geometry or mass is modeled; both remain unknown.'),
  spec('pump-reference','Reference pump 72%', 'pump','reference-water-pump-v1',[1.2,1.2,0.8],180,{capacityW:45_000,shutoffPa:250_000,freeFlowM3S:0.1,efficiency:0.72}),
  spec('pump-efficient','Efficiency-only pump 84%', 'pump','reference-water-pump-v1',[1.2,1.2,0.8],180,{capacityW:45_000,shutoffPa:250_000,freeFlowM3S:0.1,efficiency:0.84},'Controlled synthetic efficiency comparison: same curve, interfaces, envelope and mass as pump-reference; efficiency only differs.'),
  spec('pump-physical','Physical replacement pump', 'pump','reference-water-pump-v1',[1.35,1.3,0.9],240,{capacityW:55_000,shutoffPa:280_000,freeFlowM3S:0.11,efficiency:0.8},'Declared synthetic replacement fixture. Explicit curve, motor rating, envelope and mass; not a product claim.'),
  spec('compute-reference','DLC-12 whole server','compute','reference-8-accelerator-10U',[0.48,0.4445,0.95],120,{capacityW:12_000,accelerators:8,heightU:10,liquidCaptureFraction:0.9}),
  spec('compute-efficient','DLC-10 whole server fixture','compute','reference-8-accelerator-10U',[0.48,0.4445,0.95],120,{capacityW:10_000,accelerators:8,heightU:10,liquidCaptureFraction:0.85},'Synthetic supported compute alternative with explicitly declared power and liquid capture; no performance equivalence claimed.'),
  spec('battery-reference','Reference 400 kWh storage','battery','reference-module-storage-v1',[2.2,2,1.4],3376.923076923077,{energyWh:400_000,capacityW:2.2e6,storageMaxW:2.2e6,chargeEfficiency:0.95,dischargeEfficiency:0.95}),
  spec('battery-extended','Reference 600 kWh storage fixture','battery','reference-module-storage-v1',[2.4,2.1,1.5],4600,{energyWh:600_000,capacityW:2.2e6,storageMaxW:1.8e6,chargeEfficiency:0.94,dischargeEfficiency:0.94},'Synthetic capacity alternative with independently declared fixed envelope, mass and power ratings. No capacity-based dimensional or mass scaling.'),
  spec('distribution-reference','Reference module conversion','switchboard','reference-module-conversion-v1',[1.4,2,1.4],500,{capacityW:2.2e6,efficiency:0.97}),
  spec('distribution-efficient','Reference conversion 99% fixture','switchboard','reference-module-conversion-v1',[1.4,2,1.4],500,{capacityW:2.0e6,efficiency:0.99}),
  spec('exchanger-reference','Reference plate exchanger','exchanger','reference-two-fluid-hx-v1',[2,2.2,1.4],1800,{UAWPerK:350_000}),
  spec('cdu-reference','Reference coolant distribution','cdu','reference-cdu-v1',[1.2,2,1.1],500,{capacityW:3000}),
  spec('pipe-reference','Reference equivalent-loop pipe','pipe','reference-water-pipe-v1',null,null,{diameterM:0.18,roughnessM:0.000045},'Pipe envelope/length and water mass are derived by the existing fixed routing model; this record declares bore and roughness. No new routing architecture.'),
  spec('network-core-8','Reference 8-port core','network','rooted-network-core-v1',[1.2,2,1.2],400,{capacityW:8000,portCapacityBitS:400e9,switchingCapacityBitS:3.2e12,downlinkPortCount:8},networkAssumptions),
  spec('network-core-32','Reference 32-port core','network','rooted-network-core-v1',[2,2,1.2],900,{capacityW:20000,portCapacityBitS:400e9,switchingCapacityBitS:12.8e12,downlinkPortCount:32},networkAssumptions),
  spec('network-core-256','Reference 256-port core','network','rooted-network-core-v1',[6,2.2,1.5],4000,{capacityW:100000,portCapacityBitS:400e9,switchingCapacityBitS:25.6e12,downlinkPortCount:256},networkAssumptions),
  spec('network-core-undersized','Undersized shared-core reference','network','rooted-network-core-v1',[2,2,1.2],700,{capacityW:3000,portCapacityBitS:400e9,switchingCapacityBitS:400e9,downlinkPortCount:256},networkAssumptions+' Intentionally inadequate synthetic fabric: connector count does not multiply its shared 400 Gbit/s budget.'),
  spec('network-platform','Reference platform switch','network','rooted-network-platform-v1',[2,2,1],600,{capacityW:1500,portCapacityBitS:400e9,switchingCapacityBitS:400e9,downlinkPortCount:4},networkAssumptions),
  spec('network-module','Reference module switch','network','rooted-network-module-v1',[1.1,1.5,0.6],100,{capacityW:3000,portCapacityBitS:400e9,switchingCapacityBitS:400e9,downlinkPortCount:40},networkAssumptions),
].map(s=>Object.freeze({...s,ratings:Object.freeze(s.ratings),units:Object.freeze(s.units),...(s.dimensionsM?{dimensionsM:Object.freeze(s.dimensionsM) as unknown as Vec3}:{})}));
const roles:EquipmentRole[]=['pump','compute','battery','distribution','exchanger','cdu','pipe','transformer','shoreTransformer','moduleSupport'];
const ref=(s:ComponentSpecification):SpecificationReference=>({id:s.id,version:s.version});
export function catalogSpecification(id:string):ComponentSpecification {
  const found=REFERENCE_CATALOG.find(s=>s.id===id);if(!found)failure('unsupported-configuration','SPECIFICATION_REFERENCE',`Unknown reference specification ${id}. Saved versions are never replaced with latest.`);return found;
}
export function createEquipmentConfiguration(config:DesignConfig):EquipmentConfiguration {
  const specifications=structuredClone(REFERENCE_CATALOG) as ComponentSpecification[];
  const defaults=Object.fromEntries(roles.map(role=>[role,ref(catalogSpecification(`${role}-reference`))])) as Record<EquipmentRole,SpecificationReference>;
  if(config.supplyW!==30e6){const tx=spec(`legacy-shore-transformer-${config.supplyW}`,'Configured shore transformer reference','transformer','reference-shore-transformer-v1',[4,4,6],null,{capacityW:config.supplyW,efficiency:0.98},'Deterministic Phase 1 source-sizing adapter; capacity follows configured source, with unknown independent vendor rating and unknown mass.');specifications.push(tx);defaults.shoreTransformer=ref(tx);}
  if(config.batteryWhPerModule!==400_000||config.batteryMaxWPerModule!==2.2e6){
    const battery=spec(`legacy-battery-${config.batteryWhPerModule}-${config.batteryMaxWPerModule}`,'Legacy configured storage reference','battery','reference-module-storage-v1',[2.2,2,1.4],config.batteryWhPerModule/130+300,{energyWh:config.batteryWhPerModule,capacityW:2.2e6,storageMaxW:config.batteryMaxWPerModule,chargeEfficiency:0.95,dischargeEfficiency:0.95},'Deterministic Phase 1 compatibility adapter only: legacy declared mass relationship energyWh / 130 Wh/kg + 300 kg. Fixed legacy envelope. Synthetic assumption, not calibrated; catalog alternatives use their own fixed physical records.');
    specifications.push(battery);defaults.battery=ref(battery);
  }
  if(config.exchangerUAWPerK!==350_000){const hx=spec(`legacy-exchanger-${config.exchangerUAWPerK}`,'Configured exchanger reference','exchanger','reference-two-fluid-hx-v1',[2,2.2,1.4],1800,{UAWPerK:config.exchangerUAWPerK});specifications.push(hx);defaults.exchanger=ref(hx);}
  return {schemaVersion:1,defaults,overrides:{},specifications,controlPolicy:{...CONTROL_POLICY},workloadProfile:{...TRAFFIC_PROFILE},economics:{version:1,date:COST_ASSUMPTIONS.date,unitCostScale:1,specificationUnitUSD:{'pump-reference@1.0.0':25_000,'pump-efficient@1.0.0':25_000,'pump-physical@1.0.0':32_000,'battery-reference@1.0.0':200_000,'battery-extended@1.0.0':300_000,'network-core-8@1.0.0':120_000,'network-core-32@1.0.0':350_000,'network-core-256@1.0.0':1_500_000,'network-core-undersized@1.0.0':50_000,'network-platform@1.0.0':25_000,'network-module@1.0.0':20_000},exclusions:'Land, shore/grid works, finance, permits, taxes, mooring, operations, replacement, proprietary hardware options. Illustrative assumptions; no vendor quotations.'}};
}
export function equipmentFor(design:Design):EquipmentConfiguration { return design.equipment??createEquipmentConfiguration(design.config); }
/** Finite catalog selection: smallest fixed chassis with a port for every platform. */
export function networkSpecificationId(design:Design,assetId:string):string|undefined {
  if(!design.equipment?.networkDesign)return;
  if(assetId==='shore/cluster-core'){
    if(design.equipment.networkDesign.preset==='undersized-shared-core')return 'network-core-undersized';
    const platforms=design.assets.filter(a=>a.type==='platform').length;
    const ports=[8,32,256].find(n=>n>=platforms);
    if(!ports)failure('unsupported-configuration','NETWORK_ENVELOPE','The largest fixed reference chassis supports 256 platform ports.');
    return `network-core-${ports}`;
  }
  if(/^platform-\d+\/cluster$/.test(assetId))return 'network-platform';
  if(/^platform-\d+\/module-\d+\/rack-network$/.test(assetId))return 'network-module';
}
export function networkPorts(installed:ComponentSpecification,core=false):Asset['ports'] {
  const ports:Asset['ports']=[{id:'power-in',medium:'power',direction:'in',capacity:installed.ratings.capacityW,unit:'W'}];
  ports.push(core?{id:'external-network-in',medium:'external-network',direction:'in',capacity:installed.ratings.portCapacityBitS,unit:'bit/s'}:{id:'cluster-in',medium:'cluster',direction:'in',capacity:installed.ratings.portCapacityBitS,unit:'bit/s'});
  for(let n=1;n<=installed.ratings.downlinkPortCount;n++)ports.push({id:`cluster-out-${String(n).padStart(3,'0')}`,medium:'cluster',direction:'out',capacity:installed.ratings.portCapacityBitS,unit:'bit/s'});
  return ports;
}
export function roleForAsset(assetId:string):EquipmentRole|undefined {
  if(assetId==='shore/transformer')return'shoreTransformer';if(assetId.endsWith('/transformer'))return'transformer';
  if(/\/pump-(duty|sea|standby)$/.test(assetId))return'pump';
  if(/\/rack-\d+\/node-\d+$/.test(assetId))return'compute';
  const suffix=assetId.split('/').at(-1);return suffix==='hx'?'exchanger':suffix==='battery'?'battery':suffix==='distribution'?'distribution':suffix==='cdu'?'cdu':suffix?.startsWith('pipe-')?'pipe':undefined;
}
export function resolveSpecification(design:Design,assetIdOrRole:string):ComponentSpecification {
  const equipment=equipmentFor(design),networkId=networkSpecificationId(design,assetIdOrRole);
  const transferAsset=design.transfer&&design.assets.find(a=>a.id===assetIdOrRole&&a.catalogId.startsWith('transfer-'));
  if(transferAsset)return catalogSpecification(transferAsset.catalogId);
  if(networkId){const found=equipment.specifications.find(s=>s.id===networkId&&s.version==='1.0.0');if(!found)failure('unsupported-configuration','SPECIFICATION_REFERENCE',`Unavailable installed network specification ${networkId}@1.0.0.`);return found;}
  const role=roles.includes(assetIdOrRole as EquipmentRole)?assetIdOrRole as EquipmentRole:roleForAsset(assetIdOrRole);
  if(!role)failure('unsupported-configuration','SPECIFICATION_SLOT',`No supported specification slot for ${assetIdOrRole}.`);
  const reference=equipment.overrides[assetIdOrRole]??equipment.defaults[role];
  const found=equipment.specifications.find(s=>s.id===reference.id&&s.version===reference.version);
  if(!found)failure('unsupported-configuration','SPECIFICATION_REFERENCE',`Unavailable specification ${reference.id}@${reference.version}; no substitution was made.`,{assetId:assetIdOrRole});
  return found;
}
export function resolveAssetSpecification(design:Design,asset:Asset):Asset {
  const networkId=networkSpecificationId(design,asset.id);
  if(networkId){const installed=resolveSpecification(design,asset.id);return {...asset,name:installed.name,catalogId:installed.id,revision:installed.version,dimensionsM:[...installed.dimensionsM!],operationalMassKg:installed.operationalMassKg,ratings:{...installed.ratings},ports:networkPorts(installed,asset.id==='shore/cluster-core'),provenance:[installed.source]};}
  const role=roleForAsset(asset.id);if(!role)return asset;
  const installed=resolveSpecification(design,asset.id);
  return {...asset,catalogId:installed.id,revision:installed.version,dimensionsM:installed.dimensionsM?[...installed.dimensionsM]:asset.dimensionsM,operationalMassKg:role==='pipe'?asset.operationalMassKg:installed.operationalMassKg,ratings:role==='pipe'?{...asset.ratings,...installed.ratings}:{...installed.ratings},provenance:[installed.source],ports:asset.ports.map(p=>p.medium==='power'&&installed.ratings.capacityW!==undefined?{...p,capacity:installed.ratings.capacityW}:p)};
}
/** Persisted root equipment is a checked projection, never a second specification owner. */
export function validateInstalledAsset(design:Design,asset:Asset):void {
  if(!design.equipment)return; // Preserve the original Phase 1 snapshot for explicit legacy inspection/recalculation.
  if(asset.catalogId.startsWith('transfer-')){const s=catalogSpecification(asset.catalogId);for(const field of ['type','dimensionsM','operationalMassKg','ratings'] as const)if(identity(asset[field])!==identity(s[field]))failure('invalid-input','SPECIFICATION_ASSET_DRIFT','Transfer equipment differs from its immutable specification.',{assetId:asset.id,field});if(asset.revision!==s.version)failure('invalid-input','SPECIFICATION_ASSET_DRIFT','Transfer specification revision differs.');return;}
  const networkId=networkSpecificationId(design,asset.id);
  if(networkId){
    if(asset.id.endsWith('/rack-network'))failure('invalid-input','SPECIFICATION_ASSET_OVERRIDE','Module network equipment is generated from its immutable installed specification.',{assetId:asset.id});
    const expected=resolveAssetSpecification(design,asset);
    for(const field of ['type','catalogId','revision','dimensionsM','operationalMassKg','ratings','ports'] as const)if(identity(asset[field])!==identity(expected[field]))failure('invalid-input','SPECIFICATION_ASSET_DRIFT',`Installed network specification disagrees with ${field}.`,{assetId:asset.id,field});
    return;
  }
  const role=roleForAsset(asset.id);
  if(!role){
    if(asset.type==='transformer')failure('unsupported-configuration','SPECIFICATION_SLOT',`Transformer ${asset.id} has no supported installed specification slot.`,{assetId:asset.id});
    return;
  }
  // Module equipment is generated from its installed records. A persisted duplicate
  // would override the inspector while the solver continued to use the generated asset.
  if(role!=='transformer'&&role!=='shoreTransformer')failure('invalid-input','SPECIFICATION_ASSET_OVERRIDE',`Installed module equipment ${asset.id} must resolve from its specification; a stored asset cannot override the generated inventory.`,{assetId:asset.id});
  const installed=resolveSpecification(design,asset.id);
  const expected={type:installed.type,catalogId:installed.id,revision:installed.version,dimensionsM:installed.dimensionsM,operationalMassKg:installed.operationalMassKg,ratings:installed.ratings};
  for(const field of Object.keys(expected) as (keyof typeof expected)[]){
    if(identity(asset[field])!==identity(expected[field]))failure('invalid-input','SPECIFICATION_ASSET_DRIFT',`Installed specification ${installed.id}@${installed.version} disagrees with stored ${field} for ${asset.id}; restore the declared specification or apply a supported replacement.`,{assetId:asset.id,field});
  }
  // Both supported transformer compatibility classes declare one input/output pair
  // at the installed power rating. Connection limits remain separate topology inputs.
  const expectedPorts=['in','out'].map(direction=>({id:`power-${direction}`,medium:'power',direction,capacity:installed.ratings.capacityW,unit:'W'}));
  const sortedPorts=[...asset.ports].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(identity(sortedPorts)!==identity(expectedPorts))failure('invalid-input','SPECIFICATION_ASSET_DRIFT',`Installed specification ${installed.id}@${installed.version} requires its declared power input/output interfaces and ratings.`,{assetId:asset.id,field:'ports'});
}
export function validateEquipment(design:Design):void {
  if(!design.equipment)return;const e=design.equipment;
  record(e,'equipment');keys(e,['schemaVersion','defaults','overrides','specifications','controlPolicy','workloadProfile','economics','networkDesign'],'equipment');if(e.schemaVersion!==1)failure('unsupported-configuration','EQUIPMENT_SCHEMA','Unsupported equipment catalog schema.');
  array(e.specifications,'equipment.specifications',32);const ids=new Set<string>();
  const allowed=[...REFERENCE_CATALOG,...createEquipmentConfiguration(design.config).specifications];
  for(const s of e.specifications){record(s,'specification');const key=`${s.id}@${s.version}`;if(ids.has(key))failure('invalid-input','SPECIFICATION_DUPLICATE',`Duplicate specification ${key}.`);ids.add(key);const canonical=allowed.find(a=>a.id===s.id&&a.version===s.version);if(!canonical)failure('unsupported-configuration','SPECIFICATION_VERSION',`Unavailable immutable specification ${key}.`);if(identity(canonical)!==identity(s))failure('invalid-input','SPECIFICATION_CONTENT',`Immutable specification ${key} differs from its declared version (ratings, units, dimensions or provenance).`);}
  record(e.defaults,'equipment.defaults');keys(e.defaults,roles,'defaults');
  for(const role of roles){record(e.defaults[role],`default ${role}`);keys(e.defaults[role],['id','version'],'reference');const s=resolveSpecification(design,role);if(s.compatibility!==catalogSpecification(`${role}-reference`).compatibility)failure('unsupported-configuration','SPECIFICATION_COMPATIBILITY',`Incompatible specification in ${role} slot.`);}
  record(e.overrides,'equipment.overrides');if(Object.keys(e.overrides).length>10_000)failure('invalid-input','SPECIFICATION_OVERRIDES','Too many installed overrides.');
  for(const [slot,reference] of Object.entries(e.overrides)){string(slot,'equipment slot',180);record(reference,'reference');keys(reference,['id','version'],'reference');const role=roleForAsset(slot);if(!role||!['pump','battery'].includes(role)||!design.modules.some(m=>slot.startsWith(`${m.id}/`)&&slot.slice(m.id.length+1).indexOf('/')===-1)||(slot.endsWith('/pump-standby')&&!design.config.standbyPumps))failure('unsupported-configuration','SPECIFICATION_SLOT',`Unsupported or removed installed slot ${slot}; historical mappings cannot be retargeted.`);if(resolveSpecification(design,slot).compatibility!==catalogSpecification(`${role}-reference`).compatibility)failure('unsupported-configuration','SPECIFICATION_COMPATIBILITY',`Incompatible replacement at ${slot}.`);}
  if(identity(e.controlPolicy)!==identity(CONTROL_POLICY))failure('unsupported-configuration','CONTROL_POLICY','Unknown controller version or changed policy; this release supports the declared reference controller only.');
  if(e.networkDesign){record(e.networkDesign,'networkDesign');keys(e.networkDesign,['id','version','preset'],'networkDesign');if(e.networkDesign.id!=='rooted-reference-network'||e.networkDesign.version!=='1.0.0'||!['scalable-reference','undersized-shared-core'].includes(e.networkDesign.preset))failure('unsupported-configuration','NETWORK_VERSION','Unknown network design/version; no latest substitution is supported.');if(identity(e.workloadProfile)!==identity(PHASE3_TRAFFIC_PROFILE))failure('unsupported-configuration','WORKLOAD_PROFILE','Phase 3 requires its exact versioned workload and routing assumptions.');for(const a of design.assets.filter(a=>a.type==='network'))resolveSpecification(design,a.id);}
  else if(identity(e.workloadProfile)!==identity(TRAFFIC_PROFILE))failure('unsupported-configuration','WORKLOAD_PROFILE','Legacy topology requires the unchanged original workload profile.');
  record(e.economics,'economics');keys(e.economics,['version','date','unitCostScale','specificationUnitUSD','exclusions'],'economics');if(e.economics.version!==1)failure('unsupported-configuration','ECONOMIC_VERSION','Unsupported economic assumption version.');string(e.economics.date,'economics.date',40);string(e.economics.exclusions,'economics.exclusions');finiteNumber(e.economics.unitCostScale,'economics.unitCostScale',{min:0,max:100});record(e.economics.specificationUnitUSD,'unit costs');for(const [key,cost] of Object.entries(e.economics.specificationUnitUSD)){string(key,'cost specification');if(!ids.has(key))failure('unsupported-configuration','ECONOMIC_REFERENCE',`Cost references unknown specification ${key}.`);finiteNumber(cost,'specificationUnitUSD',{min:0,max:1e12,unit:'USD'});}
}
/** Stable non-security run identity. Prices, formatting and unused catalog entries are excluded. */
export function engineeringIdentity(design:Design):string {
  return engineeringIdentityForVersion(design,SOLVER_VERSION);
}
/** Retained identity calculation only for inspecting known 2.3.0 snapshots, never for runtime dispatch. */
export function historicalEngineeringIdentity(design:Design,solverVersion:'2.3.0'):string {
  if(solverVersion!=='2.3.0')failure('unsupported-configuration','HISTORICAL_IDENTITY_VERSION','Only the archived 2.3.0 identity is available for historical inspection.');
  return engineeringIdentityForVersion(design,solverVersion);
}
function engineeringIdentityForVersion(design:Design,solverVersion:string):string {
  if(!design.equipment)return identity(design); // Phase 1 checkpoint binding remains inspectable without reinterpretation.
  const {equipment,config}=design;
  const engineeringConfig={schemaVersion:config.schemaVersion,generation:config.generation,requestedAccelerators:config.requestedAccelerators,supplyW:config.supplyW,standbyPumps:config.standbyPumps,seawaterK:config.seawaterK,workload:config.workload,idleFraction:config.idleFraction,exchangerUAWPerK:config.exchangerUAWPerK,foulingResistanceKPerW:config.foulingResistanceKPerW,batteryWhPerModule:config.batteryWhPerModule,batteryMaxWPerModule:config.batteryMaxWPerModule,pumpSpeed:config.pumpSpeed,requireExternalNetwork:config.requireExternalNetwork,requireClusterNetwork:config.requireClusterNetwork};
  const assets=design.assets.map(a=>({id:a.id,type:a.type,parentId:a.parentId,catalogId:a.catalogId,revision:a.revision,dimensionsM:a.dimensionsM,positionM:a.positionM,operationalMassKg:a.operationalMassKg,ratings:a.ratings,ports:[...a.ports].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),failureDomain:a.failureDomain}));
  const installed=new Set([...Object.values(equipment.defaults),...Object.values(equipment.overrides)].map(r=>`${r.id}@${r.version}`));
  if(equipment.networkDesign){for(const asset of design.assets){const id=networkSpecificationId(design,asset.id);if(id)installed.add(`${id}@1.0.0`);}installed.add('network-module@1.0.0');}
  const specifications=equipment.specifications.filter(s=>installed.has(`${s.id}@${s.version}`)).map(s=>({id:s.id,version:s.version,type:s.type,compatibility:s.compatibility,dimensionsM:s.dimensionsM,operationalMassKg:s.operationalMassKg,ratings:s.ratings,units:s.units})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const workloadProfile=equipment.networkDesign?equipment.workloadProfile:{id:equipment.workloadProfile.id,revision:equipment.workloadProfile.revision,clusterBitSPerNode:equipment.workloadProfile.clusterBitSPerNode,externalBitSPerNode:equipment.workloadProfile.externalBitSPerNode};
  return identity({...(design.transfer?{transfer:design.transfer,transferModel:'neptune-transfer-1'}:{}),schemaVersion:design.schemaVersion,assets,connections:design.connections,modules:design.modules,nodeCount:design.nodeCount,rackCount:design.rackCount,provisionedAccelerators:design.provisionedAccelerators,installedPeakITW:design.installedPeakITW,config:engineeringConfig,equipment:{schemaVersion:equipment.schemaVersion,defaults:equipment.defaults,overrides:equipment.overrides,specifications,controlPolicy:equipment.controlPolicy,workloadProfile,...(equipment.networkDesign?{networkDesign:equipment.networkDesign}:{})},modelBoundaries:MODEL_BOUNDARIES,modelId:equipment.networkDesign?MODEL_ID:'neptune-reference-2',algorithmId:ALGORITHM_ID,solverVersion:equipment.networkDesign?solverVersion:'2.2.0'});
}
export function economicIdentity(design:Design):string { return identity({economics:equipmentFor(design).economics,budgetUSD:design.config.budgetUSD,costs:COST_ASSUMPTIONS}); }
export function updateEconomicAssumptions(design:Design,patch:Partial<EconomicAssumptions>):Design {
  const next={...design,equipment:{...equipmentFor(design),economics:{...equipmentFor(design).economics,...patch}}};validateEquipment(next);return next;
}
export function installedEquipmentIdentity(design:Design,assetId:string):string {const s=resolveSpecification(design,assetId);return `${assetId}::${s.id}@${s.version}::${design.revision}`;}
/** Resolve equipment once at the module/design boundary; no frame-dependent values. */
export function resolveModuleEngineering(design:Design,moduleId:string) {
  const get=(suffix:string)=>resolveSpecification(design,`${moduleId}/${suffix}`);
  const compute=resolveSpecification(design,'compute'),battery=get('battery'),distribution=get('distribution');
  const module=design.modules.find(m=>m.id===moduleId);if(!module)failure('invalid-input','MODULE_REFERENCE',`Unknown module ${moduleId}.`);
  let upstreamEfficiency=1,id=module.powerDomainId;const visited=new Set<string>();
  while(id!=='shore/grid'&&!visited.has(id)){visited.add(id);const asset=design.assets.find(a=>a.id===id);if(asset?.type==='transformer')upstreamEfficiency*=design.equipment?resolveSpecification(design,id).ratings.efficiency:asset.ratings.efficiency;const edges=design.connections.filter(c=>c.to===id&&c.medium==='power'&&c.enabled);if(edges.length!==1)break;id=edges[0].from;}
  return {network:design.equipment?.networkDesign?get('rack-network'):null,dutyPump:get('pump-duty'),seaPump:get('pump-sea'),standbyPump:design.config.standbyPumps?get('pump-standby'):null,compute,battery,distribution,exchanger:get('hx'),cdu:get('cdu'),pipe:get('pipe-tech'),moduleSupport:resolveSpecification(design,'moduleSupport'),
    moduleLimitW:Math.min(battery.ratings.capacityW,distribution.ratings.capacityW),
    electrical:{nodePeakW:compute.ratings.capacityW,gridEfficiency:upstreamEfficiency*distribution.ratings.efficiency,chargeEfficiency:battery.ratings.chargeEfficiency,dischargeEfficiency:battery.ratings.dischargeEfficiency,batteryReserveFraction:equipmentFor(design).controlPolicy.batteryReserveFraction}};
}

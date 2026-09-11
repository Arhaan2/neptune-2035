import { createExperimentDefinition } from '../experiment/definition';
import { counterfactualDefinition, comparePair } from '../experiment/runner';
import { wholeExperimentReport, experimentRecoveryReport } from '../experiment/report';
import { billOfEquipment } from '../analysis/reports';
import { engineeringIdentity } from '../catalog/equipment';
import { projectFile } from '../persistence/project';
import type { Design, OperationEvent, SimulationState } from '../types';
import { createTransferReferenceDesign } from './design';
export const PHASE5_QUALIFIER='Simulated, design-stage prototype; physical validation pending.';
export const PHASE5_CASES={eligible:'Eligible feeder failure',bus:'Receiving bus failure (no benefit)',disabled:'Transfer disabled',partial:'Partial restoration (shared donor)',source:'Common source failure',tie:'Tie unavailable',donor:'Donor unavailable',representative:'Representative campus'} as const;
export type Phase5Case=keyof typeof PHASE5_CASES;
export interface TransferRunResult { label:string;generation:2|3;role:'faulted'|'unfaulted';design:Design;state:SimulationState }
/** Declared before observing candidate results. Every comparison retains identical demand/environment/horizon. */
export function transferDemonstration(kind:Phase5Case='eligible') {
  return([2,3] as const).flatMap(generation=>{
    const design=createTransferReferenceDesign(generation,{enabled:kind!=='disabled',representative:kind==='representative'}),platform='platform-002',feeder=design.modules.find(m=>m.platformId===platform)!.powerDomainId;
    if(kind==='partial'){
      const edge=design.connections.find(e=>e.medium==='power'&&e.from==='shore/grid'&&e.to==='platform-001/transformer')!;edge.capacity=140_000;design.revision=`phase5-partial-${engineeringIdentity(design)}`;
    }
    const route=design.transfer?.routes.find(r=>r.recipientPlatformId===platform),events:OperationEvent[]=[];
    const fault=(id:string,assetId:string,timeS=2)=>events.push({id,kind:'trip',assetId,timeS});
    if(kind==='source')fault('common-source-failure','shore/grid');
    else if(kind==='bus')fault('receiving-domain-failure',route?.receivingBusId??feeder);
    else{
      fault('recipient-feeder-failure',route?.originalFeederId??feeder);
      if(kind==='partial'){const other=design.transfer?.routes.find(r=>r.recipientPlatformId==='platform-003');fault('second-recipient-feeder-failure',other?.originalFeederId??design.modules.find(m=>m.platformId==='platform-003')!.powerDomainId);}
      if(kind==='tie'&&route)fault('tie-unavailable',route.tieId,1);
      if(kind==='donor')fault('donor-unavailable',design.transfer?.routes[0].donorBusId??design.modules.find(m=>m.platformId==='platform-001')!.powerDomainId,1);
    }
    const definition=createExperimentDefinition(design,{id:`phase5-${kind}-generation-${generation}`,name:`Generation ${generation===2?'II':'III'} · ${PHASE5_CASES[kind]}`,durationS:12,disturbances:events,initial:{mode:'cold'},recovery:{dwellS:5},note:'Declared Phase5 fixture: three whole platforms;24 accelerators (or10,248 representative campus),workload0.8,seawater291.15K,no UPS energy or power in either design,12s horizon,fault2s,transfer delay2.375s. Sparse platforms intentionally retain full module cooling/network auxiliaries. GenerationIII adds explicit normally-open hardware; tie-failure disturbance exists only where that hardware is installed. Fault footprints use physical platform002 (and003 for partial), never array position. Each architecture has its own unfaulted baseline.'});
    return[{label:`Generation ${generation===2?'II':'III'} faulted`,generation,role:'faulted' as const,design,definition},{label:`Generation ${generation===2?'II':'III'} unfaulted`,generation,role:'unfaulted' as const,design,definition:counterfactualDefinition(design,definition)}];
  });
}
export function transferComparisonReport(kind:Phase5Case,runs:TransferRunResult[]) {
  const ii=runs.find(r=>r.generation===2&&r.role==='faulted'),iii=runs.find(r=>r.generation===3&&r.role==='faulted');
  const signed=ii&&iii&&ii.state.experiment?.status==='completed'&&iii.state.experiment?.status==='completed'?{convention:'signed Generation III minus Generation II absolute outcomes; negative shortfall means lower unmet demand',shortfallAcceleratorS:iii.state.experiment.metrics.shortfallAcceleratorS-ii.state.experiment.metrics.shortfallAcceleratorS,serviceViolationS:iii.state.experiment.metrics.serviceViolationS-ii.state.experiment.metrics.serviceViolationS,includedCostUSD:billOfEquipment(iii.design).totalUSD-billOfEquipment(ii.design).totalUSD}:null;
  return{kind:'neptune-phase5-comparison',version:1,case:kind,qualifier:PHASE5_QUALIFIER,signed,scope:'Single-hop whole-platform controlled transfer; ordinary grid source remains common. All ratings/prices are generic assumptions. Hardware is owned by its installed platform regardless of active supplying path.',exclusions:'No vendor validation, protection coordination, switching transients, actuator/standby draw, incremental tie/bus losses, cable/civil/commissioning cost, meshed flow, parallel sources, automatic retransfer, or training throughput. Existing conversion losses, pumps, thermal and required-network dependencies remain modeled.',runs:runs.map(r=>({label:r.label,generation:r.generation,role:r.role,project:projectFile(r.design,r.state),report:wholeExperimentReport(r.state),recovery:experimentRecoveryReport(r.state),transfer:r.state.transfer??null,includedEquipment:billOfEquipment(r.design),addedTransferAssets:r.design.assets.filter(a=>a.catalogId.startsWith('transfer-'))})),faultImpact:([2,3] as const).map(generation=>{const f=runs.find(r=>r.generation===generation&&r.role==='faulted'),b=runs.find(r=>r.generation===generation&&r.role==='unfaulted');return{generation,comparison:f&&b?comparePair(f.state,b.state):null};})};
}

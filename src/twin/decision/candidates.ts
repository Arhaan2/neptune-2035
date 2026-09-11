import { buildDesign, DEFAULT_CONFIG, withNetworkPreset } from '../assets/design';
import { createTransferReferenceDesign } from '../transfer/design';
import { engineeringIdentity, equipmentFor } from '../catalog/equipment';
import { identity } from '../persistence/structure';
import { SOLVER_VERSION } from '../types';
import { METRICS_VERSION } from '../experiment/types';
import { DECISION_VERSION, DECISION_QUALIFIER, type DecisionCampaign, type DecisionCandidate, type DecisionFixture, type DecisionSensitivity } from './types';

export const PAIRED_SENSITIVITIES:DecisionSensitivity[]=[
  {id:'central',label:'Central assumptions',parameter:'central',value:null,evidence:'exploratory-assumption'},
  {id:'idle-lower',label:'Idle draw lower: 0.2',parameter:'idleFraction',value:0.2,evidence:'exploratory-assumption'},
  {id:'idle-upper',label:'Idle draw upper: 0.4',parameter:'idleFraction',value:0.4,evidence:'exploratory-assumption'},
  {id:'ua-lower',label:'Clean UA lower: 280,000 W/K',parameter:'exchangerUAWPerK',value:280000,evidence:'exploratory-assumption'},
  {id:'ua-upper',label:'Clean UA upper: 420,000 W/K',parameter:'exchangerUAWPerK',value:420000,evidence:'exploratory-assumption'},
  {id:'fouling-lower',label:'Fouling lower: clean (same as central)',parameter:'foulingResistanceKPerW',value:0,evidence:'exploratory-assumption'},
  {id:'fouling-upper',label:'Fouling upper: 0.000002 K/W',parameter:'foulingResistanceKPerW',value:0.000002,evidence:'exploratory-assumption'},
  {id:'cost-lower',label:'Included equipment cost lower: 0.7×',parameter:'unitCostScale',value:0.7,evidence:'exploratory-assumption'},
  {id:'cost-upper',label:'Included equipment cost upper: 1.5×',parameter:'unitCostScale',value:1.5,evidence:'exploratory-assumption'},
];
export function decisionCandidate(id:string,label:string,design:DecisionCandidate['design']):DecisionCandidate {
  return {id,label,design,physicalIdentity:engineeringIdentity(design),specificationIdentity:identity(equipmentFor(design)),workload:design.config.requestedAccelerators,topology:design.transfer?.topology??'single-supply-radial',controllerPolicy:design.transfer?`${design.transfer.policy}:${design.transfer.enabled?'enabled':'disabled'}`:'legacy-non-transferring'};
}
export function createDecisionCampaign(fixture:DecisionFixture='transfer',overrides:{objective?:Partial<DecisionCampaign['objective']>;requirements?:Partial<DecisionCampaign['requirements']>}={}):DecisionCampaign {
  const sizing=fixture==='sizing';
  const candidates=sizing?[8,16,24,32,40,48].map(capacity=>decisionCandidate(`ii-${capacity}`,`Generation II · ${capacity} accelerators`,withNetworkPreset(buildDesign({...DEFAULT_CONFIG,generation:2,requestedAccelerators:capacity,supplyW:30e6,batteryWhPerModule:0,batteryMaxWPerModule:0,requireExternalNetwork:true}),'scalable-reference'))):[
    decisionCandidate('ii-24','Generation II · 24 accelerators',createTransferReferenceDesign(2)),
    decisionCandidate('iii-24','Generation III enabled · 24 accelerators',createTransferReferenceDesign(3)),
    decisionCandidate('iii-disabled-24','Generation III policy disabled · 24 accelerators',createTransferReferenceDesign(3,{enabled:false})),
  ];
  const scenarios:DecisionCampaign['scenarios']=[{id:'nominal',label:'Nominal · 12 s',kind:'nominal',durationS:12,disturbanceTimeS:null,initialMode:'cold',settling:'not-requested'}];
  if(!sizing&&fixture!=='nominal')scenarios.push({id:'eligible-feeder',label:'Eligible feeder fault · 12 s',kind:'eligible-feeder',durationS:12,disturbanceTimeS:2,initialMode:'cold',settling:'not-requested'});
  if(fixture==='no-benefit-bus')scenarios.push({id:'receiving-bus',label:'Receiving bus fault · no transfer benefit',kind:'receiving-bus',durationS:12,disturbanceTimeS:2,initialMode:'cold',settling:'not-requested'});
  if(fixture==='no-benefit-source')scenarios.push({id:'common-source',label:'Common source fault · no independent source',kind:'common-source',durationS:12,disturbanceTimeS:2,initialMode:'cold',settling:'not-requested'});
  if(sizing||fixture==='sensitivity')scenarios.push({id:'thermal',label:'Cold thermal observation · 120 s; settling not requested',kind:'thermal',durationS:120,disturbanceTimeS:null,initialMode:'cold',settling:'not-requested'});
  return {version:DECISION_VERSION,id:`phase6-${fixture}`,name:`Phase 6 · ${fixture}`,fixture,qualifier:DECISION_QUALIFIER,
    objective:{mode:sizing?'maximum-passing-workload':'minimum-included-cost',unit:sizing?'accelerators':'USD',direction:sizing?'descending':'ascending',fixedWorkload:sizing?null:24,supplyCeilingW:sizing?120000:null,budgetUSD:null,budgetBasis:'central',rankingCostBasis:'central',tieRule:'within-tolerance-shared-rank-then-stable-id',...overrides.objective},
    requirements:{nominalUnmetAcceleratorS:0,faultUnmetAcceleratorS:24,totalInterruptionS:3,thermalViolationS:0,recoveryConfirmationDeadlineS:10,recoveryDwellS:5,timeOrigin:'absolute-evaluation-time',...overrides.requirements},candidates,scenarios,sensitivities:structuredClone(fixture==='sensitivity'?PAIRED_SENSITIVITIES:PAIRED_SENSITIVITIES.slice(0,1)),
    tolerances:{seconds:1e-8,acceleratorSeconds:1e-8,watts:1e-6,USD:0.01,accelerators:0,kelvin:1e-6,nearBindingFraction:0.01},versions:{solver:SOLVER_VERSION,metrics:METRICS_VERSION,schema:2,decision:DECISION_VERSION},execution:{concurrency:2,integrationStepS:1,traceSamples:160,maxModuleSteps:250000},
    costPolicy:{currency:'USD',equipmentScaleLower:0.7,equipmentScaleCentral:1,equipmentScaleUpper:1.5,authority:'billOfEquipment',installation:'20%-of-equipment',contingency:'25%-of-equipment-plus-installation'},
    exclusions:['No global or continuous optimization; only the declared discrete candidates were assessed.','Marine stability, mooring, fatigue, permitting and environmental consequences unassessed.','Protection coordination, switching transients and physical validation unassessed.','Transfer shares the ordinary upstream source; no independent source, meshed flow or automatic retransfer.','Included cost excludes land, shore/grid works, finance, permits, taxes, mooring, operations and replacements; no construction quote or ownership cost.','No vendor performance equivalence or real-world reliability claim.','Thermal results cover the declared cold observation only; no settled or long-term adequacy claim.'],sensitivityNote:'Exploratory OFAT assumptions, not manufacturer bounds or confidence intervals. Clean UA and fouling overlap through effective conductance. Clean lower fouling duplicates central. Joint combinations are untested.'};
}

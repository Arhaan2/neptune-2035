import { buildDesign, DEFAULT_CONFIG } from '../assets/design';
import type { Design } from '../types';
import { createExperimentDefinition } from './definition';

export function referenceExperiment(design: Design, settled = false) {
  return createExperimentDefinition(design,{id:'phase4-reference-core',name:'20 second network interruption',durationS:20,initial:{mode:settled?'settled':'cold'},disturbances:[{id:'reference-core-trip',kind:'trip',assetId:'shore/cluster-core',timeS:5},{id:'reference-core-restore',kind:'restore',assetId:'shore/cluster-core',timeS:15}],note:'Core connectivity unavailable over [5,15) seconds; restored final service must not erase the integrated interruption.'});
}
export function signatureDemonstration() {
  return([0,1] as const).map(standbyPumps=>{
    const design=buildDesign({...DEFAULT_CONFIG,requestedAccelerators:1280,workload:1,standbyPumps});
    const definition=createExperimentDefinition(design,{id:`phase4-signature-${standbyPumps}`,name:standbyPumps?'One standby pump':'No standby pump',durationS:1800,disturbances:[{id:'signature-duty-trip',kind:'trip',assetId:`${design.modules[0].id}/pump-duty`,timeS:30},{id:'signature-duty-restore',kind:'restore',assetId:`${design.modules[0].id}/pump-duty`,timeS:300}],note:'Same single-module full installed workload and duty-pump disturbance [30,300)s. The supported design difference is one installed standby pump versus none. Independent baselines belong to each design; close final bulk coolant means difference <=0.01 K and air <=0.1 K at 1800 seconds.'});
    return{design,definition};
  });
}

import { executeDecisionRun } from './runner';
import type { DecisionCampaign, DecisionRunEvidence, PlannedDecisionRun } from './types';
export interface DecisionWorkerRequest { version:1; epoch:number; run:PlannedDecisionRun; settings:DecisionCampaign['execution'] }
export interface DecisionWorkerResponse { version:1; epoch:number; evidence:DecisionRunEvidence }
if(typeof self!=='undefined'&&typeof document==='undefined'){
  self.onmessage=(event:MessageEvent<DecisionWorkerRequest>)=>{const request=event.data;if(request.version!==1)return;void executeDecisionRun(request.run,request.settings).then(evidence=>self.postMessage({version:1,epoch:request.epoch,evidence} satisfies DecisionWorkerResponse));};
}

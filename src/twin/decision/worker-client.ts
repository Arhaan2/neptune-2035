import type { DecisionRunExecutor } from './types';
import type { DecisionWorkerRequest, DecisionWorkerResponse } from './worker';
/** Includes the canonical run's 120 s wall limit plus 5 s for worker startup/reporting. */
export const DECISION_WORKER_TIMEOUT_MS = 125_000;
/** Lazy fixed pool; reuse two workers across cells, terminate the pool on cancellation. */
export function createDecisionWorkerExecutor():DecisionRunExecutor & {dispose:()=>void} {
  const pool:{worker:Worker;busy:boolean;cancel?:()=>void}[]=[];let epoch=0;
  const executor:DecisionRunExecutor=(run,settings,signal)=>new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(Error('Decision campaign cancelled.'));return;}
    let slot=pool.find(s=>!s.busy);
    if(!slot){if(pool.length>=2){reject(Error('Decision worker pool concurrency exceeded.'));return;}slot={worker:new Worker(new URL('./worker.ts',import.meta.url),{type:'module'}),busy:false};pool.push(slot);}
    const assigned=slot;assigned.busy=true;const mine=++epoch;let settled=false;
    const remove=()=>{assigned.worker.terminate();const index=pool.indexOf(assigned);if(index>=0)pool.splice(index,1);};
    const cleanup=()=>{settled=true;clearTimeout(watchdog);signal?.removeEventListener('abort',abort);assigned.worker.onmessage=null;assigned.worker.onerror=null;assigned.busy=false;assigned.cancel=undefined;};
    const fail=(error:Error)=>{if(settled)return;cleanup();remove();reject(error);};
    const abort=()=>fail(Error('Decision campaign cancelled.'));
    const watchdog=setTimeout(()=>{
      if(settled)return;cleanup();remove();
      resolve({id:run.id,candidateId:run.candidateId,scenarioId:run.scenarioId,sensitivityId:run.sensitivityId,status:'resource-limited',reason:`Decision worker produced no completed response within ${DECISION_WORKER_TIMEOUT_MS/1000} s; its process was terminated.`,state:null,peakSupply:null,hardConstraints:[],recovery:null,incrementalShortfallAcceleratorS:null});
    },DECISION_WORKER_TIMEOUT_MS);
    assigned.cancel=abort;
    signal?.addEventListener('abort',abort,{once:true});
    assigned.worker.onmessage=(event:MessageEvent<DecisionWorkerResponse>)=>{const response=event.data;if(settled||response?.version!==1||response.epoch!==mine||response.evidence?.id!==run.id)return;cleanup();resolve(response.evidence);};
    assigned.worker.onerror=(event)=>fail(Error(event.message||'Decision worker execution failed.'));
    try{assigned.worker.postMessage({version:1,epoch:mine,run,settings} satisfies DecisionWorkerRequest);}catch(error){fail(error instanceof Error?error:Error(String(error)));}
  });
  return Object.assign(executor,{dispose:()=>{const disposed=pool.splice(0);for(const slot of disposed){if(slot.cancel)slot.cancel();else slot.worker.terminate();}}});
}

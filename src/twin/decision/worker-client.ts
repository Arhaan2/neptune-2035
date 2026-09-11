import type { DecisionRunExecutor } from './types';
import type { DecisionWorkerRequest, DecisionWorkerResponse } from './worker';
/** Lazy fixed pool; reuse two workers across cells, terminate the pool on cancellation. */
export function createDecisionWorkerExecutor():DecisionRunExecutor & {dispose:()=>void} {
  const pool:{worker:Worker;busy:boolean}[]=[];let epoch=0;
  const executor:DecisionRunExecutor=(run,settings,signal)=>new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(Error('Decision campaign cancelled.'));return;}
    let slot=pool.find(s=>!s.busy);
    if(!slot){if(pool.length>=2){reject(Error('Decision worker pool concurrency exceeded.'));return;}slot={worker:new Worker(new URL('./worker.ts',import.meta.url),{type:'module'}),busy:false};pool.push(slot);}
    const assigned=slot;assigned.busy=true;const mine=++epoch;
    const cleanup=()=>{signal?.removeEventListener('abort',abort);assigned.worker.onmessage=null;assigned.worker.onerror=null;assigned.busy=false;};
    const abort=()=>{cleanup();assigned.worker.terminate();const index=pool.indexOf(assigned);if(index>=0)pool.splice(index,1);reject(Error('Decision campaign cancelled.'));};
    signal?.addEventListener('abort',abort,{once:true});
    assigned.worker.onmessage=(event:MessageEvent<DecisionWorkerResponse>)=>{const response=event.data;if(response.version!==1||response.epoch!==mine||response.evidence.id!==run.id)return;cleanup();resolve(response.evidence);};
    assigned.worker.onerror=(event)=>{cleanup();assigned.worker.terminate();const index=pool.indexOf(assigned);if(index>=0)pool.splice(index,1);reject(Error(event.message||'Decision worker execution failed.'));};
    assigned.worker.postMessage({version:1,epoch:mine,run,settings} satisfies DecisionWorkerRequest);
  });
  return Object.assign(executor,{dispose:()=>{for(const slot of pool)slot.worker.terminate();pool.length=0;}});
}

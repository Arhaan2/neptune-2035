import type { WorkerRequest, WorkerResponse } from '../types';
import { advance, initialize } from './simulation';

/** Chunking yields macrotasks so cancellation messages can interrupt long replays. */
export function createWorkerHandler(post:(response:WorkerResponse)=>void, yieldTask:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,0)), now:()=>number=()=>performance.now()) {
  let activeEpoch=-1, lastRequestId=-1, token=0;
  return async (request:WorkerRequest):Promise<void>=>{
    const response={version:2 as const,requestId:request.requestId,epoch:request.epoch};
    if(request.version!==2||!Number.isSafeInteger(request.requestId)||!Number.isSafeInteger(request.epoch)||request.requestId<0||request.epoch<0){post({...response,error:'Invalid version, request ID, or epoch'});return;}
    if(request.epoch<activeEpoch||(request.epoch===activeEpoch&&request.requestId<=lastRequestId))return;
    activeEpoch=request.epoch;lastRequestId=request.requestId;const mine=++token;
    if(request.kind==='cancel'){post(response);return;}
    const start=now();
    try{
      if(!request.design)throw Error('Worker request requires a canonical design');
      if(!['initialize','advance','replay'].includes(request.kind))throw Error('Unknown worker operation');
      let state=request.kind==='advance'?request.state:initialize(request.design);
      if(!state)throw Error('Advance requires numerical state');
      const duration=request.kind==='initialize'?0:request.durationS??0;
      if(!Number.isInteger(duration)||duration<0||duration>86400)throw Error('Worker duration must be 0–86400 integer seconds');
      state=advance(request.design,state,0,request.events??[]);
      let remaining=duration;
      while(remaining>0){
        await yieldTask();
        if(mine!==token)return;
        const chunk=Math.min(10,remaining);
        state=advance(request.design,state,chunk);remaining-=chunk;
      }
      if(mine!==token)return;
      state.solverMs=Math.max(0,now()-start);
      post({...response,state});
    }catch(error){if(mine===token)post({...response,error:error instanceof Error?error.message:String(error)});}
  };
}
if(typeof self!=='undefined'&&typeof document==='undefined'){
  const handler=createWorkerHandler(response=>self.postMessage(response));
  self.onmessage=(event:MessageEvent<WorkerRequest>)=>{void handler(event.data);};
}

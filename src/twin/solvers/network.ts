import { connectionsForModule, moduleAssets } from '../assets/design';
import type { Asset, Connection, Design } from '../types';

/** Declared illustrative offered demand, not measured traffic or achieved throughput. */
export const NETWORK_ASSUMPTIONS = Object.freeze({
  id:'illustrative-job-traffic-v1', revision:'1.0.0', evidence:'assumed', date:'2026-09-08',
  clusterBitSPerNode:100e6, externalBitSPerNode:1e6,
  scope:'Simultaneous one-direction source-to-node offered demand per energized node; optional network classes carry no required-job demand. No packet, latency, training-speed or delivered-throughput prediction.',
});
export interface TrafficProfile { clusterBitSPerNode:number; externalBitSPerNode:number }
export interface NetworkIssue { assetId:string; resourceId:string; reason:string; domainIds:string[] }
export interface NetworkBottleneck extends NetworkIssue { demandBitS:number; capacityBitS:number }
export interface NetworkAssessment {
  status:'satisfied'|'violated'|'unsupported'; energizedNodes:number; clusterDemandBitS:number; externalDemandBitS:number;
  blockedDomainIds:string[]; unreachableDomainIds:string[]; unsupportedDomainIds:string[];
  bottlenecks:NetworkBottleneck[]; issues:NetworkIssue[]; maxUtilization:number;
}
export interface NetworkAllocation { id:string; energizedNodes:number }
interface Resource { id:string; assetId:string; capacity:number }
interface Edge { connection:Connection; from:number; to:number; resources:number[]; invalid:boolean }
interface Tree { source:number; parent:Int32Array; order:number[]; reachable:Uint8Array; unsupported:Uint8Array }

/** Compile exact graph edges and shared ports once; runtime traversals are linear in graph size. */
function compile(design:Design){
  const ids:string[]=[], index=new Map<string,number>(), resources:Resource[]=[], resourceIndex=new Map<string,number>();
  const edges:Edge[]=[], outgoing:number[][]=[], leaves=new Map<string,number[]>();
  const vertex=(id:string)=>{let n=index.get(id);if(n===undefined){n=ids.length;ids.push(id);index.set(id,n);outgoing.push([]);}return n;};
  const resource=(id:string,assetId:string,capacity:number)=>{
    let n=resourceIndex.get(id);if(n===undefined){n=resources.length;resources.push({id,assetId,capacity});resourceIndex.set(id,n);}
    else resources[n].capacity=Math.min(resources[n].capacity,capacity);
    return n;
  };
  const rootAssets=new Map(design.assets.map(a=>[a.id,a]));
  const add=(c:Connection,assets:Map<string,Asset>)=>{
    if(c.medium!=='cluster'&&c.medium!=='external-network')return;
    const fromAsset=assets.get(c.from)??rootAssets.get(c.from),toAsset=assets.get(c.to)??rootAssets.get(c.to);
    const fromPort=fromAsset?.ports.find(p=>p.id===c.fromPort),toPort=toAsset?.ports.find(p=>p.id===c.toPort);
    const invalid=!fromPort||!toPort||fromPort.medium!==c.medium||toPort.medium!==c.medium||fromPort.direction==='in'||toPort.direction==='out'||[c.capacity,fromPort.capacity,toPort.capacity].some(n=>!Number.isFinite(n)||n<0);
    const from=vertex(c.from),to=vertex(c.to),r=[resource(`edge:${c.id}`,c.from,c.capacity),resource(`port:${c.from}:${c.fromPort}`,c.from,fromPort?.capacity??0),resource(`port:${c.to}:${c.toPort}`,c.to,toPort?.capacity??0)];
    outgoing[from].push(edges.length);edges.push({connection:c,from,to,resources:r,invalid});
  };
  for(const c of design.connections)add(c,rootAssets);
  for(const m of design.modules){
    const assets=moduleAssets(design,m.id),local=new Map(assets.map(a=>[a.id,a]));
    leaves.set(m.id,assets.filter(a=>a.type==='compute').map(a=>vertex(a.id)));
    for(const c of connectionsForModule(design,m.id))add(c,local);
  }
  vertex('shore/cluster-core');vertex('shore/fiber');
  function tree(sourceId:string,external:boolean,failed:Set<string>,diagnostic=false):Tree{
    const source=index.get(sourceId)!,parent=new Int32Array(ids.length).fill(-1),reachable=new Uint8Array(ids.length),unsupported=new Uint8Array(ids.length),order:number[]=[];
    const allowed=(e:Edge)=>external||e.connection.medium==='cluster';
    if(!failed.has(sourceId)||diagnostic){reachable[source]=1;order.push(source);}
    for(let q=0;q<order.length;q++)for(const ei of outgoing[order[q]]){
      const e=edges[ei];if(!allowed(e)||(!diagnostic&&(!e.connection.enabled||failed.has(ids[e.to]))))continue;
      if(reachable[e.to]){if(!diagnostic)unsupported[e.to]=1;}
      else{reachable[e.to]=1;parent[e.to]=ei;order.push(e.to);}
      if(e.invalid&&!diagnostic)unsupported[e.to]=1;
    }
    // Propagate ambiguous parents/cycles/invalid ports to every dependent leaf, without inventing ECMP.
    const invalidQueue=order.filter(n=>unsupported[n]);
    for(let q=0;q<invalidQueue.length;q++)for(const ei of outgoing[invalidQueue[q]]){
      const e=edges[ei];if(allowed(e)&&reachable[e.to]&&!unsupported[e.to]){unsupported[e.to]=1;invalidQueue.push(e.to);}
    }
    return {source,parent,order,reachable,unsupported};
  }
  const diagnosticCluster=tree('shore/cluster-core',false,new Set(),true),diagnosticExternal=tree('shore/fiber',true,new Set(),true);
  return {ids,index,resources,edges,leaves,tree,diagnosticCluster,diagnosticExternal};
}

/** Pure evaluator closure; caches only the last identical numerical query, never simulation state. */
export function createNetworkEvaluator(design:Design,profile:TrafficProfile=NETWORK_ASSUMPTIONS){
  if([profile.clusterBitSPerNode,profile.externalBitSPerNode].some(n=>!Number.isFinite(n)||n<0||n>1e12))throw Error('Traffic demand must be finite within 0–1e12 bit/s per node');
  const clusterRate=design.config.requireClusterNetwork?profile.clusterBitSPerNode:0,externalRate=design.config.requireExternalNetwork?profile.externalBitSPerNode:0;
  let graph:ReturnType<typeof compile>|undefined,lastKey='',lastResult:NetworkAssessment|undefined;
  return (allocations:readonly NetworkAllocation[],failedAssetIds:readonly string[]=[]):NetworkAssessment=>{
    if(allocations.length!==design.modules.length||allocations.some((a,i)=>a.id!==design.modules[i].id||!Number.isInteger(a.energizedNodes)||a.energizedNodes<0||a.energizedNodes>design.modules[i].nodeCount))throw Error('Network allocation must match the whole-node module inventory');
    const failed=new Set(failedAssetIds),key=`${allocations.map(a=>a.energizedNodes).join(',')}|${[...failed].sort().join(',')}`;
    if(lastResult&&key===lastKey)return lastResult;
    const energizedNodes=allocations.reduce((n,a)=>n+a.energizedNodes,0);
    const result:NetworkAssessment={status:'satisfied',energizedNodes,clusterDemandBitS:energizedNodes*clusterRate,externalDemandBitS:energizedNodes*externalRate,blockedDomainIds:[],unreachableDomainIds:[],unsupportedDomainIds:[],bottlenecks:[],issues:[],maxUtilization:0};
    if(energizedNodes===0||(!design.config.requireClusterNetwork&&!design.config.requireExternalNetwork)){lastKey=key;lastResult=result;return result;}
    graph??=compile(design);const g=graph,resourceLoads=new Float64Array(g.resources.length),issues=new Map<string,NetworkIssue>(),blocked=new Set<string>(),unreachable=new Set<string>(),unsupported=new Set<string>();
    const record=(assetId:string,resourceId:string,reason:string,domainId:string)=>{
      let issue=issues.get(resourceId);if(!issue){issue={assetId,resourceId,reason,domainIds:[]};issues.set(resourceId,issue);}
      if(!issue.domainIds.includes(domainId))issue.domainIds.push(domainId);blocked.add(domainId);
    };
    // Deterministically energize the first N operable inventory nodes, the same count used by electrical dispatch.
    const active=allocations.map((a,i)=>{
      const m=design.modules[i];if(failed.has(m.id)||failed.has(m.platformId))return [];
      const nodes=g.leaves.get(a.id)!.filter(n=>!failed.has(g.ids[n])&&!failed.has(g.ids[n].slice(0,g.ids[n].lastIndexOf('/'))));
      if(nodes.length<a.energizedNodes)throw Error('Energized network allocation exceeds operable node inventory');
      return nodes.slice(0,a.energizedNodes);
    });
    const channels:[boolean,number,string,Tree][]=[];
    if(design.config.requireClusterNetwork)channels.push([false,clusterRate,'cluster',g.tree('shore/cluster-core',false,failed)]);
    if(design.config.requireExternalNetwork)channels.push([true,externalRate,'external',g.tree('shore/fiber',true,failed)]);
    for(const [external,rate,label,t] of channels){
      const loads=new Float64Array(g.ids.length),diagnostic=external?g.diagnosticExternal:g.diagnosticCluster;
      active.forEach((nodes,i)=>{const domain=design.modules[i].networkDomainId;for(const node of nodes){
        if(t.unsupported[node]){unsupported.add(domain);record(g.ids[node],`unsupported:${label}:${domain}`,`Required ${label} path has multiple enabled parents, a cycle, or invalid ports`,domain);}
        else if(!t.reachable[node]){
          unreachable.add(domain);let cursor=node,cause=g.ids[node],resourceId=`unreachable:${label}:${domain}`;
          while(cursor>=0){if(failed.has(g.ids[cursor])){cause=g.ids[cursor];resourceId=`failed:${cause}`;break;}const ei=diagnostic.parent[cursor];if(ei<0)break;const e=g.edges[ei];if(!e.connection.enabled){cause=e.connection.from;resourceId=`edge:${e.connection.id}`;break;}cursor=e.from;}
          record(cause,resourceId,`Required ${label} path unreachable through ${cause}`,domain);
        }else loads[node]+=rate;
      }});
      for(let q=t.order.length-1;q>=0;q--){const n=t.order[q],ei=t.parent[n];if(ei<0||t.unsupported[n]||loads[n]===0)continue;const e=g.edges[ei];loads[e.from]+=loads[n];for(const r of e.resources)resourceLoads[r]+=loads[n];}
    }
    const bottleneckByResource=new Map<number,NetworkBottleneck>();
    for(let r=0;r<g.resources.length;r++){
      const resource=g.resources[r],load=resourceLoads[r];if(load===0)continue;
      result.maxUtilization=Math.max(result.maxUtilization,resource.capacity>0?load/resource.capacity:Infinity);
      if(load>resource.capacity+Math.max(1,resource.capacity*1e-9))bottleneckByResource.set(r,{assetId:resource.assetId,resourceId:resource.id,demandBitS:load,capacityBitS:resource.capacity,reason:`Declared offered demand ${(load/1e9).toFixed(3)} Gbit/s exceeds ${(resource.capacity/1e9).toFixed(3)} Gbit/s at ${resource.id}`,domainIds:[]});
    }
    if(bottleneckByResource.size)for(const [,rate,,t] of channels){if(rate===0)continue;active.forEach((nodes,i)=>{const domain=design.modules[i].networkDomainId;for(const node of nodes){if(!t.reachable[node]||t.unsupported[node])continue;let cursor=node;while(t.parent[cursor]>=0){const e=g.edges[t.parent[cursor]];for(const r of e.resources){const bottleneck=bottleneckByResource.get(r);if(bottleneck&&!bottleneck.domainIds.includes(domain))bottleneck.domainIds.push(domain);}cursor=e.from;}}});}
    result.bottlenecks=[...bottleneckByResource.values()];
    for(const b of result.bottlenecks)for(const domain of b.domainIds)record(b.assetId,b.resourceId,b.reason,domain);
    result.issues=[...issues.values()];result.blockedDomainIds=[...blocked].sort();result.unreachableDomainIds=[...unreachable].sort();result.unsupportedDomainIds=[...unsupported].sort();
    result.status=unsupported.size?'unsupported':blocked.size?'violated':'satisfied';lastKey=key;lastResult=result;return result;
  };
}

export function assessNetwork(design:Design,allocations:readonly NetworkAllocation[],failedAssetIds:readonly string[]=[],profile:TrafficProfile=NETWORK_ASSUMPTIONS):NetworkAssessment{
  return createNetworkEvaluator(design,profile)(allocations,failedAssetIds);
}

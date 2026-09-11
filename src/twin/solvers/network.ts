import { TRAFFIC_PROFILE, equipmentFor } from '../catalog/equipment';
import { connectionsForModule, moduleAssets } from '../assets/design';
import { CONTRACT } from '../persistence/limits';
import { failure, finiteNumber, finiteOutputs } from '../safety';
import type { Asset, Connection, Design } from '../types';
import { createNetworkPowerEvaluator } from './network-power';

/** Declared illustrative offered demand, not measured traffic or achieved throughput. */
export const NETWORK_ASSUMPTIONS = TRAFFIC_PROFILE;
export interface TrafficProfile { clusterBitSPerNode:number; externalBitSPerNode:number }
export interface NetworkIssue { assetId:string; resourceId:string; reason:string; domainIds:string[] }
export interface NetworkBottleneck extends NetworkIssue { demandBitS:number; capacityBitS:number }
export interface NetworkAssessment {
  assessmentBasis:'energized'|'installed'; resources:NetworkResource[]; status:'satisfied'|'violated'|'unsupported'; energizedNodes:number; clusterDemandBitS:number; externalDemandBitS:number;
  blockedDomainIds:string[]; unreachableDomainIds:string[]; unsupportedDomainIds:string[];
  /** null means positive offered load / zero capacity, or an unrepresentable ratio. */
  bottlenecks:NetworkBottleneck[]; issues:NetworkIssue[]; maxUtilization:number|null;
}
export interface NetworkResource { resourceId:string; assetId:string; kind:'edge'|'port'|'switch'; demandBitS:number; capacityBitS:number; headroomBitS:number; maxUtilization:number|null; domainIds:string[] }
export interface NetworkAllocation { id:string; energizedNodes:number }
export interface NetworkEvaluationOptions { includeResources?:boolean; ignorePower?:boolean }
interface Resource { id:string; assetId:string; capacity:number; kind:'edge'|'port'|'switch' }
interface Edge { connection:Connection; from:number; to:number; resources:number[]; invalid:boolean }
interface Tree { source:number; parent:Int32Array; order:number[]; reachable:Uint8Array; unsupported:Uint8Array }

function identity(value: unknown, field: string) {
  if (typeof value !== 'string' || !value || value.length > CONTRACT.maxAssetIdLength) failure('invalid-input', 'NETWORK_IDENTITY', 'Network identity must be a nonempty bounded string.', { field, details: { maximumLength: CONTRACT.maxAssetIdLength } });
}
/** Validate the numerical graph boundary before lazy compilation, including dormant links. */
function validateNetworkDesign(design: Design) {
  if (!design || !design.config || !Array.isArray(design.modules) || !Array.isArray(design.assets) || !Array.isArray(design.connections)) failure('invalid-input', 'NETWORK_DESIGN', 'Network evaluation requires a design with module, asset and connection arrays.');
  if (design.modules.length > CONTRACT.maxModules || design.assets.length + design.connections.length > CONTRACT.maxStructuralItems) failure('resource-limit', 'NETWORK_GRAPH_LIMIT', 'Network graph exceeds the shared structural admission limit.', { field: 'design', details: { maxModules: CONTRACT.maxModules, maxStructuralItems: CONTRACT.maxStructuralItems } });
  for (const field of ['requireClusterNetwork', 'requireExternalNetwork'] as const) if (typeof design.config[field] !== 'boolean') failure('invalid-input', 'INVALID_BOOLEAN', `${field} must be a boolean.`, { field });
  const rootIds = new Set<string>();
  let structuralItems = design.assets.length + design.connections.length + design.modules.length;
  for (const asset of design.assets) {
    if (!asset || !Array.isArray(asset.ports) || !Array.isArray(asset.positionM) || asset.positionM.length !== 3) failure('invalid-input', 'NETWORK_ASSET', 'Network graph assets require ports and a three-dimensional SI position.');
    structuralItems += asset.ports.length;
    if (structuralItems > CONTRACT.maxStructuralItems) failure('resource-limit', 'NETWORK_GRAPH_LIMIT', 'Network ports exceed the shared structural admission limit.', { field: 'assets.ports', details: { maxStructuralItems: CONTRACT.maxStructuralItems } });
    identity(asset.id, 'asset.id');
    if (rootIds.has(asset.id)) failure('invalid-input', 'NETWORK_DUPLICATE_ID', 'Network graph asset identities must be unique.', { assetId: asset.id });
    rootIds.add(asset.id);
    asset.positionM.forEach((value, i) => finiteNumber(value, `${asset.id}.positionM.${i}`, { unit: 'm' }));
    if (asset.ratings?.switchingCapacityBitS !== undefined) finiteNumber(asset.ratings.switchingCapacityBitS, `${asset.id}.switchingCapacityBitS`, {min:0,unit:'bit/s'});
    const portIds = new Set<string>();
    for (const port of asset.ports) {
      if (!port) failure('invalid-input', 'NETWORK_PORT', 'Network graph contains an invalid port.', { assetId: asset.id });
      identity(port.id, `${asset.id}.port.id`);
      if (portIds.has(port.id)) failure('invalid-input','NETWORK_DUPLICATE_PORT','Network port identities must be unique within each asset.',{assetId:asset.id});
      portIds.add(port.id);
      if (port.medium === 'cluster' || port.medium === 'external-network') finiteNumber(port.capacity, `${asset.id}.${port.id}.capacity`, { min: 0, unit: 'bit/s' });
    }
  }
  const moduleIds = new Set<string>();
  for (const module of design.modules) {
    if (!module || !Array.isArray(module.positionM) || module.positionM.length !== 3) failure('invalid-input', 'NETWORK_MODULE', 'Network module requires an identity, inventory and SI position.');
    for (const field of ['id', 'platformId', 'powerDomainId', 'networkDomainId'] as const) identity(module[field], `module.${field}`);
    if (moduleIds.has(module.id)) failure('invalid-input', 'NETWORK_DUPLICATE_ID', 'Network module identities must be unique.', { assetId: module.id });
    moduleIds.add(module.id);
    for (const field of ['powerDomainId', 'networkDomainId'] as const) if (!rootIds.has(module[field])) failure('unsupported-configuration', 'NETWORK_MODULE_TOPOLOGY', 'Module graph expansion requires its declared upstream power and network assets.', { assetId: module.id, field });
    finiteNumber(module.nodeCount, `${module.id}.nodeCount`, { min: 0, integer: true, unit: 'nodes' });
    finiteNumber(module.rackCount, `${module.id}.rackCount`, { min: 0, integer: true, unit: 'racks' });
    if (module.nodeCount > 160 || module.rackCount > 40) failure('unsupported-configuration', 'NETWORK_MODULE_INVENTORY', 'Network module expansion supports at most 160 nodes in 40 racks.', { assetId: module.id });
    if (module.rackCount !== Math.ceil(module.nodeCount / 4)) failure('invalid-input', 'NETWORK_RACK_INVENTORY', 'Rack inventory must match the declared four-node rack grouping.', { assetId: module.id, field: 'rackCount' });
    module.positionM.forEach((value, i) => finiteNumber(value, `${module.id}.positionM.${i}`, { unit: 'm' }));
  }
  const connectionIds = new Set<string>();
  for (const connection of design.connections) {
    if (!connection) failure('invalid-input', 'NETWORK_CONNECTION', 'Network graph contains an invalid connection.');
    if (connection.medium !== 'cluster' && connection.medium !== 'external-network') continue;
    for (const field of ['id', 'from', 'to', 'fromPort', 'toPort'] as const) identity(connection[field], `connection.${field}`);
    if (connectionIds.has(connection.id)) failure('invalid-input', 'NETWORK_DUPLICATE_ID', 'Network connection identities must be unique.', { field: 'connection.id', assetId: connection.from });
    connectionIds.add(connection.id);
    finiteNumber(connection.capacity, `${connection.id}.capacity`, { min: 0, unit: 'bit/s' });
    if (typeof connection.enabled !== 'boolean') failure('invalid-input', 'INVALID_BOOLEAN', 'Connection enabled must be a boolean.', { field: `${connection.id}.enabled`, assetId: connection.from });
  }
}

/** Compile exact graph edges and shared ports once; runtime traversals are linear in graph size. */
function compile(design:Design,validationOnly=false){
  const ids:string[]=[], index=new Map<string,number>(), resources:Resource[]=[], resourceIndex=new Map<string,number>();
  const edges:Edge[]=[], outgoing:number[][]=[], leaves=new Map<string,number[]>();
  const vertex=(id:string)=>{let n=index.get(id);if(n===undefined){n=ids.length;ids.push(id);index.set(id,n);outgoing.push([]);}return n;};
  const resource=(id:string,assetId:string,capacity:number)=>{
    let n=resourceIndex.get(id);if(n===undefined){n=resources.length;resources.push({id,assetId,capacity,kind:id.startsWith('edge:')?'edge':id.startsWith('switch:')?'switch':'port'});resourceIndex.set(id,n);}
    else resources[n].capacity=Math.min(resources[n].capacity,capacity);
    return n;
  };
  const rootAssets=new Map(design.assets.map(a=>[a.id,a]));
  const add=(c:Connection,assets:Map<string,Asset>)=>{
    if(c.medium!=='cluster'&&c.medium!=='external-network')return;
    const fromAsset=assets.get(c.from)??rootAssets.get(c.from),toAsset=assets.get(c.to)??rootAssets.get(c.to);
    const fromPort=fromAsset?.ports.find(p=>p.id===c.fromPort),toPort=toAsset?.ports.find(p=>p.id===c.toPort);
    const invalid=!fromPort||!toPort||fromPort.medium!==c.medium||toPort.medium!==c.medium||fromPort.unit!=='bit/s'||toPort.unit!=='bit/s'||!['out','bidirectional'].includes(fromPort.direction)||!['in','bidirectional'].includes(toPort.direction);
    if(invalid)failure('invalid-input','NETWORK_PORT_TOPOLOGY','Every network connection, including a disabled connection, requires existing compatible directional ports in bit/s.',{assetId:c.from,field:c.id});
    if(validationOnly)return;
    const from=vertex(c.from),to=vertex(c.to),r=[resource(`edge:${c.id}`,c.from,c.capacity),resource(`port:${c.from}:${c.fromPort}`,c.from,fromPort?.capacity??0),resource(`port:${c.to}:${c.toPort}`,c.to,toPort?.capacity??0)];
    // A source-to-node traversal consumes its source switch once, on egress.
    // Ingress and egress are not counted twice; both required traffic classes share this budget.
    if (fromAsset?.ratings.switchingCapacityBitS !== undefined) r.push(resource(`switch:${fromAsset.id}`,fromAsset.id,fromAsset.ratings.switchingCapacityBitS));
    outgoing[from].push(edges.length);edges.push({connection:c,from,to,resources:r,invalid});
  };
  for(const c of [...design.connections].sort((a,b)=>a.id.localeCompare(b.id)))add(c,rootAssets);
  for(const m of design.modules){
    const assets=moduleAssets(design,m.id,{networkOnly:true,attachmentOnly:validationOnly}),local=new Map(assets.map(a=>[a.id,a]));
    if(!validationOnly)leaves.set(m.id,assets.filter(a=>a.type==='compute').map(a=>vertex(a.id)));
    for(const c of connectionsForModule(design,m.id,{assets,networkOnly:true,attachmentOnly:validationOnly}))add(c,local);
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
  // Admission is independent of offered demand and failures. Kahn elimination
  // leaves cycles and their descendants even in components disconnected from a root.
  const structural=(external:boolean)=>{
    const rooted=tree(external?'shore/fiber':'shore/cluster-core',external,new Set());
    const unsupported=rooted.unsupported.slice(),indegree=new Int32Array(ids.length),parents=new Int32Array(ids.length);
    const allowed=(e:Edge)=>e.connection.enabled&&(external||e.connection.medium==='cluster');
    const clusterSource=index.get('shore/cluster-core')!;
    for(const e of edges)if(allowed(e)){
      indegree[e.to]++;
      // The legacy external tree does not traverse the independent cluster root.
      // Its source edge is not an alternative external path into a platform.
      if(!(external&&e.from===clusterSource&&!rooted.reachable[clusterSource]))parents[e.to]++;
    }
    const queue:number[]=[];
    for(let n=0;n<ids.length;n++)if(indegree[n]===0)queue.push(n);
    for(let q=0;q<queue.length;q++)for(const ei of outgoing[queue[q]]){
      const e=edges[ei];if(allowed(e)&&--indegree[e.to]===0)queue.push(e.to);
    }
    const invalidQueue:number[]=[];
    for(let n=0;n<ids.length;n++)if(unsupported[n]||indegree[n]>0||parents[n]>1){unsupported[n]=1;invalidQueue.push(n);}
    for(let q=0;q<invalidQueue.length;q++)for(const ei of outgoing[invalidQueue[q]]){
      const e=edges[ei];if(allowed(e)&&!unsupported[e.to]){unsupported[e.to]=1;invalidQueue.push(e.to);}
    }
    return unsupported;
  };
  const structuralCluster=structural(false),structuralExternal=structural(true);
  return {ids,index,resources,edges,leaves,tree,diagnosticCluster,diagnosticExternal,structuralCluster,structuralExternal};
}

/** Pure evaluator closure; caches only the last identical numerical query, never simulation state. */
export function createNetworkEvaluator(design:Design,profile:TrafficProfile=equipmentFor(design).workloadProfile,options:NetworkEvaluationOptions={}){
  if (!profile || typeof profile !== 'object') failure('invalid-input', 'NETWORK_PROFILE', 'Traffic profile must be an object.');
  for (const field of ['clusterBitSPerNode', 'externalBitSPerNode'] as const) finiteNumber(profile[field], field, { min: 0, max: 1e12, unit: 'bit/s per node' });
  validateNetworkDesign(design);
  const networkPower=options.ignorePower?undefined:createNetworkPowerEvaluator(design);
  const clusterRate=design.config.requireClusterNetwork?profile.clusterBitSPerNode:0,externalRate=design.config.requireExternalNetwork?profile.externalBitSPerNode:0;
  let graph:ReturnType<typeof compile>|undefined,lastKey='',lastResult:NetworkAssessment|undefined;
  return (allocations:readonly NetworkAllocation[],failedAssetIds:readonly string[]=[]):NetworkAssessment=>{
    if(!Array.isArray(allocations)||allocations.length!==design.modules.length) failure('invalid-input', 'NETWORK_ALLOCATION', 'Network allocation must match the complete module inventory.', { field: 'allocations' });
    allocations.forEach((a, i) => {
      if (!a || a.id !== design.modules[i].id) failure('invalid-input', 'NETWORK_ALLOCATION', 'Network allocation identities and order must match the module inventory.', { field: `allocations.${i}.id` });
      finiteNumber(a.energizedNodes, `allocations.${i}.energizedNodes`, { min: 0, max: design.modules[i].nodeCount, integer: true, unit: 'nodes' });
    });
    if (!Array.isArray(failedAssetIds) || failedAssetIds.length > CONTRACT.maxStructuralItems) failure('invalid-input', 'NETWORK_FAILURES', 'Failed network asset identities must be a bounded array.', { field: 'failedAssetIds' });
    failedAssetIds.forEach(id => identity(id, 'failedAssetIds'));
    const failed=new Set<string>(failedAssetIds),key=`${allocations.map(a=>a.energizedNodes).join(',')}|${[...failed].sort().join(',')}`;
    if(lastResult&&key===lastKey)return lastResult;
    for(const id of networkPower?.(failedAssetIds).unavailableAssetIds??[])failed.add(id);
    const energizedNodes=allocations.reduce((n,a)=>n+a.energizedNodes,0);
    const result:NetworkAssessment={assessmentBasis:'energized',resources:[],status:'satisfied',energizedNodes,clusterDemandBitS:energizedNodes*clusterRate,externalDemandBitS:energizedNodes*externalRate,blockedDomainIds:[],unreachableDomainIds:[],unsupportedDomainIds:[],bottlenecks:[],issues:[],maxUtilization:0};
    // With no required class, compact simulation validates stored edges and
    // each module attachment, but needs no generated leaf inventory or routes.
    // Interior ports are the same canonical template from admitted specifications.
    if(options.includeResources===false&&!design.config.requireClusterNetwork&&!design.config.requireExternalNetwork){
      graph??=compile(design,true);lastKey=key;lastResult=result;return result;
    }
    graph??=compile(design);const g=graph,resourceLoads=new Float64Array(g.resources.length),issues=new Map<string,NetworkIssue>(),blocked=new Set<string>(),unreachable=new Set<string>(),unsupported=new Set<string>();
    const record=(assetId:string,resourceId:string,reason:string,domainId:string)=>{
      let issue=issues.get(resourceId);if(!issue){issue={assetId,resourceId,reason,domainIds:[]};issues.set(resourceId,issue);}
      if(!issue.domainIds.includes(domainId))issue.domainIds.push(domainId);blocked.add(domainId);
    };
    // Deterministically energize the first N operable inventory nodes, the same count used by electrical dispatch.
    const active=allocations.map((a,i)=>{
      const m=design.modules[i];if(failed.has(m.id)||failed.has(m.platformId))return [];
      const nodes=g.leaves.get(a.id)!.filter(n=>!failed.has(g.ids[n])&&!failed.has(g.ids[n].slice(0,g.ids[n].lastIndexOf('/'))));
      if(nodes.length<a.energizedNodes) failure('invalid-input', 'NETWORK_OPERABLE_INVENTORY', 'Energized network allocation exceeds operable node inventory.', { assetId: a.id, field: 'energizedNodes', unit: 'nodes', details: { operableNodes: nodes.length, requestedNodes: a.energizedNodes } });
      return nodes.slice(0,a.energizedNodes);
    });
    const channels:[boolean,number,string,Tree][]=[];
    if(design.config.requireClusterNetwork)channels.push([false,clusterRate,'cluster',g.tree('shore/cluster-core',false,failed)]);
    if(design.config.requireExternalNetwork)channels.push([true,externalRate,'external',g.tree('shore/fiber',true,failed)]);
    for(const [external,rate,label,t] of channels){
      const loads=new Float64Array(g.ids.length),diagnostic=external?g.diagnosticExternal:g.diagnosticCluster;
      const structural=external?g.structuralExternal:g.structuralCluster;
      for(const module of design.modules){
        const node=g.leaves.get(module.id)!.find(n=>structural[n]);
        if(node!==undefined){unsupported.add(module.networkDomainId);record(g.ids[node],`unsupported:${label}:${module.networkDomainId}`,`Required ${label} topology has multiple enabled parents or a cycle, independently of offered load`,module.networkDomainId);}
      }
      active.forEach((nodes,i)=>{const domain=design.modules[i].networkDomainId;for(const node of nodes){
        if(structural[node]||t.unsupported[node]){unsupported.add(domain);record(g.ids[node],`unsupported:${label}:${domain}`,`Required ${label} path has multiple enabled parents or a cycle`,domain);}
        else if(!t.reachable[node]){
          unreachable.add(domain);let cursor=node,cause=g.ids[node],resourceId=`unreachable:${label}:${domain}`;
          while(cursor>=0){if(failed.has(g.ids[cursor])){cause=g.ids[cursor];resourceId=`failed:${cause}`;break;}const ei=diagnostic.parent[cursor];if(ei<0)break;const e=g.edges[ei];if(!e.connection.enabled){cause=e.connection.from;resourceId=`edge:${e.connection.id}`;break;}cursor=e.from;}
          record(cause,resourceId,`Required ${label} path unreachable through ${cause}`,domain);
        }else loads[node]+=rate;
      }});
      for(let q=t.order.length-1;q>=0;q--){const n=t.order[q],ei=t.parent[n];if(ei<0||structural[n]||t.unsupported[n]||loads[n]===0)continue;const e=g.edges[ei];loads[e.from]+=loads[n];for(const r of e.resources)resourceLoads[r]+=loads[n];}
    }
    const bottleneckByResource=new Map<number,NetworkBottleneck>();
    for(let r=0;r<g.resources.length;r++){
      const resource=g.resources[r],load=resourceLoads[r];if(load===0)continue;
      finiteOutputs({load}, 'network resource demand');
      const utilization=resource.capacity>0?load/resource.capacity:null;
      result.maxUtilization=result.maxUtilization===null||utilization===null||!Number.isFinite(utilization)?null:Math.max(result.maxUtilization,utilization);
      if(utilization===null||!Number.isFinite(utilization)||load>resource.capacity+Math.max(1,resource.capacity*1e-9))bottleneckByResource.set(r,{assetId:resource.assetId,resourceId:resource.id,demandBitS:load,capacityBitS:resource.capacity,reason:`Declared offered demand ${(load/1e9).toFixed(3)} Gbit/s exceeds ${(resource.capacity/1e9).toFixed(3)} Gbit/s at ${resource.id}`,domainIds:[]});
    }
    const resourceDomains = new Map<number,Set<string>>();
    if(options.includeResources!==false||bottleneckByResource.size)for(const [external,rate,,t] of channels){if(rate===0)continue;const structural=external?g.structuralExternal:g.structuralCluster;active.forEach((nodes,i)=>{const domain=design.modules[i].networkDomainId;for(const node of nodes){if(!t.reachable[node]||structural[node]||t.unsupported[node])continue;let cursor=node;while(t.parent[cursor]>=0){const edge=g.edges[t.parent[cursor]];for(const r of edge.resources){if(options.includeResources===false&&!bottleneckByResource.has(r))continue;let domains=resourceDomains.get(r);if(!domains){domains=new Set();resourceDomains.set(r,domains);}domains.add(domain);}cursor=edge.from;}}});}
    if(options.includeResources!==false)result.resources=g.resources.map((resource,r)=>({resourceId:resource.id,assetId:resource.assetId,kind:resource.kind,capacityBitS:resource.capacity,demandBitS:resourceLoads[r],headroomBitS:resource.capacity-resourceLoads[r],maxUtilization:resource.capacity>0?(Number.isFinite(resourceLoads[r]/resource.capacity)?resourceLoads[r]/resource.capacity:null):resourceLoads[r]>0?null:0,domainIds:[...(resourceDomains.get(r)??[])].sort()})).sort((a,b)=>a.resourceId.localeCompare(b.resourceId));
    for(const [r,bottleneck] of bottleneckByResource)bottleneck.domainIds=[...(resourceDomains.get(r)??[])].sort();
    result.bottlenecks=[...bottleneckByResource.values()].sort((a,b)=>a.resourceId.localeCompare(b.resourceId));
    for(const b of result.bottlenecks)for(const domain of b.domainIds)record(b.assetId,b.resourceId,b.reason,domain);
    result.issues=[...issues.values()].map(issue=>({...issue,domainIds:[...issue.domainIds].sort()})).sort((a,b)=>a.resourceId.localeCompare(b.resourceId));result.blockedDomainIds=[...blocked].sort();result.unreachableDomainIds=[...unreachable].sort();result.unsupportedDomainIds=[...unsupported].sort();
    result.status=unsupported.size?'unsupported':blocked.size?'violated':'satisfied';finiteOutputs(result, 'assessNetwork');lastKey=key;lastResult=result;return result;
  };
}

export function assessNetwork(design:Design,allocations:readonly NetworkAllocation[],failedAssetIds:readonly string[]=[],profile:TrafficProfile=equipmentFor(design).workloadProfile):NetworkAssessment{
  return createNetworkEvaluator(design,profile)(allocations,failedAssetIds);
}

/** Capacity at the complete provisioned inventory, independently of instantaneous power dispatch. */
export function assessNetworkProvisioning(design:Design):NetworkAssessment {
  return {...createNetworkEvaluator(design,undefined,{ignorePower:true})(design.modules.map(m=>({id:m.id,energizedNodes:m.nodeCount}))),assessmentBasis:'installed'};
}

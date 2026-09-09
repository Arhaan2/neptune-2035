import { describe, expect, it } from 'vitest';
import fixtures from '../reference/benchmarks.json';
import { allAssets, buildDesign, connectionsForModule, DEFAULT_CONFIG, loopGeometry, loopRouteM, moduleAssets, packingIssues, resolveAsset, routeLengthM, validateGraph } from '../src/twin/assets/design';
import { compareRedundancy, constraints, marineScreen, parseProject, projectFile, signatureEvents, sizingAssessment } from '../src/twin/analysis/reports';
import { advance, initialize, replay, summarize } from '../src/twin/engine/simulation';
import { solveElectrical } from '../src/twin/solvers/electrical';
import { solveHydraulics } from '../src/twin/solvers/hydraulic';
import { advanceThermal, solveExchanger } from '../src/twin/solvers/thermal';
import type { Design, DesignConfig, Medium } from '../src/twin/types';
const make=(config:Partial<DesignConfig>={})=>buildDesign({...DEFAULT_CONFIG,requestedAccelerators:1280,...config});
const status=(design:Design,id:string,state=initialize(design))=>constraints(design,state).find(c=>c.id===id)!.status;
const reaches=(design:Design,medium:Medium,start:string,target:string)=>{
  const edges=[...design.connections,...design.modules.flatMap(m=>connectionsForModule(design,m.id))].filter(c=>c.enabled&&c.medium===medium);
  const visited=new Set<string>(),queue=[start];
  while(queue.length){const node=queue.shift()!;if(node===target)return true;if(visited.has(node))continue;visited.add(node);for(const e of edges)if(e.from===node)queue.push(e.to);}
  return false;
};

describe('canonical graph, geometry and operating-state integration',()=>{
  it('reconciles exact inventory and stable identity independently of family and transform',()=>{
    const a=make({requestedAccelerators:10008}),b=make({requestedAccelerators:10008,generation:2}),aa=make({requestedAccelerators:10008});
    const inventory=[...allAssets(a)];
    expect(inventory.filter(x=>x.type==='compute').length*8).toBe(a.provisionedAccelerators);
    expect(inventory.filter(x=>x.type==='rack')).toHaveLength(a.rackCount);
    expect(a.installedPeakITW).toBe(inventory.filter(x=>x.type==='compute').reduce((sum,x)=>sum+x.ratings.capacityW,0));
    expect(a.revision).toBe(aa.revision);expect(a.modules.map(m=>m.id)).toEqual(b.modules.map(m=>m.id));
    expect(inventory.map(x=>x.id)).toEqual([...allAssets(aa)].map(x=>x.id));
    for(const m of a.modules){expect(moduleAssets(a,m.id).filter(x=>x.type==='compute')).toHaveLength(m.nodeCount);expect(resolveAsset(a,`${m.id}/rack-01/node-01`)?.parentId).toBe(`${m.id}/rack-01`);}
  });
  it('bounds the million-accelerator inventory and 10 GW supply ceiling without inventing consumption',()=>{
    const d=make({generation:3,requestedAccelerators:1_000_000,supplyW:10e9,workload:1,requireClusterNetwork:false,requireExternalNetwork:false});
    expect(d.nodeCount).toBe(125000);expect(d.modules).toHaveLength(782);
    expect(d.assets.filter(a=>a.type==='platform')).toHaveLength(196);expect(d.assets.length).toBeLessThan(5000);
    const s=summarize(d,initialize(d));expect(s.energizedAccelerators).toBe(1_000_000);
    expect(s.itW).toBe(1.5e9);expect(s.facilityW).toBeGreaterThan(1.5e9);expect(s.facilityW).toBeLessThan(2e9);
  });
  it('accepts graph integrity including zero-grid and storage-power limits, and rejects wrong directions/capacities',()=>{
    for(const generation of [1,2,3] as const)expect(validateGraph(make({generation,supplyW:0,batteryMaxWPerModule:0}))).toEqual([]);
    const d=make(),edge=d.connections.find(e=>e.medium==='power')!;
    const badDirection={...d,connections:d.connections.map(e=>e===edge?{...e,fromPort:'power-in'}:e)};
    expect(validateGraph(badDirection).some(x=>x.includes('directions'))).toBe(true);
    const overCapacity={...d,connections:d.connections.map(e=>e===edge?{...e,capacity:e.capacity+1}:e)};
    expect(validateGraph(overCapacity).some(x=>x.includes('port capacity'))).toBe(true);
    const battery=moduleAssets(d,d.modules[0].id).find(a=>a.type==='battery')!;
    expect(battery.ratings.capacityW).toBe(2.2e6);expect(battery.ratings.storageMaxW).toBe(d.config.batteryMaxWPerModule);
  });
  it('links every rack to its exchanger and keeps technical and sea media separate',()=>{
    const d=make(),m=d.modules[0],edges=connectionsForModule(d,m.id);
    for(const rack of moduleAssets(d,m.id).filter(a=>a.type==='rack')){
      expect(edges.some(e=>e.from===rack.id&&e.to===`${m.id}/hx`&&e.medium==='technical')).toBe(true);
      expect(edges.some(e=>e.from===rack.id&&e.to===`${m.id}/pipe-tech`&&e.medium==='technical')).toBe(false);
    }
    expect(reaches(d,'technical',`${m.id}/pump-duty`,`${m.id}/hx`)).toBe(true);
    expect(reaches(d,'technical',`${m.id}/pump-sea`,`${m.id}/rack-01`)).toBe(false);
    expect(reaches(d,'seawater',`${m.id}/pump-sea`,`${m.id}/hx`)).toBe(true);
  });
  it('uses physical routed lengths for resistance but all wetted branches for coolant mass',()=>{
    const d=make(),m=d.modules[0],geometry=loopGeometry(d,m),pipe=resolveAsset(d,`${m.id}/pipe-tech`)!;
    expect(geometry.technicalLengthM).toBe(routeLengthM(loopRouteM(m))+2.4);
    const waterMass=(routeLengthM(loopRouteM(m))+m.rackCount*2*1.2)*Math.PI*0.09**2*997;
    expect(pipe.operationalMassKg).toBeCloseTo(400+waterMass,7);
    expect(pipe.operationalMassKg!).toBeGreaterThan(400+geometry.technicalLengthM*Math.PI*0.09**2*997);
    expect(packingIssues(d)).toEqual([]);
  });
  it('matches actual floated hull displacement and adds battery mass to draft, preserving equipment/deck attachment',()=>{
    const light=make({batteryWhPerModule:0}),heavy=make({batteryWhPerModule:2e6});
    const a=marineScreen(light)[0],b=marineScreen(heavy)[0];
    expect(b.massKg).toBeGreaterThan(a.massKg);expect(b.draftM!).toBeGreaterThan(a.draftM!);expect(b.freeboardM!).toBeLessThan(a.freeboardM!);
    for(const d of [light,heavy])for(const m of marineScreen(d)){
      const hulls=d.assets.filter(x=>x.parentId===m.platformId&&x.type==='hull');
      const displaced=hulls.reduce((sum,h)=>sum+Math.max(0,-(h.positionM[1]-h.dimensionsM[1]/2))*h.dimensionsM[0]*h.dimensionsM[2]*1025,0);
      expect(displaced).toBeCloseTo(m.massKg,5);
      expect(-hulls[0].positionM[1]+hulls[0].dimensionsM[1]/2).toBeCloseTo(m.draftM!,9);
      expect(hulls[0].positionM[1]+hulls[0].dimensionsM[1]/2).toBeCloseTo(m.freeboardM!,9);
    }
  });
  it('proves typed cluster reachability through the shore core and observes upstream or disabled link failure',()=>{
    const d=make({generation:2,requestedAccelerators:10000});
    for(const m of d.modules)expect(reaches(d,'cluster','shore/cluster-core',`${m.id}/rack-01/node-01`)).toBe(true);
    const fault=replay(d,[{id:'core',timeS:0,kind:'trip',assetId:'shore/cluster-core'}],1);
    expect(summarize(d,fault).availableAccelerators).toBe(0);expect(summarize(d,fault).energizedAccelerators).toBe(d.provisionedAccelerators);
    const cut={...d,connections:d.connections.map(e=>e.medium==='cluster'&&e.to===d.modules[0].networkDomainId?{...e,enabled:false}:e)};
    const disconnected=initialize(cut);expect(disconnected.modules[0].availableAccelerators).toBe(0);
    expect(disconnected.modules.at(-1)!.availableAccelerators).toBeGreaterThan(0);
  });
  it('external-only jobs still depend on the actual carrying platform network; isolated local jobs do not',()=>{
    const external=make({requireExternalNetwork:true,requireClusterNetwork:false}),local=make({requireExternalNetwork:false,requireClusterNetwork:false});
    const event={id:'network',timeS:0,kind:'trip' as const,assetId:external.modules[0].networkDomainId};
    expect(replay(external,[event],1).modules[0].availableAccelerators).toBe(0);
    expect(replay(local,[event],1).modules[0].availableAccelerators).toBe(1280);
  });
  it('shows real generation isolation differences for equivalent power-domain loss',()=>{
    const a=make({generation:1,requestedAccelerators:10000,batteryWhPerModule:0}),b=make({generation:2,requestedAccelerators:10000,batteryWhPerModule:0}),c=make({generation:3,requestedAccelerators:10000,batteryWhPerModule:0});
    const results=[a,b,c].map(d=>replay(d,[{id:'feeder',timeS:0,kind:'trip',assetId:d.modules[0].powerDomainId}],10));
    expect(summarize(a,results[0]).energizedAccelerators).toBe(0);
    expect(summarize(b,results[1]).energizedAccelerators).toBe(10000-5120);
    expect(summarize(c,results[2]).energizedAccelerators).toBe(10000-5120);
    expect(c.connections.filter(e=>e.medium==='power'&&!e.enabled)).toHaveLength(1);
    for(const d of [a,b,c])expect(summarize(d,replay(d,[{id:'shared',timeS:0,kind:'trip',assetId:'shore/grid'}],10)).energizedAccelerators).toBe(0);
  });
  it('compares 0 versus 1 standby with identical recorded disturbance and computed 240s results',()=>{
    const d=make(),[without,withStandby]=compareRedundancy(d,240);
    expect(without.state.timeS).toBe(240);expect(withStandby.state.timeS).toBe(240);
    expect(without.state.events).toEqual(withStandby.state.events);
    expect(without.summary.maxCoolantK).toBeGreaterThan(withStandby.summary.maxCoolantK+0.5);
    expect(without.state).toEqual(replay(without.design,signatureEvents(without.design),240));
    expect(withStandby.state).toEqual(replay(withStandby.design,signatureEvents(withStandby.design),240));
    expect(without.state.modules[0].technicalFlowM3S).toBeGreaterThan(0);
    expect(withStandby.state.log.some(e=>e.message.includes('Standby startup delay elapsed'))).toBe(true);
    expect(without.state.log.some(e=>e.message.includes('Standby startup delay elapsed'))).toBe(false);
  });
});
describe('constraint and project truthfulness integration',()=>{
  it('does not green an IT-only source limit when UPS hides pump and conversion demand',()=>{
    const d=make({supplyW:1.92e6,workload:1}),s=initialize(d);
    expect(summarize(d,s).energizedAccelerators).toBe(1280);expect(s.modules[0].batteryDischargeW).toBeGreaterThan(0);
    expect(status(d,'EL-01',s)).toBe('violated');expect(sizingAssessment(d,s).passes).toBe(false);
    expect(status(make(),'EL-01')).toBe('satisfied');
  });
  it('flags latent peak cooling shortfall before the initially cool bulk state heats up',()=>{
    const d=make({seawaterK:311.15}),s=initialize(d);
    expect(status(d,'TH-01',s)).toBe('satisfied');expect(status(d,'TH-02',s)).toBe('violated');
    expect(sizingAssessment(d,s).passes).toBe(false);
    const atThreshold={...s,modules:s.modules.map(m=>({...m,coolantK:318.15}))};
    expect(status(d,'TH-01',atThreshold)).toBe('violated');
  });
  it('reports missing mass/geometry as unassessed instead of zero or an accidental passing NaN comparison',()=>{
    const d=make();
    const unknown={...d,assets:d.assets.map(a=>a.type==='platform'?{...a,operationalMassKg:null}:a)};
    expect(status(unknown,'MA-01')).toBe('unassessed');expect(status(unknown,'MA-02')).toBe('unassessed');
    const noHulls={...d,assets:d.assets.filter(a=>a.type!=='hull')};
    expect(marineScreen(noHulls)[0].draftM).toBeNull();expect(marineScreen(noHulls)[0].freeboardM).toBeNull();
    expect(status(noHulls,'MA-01')).toBe('unassessed');expect(sizingAssessment(noHulls,initialize(noHulls)).passes).toBe(false);
    expect(status(d,'NW-02')).toBe('satisfied');
    for(const id of ['MA-03','VV-01'])expect(status(d,id)).toBe('unassessed');
  });
  it('uses actual hull/deck dimensions for load screen and enforces included-scope budget',()=>{
    const d=make(),screen=marineScreen(d)[0],deck=d.assets.find(a=>a.type==='platform')!;
    const narrow={...d,assets:d.assets.map(a=>a===deck?{...a,dimensionsM:[29,0.8,28] as [number,number,number]}:a)};
    expect(marineScreen(narrow)[0].deckLoadKgM2).toBeCloseTo(screen.deckLoadKgM2!*2,9);
    expect(sizingAssessment(d,initialize(d),1).passes).toBe(false);
  });
  it('validates imported events through the same asset/value/solver contract as operation',()=>{
    const d=make(),project=projectFile(d,advance(d,initialize(d),5));
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(()=>parseProject(JSON.stringify({...project,events:[{id:'bad',timeS:0,kind:'trip',assetId:'unknown/pump'}]}))).toThrow(/Unknown event asset/);
    expect(()=>parseProject(JSON.stringify({...project,events:[{id:'bad',timeS:0,kind:'seawater',assetId:'shore/grid',value:25}]}))).toThrow(/limits/);
    expect(()=>parseProject(JSON.stringify({...project,solverVersion:'1.0.0'}))).toThrow(/migration/);
    expect(()=>parseProject('null')).toThrow(/object/);
  });
});
describe('independent Python-generated numerical fixtures',()=>{
  it('matches independent exchanger and closed-form pump benchmarks',()=>{
    const h=fixtures.heatExchangerEqualCapacity;
    const result=solveExchanger({technicalInletK:h.hotInletK,seawaterInletK:h.coldInletK,technicalFlowM3S:0.001,seawaterFlowM3S:0.001,technicalDensityKgM3:1000,technicalCpJKgK:1000,seawaterDensityKgM3:1000,seawaterCpJKgK:1000,cleanUAWPerK:h.uaWPerK,foulingResistanceKPerW:0});
    expect(Math.abs(result.heatW-h.heatW)).toBeLessThan(h.absoluteToleranceW);
    const p=fixtures.hydraulicQuadratic,hydraulic=solveHydraulics({lengthM:0,diameterM:0.18,roughnessM:0.000045,densityKgM3:997,dynamicViscosityPaS:0.000855,fittingsK:0,equipmentDropPaAtReference:80000,referenceFlowM3S:0.05,pumpCount:1,pumpSpeed:1});
    expect(Math.abs(hydraulic.flowM3S-p.flowM3S)).toBeLessThan(p.absoluteFlowToleranceM3S);
    expect(Math.abs(hydraulic.pressurePa-p.pressurePa)).toBeLessThan(p.absolutePressureTolerancePa);
  });
  it('matches an independently rational battery-energy benchmark',()=>{
    const b=fixtures.batteryDischarge;let energy=b.initialWh;
    for(let i=0;i<b.durationS;i++)energy=solveElectrical({desiredNodes:0,workload:0,idleFraction:0.3,networkAvailable:true,criticalLoadW:b.terminalW,gridAvailableW:0,batteryWh:energy,batteryCapacityWh:b.initialWh,batteryMaxW:1e6,batteryAvailable:true,isolated:false,dtS:1}).batteryWh;
    expect(Math.abs(energy-b.finalWh)).toBeLessThan(b.absoluteToleranceWh);
  });
  it('matches the independent rectangular two-pontoon hydrostatic benchmark',()=>{
    const d=make(),p=fixtures.rectangularPontoons,old=marineScreen(d)[0];
    const changed={...d,assets:d.assets.map(a=>a.id===old.platformId?{...a,operationalMassKg:a.operationalMassKg!+p.massKg-old.massKg}:a)};
    const result=marineScreen(changed)[0];expect(result.massKg).toBeCloseTo(p.massKg,7);
    expect(result.waterplaneM2).toBe(p.waterplaneM2);expect(result.draftM).toBeCloseTo(p.draftM,10);expect(result.freeboardM).toBeCloseTo(p.freeboardM,10);
  });
  it('agrees with independent 0.01s RK4 transient rather than importing the production analytical update',()=>{
    const t=fixtures.airTransientRK4;let airK=t.initialK;
    for(let i=0;i<t.durationS;i++)airK=advanceThermal({coolantK:303.15,airK,itW:0,facilityW:t.powerW,technicalPumpW:0,seawaterPumpW:0,technicalFlowM3S:0,seawaterFlowM3S:0,seawaterK:291.15,exchangerUAWPerK:350000,foulingResistanceKPerW:0,fanPowered:true,dtS:1}).airK;
    expect(Math.abs(airK-t.finalK)).toBeLessThan(t.absoluteToleranceK);
  });
});

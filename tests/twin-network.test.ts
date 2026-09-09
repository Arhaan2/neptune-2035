import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, moduleAssets } from '../src/twin/assets/design';
import { billOfEquipment, conservationResiduals, constraints, engineeringReport, sizingAssessment } from '../src/twin/analysis/reports';
import { advance, initialize, replay, summarize } from '../src/twin/engine/simulation';
import { assessNetwork, createNetworkEvaluator, NETWORK_ASSUMPTIONS } from '../src/twin/solvers/network';
import type { Design, DesignConfig } from '../src/twin/types';

const design=(overrides:Partial<DesignConfig>={})=>buildDesign({...DEFAULT_CONFIG,...overrides});
const full=(d:Design)=>d.modules.map(m=>({id:m.id,energizedNodes:m.nodeCount}));
const portLimit=(d:Design,id:string,portId:string,capacity:number):Design=>({...d,assets:d.assets.map(a=>a.id===id?{...a,ports:a.ports.map(p=>p.id===portId?{...p,capacity}:p)}:a)});
const check=(d:Design,id:string)=>constraints(d,initialize(d)).find(c=>c.id===id)!;

describe('declared network offered-demand and whole-job admission',()=>{
  it('admits the default 125 Gbit/s profile and sums external plus cluster on their shared downstream port',()=>{
    const d=design({requireExternalNetwork:true}),r=assessNetwork(d,full(d));
    expect(r.status).toBe('satisfied');expect(r.clusterDemandBitS).toBe(125e9);expect(r.externalDemandBitS).toBe(1.25e9);
    expect(r.maxUtilization).toBeCloseTo(125/400,12);
    const first=d.modules[0].networkDomainId;
    const limited=portLimit(d,first,'cluster-out',64.3e9),over=assessNetwork(limited,full(limited));
    const resource=over.bottlenecks.find(b=>b.resourceId===`port:${first}:cluster-out`)!;
    expect(resource.demandBitS).toBe(64.64e9);expect(resource.domainIds).toEqual([first]);
  });

  it('detects a shared-core port bottleneck even when every individual platform link fits',()=>{
    const d=design({requestedAccelerators:50_000,supplyW:200e6,workload:1}),s=initialize(d),r=assessNetwork(d,s.modules);
    expect(r.clusterDemandBitS).toBe(625e9);
    expect(r.bottlenecks).toEqual([expect.objectContaining({resourceId:'port:shore/cluster-core:cluster-out',assetId:'shore/cluster-core',demandBitS:625e9,capacityBitS:400e9})]);
    expect(r.blockedDomainIds).toHaveLength(10);
    expect(s.modules.every(m=>m.availableAccelerators===0&&m.energizedNodes===d.modules.find(x=>x.id===m.id)!.nodeCount)).toBe(true);
    expect(summarize(d,s).itW).toBe(6250*12000*DEFAULT_CONFIG.idleFraction);
    expect(s.log.some(l=>l.assetId==='shore/cluster-core'&&l.message.includes('625.000')&&l.affectedIds.length===d.modules.length)).toBe(true);
    expect(check(d,'NW-01').status).toBe('satisfied');expect(check(d,'NW-02').status).toBe('violated');
    expect(sizingAssessment(d,s).failures).toContain('NW-02: violated');
  });

  it('blocks the whole platform job domain on its link overload and leaves an unrelated platform working',()=>{
    const base=design({workload:1}),first=base.modules[0].networkDomainId;
    const d={...base,connections:base.connections.map(e=>e.medium==='cluster'&&e.to===first?{...e,capacity:20e9}:e)},s=initialize(d),r=assessNetwork(d,s.modules);
    expect(r.blockedDomainIds).toEqual([first]);
    expect(r.bottlenecks).toEqual([expect.objectContaining({resourceId:`edge:shore/cluster-core>${first}:cluster`,demandBitS:64e9,capacityBitS:20e9})]);
    expect(s.modules.filter(m=>m.id.startsWith('platform-001/')).every(m=>m.availableAccelerators===0&&m.itW===m.energizedNodes*3600)).toBe(true);
    expect(s.modules.filter(m=>m.id.startsWith('platform-002/')).every(m=>m.availableAccelerators===m.energizedNodes*8&&m.itW===m.energizedNodes*12000)).toBe(true);
  });

  it('ignores optional external demand, but enforces the shared external port when the job requires it',()=>{
    const optional=portLimit(design(),'shore/fiber','external-network-out',0.5e9);
    expect(assessNetwork(optional,full(optional)).externalDemandBitS).toBe(0);expect(initialize(optional).modules.every(m=>m.availableAccelerators>0)).toBe(true);
    const required={...optional,config:{...optional.config,requireExternalNetwork:true}},s=initialize(required);
    expect(s.modules.every(m=>m.availableAccelerators===0)).toBe(true);
    expect(assessNetwork(required,s.modules).bottlenecks).toContainEqual(expect.objectContaining({assetId:'shore/fiber',capacityBitS:0.5e9,demandBitS:1.25e9}));
    const local={...required,config:{...required.config,requireClusterNetwork:false,requireExternalNetwork:false}};
    const localState=replay(local,[{id:'fiber',timeS:0,kind:'trip',assetId:'shore/fiber'},{id:'core',timeS:0,kind:'trip',assetId:'shore/cluster-core'}],1);
    expect(localState.modules.every(m=>m.availableAccelerators===m.energizedNodes*8)).toBe(true);
  });

  it('has zero demand with no energized nodes and rejects invalid profile/allocation inputs',()=>{
    const d=design({supplyW:0,batteryWhPerModule:0}),s=initialize(d),r=assessNetwork(d,s.modules);
    expect(r).toMatchObject({status:'satisfied',energizedNodes:0,clusterDemandBitS:0,externalDemandBitS:0,bottlenecks:[]});
    expect(check(d,'NW-02').status).toBe('satisfied');expect(check(d,'NW-01').status).toBe('unassessed');
    expect(()=>assessNetwork(d,[{id:d.modules[0].id,energizedNodes:0.5}])).toThrow();
    expect(()=>createNetworkEvaluator(d,{clusterBitSPerNode:NaN,externalBitSPerNode:0})).toThrow();
  });

  it('resolves actual failed/disabled path causes, rejects multipath, and restores reproducibly',()=>{
    const d=design(),first=d.modules[0].networkDomainId;
    const cut={...d,connections:d.connections.map(e=>e.medium==='cluster'&&e.to===first?{...e,enabled:false}:e)};
    expect(assessNetwork(cut,full(cut))).toMatchObject({status:'violated',unreachableDomainIds:[first]});
    const events=[{id:'cut',timeS:0,kind:'trip' as const,assetId:`${d.modules[0].id}/rack-network`},{id:'restore',timeS:2,kind:'restore' as const,assetId:`${d.modules[0].id}/rack-network`}];
    const fault=replay(d,events,1);
    expect(fault.modules.slice(0,4).every(m=>m.availableAccelerators===0)).toBe(true);
    expect(fault.log.some(l=>l.assetId===events[0].assetId&&l.message.includes('Required cluster path unreachable'))).toBe(true);
    const complete=replay(d,events,4);expect(complete.modules.every(m=>m.availableAccelerators>0)).toBe(true);
    expect(advance(d,fault,3)).toEqual(complete);
    const link=d.connections.find(e=>e.medium==='cluster')!,multi={...d,connections:[...d.connections,{...link,id:'extra-path'}]};
    expect(assessNetwork(multi,full(multi))).toMatchObject({status:'unsupported',unsupportedDomainIds:[first]});
  });

  it('couples idle draw to dispatch without committing trial battery energy, and never masks installed peak shortage',()=>{
    const d=portLimit(design({supplyW:6e6,batteryWhPerModule:0,workload:1}),'shore/cluster-core','cluster-out',40e9),initial=initialize(d),s=advance(d,initial,10);
    expect(s.modules.every(m=>m.availableAccelerators===0)).toBe(true);
    expect(summarize(d,s).energizedAccelerators).toBe(d.provisionedAccelerators);
    expect(check(d,'EL-01').status).toBe('violated');
    const r=conservationResiduals(d,s);expect(Math.abs(r.electricalNormalized)).toBeLessThan(1e-9);expect(Math.abs(r.thermalNormalized)).toBeLessThan(1e-9);
    const local={...d,config:{...d.config,requireClusterNetwork:false,requireExternalNetwork:false,workload:0}},idle=advance(local,initialize(local),10);
    expect(s.itEnergyWh).toBeCloseTo(idle.itEnergyWh,8);expect(s.facilityEnergyWh).toBeCloseTo(idle.facilityEnergyWh,8);
    expect(s.modules.map(m=>m.coolantK)).toEqual(idle.modules.map(m=>m.coolantK));
    const ups=portLimit(design({supplyW:0,workload:1}),'shore/cluster-core','cluster-out',40e9),battery=advance(ups,initialize(ups),10);
    const idleUPS={...ups,config:{...ups.config,requireClusterNetwork:false,workload:0}},reference=advance(idleUPS,initialize(idleUPS),10);
    expect(battery.modules.map(m=>m.batteryWh)).toEqual(reference.modules.map(m=>m.batteryWh));
    expect(battery.modules[0].batteryWh).toBeLessThan(ups.config.batteryWhPerModule);
    expect(battery.facilityEnergyWh).toBeCloseTo(reference.facilityEnergyWh,8);
  });
});

describe('inventory-dependent assumed cost and report boundary',()=>{
  it('counts optional pumps and installed storage independently, with monotone cost and one multiplier',()=>{
    const base=design({requestedAccelerators:1280,standbyPumps:0,batteryWhPerModule:0}),standby=design({...base.config,standbyPumps:1}),storage=design({...standby.config,batteryWhPerModule:800000});
    const a=billOfEquipment(base),b=billOfEquipment(standby),c=billOfEquipment(storage);
    expect(b.equipment-a.equipment).toBe(25000);expect(c.equipment-b.equipment).toBe(800*500);
    expect(b.rows.find(r=>r.scope==='Optional standby pumps')!.count).toBe(moduleAssets(standby,standby.modules[0].id).filter(a=>a.id.endsWith('/pump-standby')).length);
    expect(c.rows.find(r=>r.scope==='Installed battery storage (kWh)')!.count).toBe(800);
    expect(billOfEquipment(storage,1.5).totalUSD).toBeCloseTo(c.totalUSD*1.5,6);
    const s=initialize(storage);expect(sizingAssessment(storage,s,null,1.5).includedCostUSD).toBeCloseTo(c.totalUSD*1.5,6);
    expect(engineeringReport(storage,s,1.5)).toContain(`editable cost multiplier 1.5; included scope estimate USD ${Math.round(c.totalUSD*1.5)}`);
    expect(engineeringReport(storage,s)).toContain(NETWORK_ASSUMPTIONS.id);
    expect(engineeringReport(storage,s)).toContain('normalized by max(1 W, total facility heat sources)');
  });
});

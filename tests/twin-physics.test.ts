import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { advance, advanceWithStep, initialize, replay, summarize, validateEvent } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { ELECTRICAL_ASSUMPTIONS, GRID_EFFICIENCY, solveElectrical } from '../src/twin/solvers/electrical';
import { darcyFrictionFactor, solveHydraulics, systemPressurePa, type HydraulicInput } from '../src/twin/solvers/hydraulic';
import { advanceThermal, solveExchanger } from '../src/twin/solvers/thermal';
import type { DesignConfig, OperationEvent, WorkerResponse } from '../src/twin/types';
const design = (config:Partial<DesignConfig>={})=>buildDesign({...DEFAULT_CONFIG,requestedAccelerators:1280,workload:1,...config});
const hydraulic:HydraulicInput={lengthM:50.4,diameterM:0.18,roughnessM:0.000045,densityKgM3:997,dynamicViscosityPaS:0.000855,fittingsK:12,equipmentDropPaAtReference:80000,referenceFlowM3S:0.05,pumpCount:1,pumpSpeed:1};
const electrical = { desiredNodes:160,workload:1,idleFraction:0.3,networkAvailable:true,criticalLoadW:50000,gridAvailableW:3e6,batteryWh:10000,batteryCapacityWh:10000,batteryMaxW:2.2e6,batteryAvailable:true,isolated:false,dtS:1 };
const hx={technicalInletK:313.15,seawaterInletK:293.15,technicalFlowM3S:0.05,seawaterFlowM3S:0.05,cleanUAWPerK:350000,foulingResistanceKPerW:0};

describe('hydraulic numerical verification',()=>{
  it('uses Darcy laminar 64/Re, finite continuous transition, and zero-flow boundary',()=>{
    expect(darcyFrictionFactor(1000,0)).toBe(0.064);
    expect(darcyFrictionFactor(0,0)).toBe(0);
    expect(darcyFrictionFactor(2300-1e-6,0.00025)).toBeCloseTo(darcyFrictionFactor(2300+1e-6,0.00025),8);
    expect(darcyFrictionFactor(4000-1e-6,0.00025)).toBeCloseTo(darcyFrictionFactor(4000+1e-6,0.00025),8);
    expect(solveHydraulics({...hydraulic,pumpCount:0}).flowM3S).toBe(0);
  });
  it('brackets the pump/system crossing with head <0.01 Pa and mass residual zero',()=>{
    const result=solveHydraulics(hydraulic);
    expect(result.flowM3S).toBeGreaterThan(0.05);expect(result.flowM3S).toBeLessThan(0.1);
    expect(Math.abs(result.headResidualPa)).toBeLessThan(0.01);expect(result.massResidualKgS).toBe(0);
    expect(result.electricalW).toBeCloseTo(result.flowM3S*result.pressurePa/0.72,7);
  });
  it('parallel pumps see shared head; total flow is less than two standalone flows',()=>{
    const one=solveHydraulics(hydraulic),two=solveHydraulics({...hydraulic,pumpCount:2});
    expect(two.flowM3S).toBeGreaterThan(one.flowM3S);expect(two.flowM3S).toBeLessThan(2*one.flowM3S);
    expect(two.pressurePa).toBeCloseTo(systemPressurePa(hydraulic,two.flowM3S),5);
    expect(solveHydraulics({...hydraulic,lengthM:200}).flowM3S).toBeLessThan(one.flowM3S);
  });
  it('matches an independently solved quadratic frictionless benchmark',()=>{
    const result=solveHydraulics({...hydraulic,lengthM:0,fittingsK:0});
    // 250000 - 25e6 Q² = 32e6 Q² => Q=sqrt(250000/57e6).
    expect(result.flowM3S).toBeCloseTo(Math.sqrt(250000/57e6),10);
    expect(result.pressurePa).toBeCloseTo(250000*32/57,3);
  });
  it('rejects unsupported topology and invalid properties',()=>{
    expect(()=>solveHydraulics({...hydraulic,pumpCount:3})).toThrow(/Unsupported/);
    expect(()=>solveHydraulics({...hydraulic,diameterM:0})).toThrow();
  });
});
describe('heat exchanger and bulk thermal verification',()=>{
  it('matches independently hand-derived equal-capacity NTU=1 benchmark',()=>{
    // C_hot=C_cold=1000 W/K, UA=1000 -> effectiveness=1/2 -> Q=10 kW and outlet 303.15 K.
    const result=solveExchanger({...hx,technicalDensityKgM3:1000,technicalCpJKgK:1000,seawaterDensityKgM3:1000,seawaterCpJKgK:1000,technicalFlowM3S:0.001,seawaterFlowM3S:0.001,cleanUAWPerK:1000});
    expect(result.effectiveness).toBeCloseTo(0.5,12);expect(result.heatW).toBeCloseTo(10000,8);
    expect(result.technicalOutletK).toBeCloseTo(303.15,10);expect(result.seawaterOutletK).toBeCloseTo(303.15,10);
    expect(Math.abs(result.balanceResidualW)).toBeLessThan(1e-7);
  });
  it('conserves both streams, including zero flow, no UA, reversal and large NTU',()=>{
    const normal=solveExchanger(hx);expect(Math.abs(normal.balanceResidualW)).toBeLessThan(1e-6);
    expect(solveExchanger({...hx,technicalFlowM3S:0}).heatW).toBe(0);
    expect(solveExchanger({...hx,seawaterFlowM3S:0}).technicalOutletK).toBe(hx.technicalInletK);
    expect(solveExchanger({...hx,cleanUAWPerK:0}).heatW).toBe(0);
    const reverse=solveExchanger({...hx,technicalInletK:293.15,seawaterInletK:313.15});
    expect(reverse.heatW).toBeCloseTo(-normal.heatW,6);
    expect(solveExchanger({...hx,cleanUAWPerK:1e15}).effectiveness).toBeCloseTo(1,8);
    expect(()=>solveExchanger({...hx,technicalInletK:400})).toThrow(/range/);
  });
  it('adds fouling in K/W to thermal resistance',()=>{
    const result=solveExchanger({...hx,cleanUAWPerK:1000,foulingResistanceKPerW:0.001});
    expect(result.effectiveUAWPerK).toBe(500);expect(result.heatW).toBeLessThan(solveExchanger({...hx,cleanUAWPerK:1000}).heatW);
  });
  it('accounts for every end-use/loss heat source and exact insulated temperature rise',()=>{
    const result=advanceThermal({coolantK:303.15,airK:298.15,itW:1e6,facilityW:1.1e6,technicalPumpW:0,seawaterPumpW:0,technicalFlowM3S:0,seawaterFlowM3S:0,seawaterK:291.15,exchangerUAWPerK:350000,foulingResistanceKPerW:0,fanPowered:false,dtS:1});
    expect(result.coolantK).toBeCloseTo(303.15+0.9e6/24e6,10);
    expect(result.rejectedHeatW).toBeCloseTo(0,6);
    expect(Math.abs(result.residualW)).toBeLessThan(1e-6);
    expect(result.storedHeatW+result.ambientHeatW+result.rejectedHeatW).toBeCloseTo(1.1e6,6);
  });
});
describe('electrical boundary verification',()=>{
  it('preserves installed whole-server idle draw and whole-node cuts',()=>{
    expect(solveElectrical({...electrical,workload:0}).itW).toBe(160*12000*0.3);
    const limited=solveElectrical({...electrical,gridAvailableW:200000,batteryAvailable:false});
    expect(limited.energizedNodes).toBe(Math.floor((200000*GRID_EFFICIENCY-50000)/12000));
    expect(limited.gridW).toBeLessThanOrEqual(200000+1e-6);
    expect(Math.abs(limited.residualW)).toBeLessThan(1e-6);
  });
  it('limits discharge by terminal power, stored energy and reserve with conversion loss',()=>{
    const result=solveElectrical({...electrical,gridAvailableW:0,batteryMaxW:200000});
    expect(result.batteryDischargeW).toBeLessThanOrEqual(200000);
    expect(result.batteryWh).toBeCloseTo(10000-result.batteryDischargeW/0.95/3600,8);
    expect(result.batteryChargeW).toBe(0);expect(result.facilityW).toBeGreaterThan(result.loadW);
    const depleted=solveElectrical({...electrical,gridAvailableW:0,batteryWh:1000});
    expect(depleted.batteryDischargeW).toBe(0);expect(depleted.energizedNodes).toBe(0);
  });
  it('charges within power/capacity without double-counting stored energy as facility use',()=>{
    const result=solveElectrical({...electrical,batteryWh:9999});
    expect(result.batteryChargeW).toBeGreaterThan(0);expect(result.batteryDischargeW).toBe(0);
    expect(result.batteryWh).toBeCloseTo(10000,8);
    const storedPower=(result.batteryWh-9999)*3600;
    expect(result.gridW-storedPower).toBeCloseTo(result.facilityW,6);
    expect(Math.abs(result.normalizedResidual)).toBeLessThan(1e-12);
  });
});
describe('coupled deterministic operation',()=>{
  it('initializes exact inventory, no transient energy, and bottom-up PUE',()=>{
    const d=design(),s=initialize(d),sum=summarize(d,s);
    expect(sum.energizedAccelerators).toBe(1280);expect(sum.itW).toBe(160*12000);
    expect(sum.instantaneousPUE).toBeGreaterThan(1);expect(sum.energyPUE).toBeNull();
    expect(s.facilityEnergyWh).toBe(0);expect(sum.electricalResidualW).toBeCloseTo(0,6);
    expect(s.modules[0].technicalFlowM3S).toBeGreaterThan(0);
  });
  it('trips the selected pump, starts standby after 8s and preserves full capacity when adequate',()=>{
    const d=design(),id=d.modules[0].id,initial=initialize(d),event:OperationEvent={id:'trip-1',timeS:0,kind:'trip',assetId:`${id}/pump-duty`};
    const tripped=advance(d,initial,0,[event]);expect(tripped.modules[0].technicalFlowM3S).toBe(0);
    expect(tripped.modules[0].states[`${id}/pump-standby`]).toBe('starting');
    const before=advance(d,tripped,7);expect(before.modules[0].technicalFlowM3S).toBe(0);
    const started=advance(d,before,1);expect(started.modules[0].technicalFlowM3S).toBeGreaterThan(0);
    const stable=advance(d,started,300);expect(stable.modules[0].throttle).toBe(1);expect(stable.modules[0].availableAccelerators).toBe(1280);
    expect(initial.events).toHaveLength(0);expect(initial.modules[0].states[`${id}/pump-duty`]).toBe('running');
  });
  it('without standby loses flow, heats the bulk node, and curtails by actual hysteresis',()=>{
    const d=design({standbyPumps:0}),id=d.modules[0].id;
    const s=replay(d,[{id:'trip',timeS:5,kind:'trip',assetId:`${id}/pump-duty`}],600);
    expect(s.modules[0].technicalFlowM3S).toBe(0);expect(s.modules[0].coolantK).toBeGreaterThan(318.15);
    expect(s.modules[0].energizedNodes).toBeLessThan(160);expect(s.log.some(e=>e.message.includes('Thermal hysteresis'))).toBe(true);
    const restored=advance(d,s,400,[{id:'restore',timeS:600,kind:'restore',assetId:`${id}/pump-duty`}]);
    expect(restored.modules[0].technicalFlowM3S).toBeGreaterThan(0);expect(restored.modules[0].coolantK).toBeLessThan(s.modules[0].coolantK);
    expect(restored.modules[0].throttle).toBe(1);
  });
  it('exhausts finite UPS energy following shared source loss and does not use grid/IT as PUE',()=>{
    const d=design({batteryWhPerModule:10000}),id=d.modules[0].id;
    const early=replay(d,[{id:'grid-trip',timeS:0,kind:'trip',assetId:'shore/grid'}],1);
    const sum=summarize(d,early);expect(sum.gridW).toBe(0);expect(sum.instantaneousPUE).toBeGreaterThan(1);
    expect(early.modules[0].batteryDischargeW).toBeGreaterThan(0);
    const later=advance(d,early,120);expect(later.modules[0].energizedNodes).toBe(0);
    expect(later.modules[0].batteryWh).toBeGreaterThanOrEqual(10000*ELECTRICAL_ASSUMPTIONS.batteryReserveFraction-1e-8);
    expect(later.modules[0].batteryWh).toBeLessThan(1010);expect(summarize(d,later).instantaneousPUE).toBeNull();
    expect(later.log.some(e=>e.affectedIds.includes(id))).toBe(true);
  });
  it('logs actual pump power loss and recovery once through a 1800s feeder outage without dropping the original event',()=>{
    const d=design({batteryWhPerModule:400000}),id=d.modules[0].id,feeder=d.modules[0].powerDomainId;
    const events:OperationEvent[]=[{id:'feeder-loss',timeS:0,kind:'trip',assetId:feeder},{id:'feeder-return',timeS:1500,kind:'restore',assetId:feeder}];
    const depleted=replay(d,events,1400);
    expect(depleted.modules[0].energizedNodes).toBe(0);expect(depleted.modules[0].pumpPowerW).toBe(0);
    expect(depleted.modules[0].states[`${id}/pump-duty`]).toBe('available');
    const losses=depleted.log.filter(e=>e.message.startsWith('Pump not powered:'));
    expect(losses).toHaveLength(2);expect(new Set(losses.map(e=>e.assetId))).toEqual(new Set([`${id}/pump-duty`,`${id}/pump-sea`]));
    expect(losses[0].timeS).toBeGreaterThan(600);expect(losses[0].timeS).toBeLessThan(900);
    expect(depleted.log.filter(e=>e.timeS>=losses[0].timeS&&e.message.includes('Duty pump enabled'))).toHaveLength(0);
    expect(depleted.log.some(e=>e.assetId===feeder&&e.kind==='command'&&e.timeS===0)).toBe(true);
    expect(depleted.log.length).toBeLessThan(40);
    const complete=advance(d,depleted,400),direct=replay(d,events,1800);
    expect(complete).toEqual(direct);expect(complete.modules[0].technicalFlowM3S).toBeGreaterThan(0);
    expect(complete.log.filter(e=>e.message.startsWith('Pump power restored;'))).toHaveLength(2);
    expect(complete.log.filter(e=>e.message.startsWith('Pump power restored;')).every(e=>e.timeS===1500)).toBe(true);
    expect(complete.log.some(e=>e.assetId===feeder&&e.kind==='command'&&e.timeS===0)).toBe(true);
    expect(complete.log.length).toBeLessThan(45);
  });
  it('honors upstream transformer and generation failure-domain differences',()=>{
    const a=design({generation:1,requestedAccelerators:10000,batteryWhPerModule:0});
    const b=design({generation:2,requestedAccelerators:10000,batteryWhPerModule:0});
    const fa=replay(a,[{id:'fail-a',timeS:0,kind:'trip',assetId:'shore/transformer'}],1);
    const fb=replay(b,[{id:'fail-b',timeS:0,kind:'trip',assetId:`${b.modules[0].platformId}/transformer`}],1);
    expect(summarize(a,fa).energizedAccelerators).toBe(0);
    expect(summarize(b,fb).energizedAccelerators).toBeGreaterThan(0);
    expect(fb.modules.filter(m=>m.energizedNodes===0)).toHaveLength(4);
  });
  it('isolates exact node/rack assets and module maintenance; required network failure leaves idle power',()=>{
    const d=design(),id=d.modules[0].id;
    const rack=replay(d,[{id:'rack',timeS:0,kind:'trip',assetId:`${id}/rack-01`}],1);expect(rack.modules[0].energizedNodes).toBe(156);
    const node=replay(d,[{id:'node',timeS:0,kind:'trip',assetId:`${id}/rack-01/node-01`}],1);expect(node.modules[0].energizedNodes).toBe(159);
    const maintenance=replay(d,[{id:'maint',timeS:0,kind:'maintenance',assetId:id}],1);expect(maintenance.modules[0].facilityW).toBe(0);
    const network=replay(d,[{id:'net',timeS:0,kind:'trip',assetId:d.modules[0].networkDomainId}],1);
    expect(network.modules[0].availableAccelerators).toBe(0);expect(network.modules[0].itW).toBe(160*12000*0.3);
    const local=replay(d,[{id:'fiber',timeS:0,kind:'trip',assetId:'shore/fiber'}],1);expect(local.modules[0].availableAccelerators).toBe(1280);
  });
  it('replays exactly across different integer chunk schedules and keeps original state immutable',()=>{
    const d=design(),id=d.modules[0].id,events:OperationEvent[]=[{id:'pump',timeS:10,kind:'trip',assetId:`${id}/pump-duty`},{id:'restore',timeS:100,kind:'restore',assetId:`${id}/pump-duty`},{id:'hot',timeS:200,kind:'seawater',assetId:'shore/grid',value:300.15}];
    const direct=replay(d,events,300);
    let chunked=advance(d,initialize(d),0,events);for(let n=0;n<30;n++)chunked=advance(d,chunked,10);
    expect(chunked).toEqual(direct);expect(replay(d,events,300)).toEqual(direct);
  });
  it('converges across 1s, 0.5s and 0.25s constant-load integration without threshold crossings',()=>{
    const d=design({workload:0.6}),s=initialize(d);
    const a=advanceWithStep(d,s,120,[],1),b=advanceWithStep(d,s,120,[],0.5),c=advanceWithStep(d,s,120,[],0.25);
    expect(Math.abs(a.modules[0].coolantK-c.modules[0].coolantK)).toBeLessThan(0.001);
    expect(Math.abs(b.modules[0].airK-c.modules[0].airK)).toBeLessThan(0.001);
    expect(Math.abs(a.facilityEnergyWh-c.facilityEnergyWh)).toBeLessThan(0.001);
  });
  it('responds causally to warmer seawater, fouling and speed with conservation',()=>{
    const d=design(),base=replay(d,[],300);
    const hot=replay(d,[{id:'hot',timeS:0,kind:'seawater',assetId:'shore/grid',value:300.15}],300);
    const foul=replay(d,[{id:'foul',timeS:0,kind:'fouling',assetId:'shore/grid',value:0.00001}],300);
    expect(hot.modules[0].coolantK).toBeGreaterThan(base.modules[0].coolantK);
    expect(foul.modules[0].coolantK).toBeGreaterThan(base.modules[0].coolantK);
    const slow=replay(d,[{id:'slow',timeS:0,kind:'pump-speed',assetId:'shore/grid',value:0.5}],1);
    expect(slow.modules[0].technicalFlowM3S).toBeLessThan(base.modules[0].technicalFlowM3S);
    expect(Math.abs(summarize(d,hot).thermalResidualW)).toBeLessThan(1e-5);
  });
  it('conserves cumulative grid-plus-storage energy through loss and recharge',()=>{
    const d=design({batteryWhPerModule:10000}),initial=initialize(d);
    const result=replay(d,[{id:'outage',timeS:0,kind:'trip',assetId:'shore/grid'},{id:'reconnect',timeS:20,kind:'restore',assetId:'shore/grid'}],100);
    const storedDelta=result.modules[0].batteryWh-initial.modules[0].batteryWh;
    expect(result.gridEnergyWh-storedDelta).toBeCloseTo(result.facilityEnergyWh,6);
    expect(result.modules[0].batteryWh).toBeLessThanOrEqual(10000);
  });
  it('interlocks a closed loop and never reports its motor running without achieved circulation',()=>{
    const d=design(),id=d.modules[0].id;
    const closed=replay(d,[{id:'valve',timeS:0,kind:'trip',assetId:`${id}/valve-tech`}],10);
    expect(closed.modules[0].technicalFlowM3S).toBe(0);
    expect(closed.modules[0].states[`${id}/pump-duty`]).toBe('isolated');
    expect(closed.modules[0].states[`${id}/pump-standby`]).toBe('isolated');
    const recovered=advance(d,closed,1,[{id:'open',timeS:10,kind:'restore',assetId:`${id}/valve-tech`}]);
    expect(recovered.modules[0].technicalFlowM3S).toBeGreaterThan(0);
  });
  it('respects shared supply cuts under simultaneous module and battery demand',()=>{
    const d=design({generation:2,requestedAccelerators:10000,supplyW:5e6});
    const result=replay(d,[],30);
    expect(summarize(d,result).gridW).toBeLessThanOrEqual(5e6+1e-6);
    expect(result.modules.every(m=>m.gridW<=2.2e6+1e-6)).toBe(true);
    expect(result.modules.every(m=>m.batteryChargeW===0||m.batteryDischargeW===0)).toBe(true);
    expect(result.modules.every(m=>Number.isInteger(m.energizedNodes))).toBe(true);
  });
  it('rejects unknown assets, non-SI/out-of-range commands, obsolete states and fractional clock advances',()=>{
    const d=design();
    expect(()=>validateEvent(d,{id:'a',timeS:0,kind:'trip',assetId:'imaginary/pump'})).toThrow(/Unknown/);
    expect(()=>validateEvent(d,{id:'a',timeS:0,kind:'seawater',assetId:'shore/grid',value:25})).toThrow(/limits/);
    expect(()=>advance(d,initialize(d),0.5)).toThrow(/integer/);
    expect(()=>advance(d,{...initialize(d),designRevision:'old'},1)).toThrow(/revision/);
  });
});
describe('versioned asynchronous worker',()=>{
  it('cancels an in-flight chunked replay and suppresses stale epochs/requests',async()=>{
    const d=design(),responses:WorkerResponse[]=[],waiters:(()=>void)[]=[];
    const handler=createWorkerHandler(r=>responses.push(r),()=>new Promise<void>(resolve=>waiters.push(resolve)),()=>0);
    const running=handler({version:2,requestId:1,epoch:1,kind:'replay',design:d,durationS:100});
    expect(waiters).toHaveLength(1);
    await handler({version:2,requestId:2,epoch:1,kind:'cancel'});
    waiters.shift()!();await running;
    expect(responses).toHaveLength(1);expect(responses[0].status).toBe('cancelled');expect(responses[0].state).toEqual(initialize(d));
    await handler({version:2,requestId:1,epoch:0,kind:'initialize',design:d});expect(responses).toHaveLength(1);
    await handler({version:2,requestId:3,epoch:2,kind:'initialize',design:d});expect(responses.at(-1)?.state?.timeS).toBe(0);
  });
  it('surfaces revision mismatch as a typed error',async()=>{
    const d=design(),responses:WorkerResponse[]=[];
    const handler=createWorkerHandler(r=>responses.push(r),async()=>{},()=>0);
    await handler({version:2,requestId:1,epoch:1,kind:'advance',design:d,state:{...initialize(d),designRevision:'stale'},durationS:1});
    expect(responses[0].error).toMatch(/revision mismatch/);expect(responses[0].requestId).toBe(1);
  });
});

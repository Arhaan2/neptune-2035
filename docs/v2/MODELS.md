# NEPTUNE v2 reduced-order model cards

Status: **Design-stage digital twin · Simulated operation.** The implemented model is a reproducible design investigation, with no identified physical installation or empirical calibration. Software and numerical verification below are not physical validation or operational commissioning. Solver version is `2.0.0-rc.1`; the authoritative runtime value is `SOLVER_VERSION` in `src/twin/types.ts`.

## Intended uses and evidence boundary

Supported uses are investigating whole-node power allocation, topology-dependent outages, bounded UPS response, equivalent cooling-loop operating points, bulk thermal evolution, and event/control causality. The canonical reference design and its asset IDs determine inventory, physical lengths and dependencies. No extrapolation to AI training performance, GPU junction temperature, AC fault currents, detailed rack coolant balance, CFD, marine survivability or equipment certification is supported.

All equipment curves, efficiencies, capacitances, losses and environmental constants below are **assumptions** unless a source is named specifically for an equation. Runtime numerical results are **derived**; telemetry synthesized from them is **generated**. No record is measured solely because it agrees with a simulation. The generic 12 kW node is a whole-server envelope, not an actual manufacturer's validated liquid-cooled product.

## M-ELEC: electrical and compute capacity network

Implementation: `src/twin/solvers/electrical.ts`, integrated by `src/twin/engine/simulation.ts`.

Inputs use W, Wh, seconds and dimensionless efficiencies. Every module contains at most 160 generic nodes, eight accelerators per node. A whole node draws

```
P_node = 12000 × [idleFraction + (1 − idleFraction) × dispatchedWorkload]
```

Dispatched workload is zero when the job's required network is unavailable; energized servers retain idle draw. Installed peak remains `nodeCount × 12000 W` at every workload. Thermal controls and failed rack/node assets reduce the permitted whole-node count; the allocation takes an integer floor after reserving critical cooling/control power. Accelerator counts are actual inventory counts, not speculative performance-equivalent units.

The enabled power graph must contain one radial path from each module domain to `shore/grid`. The engine traverses upstream transformer, switchboard and connection capacities. A missing path, cycle or enabled multiple-parent tie is unsupported and yields zero grid capacity plus a visible warning. Generation I shares the centralized shore transformer/bus; II and III have platform domains. All share the same upstream source. Generation III normally-open ties are not silently treated as independent supplies. Each module's battery/distribution branch is capped at 2.2 MW. Grid allocations are proportional within domain and common-source limits; optional charging receives only remaining branch/domain/source capacity. This is a deterministic capacity allocation, not a globally optimal dispatch.

Grid-path efficiency is `0.98 × 0.97 = 0.9506`, representing distribution and UPS conversion. The 3 kW control/network allowance plus 15 kW fan load per module and achieved electrical pump demand are downstream of the module UPS. Cluster-media uplinks join each platform network to an explicit shared `shore/cluster-core`. External traffic follows `shore/fiber` and its carrying platform network. Enabled typed-graph reachability, failed assets and the declared offered-demand capacity screen below determine which jobs remain accessible. Network admission is a logical capacity requirement screen; individual network device power/backup is represented in this allowance, not an independently verified network electrical design. Partial modules retain the supporting enclosure and critical-load envelope.

All module IT, pumps and critical auxiliaries have the same declared UPS-backed bus. A feeder/source outage removes grid input but storage may supply that bus. The serial `/battery` asset represents the combined UPS/battery interface: tripping it disables the module bus; it is not a storage-only fault with an invented bypass. `/distribution` failure and module/platform maintenance isolate module loads. No AC voltage, reactive power, harmonic, short-circuit, protection-selectivity or cable-impedance calculation is implemented.

### Battery and facility boundary

Stored energy is Wh. Battery charge/discharge terminal powers are W, at the load-bus side of conversion. Charge and discharge efficiencies are each 0.95; reserve is 10% of rated energy. Power is limited both by configured W and the available energy/room over the numerical interval:

```
E_next = E + (0.95 P_charge − P_discharge / 0.95) dt / 3600
```

The solver forbids simultaneous charge and discharge. With insufficient power for the critical circuit, all module loads are off. It can stop just above reserve when the remaining energy cannot sustain the minimum critical circuit for one full second; the UI warns explicitly that this is a remaining power/energy limit. There is no guaranteed ride-through based on kWh alone, and no instantaneous refill.

`facilityW` includes IT, pumps, fan/control consumption, grid conversion losses and battery charge/discharge conversion losses. It excludes energy entering battery storage. The instantaneous boundary balance is

```
P_grid + P_discharge / eta_discharge
  = P_facility + eta_charge P_charge
```

Thus facility/IT remains meaningful during UPS operation; grid/IT is never used as PUE. The instantaneous ratio is labeled a proxy. `facilityEnergyWh / itEnergyWh` covers simulation time zero through the selected time with the same boundary. Either ratio is `null` when its IT denominator is zero. This is a declared simulation boundary, not a claim of formal metering compliance.

The electrical residual is the signed difference of the two sides of the boundary equation in W; normalized residual divides by the maximum of 1 W, grid W and facility W. Runtime warnings use normalized tolerance `1e-9`. This deliberately omits battery self-discharge, degradation, temperature derating and detailed transfer waveforms.

## M-NET: declared offered demand over unique network routes

Implementation: `src/twin/solvers/network.ts`; assumption record `illustrative-job-traffic-v1`, revision 1.0.0, dated 2026-09-08, evidence **assumed**. The default illustrative profile offers 100 Mbit/s cluster and 1 Mbit/s external traffic per energized whole node, simultaneously. Each class is included only when the corresponding job requirement is enabled. Self-contained jobs require neither class. This is a versioned workload boundary, with an optional `TrafficProfile` argument to the pure API; the persisted design/project schema is unchanged. It is not a measured job matrix or an assertion about achieved throughput, packet latency, congestion scheduling or training performance.

`createNetworkEvaluator(design,profile?)` compiles the actual canonical cluster/external connections and endpoint port ratings, then returns a pure query accepting ordered `{id, energizedNodes}` module allocations and failed asset IDs. `assessNetwork(design,allocations,failedIds?,profile?)` is its one-shot counterpart. Required cluster paths start at `shore/cluster-core`; external paths start at `shore/fiber` and continue on the carrying cluster network. Direction is source-to-node. Reverse-direction and all-to-all collective workloads require another declared profile/topology treatment and are not inferred. Enabled radial routes must be unique. Multiple reachable parents, cycles or invalid ports mark dependent job domains unsupported; no ECMP or arbitrary splitting is invented. A zero-capacity enabled link is a reachable but overloaded resource for positive demand.

```
node offered demand = energized whole nodes × required per-node bit/s
edge offered demand = sum of node demands whose unique path uses the edge
port offered demand = sum of demands on every edge sharing that exact port
admission requires each used edge/port demand <= its declared bit/s capacity
```

Cluster and external offered demand add on downstream resources they share. Ingress and egress ports are distinct, and an individual edge is not confused with the capacity of its shared source port. Default 10000 accelerators means 1250 nodes and 125 Gbit/s required cluster demand, which fits the 400 Gbit/s shared core port. A 50000-accelerator example with sufficient electric power energizes 6250 nodes and offers 625 Gbit/s: its individual platform links fit, but the shared core port fails. Only the whole job domains using an overloaded resource become unavailable. A platform link failure or overload does not block unrelated platforms. A failed rack-network switch blocks its platform job domain; a failed compute node/rack is first removed from operable compute inventory. Nodes allocated by count are deterministically the first N operable canonical IDs.

Unavailable jobs retain whole-node idle power. Offered demand remains defined per energized node even while those jobs wait, so idling does not erase the reason for failed admission. Electrical dispatch and network admission iterate monotonically within a timestep before committing battery or thermal state. The normal case requires one pass and a newly blocked domain requires a correction; idle draw can free power to energize additional nodes, so their added offered demand is assessed too. Eight passes bound the solve; exceeding that limit conservatively blocks required job domains with an explicit unsupported-dispatch warning. The next timestep can release a block if the constraint clears. Endpoint queries never accumulate trial energy.

The graph is compiled once per evaluator; reachability and upstream load accumulation use linear traversals. The evaluator memoizes the last identical count/failure query. It does not perform repeated full graph searches per node per timestep. Bottleneck attribution walks only actual energized paths when overload exists. Report NW-01 covers path reachability; NW-02 screens declared demand and participates in sizing. No energized nodes means zero offered traffic and a satisfied zero-load NW-02 check, while NW-01 remains unassessed because no working job has demonstrated connectivity. A separate installed-peak electrical calculation disables network job requirements and holds storage at reserve, so network idle draw cannot create a false electrical-capacity pass.

## M-COST: inventory-dependent illustrative included scope

`billOfEquipment(design,unitCostScale=1)` uses dated 2026-09-08 assumptions, not vendor quotes. Per-module cooling base USD 575000 includes duty/seawater pumps, HX and CDU; optional standby pumps add USD 25000 each from installed inventory. Per-module electrical base USD 600000 excludes storage, which adds USD 500 per installed kWh from battery asset `energyWh` ratings. This avoids counting either storage or standby pumps twice and preserves the default combined allowances. Compute, racks, platform/hull and networking retain their separately declared assumed allowances. Installation is 20% of equipment and contingency 25% of equipment plus installation. The 0.7–1.5 scenario range is not a statistical confidence interval. Unit-cost scaling applies once to all equipment rows and derived allowances; sizing and exported reports receive the same optional scale. Excluded shore works, permits, mooring, taxes, finance, operations and replacements remain explicitly listed.

## M-HYD: two distinct equivalent hydraulic circuits

Implementation: `src/twin/solvers/hydraulic.ts`. The technical closed loop and once-through seawater circuit are separate. Their only heat coupling is the exchanger. Seawater never circulates through a compute node.

Each supported circuit is an incompressible, single-phase equivalent series route. The technical route permits zero, one or two identical parallel pump branches with the same speed; control normally operates one duty pump or its standby replacement. More than two parallel pumps, arbitrary hydraulic meshes, unequal pump curves and active valve modulation are unsupported. Per-rack branch balancing is not implemented; a fixed equivalent equipment pressure-drop term represents the distributed rack/CDU/exchanger path.

Canonical `loopGeometry(design,module)` supplies physical hydraulic lengths independent of camera, X-ray or explosion. The technical equivalent path follows the 56 m rectangular routed header shown in the model plus one 2.4 m equivalent rack branch. All rack return branches pass through the exchanger; the parallel CDU-to-exchanger bypass does not bypass heat rejection. Seawater uses its physical riser and module route. The total wetted length of all parallel rack branches is included in pipe/coolant mass and must not be confused with one equivalent flow path. The floating waterline is solved from this inventory, including the small intake-length/water-mass coupling. Pipes are 0.18 m diameter with assumed roughness 0.000045 m. Equivalent fittings coefficients are 12 technical and 10 seawater. Equipment pressure losses at 0.05 m³/s are assumed 80 kPa and 55 kPa respectively, scaling with flow squared.

```
v = volumeFlow / (pi D²/4)
Re = rho v D / dynamicViscosity
DeltaP_system = (f_Darcy L/D + K_fittings) rho v²/2
                + DeltaP_equipment,ref (volumeFlow / volumeFlow_ref)²
```

Technical fluid constants are 997 kg/m³, 4180 J/(kg K), and 0.000855 Pa·s. Seawater constants are 1025 kg/m³, 3990 J/(kg K), and 0.00108 Pa·s. Salinity, temperature-dependent properties, corrosion, cavitation, NPSH, startup water hammer, pressure transients and discharge permitting remain outside the model.

Darcy friction is `64/Re` through Re=2300. At Re≥4000 the Haaland approximation is used. Between 2300 and 4000 the solver linearly interpolates the endpoint factors as an explicit transition assumption; it is not a prediction of unstable transitional flow. At zero flow, pressure and friction loss are zero. The EPA EPANET documentation confirms the need to distinguish laminar, transitional and turbulent Darcy–Weisbach treatment; this solver does not reproduce EPANET's particular transition interpolation or turbulent approximation. [EPA EPANET network model](https://usepa.github.io/EPANET2.2/3_network_model.html)

The assumed pump curve and electrical power are

```
DeltaP_pump = 250000 s² [1 − (Q_total / (n × 0.1 × s))²]
P_electrical = DeltaP_system Q_total / 0.72
```

Here `s` is speed fraction and `n` the number of enabled identical pumps. The parallel pumps share system head; two pumps do not receive twice the standalone flow. Speed is bounded at 0–1.2. Bisection brackets the operating point from zero to aggregate free delivery, with at most 60 iterations and a 1e-12 m³/s interval criterion. Head residual must be below 0.01 Pa in the numerical tests and at runtime. Series continuity imposes equal flow in and out, giving zero mass residual by construction. This zero is a property of the supported template, not verification of an arbitrary pipe network.

A failed/closed pipe, valve, CDU or exchanger triggers a declared motor interlock for its affected circuit. Motors stop and become isolated. The model does not pretend a stalled centrifugal pump has zero electrical power. Zero speed likewise disables motors. Successful return to service restores the supported path.

## M-HX: counterflow effectiveness–NTU exchanger

Implementation: `solveExchanger` in `src/twin/solvers/thermal.ts`.

The two streams are coupled by an adiabatic exchanger without modeled wall storage:

```
C_technical = rho_technical cp_technical Q_technical
C_seawater  = rho_seawater cp_seawater Q_seawater
UA_effective = 1 / (1/UA_clean + R_fouling)
C_min = min(C_technical, C_seawater)
r = C_min / C_max
NTU = UA_effective / C_min
epsilon = (1 − exp(−NTU (1−r))) / (1 − r exp(−NTU (1−r)))
```

For equal capacity rates, `epsilon = NTU / (1+NTU)`. Transfer is `epsilon C_min (T_technical,in − T_seawater,in)`. Outlet temperatures follow each stream's energy balance. Fouling is an explicit additional total resistance in K/W, not a dimensionless multiplier. `UA_clean=0` or either zero flow gives zero transfer. Temperature reversal gives signed reverse heat transfer. Stable `expm1` evaluation avoids cancellation at small NTU. The near-equal capacity threshold is `abs(1−r)<1e-8`.

The formulation and resistance structure were checked against [MathWorks E-NTU Heat Transfer](https://www.mathworks.com/help/hydro/ref/entuheattransfer.html) on 2026-09-08. This equation reference validates neither the assumed UA nor generic equipment selection, and does not create a MATLAB dependency.

The API rejects nonfinite/negative flows, UA or resistance; negative/zero fluid properties; technical inlet outside 273.15–373.15 K; and seawater inlet outside 271.15–343.15 K. Operational boundary commands are more narrowly bounded to 275.15–311.15 K. Constant properties near the widest allowable limits are an approximation, not water/sea property certification. No boiling, freezing, phase-change or chemistry model is implemented.

The exchanger residual compares both independently reconstructed stream heat rates, with absolute verification tolerance 1e-6 W for the supplied normal-flow test and 1e-7 W for the 10 kW benchmark. These are floating-point accounting tolerances, not physical heat-transfer accuracy.

## M-THERM: transient bulk coolant and air nodes

Implementation: `advanceThermal` in `src/twin/solvers/thermal.ts`.

`coolantK` is the module's lumped warm technical-fluid/equipment node at the exchanger inlet; it is not GPU junction temperature. `airK` is the module's bulk air/equipment node. Initial temperatures are 303.15 K and 298.15 K. Assumed module thermal capacitances are 24 MJ/K and 12 MJ/K. They are fixed support/enclosure/buffer envelopes for the reference module, including partial occupancy; resolving component capacitances is future work and requires evidence.

90% of whole-node IT heat and 90% of technical pump electric consumption enter the technical node. 90% of seawater pump electric consumption enters outgoing seawater directly. All remaining facility consumption—including residual IT heat, fan/control power, pump motor-to-room heat and electrical conversion/charge losses—enters the air node. This accounts for every heat source within the declared facility boundary.

Air rejects to an assumed 298.15 K ambient through passive conductance 500 W/K plus 22000 W/K when the 15 kW fan is powered. This is a reduced-order declared air-side heat-removal assumption, not a verified offshore ventilation design. Temperature reversal can cause ambient heat gain; no hidden clamp forces heat rejection positive.

Each node follows `C dT/dt = Q_generated − G (T − T_boundary)`. Power, flow and conductance are constant over each substep. The implementation integrates this linear balance analytically using `expm1`; zero conductance uses `DeltaT=Q dt/C`. The method therefore avoids Euler stability artifacts for the supported linear nodes.

During a nonzero integration interval, rejected heat, ambient heat, storage rate and outlet temperatures are interval means from the integrated energy balance. At a returned integer-second snapshot, the engine also resolves a zero-duration endpoint calculation, so displayed W and outlet temperatures refer to the selected simulated time; energy accumulators retain the actual integrated intervals. `rejectedHeatW` includes exchanger transfer plus the direct seawater-pump heat. Outlet fields do not describe a spatial CFD field.

The module thermal residual in W is `facilityW − rejectedHeatW − ambientHeatW − storedHeatW`. Its normalized denominator is the maximum of 1 W, facility W and absolute storage W. The runtime warning threshold is `1e-9`; tests require <1e-6 W for the simple insulated benchmark and <1e-5 W for coupled runs. A zero residual demonstrates numerical accounting, not truth of the assumed heat paths or capacitances.

## M-COUPLE: update order, time and control

Implementation: `src/twin/engine/simulation.ts` and `worker.ts`.

Public functions are `initialize(design)`, `advance(design,state,durationS,events?)`, `replay(design,events,durationS)` and `summarize(design,state)`. Inputs are not mutated. `validateEvent` is exported for ingestion/UI validation. `advanceWithStep` is a numerical-verification API accepting 1, 0.5, 0.25 or 0.125 s steps.

The public operational clock and event times are integer seconds. Advance is bounded to 86400 seconds per request and a 30-day simulated horizon; event history is capped at 10000. This explicit time resolution keeps render frames and UI playback speed out of integration. Integer-duration request chunking produces identical numerical states and event logs. Fractional real-time input is not silently accepted as a new numerical scheme.

At each step:

1. Apply validated timestamped events in deterministic time/ID order.
2. Resolve isolation, motor interlocks, pump startup state and thermal hysteresis.
3. Solve achieved hydraulic flow and electrical pump demand.
4. Allocate domain/source capacity to loads, then spare capacity to charging; apply battery power/energy limits and whole-node curtailment. Assess required offered traffic over actual edge/shared-port capacities and repeat allocation with blocked job domains at idle draw until admission stabilizes (maximum eight passes). Trial dispatch does not mutate stored energy.
5. If critical electrical power is unavailable, disable both pump curves and all bus loads. This binary critical-bus correction is the converged supported coupling case: both achieved flow and electrical pump consumption are zero. Supported pumps have constant commanded speed independent of IT and inlet temperature, so an arbitrary iterative load/flow calculation is unnecessary. Voltage-dependent pump curves or temperature-dependent hydraulic properties would require a new coupled solve and are not represented.
6. Integrate each thermal node and battery state over at most one second; accumulate facility, IT and grid energy; report residuals and transitions.

This is a quasi-steady hydraulic/electrical and dynamic thermal/storage model. It does not solve continuously coupled motor voltages, fluid momentum or exchanger wall temperatures. A closed-form/binary coupling result is not described as a converged general nonlinear solver. Repeated identical hydraulic templates are memoized by medium, physical path length, pump count and speed, without changing fidelity.

A duty pump trip removes only that pump branch. An eligible standby enters `starting` and runs after eight seconds. An explicit duty restore has a three-second restart delay; an operating standby remains running until duty is ready, then returns to standby. No assertion of N+1 adequacy is made independently of calculated flow/temperature.

The thermal controller permits 100%, 50%, or 0% of whole nodes. It moves from full to half at coolant ≥318.15 K or air ≥313.15 K, and shuts off at coolant ≥328.15 K or air ≥323.15 K. Recovery from off requires coolant <318.15 K and air <313.15 K; recovery from half to full requires coolant <313.15 K and air <308.15 K. These are assumed bulk-node design limits, not manufacturer GPU thermal protection thresholds. Disabled modules remain thermally present, with passive storage/rejection.

The worker protocol uses schema version 2, monotonic request IDs and scenario epochs. A newer request cancels older work; older request/epoch responses are suppressed. Replays yield a macrotask after each ≤10-second chunk so cancellation can be processed. Invalid revisions, inputs, unsupported fluid ranges and worker errors produce typed errors instead of replacing state with a nominal green result. `solverMs` is a wall-clock worker timing measurement; pure simulation functions leave it zero so it cannot affect replay physics. Timing includes yielding overhead, not only numerical CPU time.

## Verification cases and tolerances

Executed 2026-09-08: `npm test -- tests/twin-physics.test.ts`, **27 passed**, with exact current count owned by the test runner. These tests cover:

- Darcy laminar value and continuous declared transition; bracketed operating point (<0.01 Pa head residual), shared-head parallel pumps, length effect and unsupported topology rejection.
- Independent hand-calculated equal-capacity `C=1000 W/K`, `UA=1000 W/K`, inlet difference 20 K: effectiveness 0.5, transfer 10 kW, both outlets 303.15 K. Absolute 1e-7 W stream balance tolerance reflects floating-point arithmetic.
- Exchanger zero flow, zero UA, reversal, high NTU, explicit fouling and out-of-range errors.
- Insulated bulk coolant rise `900000 W / 24000000 J/K = 0.0375 K` in one second, with full heat accounting.
- Whole-node idle draw and grid cuts; battery terminal-power, energy, reserve and efficiency limits; charge/discharge exclusion and charging boundary conservation.
- Actual selected-pump trip, eight-second standby, full-capacity recovery when sufficient; no-standby bulk heating and real hysteresis curtailment; restoration and cooling recovery.
- Shared-source UPS depletion, undefined zero-IT instantaneous PUE, centralized versus platform transformer isolation, exact rack/node failures, module maintenance and required-network idle behavior.
- Exact event replay and equality across thirty 10-second chunks versus one 300-second run; source input immutability.
- 1/0.5/0.25-second transient comparison, tolerances 0.001 K and 0.001 Wh, without threshold crossings. Analytic integration makes these tight comparisons possible. This does not quantify control threshold-time sensitivity in all failure scenarios.
- Hot seawater, fouling, pump-speed causal effects, validation bounds, asynchronous cancellation and stale worker response suppression.

These tests are software/numerical verification. Their agreement does not validate selected UA, pipe roughness, losses, battery ratings, mass/capacitance or control thresholds. Additional intended-use evidence requires identified hardware, independently measured power/flow/temperature/storage data, instrument uncertainty, excitation across the operating envelope, bounded calibration with held-out observations, and documented acceptance tolerances. Calibration/physical validation and operational commissioning remain pending.


## Integration audit and independent harness

A subsequent cross-boundary audit corrected rack returns that bypassed the exchanger, missing water mass in parallel branches, integrated-UPS port ratings conflated with battery terminal power, missing cluster interconnection, and false passing capacity/marine conditions. Port media/direction/capacity checks now include zero-available-supply designs. Connection capacities respect both endpoint limits. Whole-node peak dispatch without storage support determines installed electrical acceptance; a separate declared-limit cooling screen catches latent heat-rejection shortfall before the initial bulk temperature rises. Sizing uses these same electrical/thermal/path/geometry/mass/network screens and the declared included-cost budget. The declared illustrative traffic-demand screen is now assessed and included in sizing; marine survival remains unassessed and excluded rather than becoming feasible.

`reference/benchmarks.py` imports no application code and regenerates `reference/benchmarks.json`. It contains five independent benchmarks: equal-capacity exchanger, algebraic frictionless pump/system intersection, rational battery-energy update, rectangular two-pontoon displacement, and an RK4 thermal reference with 0.01 s steps. The production thermal solution uses analytical integration, providing numerical-method separation for this benchmark. These are numerical verification fixtures, not measurements or empirical validation.

`tests/twin-integration.test.ts` additionally verifies exact inventory and IDs, graph media/path integrity, all wetted branch mass, actual floated hull draft versus supported mass, unknown-mass/geometry status, whole-peak allocation that cannot be masked by UPS, latent peak cooling failure, strict project-event/solver import validation, source/domain/network faults, and identical recorded 240-second redundancy experiments. The signature may recover both variants to full energized capacity while retaining a calculated temperature difference; no dramatic curtailment result is hardcoded. A bounded million-accelerator / 10 GW-supply test with self-contained jobs checks 125000 nodes, 782 modules and 196 platforms, preserving actual computed consumption rather than equating consumption to the supply ceiling. This is a software scale check, not an ordinary-laptop rendering performance claim.


`tests/twin-network.test.ts` adds eight meaningful cases: the default profile; shared edge/port summation; whole-domain shared-core and platform-link bottlenecks; optional external/local job boundaries; zero energized demand; unsupported multipath and exact failed-switch restoration/replay; coupled idle-power/thermal conservation with peak electrical independence; and inventory-dependent standby/storage cost scaling. The failed-switch test caught and corrected an operational ID parser that previously confused `/rack-network` with a numeric compute-rack ID. Tests use computed graph loads, not arbitrary accelerator derating percentages.

`conservationResiduals(design,state)` exposes signed aggregate W and normalized residuals for reports. The electrical denominator is `max(1 W, sum(gridW + batteryDischargeW / eta_discharge))`, representing total input power including stored-energy depletion. The thermal denominator is `max(1 W, sum(facilityW))`, all declared IT and auxiliary heat sources. These aggregate reporting normalizations are explicit and differ from conservative per-module runtime denominators; aggregate cancellation does not replace per-module checks. Zero-input cases stay finite. Numerical tolerance remains 1e-9 normalized; none of these residuals measures physical model uncertainty.

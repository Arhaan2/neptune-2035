# NEPTUNE reference design v2

**Design-stage digital twin · Simulated operation.** Intended uses: inspect a dimensioned hypothetical facility, trace connected assets, screen declared capacity constraints, compare deterministic disturbances and exercise observation ingestion. Not a procurement design, marine certification or commissioned operational twin.

## Coherent illustrative envelope

The default shore-connected pilot requests 10,000 accelerators. Eight per generic compute node gives 1,250 whole nodes; four 10U nodes per 48U rack gives 313 racks; two rows of twenty rack positions per module give eight modules on two platforms. Installed whole-server IT peak is 15 MW. The actual operating facility load is solved bottom-up, not set equal to the 30 MW external supply ceiling.

`generic-hardware-v2` is an assumed liquid-cooled whole-server envelope: 12 kW maximum, 120 kg, eight accelerators, 10U, 90% heat captured by technical coolant. It is not the air-cooled DGX B200 in the legacy model and carries no manufacturer compatibility claim. The reference makes no throughput, training-time or future hardware forecast.

Rack envelope: 0.6 × 2.2 × 1.2 m; empty rack mass 150 kg; 48U available and exact partial occupancy. Module: 24 × 4 × 10 m (width × height × depth), with a 20 m rack bay, dedicated support bay, central aisle and exterior circulation. Placement comes from the inventory; exact server/rack IDs are resolved lazily for large facilities. At distance all platforms/modules are drawn at their actual size; only selected-module details are materialized for rendering. No 25-platform cap.

Platform deck: 58 × 28 m, 0.8 m thick, assumed 200 t. Two rectangular pontoons: each 58 × 6 × 5 m, assumed 180 t each. Modules add a declared 50 t enclosure/structural allowance each; support assets, racks, servers, pipe water and batteries add their own masses. Static geometry floats at mean ocean y=0 using supported mass and the actual two-pontoon waterplane. Four fixed-point geometry updates account for the weak intake-lift/water-mass feedback. Unknown shore-side masses are outside the floating mass boundary, visibly unknown. Major unknown floating masses make marine screens unassessed.

These dimensions and equipment allowances are assumptions. Geometric checks catch modeled bounding overlap/envelope violations; they are not building/fire-code compliance or maintenance certification. The reference central walking corridor is explicitly bounded in the interior navigator.

## Connected systems

Containment is independent of typed power, technical-coolant, seawater, cluster and external-network edges. Ports specify medium, direction, capacity and units. Graph validation checks identities, endpoints, media, directions and capacity compatibility. Parallel closed-loop templates are supported; arbitrary hydraulic graph solving is not.

Power: shared shore grid → transformer/distribution → module integrated UPS → distribution → racks and critical cooling/control loads. All modeled module loads are UPS-backed. The `/battery` asset is the integrated UPS, so its own failure interrupts the serial bus. Feeder failures preserve finite battery support. Battery energy, terminal power, reserve and efficiencies remain distinct.

Technical coolant flows through a duty/optional-standby pump manifold, CDU/rack heat-load equivalent and HX return. Seawater stays a separate intake/pump/HX/outlet circuit. Rack ports and wet branch masses are explicit; individual branch balancing is represented by a declared equivalent circuit, not a full rack hydraulic network. Pump and exchanger curves/UA, roughness, fittings and equipment pressure coefficients are assumed. See MODELS.md for equations and validity.

Networking has separate shared `shore/cluster-core` and `shore/fiber` dependencies, per-platform switches and module/rack connections. Workloads explicitly require cluster and/or external reachability. Loss of external access does not halt a local self-contained job. The versioned assumed job profile offers 100 Mbit/s cluster and 1 Mbit/s external demand per energized node when that network class is required. Actual graph edges and shared ports accumulate demand; an overloaded required path blocks its whole affected platform job domain while energized nodes retain idle draw. The default 1,250 nodes offer 125 Gbit/s to the 400 Gbit/s shared cluster core and fit; large presets can expose a real modeled core shortage. Link capacity is not a throughput prediction. Application-specific traffic validation and packet behavior remain unassessed.

## Design families

Dates are scenario labels, not technology predictions. All families use the same hardware proxy to isolate architecture.

| Family | Physical arrangement | Distribution / fault implication |
| --- | --- | --- |
| I | Shore-serviced linear pilot | Central transformer/bus; its loss reaches every module |
| II | Modular platform grid | Per-platform transformer and switchboard; local feeder failure isolated to its platform |
| III | Spaced groups in an archipelago | Explicit per-platform segment feeders and open capacity-limited tie reservations; shared shore grid and cluster-core remain visible |

III tie closure and a meshed load allocation are unsupported. Open ties are not redundancy credit. The operating radial behavior of II and III can coincide for a given fault; topology differences do not imply universal reliability improvement.

Starting inputs include 10,000 / 100,000 / 500,000 accelerators. The million-accelerator / 10 GW ceiling case is a bounded software scale test: 125,000 nodes, 782 modules, 196 platforms, 1.5 GW whole-server installed peak. A supply ceiling is not consumption.

## Identity, time and evidence

`schemaVersion: 2`; design revision is a deterministic hash of canonical validated configuration. IDs such as `platform-001/module-01/rack-01/node-01` survive selection, camera movement, rendering aggregation and presentation transforms. Assumptions and solver versions travel with project/result exports. The source registry is `src/twin/catalog/reference.ts`; separate evidence labels are sourced, assumed, derived, generated and measured.

Design edits explicitly reset the solver clock, thermal state and stored energy. Operational commands are validated timestamped events. React/view changes never rewrite canonical dimensions, hydraulic lengths, mass or numerical time. Worker requests carry protocol version, request IDs and epochs. A stale response cannot overwrite a newer revision.

Commissioning requires an identified physical counterpart, asset mapping, sensor calibration, valid time synchronization, compatible measurements, intended-use validation and operational acceptance. None is inferred from generated data or a connected sample publisher.

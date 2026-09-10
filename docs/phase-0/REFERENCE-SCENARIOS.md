# Phase 0 reference scenarios

Source baseline: `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f`. Full deterministic configurations are in [scenarios.json](../../tests/fixtures/phase-0/scenarios.json); actual inventory, initial energized counts, final summaries, network assessments and timings are in [PH0-003.json](evidence/clean-final/diagnostics/PH0-003.json).

```sh
node scripts/phase-0/audit.mjs PH0-003
```

This executes every reference below with the real builder, `initialize`, `advance` and network evaluator. The normal repository fixture style (JSON consumed by a Node/Vite numerical harness) is retained. No new runtime or dependency is introduced. Existing `reference/benchmarks.json` and public experiment/sample fixtures remain unchanged.

| Reference ID | Requested → provisioned accelerators | Nodes / modules / platforms | Supply | Cluster demand | Simulated duration | Expected network constraint | Observed elapsed ms |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| small-module | 1,280 → 1,280 | 160 / 1 / 1 | 30 MW | 16 Gbit/s | 5 s | Satisfied | 6.2 |
| default-pilot | 10,000 → 10,000 | 1,250 / 8 / 2 | 30 MW | 125 Gbit/s | 5 s | Satisfied | 40.8 |
| network-below | 31,992 → 31,992 | 3,999 / 25 / 7 | 100 MW | 399.9 Gbit/s | 1 s | Satisfied | 124.2 |
| network-at | 32,000 → 32,000 | 4,000 / 25 / 7 | 100 MW | 400 Gbit/s | 1 s | Satisfied | 110.2 |
| network-above | 32,008 → 32,008 | 4,001 / 26 / 7 | 100 MW | 400.1 Gbit/s | 1 s | **Violated**, deliberately inadequate | 126.7 |
| rounding-above | 32,001 → 32,008 | 4,001 / 26 / 7 | 100 MW | 400.1 Gbit/s | 1 s | **Violated**, deliberately inadequate | 111.2 |
| campus-100000 | 100,000 → 100,000 | 12,500 / 79 / 20 | 300 MW | 1,250 Gbit/s | 5 s | **Violated**, actual campus preset | 370.4 |
| archipelago-500000 | 500,000 → 500,000 | 62,500 / 391 / 98 | 1.2 GW | 6,250 Gbit/s | 1 s | **Violated**, actual archipelago preset | 2,060.8 |
| bounded-million | 1,000,000 → 1,000,000 | 125,000 / 782 / 196 | 10 GW | 12,500 Gbit/s | 1 s | **Violated**, actual bounded-scale preset | 4,391.7 |

All cases use generation 1, matching the application's initial default family. The preset selector changes requested count and supply only; selecting a preset from another family would preserve that family's configuration. The `default-pilot` fixture is asserted deeply equal to the actual `DEFAULT_CONFIG`, rather than approximated as “10k.” The 100,000/500,000/1,000,000 supply settings reproduce the UI's actual preset behavior from that default.

All initial states come from `initialize`: 303.15 K coolant, 298.15 K air, full configured storage and no failure events. Initialization performs algebraic dispatch at t=0; the test verifies every assumed node is actually energized. The timestep is 1 s and the disturbance list is empty. These are **thermally cold-start** runs, not settled or equilibrium results. Small/pilot/below/at cases are healthy **network references**; that label makes no global design-adequacy or marine-readiness claim. Above-boundary and campus cases intentionally preserve the design's inadequate shared capacity.

Common declared inputs: seawater 291.15 K; workload 0.8; idle fraction 0.3; one standby pump; pump speed 1; exchanger UA 350,000 W/K; zero fouling resistance; battery energy 400,000 Wh/module and maximum power 2,200,000 W/module; required cluster network, optional external network; no budget. Model/schema values are TWIN_SCHEMA 2, solver `2.0.0-rc.1`, asset revision `2.0.0`, network profile `illustrative-job-traffic-v1` revision `1.0.0`. Each generated design revision is retained in the observation record.

Expected arithmetic is literal in the fixtures, independently checked: 8 accelerators/node, 4 nodes/rack, 40 racks/module, 4 modules/platform; node count rounds up and final modules contain only actual remainder nodes. At 100 Mbit/s/node and 400 Gbit/s shared capacity, 4,000 nodes is the inclusive boundary. Optional external demand is zero. Overloaded domains have zero workload-accessible accelerators while energized nodes retain idle consumption. Demand and graph bottlenecks are checked at both time 0 and the terminal time; the audit never lowers traffic or increases the installed port capacity.

Timing is one observed execution per fixture on Apple M4 Pro / Darwin 25.6.0 / arm64 / Node v24.18.0 in the final clean source run. It covers design construction, initialization, advance, inventory and network checks up to record creation. It excludes process startup and file output; it is not browser frame time or just a solver benchmark. Timings are separate from simulated seconds, have no performance threshold, and do not establish a long-duration operating envelope. Equilibrium, long-run memory behavior and physical-machine performance remain unmeasured here.

## Focused disturbance and boundary fixtures

| Finding | Configuration / experiment | Exact command | Expected evidence |
| --- | --- | --- | --- |
| PH0-001 | Finite single-pump input versus direct in-memory infinite optional ratings | `node scripts/phase-0/audit.mjs PH0-001` | Invalid shutoff accepted; free-flow input fails downstream; explicit rejection desired assertions fail |
| PH0-002 | Valid 8-accelerator, workload-0 design; 999/1000/1001 applied events; 86399/86400/86401 s elapsed and scheduled bounds; 10000/10001 engine events | `node scripts/phase-0/audit.mjs PH0-002` | Below/at controls import, legitimate above-import-limit exports fail for the exact recorded reason |
| PH0-004 | Default 1280 module; inspector pump ratings and equivalent direct solver call; hypothetical half-shutoff input | `node scripts/phase-0/audit.mjs PH0-004` | Current flows agree; structural omission and counterfactual sensitivity, no shipping mismatch claim |
| PH0-005 | 1280 module, battery energy 0; feeder trip 5 s, restore 10 s, end 15 s, dt=1 s; unfaulted control | `node scripts/phase-0/audit.mjs PH0-005` | 5 s service outage and recovered terminal acceptance; retained event/log evidence |
| PH0-006 | Generation II and III, each 5128 accelerators, battery energy 0, 30 MW; first-platform feeder trip 5 s, restore 10 s, end 15 s, dt=1 s | `node scripts/phase-0/audit.mjs PH0-006` | Both lose 5120 accelerators in this case; one normally-open Gen III tie, no supported transfer command |

The focused inputs and full traces are generated by the minimal test-only runner and retained under each finding's JSON record. No shipping component data, limits or schemas are changed.

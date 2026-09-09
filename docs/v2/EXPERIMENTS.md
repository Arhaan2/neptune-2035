# Reproducible operation experiments

All supplied records are generated from the versioned solver, not physical measurements. Download a project from the preview's `experiments/` directory or use the repository's `public/experiments/` files. Import it using the app footer. The project replays to its saved time; **Replay to → Seek time** reconstructs any bounded integer-second point with the same recorded events. Seeking backward retains future recorded events.

`npm run evidence:twin` regenerates eleven experiment pairs, the pilot report/inventory and local numerical timings. `python3 reference/benchmarks.py` independently regenerates five numerical benchmark fixtures without importing the application. The local Vite module loader may need loopback binding permission in a restricted sandbox.

## Signature: one exact module pump

`module-pump-0-standby.json` and `module-pump-1-standby.json` use 1,280 accelerators in one module. At 0s workload becomes full; `platform-001/module-01/pump-duty` trips at 30s and is restored at 180s. The matching `-trace.json` records actual flow, temperatures, component states and causal events; `-results.csv` records the 240s endpoint.

| Time | No standby | One standby |
| ---: | --- | --- |
| 30s | Duty failed; 0 L/s | Duty failed; standby starting; 0 L/s |
| 40s | 0 L/s; 30.666°C coolant | 59.688 L/s; 30.511°C coolant |
| 180s | Duty starting; 40.746°C | Duty starting, standby running; 30.029°C |
| 240s | Duty running; 37.601°C | Duty running, standby returned to standby; 29.921°C |

Both retain 1,280 available accelerators in this particular 150-second outage because bulk temperatures remain below the assumed throttle threshold. The calculated temperature difference is evidence of the modeled redundancy effect; curtailment is not forced for drama. Longer no-standby failures and hysteresis are covered by focused numerical tests.

In Operate, select the exact pump, inspect its power/fluid paths, choose Cooling close-up, trip it and advance. Restore and replay. Compare runs the same event sequence for both standby choices. The cinematic uses the same state and cameras, with a generation-comparison stage built from separate clearly labeled feeder-fault solver runs; manual navigation cancels scripted cameras.

## Feeder loss, finite UPS and design families

`family-{1,2,3}-feeder-recovery.json` use identical 10,000-accelerator full-load demand. Each family's first distribution feeder trips at 30s and returns at 1,200s; the saved endpoint is 1,260s. These experiments identify the equivalent functional disturbance in each family's actual topology, not the same nonexistent asset ID in every design.

| Result | I centralized | II per-platform | III open segmented ties |
| --- | ---: | ---: | ---: |
| Grid import at 240s | 0 MW | 7.887 MW | 7.887 MW |
| Stored energy at 240s | 2,257.218 kWh | 2,717.556 kWh | 2,717.556 kWh |
| Workload available at 1,140s | 0 | 4,880 | 4,880 |
| Workload available at 1,260s | 10,000 | 10,000 | 10,000 |

I drains every module's UPS; II/III isolate the affected platform and preserve the second platform. III's open ties provide no additional continuity credit, so this radial outage result correctly matches II. After return, batteries recharge at finite power; none instantly refills.

## Other supplied disturbances

| Project stem | Recorded change |
| --- | --- |
| `workload-ramp` | 20%, 50%, 100% load at 0/30/60s |
| `warm-seawater` | Full load; 303.15 K seawater at 30s |
| `exchanger-fouling` | Full load; additional 0.00001 K/W exchanger resistance at 30s |
| `module-maintenance` | Exact module maintenance at 30s, return at 180s |
| `cluster-link-loss` | Required platform cluster link fails at 30s, restored at 180s |
| `required-external-loss` | Explicitly external-dependent workload; shared fiber fails and returns |

Observation dropout belongs to the Data workspace: select a generated source and set seeded dropout, then advance the actual simulator. Its test publisher deliberately creates gaps/reconnects. DATA.md specifies raw import mapping, samples, historical replay and bounded calibration; observation faults do not fabricate a physical equipment failure.

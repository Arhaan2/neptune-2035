# Phase 2 compatibility and propagation fixtures

`manifest.json` pins the capture source to deployed Phase 1 main `06899f0668a05c6ba7f0a1bc0c96d33304eef580` and records SHA-256 hashes. `phase0-schema2-project.json` is an exact copy of the real repository fixture `docs/phase-0/evidence/clean-final/diagnostics/PH0-002-minimal-project.json`, including its 1001-event history. `phase1-schema3-checkpoint.json` was exported by that frozen source's engine at 4s, after grid trip at 1s and duty-pump trip at 2s. It includes battery depletion, pending standby startup, event position and thermal state. It was captured before any Phase 2 code existed. Reproduction uses DEFAULT_CONFIG with 8 requested accelerators and those two events; advance 4s, projectFile, serializeProject.

`phase1-baseline-values.json` captures the 8 and 10000 accelerator default design at 0s and 10s for regression equivalence only. These historical captures are not independent proof of model physics. The analytic pump test derives the quadratic operating point without importing the production resolver, and Phase 2 electrical tests use explicitly calculated fixture expectations.

| Requirement | Focused evidence |
| --- | --- |
| Default equivalence | phase2-equivalence; frozen summaries, dimensions/mass and included cost |
| Efficiency-only | Independent pump equation plus installed main/worker operating point and unchanged envelope/mass |
| Physical replacement | Resolved asset, actual solver, rendered envelope, inventory and engineering report |
| Compute/conversion | Explicit node-load and inverse-efficiency calculations through real engine |
| Battery consistency | Declared alternative capacity/rating/envelope/mass/cost and outage behavior |
| Cost-only change | Exact checkpoint state, engineering fingerprint and continuation unchanged |
| Identity/fingerprints | Stable slots; deterministic serialization; physics changes versus camera/economic exclusions |
| Persistence | Real schema2 and schema3 inputs, installed version roundtrip, hardware binding rejection |
| Mapping | Old checkpoint/event/telemetry identity cannot silently attach to replacement |
| Validation | Invalid reference/unit/rating import and worker admission; valid shortfall remains runnable |
| Prototype workflows | Chromium/Firefox/WebKit real-worker replacement, camera, simulation, campus, export/recovery, mobile and fallback |

Strict performance targets, exhaustive stability/stress campaigns, full Phase 1 acceptance and physical validation remain deferred. A finite state-based functional timeout is not a performance claim.

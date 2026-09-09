# Phase 1 persistence and replay contract

This contract describes software preservation and numerical reproducibility, not validated physics. The design remains schema 2. Project and numerical-state schemas are 3; solver `2.1.0`, model `neptune-reference-2`, algorithm `committed-boundary-1`. Package/preview release version remains separate.

Admission and work-count maxima below are inclusive; the wall-clock deadline stops new work at or above its threshold. Limits are authoritative in `src/twin/persistence/limits.ts`.

| Boundary | Value and rationale |
| --- | --- |
| Total elapsed time / event timestamp | 2,592,000 integer seconds (30 days), retaining the verified engine horizon |
| Authoritative events | 10,000 unique IDs; no truncation, retaining the engine envelope |
| Single direct advance / worker advance request | 86,400 integer seconds; replay/resume jobs may target the total horizon |
| Integration steps | 1, 0.5, 0.25, 0.125 s; positive binary fractions, fixed for continuation; public checkpoints at integer seconds |
| Serialized project | 67,108,864 UTF-8 bytes (64 MiB), including the complete design, checkpoint and history; byte limits apply before parsing and before export/commit |
| Structure | Maximum container nesting 24; 4,000,000 values plus object keys; bounded preflight before JSON.parse, then exact structural validation |
| Generic strings | 4,096 UTF-16 code units per key/string; actual file size is independently measured in UTF-8 bytes |
| Module inventory | 1–6,250 modules, retaining the previous numerical entry guard; current canonical configuration up to 1,000,000 accelerators produces 782 modules |
| Design graph | At most 50,005 root assets and 50,004 connections; sufficient for the prior module guard using the existing representation |
| Event identity / asset reference | 1–100 ASCII alphanumeric/`_.:-` characters / at most 180 UTF-16 code units, retaining existing command rules |
| Causal trace / module warnings | At most 1,000 entries; only causal presentation trace is rolling. Authoritative events and numerical checkpoint fields are never truncated |
| Pending startup | At most 8 s beyond checkpoint time; deadline up to horizon + 8 s; actual integration-grid deadlines persist |
| Worker chunk | At most 10 integer seconds and 8,000 module-step/event-dispatch work units; oversized atomic event boundaries return resource-limit |
| Job execution budget | At most 2,000,000 module work units; a new chunk/validation batch starts only before elapsed 120,000 ms. An already-started bounded chunk may finish after this soft wall deadline. Exhaustion is separate from project validity |
| Event validation batches | 128 records between worker yields; first progress checkpoint then at most one progress post per 250 ms, plus terminal/cancel responses |
| Saved scenario shelf | 8 projects; the collection also shares the 64 MiB/structural preflight and each project must satisfy the same contract; browser quota can be lower than valid file capacity |

Fixed shape constraints also bound three-coordinate vectors, at most 16 typed ports per root asset, 64 route points per connection, and 32 provenance source identifiers. Identity/version strings are at most 100 code units and port units at most 60. These prevent arbitrary allocations; they do not change equipment capacities or introduce new equipment.

The 64 MiB file allowance and structural bounds provide space for the existing largest canonical design, full mutable state and all 10,000 events. Acceptance records actual measured sizes; the file allowance does not promise that browser storage has that quota or that every size-duration combination executes economically. A valid scenario may be inspected and exported without replay. Parsing rejects duplicate keys, prototype/accessor/non-JSON values, excessive nesting/allocation, and finite-looking JSON overflow such as `1e309` before state replacement.

## Authoritative inventory and boundary

Every mutable `SimulationState` field persists: time, integration step and integer step index; all module temperatures, stored battery energy, throttle hysteresis, equipment states and startup deadlines; physical outputs, warnings and current power/network availability; complete events, applied-event IDs and faults; workload, seawater temperature, fouling and pump speed; facility/IT/grid cumulative energy; and the bounded causal trace. `solverMs` is presentation timing and normalizes to zero. There is no random generator.

The complete existing `Design` snapshot accompanies its existing configuration. This preserves supported graph/capacity edits without introducing an equipment catalog. Standalone state carries `designIdentity` and the checkpoint's `configIdentity` fingerprints that entire snapshot; the project also checks configuration, solver, clock, event history, asset dimensions/references and event cursor coherence. The stable two-word fingerprint detects accidental mismatch; it is not authentication. It does not assert that externally edited data is an authentic measurement.

Hydraulic memoization, compiled graph maps and power ancestry are reconstructed deterministically from the saved design. Every admitted event receives a contiguous integer admission sequence. Order is `(timeS, sequence)` using numeric comparison, independent of locale. Events at the same timestamp are individually applied and followed by controller/dispatch resolution. Incremental interactive admission and batch replay therefore use the same ordering and boundaries. Old IDs cannot be reused for conflicting events.

A checkpoint is captured **after due events, controller resolution, and completion of a fixed integration step**. Its cursor equals exactly the due-event prefix. The next interval integrates without repeating the boundary's controller transition, then resolves the next boundary. A zero-duration call with no events refreshes derived outputs without running another controller transition. Chunk size, progress cadence, UI speed and wall time add no partial steps. Integration-step changes are permitted only on a pristine initial state; continuation retains the saved step.

Candidate state is detached from its input and validated before publication. Invalid input, unsupported model capability, valid-but-inadequate solved designs and numerical failure remain distinct. Numerical safeguard failure never publishes a corrupt candidate; worker interruption retains the last completed validated boundary. A source overload remains a solved shortfall, not a schema error.

## Compatibility, normalization and recovery

`normalize(import(export(P))) == normalize(P)` removes only nondeterministic `solverMs` (and JSON whitespace/property presentation, which are not data). It preserves every authoritative event, numerical field, existing cumulative metric, source identifier, assumption and parent identity. Schema 2 legacy projects retain original identities and admit the full verified horizon/history; they are scenario-only because they lack continuation state. Unknown structural schemas reject transactionally. Structurally valid schema 3 data with unavailable solver/model/algorithm stays inspectable and exportable, with exact continuation disabled.

Explicit **Recalculate with current model** creates a separate scenario using saved initial configuration/graph and events, never the incompatible dynamic checkpoint. Its provenance records the original project identity/schema/solver/model/algorithm and the current identities. The original remains available for export. Archived Git source alone does not supply executable numerical compatibility.

Worker protocol version 2 retains request and generation IDs. `replay` without state initializes the scenario on its explicitly supplied integration grid (default 1 s); UI seek and saved comparisons preserve the saved grid; `replay` with a validated state resumes that checkpoint for the requested remaining duration. `restore` installs an exact compatible state without stepping. Each replacement cancels the older generation. Progress/cancel responses contain complete validated state; stale responses cannot replace a newer run. Conflicting edits/imports cancel and replace safely. Resource exhaustion preserves completed progress and the original inspectable scenario.

Browser recovery uses a single atomic `localStorage.setItem` at `neptune-checkpoint-v3`. The UI acknowledges only successful writes and reports their simulation time. On failure, the last successful durable checkpoint remains, current state can still be exported manually, and the failure is visible. Refresh offers explicit recovery and discloses that progress since the durable time may be lost. Worker crashes retain the latest UI-acknowledged complete state and create a fresh worker for continuation; no promise is made about in-flight work.

The default project is simulated design-stage data. Existing measured/generated observation streams remain separate from numerical checkpoints, with their own evidence labels; default project export contains no connection credentials or raw observation payloads.

## Predetermined equivalence tolerances

Use `abs(actual − expected) <= absTol + relTol × max(abs(actual), abs(expected))`. These values are fixed before acceptance measurements. Current chunk/restore comparisons additionally require exact equality after normalizing solver timing; the table is the allowed per-quantity numerical ceiling, not a reason to relax discrete equality.

| Quantity | Absolute tolerance | Relative tolerance |
| --- | ---: | ---: |
| Temperatures / outlets (K) | 1e-9 | 1e-12 |
| Stored and cumulative energy (Wh) | 1e-8 | 1e-12 |
| Flow (m³/s) | 1e-12 | 1e-12 |
| Pressure (Pa), power/heat/residuals (W) | 1e-6 | 1e-12 |
| IDs, versions, flags, controller states, fault sets, events/cursors, integer counters and step position | exact | exact |

Different integration steps are numerical convergence experiments, not exact replay of the same algorithm settings. Existing timestep-convergence tests remain separate.

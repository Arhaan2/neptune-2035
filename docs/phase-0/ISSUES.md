# Phase 0 issue register

All file/symbol references below are pinned to source **`23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f`**. They can be inspected with `git show 23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f:<path>`. Diagnostic code is `scripts/phase-0/audit.mjs`, identified separately by its recorded hash. The original ordinary tests are retained as supporting evidence, not substituted for these focused reproductions.

| ID | Classification and disposition | Focused evidence | Follow-on |
| --- | --- | --- | --- |
| PH0-001 | Correctness defect — **REPRODUCED** | In-memory nonfinite optional ratings, finite control, explicit rejection regressions | Phase 1 numerical safety |
| PH0-002 | Correctness defect — **REPRODUCED** | Engine-created/exported/imported event and elapsed-time boundaries | Phase 1 persistence contract |
| PH0-003 | Intentional constraint / preset adequacy gap — **DOCUMENTED LIMITATION**, overload reproduced | Independent 3999/4000/4001-node boundaries and actual presets | Later networking phase; number not supplied |
| PH0-004 | Assumption/ownership risk — **DOCUMENTED LIMITATION**, structural evidence | Inspector ratings versus omitted engine arguments / solver defaults | Later equipment ownership phase; number not supplied |
| PH0-005 | Capability/evaluation gap — **REPRODUCED**, scoped to final acceptance | Genuine earlier outage, recovered final service and passing sizing result | Phase 4 whole-run evaluation (named in request) |
| PH0-006 | Capability gap — **DOCUMENTED LIMITATION** | Matched Gen II/III feeder-loss experiment, open ties and radial readiness | Later architecture operating-policy phase; number not supplied |

## PH0-001 — nonfinite optional hydraulic rating

Source: `src/twin/solvers/hydraulic.ts:33`, `solveHydraulics`; optional `HydraulicInput.shutoffPa`, `freeFlowM3S`, `efficiency`. Required fields have finite validation, but line 41's optional rating check only tests positive shutoff/free flow and `0 < efficiency <= 1`.

```sh
node scripts/phase-0/audit.mjs PH0-001
node scripts/phase-0/audit.mjs PH0-001 --desired
```

The exact finite input is in [PH0-001.json](evidence/clean-final/diagnostics/PH0-001.json). One running pump, speed 1, 58 m length, 0.18 m diameter, 0.000045 m roughness, density 997 kg/m³, viscosity 0.000855 Pa·s, fittings K=12, equipment drop 80,000 Pa at 0.05 m³/s, shutoff 250,000 Pa, free flow 0.1 m³/s and efficiency 0.72 produces finite values and a head residual below 0.01 Pa.

Only `shutoffPa` is changed to **in-memory `Infinity`**. The solver returns approximately 0.1 m³/s, 450,242.56 Pa and an infinite head residual: it accepts the rating and returns a nonfinite numerical result. Changing `freeFlowM3S` to infinity instead reaches the downstream `Reynolds number must be finite and non-negative` error. That is captured as a numerical failure, **not** a valid pump-rating rejection or an unrelated successful reproduction. Infinite efficiency already produces `Invalid pump rating` and is a passing control.

Desired regression assertions require explicit invalid-rating rejection for both nonfinite shutoff and free flow. Both fail semantically on the baseline; the diagnostic mode records those exact failures, while `--desired` exits 1. No JSON conversion is used to create invalid input. JSON evidence represents nonfinite outputs as labeled strings. Phase 1 must establish a finite optional-rating contract before solving; no validation fix is included here.

## PH0-002 — engine/export/import bounds disagree

Source: `src/twin/engine/simulation.ts:8` (`MAX_EVENTS`, `MAX_LOG`, `MAX_DURATION_S`), `validateEvent` at 36, `mergeEvents` at 51, `advanceWithStep` at 251; `src/twin/analysis/reports.ts:86` (`projectFile`) and 87 (`parseProject`).

```sh
node scripts/phase-0/audit.mjs PH0-002
node scripts/phase-0/audit.mjs PH0-002 --desired
```

Use a valid 8-accelerator, one-node design with workload 0. Through `advance`, apply 1,001 unique valid facility workload commands at time 0. Every command is in `appliedEventIds`; the bounded causal log retains its last 1,000 entries. `projectFile` exports all 1,001 events into an 82,560-byte compact JSON project (schema 2, solver `2.0.0-rc.1`). The real importer rejects it with **`Time or event count exceeds replay bounds.`** The 999-event and 1,000-event controls round-trip exactly. [The minimal generated project](evidence/clean-final/diagnostics/PH0-002-minimal-project.json) is pretty-printed evidence, so its saved byte count is larger than the actual compact reproduction string.

The engine supports at most 10,000 unique events (observed acceptance at 10,000 and rejection at 10,001), at most 86,400 s **per advance call**, and an inclusive 30-day total/event horizon (2,592,000 s). A preliminary merge-size guard is `existing + supplied > 20,000`; the final unique-ID guard is `> 10,000`. The importer rejects project clocks or event counts with `timeS > 86400` or `events.length > 1000`; these boundaries are inclusive at the limit. It separately rejects event timestamps `> 86400` with `Invalid event record.` The exporter applies none of those import bounds. Its nominal “2 MB” input check actually measures JavaScript string length (`text.length > 2_000_000`), not encoded bytes; the ASCII cases here are well below it.

The smallest timestamp mismatch is one legitimate scheduled engine event at 86,401 s in an otherwise time-0 project (563 compact bytes); the 86,399/86,400 controls import. A scheduled event at exactly 30 days is engine-supported but rejected by import, and one second beyond that is explicitly rejected by the engine. Independently, actual sequential 1 s engine integration reaches 86,399, 86,400 and 86,401 s; only the last export is rejected, even with **zero events**. No handcrafted invalid state, fake clock, or expensive campus simulation is used. All inputs, counts, rejection messages, timings and four desired failures are in [PH0-002.json](evidence/clean-final/diagnostics/PH0-002.json).

Phase 1 should choose and enforce a coherent persistence contract with explicit rejection/migration behavior. Retain replay fidelity and tests around both boundaries. Raising arbitrary limits, chunked replay and later persistence architecture are outside this task.

## PH0-003 — shared network undersized for campus presets

Source: `src/twin/assets/design.ts:28` (`asset` port capacities), `buildDesign` at 39 / `shore/cluster-core` at 45, `moduleAssets` at 95; `src/twin/catalog/reference.ts:HARDWARE`; `src/twin/solvers/network.ts:5` (`NETWORK_ASSUMPTIONS`), `createNetworkEvaluator` at 71; `src/ui/TwinApp.tsx:558` preset selector. Supporting existing test: `tests/twin-network.test.ts`, shared-core bottleneck case.

```sh
node scripts/phase-0/audit.mjs PH0-003
```

The limiting resource is **`port:shore/cluster-core:cluster-out`**, shared by all platform uplinks. Both its asset rating and output port are 400 Gbit/s. Required cluster demand is 100 Mbit/s per **energized node**; catalog and instantiated compute assets have eight accelerators per node. Therefore 400e9 / 100e6 = 4,000 nodes = 32,000 accelerators. It is not 400 Gbit/s of independent capacity per platform.

Fixtures use actual inventory counts: 31,992 / 32,000 / 32,008 accelerators yield 3,999 / 4,000 / 4,001 energized nodes and 399.9 / 400 / 400.1 Gbit/s. A request for 32,001 rounds up to 32,008. Module counts are 25 / 25 / 26, all on seven platforms. The solver's overload tolerance is `max(1 bit/s, capacity * 1e-9)`; a one-node increment exceeds it comfortably. Initialization already performs algebraic electrical dispatch; these cases verify that all the assumed nodes are energized both at time 0 and at the end of the bounded run. They do not infer demand from a requested count while a workload is still unpowered.

The actual 100,000 campus preset from the default Gen I state has 12,500 nodes, 79 modules, 20 platforms, 300 MW supply and 1,250 Gbit/s demand. It reports the shared-port overload and zero workload-accessible accelerators while energized nodes retain idle draw. The 500,000 and 1,000,000 presets also report their shortfalls. No capacity, traffic or test expectation was changed to make an inadequate design appear healthy. Full records are in [PH0-003.json](evidence/clean-final/diagnostics/PH0-003.json); see [reference scenarios](REFERENCE-SCENARIOS.md).

This is verified preset inadequacy under explicitly assumed traffic, not evidence that the network solver silently accepts overload. A later networking phase should decide ownership and sizing policy; no network fix is included.

## PH0-004 — equipment assumption ownership

Source: `src/twin/assets/design.ts:95` (`moduleAssets` and duty-pump inspector ratings), `src/ui/TwinApp.tsx:186` (`resolveAsset` inspector selection), `src/twin/engine/simulation.ts:116` (`circuit`), `src/twin/solvers/hydraulic.ts:40` (optional defaults). `HARDWARE` also duplicates pipe constants; this finding is deliberately focused on one pump rating.

```sh
node scripts/phase-0/audit.mjs PH0-004
```

The duty pump's assumed `shutoffPa` is 250,000 Pa, `freeFlowM3S` 0.1 m³/s, efficiency 0.72. The engine's `circuit` call supplies none of those rating fields and does not read `.ratings`; the solver independently defaults to identical numbers. A focused structural assertion checks this call site. Direct solver input using inspector ratings matches the real initialized module flow, 0.05968751283253368 m³/s. Halving shutoff in a **test-local direct solver input** yields 0.046523297235762574 m³/s.

There is no supported `DesignConfig.shutoffPa` edit, and lazy `resolveAsset` regenerates module ratings. The counterfactual shows that the parameter matters; it does not establish a supported configuration change producing a shipping mismatch. Disposition is an ownership risk, not a wrong numerical result. The exact trace is in [PH0-004.json](evidence/clean-final/diagnostics/PH0-004.json). A later ownership phase should connect authoritative equipment assumptions to consumers; Phase 0 adds no catalog system.

## PH0-005 — recovered terminal state hides service interruption from acceptance

Source: `src/twin/engine/simulation.ts:271` (`summarize`), `src/twin/analysis/reports.ts:60` (`constraints`), 79 (`sizingAssessment`), 103 (`resultsCSV`), 111 (`engineeringReport`), 116 (`compareRedundancy`); UI comparison consumes final states in `src/ui/TwinApp.tsx`.

```sh
node scripts/phase-0/audit.mjs PH0-005
```

A supported 1,280-accelerator single module has battery energy set to zero through normal configuration. Trip its actual Gen I feeder `shore/bus` at t=5 s, restore at t=10 s, finish at t=15 s; use the existing 1 s engine step. An unfaulted control has full service throughout. The observer shows **zero available accelerators throughout [5,10) s**, followed by full recovery. The final summary reports 1,280 available, no curtailment and no warnings; `EL-02` is satisfied and `sizingAssessment.passes` is true. The final report includes the interval label and final results, but no service-interruption duration or minimum service metric. Terminal results CSV also lacks that history.

Events and causal logs **are retained**, and energy PUE is accumulated, so this finding does not claim every reporting path discards history. The comparison API returns final summaries and complete final states/events; structural evidence scopes its missing whole-run assessment. The concrete reproduction is the real engineering report / constraint / sizing path. [PH0-005.json](evidence/clean-final/diagnostics/PH0-005.json) preserves both traces and retained evidence; the [generated report](evidence/clean-final/diagnostics/PH0-005-engineering-report.md) and [terminal CSV](evidence/clean-final/diagnostics/PH0-005-terminal-results.csv) show the actual outputs. The observer is test-only and adds no production metrics framework. Phase 4 should assess whole-run service continuity without losing retained raw event evidence.

## PH0-006 — bounded Gen III operating distinction

Source: `src/twin/assets/design.ts:39` (`buildDesign`: Gen II switchboards, Gen III segment feeders and disabled 2.2 MW ties at line 66), `src/twin/engine/simulation.ts:12` (`context`, one enabled upstream radial parent), `validateEvent`, and `docs/v2/READINESS.md:25`.

```sh
node scripts/phase-0/audit.mjs PH0-006
```

At the same declared 5,128 accelerators, workload 0.8, 30 MW supply, no stored battery energy and default coolant assumptions, both architectures instantiate five modules on two platforms. Trip the first platform's actual `powerDomainId` at 5 s, restore at 10 s, finish at 15 s. Gen II affects `platform-001/switchboard`; Gen III affects `platform-001/segment-feeder`. Four first-platform modules (5,120 accelerators) lose service in each, leaving eight accelerators on the second platform. Both recover to 5,128 by the end.

Gen III includes one disabled first-to-second-platform 2.2 MW tie; Gen II includes none. Actual asset IDs, failure domains, routed power edges, geometry-related path differences and all timestep summaries are in [PH0-006.json](evidence/clean-final/diagnostics/PH0-006.json). Gen III's second-platform offset changes routing/hydraulics, so strict numerical equivalence is not asserted. Both designs retain the common `shore/grid` source. The event boundary rejects a `close-tie` command; a test-local copy with the tie enabled produces an unsupported radial-topology warning, consistent with existing readiness documentation.

This demonstrates no automatic transfer benefit in this supported case. It does not assert identical outputs for all cases, future impossibility, meshed support or independent supply through an open tie. No assets, transfers or architecture policies were added.

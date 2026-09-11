# CI admission performance repair — PH3-CI-01

CI run `34550958284` tested the source tree of candidate `1a418cc4d38a23674a73dc7b92055d72258748c8`. It passed 362 of 364 tests, including both real telemetry integrations, and failed two tests at their unchanged five-second limit: the existing million-accelerator integration case took 7,309 ms and the new million-accelerator network case took 7,367 ms. These were duration failures; no capacity or physical-state assertion failed. The release remained blocked.

Fixing profiled the exact candidate in the isolated `/private/tmp/neptune-phase3-fixing` worktree. A temporary diagnostic test used Node's CPU profiler and measured individual build/evaluation stages. Its extended diagnostic budget was separate from acceptance; no committed test timeout changed. The temporary test was removed after profiling, with raw profiles retained only in ignored local `artifacts/phase-3/ci-profile/`.

The regression came from redundant static work. The compiler generated each module's full equipment twice, constructed unused electrical/hydraulic connections, and allocated a complete network resource graph even when compact simulation had no required network class. CPU samples also identified physical design construction as a substantial existing cost. The repair leaves hydrostatic iteration, full inventory, source identities and numerical formulas unchanged.

The narrow production repair:

- Reuses one canonical network inventory while constructing network connections. The optional projection uses the existing asset, port and connection builders, preserving IDs, ratings, geometry, ordering and endpoint assignments.
- Avoids pumps, pipes and other unrelated equipment in network compilation.
- For compact simulation with neither network class required, validates all stored network edges and each actual platform-to-module attachment, then avoids generating unused rack/node resources and routes. Interior ports remain the canonical template from admitted specifications. The ordinary full inspector projection still expands and reports every resource, including with zero offered demand.
- Keeps all validation and compilation local to one evaluator; no global cache or mutation-sensitive reuse was introduced.

The new eight-case `tests/phase3-network-projection.test.ts` verifies exact projected inventory/connection parity for legacy and both new presets, malformed disabled stored endpoints at zero/positive allocation with both classes optional, invalid actual module attachment directions for legacy/new designs, and full-versus-compact optional connectivity results.

| Measured stage (local, ms) | Exact original candidate | Final narrow repair |
| --- | ---: | ---: |
| Legacy million-accelerator build | 960 | 913 |
| Legacy initialize plus summarize | 2,094 | 1,036 |
| Legacy complete case stages | 3,054 | 1,948 |
| Nominal full-installed assessment | 1,344 | 1,077 |
| Nominal first evaluator query (separate evaluator) | 1,487 | 1,014 |
| Identical cached query | 0.19 | 0.20 |

The first intermediate repair still generated dormant leaves and measured 2,310 ms for legacy build plus initialize/summarize; that was insufficient margin against the observed CI/local ratio, so the final repair omitted only unnecessary generated leaves in the optional compact path. The final measured legacy stage sum was about 36% below the original. The observed roughly 2.3× Linux/local ratio suggested about 4.5 seconds, but this estimate is not a CI pass claim.

Testing separately changed the network capacity fixture's setup to activate the nominal network on a small design before resizing once to the target campus; two exact complete-design comparisons preserve confidence in that equivalent supported revision path. This avoids constructing and discarding an entire legacy campus. Every original capacity assertion and the five-second timeout remain intact. Root applied the same ordering to the real starting-scenario UI.

Focused repair validation:

- `npm test -- tests/phase3-network-projection.test.ts tests/phase3-edge-validation.test.ts tests/twin-network.test.ts tests/phase3-network.test.ts`: **4 files, 41 tests passed**.
- `npm run typecheck` and `npm run lint`: passed.
- After integrating Testing's setup repair, `npm test -- tests/twin-integration.test.ts tests/phase3-topology.test.ts -t 'million-accelerator|provisions 1000000'`: **both original timed cases passed**, 36 unrelated cases excluded by this deliberate name filter, 4.50 seconds for the whole bounded invocation. Neither assertion set nor timeout changed.

Full integrated testing, independent exact-diff review and a fresh successful CI run remain root's acceptance gates. This document records the cause and focused repair, not completed release acceptance.

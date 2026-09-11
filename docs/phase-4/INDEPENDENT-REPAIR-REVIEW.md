# Independent repair review: PH4-T01 / PH4-T01b

**PASS for the identified disturbance-footprint repair only.** This is not a Phase 4, metrics-runtime, final-candidate or release approval.

Reviewer `/root/verification` resumed after Fixing's completed repair. All source inspection used immutable `git show` at integrated SHA `46d680043b21d4c03cc314d800910a7651cb038b`, source tree `efed83c6c8099e953ead4c37e536075b80a910aa`; repair diff `41c9281f9700e31b149827445c12b6c115be5ae4`. Production change is limited to `src/twin/experiment/definition.ts` (20 additions, 3 deletions). No production files, tests, main, remotes or deployment were modified by this reviewer. No broad suite was run.

## Independent findings and resolution assessment

| Finding | Requirement / severity | Expected meaning, independently derived | Resolution evidence |
| --- | --- | --- | --- |
| PH4-T01 | 4A/4C actual footprint / P1 | Nine 8-accelerator nodes give 72 installed. One node affects 8; a full four-node rack affects 32; the final one-node rack affects 8. Fractions are 1/9, 4/9 and 1/9. Containing-module context does not change these direct inventory counts. | Repair uses resolved compute `ratings.accelerators` or resolved rack `ratings.nodes * HARDWARE.acceleratorsPerNode`. Canonical asset generation explicitly records the actual partial-rack count, so the final rack cannot be inflated to four nodes. Independent test assertions at the integrated SHA remain 8/32/8 and also check canonical solver availability 64/40/64. PASS. |
| PH4-T01b | 4A/4C shared dependency scope / P1 | Four 160-node modules behind the first platform transformer contain `4*160*8=5120` accelerators. With 5128 installed, the second platform's one node leaves 8 outside that dependency. The transformer is an upstream dependency even though it is not the module's immediate power-domain ID. | Repair traverses enabled single-incoming power edges from each module's power-domain ID, consistent with `simulation.ts` context ancestry. The fixture verifies both existing generation-II switchboard and generation-III segment-feeder layouts and preserves the second platform in both. Disabled transfer links do not widen the ancestry. No physical dispatch algorithm or Phase 5 transfer behavior was added. PASS. |

Testing's durable receipt independently reports all **23 definition tests PASS** on testing merge `4344ef9b2d1c51b2867763263ceda026e4a6e354`, whose tree is exactly the reviewed integrated tree, in 256 ms. The original three failing node/rack assertions are preserved and two generation ancestry regressions added. Fixing separately reports 49/49 focused definition/physical tests, typecheck and diff-check; this review does not relabel those as reviewer-run checks. Static inspection independently confirms the expected arithmetic and topology interpretation instead of relying solely on those reported results.

The scope labels now distinguish direct installed inventory from potential shared dependency footprint and explicitly reserve actual service effects for the canonical solver. That distinction is necessary because redundancy, batteries, optional connectivity and existing failures can make service impact differ from potential installed scope. No unresolved defect was found in the identified repair.

## Slice-1 definition checkpoint

The reviewed definition persists physical design binding, model/solver/algorithm/metrics identities, required demand distinct from utilization, deterministic disturbance order, environment, controller identity, start mode, success and recovery criteria. Required-capacity schedules reject duplicate/unsorted times; events retain integer-second admission and cannot exceed experiment duration. Price-only compatibility is tested against the existing engineering fingerprint, while physical replacement is rejected. The earlier settling-scope concern is now explicitly addressed in the type/default contract: temperature rate, battery rate, continuous dwell, maximum warmup, controller quiescence, service and thermal booleans are persisted. The defaults are 0.001 K/s, 0.01 Wh/s, 30-second dwell and 1200-second maximum; these remain modeled predicate assumptions, not empirical equilibrium tolerances.

This checkpoint approves those definitions as an implementation basis. Runtime enforcement, exact-once accumulation, checkpoint validation, paired initial-state identity, terminal boundary recovery and actual settling success/timeout remain pending later immutable-candidate review. A passing definition validator by itself does not establish those behaviors.

Reviewer may be checkpointed now to free the four-agent slot for the next concrete Fixing task; return for the integrated numerical/persistence and release gates.

# Phase 4 reproduced defects and repairs

# Fixing receipt — PH4-T01 / PH4-T01b

Role: `/root/fixing`. Worktree `/private/tmp/neptune-phase4-fixing-20260911`, branch `codex/neptune-phase4-fixing`. Exclusive production ownership transferred by Building: `src/twin/experiment/definition.ts` only. No test files authored or edited by Fixing; no physical solver, main, remote or deployment changes.

Isolated production commit: `41c9281f9700e31b149827445c12b6c115be5ae4`, parent `cb14c80252a087d245c5d9c51405dda86556b7ca`. Root may cherry-pick this single commit. Parent consists of root `3f67cd3` plus independent Testing commits `04d3c2a`, `5e00c5b`, `0f5a153` cherry-picked under local SHAs `a940bdb`, `4454321`, `cb14c80`.

## Reproduction

On `a940bdb`, `npm exec vitest run tests/phase4-definition.test.ts -- --reporter=verbose` produced 18 PASS / 3 FAIL (224 ms). In the 72-installed-accelerator fixture, canonical node/full-rack/partial-rack trips remove 8/32/8 serviceable accelerators, but footprint falsely reported 72 for each. Original independent assertions unchanged.

Root authorized the adjacent same-function ancestry defect as PH4-T01b after concrete reproduction. In each existing generation II and III configuration, 10,000 installed, workload 0.2, no battery energy: enabled `platform-001/transformer` → `platform-001/switchboard` (II) or `platform-001/segment-feeder` (III) feeds four 160-node modules. Expected installed scope 5,120; canonical serviceable capacity is 10,000 before and 4,880 after the trip. Footprint falsely returned no modules and zero capacity. Exact graph and observations are in `fixing-PH4-T01b-reproduction.json`. Vite SSR emitted a denied unused websocket listen message but loaded and executed both canonical reproductions successfully; no network elevation was requested.

## Repair

Resolved compute rating or actual installed rack node count now determines direct inventory. Containing module IDs remain contextual. Shared power dependency scope follows declared enabled single-incoming power edges, matching engine ancestry and excluding disabled transfer edges. Labels distinguish direct installed inventory from potential shared dependency scope and explicitly reserve actual service effects for the canonical solver.

## Verification performed by Fixing

- Original definition suite after initial direct-asset repair: 21/21 PASS (219 ms).
- After ancestry repair: definition + existing physical suite, 49/49 PASS in 2 files (1.09 s); physical suite contains 28 tests.
- Testing then independently supplied generation II/III regressions (`5e00c5b`, `0f5a153`); final definition suite 23/23 PASS (259 ms). These include a 5,128-installed design with exactly 8 unaffected accelerators on the second platform.
- `npm run typecheck`: PASS.
- `git diff --check`: PASS.
- Worktree clean after production commit.

Root integration and independent Testing/Verification recheck remain required. This receipt is a bounded repair handoff, not a Phase 4 acceptance or release approval.

Independent Testing recheck: root `46d680043b21d4c03cc314d800910a7651cb038b`, tree `efed83c6c8099e953ead4c37e536075b80a910aa`; all 23 definition checks passed, unchanged failed assertions plus both existing-family transformer paths. Final whole-phase acceptance remains pending.

# Fixing receipt — PH4-T02 through PH4-T05

Role `/root/fixing`, isolated worktree `/private/tmp/neptune-phase4-fixing-20260911`, branch `codex/neptune-phase4-fixing`.

Input candidate: root `bace5b03485fb5aef6a00230b6347556161c47fc`, tree `97ae6bdf99956d086f5a0715b54f4c6258fd003f`, merged non-destructively into the fixing worktree as `1654a51484cb928ca1bae23e2a3457e616f1a329`. Local merge preserves prior independently cherry-picked footprint work; its production surfaces match root.

Production-only repair commit: `f72d257b9d99ea2de2d21ee58611c080aaff1452`, parent `1654a51484cb928ca1bae23e2a3457e616f1a329`. Root may cherry-pick this single commit. Files: `src/twin/experiment/metrics.ts`, `src/twin/experiment/runtime.ts`, `src/twin/engine/simulation.ts`. No type, test, worker, physical formula, remote, main or deployment edits.

## Reproduced independent failures

Command `npm exec vitest run tests/phase4-metrics.test.ts tests/phase4-engine.test.ts -- --reporter=verbose` on the unchanged input produced 42 PASS / 4 FAIL (606 ms).

- PH4-T02: terminal first trip at 20 seconds produced an unhealthy terminal boundary but recovery status `no-qualifying-interruption`. Expected `not-recovered`, preserving zero integrated interruption duration and count.
- PH4-T03: the real thermal controller transitions at physical 209 seconds in the 1,280-accelerator pump-speed-zero fixture, but settled start confirmed at exactly 209 before executing that boundary controller. Expected origin null, warmup warming and candidate null.
- PH4-T04: missing air observation with available coolant produced zero unavailable time for a one-second interval. Expected one second unavailable and null healthy boundary.
- PH4-T05: explicit zero recovery dwell at terminal restoration time 5 produced onset 5 but null confirmation. Expected onset and confirmation both 5.

## Repairs

Terminal failed boundary now takes precedence over the no-duration-interruption recovery label without creating an episode or adding elapsed quantities. A zero dwell confirms immediately at the qualifying observed boundary and repeated observations cannot append the confirmed episode again. Thermal completeness requires both coolant and air for each observed asset; missing thermal evidence remains separately unavailable even alongside a known violation.

Warmup interval accumulation retains its rates, physical state and candidate. Confirmation now occurs after the canonical end-boundary controller solve, and actual warmup controller transitions reset the quiescence candidate. Only after successful post-controller settlement are declared evaluation disturbances admitted. Existing cold-run ordering and physical integration remain unchanged, and no warmup physical state or energy is refilled/reset.

## Checks

- Independent unchanged metric/engine tests: 46/46 PASS (647 ms).
- Existing physical and Phase 3 persistence tests: 40/40 PASS in 2 files (1.52 s).
- Typecheck, lint, diff whitespace check: PASS.
- Testing owns any additional boundary/checkpoint regressions and has been asked to extend checks where useful. Root integration and independent recheck remain required.

This receipt reports a bounded repair, not final Phase 4 acceptance or release approval.

Independent Testing recheck: root `4eccabfcc14a4a669fd7294191cb3d9055f33388`, tree `1cb4426b55c51b4f0413d3ea60b2699bdb7b98c0`; 102 Phase4 checks across 6 files passed, zero failures/skips, 1.96 seconds. Counts: baseline1, definition23, metrics32, engine16, worker13, persistence17. The four original failing assertions and strengthened missing/warmup/idempotence cases passed. Raw native result: `testing-slice2-repaired.json`. Independent Verification of this numerical repair is still pending.

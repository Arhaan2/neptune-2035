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

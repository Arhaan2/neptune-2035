# Phase 4 execution and release ledger

Acceptance status: implementation in progress, not merged or deployed. Live production remains the independently byte-verified Phase3 artifact.

## Preserved source and artifact

- Accepted baseline: `91a52eeff5a01fae3ef21cba7a8293b59e5c40fb`, tree `c6ee142e13955a76cdc07bbafe150ae2d6d2b64c`.
- Baseline [PR3](https://github.com/Arhaan2/neptune-2035/pull/3), [successful source CI](https://github.com/Arhaan2/neptune-2035/actions/runs/34553000816), [successful Pages deployment](https://github.com/Arhaan2/neptune-2035/actions/runs/34553704425).
- Pages source is `codex/pages` at root `/`; a main push does not deploy. Baseline artifact `84366132ae9499bdd3f47fd8d2b53864df2cc0a5`; primary rollback must be recaptured immediately before promotion.
- Preview tree `531d00a67da4c1f2f02a22bf249d93e683b2601b`; fresh integrity verification matched all 90 tracked files, using HTTP for public bytes and Git for non-HTTP dotfile markers.
- Unchanged lock SHA-256 `87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9`. Baseline `npm ci --no-audit --no-fund` passed, 520 packages. Local runtime macOS arm64, Node24.18.0/npm11.16.0; existing Chromium1243/Firefox1543/WebKit2359 installations.
- Original checkout remains at `627a29d` on its Phase1 branch. Its unrelated `playwright.config 2.ts` and `.github/workflows/phase-1 2.yml` were hashed and preserved. Root uses a separate clone, with no parent-repository mutations.

Durable ignored evidence: `/Users/arhaan/Documents/ChatGPT/Neptune/artifacts/phase-4-20260911/`. It includes the full request, original status/untracked hashes, complete baseline Git bundle, Phase3 Pages rollback tar, Pages/PR/branch/Actions receipts, all tracked artifact hashes, numerical discovery and review receipts. Disposable worktrees are siblings under `/private/tmp/neptune-phase4-*-20260911`.

## Actual parallel work

The API returned actual canonical agent IDs `/root/building`, `/root/testing`, `/root/verification`. The effective ceiling is four agents including root, not five simultaneous agents. All three workers overlapped for reconnaissance/contract review. Verification completed its initial read-only receipt before the planned Fixing rotation. Distinct agent `/root/fixing` then repaired reproduced PH4-T01/T01b while Building and Testing continued. A live-agent inventory confirmed root + Building + Testing + Fixing concurrently. Verification returned after the isolated repair for independent review.

| Integrated root commit | Origin / role | Result |
| --- | --- | --- |
| `b0e492d` | Root | Verified baseline and shared numerical/ownership contract |
| `05f8db5` | Testing `ed7cf8c` | Existing-API endpoint gap reproduction; independently executed1/1 on91a52ee |
| `024f568` | Testing `8cfdd89` | Frozen synthetic400 accelerator-second arithmetic oracle |
| `61bc952` | Root | Independent contract receipt, baseline gap, mandatory Phase4 browser CI and release metadata |
| `22cb8fd` | Building `4e7097bb` | Versioned definitions/criteria/types; builder and root typecheck passed |
| `d32704c`, `e7b59a5`, `cf55820` | Testing | 23 definition checks; reproduced direct-inventory overstatement and upstream-transformer omission |
| `46d6800` | Fixing `41c9281f` | Isolated footprint repair; Testing independently rechecked exact tree with 23/23 passed |
| `4fb8fca` | Building `49c2890b` | Canonical metrics/checkpoint slice; focused gate42/46 passed, four genuine boundary defects reproduced |
| `878305d` | Fixing `f72d257b` | Post-controller settling, terminal recovery and missing-measurement repair |
| `4eccabf` | Testing + integrated repair | 102/102 focused Phase4 cases passed on an identical root/Testing source tree |
| `64e0988` | Building `b1b1f68` | Bounded paired runner, signed comparisons, reports and reproducible signature definitions |

No main/Pages publication or final acceptance has occurred. Commit identity in this ledger documents the actual integrated slice; it is not a claim that subsequent whole-phase gates passed.

## Defect handling and final gates

Initial Verification recorded eight contract hazards V4-C01–C08, resolved into the contract before runtime implementation. These are review concerns, not fabricated reproduced implementation bugs. Testing reports concrete failures with exact source, expected/observed values and reproduction; root transfers the completed owned surface to Fixing. Building proceeds only on unrelated surfaces until ownership returns. Testing and Verification recheck repairs.

Final local acceptance must run the unchanged lockfile install, typecheck, lint, full unit/integration suite with both real telemetry flags, production build, and prototype/Phase2/Phase3/Phase4 browser journeys on all three engines at an identified frozen candidate. Retain actual counts and raw failures. Only the two historical non-Firefox500000 prototype Step10s exclusions remain; deferred Phase1 stress gates remain deferred.

Then root obtains exact-candidate independent review and CI, rechecks main and the actual merge tree, merges via permitted mechanisms, rebuilds accepted source, compares tested/accepted bytes, preserves preview, publishes the established Pages branch, observes the actual deployment, verifies every tracked public artifact and runs hosted browser gates with identity checks before and after. The production [release marker](https://arhaan2.github.io/neptune-2035/release.json) and [artifact manifest](https://arhaan2.github.io/neptune-2035/build-manifest.json) identify the live release. Failed critical hosted gates require the verified rollback procedure; a successful upload alone is not acceptance.

## Agent-resumption limitation observed during integration

After the second Fixing checkpoint completed, three attempts to resume the existing independent `/root/verification` agent returned `agent thread limit reached`. Both relative and canonical targets were tried. Live-agent inventory showed root/Building/Testing running and Fixing completed. Interrupting the completed Fixing agent did not release the limit; no close-agent capability is exposed. No global settings or spending configuration were changed. This limitation does not invalidate the actual five-role overlap and prior verification receipts, but final independent core/candidate/public verification remains a required unmet gate until resumption succeeds. Implementation and independent Testing continue.

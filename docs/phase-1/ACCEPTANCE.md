# Phase 1 acceptance record

Implementation acceptance: **PASS**. Integration status at this pre-merge evidence commit: **NOT MERGED**. The PR/final report and post-merge machine-readable record must supply the actual tested PR head, pre-merge main, merge/main SHAs, CI links and clean post-merge result; this document does not pre-claim integration.

The complete clean source gate passed at `76cdbcc7c62762c3464b289f97e75bfb6baa6850`, using `node scripts/phase-1/verify.mjs --ref=HEAD --out=docs/phase-1/evidence/committed-final`. A later evidence-only commit has identical runtime/test/config/workflow hashes; normal CI must test that exact final PR head before merge. [Execution and hashes](evidence/committed-final/execution.json), [unit cases](evidence/committed-final/unit-summary.json), [browser cases](evidence/committed-final/browser-summary.json), and [measurements](evidence/committed-final/measurements.json) are the authoritative local run for this source revision.

| Gate | Result | Observed elapsed time |
| --- | --- | --- |
| npm-ci | PASS | 3.41 s |
| typecheck | PASS | 3.08 s |
| lint | PASS | 1.42 s |
| build | PASS | 4.51 s |
| unit-full | PASS | 7.05 s |
| browser | PASS | 361.62 s |
| measurements | PASS | 22.91 s |

All **256/256 unit tests** passed with **NEPTUNE_TELEMETRY_BROWSER=1 and NEPTUNE_TELEMETRY_APP=1**. All **75/75 browser cases** passed: 25 each in Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6. There were zero failures, skipped cases or flaky retries in this accepted run. All 73 protected hashes (72 Phase 0 prerequisite files plus the dependency lock) matched; no source changed during verification. Normal CI invokes the same complete gate, including measurements and evidence upload.

## Historical and intermediate attempts

The original Phase 0 checkpoint `f676c1f9902008a7096e5e8122a5701953b7c772` and all 72 immutable files were verified. The isolated historical fresh full rerun passed installation, typecheck, lint, build, **162/162 unit cases with telemetry and 48/48 browser cases**. PH0-001's invalid pump-rating behavior and PH0-002's actual 1,001-event / 86,401-second preservation failures reproduced as expected semantic failures, independently of setup. Artifact recovery reconstructed all 53 compiled files into a new local directory without replacing either preserved experience. See [historical investigation](evidence/history/investigation.json) and its linked attempt directories.

Failed attempts remain visible: the first historical browser run passed 46/48 with two WebKit interaction timeouts; unchanged targeted and full reruns passed, and an environmental cause is not proven. The first current full run passed 247 then-existing unit cases but failed three browser assertions that still treated 86,401 seconds as invalid; these assertions were corrected to the retained 30-day contract and the complete suite rerun. The first committed attempt stopped at strict lint on an unnecessary test default parameter; its correction is a separate commit. The subsequent full `19b1082` run passed 256/75. The final trace-scope lookup optimization was independently checked against the prior validator in 12 comparative probes and then passed the full clean gate above. No historical evidence was rewritten, no coverage skipped, and no unrelated lockfile change was used to obtain a pass.

## Contract, checkpoint and compatibility acceptance

[CONTRACT.md](CONTRACT.md) owns the exact inclusive limits and predetermined tolerance table; [REQUIREMENT-TEST-MATRIX.md](REQUIREMENT-TEST-MATRIX.md) maps all twelve mandatory IDs to code, tests and evidence. Project/state schema 3 uses solver 2.1.0, model neptune-reference-2 and algorithm committed-boundary-1; design schema 2 and the package release version remain distinct.

The retained project limits are **2,592,000 integer seconds, 10,000 authoritative events and 67,108,864 UTF-8 bytes**. Structure is bounded to depth 24 and 4,000,000 values plus object keys. Direct advances are limited to 86,400 seconds; worker chunks to 10 seconds / 8,000 module work units; jobs to 2,000,000 work units and a 120,000-ms soft wall deadline that stops new chunks. The 128-event validation batch and 250-ms progress cadence allow operational cancellation. Full ancillary inventory/string/shape/shelf limits and below/at/above coverage are documented in the contract and matrix. Controlled-kernel work-budget tests verify actual scheduler limits; real numerical scenarios separately verify physical-state trajectories.

Complete checkpoints retain physical temperatures/storage, battery energy, faults/isolation/equipment/controller states and pending deadlines, integration settings/step position, runtime inputs, cumulative energy, design identity/provenance and all events with an exactly-once cursor. Due same-time events have stable admission sequence. Only solver wall timing normalizes away; continuous, chunked, restored and replayed trajectories compare exactly after normalization, including battery discharge and pending startup before/at/after sensitive event boundaries. Predetermined per-quantity tolerances were not loosened.

Compatible schema-3 restoration resumes original semantics. Legacy schema-2 is explicitly scenario-only; supported structure with unavailable numerical versions stays inspectable/re-exportable. Unknown structural versions reject transactionally. Explicit current-model recalculation produces a separate labeled experiment with original parent/schema/solver/model/algorithm identities. Import/edit supersession, stale replies, worker crash/restart, cancel/resume, refresh recovery, malformed storage, quota failure and manual export pass in actual browsers. Atomic storage acknowledgement follows successful setItem; in-flight progress is not promised durable.

## Measured execution envelope and review

Measurements ran on Node v24.18.0, npm 11.16.0, macOS Darwin 25.6.0 arm64, Apple M4 Pro, 14 logical CPUs and 24 GiB installed memory. Process-lifetime peak RSS was 1,415,616 KiB (1.35 GiB), including Vite SSR and all measurement stages; per-operation snapshots are not peaks.

- One node advanced 86,400 seconds with 1,001 scheduled/applied events in 1567.02 ms and crossed 86,401 seconds in another 17.59 ms. The complete project is 394,648 UTF-8 bytes; normalized restoration and subsequent seven-second continuation passed.
- The largest canonical configuration (1,000,000 accelerators, 125,000 nodes, 782 modules) initialized in 1887.84 ms and advanced one simulated second in 2152.14 ms. With 10,000 future events its full project is **19,613,291 bytes**, about 29.2% of the file cap. Detached project validation took 917.81 ms and serialization 544.61 ms. Exact round-trip and subsequent continuation passed. Main-thread project operations remain synchronous and may be noticeable for this large file; bounded replay does not promise instant import/export.

The campus keeps its correctly reported shared-network shortfall. Its 10,000 events are admitted future history; executing that simultaneous boundary exceeds the worker atomic-event work budget and is safely resource-limited. No maximum-duration campus run or device-independent performance claim is made.

Independent/adversarial review identified and repaired full design binding, fault/equipment and duty-deadline coherence, array serialization/accessor bypass, legacy mixed-sequence recalculation, fractional-grid replay, raw saved-collection overflow, source/reference/unit validation, worker restore validation, sparse allocation and comparison provenance. [Committed review](evidence/review-committed.json), [independent review](evidence/review-independent.json), [persistence review](evidence/review-persistence.json) and [optimization review](evidence/review-scope-optimization.json) record actual probes and source hashes. Public-material review excludes credentials, recordings, recovery bundles and private observation payloads.

## Hosted CI follow-up

The first hosted push run passed installation/build checks and 256 unit tests but failed 33 of 75 browser cases: all 25 frozen macOS-14 WebKit cases failed at page setup with `Unknown setting: PushAPIEnabled`, and eight Firefox cases timed out during existing interaction/render tests. Its measurement gate was not reached. The PR run passed all 256 unit cases, failed 34 of 75 browser cases, and did not reach measurements; its uploaded evidence records FAIL while GitHub marked the job cancelled at its 45-minute deadline. These are failed/cancelled attempts, not accepted gates. [CI-INVESTIGATION.md](CI-INVESTIGATION.md) preserves their evidence and the scoped change to the current `macos-26-intel` runner; all test assertions/timeouts, product code and telemetry coverage remain unchanged. Integration stays NOT MERGED until corrected normal CI passes.

## Issue disposition, integration and recovery

PH0-001 and PH0-002 pass current desired-behavior regressions. PH0-003 retains the 4,000-node shared-network boundary (Phase 3); PH0-004 remains an equipment-ownership risk without a demonstrated numerical mismatch (Phase 2); PH0-005 retains the outage/terminal-assessment gap (Phase 4); PH0-006 receives no invented transfer benefit (Phase 5). Durable current tests preserve each deferred finding.

The remote initially lacked main; the user authorized creating it from verified codex/neptune at `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f`. [Remote preflight](evidence/remote-preflight.json) and [fresh pre-publication snapshot](evidence/remote-before-publication.json) show Pages publishing only codex/pages, two historical deployments, empty repository hooks/rulesets, and a separate source-only verification workflow. Exhaustive installed-app inventory was unavailable, an explicit visibility limit. No unknown external setting was changed or relied upon.

No production/preview promotion, release workflow, release-tag move or deployment-branch push is included. [MERGE-AND-ROLLBACK.md](MERGE-AND-ROLLBACK.md) specifies normal protected PR integration and non-destructive rollback retaining Phase 0 and deployment separation. Keep schema-3 exports and this runtime revision for recovery; older schema-2 code cannot restore its continuation state exactly. Post-merge evidence and actual remote identities are recorded in the PR/final report without recursive SHA-only commits.

Accepted outcome: safer numerical boundaries and dependable preservation/replay within the documented contract. This is not physical validation or completion of later phases.

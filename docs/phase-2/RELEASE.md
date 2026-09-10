# Phase 2 equipment authority

Scope: make installed, immutable equipment specifications authoritative for the existing simulated design-stage prototype. Source changes alone are not release acceptance: the frozen-candidate test/review receipts and public deployment verification establish promotion. Full Phase 1 acceptance, strict performance targets, stability batches, exhaustive stress/measurement work and physical validation remain deferred.

## Verified starting point

- Repository: `Arhaan2/neptune-2035`; current remote main and live `release.json` source: `06899f0668a05c6ba7f0a1bc0c96d33304eef580`.
- Existing Pages branch/root: `codex/pages`, `/`; compiled baseline: `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5`.
- Live artifact manifest SHA-256: `0e46d18a7295fea9cc677fa0efece7580ab3dac1642643df141fa223080a6df7`.
- Baseline Pages run: https://github.com/Arhaan2/neptune-2035/actions/runs/34535474744 (success).
- Baseline source CI: https://github.com/Arhaan2/neptune-2035/actions/runs/34534768442 (success).
- Remote main is unprotected and rulesets are empty at preflight; ordinary PR merge and successful existing CI remain release gates. No settings were changed.
- Original local checkout and its two unrelated untracked files are untouched. Development uses a separate clone and isolated worktrees rooted at `/private/tmp/neptune-phase2`.

## Ownership and pipeline

| Actual agent | Assignment | Writable ownership |
| --- | --- | --- |
| `/root` | Integration, release, issue routing | This document, release scripts, CI; only agent authorized to merge/deploy |
| `/root/building` | Versioned catalog/resolution and application integration | Production `src/`; isolated build worktree |
| `/root/testing` | Requirements-derived tests and immutable baseline fixtures | Phase 2 tests/fixtures and test evidence; isolated test worktree |
| `/root/verification` | Independent numerical, consumer, persistence and release review | Scratch checks/review evidence; no production edits |
| `/root/fixing` | Targeted confirmed defect repairs | Only modules explicitly released by builder and assigned by orchestrator; isolated fix worktree |

The initial fourth `/root/fixing` spawn returned `agent thread limit reached`. Runtime supports four concurrent agents including the orchestrator. After the verifier completed its initial baseline review, the supported retry successfully created the distinct `/root/fixing` agent. Four actual subagents are used with at most three active together. Shared schema changes require orchestrator coordination; builder/fixer ownership must not overlap.

Baseline smoke: all 93 staged production/preview files matched (HTTP for public files; committed bytes for dotfile markers); public Chromium scene/worker/step/start/pause/reset/export/import/recovery/mobile journey passed. Tester passed 85 focused baseline unit/worker/geometry cases plus four independent baseline-equivalence cases. These establish the starting point, not candidate acceptance. See `baseline-integrity.json` and the fixture provenance in `tests/fixtures/phase-2/`.

## Contract and original competing owners

Use versioned reference specification snapshots, stable logical asset slots, explicit installation/revision identity, one canonical engineering resolver and separate economics. Reference records retain declared assumptions and explicit unknown physical values. No arbitrary catalog/editor or model expansion.

Original duplicate equipment owners include `moduleAssets` versus hydraulic pump fallbacks (curve/efficiency), `HARDWARE`/electrical/report compute peak, report pump efficiency, battery capacity versus generated mass, fixed conversion ratings and storage efficiency. Control/workload/environment stay explicit and retain existing behavior. New spec consumers must include generated module equipment, actual workers, geometry, inventories, inspectors and reports.

## Implemented scope and use

`src/twin/catalog/equipment.ts` owns immutable reference records, units, assumptions, installed references and separate economics. `buildDesign`/`reconfigureDesign` resolve at a design boundary; `resolveModuleEngineering` supplies the actual engine/worker; generated assets, geometry, inventory and reports use the same records. Controller delays/thresholds/initial conditions and network offered-demand assumptions are explicit versioned records. Config retains requested service, seawater/fouling and the legacy construction controls. Price/budget changes preserve engineering identity and the complete operating checkpoint.

| Supported demonstration | Declared specification values |
| --- | --- |
| Reference pump | v1.0.0; 250 kPa shutoff, 0.1 m³/s free flow, efficiency .72; 45 kW motor; 1.2 × 1.2 × .8 m, 180 kg |
| Efficiency-only pump | v1.0.0; efficiency .84; same curve, motor, envelope and mass |
| Physical pump replacement | v1.0.0; 280 kPa, .11 m³/s, efficiency .8; 55 kW; 1.35 × 1.3 × .9 m, 240 kg; assumed unit price USD 32,000 |
| Battery consistency fixture | v1.0.0; 600 kWh, 1.8 MW storage rate, 2.2 MW connection rating; charge/discharge efficiency .94; fixed 2.4 × 2.1 × 1.5 m and 4,600 kg; assumed USD 300,000 |
| Compute/conversion fixtures | Whole-server peak 10 kW and liquid capture .85; module conversion efficiency .99/rating 2 MW, tested through actual electrical allocation |

All alternatives are synthetic reference assumptions, not vendor products, calibrated curves or procurement quotations. Unknown shore-transformer and standalone fan masses stay unknown. Existing free-form battery capacity controls retain the explicitly named legacy relationship `energyWh / 130 + 300 kg`; the battery alternative uses its own fixed declared mass/envelope. No new scaling relation is inferred.

Use the **Exact equipment** selector to inspect a duty, seawater or standby pump. Under **Replace installed pump**, choose a **Replacement specification**, review its ratings/envelope/mass and reset explanation, then select **Apply and reset**. The logical slot ID is retained; specification ID/version plus physical design revision identify the installation. The current checkpoint is first saved in Compare's existing saved scenarios. A failed history write prevents the change. The new run starts paused at 0 s with declared temperatures, full declared battery energy and a fresh event history. Prior checkpoints/events stay with the original design; revision-bound telemetry is incompatible after replacement.

Schema-3 projects persist immutable catalog snapshots/references and economics. Solver 2.2.0 rejects incompatible checkpoint resume. Real Phase 1 schema-3 and schema-2 fixtures remain inspectable; explicit recalculation creates a separate derived project with parent provenance and retains the original. Unsupported spec versions and changed immutable values fail at import/worker admission. The 30-day horizon, event limit and integration/replay contract are unchanged. Comparisons retain the installed hardware; only explicitly derived no-standby variants omit an overridden slot they remove.

Fixed platform/hull/module/rack packing and geometry remain versioned reference layout templates; root assets persist full snapshots. Fixed network ports/topology retain their existing versioned representation and actual evaluator; offered traffic remains 100 Mbit/s cluster and 1 Mbit/s external per active node. This release adds no network resizing, routing architecture, optimization, arbitrary component editor, broad catalog or new physical model. Thermal capacitance/conductance and fluid-property approximations remain declared reduced-order model assumptions. The separate historical Legacy v0.1 view is preserved.

## Requirement-to-evidence map

| Requirement | Required evidence |
| --- | --- |
| Default equivalence | Explicit baseline numeric fixtures from fixed main; document any correction |
| Efficiency variant | Independent Q/pressure and inverse-efficiency electrical expectations; same envelope/mass |
| Physical replacement | Solver, inspector, geometry, inventory and export agreement |
| Compute/conversion | Actual electrical solver input propagation |
| Battery | Declared capacity/rating/envelope/mass; no invented capacity scaling |
| Economics | Changed report totals; identical full physical state/fingerprint |
| Stable identities/fingerprints | Nonstructural invariance and engineering sensitivity; deterministic serialization |
| Persistence/mappings | New round-trip, real legacy fixtures, explicit incompatible checkpoint/event/telemetry handling |
| Validation | Invalid references/units/nonfinite values rejected at import/worker boundaries; inadequate designs runnable |
| Existing workflows | Real worker, scene/camera, selection, start/pause/reset, positive campus step, export/recovery, mobile/fallback |
| Release | Exact frozen candidate tests + independent review, PR CI, actual merged source, public integrity and three-browser smoke |

## Issue queue

Slice A: builder `36542a55cb57df65a24d672f9d9f54dc934458b6`, integrated as `3a82a8e0632810af1e294698993aa17c53929944`. Tester snapshot `8673775` includes that exact production slice: typecheck passed; 26/29 focused checks passed. The three failing assertions are declared pending slice B (pump/battery report detail and persisted economic scale), not acceptance. Catalog/asset/engine/persistence/solver ownership was released to the fixer; builder continues UI/report/scene only.

| ID | Requirement / evidence | Expected versus observed | Owner / disposition |
| --- | --- | --- | --- |
| PH2-B-01 | Report propagation, tested `8673775` | Installed pump/battery specification details must appear; baseline report omitted them | Builder `c7e27c3`; passing in tester `19d7310` and integrated 46-case propagation suite |
| PH2-B-02 | Saved economics, tested `8673775` | Scale 1.25 must change included total from 14,707,500 to 18,384,375 USD; baseline report kept 14,707,500 | Builder `c7e27c3`; passing in tester `19d7310`, including unit-price/worker-state check |
| PH2-001 (P1) | Authoritative import/worker boundary, `36542a5`; verifier `tests/verifier-phase2.test.ts` | Changing saved root transformer efficiency .98→.5 while immutable spec remains .98 must reject or use spec; worker accepted and grid draw changed 57,393.69216776267→112,491.63664881483 W | Fixer `73dc4ae`; independent integrated reproduction passes |
| PH2-002 (P2) | Fingerprint excludes presentation, `36542a5`; same verifier test | Changing only `shore/grid.name` must leave physics identity unchanged; identity changed | Fixer `73dc4ae`; independent integrated reproduction passes |
| PH2-003 | Existing comparison/config paths, code review of B | A scenario/control comparison must retain selected equipment; `buildDesign(config)` rebuilt defaults | Builder `f669ed3`; `reconfigureDesign`/comparison cases pass in integrated 46-case suite |
| PH2-004 | Generated telemetry examples and calibration display | Old sample mapping is incompatible with the new design identity; calibration baseline must use installed HX | Builder `6536429`; deterministic fresh synthetic samples and two installed-HX consumers, 4 focused checks passed |
| PH2-005 (P1) | Previous-run recovery, independent Chromium review at `d072d37` | Replacement-created history names exceeded the existing 60-character reader limit, so saved history could not reload | Fixer `8aaa1fe`; independent Chromium reload reproduction passes at `2010e2b`; maximum name 29 characters |
| PH2-006 (P2) | Price-only observations, independent Chromium review at `d072d37` | Full physics checkpoint stayed equal, but price edit cleared retained observations from 16 to 8 and disconnected stream | Fixer `0a0ad85`; independent Chromium reproduction passes at `2010e2b`, retaining 16 records and the complete checkpoint; hardware revision clears incompatible mappings |

PR #2 CI run `34539868392` tested synthetic merge `d03c97e360e8c8eb3f0622b9558fb4c60b04999a`, whose tree exactly matched candidate `63e7382`. All 303 unit/telemetry tests passed; nine browser cases passed, but existing Firefox mobile recovery remained at 0 s after the recovery click. The trace showed the enabled recovery control was clicked while initial worker completion changed layout and scroll position; the recovery handler never activated. PH2-007 (P1, recovery usability) is repaired by fixer `4edb141`: recovery is disabled while a worker operation is pending, consistent with the other simulation controls. Tester `b45383b` holds a real initialization response, verifies recovery is unavailable until it completes, and then restores the exact 10 s checkpoint and steps to 20 s. This regression failed on the pre-fix implementation; the unchanged existing Firefox journey passed with the guard. No numerical/worker logic, existing assertions or timeouts changed. The new frozen candidate must pass the complete local gate, all 13 executed browser cases (plus the two unchanged campus exclusions), required CI and independent review before promotion.

Every confirmed defect must name severity/requirement, tested SHA, reproduction, expected/actual behavior, owner and disposition. Evidence is invalidated when its affected production inputs change. Final acceptance requires one frozen integrated candidate and fresh testing/independent review.

Independent implementation review at `2010e2b` passed seven numerical/boundary checks and both actual Chromium defect reproductions, with no unresolved release blocker identified. The first full unit gate passed 302/303; its sole failure was the historical PH0-004 test requiring that equipment ratings remain unconsumed. That obsolete source-negative assertion was replaced by an actual installed-variant equation check; other Phase 1 deferrals and baseline assertions were retained. This test-only correction requires a new exact-commit full gate. Final gate/CI/live outcomes and identities are in the release receipts described below, rather than inferred from these development checkpoints.

## Recovery and release rules

Preserve the compiled baseline commit above and every existing `v2-preview/` byte. Publish using the established normal-commit `codex/pages` mechanism after exact-candidate acceptance and PR merge. Rebuild from actual resulting main, package the existing manifest format, compare every deployed file (do not hardcode a file count), and exercise the public root in Chromium, Firefox and WebKit.

For a confirmed production regression, start at current `codex/pages`, restore tracked files from `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5`, then make and push a new ordinary commit. Never force-push/reset shared history. Verify the restored release marker, all bytes and public smoke. Keep source/checkpoints available; older code must not claim compatibility with new physical hardware histories.

The release gate runs typecheck, lint, the production build, the complete unit suite with both telemetry flags, and `prototype.spec.ts` plus `phase2.spec.ts` in Chromium/Firefox/WebKit against an immutable source. The existing Firefox campus step must advance actual time to 10 s. Required PR CI repeats the repository's configured prototype gate. Final local receipts bind source commit and results; the PR records the tested candidate, actual merge and CI; the [public release marker](https://arhaan2.github.io/neptune-2035/release.json) records deployed source and artifact hash. `scripts/phase-2/verify-public.mjs` compares every published production/preview file with the actual committed Pages artifact and existing manifest; dotfile markers are verified from Git. Final delivery retains raw browser/unit/review/integrity evidence under `artifacts/phase-2/` and a durable copy in the original project workspace.

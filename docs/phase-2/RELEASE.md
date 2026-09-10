# Phase 2 equipment authority — work in progress

Scope: make installed, immutable equipment specifications authoritative for the existing simulated design-stage prototype. This document is not release acceptance. Full Phase 1 acceptance, strict performance targets, stability batches, exhaustive stress/measurement work and physical validation remain deferred.

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

No candidate findings yet. Each entry must name severity/requirement, tested SHA, reproduction, expected/actual behavior, owner and disposition. Evidence must be invalidated when its affected production inputs change.

## Recovery and release rules

Preserve the compiled baseline commit above and every existing `v2-preview/` byte. Publish using the established normal-commit `codex/pages` mechanism after exact-candidate acceptance and PR merge. Rebuild from actual resulting main, package the existing manifest format, compare every deployed file (do not hardcode a file count), and exercise the public root in Chromium, Firefox and WebKit.

For a confirmed production regression, start at current `codex/pages`, restore tracked files from `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5`, then make and push a new ordinary commit. Never force-push/reset shared history. Verify the restored release marker, all bytes and public smoke. Keep source/checkpoints available; older code must not claim compatibility with new physical hardware histories.

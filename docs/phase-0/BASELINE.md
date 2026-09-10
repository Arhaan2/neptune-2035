# Phase 0 — preserved source and served artifacts

Phase 0 preserves evidence and makes findings reproducible. It does not fix defects, validate physics, establish a physical counterpart, or authorize publication. The controlling scope is the supplied “Implement or verify Phase 0 only” request. No separate “phased execution plan” attachment was found in the scoped attachment search. Follow-on phase numbers not stated in that request remain unassigned.

## Identities

| Identity | Full value / evidence |
| --- | --- |
| Phase 0 original source baseline and initial HEAD | `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f` |
| Initial branch / working state | `codex/neptune-digital-twin-v2`; tracked and untracked status empty |
| Phase 0 working branch | `codex/neptune-phase-0` |
| New local annotated source tag | `phase-0-baseline-23de38a-20260909`; tag object `29d2c9400af7f6f258948362124157d69928acc7`; target is the full Phase 0 baseline above |
| Original production's published source | `127a2fade93112d58f8edd9f6fc6e9e02b12b57c` |
| Preserved original compiled deployment | `672805a984feadaab375061817c919fd6849b311` |
| Preview's published source | `dcb9effd698bf10bbe0f98eba165213d2b0e5c16` |
| Verified compiled deployment containing both experiences | `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711` |
| New local annotated compiled-artifact tag | `phase-0-served-artifact-019b24f-20260909`; tag object `4211561ba3507be65afa24cd2f69b47d7fbbc4f7`; target is the compiled deployment above |
| Remote | `https://github.com/Arhaan2/neptune-2035.git` |

The older `docs/v2/BASELINE.md` is the V2 project's audit of the original V0.1 experience, not an earlier implementation of this six-finding Phase 0. It remains untouched. Its source checkpoint `8b78638838a82ee603fdb001bfc978df49a9665d`, annotated `v0.1.0` tag object `462f2fbbda5766bdd568ec58c18dd82e542529e9`, and V2 milestone A `8072ab38ea0c8d71d045a8ad869363be8dcb1cbe` remain preserved. No prior Phase 0 framework, fixture set, or six-finding register existed. A rerun must retain the Phase 0 baseline SHA rather than use the latest tooling commit.

The two public identities were fetched afresh from [production](https://arhaan2.github.io/neptune-2035/release.json) and [preview](https://arhaan2.github.io/neptune-2035/v2-preview/release.json). Copies are in [published evidence](evidence/published/). Preview reports `2.0.0-rc.1`, built `2026-09-09T01:26:57.773Z`; the SHA-256 of its published `build-manifest.json` is `2f957728135fa8b98b4b55aecc96f8ccebee4e6beadd9a0e29bfa954b0bb3fd1`. Its 43 payload entries exclude the two identity manifests. All **51 publicly served files** (7 original + 44 preview) matched the compiled Git artifact; the two empty `.nojekyll` markers were verified through Git. Production's absent `build-manifest.json` has an explicit HTTP 404 receipt and response-body hash. Its existing `release.json` is present. The generated observation inventory is clearly separate from published application metadata.

The source differences from the preview's published SHA to the Phase 0 baseline, and from the original published source to V0.1's checkpoint, contain documentation/evidence only. Their complete changed-path lists are in [baseline-manifest.json](baseline-manifest.json). No claim that current HEAD built either site is made. Later Phase 0 commits contain tooling and evidence only; [harness-manifest.json](evidence/harness-manifest.json) identifies the executed harness independently. The final local commit is available in Git history and the completion response, avoiding a manifest that tries to contain its own commit SHA.

## Actual repository locations

| Concern | Existing implementation / artifact |
| --- | --- |
| Original application | `src/domain/model.ts`, `src/state/scenario.ts`, `src/ui/App.tsx`, `src/scene/Scene.tsx`, `Facility.tsx`, `layout.ts`; selected by legacy query/hash in `src/main.tsx` |
| V2 application | `src/ui/TwinApp.tsx`, `TwinPanels.tsx`, `TwinDataPanel.tsx`, `useTwin.ts`; `src/scene/TwinScene.tsx`, `twinGeometry.ts` |
| Design, inventory and architecture builders | `src/twin/assets/design.ts`: `buildDesign`, `moduleAssets`, `resolveAsset`, `connectionsForModule`, `loopGeometry` |
| Equipment assumptions | `src/twin/catalog/reference.ts`: `HARDWARE`; asset ratings in `moduleAssets`; solver assumptions/defaults in `src/twin/solvers` |
| Hydraulic boundary | `src/twin/solvers/hydraulic.ts`: `HydraulicInput`, `solveHydraulics`; engine `circuit` supplies arguments |
| Simulation, history and replay | `src/twin/engine/simulation.ts`: `initialize`, `validateEvent`, `mergeEvents`, `advanceWithStep`, `replay`, `summarize`; worker in `engine/worker.ts` |
| Persistence and reporting | `src/twin/analysis/reports.ts`: `projectFile`, `parseProject`, `resultsCSV`, `engineeringReport`, `constraints`, `sizingAssessment`, `compareRedundancy` |
| Network solver | `src/twin/solvers/network.ts`: `NETWORK_ASSUMPTIONS`, `createNetworkEvaluator`, `assessNetwork` |
| Telemetry infrastructure | `src/twin/telemetry/*`; optional local publisher `scripts/telemetry-publisher.mjs`; not a hosted backend |
| Existing reference fixtures | `reference/benchmarks.py`, `reference/benchmarks.json`, `public/experiments/*`, `public/samples/*`; existing `tests/twin-*.test.ts` |
| Build / publishing | `vite.config.ts`, `package.json`, `scripts/package-preview.mjs`; local ignored `dist/`; compiled Git artifact has root production and `v2-preview/` |
| Release evidence reused | `docs/RELEASE.md`, `docs/v2/{BASELINE,READINESS,RELEASE-CANDIDATE,MODELS,REQUIREMENTS}.md`, `docs/v2/evidence/*` |

`TWIN_SCHEMA`, `DesignConfig.schemaVersion`, project and observation envelope schemas are 2. `SOLVER_VERSION` and package version are `2.0.0-rc.1`; legacy `SCHEMA_VERSION` is 1. Asset revision is `2.0.0`. Network profile is `illustrative-job-traffic-v1` revision `1.0.0`. Design and observation mapping revisions use `revisionFor(config)` (`reference-v2-` plus eight hex digits); they are configuration identities, not Git SHAs. Electrical/thermal constants have no separate explicit revision field; their baseline file hashes identify them.

## Environment and publication triggers

Executed on Apple M4 Pro, 14 logical CPUs, 24 GiB RAM, Darwin 25.6.0 arm64, Node `v24.18.0`, npm `11.16.0`. The lockfile SHA-256 remains `87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9`. The build is `tsc --noEmit && vite build`, Vite base `./`, default output `dist/`. No dependency, package script, lockfile or application configuration changed.

Authenticated read-only GitHub evidence confirms Pages branch publishing (`build_type: legacy`) from `codex/pages` at `/`, with the managed `dynamic/pages/pages-build-deployment` workflow. A push to that branch can publish both experiences. The default source branch is `codex/neptune`; there is no tracked `.github` workflow or `.openai/hosting.json` in this checkout. A future workflow/settings change could alter publishing. The anonymous Pages API returned 404; the authenticated settings read resolved this access limitation. See [remote-settings.json](evidence/remote-settings.json). No remote writes occurred.

## Reproduction without changing baseline runtime

Run from the repository root:

```sh
# Full, fresh source archive + npm ci + existing checks + Phase 0 harness:
node scripts/phase-0/clean-check.mjs

# Fresh install and final diagnostic helpers only (does not repeat browser checks):
node scripts/phase-0/clean-check.mjs --diagnostics-only

# Verify the complete retained preservation gate and rerun focused evidence:
node scripts/phase-0/verify.mjs

# Individual findings (substitute PH0-002 through PH0-006):
node scripts/phase-0/audit.mjs PH0-001

# Unwrapped desired-behavior results: exit 1 is expected on this baseline.
node scripts/phase-0/audit.mjs PH0-001 --desired
node scripts/phase-0/audit.mjs PH0-002 --desired
```

The clean runner uses `git archive` of the full pinned baseline into a fresh temporary directory; it inherits neither `node_modules`, `dist`, browser storage, nor test results. `npm ci` uses the baseline's unchanged lockfile. Existing typecheck/lint/build/tests run **before** the test-only overlay. Only `scripts/phase-0`, `tests/fixtures/phase-0`, and their provenance records are then copied into that source tree. All baseline tracked files are hashed again. The harness checks those hashes before importing the real TypeScript modules with the already-installed Vite toolchain; it does not patch application code. The ordinary Vitest suite remains unchanged and excludes the diagnostic runner.

The first clean run recorded 160 passed and two existing opt-in telemetry skips. The complete run enables both telemetry flags and runs all 162 tests plus the 48 existing browser cases against its own fresh server. The server uses strict port 5173 because the existing app telemetry test hardcodes that origin. A port conflict is an infrastructure failure, never permission to reuse an unknown server. Native browser/local socket access may require the execution environment's sandbox allowance. No browser downloads, new dependencies, or package changes are made automatically.

The final audit-helper revision removes an unnecessary object spread, preserves infrastructure exit codes when desired failures also exist, and disables the unused browser/UI dependency scan in the numerical-only loader. Its fresh source/install recheck is recorded separately in `evidence/diagnostic-verified/`; `execution.json.runnerSha256` and diagnostic `harnessHashes` identify that exact revision. The complete application suite in `evidence/clean-final/` is retained with its original executed harness hashes; no previous evidence was silently relabeled. `verify.mjs` validates both records and matches the latest helper hashes to the files being delivered.

## Verified artifact recovery

Recovery was actually exercised: a fresh directory was populated from the preserved compiled commit, and all 53 files matched the captured HTTP/Git hashes. See [recovery-receipt.json](evidence/recovery-receipt.json). This is exact compiled-artifact recovery. A successful source build is separate evidence; bit-for-bit source rebuild equivalence was not measured or claimed.

```sh
# Restores BOTH original root files and v2-preview/ into a NEW directory.
# An existing destination is rejected, never overwritten.
node scripts/phase-0/recover-artifacts.mjs --out=artifacts/phase-0/recovery-new

# Check the optional local offline backup (not committed; approximately 10 MB):
git bundle verify artifacts/phase-0/recovery.bundle

# If the original Git object store is unavailable, recover a separate repository:
git clone artifacts/phase-0/recovery.bundle /tmp/neptune-phase0-offline-recovery
git -C /tmp/neptune-phase0-offline-recovery archive 019b24f93a1960fd0ca582bb0f4c3cdccfbc6711 --output=/tmp/neptune-phase0-served.tar
```

The local bundle hash and refs are in the baseline manifest. Both tagged source and compiled histories are included. Keep the bundle with the local handoff if an independent backup is needed; it contains no recordings. Compiled assets are already in the preserved Git commit and are not duplicated as large committed evidence.

For a **future separately authorized** restoration, create a new normal commit descended from the then-current `codex/pages`. To restore production only, copy the eight root paths listed by `git ls-tree -r --name-only 672805a984feadaab375061817c919fd6849b311` from the recovery output, retaining `v2-preview/`. To restore preview only, restore the complete `v2-preview/` subtree from `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711`, retaining root files. Verify the resulting chosen subtree against the receipt; remove obsolete assets only within that explicitly authorized subtree. Publishing requires that future authorization. Never repoint preserved tags, reset shared history or force-push. After any approved publication, refetch both release manifests and the file hashes and run hosted browser acceptance against the selected URL. None of these remote restoration actions was performed in Phase 0.

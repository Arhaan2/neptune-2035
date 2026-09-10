# Phase 1 integration and non-destructive recovery

Repository verified: `Arhaan2/neptune-2035`; checkout `/Users/arhaan/Documents/ChatGPT/Neptune`. This work is source integration only. No production or preview promotion is authorized.

## Source identities and prerequisites

| Identity | Verified object |
| --- | --- |
| Baseline source / requested initial main | `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f` |
| Original Phase 0 checkpoint | `f676c1f9902008a7096e5e8122a5701953b7c772` |
| Production source | `127a2fade93112d58f8edd9f6fc6e9e02b12b57c` |
| Preserved V2 preview source | `dcb9effd698bf10bbe0f98eba165213d2b0e5c16`, preview `2.0.0-rc.1` |
| Preserved compiled deployment | `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711`, branch `codex/pages` |

The remote initially had no `main`. The user explicitly authorized creating `main` from verified `codex/neptune`, then targeting `main`. The repository default branch stays `codex/neptune`. Phase 0 is a distinct prerequisite commit adding exactly 72 files; the Phase 1 branch descends from it. A normal history-preserving PR merge retains that original checkpoint in `main` ancestry. Existing tags are not moved. Retained V2 source prerequisites were already present in the baseline; no unrelated experimental ancestry is added.

## Remote operations and deployment separation

`evidence/remote-preflight.json` records the read-only audit performed before any remote write. Legacy GitHub Pages publishes `codex/pages`; its `github-pages` environment admits only `codex/pages` and `gh-pages`. Repository webhooks and rulesets were empty, source branches unprotected, and only two historical Pages deployments existed. The baseline had no source workflows. The new workflow has `contents: read` and performs dependency installation, tests, build and evidence upload only. It contains no deployment/release action or environment, and does not modify tracked compiled artifacts.

Installed GitHub Apps could not be exhaustively enumerated with the available token, and the inspected browser was signed out. No external application appeared in deployment or source-check history. This is a recorded visibility limit, not proof that no external service exists. All accessible hooks/settings were inspected; no concrete unsafe coupling was observed. No unknown external setting was changed or relied upon for protection.

Immediately before writes, recheck source/main/Pages refs, workflow diff and protections. Creation of `main` is an atomic new-ref operation and must fail if it already exists. Feature push and PR creation occur after local acceptance and public-material review. Merge must use normal protections and the exact tested head, with no administrator bypass, force push, direct protected-branch update or release tag move. Recheck main/head and inspect the prospective merged tree; if either changes, revalidate. A queued merge is not a completed merge.

The final PR/final report and machine-readable integration record identify the actual tested head, pre-merge main, PR URL, merge SHA and observed remote main. Post-merge records can live alongside the final report/PR evidence rather than causing self-referential SHA-only commits. Until these records confirm completion, the integration status remains **NOT MERGED**.

[Integration PR #1](https://github.com/Arhaan2/neptune-2035/pull/1) targets `main` at the baseline above. The corrected source `61bf694662560d12ba398bfe598540926d11a9cb` passed the full clean local gate (256 unit, 81 browser, measurements); [ACCEPTANCE.md](ACCEPTANCE.md) and its raw evidence record the exact commands and environment. Subsequent diagnostic/environment changes are separately reviewed and must pass normal CI on the exact final head before the history-preserving merge; the other 77 accepted executable/configuration hashes remain unchanged. The PR and final report provide the actual resulting remote identities and post-merge checks once observed.

## Rollback without erasing provenance

Production and the preserved preview do not need rollback for a source-only change. Their `codex/pages` compiled commit remains unchanged. Recovery of the exact 53-file artifact is documented in Phase 0 and was repeated into a new local directory during this phase. Do not run a deployment command as part of source rollback.

If Phase 1 must be withdrawn, create a new `codex/` fix branch from current main and revert only the Phase 1 implementation commit(s), preserving the Phase 0 prerequisite commit, its original object identity, historical evidence and the source-only deployment separation. Retain the verification workflow or adjust its tests deliberately for the rollback; never blindly revert a combined merge in a way that removes release protections. Review the resulting diff and merge a normal PR after the relevant gates. Do not reset shared history or move checkpoint/release tags.

Before opening saved projects on rollback code, export schema-3 projects using this Phase 1 runtime. The older schema-2 runtime lacks their controller/battery/integration state and must not claim exact restoration. Keep the saved files and this verified source/lockfile revision available for recovery. A schema-only conversion cannot restore old numerical semantics. Use the explicit derived-recalculation path when compatibility is unavailable; preserve the original project and parent identities.

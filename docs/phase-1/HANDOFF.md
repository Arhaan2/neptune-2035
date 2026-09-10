# Phase 1 — PAUSED, NOT MERGED

The user suspended implementation, tests, diagnostics, remote writes and merge authorization. Resume only after new authorization. This local WIP handoff is **not acceptance of the latest candidate**. No tests or new CI runs were started after the pause.

## Repository and checkpoint

- Branch: `codex/neptune-phase-1` in `/Users/arhaan/Documents/ChatGPT/Neptune`.
- Implementation HEAD at pause and confirmed published PR head: **`bdff4a80cc12dfa70ecbe99b1c787a523503efa2`**. Its push completed immediately before the pause.
- [PR #1](https://github.com/Arhaan2/neptune-2035/pull/1) is **OPEN**, targeting `main`; no merge commit exists. Last observed main: `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f`.
- The local-only commit containing this file is the WIP checkpoint (obtain its SHA with `git log -1 --format=%H -- docs/phase-1/HANDOFF.md`). It is not pushed. All implementation changes were already committed; no tracked implementation edits were outstanding at pause.
- After this checkpoint, the only expected Git status entries are the untouched unknown files `.github/workflows/phase-1 2.yml` and `playwright.config 2.ts`. Their existing SHA256 values are `bf897ceec0a7dc235a87ba0e33f2e0c0dc62b71ad40604120eed8c9acd3c6bde` and `7cb921e320b050706fc1f7f230706333875709b33e50d7cfc79ac0810742bca8`. Do not add, delete or overwrite them.
- Existing ignored evidence remains under `artifacts/phase-1/`. Supporting drafts are copied and hashed in `artifacts/phase-1/paused-handoff/`; its patch preserves those files locally. The saved integration JSON and published PR description predate the latest push and are **stale**, not current acceptance records.

## Last complete local pass

**`61bf694662560d12ba398bfe598540926d11a9cb`** passed the clean exact-commit command:

```sh
node scripts/phase-1/verify.mjs --ref=61bf694662560d12ba398bfe598540926d11a9cb --out=docs/phase-1/evidence/committed-cancel
```

All seven gates passed: npm ci, typecheck, lint, build, **256/256 units with both telemetry flags**, **81/81 browser cases (27 Chromium, 27 Firefox, 27 WebKit)** and measurements; zero failed/skipped/flaky/retried cases. Browser gate: 384.061643083 seconds; measurements: 22.040285958 seconds. Node24.18/npm11.16, Darwin25.6 arm64/M4 Pro, 24GiB; browsers153.0.8010.12/155.0/26.6. All 80 source hashes stayed stable and 73 protected hashes matched. [Exact evidence](evidence/committed-cancel/execution.json) and [measurements](evidence/committed-cancel/measurements.json) retain timings, long-history round-trip and campus continuation results.

## Latest completed hosted failures

At **`7dcecd3dec202621d1ed0442aee64f36335bfde1`**, [push34417931628](https://github.com/Arhaan2/neptune-2035/actions/runs/34417931628) and [PR34417936037](https://github.com/Arhaan2/neptune-2035/actions/runs/34417936037) both **FAILED**. PR tested synthetic `30608245d6208ff27b8b81dcbb9dbb96f829ffeb`, not an actual merge. Each passed installation/typecheck/lint/build and 256 units, then **77/81 browsers: Chromium23, Firefox27, WebKit27**. No skips/flaky cases/retries. **Measurements and browser-version probes were not executed.**

All four failures hit the unchanged **60000ms total test deadline**:

| Exact Chromium test name | Recorded stopping error |
| --- | --- |
| rendered modes, connected exploded paths, interior and bounded resources | `locator.click` on Cooling, acceptance.spec.ts:77, both runs |
| presets, engineering controls, validation and fresh-context sharing | Push: NEPTUNE I 2026 click, line151. PR: module-total expected `04`, received empty, line152 |
| demo runs through real state, cancels, restores and restarts; keyboard dialog access | `data-demo` expected `false`, received `true`, acceptance.spec.ts:307 |
| context cameras, keyboard interior, distinct families and bounded large-scene diagnostics | Design family II click, twin.spec.ts:271 |

[Push logs](evidence/ci-linux-display-push/browser.log), [PR logs](evidence/ci-linux-display-pr/browser.log), their `browser-summary.json`, `browser-contexts/` text snapshots and [independent review](evidence/review-ci-linux-display.json) are committed. Downloaded originals remain in `artifacts/phase-1/ci-display-full-{push,pr}/phase-1-verification-<tested SHA>/`. Logs name `test-results/<case-slug>/trace.zip` and screenshots; those binaries were **not included in the retained CI artifacts**. Their present remote availability is unknown; do not claim traces were inspected. Earlier failed/cancelled attempts and unexecuted gates remain in [CI-INVESTIGATION.md](CI-INVESTIGATION.md).

## Changes and remaining blockers

Since the last full local pass, application code and every test body remain identical: **77/80 accepted executable/configuration hashes match**. The three reviewed changes are the source-only Ubuntu/Xvfb/Mesa workflow, Playwright browser environment, and bounded browser diagnostic. Documentation and failed-run evidence were added. Linux Firefox now runs headed with software WebRender/60Hz; latest candidate also runs Linux Chromium headed with `--use-gl=angle --use-angle=gl`. Darwin Chromium retains its Metal flag; Darwin Firefox remains headless. No assertions, deadlines, tolerances, telemetry or lockfile were weakened.

- **Application defects:** earlier busy-Pause and delayed-Cancel acknowledgement defects were reproduced, fixed and included in the complete 61bf pass. No new application defect has been demonstrated by the four Chromium deadlines.
- **Established environment/test findings:** all Firefox/WebKit and all 33 Phase 1 browser cases passed the latest completed hosted gate. Several passing Chromium visual cases also approached 60 seconds. The latest Chromium candidate passed typecheck/lint and bounded local diagnostic lifecycle checks, **not a new complete acceptance run**.
- **Unresolved:** the failed Chromium runs did not capture their actual renderer. Cumulative rendering overhead is a hypothesis. Both Chromium diagnostic variants used SwiftShader locally on macOS; Linux Mesa selection and performance are unknown. Full latest-head CI, prospective merge review and clean post-merge verification remain incomplete. No merge is authorized while paused.

## Minimal reproduction and proposed next experiment

**Commands below are for an authorized resumption only; not executed for this handoff.** On the failing 7d revision in Ubuntu24.04 with installed dependencies, this selects only the four failing cases:

```sh
xvfb-run -a -s '-screen 0 1920x1200x24' npm run test:browser -- --project=chromium tests/browser/acceptance.spec.ts tests/browser/twin.spec.ts --grep 'rendered modes, connected|presets, engineering controls|demo runs through real state|context cameras, keyboard interior'
```

The proposed experiment is already encoded in published bdff: compare original headless Chromium with headed ANGLE OpenGL using its bounded diagnostic, then assess the unchanged four cases/full gate. Read the already-running jobs' eventual artifacts first; do not start a duplicate experiment. Display mode, executable and backend change together, so a better result would not isolate one cause.

## Processes, active jobs and preservation

One read-only pause snapshot found [push34420820923](https://github.com/Arhaan2/neptune-2035/actions/runs/34420820923) and [PR34420824576](https://github.com/Arhaan2/neptune-2035/actions/runs/34420824576) **in progress**, automatically triggered by the pre-pause bdff push. Their final outcomes and PR synthetic SHA are **unknown**. Neither was cancelled/restarted; no polling loop was entered.

Agents were told to stop editing. Existing diagnostic reports record all owned groups absent; the pause process check found no task-owned test/watch process and no listeners on 5173/5183. Codex tool runtimes were left untouched. Future identification can use `lsof -nP -iTCP:5173 -iTCP:5183 -sTCP:LISTEN` and inspect the returned PID before any action; never kill by a broad name match.

All commits, worktrees, evidence and PR remain. No reset, clean, deletion, force-push, merge or deployment occurred. Latest pre-push audit still showed Pages at `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711` with only the two original deployments. [Acceptance](ACCEPTANCE.md) and [recovery/rollback](MERGE-AND-ROLLBACK.md) retain the contract and prior evidence; this handoff supersedes their instructions to keep iterating while the assignment is paused.

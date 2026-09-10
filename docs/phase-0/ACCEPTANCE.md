# Phase 0 acceptance

**Phase 0 status: PASS — evidence and preservation requirements satisfied.** This does not mean the defects are fixed, every reference design is adequate, physics is validated, or a physical counterpart is connected. Phase 1 and later phases remain unimplemented.

Source baseline: `23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f`. Work is isolated on local `codex/neptune-phase-0`; the original branch remains at that source checkpoint. New annotated tags pin the source and recovered compiled artifact without moving existing tags. Tooling identity is the recorded file-hash inventory and final local Git checkpoint, separate from the baseline. No manifest contains its own eventual commit hash.

## Actual execution

| Command / check | Observed result |
| --- | --- |
| First fresh `npm ci` | Exit 0, unchanged lockfile; 520 packages installed |
| First baseline `npm run typecheck`, `npm run lint`, `npm run build` | All exit 0 |
| First baseline `npm test` | Exit 0; 160 passed, 2 existing opt-in telemetry skips |
| Final fresh `npm ci`, typecheck, lint, build | All exit 0; independent new source archive and dependency installation |
| `NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1 npm test` | Exit 0; **162 passed**, no skips; 5.19 s reported by Vitest |
| `NEPTUNE_BASE_URL=http://127.0.0.1:5173 npm run test:browser` | Exit 0; **48 passed**, 0 failed/skipped/flaky, no runner errors; 298.690 s across Chromium, Firefox and WebKit |
| `node scripts/phase-0/audit.mjs` in the clean baseline with harness overlay | Exit 0; six evidence checks passed; desired defects remain open |
| `node scripts/phase-0/audit.mjs PH0-001 --desired` | **Exit 1**, two expected semantic rejection failures; diagnostic evidence PASS |
| `node scripts/phase-0/audit.mjs PH0-002 --desired` | **Exit 1**, four expected semantic round-trip failures; diagnostic evidence PASS |
| Final helper lint (`node_modules/.bin/oxlint scripts/phase-0`) | Exit 0 after removing one unnecessary test-only object spread |
| `node scripts/phase-0/recover-artifacts.mjs --out=artifacts/phase-0/recovery-check` | Exit 0; 53/53 compiled files restored and verified into a new local directory |
| `git bundle verify artifacts/phase-0/recovery.bundle` | Exit 0; complete source/deployment history and three preserved tag refs |

The full clean source execution starts at the timestamp in [execution.json](evidence/clean-final/execution.json), with exact commands, environment flags, exit codes, elapsed times and raw-log hashes. It checks all 216 original tracked files after the install/build/tests/harness. The original working checkout's inventory independently records all **261 protected files unchanged**: 216 tracked application/configuration/publication/documentation files and 45 existing ignored compiled files. Package files, lockfile, application sources, public fixtures, original tests, original documentation and publishing scripts have unchanged hashes. Builds ran only in disposable source archives, not over the local preserved `dist`.

After final helper lint, stricter infrastructure-exit handling and disabling unused UI dependency discovery, `node scripts/phase-0/clean-check.mjs --diagnostics-only --out=artifacts/phase-0/diagnostic-verified` rechecks the delivered harness in another fresh source archive with `npm ci`. Its [separate execution record](evidence/diagnostic-verified/execution.json) preserves the latest runner/content hashes. The earlier complete application and browser results remain identified by their original run; no application code changed between these checks.

Both [production](https://arhaan2.github.io/neptune-2035/) and [preview](https://arhaan2.github.io/neptune-2035/v2-preview/) were observed independently. Production reports source `127a2fade93112d58f8edd9f6fc6e9e02b12b57c`; preview reports `dcb9effd698bf10bbe0f98eba165213d2b0e5c16`, version `2.0.0-rc.1`. All 51 public files match deployment commit `019b24f93a1960fd0ca582bb0f4c3cdccfbc6711`; the two Git-only build markers are also preserved. The original eight-file root artifact remains identical to `672805a984feadaab375061817c919fd6849b311`. Exact local recovery instructions and the distinction between artifact recovery and source rebuilding are in [BASELINE.md](BASELINE.md).

## Scope, limitations and blockers

No required reproduction or provenance blocker remains. The absent original public file-hash manifest is documented by HTTP 404 evidence and an alternative complete Git/HTTP inventory; the original source identity is available in its published release metadata. An initial anonymous Pages API 404 was resolved through an authenticated read-only query. Initial restricted DNS and a Vite test-helper WebSocket warning, plus a test-helper output-directory initialization error, are recorded in [tooling-notes.json](evidence/tooling-notes.json). The earlier numerical helper also emitted an unused client dependency-scan warning for UI aliases after bypassing the application Vite configuration. Actual SSR solver imports and diagnostics executed, but this unrelated helper warning is retained and explicitly separated from semantic evidence. The delivered loader disables that unused UI scan; a new fresh diagnostic recheck verifies it without warnings. Existing Three.js deprecation warnings remain visible in the successful baseline app-server log and were not fixed in Phase 0.

The ordinary first-run telemetry skips were pre-existing opt-in behavior, not Phase 0 diagnostic skips; both tests were explicitly enabled in the complete run. npm's existing `fsevents` install-script policy warning is retained in logs; installation and all required checks succeeded. Browser checks used freshly created browser contexts and the disposable source's own dev server. Native browsers were already installed on the machine; no dependency on old application state or build output was used. No new performance/physical validation claim is inferred from these software checks.

Network cases above the verified boundary remain deliberately inadequate. PH0-004 is an assumption ownership risk, not an observed wrong result. The evaluation gap is scoped: current event histories, causal logs and energy accumulators retain some historical information. The Gen III result applies only to the documented radial disturbance case; topology and numerical outputs need not be identical. Whole-run accumulation, equipment ownership changes, network redesign and transfer behavior are deferred.

No separate roadmap attachment was available beyond the user's Phase 0 request. This did not prevent the enumerated Phase 0 checks. Later phase numbers not explicitly supplied are marked unassigned rather than invented. Measured fixture timings are single bounded observations on the stated machine; equilibrium, long-duration behavior and physical commissioning remain outside scope.

The full staged `git diff --check` reports six trailing-blank-line notices in verbatim npm/Vitest log files. Their bytes and recorded hashes are deliberately retained. The separate staged whitespace check excluding only `docs/phase-0/evidence/**/*.log` passes for code, JSON and documents; no formatter or configuration change was used to rewrite raw execution evidence.

Changes are additions only under `docs/phase-0/`, `scripts/phase-0/`, and `tests/fixtures/phase-0/`. No production/runtime, numerical, schema, preset, equipment, UI, deployment-workflow or lockfile change was made. No deployment, promotion, branch/tag push, merge or remote settings change occurred. The offline recovery bundle stays local and ignored; no recordings or credentials were added to Git.

## Repeat the gate

```sh
node scripts/phase-0/verify.mjs
# For a new complete fresh installation and all existing tests:
node scripts/phase-0/clean-check.mjs
# Single findings:
node scripts/phase-0/audit.mjs PH0-001
node scripts/phase-0/audit.mjs PH0-002
node scripts/phase-0/audit.mjs PH0-003
node scripts/phase-0/audit.mjs PH0-004
node scripts/phase-0/audit.mjs PH0-005
node scripts/phase-0/audit.mjs PH0-006
```

The verifier checks retained raw evidence hashes, baseline/tag identities, current source protection, recorded clean-checkout results, compiled recovery and all six newly rerun findings from another fresh source archive and `npm ci`. A fresh complete clean run writes a new local evidence directory rather than overwriting a previous run. Publication snapshots are timestamped observations, not a claim of continuous monitoring. See [REQUIREMENT-TEST-MATRIX.md](REQUIREMENT-TEST-MATRIX.md).

## Bounded Phase 1 handoff

1. **PH0-001:** establish explicit finite validation of optional hydraulic ratings before solver iteration. Preserve the finite valid control and require explicit rejection of in-memory infinite shutoff/free-flow inputs; do not accept a later Reynolds-number exception as input validation.
2. **PH0-002:** choose and enforce one coherent engine/export/import contract for unique event count, event timestamps and total replay time. Retain 999/1000/1001-event, 86399/86400/86401-second, and engine-horizon controls. Any supported exporter output must either round-trip or be rejected explicitly at a documented boundary before being presented as recoverable.

No Phase 1 implementation is included. Network sizing, equipment ownership, whole-run evaluation and Generation III operating policy remain separate follow-on work.

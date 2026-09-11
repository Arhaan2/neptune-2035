# Phase 6 single defect queue

Application defects and demonstrated environment/harness failures are recorded separately. No author closes their own implementation as independently verified. Native failed output is retained outside the frozen source tree.

| ID | Severity / class | Affected commit | Reproduction / expected vs actual | Owner | Fix commit | Retest | Independent closure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P6-T001 | Blocker / contract | ee40a70 | Delete any of four numeric requirements; expected rejection, accepted instead. | Fixing, contract.ts lease | 0f47b75 | Testing 42/42 unchanged assertions; 74-field omission audit | CLOSED by Testing; contract-T001-retest logs |
| P6-T002 | Blocker / missing evidence | 379727d | Canonical unavailable terminal boundary with zero unavailable interval duration; expected unresolved, produced feasible/recommended. | Building | cae0df34 | Fixing independent boundary probe passed; Testing regression retest pending | Pending Testing closure |
| P6-T003 | Blocker / worker lifecycle | cae0df34 | Worker never replies; no outer response deadline, campaign hangs. | Fixing, worker-client.ts lease | Pending | Reproduced failure retained in repair-before logs | Open |
| P6-T004 | Blocker / incomplete scope | cae0df34 | Central no-feasible result with sensitivity cells pending retained scopeComplete=true. | Fixing, runner.ts lease | Pending | Reproduced failure retained in repair-before logs | Open |

Initial environment observations: the supplied workspace is an older Phase 1 worktree with two unrelated untracked files. A read-only inventory located accepted Phase 5; isolated Phase 6 worktrees were created without changing those files. Sandboxed network access cannot resolve GitHub; authorized escalated read-only fetch succeeds. CLI `gh auth status` in the sandbox reports invalid authentication; the configured GitHub connector successfully reads the current repository. No release blocker is inferred until actual publication capability is checked.

Environment/harness provenance: sandbox listeners produced EPERM in baseline SSE/Vite checks; authorized listeners succeeded. One baseline telemetry application test failed because its required origin is port 5173 while the isolated test server used 5177. Starting the actual unchanged application at its required port yielded both real telemetry integrations passing (47/47 telemetry tests). No assertion, timeout or application code was relaxed. CLI GitHub authentication works outside the network sandbox; its earlier sandbox status was not an authentication blocker. Raw failed runs are retained.

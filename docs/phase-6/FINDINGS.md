# Phase 6 single defect queue

Application defects and demonstrated environment/harness failures are recorded separately. No author closes their own implementation as independently verified. Native failed output is retained outside the frozen source tree.

| ID | Severity / class | Affected commit | Reproduction / expected vs actual | Owner | Fix commit | Retest | Independent closure |
| --- | --- | --- | --- | --- | --- | --- | --- |

Initial environment observations: the supplied workspace is an older Phase 1 worktree with two unrelated untracked files. A read-only inventory located accepted Phase 5; isolated Phase 6 worktrees were created without changing those files. Sandboxed network access cannot resolve GitHub; authorized escalated read-only fetch succeeds. CLI `gh auth status` in the sandbox reports invalid authentication; the configured GitHub connector successfully reads the current repository. No release blocker is inferred until actual publication capability is checked.

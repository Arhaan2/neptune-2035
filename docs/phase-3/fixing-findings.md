# Phase 3 focused fixing record

Distinct Fixing agent: `/root/fixing`; isolated worktree `/private/tmp/neptune-phase3-fixing`, branch `codex/neptune-phase-3-fixing`. Initial investigation overlapped Building and Testing after Verification completed its baseline checkpoint. Production file ownership remains with Building until its first network slice is committed and handed off.

## Initial graph-admission regressions

Baseline source: `28531fc` (before the new topology implementation). Independent fixture: [`tests/phase3-edge-validation.test.ts`](../../tests/phase3-edge-validation.test.ts). Command: `npm test -- tests/phase3-edge-validation.test.ts`. Initial result: **1 file, 5 tests, 1 passed and 4 failed**.

| Finding | Independent reproduction | Observed | Required |
| --- | --- | --- | --- |
| P3-F01 | Eight-accelerator graph, required cluster edge references a nonexistent input port, zero energized nodes | `satisfied` | Invalid/unsupported graph must remain visible at zero demand |
| P3-F02 | Duplicate `shore/cluster-core:cluster-out` port identity, second copy capacity zero | Evaluator accepts first-match capacity | Reject duplicate identity; port array order cannot choose physical capacity |
| P3-F03 | Required cluster edge disabled and references nonexistent output port, zero energized nodes | `satisfied` | Malformed dormant graph must remain visible |
| P3-F04 | Required platform domain lies in a disconnected two-switch enabled cycle | Ordinary `violated`/unreachable | Unsupported cyclic routing must be distinguished from a valid disconnected path |

The energized missing-port control passed by returning `unsupported`. No assertions were weakened to fit implementation. Fixture accepts either a structured invalid/unsupported admission failure or an unsupported assessment for malformed graph cases; valid undersizing and ordinary disconnection remain separate existing cases.

Root retains the accepted inspection-only path for unavailable legacy model/solver metadata. That path disables replay and requires explicit derivation, so accepting an old identity for inspection does not silently substitute a supported model. Unknown workload/network/catalog versions must still be rejected by their persisted immutable contracts. Root/Building own that implementation.

## Repair and retest

Pending initial Building slice and `src/twin/solvers/network.ts` ownership handoff.

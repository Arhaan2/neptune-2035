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

Building handed off exclusive `src/twin/solvers/network.ts` ownership with source `e67e115`, cherry-picked here as `f246649`. Its duplicate-port check repaired P3-F02. The same five fixtures then produced **3 failed, 2 passed**, confirming P3-F01/F03/F04 remained.

The focused repair rejects missing/incompatible directional endpoint ports during the one-time graph compilation, including disabled links. A static per-class topology mask detects enabled ambiguous parents and cycles with linear graph traversal, including disconnected required domains. Every provisioned module is checked for structural unsupported topology independently of instantaneous energized count. Valid zero-load disconnection remains a finite satisfied instantaneous assessment, while the full-installed assessment exposes its unreachable domain. Legacy external source paths retain their independent origin interpretation.

Standalone evaluation now composes the same declared network-power dependency evaluator as simulation. `assessNetworkProvisioning` explicitly ignores instantaneous power admission while preserving disabled network links. The optional `includeResources: false` evaluator mode skips inspector resource materialization and limits per-node path mapping to actual bottlenecks; full and compact results have identical admission, demands, issues and limiting domains. The evaluator compiles topology and power dependencies once and caches the last complete numerical query. Issue and affected-domain order is deterministic.

Regression fixture now has **13 cases**, including disconnected ambiguous parents with positive/zero demand, valid zero-demand disconnection versus installed assessment, common shore and local generation-two power dependencies, generation-one shared-bus impact, full installed demand at zero supply, preserved disabled-link impact, and complete-versus-compact evaluator parity for both presets across normal/local/common failure cases.

The first new local-power test failed because it inherited generation one, whose shore bus intentionally serves both platform domains. The fixture was corrected to explicitly select generation two for local isolation, and a separate generation-one assertion now verifies the common-mode behavior; no production defect or assertion relaxation was inferred from that fixture mistake.

Validation after repair: `npm test -- tests/phase3-edge-validation.test.ts tests/phase3-network.test.ts tests/twin-network.test.ts` — **3 files, 33 tests passed**; `npm run typecheck` and `npm run lint` passed. These are focused repair gates, not full-candidate or telemetry/browser/release acceptance.

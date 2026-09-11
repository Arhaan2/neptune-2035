# Phase 7 defect queue

No defect may be waived if it affects critical correctness, evidence integrity, or accessible core workflows. Each entry records requirement ID, reported source, reproducer, owner, fix source, Testing retest and Verification semantic closure. Native failures and subsequent receipts remain outside source; final acceptance is pending.

## P7-D01 — historical candidate inspection mixed with edited plan

P7-09/P7-11. Fixing and Testing independently reproduced on C0 production: execute transfer, edit fixture to nominal (or recovery dwell), then inspect the earlier evaluated III row. Historical labels/evidence were shown with newly planned nominal or edited recovery definitions. Testing recorded two native Chromium failures with exact planned-definition comparisons, screenshots and traces; Fixing independently recorded the fixture mismatch without page errors.

Assigned exclusively to `/root/fixing` for `src/ui/DecisionPanel.tsx` while Building continued C1/C2. Fix eccf79c, integrated6f1b0da, binds result-row inspection to the original result campaign/plan, labels stale provenance and preserves current-plan inspection only when there is no result. Fixing's typecheck/lint and existing selected-experiment browser check passed. Testing retest and independent Verification closure remain pending. No numerical expectations changed.

P7-D01 closure: Testing reran both original failing Chromium assertions unchanged on85e356d; both passed. Verification independently executed original stale-fixture inspection/load/run at6f1b0da, compared real exports and closed semantic defect in external D01-SEMANTIC-CLOSURE.md. Returned DecisionPanel ownership to Building for C3.

## P7-D02 — 375px workspace navigation obstructed

P7-13. Testing at85e356d recorded three passing Chromium C1/D01 cases and one native failure: `PH7 C1 keyboard 375px fallback exposes pump identity connections and failure without mutating view evidence`. Compare could not receive a normal click because `.twin-mode` intercepted pointer events over the workspace navigation. The original60-second timeout, screenshot and trace are retained; no force-click or exclusion is permitted.

Exclusive `src/ui/twin.css` ownership transferred from Building to Fixing. Building retains its already-written C2 appended styles locally and pauses further CSS edits during this focused repair; TS/TSX history work continues independently. Original failing reproduction must pass after integration; Verification reviews core navigation and final accessibility acceptance.

P7-D02 fix6b793a5 integrated54482c7 before C2. It lets the wrapped mobile navigation determine header height and preserves44px nav height; no stacking/pointer workaround. Fixing's original375px test passed, native measured navigation ends above the qualification banner; independent Testing confirmation remains part of integrated browser evidence.

## P7-D03 — old inspection key survived a new design prop

P7-03/P7-08. Testing atfbc19db independently reproduced the Orchestrator/Verification review concern: `inspectionRunIdentity(newDesign, oldState)` equals the old key because state.designIdentity takes precedence. During a design-change render, a previous inspection reply could remain compatible with the newly selected geometry before active initialization completes. The strict new-key regression fails; native D03-before JSON/log retained. Fixing receives history/useInspection ownership after Building's separately authorized metric-marker boundary extension is handed back. No weakened assertion or exclusion permitted.

Fix bc97253 integrated5ef1f9e binds compatibility to the actual engineering design and clears incompatible display immediately. Testing reran the strict original regression unchanged and the full focused history/asset suite passed. Final independent semantic closure is required on the integrated candidate.

## P7-D04 — explicit repeated execution retained prior history

P7-03/P7-08. The original native UI test reloaded the same experiment definition: current state was0 while the prior4.375 history scene survived. Fix64a5c4c integratedb3c1f8e adds a view-only admitted run generation, unchanged by ordinary stepping, pause or economic edits. Testing independently reran the original reproduction unchanged in C3: passed.

## P7-D05 — unavailable history displayed nominal network values

P7-06/P7-10. The original browser failure selected shore/cluster-core at an unavailable historical boundary and found a fabricated powered8,000W / zero affected domains fallback. Fix47ea849 integrated983fc4b avoids calling the normal-state evaluator without state; operation is explicitly unavailable and installed rating remains separately labeled. Testing independently reran the original assertion unchanged in C3: passed.

## P7-D06 — provenance was detached from the admitted run

P7-06/P7-11. Testing at09c5cb7 recorded two original native failures: inspecting an imported completed campaign showed simulated-model origin without supplied-evidence qualification; resetting after a project import retained the previous imported label. Fix5ecc7e7 integrated15836e4 binds origin to admitted state, preserves supplied ancestry during continuation, and passes decision provenance into completed-evidence inspection. Fixing reran Testing's unchanged two original tests: passed; independent Testing/Verification confirmation remains required. Unsupported import leaves existing state/origin unchanged. Fresh initialization has fresh simulated origin; replay does not upgrade imported evidence to measurements.

## Recording tool failures

The first real capture traversed all eight steps but attempted video save after browser shutdown; the second capture read the previous inspection status before React applied a new step. Both native failures/raw outputs are retained. The capture tool now saves after context close but before browser close and waits for the walkthrough's applied-step status. These attempts are not accepted release recordings.

## P7-D07 — recovery requirement link requested a nonexistent exact scene

P7-09/P7-10. The requirement retained the correct9.375s confirmation marker, but its inspect link requested exact post state at that marker, producing unavailable history. Fix580437e integrated2bb9edf explicitly selects `at-or-after` only for this metric, keeps the original raw requirement marker, labels the first canonical scene time10s separately, and leaves physical event links exact. Fixing's strict original native before/after passed. Testing added a separate strict regressionb4bf152 integrated05ce705; independent acceptance remains pending.

## P7-D08 — changed execution retained original walkthrough narrative

P7-03/P7-08/P7-12. Independent Verification at15836e4 completed all eight steps, returned current, used execution Seek time6, added a supported shore/grid trip, stepped the run to12, then resumed the original walkthrough. The definition ID stayed unchanged while recorded inputs and displayed history changed; the original recovered/feasible narrative incorrectly remained completed. Directly adding an input to the already-closed terminal run was correctly rejected; the defect requires the supported seek/derived-execution path. This is a release blocker pending a source-identity guard, unchanged failing reproduction, and independent semantic closure.

Fix af73752 integrated694daf5 binds guidance to the exact original complete source fingerprint (excluding only solver duration) and admitted run generation. Incompatible guidance is retired before rendering/scheduling; the modified active checkpoint is retained. Testing's original native regression failed on29a5bb5 and passed unchanged on the integrated1060978 production/test tree, including exact preservation of the modified checkpoint. Final independent closure belongs to the external candidate verdict.

## P7-D09 — legacy engineering explanation lacked exact qualification

P7-10/P7-11. The default engineering Markdown report header retained older wording. Decision and whole-experiment explanations already contain the required sentence, but an uninstrumented/legacy engineering report did not. Add the exact mandated qualification in its visible header without altering model arithmetic or evidence. Independent Verification concurs that the wording must be fixed before acceptance.

Fix d87eda1 integrated1060978 adds only the exact sentence to every engineering-report header. Testing's original uninstrumented/installed report assertion failed before the repair and passed unchanged after it. No numerical expectation or formula changed.

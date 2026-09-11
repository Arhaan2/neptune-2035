# Phase 7 defect queue

No defect may be waived if it affects critical correctness, evidence integrity, or accessible core workflows. Each entry records requirement ID, reported source, reproducer, owner, fix source, Testing retest and Verification semantic closure. No confirmed Phase 7 defects have yet been filed; acceptance is pending.

## P7-D01 — historical candidate inspection mixed with edited plan

P7-09/P7-11. Fixing and Testing independently reproduced on C0 production: execute transfer, edit fixture to nominal (or recovery dwell), then inspect the earlier evaluated III row. Historical labels/evidence were shown with newly planned nominal or edited recovery definitions. Testing recorded two native Chromium failures with exact planned-definition comparisons, screenshots and traces; Fixing independently recorded the fixture mismatch without page errors.

Assigned exclusively to `/root/fixing` for `src/ui/DecisionPanel.tsx` while Building continued C1/C2. Fix eccf79c, integrated6f1b0da, binds result-row inspection to the original result campaign/plan, labels stale provenance and preserves current-plan inspection only when there is no result. Fixing's typecheck/lint and existing selected-experiment browser check passed. Testing retest and independent Verification closure remain pending. No numerical expectations changed.

P7-D01 closure: Testing reran both original failing Chromium assertions unchanged on85e356d; both passed. Verification independently executed original stale-fixture inspection/load/run at6f1b0da, compared real exports and closed semantic defect in external D01-SEMANTIC-CLOSURE.md. Returned DecisionPanel ownership to Building for C3.

## P7-D02 — 375px workspace navigation obstructed

P7-13. Testing at85e356d recorded three passing Chromium C1/D01 cases and one native failure: `PH7 C1 keyboard 375px fallback exposes pump identity connections and failure without mutating view evidence`. Compare could not receive a normal click because `.twin-mode` intercepted pointer events over the workspace navigation. The original60-second timeout, screenshot and trace are retained; no force-click or exclusion is permitted.

Exclusive `src/ui/twin.css` ownership transferred from Building to Fixing. Building retains its already-written C2 appended styles locally and pauses further CSS edits during this focused repair; TS/TSX history work continues independently. Original failing reproduction must pass after integration; Verification reviews core navigation and final accessibility acceptance.

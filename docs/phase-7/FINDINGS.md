# Phase 7 defect queue

No defect may be waived if it affects critical correctness, evidence integrity, or accessible core workflows. Each entry records requirement ID, reported source, reproducer, owner, fix source, Testing retest and Verification semantic closure. No confirmed Phase 7 defects have yet been filed; acceptance is pending.

## P7-D01 — historical candidate inspection mixed with edited plan

P7-09/P7-11. Fixing and Testing independently reproduced on C0 production: execute transfer, edit fixture to nominal (or recovery dwell), then inspect the earlier evaluated III row. Historical labels/evidence were shown with newly planned nominal or edited recovery definitions. Testing recorded two native Chromium failures with exact planned-definition comparisons, screenshots and traces; Fixing independently recorded the fixture mismatch without page errors.

Assigned exclusively to `/root/fixing` for `src/ui/DecisionPanel.tsx` while Building continued C1/C2. Fix eccf79c, integrated6f1b0da, binds result-row inspection to the original result campaign/plan, labels stale provenance and preserves current-plan inspection only when there is no result. Fixing's typecheck/lint and existing selected-experiment browser check passed. Testing retest and independent Verification closure remain pending. No numerical expectations changed.

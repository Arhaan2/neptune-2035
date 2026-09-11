# Phase 5 defect queue

Only reproducible implementation defects receive defect status. Initial contract hazards are recorded in independent review receipts until confirmed against an immutable candidate.

| ID | Status | Candidate / reproduction | Repair | Independent closure |
| --- | --- | --- | --- | --- |
| PH5-T01 | FIXED-PENDING-RETEST | `8af798f` / production `5ecc557`; duplicate bundle path resource accepted instead of rejected; `tests/phase5-capacity.test.ts` malformed-input case | Fixing `176e3e0`, root `f171adc`; explicit rejection, unchanged arithmetic/tolerances | Fixing 32/32 focused plus typecheck/lint; independent Testing/Verification pending |

Allowed states: OPEN, FIXED-PENDING-RETEST, CLOSED. Testing validates regression coverage; Verification independently closes engineering findings. Root transfers affected file ownership to Fixing before repair.

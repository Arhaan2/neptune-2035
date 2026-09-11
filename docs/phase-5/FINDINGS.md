# Phase 5 defect queue

Only reproducible implementation defects receive defect status. Initial contract hazards are recorded in independent review receipts until confirmed against an immutable candidate.

| ID | Status | Candidate / reproduction | Repair | Independent closure |
| --- | --- | --- | --- | --- |
| PH5-T01 | CLOSED | `8af798f` / production `5ecc557`; duplicate bundle path resource accepted instead of rejected; `tests/phase5-capacity.test.ts` malformed-input case | Fixing `176e3e0`, root `f171adc`; explicit rejection, unchanged arithmetic/tolerances | Testing and Verification independently 32/32; reviewer source/duplicate-path probe and native before/after evidence in `VERIFICATION-SLICE-1.md` |
| PH5-T02 | OPEN | Same-owner tie/isolator/bus/network asset can falsely identify original feeder; Testing tests and reviewer probe demonstrate healthy-path isolation on unrelated network fault | Fixing receives exclusive `transfer/design.ts` lease on `bd3fab1` | Pending |
| PH5-V01 | OPEN | At source/native 60 kW and requested 30 kW, initial evaluation emits WAITING with no bundle sent to allocator; no-headroom only discovered at deadline | Dry initial headroom evaluation required before delay, then fresh closure check; no pending reservation debit | Reviewer raw probe in `verification/f171adc-probes.json`; pending repair |

Allowed states: OPEN, FIXED-PENDING-RETEST, CLOSED. Testing validates regression coverage; Verification independently closes engineering findings. Root transfers affected file ownership to Fixing before repair.

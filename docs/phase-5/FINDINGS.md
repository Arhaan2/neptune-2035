# Phase 5 defect queue

Only reproducible implementation defects receive defect status. Initial contract hazards are recorded in independent review receipts until confirmed against an immutable candidate.

| ID | Status | Candidate / reproduction | Repair | Independent closure |
| --- | --- | --- | --- | --- |
| PH5-T01 | CLOSED | `8af798f` / production `5ecc557`; duplicate bundle path resource accepted instead of rejected; `tests/phase5-capacity.test.ts` malformed-input case | Fixing `176e3e0`, root `f171adc`; explicit rejection, unchanged arithmetic/tolerances | Testing and Verification independently 32/32; reviewer source/duplicate-path probe and native before/after evidence in `VERIFICATION-SLICE-1.md` |
| PH5-T02 | CLOSED | Same-owner tie/isolator/bus/network asset can falsely identify original feeder; Testing tests and reviewer probe demonstrate healthy-path isolation on unrelated network fault | Fixing `38ab672`, root `e01edda`; distinct role/spec and actual feeder-to-isolator binding | Testing 34/34 topology and independent reviewer network-role probe rejected; integrated review receipt pending |
| PH5-V01 | CLOSED | At source/native 60 kW and requested 30 kW, initial evaluation emits WAITING with no bundle sent to allocator; no-headroom only discovered at deadline | Fixing `9ebec1e`, root `2c63099`; dry initial headroom evaluation and fresh closure check; no pending reservation debit | Testing initial eligibility/coupling 27/27; independent reviewer reran all eight native repair probes |
| PH5-T03 | OPEN | Eight accepted checkpoint corruptions in allocation watts, resource reservations/capacities/IDs, ordered paths and transition evidence; `tests/phase5-persistence.test.ts` | Fixing owns `transfer/validation.ts` and narrow shared demand extraction in `engine/simulation.ts` | Native `testing/slice-a9d15ad-persistence.json`: 21 passed / 8 failed before added boundary tests |
| PH5-V02 | OPEN | With duty failed and supported physical standby installed, a63 kW tie admits a62.080 kW estimate although complete actual load needs about63.633 kW; controller says transferred but zero nodes energize | Canonical restoration demand must account for the actual available installed pump configuration; queued after T03 | Independent actual-engine project/probes in `verification/47f9cb2-standby-project.json` and `verification/integrated-probes.json` |

Allowed states: OPEN, FIXED-PENDING-RETEST, CLOSED. Testing validates regression coverage; Verification independently closes engineering findings. Root transfers affected file ownership to Fixing before repair.

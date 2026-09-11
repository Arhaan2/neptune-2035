# Independent integrated engineering review

Reviewer `/root/verification` reviewed immutable root `47f9cb2`, tree `71241026ce274558306d68c1cd3fecdc3504f297`. The isolated review worktree merged this source and confirmed identical tree content. Actual transfer dispatch/controller/topology/validation, engine interval/event integration, model selectors, comparison report/export, UI status and active scene projection were inspected. This is intermediate engineering evidence; it does not approve release while PH5-V02 and PH5-T03 remain unresolved.

## Repairs independently closed

**PH5-T02 CLOSED.** Repair `38ab672` requires distinct switchboard roles, correct installed receiving-bus/isolator/tie catalog identities, a power original connection, and the unique direct feeder-to-isolator edge. Native before evidence had three failed same-owner alias tests; after had66 passing topology/allocation/oracle tests. The reviewer's formerly accepted same-owner network-switch alias now fails `validateDesign` with `TRANSFER_EQUIPMENT_ROLE`. This prevents the reproduced unrelated-fault isolation path.

**PH5-V01 CLOSED.** Repair `9ebec1e` performs dry atomic headroom evaluation before waiting, includes simultaneous requests and current transfers, records initial binding/headroom, and retains no pending reservation. Closure still invokes fresh allocation. Inspected raw before/after probes:4/8 before versus8/8 after, covering zero/insufficient capacity, concurrent requests, changed capacity at closure, current allocations, pending requests, permutation and zero delay. Reviewer independently reran that native script against this source:8/8. Reviewer also ran the four focused capacity/oracle/topology/engine files: **88 tests passed**, zero failures/skips/retries,2.24s. These reviewer results are separate from Testing/Fixing receipts.

## Actual coupled demonstrations and exports

Reviewer executed all eight declared comparisons directly through the actual engine:32 runs, including each architecture's faulted/unfaulted pair. Generated and inspected full comparison/project/initial-state/equipment exports, not chart-derived totals. Observations independently match the declared demonstration documentation:

| Case | II / III unmet accelerator-seconds | II / III final service |
| --- | ---: | ---: |
| Eligible |80 /19 |16 /24 |
| Receiving bus |80 /80 |16 /16 |
| Transfer disabled |80 /80 |16 /16 |
| Partial/shared donor |160 /99 |8 /16 |
| Common source |240 /240 |0 /0 |
| Tie unavailable |80 /80 |16 /16 |
| Donor unavailable |168 /168 |8 /8 |
| Representative10,248 |51,200 /51,200 |5,128 /5,128 |

All16 unfaulted runs had zero shortfall and full requested service. Eligible interruption is10s for II and2.375s for III; actual III closure/recovery onset4.375s, dwell confirmation9.375s. Both require24 accelerators with utilization0.8 and the same required network profile, environment,12s horizon and cold temperatures303.15K coolant/298.15K air; batteries are0Wh in both. Within each architecture the exported faulted/unfaulted initial-state identities match exactly. Across architectures the physical transfer hardware/topology/model differ explicitly; unchanged platform ownership and geometry-dependent hydraulic differences remain disclosed. Signed comparisons distinguish III-minus-II absolute differences from each architecture's matched fault impact.

The exported eligible included costs are USD42,930,000 and USD43,170,000: the USD240,000 difference includes six transfer assets (two each ties/isolators/buses), USD160,000 assumed hardware, plus the existing installation/contingency treatment. Added mass is2,800kg; omitted actuation/transient/tie loss/cabling/civil/commissioning/physical validation quantities are explicitly disclosed. These values characterize the intentionally sparse fixture, not an economical deployment proposal.

Source tracing and independent probes confirm active module electrical ancestry/conversion, network power and summary use changed supply paths; the network evaluator skips its obsolete nested power calculation only because actual active-path power availability is supplied separately. A required platform-network failure leaves electrically energized recipient compute with zero useful service after transfer. A second actual probe with190kW donor input and workload0.8→1 at6s sheds lower-priority platform003, preserving native platform001 and transferred platform002 at8 accelerators each. A three-platform/160-node-per-platform/zero-pump-speed600s thermal probe retains closed electrical transfer but thermal hysteresis curtails all service; recipient grid power remains22,091.311W, final bulk coolant reaches328.17342K. Electrical transfer never overrides coupled useful service.

## Open electrical accounting defect

**PH5-V02 OPEN, release blocking.** `engine/simulation.ts:125` builds restoration requirements using the duty pump unconditionally. A supported installed `pump-physical` standby consumes more power when the duty pump fails. Reproduction: sparse III reference; replace `platform-002/module-01/pump-standby` with the supported physical replacement; constrain both recipient tie edges to63,000W; trip duty at0s and original feeder at2s; run20s. Admission remains `TRANSFERRED`,62,080.096378W admitted,0W unserved, but the physical standby runs and the recipient has zero energized nodes/service. Network is operational and thermal throttle is1 (coolant302.637K, air298.187K), so this is electrical curtailment.

Independent accounting from installed ratings and observed running pump draw gives `(10,320 +27,714.086515 +3,000 +15,000 +3,000)/(0.98*0.97) +1,500/0.98 =63,632.533679W` for the full recipient bundle. A64kW comparison allows full service. The reported62,080.096378W substitutes the failed duty pump's lower demand. Required repair: assess the actual supported duty/standby operating requirement and re-evaluate it when the running pump changes; refuse/shed an indivisible bundle that cannot fit, and keep allocation/evidence consistent with actual electrical load. Do not hide the result as a generic thermal/network service limit.

**PH5-T03 remains open** in this candidate based on Testing's separately reproduced checkpoint binding failures; Fixing owns that repair. This review intentionally does not duplicate those exact corruptions. Final imported-state/ledger/transition validation will be reviewed independently on the repaired source.

The selected-asset inspector's generic `available` label for a healthy closed tie denotes equipment availability; correct switch positions/reasons are already visible in asset-linked transfer status and projected power paths. An explicit selected-switch position label would improve clarity, but the generic label alone is not classified as an unresolved electrical-topology defect.

Durable native evidence resides in the original workspace's `artifacts/phase-5-20260911/verification/`: `47f9cb2-focused-tests.log`, `47f9cb2-V01-rerun.json`, `integrated-probes.mjs`, `47f9cb2-integrated-probes.json` and log, eight `47f9cb2-*-report.json` exports, `47f9cb2-standby-project.json`, `47f9cb2-V02-accounting.json` and `47f9cb2-thermal-project.json`. Raw Fixing T02/V01 before/after evidence was read separately. No product/tests or remotes were edited; browser/CI/publication gates are not represented as reviewer-executed in this receipt.

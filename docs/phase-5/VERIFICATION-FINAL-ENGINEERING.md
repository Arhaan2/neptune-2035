# Independent final engineering review

**Engineering acceptance: approved for product candidate `d2695081951787ce4e72bd76bea9374ffffceed8`, tree `534263befe789ff18acb18833c31b58cb2dc2af4`, within the declared Phase 5 model envelope.** Reviewer `/root/verification` merged the immutable candidate into the isolated verification worktree and confirmed an identical tree before executing the checks below. All seven reproduced engineering findings are closed. Full release-wide local checks, CI, production-browser and hosted-publication evidence remain separate gates; this receipt does not claim those gates were executed or passed by this reviewer.

This review covers the actual transfer design/controller/topology/dispatch/checkpoint paths, their integration with electrical, thermal, hydraulic, storage and required-network service, and the comparison/report/export consumers. The accepted scope is the documented one-hop radial, whole-platform, native-first model with explicit isolation, normally-open ties, one non-reverting attempt per recipient per run and eighth-second transfer deadlines. Simulated, design-stage prototype; physical validation pending.

## Independently closed findings

| Finding | Inspected repair | Independent closure evidence |
| --- | --- | --- |
| PH5-T01: duplicate resource path could debit a resource twice | `176e3e0`, allocator rejects duplicate path references before allocation | Earlier reviewer 32-test slice and native duplicate-path probe; final capacity suite passes. |
| PH5-T02: same-owner non-feeder asset could masquerade as original feeder | `38ab672`, distinct installed electrical roles and unique direct original power edge | The reviewer's formerly accepted network-switch alias now rejects with `TRANSFER_EQUIPMENT_ROLE`, including on the final candidate. |
| PH5-V01: headroom was first evaluated at closure, after entering the delay | `9ebec1e`, dry atomic evaluation before waiting and fresh allocation at closure | Reviewer reran the eight native before/after scenarios: all pass after repair. The final engine tests cover initial refusal, concurrent waiting requests, changed capacity and exact closure. No pending reservation is retained. |
| PH5-T03, including semantic follow-up: checkpoint allocations/resources/history were insufficiently bound | `728bc0a` plus `f9dbfcc` | Inspected canonical current restoration/allocation recomputation, ordered paths and resource inventory/rating/native/reservation binding. Reviewer independently reproduced three residual semantic accepts before follow-up; all six selected corruption probes reject on the final candidate. |
| PH5-V02: supported replacement standby pump draw was omitted | `7ee2153` | The reviewer's original 63 kW fixture now refuses the complete 63,632.533679 W bundle instead of claiming transfer while electrically curtailing all recipient compute. Final coupling tests include the 64 kW successful case and 125/126 kW native-donor protection boundaries. |
| PH5-V03: restored module and network watts used the original conversion basis | `f655ec9` | Both independently constructed valid radial unequal-conversion directions now use the proposed donor path. Additional donor conversion requires 63,343.229209 W: 63 kW refuses and 65 kW restores eight accelerators. Additional original-recipient conversion requires 62,076.364624 W: both 63 and 65 kW restore eight. All four actual project exports were saved. |
| PH5-V04: an energized edge into the designated source concealed a loop | `b56e12c` | The exact donor-bus-to-grid loop previously validated and simulated 24 accelerators. The final `powerPath` checks enabled incoming power before terminating at `shore/grid`; the native fixture now rejects with `TRANSFER_RADIAL` before initialization. |

The checkpoint follow-up specifically rejects closure history moved before its configured deadline, forged current blocked shortfall, and a transferred state/history relabeled `ISOLATION_UNCONFIRMED`. Current admitted allocations are derived from current installed/runtime demand. Historical numerical snapshots are checked for internal consistency rather than rerunning past physical history. For an open tie, unserved load and headroom retain the last decision snapshot while requested watts and the resource ledger can refresh. The contract and UI now state that distinction. Imported evidence remains supplied evidence; validation is not an independent authentication of its entire history.

The standby repair selects viable installed duty/standby pump requirements and reserves the larger successive requirement during a duty restart; it does not invent parallel hydraulic flow. The unequal-conversion repair translates both full module and platform-network demand to the proposed donor efficiency and uses the same request at dry evaluation, closure, continuing allocation and checkpoint validation. The source guard leaves supported radial references unchanged.

## Final native execution

Reviewer ran all seven Phase 5 test files on this candidate: **152 tests passed, seven files passed, zero failures, 7.62 s**. These are independent reviewer executions of the repository's tests, separate from Testing's results. No tests, production files, timeouts, retries or tolerances were edited by the reviewer.

Reviewer also reran all eight declared comparisons through the actual engine, producing **32 runs** and eight complete comparison exports. A separate check of the native outputs passed **74 assertions**, including exact outcomes, actual exported paired initial states, cross-architecture declared controls, coupling, corruption rejection and the two conversion directions. These checks use the observed exports and independent expected numbers; they are additional evidence, not an inflated repository test count.

| Case | II / III unmet accelerator-seconds | II / III final useful accelerators |
| --- | ---: | ---: |
| Eligible feeder failure | 80 / 19 | 16 / 24 |
| Receiving bus failure | 80 / 80 | 16 / 16 |
| Transfer disabled | 80 / 80 | 16 / 16 |
| Partial/shared donor | 160 / 99 | 8 / 16 |
| Common source failure | 240 / 240 | 0 / 0 |
| Tie unavailable | 80 / 80 | 16 / 16 |
| Donor unavailable | 168 / 168 | 8 / 8 |
| Representative 10,248-accelerator campus | 51,200 / 51,200 | 5,128 / 5,128 |

All 16 unfaulted runs have zero shortfall and full requested service. Eligible interruption is 10 s for II and 2.375 s for III; actual III restoration/recovery onset is 4.375 s and five-second dwell confirmation is 9.375 s. The signed III-minus-II results are −61 accelerator-seconds and −7.625 interruption seconds. Partial restoration still violates full required service for 10 s because the second whole platform remains unserved. The representative case correctly shows no transfer benefit when the donor cannot accommodate the large bundle.

Independent coupled probes on the final candidate confirm:

- A required platform-network fault leaves the recipient electrically energized after transfer but with zero useful service.
- Increasing workload from 0.8 to 1 at 6 s under a 190 kW donor input sheds the lower-priority transferred platform. Native platform 001 and transferred platform 002 each retain eight accelerators; platform 003 is locked out with `CAPACITY_SHED`.
- The supported higher-draw standby cannot fit a 63 kW tie. It records 63,632.533679 W requested, zero admitted, and a capacity refusal.
- With 160 nodes on each of three platforms, zero pump speed and a 600 s run, electrical transfer remains closed while thermal control curtails useful service. Recipient grid draw remains positive at 22,091.310751 W. The tie does not override thermal or network limits.

## Fairness, identity and evidence interpretation

The final exported faulted/unfaulted pairs have equal actual initial physical states and initial-state identities within each architecture. Both architectures use equal declared workload, required capacity/network profile, environment, horizon, numerical step, initial-condition procedure, recovery and success criteria. The small fixture has 24 requested/provisioned accelerators, utilization 0.8, three sparse platforms and a 12 s horizon. Both have zero UPS energy and power; the cold-state temperatures and geometry-dependent hydraulics were inspected in the earlier integrated receipt and remain unchanged. Across architectures the installed topology and model identities differ explicitly.

The eligible export includes USD 42,930,000 for II and USD 43,170,000 for III. Its USD 240,000 difference includes six transfer assets and the existing installation/contingency calculation. Hardware assumptions total USD 160,000 and added mass is 2,800 kg. The report identifies the assumed reference equipment and excluded transient, protection, actuation, cabling/civil, commissioning and physical-validation scope. These are prototype reference costs, not vendor pricing or a demonstrated economical deployment.

Legacy designs retain the previous model/algorithm interpretation. Transfer designs carry `neptune-transfer-1` and `transfer-boundary-1` alongside the retained solver version, and transfer structure/policy participates in engineering identity. Reset/prepare/new experiment initialization clears physical state and transfer attempts; the worker epoch rejects stale work. Repeating the same loaded deterministic experiment can reuse its declared definition and route-local attempt identity. That is reproducible experiment identity, not a claim that every execution occurrence has a globally unique export identifier.

The exact-asset inspector's generic healthy `available` label is consistent with equipment availability; asset-linked transfer status reports actual original/tie positions, and the scene/solver use the active projection. Comparison exports contain full project/checkpoint, initial state, report, recovery, transfer and equipment evidence. UI/browser export journeys remain Testing's execution responsibility. No final hosted state is inferred from a local report.

## Durable evidence and pending release gates

Raw evidence is in the original workspace at `artifacts/phase-5-20260911/verification/`. Final-candidate files are `d269508-phase5-tests.log`, `d269508-independent-assertions.json`, `d269508-integrated-probes.mjs/json/log`, eight `d269508-*-report.json` exports, standby/thermal project exports, `d269508-checkpoint-probes.mjs/json`, `d269508-path-bidirectional-probe.mjs/json/log` with four project exports, and `d269508-source-loop-probe.mjs/json`. Earlier immutable failure evidence is retained under `47f9cb2`, `6b48634` and `6ff16b9`; successful intermediate repair evidence under `6ff16b9` and `74ead52` is also retained. Earlier reviewer receipts explain the initial independent arithmetic and T01/T02/V01 closure.

No engineering blocker remains in the reviewed bounded envelope. Release approval still requires the lead's coherent final local gate, independent production-browser/export evidence, CI result, source/public-artifact identity and rollback mapping, and hosted first-load/reload/import checks. This reviewer has made no remote mutation and has not substituted another role's report for an independently executed result. A later release-evidence review must bind those results to the final published source/artifact.

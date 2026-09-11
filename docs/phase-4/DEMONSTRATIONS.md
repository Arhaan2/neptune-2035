# Reproducible whole-experiment demonstrations

**Simulated, design-stage prototype.** These deterministic reference-model experiments do not validate physical equipment or predict training throughput. All values below come from the canonical engine; UI reports and exported Project JSON expose the same accumulated checkpoint.

## Fast public reference and counterfactual

1. Open NEPTUNE and choose **8 accelerator fast reference** in **Starting scenario**.
2. In **Whole experiment**, select **20 second network interruption**, cold start, duration20 seconds and recovery dwell5 seconds. Keep allowed unmet requirement0.
3. Select **Start whole experiment**. The run completes with **FAIL**, although final service is8 accelerators. The shore cluster core trips at evaluation5 and restores at15. Required capacity stays8; unmet requirement is `8 × 10 = 80 accelerator-seconds`, minimum service0 at5, service-violation duration10 seconds, recovery onset15 and confirmation20.
4. Open **Recorded definition, assumptions and evidence** to inspect identities, thresholds, inputs, footprint and coverage. **Export artifact → Project JSON** exports the real result. Import it or reload and choose **Recover saved checkpoint** to retain its complete report.
5. Open **Compare → Run faulted / unfaulted pair**. Each starts from an identical unfailed physical state. Only the declared core trip/restore sequence is suppressed for the baseline: absolute shortfalls80 and0, signed faulted-minus-baseline80 accelerator-seconds. The restored endpoint alone conceals the faulted interruption.

For manual execution, use **Prepare experiment for stepping**, **Step experiment 1 s**, pause/cancel or the existing play/speed controls. Settled start uses the persisted predicates and bounded warmup; a maximum warmup30 seconds demonstrates an explicit timeout, while the reference default1200 allows the model to settle. Warmup is excluded from the20-second evaluation and does not refill storage.

## Roadmap signature: similar endpoint, different interruption

Open **Compare → Run signature demonstration**. This computes both existing supported designs through real workers. Each has1,280 installed and required accelerators in one module, electrical workload1, cold start, default reference environment/policy and1-second physical timestep. The only design difference is zero versus one installed standby pump. The duty pump `platform-001/module-01/pump-duty` trips at30 seconds and restores at300; evaluation ends at1800. Its installed dependency scope is the full1,280-accelerator module in both designs, while the canonical controller/thermal response differs. This is a cross-design absolute comparison, not a claim that two different designs form a single matched counterfactual.

| Computed result | No standby pump | One standby pump |
| --- | ---: | ---: |
| Final serviceable accelerators | 1,280 | 1,280 |
| Final bulk coolant K | 302.832512133 | 302.831144359 |
| Final bulk air K | 311.564798862 | 311.658008007 |
| Observed maximum coolant K | 320.483826850 | 303.671826683 |
| Minimum serviceable accelerators | 640 | 1,280 |
| Service-violation duration s | 124 | 0 |
| First service violation s | 240 | none |
| Unmet requirement, accelerator-seconds | 79,360 | 0 |

The unprotected interruption spans `[240,364)`:640 unmet ×124 seconds. Final coolant differs by less than0.01 K and air by less than0.1 K, yet accumulated service impact differs materially. These are declared demonstration comparisons, not physical accuracy tolerances. Numerical fixture assertions use1e-6 K where exact observed extrema are checked. Retained trace detail is explicitly truncated at this duration; authoritative aggregates still include every accepted interval. Each comparison card can **Export reproducible run** with its complete definition, physical state and accumulated evidence.

## Measured execution envelope

Independent Testing measured these observations on macOS arm64, Node24.18.0/npm11.16.0, unchanged lockfile. They are observations, not latency or memory guarantees. Memory values are process snapshots and cumulative process maximum RSS, not isolated peak allocations.

| Scenario | Modules | Simulated duration | Wall time | RSS before → after | Process max RSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1,280, no standby | 1 | 1,800 s | 95.42 ms | 86,933,504 → 98,287,616 B | 95,984 KiB |
| 1,280, one standby | 1 | 1,800 s | 76.48 ms | 98,304,000 → 101,007,360 B | 98,640 KiB |
| 100,000, scalable rooted network | 79 | 20 s | 454.64 ms | 125,878,272 → 300,974,080 B | 293,920 KiB |

The100,000 case uses the existing scalable reference network and declared1 GW supply so the fixture measures the network interruption without baseline power shortfall. Core trip5/restore15 produces1,000,000 accelerator-seconds and final100,000 serviceable. The runner retains existing work/time limits and can report incomplete resource-limited runs; a30-day serialization bound does not promise that all campus/horizon combinations complete interactively. Existing500,000 mandatory coverage remains separate. Previously deferred Phase1 stress gates remain deferred.

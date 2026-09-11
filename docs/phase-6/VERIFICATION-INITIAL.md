# Phase 6 independent initial engineering review

Reviewer: `/root/verification`; isolated worktree `/private/tmp/neptune-phase6-verification`, branch `codex/neptune-phase6-verification`. Reviewed accepted baseline `42a03e171f1d722874328b54fbdb2d3520ff3cc6`, tree `ef6fafe7d75f7cf5b4fdce9cc0d75c3df8105c2a`. Only this review document was authored in source; independent probes and native outputs remain outside source. No production implementation was authored or independently approved by its author.

The bounded decision contract in Building's `ee40a702754478363bb7062bebf27d6b232eefcd` is suitable to proceed to ranking implementation with the clarifications below. This is contract review and baseline reproduction, not acceptance of an unexecuted Phase 6 implementation or a release.

## Contract review

Reviewed Phase 4 whole-run metrics/recovery/initialization, Phase 5 whole-platform transfer and shared-resource accounting, authoritative cost/specification records, existing sizing entry points, thermal resistance and upstream supply accounting. Reviewed Testing's pre-ranking matrix `ce334b0` and Building's decision types, candidate menu and validator.

- The named strict policy uses **total** service interruption (`serviceViolationS`) <=3 s. Longest contiguous interruption remains separately exported. An initial draft proposed longest interruption; Building aligned its schema and contract with Testing before ranking.
- Confirmed recovery must use absolute evaluation-time confirmation after the five-second dwell; onset and event-relative latency remain distinct evidence. The Phase 5 zero-outage result remains FAIL when Phase 6's explicit allowance passes.
- The 120 kW operating ceiling is separate from the installed 30 MW source and full installed-peak path screens. Peak supply must observe every actual interval dispatch and initialized/post-event boundary, including root/platform networking. Summing only module `gridW` omits that network draw. Endpoint or downsampled trace maxima cannot satisfy this requirement.
- The authoritative included cost order is equipment, 20% installation, then 25% contingency on equipment plus installation. Upper cost uses the campaign's declared central basis times 1.5 once. Building confirmed that applying the upper budget to the cost-upper sensitivity remains 1.5 times original central, never 2.25 times central. Central-estimate budget uses the active sensitivity cost. This clarification is to be retained in contract documentation and tested in ranking.
- Idle, clean UA, fouling and equipment cost are actual supported inputs. The frozen clean lower-fouling case equals central and adds no independent evidence; UA and fouling overlap through effective conductance. Cold 120-second observations do not establish equilibrium or long-term thermal adequacy.
- Existing endpoint-based `runSizing` recommendation in `TwinApp` must be superseded by the whole-run decision workflow to avoid conflicting recommendations. Existing model and equipment calculations remain authoritative.

## Independently executed baseline evidence

Fresh dependency installation succeeded. The reviewer executed the four native declared comparisons, comprising **16 real-engine runs**, and **68 independent assertions**. These are separate from Testing's repository test counts.

| Case | II / III total unmet accelerator-s | II / III total interruption s | Relevant result |
| --- | ---: | ---: | --- |
| Eligible feeder | 80 / 19 | 10 / 2.375 | III onset 4.375 s, dwell confirmation 9.375 s |
| Receiving bus | 80 / 80 | 10 / 10 | No transfer benefit |
| Common source | 240 / 240 | 10 / 10 | No independent source |
| Partial shared donor | 160 / 99 | 10 / 10 | One whole recipient admitted, second refused |

All eight unfaulted runs have zero unmet demand. All faulted runs preserve the original Phase 5 FAIL policy result. Faulted/baseline actual physical initial states are equal within each architecture; every run completed the full 12-second observation and had zero observed thermal-limit duration.

The shared donor resource has 140,000 W capacity, 62,076.36462446924 W protected native draw and 62,076.36462446924 W admitted whole-bundle draw. Independent subtraction gives 15,847.270751061507 W remaining. The second bundle requests 62,080.11592842924 W, remains blocked for insufficient headroom and is admitted at zero watts. Unavailable capacity is not spent.

Included costs independently reproduced USD 42,930,000 for II and USD 43,170,000 for III. The USD 240,000 premium agrees with USD 160,000 added equipment, installation and contingency in the declared order. The existing range upper endpoint is exactly 1.5 times included central cost. These are assumed included costs, not vendor prices or total ownership costs.

## Independent sizing and thermal oracle before production ranking

The reviewer constructed all six integer candidates using existing design/catalog/network APIs and ran each through the canonical physical engine for a cold 120-second nominal observation. The oracle used Phase 4 whole-run evidence, every one-second boundary and actual one-second upstream grid-energy increments; it did **not** use any Phase 6 production ranking or constraint evaluator. All six pass the existing full-peak electrical, geometry and installed-network screens and provide full requested useful service with zero observed thermal violation.

| Requested accelerators | Maximum observed upstream W | Signed margin to 120,000 W | Independently feasible |
| ---: | ---: | ---: | --- |
| 8 | 70,080.115928 | 49,919.884072 | Yes |
| 16 | 80,936.415605 | 39,063.584395 | Yes |
| 24 | 91,792.715282 | 28,207.284718 | Yes |
| 32 | 102,649.014958 | 17,350.985042 | Yes |
| 40 | 113,505.311811 | 6,494.688189 | Yes |
| 48 | 124,361.611487 | -4,361.611487 | No |

The independent feasible set is {8,16,24,32,40}; descending requested-workload ranking gives 40. The ceiling and candidate menu were declared by Building before these observations were communicated. No inference is made about unevaluated sizes. The final implementation must reproduce the set and boundary using its exported candidate definitions and actual dispatch peak accumulator. Energy subtraction can introduce sub-microwatt numerical differences; comparison will use the declared 1e-6 W tolerance.

Separately checked six UA/fouling combinations against independent `UA_effective = 1 / (1 / UA_clean + R_fouling)` arithmetic. The supported exchanger agrees. This confirms overlapping model parameters, not independent statistical robustness or physical validation.

## Evidence, limits and handoff

Native evidence directory: `/private/tmp/neptune-phase6-evidence/verification/`. Files include `npm-ci.log`, `baseline-probe.mjs`, four complete `baseline-*-report.json` exports, `baseline-summary.json`, clean `baseline-final.log`, `sizing-oracle.mjs/json`, and clean `sizing-final.log`.

First middleware-only probe emitted an unnecessary sandbox WebSocket `EPERM` diagnostic but still completed its arithmetic assertions. A subsequent independent-harness configuration exposed dependency scanning without UI aliases. Both logs are retained (`baseline-probe.log`, `baseline-probe-clean.log`, `sizing-oracle.log`). Explicitly disabling the unused websocket and dependency discovery produced clean final executions; no application, test assertion, timeout or tolerance was changed.

This reviewer has not run the eventual Phase 6 worker/UI/import/recompute implementation, release-wide gate, CI or hosted acceptance. Later independent review must bind reproduction and constraint oracles to the exact integrated candidate/source tree, retest reproduced repairs, and attest the release evidence. Current review identity and native state are preserved while the fourth active slot rotates to distinct Fixing. Simulated, design-stage prototype; physical validation pending.

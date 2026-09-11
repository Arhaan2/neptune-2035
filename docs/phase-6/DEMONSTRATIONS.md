# Phase 6 executed bounded demonstrations

Simulated, design-stage prototype; physical validation pending.

The repository `decision:reproduce` command executed all eight fixtures below from isolated source `a324447` on 2026-09-11. Every command completed. Raw portable campaigns, readable reports, command logs and machine receipts are retained outside the frozen source tree. These deterministic results validate software behavior against the declared Phase 6 policies; they do not validate engineering requirements or physical equipment.

| Fixture / policy | Completed runs | Evaluated result |
| --- | ---: | --- |
| A eligible feeder, fixed 24 accelerators | 6/6 | III enabled is the only feasible candidate; II and III policy-disabled fail the operating requirements. |
| B adds receiving-bus failure | 9/9 | No feasible candidate; II/III bus-fault loss is 80/80 accelerator-s. |
| B adds common-source failure | 9/9 | No feasible candidate; II/III source-fault loss is 240/240 accelerator-s. |
| C nominal-only fixed workload | 3/3 | II is lowest included cost; all three pass this narrower suite. This is not a fault-resilience recommendation. |
| D six integer capacities under 120,000 W | 12/12 | 40 is largest passing evaluated workload; 48 exceeds the measured upstream ceiling. |
| E central plus eight OFAT assumptions | 81/81 | III enabled remains the only feasible candidate in all nine tested cases; no joint-case or statistical robustness claim. |
| E plus USD 50m central budget | 81/81 | III passes centrally but no candidate passes the cost-upper case; preferred/feasible sets change. |
| E plus USD 50m upper-bound budget | 81/81 | No candidate passes the budget in any tested case. The upper bound is applied once, not squared. |

A retains the reference 24 accelerators over three whole platforms, no UPS, required network, utilization 0.8, seawater 291.15 K, cold start, fault t=2 s, 12-second observation, 2.375-second transfer delay and 5-second continuous recovery dwell. III has 19 unmet accelerator-s, 2.375 seconds total/longest interruption and recovery confirmation at absolute t=9.375 s (onset 4.375 s). Margins are 5 accelerator-s, 0.625 seconds interruption and 0.625 seconds confirmation deadline; thermal violation duration is zero. II and disabled III have 80 accelerator-s loss, 10 seconds interruption and no confirmed recovery. Their numerical executions correctly completed; infeasibility is a separate assessment. All retain the original Phase 5 zero-outage FAIL outcome.

Included costs are USD 42,930,000 for II and USD 43,170,000 for III or disabled III: the USD 240,000 included premium is USD 160,000 installed switching equipment, 20% installation and 25% contingency on equipment plus installation. The USD 50m budget fixture was documented before its execution. III central has USD 6,830,000 budget margin; its declared upper amount is USD 64,755,000, a negative USD 14,755,000 margin. Unknown prices are never zero; included cost excludes ownership and construction-quote scope.

D uses the supported default packing and required scalable reference network; it is a separate capacity menu from the three-platform transfer fixture. Every candidate serves its full requested useful workload in the nominal12 s and cold thermal120 s cases and passes the installed peak/path, geometry and network screens. The separate installed source rating is 30 MW.

| Requested accelerators | Whole-run maximum upstream W | Signed margin to 120,000 W | Feasible |
| ---: | ---: | ---: | --- |
| 8 | 70,080.115928 | 49,919.884072 | Yes |
| 16 | 80,936.415605 | 39,063.584395 | Yes |
| 24 | 91,792.715282 | 28,207.284718 | Yes |
| 32 | 102,649.014958 | 17,350.985042 | Yes |
| 40 | 113,505.311811 | 6,494.688189 | Yes |
| 48 | 124,361.611487 | -4,361.611487 | No |

The maximum includes every canonical physical dispatch interval/boundary and modeled conversion, cooling, network and standby loads. Curtailment is not used to pass the ceiling. There is no inference about unevaluated capacities. The independent Verification oracle enumerated the same six sizes using upstream energy/dispatch accounting without production decision ranking.

E evaluates the entire corresponding suite for each candidate/assumption. Idle draw, clean UA and fouling use existing model inputs; equipment cost uses existing economics. Clean lower fouling duplicates central, and UA/fouling overlap through effective conductance. All 27 thermal cases retain their actual cold initial states and 120-second observations; no settling policy was requested and no long-term thermal adequacy is claimed.

F is tested through actual browser export/import/refresh/worker recomputation, explicit candidate load, cancellation, input staleness, and a clean-checkout repository command. Final exact-source/native counts and command reproduction receipts are release evidence, not inferred from this preliminary demonstration table. The unchanged Phase 5 partial/shared-donor regression retains 160/99 accelerator-s and native-first whole-bundle resource refusal.

See [contract](CONTRACT.md), [requirement matrix](REQUIREMENT-MATRIX.md) and [reproduction commands](REPRODUCTION.md). Marine stability, permitting, environmental consequences, protection coordination, excluded costs and physical validation remain unassessed.

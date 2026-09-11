# Independent Phase 3 review

## Initial checkpoint — baseline and contract

**Verdict: BLOCKED for release; initial contract review complete.** There is no integrated Phase 3 candidate or Phase 3 release evidence yet. This verdict does not describe a rejected implementation: the required implementation, acceptance tests, exact-tree review, CI and public verification remain to be supplied.

This review is by the distinct Independent Verification agent (`/root/verification`) in isolated branch `codex/neptune-phase-3-verification`, worktree `/private/tmp/neptune-phase3-verification`. Production code and publication are outside this agent's write ownership. Root, Building, Testing and Verification ran concurrently during this assignment; the actual runtime maximum is four active agents including root. This checkpoint completes the bounded initial assignment so the distinct Fixing role can use the released slot. Verification must return for integrated and final candidate acceptance.

### Inspected baseline

- Source: `a6ad26c05d50ebab72d782dbcb3bde05da188b21`.
- Source tree: `6d392e586ce57d5cb21bccb8ef812199d58cd45e`.
- Local fetched `origin/main`: same source SHA at inspection.
- Local fetched `origin/codex/pages`: `388f215105be0a907947f2be0e8e8e26e2428904`.
- Preview subtree: `531d00a67da4c1f2f02a22bf249d93e683b2601b`.
- Older rollback retained: `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5`.
- Baseline Pages marker records the same source/tree and lock SHA-256 `87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9`.

These observations are repository-state evidence, not a fresh public deployment attestation. Root must recapture the actual Pages head immediately before publication and check for intervening deployments before any rollback.

Read accepted equipment authority, design expansion, network evaluator, simulation/electrical coupling, design/project validation and compatibility, report/inventory/cost consumers, browser configuration, workflow and existing artifact packager. The original network evaluator compiles shared edge/port resources and enforces deterministic rooted paths. It does not enforce `ratings.capacityBitS` as an internal switching budget. Current persisted workload is the immutable literal `illustrative-job-traffic-v1`. Equipment/network profile/topology participate in engineering identity; prices are separate. Compatibility depends on model, algorithm and solver versions, so a version bump requires explicit preservation of old fingerprint semantics for inspectable checkpoints.

### Independent capacity reproduction

The verifier created and ran its own ephemeral Vitest fixture, separate from Testing's fixtures. Each case uses `buildDesign` on the exact baseline and directly supplies every module's full `nodeCount` to `assessNetwork`; it never uses power allocation to choose the tested node count. Required external networking is enabled to verify its arithmetic as well. Independent expectations are `ceil(requested / 8)` nodes, `nodes × 100,000,000` bit/s cluster and `nodes × 1,000,000` bit/s external.

| Requested accelerators | Nodes | Cluster Gbit/s | External Gbit/s | Legacy result |
| ---: | ---: | ---: | ---: | --- |
| 8 | 1 | 0.1 | 0.001 | satisfied |
| 10,000 | 1,250 | 125 | 1.25 | satisfied |
| 31,992 | 3,999 | 399.9 | 3.999 | satisfied |
| 31,999 | 4,000 | 400 | 4 | satisfied |
| 32,000 | 4,000 | 400 | 4 | satisfied |
| 32,001 | 4,001 | 400.1 | 4.001 | violated |
| 32,008 | 4,001 | 400.1 | 4.001 | violated |
| 100,000 | 12,500 | 1,250 | 12.5 | violated |

The sole overloaded resource in the last three cases is `port:shore/cluster-core:cluster-out`, capacity `400,000,000,000` bit/s. The two 4,001-node cases affect seven platform domains; the campus affects all twenty. External demand does not traverse the original cluster core, so it does not move this legacy boundary.

A separate independent baseline fixture changed only `shore/cluster-core.ratings.capacityBitS` to 1 bit/s. The 125 Gbit/s pilot remained `satisfied`, confirming that the old internal rating is not an enforced shared budget and cannot be relied on as one in new topology.

Command: `npm test -- tests/phase3-verifier-baseline.test.ts --reporter=verbose --reporter=json --outputFile=/private/tmp/neptune-verifier-baseline-results.json`. Result: **1 file, 2 tests passed**, eight arithmetic cases plus the absent-budget case. Node `v24.18.0`; dependencies reused read-only from the baseline workspace. The ephemeral fixture and local raw result are not committed; these are initial baseline tests, not full acceptance or telemetry evidence. The first invocation completed but its asynchronous output was not retained, so the evidence invocation repeated the same fixture with a JSON reporter; there was no failing assertion or retry-to-green repair.

### Proposed contract review

Root's contract commit `d39010f8b13be0675f6a876a11735db999d7b5c9` introduces immutable `illustrative-job-traffic-v2`, deterministic rooted source-to-node direction, platform job-domain grouping, once-per-switch/class accounting, explicit assumptions and units; numerical identities become solver `2.3.0` and model `neptune-reference-3`. Structural project/state schemas remain 3 and design schema remains 2. The optional explicit `equipment.networkDesign` distinguishes new architecture from legacy absence.

The agreed fixed synthetic architecture is adequate in principle for the requested envelope:

- Fixed 8/32/256-output core tiers, each actual output 400 Gbit/s, shared internal budgets 3.2/12.8/25.6 Tbit/s; smallest tier covering platform count is selected.
- One platform switch per platform, four actual 400 Gbit/s outputs and a 400 Gbit/s shared budget.
- One module switch per module, forty actual 400 Gbit/s outputs and a 400 Gbit/s shared budget.
- External fiber enters the core before the common downstream cluster paths. New shared budgets and downstream links therefore consume the sum of required cluster and external classes.
- Deliberately undersized core has fixed 256 output ports but only a 400 Gbit/s shared budget. Legacy designs retain their original single shared output port and original external route.

For 100,000 accelerators: 12,500 nodes, 79 modules and 20 platforms select the fixed 32-output core. Combined core load is 1.2625 Tbit/s, below 12.8 Tbit/s. A full platform carries 64.64 Gbit/s; a full module 16.16 Gbit/s; a full rack 0.404 Gbit/s. These are independent reference calculations, not a claim the implementation has passed. At the admitted million-accelerator limit, 125,000 nodes require 196 platforms and 12.625 Tbit/s combined, fitting the 256-output / 25.6 Tbit/s core. A complete implementation must verify every individual required resource as well.

The new undersized core reaches its limit earlier when external traffic is required: 3,960 nodes offer 399.96 Gbit/s combined; 3,961 offer 400.061 Gbit/s. The original 4,000-node / 400 Gbit/s fixture remains a legacy-topology or cluster-only fixture. UI and evidence must distinguish these interpretations.

### Acceptance conditions communicated to Building, Testing and root

1. Charge each traversed switch once per class, including originated core traffic; do not count ingress and egress twice. Combine only physically shared classes/resources. Ports and links remain separate constraints.
2. Preserve literal v1 profile content, absent-networkDesign topology and legacy engineering fingerprint inputs/constants. A Phase 2 checkpoint must remain inspectable after the global version bump; explicit derivation must preserve original records and reject invalid event/telemetry mappings.
3. Keep nominal full-installed demand separate from energized instantaneous demand. Zero supply or an idle campus cannot advertise nominal provisioning success from zero offered traffic.
4. Enforce finite nonnegative ratings and supported graph structure even for zero traffic/dormant paths as required by the declared boundary. Unsupported/malformed graph results cannot disappear behind an early zero-node return.
5. Catalog fixed equipment must drive actual topology, worker solver inputs, power dispatch/dependency failures, cost, mass/location, dimensions where known, inspector and exports. Shore mass must stay outside floating mass; unknown contributions must remain explicit. Itemized network cost must replace or clearly partition the bundled allowance.
6. Local cuts must isolate only unrelated downstream domains where paths provide that isolation. Shared core, upstream power and fiber retain their actual common-mode dependencies. Restore must recover the same path, with no invented rerouting or fractional training throughput.
7. Existing URL/sharing paths must preserve supported Phase 3 settings or visibly explain their limits, in addition to full project JSON import/export/reload coverage.
8. Test every selectable scale tier or declare a clear supported envelope. Fixed port inventory, including the 256-port tier, must survive structural validators and admission limits.
9. Preserve original prototype and Phase 2 browser smoke, pump replacements/history, price-only complete checkpoint and observation preservation, real worker and both real telemetry integrations.
10. Exact candidate acceptance requires CI's actual tested source tree, merge-tree equality or verification of differences, truthful marker/manifest identities, preserved preview bytes, successful Pages workflow and public hosted journeys. A local pass cannot authorize a `DEPLOYED AND LIVE-VERIFIED` verdict by itself.

### Testing matrix adequacy

Reviewed Testing's initial `docs/phase-3/REQUIREMENT-TEST-MATRIX.md` in its isolated worktree. It covers capacity/boundaries, budgets/paths/classes, ordering, invalid values, failures/dependencies, identity/compatibility, economics/history, projections, browsers, telemetry and release parity. **Adequate as a requirement-derived plan**, with explicit additions requested for malformed graphs at zero offered load, old Phase 2 schema-3 fingerprint compatibility, URL-share limitations, all larger selectable tiers, installed-versus-instantaneous assessment and core originated-plus-transit once-only charging. A listed test is not execution evidence.

Repository acceptance commands remain `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and relevant `npm run test:browser` journeys. Real telemetry requires both `NEPTUNE_TELEMETRY_BROWSER=1` and `NEPTUNE_TELEMETRY_APP=1` plus the running app. Browser acceptance uses the established Chromium/Firefox/WebKit configuration and zero retries; the only two historical exclusions are the original 500,000-accelerator prototype campus test on Chromium and WebKit. Firefox must still actually advance its clock ten seconds. The new Phase 3 browser file must be added to the workflow's explicit file list.

## Integrated candidate and release review

Pending. Record exact candidate SHA/tree, lock identity, substantive independent findings and their fixes, actual evidence counts/exclusions, CI/tree correspondence and public artifact/preview verification here when Verification resumes. Do not infer final acceptance from this initial checkpoint.

## Integrated engineering checkpoint

**Engineering review: PASS. Release acceptance: BLOCKED pending full local gates, CI, merge/artifact correspondence and public hosted verification.** No release-blocking production defect was found in this integrated review. This is an exact-tree engineering milestone, not a claim of deployment.

Reviewed candidate: `42410fa269ff982e66f7eb1bfd352ae2427f7501`, tree `17f7bfc0bbdc99494c7818407950ac9d336e0378`. Versions: solver `2.3.0`, model `neptune-reference-3`, algorithm `committed-boundary-1`, design schema 2, project/state schema 3. The verifier inspected complete production paths and the implemented acceptance matrix/suites. This candidate retains the independently exercised engineering implementation from `0168a2f31431ae62726c1f6ba72ac7103cdc2437`, tree `077d8d604734a70356251129316017d458288f8b`; the inspected intervening changes display the exact shared-resource ID and correct the malformed-port test to require structured `invalid-input` using lint-supported `.toThrow`. They do not change capacity, power or persistence semantics.

### Separate verifier fixtures and results

The verifier independently authored an ephemeral four-test fixture and ran it on `0168a2f`, separate from Testing's acceptance fixtures. Command: `npm test -- tests/phase3-verifier-candidate.test.ts --reporter=verbose --reporter=json --outputFile=/private/tmp/neptune-verifier-candidate-results.json`. **1 file, 4 tests passed, 7.23 seconds, no failures or retries.** Ephemeral test source and raw results remain local and are not part of the production candidate. The subsequent displayed-resource/test-assertion-only diff was reviewed without repeating the large fixture.

1. Independently calculated every installed switch's descendant-node load and every root-to-platform link load at 8, 10,000, 100,000 and 1,000,000 requested accelerators. All switches charge `descendant nodes × 101,000,000` bit/s exactly once with both classes required. All headrooms equal rating minus demand and are nonnegative. Small/pilot use core-8; campus uses core-32 with 100 installed switches total; the maximum uses core-256 with 979 installed switches total. The final tier's 258 physical ports are 256 downstream, one external input and one power input, rather than 258 downstream capacity sources.
2. Reproduced the combined undersized boundary: 3,960 nodes / 399.96 Gbit/s satisfies; 3,961 / 400.061 Gbit/s violates only `switch:shore/cluster-core`. Campus 12,500 nodes / 1.2625 Tbit/s violates that same 400 Gbit/s budget across all 20 domains. Disabling one campus uplink affects exactly its platform domain; restoring the same link satisfies. A shared-core trip affects all 20; a local generation-II power-domain trip affects only its associated network domain.
3. Reconciled actual campus electrical and financial consequences: core 20,000 W plus twenty platform switches at 1,500 W through 98% conversion draws **50,612.24489795917 W** from the grid. Seventy-nine module switches add **237,000 W** to their existing critical buses. The independent one-second simulation accounts for root/platform grid energy and reports all 12,500 nodes energized / 100,000 accelerators accessible. Included network equipment is **USD 2,430,000**: core 350,000 + platforms 500,000 + modules 1,580,000. The legacy Networking allowance is absent from that bill. Inventory identifies `network-core-32`; marine aggregation retains twenty offshore platforms and excludes the shore core.
4. Parsed the authentic Phase 2 schema-3 checkpoint and independently matched its original saved engineering identity. It remains inspection-only with an explicit derivation retaining original topology, profile, events and record. New Phase 3 project roundtrip restores exact design/checkpoint; economics-only changes preserve the full physical checkpoint.

### Static integration assessment

- Switching is charged on egress so source-originated and external-transit demand share the core budget without charging ingress twice. Output ports are finite and individually assigned. The solver compiles topology once per evaluator; simulation uses compact resource output while inspector/provisioning receive the full resource list.
- Dormant malformed ports and duplicate ports are rejected; connected/disconnected cycles and ambiguous parents affecting required domains remain unsupported even at zero allocation. Valid zero-load disconnection remains distinct from full-inventory connectivity failure. Final test assertion corrections preserve this distinction.
- Root/platform power loads are served in deterministic priority before module/charging allocations, account for shared edges/ports and conversion, subtract from common and local supply envelopes, and expose actual dependencies. Module switch draw uses its existing critical bus and bulk thermal boundary. Root/platform thermal consequences are explicitly outside that boundary.
- Catalog immutable ratings, dimensions, operational mass, ports and version resolve into generated/persisted assets, validation, worker, solver, normal inspector, inventory and engineering report. Unknown network prices remain missing through new revisions, with an incomplete subtotal instead of a complete cost claim. Shore mass stays outside floating-platform calculations.
- Immutable v1 workload and original topology survive absence of `networkDesign`; old engineering fingerprint uses its original model/solver constants. New v2 profile and architecture participate in identity. Unsupported versions are rejected. UI saves the preceding experiment before changing network/link/configuration, resets the new run explicitly and retains price-only physical state. The ordinary panel discloses that full sharing requires Project JSON and Legacy URL links carry only Legacy v0.1 settings.
- The implemented Testing matrix includes the requested additions. Browser code observes actual workers, exported committed checkpoints, clock advancement, old-run history, core trip/restore, link disable/enable, import/reload recovery, mobile overflow and keyboard/fallback. All three engines execute the ordinary 32,008-accelerator Phase 3 journey; Firefox additionally executes the 100,000 campus. CI's actual command now includes `phase3.spec.ts` beside prototype and Phase 2. This code review does not claim those final runs passed before their output is available.

### Remaining final acceptance evidence

Testing's complete lockfile-install/typecheck/lint/unit-plus-both-real-telemetry/build/production-browser results are still in progress at this checkpoint. Record the final candidate/tested tree, CI result and actual CI tree, post-merge tree, package/manifest identities, captured pre-publication Pages rollback head, successful Pages workflow, byte-preserved preview and live hosted journeys before replacing the release-level BLOCKED verdict. The preexisting two non-Firefox 500,000-accelerator prototype exclusions remain; no new Phase 3 exclusion is accepted.

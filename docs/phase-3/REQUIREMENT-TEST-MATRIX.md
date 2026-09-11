# Phase 3 requirement-to-test matrix

Testing agent owns this matrix. The independent verifier reviews the integrated candidate and its adequacy. Expectations below were derived from the request and accepted Phase 2 contract before examining Phase 3 outputs.

## Baseline and execution

- Starting source: `a6ad26c05d50ebab72d782dbcb3bde05da188b21`, current `origin/main` at worktree creation.
- Tests run in isolated `codex/neptune-phase-3-testing` worktree; production changes belong to Building/Fixing and are integrated by root.
- Repository commands: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:browser`.
- Real telemetry requires **both** `NEPTUNE_TELEMETRY_BROWSER=1` and `NEPTUNE_TELEMETRY_APP=1` and an actual app listening on port 5173. An ordinary unit run skips those two integrations and is not full acceptance.
- Browser projects are Chromium, Firefox, WebKit, one worker, no acceptance retries. Linux CI uses Xvfb/Mesa and Firefox software compositor. macOS uses its configured Metal Chromium adapter.
- Existing exclusions are only the prototype **500,000 accelerator** campus Step 10s case on Chromium and WebKit. Firefox runs it. No Phase 3 ordinary journey inherits those exclusions.
- CI must execute `tests/browser/phase3.spec.ts` alongside the existing explicitly listed prototype and Phase 2 suites.

## Independent fixture contract

Capacity-only tests directly allocate every provisioned node as energized. They do not use electrical dispatch or thermal state to determine available nodes.

| Requested accelerators | Provisioned nodes | Cluster offered bit/s | Legacy 400 Gbit/s expected |
| ---: | ---: | ---: | --- |
| 8 | 1 | 100,000,000 | Satisfied |
| 10,000 | 1,250 | 125,000,000,000 | Satisfied |
| 31,992 | 3,999 | 399,900,000,000 | Satisfied |
| 31,999 | 4,000 | 400,000,000,000 | Satisfied |
| 32,000 | 4,000 | 400,000,000,000 | Satisfied |
| 32,001 | 4,001 | 400,100,000,000 | Violated |
| 32,008 | 4,001 | 400,100,000,000 | Violated |
| 100,000 | 12,500 | 1,250,000,000,000 | Violated |

At 100,000 accelerators, required external demand is independently 12,500,000,000 bit/s. Original limiting resource is `port:shore/cluster-core:cluster-out`, 400,000,000,000 bit/s. Phase 2 designs must retain this meaning after Phase 3 implementation.

## Acceptance coverage

| Requirement | Test/evidence | Acceptance expectation |
| --- | --- | --- |
| Original boundary, partial nodes, campus arithmetic | `tests/phase3-network.test.ts`, independent legacy capacity baseline | Exact table above, actual limiting resource, no electrical masking |
| Small/default/campus nominal; deliberately undersized | Phase 3 topology fixtures and browser journey | Every traversed resource adequate for installed nominal demand; undersized fails intended network reason |
| Larger selectable presets and idle campus | Phase 3 preset/envelope and zero-supply fixtures | All selectable sizes choose finite catalog equipment or disclose an explicit supported limit; installed-demand assessment remains distinct from actual energized demand |
| Aggregate capacity cannot hide an individual path overload | Phase 3 path fixture | Local domain blocked, unrelated domain admitted |
| Port capacity cannot substitute for shared internal budget | Phase 3 shared-budget fixtures | Insufficient shared budget fails; adequate ports and budget pass |
| Mixed cluster/external resource accounting | `phase3-network.test.ts` mixed classes, Phase 3 shared-budget fixture | 101 Mbit/s on one-node shared path, no doubled traversal |
| Deterministic supported paths | Phase 3 ordering fixture | Equivalent asset/connection order preserves loads, capacities, domains, status |
| Unsupported/malformed/invalid numerical input | `phase3-network.test.ts`, existing `twin-network`/safety tests plus Phase 3 graph fixtures | Unsupported routing separate from unreachable and undersized; invalid numbers rejected |
| Zero traffic/capacity | `phase3-network.test.ts` | Zero demand has finite 0 utilization; positive load/zero capacity uses explicit null ratio and bottleneck |
| Zero traffic with invalid/unsupported topology | Phase 3 dormant-graph fixtures | Zero allocations must not hide malformed graph or unsupported routing |
| Local link disable/enable | Phase 3 failure fixture and browser journey | Local downstream impact and exact restoration, no invented rerouting |
| Shared asset/power/upstream failures | Phase 3 dependency fixtures | Correct downstream/common-mode effects; isolated domains only where actual topology supports them |
| Workload identity/version/semantics/provenance | Phase 3 persistence fixture and browser inspector | Saved assumptions retained; illustrative, eight accelerators/node, declared units/classes/grouping/direction |
| Real worker consumes design/profile | Phase 3 browser exported worker checkpoint | Actual Worker observed, changed network state reflected in run and report |
| Export/import/reload and mappings | Phase 3 persistence fixtures/browser journey | Full supported topology/profile/version and checkpoint preserved; invalid mappings rejected explicitly |
| Revision and compatible replay | Phase 3 persistence fixture | Engineering changes produce new identity/run and preserve original experiment; old checkpoint cannot transplant |
| Phase 2 compatibility | Existing Phase 2 suites + Phase 3 legacy fixture | No silent topology/profile upgrade; original records inspectable/replayable under declared contract |
| Authentic Phase 2 schema3 network checkpoint | `tests/fixtures/phase-3/phase2-schema3-network-checkpoint.json`, Phase 3 persistence fixture | Captured under untouched `a6ad26c` solver 2.2.0; original engineering fingerprint/records retained with inspection and explicit derivation |
| Existing URL sharing | Phase 3 browser sharing assertion | Full supported topology/profile retained or visible limitation before copying; no silent default substitution |
| Economics-only physical-state preservation | Existing Phase 2 unit/browser tests + Phase 3 integration | Exact checkpoint and observations unchanged |
| Pump replacement/history | Existing `phase2-*` unit suites and browser suite | Accepted propagation and saved history unchanged |
| Inventory/report/geometry/cost/supply consequences | Phase 3 projection/dependency fixture | Declared equipment identity/rating/mass/envelope/cost/power agree; shore mass excluded offshore; allowance reconciled |
| Three-engine nominal/undersized/inspection/save | `tests/browser/phase3.spec.ts` | Chromium, Firefox, WebKit ordinary journey with no exclusions |
| Real 100,000 accelerator journey | Phase 3 Firefox browser case | Nominal/undersized capacities and real worker state observed |
| Firefox existing campus Step 10s | `tests/browser/prototype.spec.ts` | Actual simulation `data-time` advances 10 s at existing 500k scale |
| Desktop/mobile/keyboard/fallback/qualifier | Phase 3 ordinary/fallback journeys + existing smoke | Usable controls, no horizontal overflow, no WebGL canvas in fallback, visible concept qualifier |
| Application/console/asset errors | Browser observers in all suites | No new application, console or loading errors |
| Real telemetry production adapter and app streaming | `tests/twin-telemetry.test.ts` with both flags | Both actual integrations execute and pass, zero skipped telemetry integrations |
| Release candidate and hosted parity | Root release record + independent verifier | Exact source tree, CI tested tree and artifact match; live journey; preserved preview byte identity |

## Evidence status

On untouched production code at `a6ad26c05d50ebab72d782dbcb3bde05da188b21`, `npm ci` completed with Node 24.18.0/npm 11.16.0. The 12 independent legacy assertions passed. A one-time fixture capture assertion also passed; its generator was removed after saving the authentic Phase 2 checkpoint fixture. All eight boundary rows produced the expected demand, result and original limiting port.

Initial mixed-class fixture incorrectly expected only a port bottleneck. Canonical module links inherit endpoint ratings, so its 100.5 Mbit/s endpoint also correctly clamps the outgoing edge. The test now asserts both physical resources each carry exactly 101 Mbit/s. This was a test expectation repair, not a production defect or a lowered demand assertion.

The independent verifier reviewed this matrix as adequate planned coverage; that review does not constitute integrated-candidate acceptance. Final executed identities/results remain pending. New undersized Phase 3 combines external and cluster at the core; when external is required, its 400 Gbit/s budget is intentionally reached before the legacy cluster-only boundary.

## Implemented test ownership and first integrated results

- `tests/phase3-network.test.ts`: 12 original semantics, arithmetic, numerical and traffic aggregation cases.
- `tests/phase3-topology.test.ts`: 17 fixed-tier, per-resource, shared-budget, nominal/undersized, ordering, failure, and malformed/zero-allocation cases.
- `tests/phase3-persistence.test.ts`: 12 profile, authentic legacy compatibility, engineering checkpoint binding, price/state/observation and mapping cases.
- `tests/phase3-equipment.test.ts`: 5 specification/projection/cost/supply/worker/restore and persisted-link cases.
- `tests/browser/phase3.spec.ts`: 2 journeys per browser, 6 total. Every engine executes the ordinary 32,008-accelerator nominal/undersized, local-link disable/enable, shared-core trip/restore, old-run history, project export/import/reload, mobile and keyboard/fallback paths. The Firefox ordinary journey additionally executes the real 100,000-accelerator nominal/undersized campus. There are no new skips or retries.
- `.github/workflows/phase-1.yml` explicitly includes the new browser file in the executed production command.

First integrated production slice was Building `e67e115` plus root UI through `79d4a93` (testing worktree source checkpoint `2f8bc79`, with acceptance tests then uncommitted). All 6 Phase 3 browser journeys passed on the development server in their first runs: Chromium 2/2 in 9.8s; Firefox/WebKit 4/4 in 29.8s. These are early smoke results, not final production-build acceptance.

The independent numerical/integration tests exposed four expected release blockers on that slice: zero-load multiple-parent and malformed-port graphs were incorrectly satisfied, and standalone network evaluation missed local power/common-grid dependencies although actual simulation correctly applied them. Fixing owns those repairs; assertions remain unchanged. The million-accelerator test initially took 5.538s and hit the default 5s test limit because it created a matcher for every field of every resource. Aggregating an invalid-resource list still inspects every resource, removes test-framework overhead, and makes all 7 finite-tier cases pass within the unchanged per-test limit. No production timeout was relaxed.

After Fixing `a9f0765`, a 61-case Phase 3 focused run passed 60 cases. The remaining case had expected a malformed missing-port graph to report `unsupported`, while the repair correctly rejects invalid input with structured `NETWORK_PORT_TOPOLOGY`. The test now requires that exact invalid-input error. Multiple valid parents still require `unsupported`; the categories remain distinct. Local and common-mode standalone power checks passed after the repair.

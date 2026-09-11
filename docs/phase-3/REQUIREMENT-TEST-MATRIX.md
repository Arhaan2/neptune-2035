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

## Final local acceptance: PASS

Exact tested head: `b71af7ecac5f325e686eaa341f2891250ab369b3` in the isolated Testing worktree. Tested tree: `17f7bfc0bbdc99494c7818407950ac9d336e0378`, identical to root candidate `42410fa`. Later independent-review and this evidence text are documentation-only additions; CI must still test the final merged candidate.

- Environment: macOS arm64, Node 24.18.0, npm 11.16.0; repository Playwright configuration unchanged.
- Lockfile Git blob: `36113f734cddba74c9af06813e5c3f7200adfa23`; SHA-256: `87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9`.
- Solver `2.3.0`, model `neptune-reference-3`, algorithm `committed-boundary-1`, project schema 3; saved legacy checkpoint retains solver `2.2.0` and its original engineering fingerprint.

| Actual command/gate | Result |
| --- | --- |
| `npm ci` | PASS, installed from the unchanged lockfile |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1 npm test -- --reporter=default --reporter=json --outputFile=artifacts/phase3/unit.json` | **364 passed, 0 failed, 0 skipped; 21 files**, 33.22 s |
| Both real telemetry integrations | PASS: native browser reconnect/Last-Event-ID/source validation and actual app mapping/raw/dropout/calibration/streaming; all 47 telemetry cases executed |
| `npm run build` | PASS |
| Production preview on 4173; `npm run test:browser -- tests/browser/prototype.spec.ts tests/browser/phase2.spec.ts tests/browser/phase3.spec.ts --retries=0` | **19 passed, 0 failed, 2 historical exclusions**, about 1.3 min; Chromium/Firefox/WebKit |

All 61 Phase 3 unit/integration cases are included in the 364 total, including Fixing's 13 admission/dependency cases and Building's 2 unknown-price cases. Independent capacity expectations passed at every listed boundary and nominal scale up to the selectable one-million-accelerator envelope. The final one-million-accelerator resource case took 3.201 s within the unchanged 5 s unit-test limit.

All six ordinary Phase 3 browser journeys passed with real workers and no application, console or asset-loading errors. Firefox additionally completed the real 100,000-accelerator comparison. The existing Firefox 500,000-accelerator Step 10s journey passed in 12.7 s, advancing the actual simulation clock. The only exclusions remain that existing 500,000-accelerator Step 10s case in Chromium and WebKit. There are no new skips, broadened exclusions, retries or arbitrary load delays.

One lint-only correction replaced deprecated `toThrowError` with equivalent supported `toThrow`. The entire telemetry-enabled unit suite was repeated once after that correction to establish an unambiguous frozen tested tree; both full runs passed 364/364. The final production browser gate passed in its first run.

Local raw/native results are retained under the **Testing worktree**, not claimed as public artifacts:

- `/private/tmp/neptune-phase3-testing/artifacts/phase3/unit.json`
- `/private/tmp/neptune-phase3-testing/artifacts/phase3/browser.json`
- `/private/tmp/neptune-phase3-testing/artifacts/phase3/acceptance-identity.json`
- `/private/tmp/neptune-phase3-testing/artifacts/phase3/acceptance-summary.log` (explicit command/result summary, not raw stdout)
- `/private/tmp/neptune-phase3-testing/test-results/` (browser screenshots and runtime attachments)

This local acceptance does not claim CI, merge, publication, hosted parity or physical validation. Root owns those remaining release gates and records their actual identities/results separately.

## Initial CI timeouts and bounded diagnosis

[CI run 34550958284](https://github.com/Arhaan2/neptune-2035/actions/runs/34550958284) tested GitHub's synthetic merge `5fb5283429b59803f00d216a2de3c3e7454e8728`, whose parents were accepted main `a6ad26c05d50ebab72d782dbcb3bde05da188b21` and candidate `1a418cc4d38a23674a73dc7b92055d72258748c8`. Its recorded tree `3c9f44543f43ab040c4067aea707708f44b7371a` exactly matched that candidate. CI executed both real telemetry integrations and passed 362 tests. Two tests exceeded the existing 5 s limit:

| Case | Linux CI duration | Earlier macOS gate |
| --- | ---: | ---: |
| Phase 3 one-million-accelerator complete resource fixture | 7366.715 ms | 3201 ms |
| Existing one-million-accelerator inventory/10 GW simulation | 7309.358 ms | 3233 ms |
| Phase 3 500,000 accelerator resource fixture (passed) | 3522.916 ms | 1506 ms |

The broad 2.26–2.34× execution difference and synchronous computation explain these failures; they were not observation timing races. No timeout or expected result was changed, and the failed CI job was not rerun hoping for a pass.

Testing independently profiled each original large fixture once at exact source `1a418cc`, with no concurrent large profiling run. Local legacy stages were 938.49 ms build, 1726.61 ms initialize and 290.35 ms summary. Phase 3 stages were 866.57 ms discarded legacy build, 930.88 ms nominal build, 1323.85 ms assessment of **378,916 resources**, and 4.66 ms assertions. Native stage receipts remain at `/private/tmp/neptune-phase3-testing/artifacts/phase3-ci-profile/stages.jsonl`; the temporary diagnostic generator was removed.

The existing legacy test performs only one required build and simulation, so its fixture remains unchanged and needs a production performance repair. The Phase 3 capacity fixture now selects its network on an eight-accelerator design and then uses the supported resize operation to build the requested full inventory once. Two added pilot/campus regression cases compare the **entire resulting Design**, including topology, specifications and revision, against the original large-legacy-then-convert construction; both passed. Every capacity/resource assertion, traffic rate, requested scale and the 5 s test limit remain unchanged. This removes redundant fixture setup; it does not reduce evaluated inventory or replace the solver.

Fixing owns the separate production repair. Full acceptance and CI on the repaired candidate are required before release; the earlier local pass is not being substituted for the failed CI result.

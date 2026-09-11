# Phase 3 release evidence

The complete local gate passed against source tree `17f7bfc0bbdc99494c7818407950ac9d336e0378` (root `42410fa269ff982e66f7eb1bfd352ae2427f7501`; equivalent Testing commit `b71af7e`). Subsequent evidence-document changes do not alter application, tests, workflow, dependencies or build inputs. The independent review records the exact reviewed engineering candidate and its additional reference calculations. Final PR CI tests the final source tree before merge; accepted main and the published artifact must match that verified tree.

| Gate | Actual result |
| --- | --- |
| Lockfile installation | `npm ci` passed; Node 24.18.0 |
| Typecheck / lint / production build | Passed |
| Full unit/integration suite | 364 passed, 21 files, zero skipped; 33.22 seconds on the frozen run |
| Real telemetry | Both production adapter and actual app integrations executed and passed; all 47 telemetry tests passed |
| Production browser gate | 19 passed, two historical exclusions, zero failed, retries zero |
| Phase 3 browser journeys | Six passed across Chromium, Firefox and WebKit; Firefox includes the actual 100,000-accelerator campus |
| Existing Firefox campus gate | 500,000-accelerator actual clock advanced by ten seconds; passed |
| Independent engineering fixtures | Four passed; every switch/path checked at 8, 10,000, 100,000 and 1,000,000 requested accelerators |

The exclusions remain the original Chromium/WebKit 500,000-accelerator prototype check. They are not Phase 3 exclusions. No telemetry integration was skipped. Initial failures and their repairs are recorded in the requirement matrix and fixing findings, including malformed dormant graphs, standalone power-dependency admission, a deprecated test matcher, and independent fixture expectation corrections. The final frozen gate did not depend on retries.

Independent campus results with both classes required: 12,500 nodes, 1.25 Tbit/s cluster plus 12.5 Gbit/s external; nominal core load 1.2625 Tbit/s versus a fixed 12.8 Tbit/s budget; all traversed paths fit. The undersized counterpart fails only its shared 400 Gbit/s switch budget across all twenty domains. Cluster-only legacy tests pass at 399.9 and 400.0 Gbit/s and fail at 400.1 Gbit/s. Partial-node rounding is preserved. Combined required traffic passes at 3,960 nodes / 399.96 Gbit/s and fails at 3,961 nodes / 400.061 Gbit/s.

Raw local reports: Testing worktree `artifacts/phase3/unit.json`, `browser.json`, `acceptance-identity.json`; root worktree `artifacts/phase-3/`. These are local paths, not public evidence URLs. Final receipts are also retained under the original workspace's ignored `artifacts/phase-3/` directory. Large browser traces/screenshots remain ignored or in the actual CI artifacts.

The [production release marker](https://arhaan2.github.io/neptune-2035/release.json) is the authoritative deployed-source receipt: source SHA/tree, lockfile hash, PR, successful source CI, artifact manifest identity, preserved preview tree and primary rollback. The [public artifact manifest](https://arhaan2.github.io/neptune-2035/build-manifest.json) hashes compiled/static production files and excludes both identity manifests, following the established convention. The [repository Actions history](https://github.com/Arhaan2/neptune-2035/actions) retains source CI and actual Pages deployment runs. These deployment gates follow local acceptance; a local PASS alone is not a live-deployment claim.

Rollback uses the actual verified Pages head captured immediately before publication, expected `388f215105be0a907947f2be0e8e8e26e2428904`. Restore that artifact with a new ordinary commit on the latest Pages branch only after checking intervening releases. Preserve preview subtree `531d00a67da4c1f2f02a22bf249d93e683b2601b`, its referenced assets and `.nojekyll`. Retain historical `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5` as a secondary checkpoint.

Five distinct actual roles ran: root Orchestration, Building, Testing, Independent Verification and Fixing. The runtime allowed four active agents including root. Building, Testing and initial Verification overlapped; after Verification completed its checkpoint, Building, Testing and Fixing overlapped. Verification returned for integrated acceptance. Writers had isolated Git worktrees; only root performs main/Pages writes.

Model limitations: synthetic offered traffic and equipment assumptions; deterministic one-direction rooted routing only; conservative all-or-none affected job domains; shared upstream dependencies; shore/platform network cooling outside the module thermal boundary; included assumed costs with stated exclusions. No physical validation, training-throughput prediction, arbitrary multipath, optimizer, Phase 4/5 work or completion of previously deferred Phase 1 performance/stress gates is claimed.

See [contract](CONTRACT.md), [equipment accounting](EQUIPMENT.md), [demo](DEMO.md), [test matrix](REQUIREMENT-TEST-MATRIX.md), [independent review](INDEPENDENT-REVIEW.md), and [fix history](fixing-findings.md).

# Phase 3: network designs at campus scale

Simulated, design-stage prototype. These are synthetic equipment and offered-traffic assumptions, not measured training traffic, achieved throughput, vendor validation, or physical campus validation.

## Baseline and release boundary

Fetched current `origin/main` before development: `a6ad26c05d50ebab72d782dbcb3bde05da188b21`, tree `6d392e586ce57d5cb21bccb8ef812199d58cd45e`. Pages: `388f215105be0a907947f2be0e8e8e26e2428904`; preview subtree: `531d00a67da4c1f2f02a22bf249d93e683b2601b`. These match the supplied Phase 2 baseline. Capture Pages again immediately before publishing; that verified head is the primary rollback. Older `ccc99111eb1541fd95f7e9d14ac8fe15899cfab5` remains a secondary historical checkpoint.

Development uses an isolated clone `/private/tmp/neptune-phase3` from current remote main and separate writer worktrees. The original checkout and its two unrelated untracked files are untouched. The existing GitHub Pages branch publication mechanism remains `codex/pages`, root `/`; a push to main alone does not publish.

## Traffic and architecture

Eight accelerators per node. Node count is `ceil(requested / 8)`. Required cluster traffic is 100,000,000 bit/s per energized node; required external traffic is 1,000,000 bit/s per energized node. Required-class flags remain in the existing design config. New immutable workload v2 explicitly persists units, provenance, routing, direction and platform job-domain semantics. Original v1 remains unchanged.

The explicit rooted reference network selects the smallest fixed 8-, 32-, or 256-output-port core fitting the platform count. Each output is 400 Gbit/s; shared one-direction budgets are respectively 3.2, 12.8 and 25.6 Tbit/s. Platform switches have four outputs; module switches have forty rack outputs. External demand enters the shared core and follows the same downstream paths as cluster demand. One traversal charges one switch budget, rather than ingress plus egress twice. No multipath, ECMP, rerouting, opposite-direction pooling or packet simulation is supported.

The deliberately undersized core exposes real ports with a shared 400 Gbit/s switching budget. Cluster-only demand reproduces the original 4,000-node boundary. With external connectivity required, 101 Mbit/s/node crosses that shared budget at 3,961 nodes; this is the declared combined-class model, not a changed cluster assumption.

Provisioning evaluates every installed node independently of supply and current energization. Instantaneous assessment uses energized nodes. A blocked required resource conservatively blocks affected platform job domains; no bandwidth percentage is reported as partial training throughput. Unrelated local domains can remain connected, but all domains share the core and its shore supply dependency.

## Compatibility and transitions

Project schema 3/design schema 2 remain versioned envelopes; equipment schema 1 gains an optional explicitly versioned network contract. Missing network contract retains Phase 2 topology and workload semantics. Current numerical model is `neptune-reference-3`, solver `2.3.0`; algorithm remains `committed-boundary-1`. Previous-model checkpoints are inspectable/exportable and require explicit recalculation into a separate experiment. Legacy engineering fingerprints retain the prior serialization semantics so saved records remain readable. Unknown profile, architecture or catalog versions are rejected.

Network hardware, topology, profile and routing assumptions participate in engineering identity. Network changes preserve the prior complete project in saved scenarios before starting a paused fresh revision; failure to save history prevents the change. Runtime asset trip/restore remains event history. Link enable/disable is an explicitly disclosed design revision/reset. Economics-only edits preserve the full physical checkpoint and observations.

Full project export/import and local recovery carry the saved supported design. The historical `#s=` sharing path belongs to Legacy v0.1; it does not carry Phase 3 hardware or runs. Use project JSON to share Phase 3.

## Equipment boundaries

Network specifications declare fixed ports, switching budget, electrical demand, dimensions, mass and assumed included prices. Supply allocation must include their demand and failure dependencies. Shore equipment stays outside floating mass. Module network heat uses the existing module boundary; shore/platform switch cooling outside that boundary remains unassessed. Itemized switches replace the networking equipment portion of the prior allowance; retained link/rack provisions and unknown/excluded contributions must be named in inventory/report output. Known included subtotals are not complete project costs.

## Execution board

Runtime limit: four active agents including root. Initial overlap: Building, Testing and Verification. After completed initial Verification checkpoint, Fixing uses that slot; Verification returns for integrated and final candidate review. Only root merges and publishes.

| Agent | Workspace | Ownership / checkpoint |
| --- | --- | --- |
| `/root` | `neptune-phase3` | Shared contract, persistence, UI, integration, exact candidate and release |
| `/root/building` | `neptune-phase3-building` | Equipment/topology/evaluator/supply/report production slices |
| `/root/testing` | `neptune-phase3-testing` | Independent tests, browser journeys, CI command, requirement matrix |
| `/root/verification` | `neptune-phase3-verification` | Independent reference calculations and review; no production changes |

| Stage | Dependency | State |
| --- | --- | --- |
| Baseline and independent failing boundary | Current remote main | Verified original 400 Gbit/s bottleneck |
| Contract and deterministic topology | Baseline | Contract agreed; implementation active |
| Worker, supply and equipment consequences | Topology | Building |
| Presets, inspection, history and sharing | Contract + evaluator | Root |
| Independent tests / fixes | Completed slices | Testing active; defect queue below |
| Frozen candidate, CI, merge, Pages, live checks | All mandatory gates | Pending |

## Defect queue and acceptance

No candidate accepted yet. Initial baseline fixture: 31,992→3,999 nodes/399.9 Gbit/s passes; 31,999 and 32,000→4,000/400.0 passes; 32,001 and 32,008→4,001/400.1 fails at `port:shore/cluster-core:cluster-out`. A fully energized 100,000 campus offers 1.25 Tbit/s cluster and 12.5 Gbit/s external and fails the original core.

Actual commands: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:browser`. Full unit acceptance sets both `NEPTUNE_TELEMETRY_BROWSER=1` and `NEPTUNE_TELEMETRY_APP=1` with the real app server. Browser acceptance runs prototype, Phase 2 and Phase 3 suites with retries zero. Existing Chromium/WebKit 500,000-campus prototype exclusions remain disclosed; Firefox must advance the actual clock. No Phase 3 ordinary journey is excluded. Existing deferred Phase 1 performance/stress gates remain deferred.

# Visual V4 — Scene-first interface

**Simulated, design-stage prototype; physical validation pending.** Visual V4 reorganizes the existing application. It does not validate hardware or complete the authored equipment library. Acceptance measurements and final immutable source/artifact identities are recorded separately; this implementation document is not a release receipt.

## Controls and stable owners

| Control | Existing owner / handler | V4 location |
| --- | --- | --- |
| Explore / Operate / Compare | `TwinApp.workspace`, `setWorkspace` | Top navigation; entry never loads or runs a scenario |
| Selection, platform/module/equipment, exact ID | `TwinApp.selectedId`, `select`, `resolveAsset` | Assets dock; same bounded hierarchy and exact-ID form |
| Physical design and assumptions | `TwinApp.config`, `designOverride`, `setDesign`, `NumberField` | Design dock, separate from scene appearance; same blur/Enter commits and save/reset semantics |
| Installed equipment replacement, network changes | `applyReplacement`, `applyNetwork`, `changeNetworkConnection` | Inspector expandable physical-edit sections; existing validation and previous-project protection |
| Camera/reveal | `focus`, `resetId`, `inside`, `xray`, `exploded`, `dimensions` | Scene toolbar; same handlers and canonical layout |
| Current clock, step, speed | `useTwin`, `sim.setRunning/advance/setSpeed` | Compact operation strip, available during presentation |
| Reset/replay/execution seek, cancel/resume | `useTwin`, `sim.reset/replay/cancel/resume` | Expandable execution details; active Cancel/Resume remain exposed |
| Events/exact history | `useInspection`, `OperatorTimeline`, `inspectEvent` | Operate history strip and recorded event details; exact boundaries retained |
| Experiment preparation/execution and reports | `ExperimentPanel`, `TransferPanel`, existing `TwinApp` handlers | Operate working area; original owners and prerequisites |
| Campaigns, evidence, walkthrough | `DecisionPanel` local decision/execution state, `inspectDecisionEvidence`, `startResultWalkthrough` | Compare results and setup; explicit actions preserve saved-project semantics |
| Saved scenarios/comparisons | `TwinApp.saved/comparison`, `compareSaved/makeComparison` | Compare, retained scopes and full-run evidence |
| Project import/export | `inspectOrRestore`, `sim.captureProject`, canonical report/export functions | Top-bar Project actions; exact existing artifact formats |
| Recovery and compatibility | `useTwin.recovery`, `inspectOrRestore/recalculateInspected` | Persistent context notices; accessible independent of density |
| Data & replay | `DataPanel` / `TwinDataPanel`, telemetry owner | Mounted Data & replay dock; hidden UI retains owner and connection; design-revision boundary unchanged |
| Constraints & sources | `EvidencePanel`, existing summary/residuals | Evidence dock; current-time context explicit |
| Presentation focus / panel expansion | Session-local `TwinApp` UI state only | Top bar and dock header; no project schema or simulation mutation |

## Layout and accessibility

The scene, context, compact metrics and operating strip share a primary column. One 360 px desktop dock presents Assets, Inspector, Design, Data & replay or Constraints & sources. The dock changes using hidden panels with stable ownership. At widths up to 900 px it becomes a fixed non-modal bottom sheet, with a compact identity/header and an expanded body limited to 55% of the viewport height. Collapse and Close remain in its header. Document padding and scroll padding reserve the occupied sheet space; short viewports retain document scrolling. The same semantic tree serves every viewport.

Presentation focus hides the dock and secondary workspace controls while retaining selected identity, displayed/current context, qualifier, warnings, active work and applicable pause/cancel/return actions. It is session-local and neither loads nor resets any project. Paired-comparison progress and campaign execution failures remain visible outside their ordinary workspace. Native details keep rare project/execution controls accessible. Escape closes the active visible disclosure and restores its summary focus before the scene receives the key; hidden disclosures cannot consume Escape. Non-modal panels do not trap focus.

Typography uses rem sizing, semantic status text accompanies color, and primary touch controls target 44 CSS px. Wide comparison tables retain complete values in labeled local scrolling regions. Responsive checks cover 390×844, 768×1024, 1440×900, 844×390 and 320 CSS px, with a separate 200% text-enlargement check. Actual captures and observed contrast/focus results belong to the external acceptance report; these design choices alone are not accessibility certification.

Native import choosers remain visible keyboard stops in their labeled menus/panels. Accessible fallback plans use document flow and automatic height; the context-restoration button receives its own row before the scene toolbar, so restoration stays reachable on narrow screens. No fallback state owner or restoration handler is replaced.

## Scope and acceptance tracking

V1–V3 GLBs, manifests and authoring descriptors remain unchanged. No dependency, solver, topology, metric, physical specification or project schema change is authorized here. Camera layout and any occlusion treatment remain presentation-only. Final tests, measured performance/resource plateaus, actual-app views, native Safari status and release evidence will be filled in from observed results, not inherited V3 figures.

## Camera composition and unchanged kit

The reproduced exploded-view obstruction was the selected module's raised opaque aisle accent crossing the CDU face. The supported exploded cooling camera now uses a lower approach below the lifted floor; the assembled camera keeps its previous elevation. No cutaway, ghosting, material allocation or structural removal is used. Canonical geometry, mass, routes, identity and all three authored files remain unchanged.

R3F's measured canvas remains the sizing owner. Campus/Plan/equipment fits use canonical presented bounds and actual aspect. Named views refit after meaningful layout changes; pointer/keyboard takeover preserves the user's pose until an explicit view/reset request. Zero-size measurements are ignored. Readiness and diagnostics are published after a completed frame that agrees with the canvas and its parent viewport. Saved named poses are recomputed rather than restoring an intermediate animation pose; intentional manual interior/exterior return remains supported.

A narrow optional `DataPanel.onStreamSummary` callback reports transport-state text to the persistent shell. It neither owns observations nor controls connection lifetime. Repeated samples with the same transport summary do not cause shell updates. The existing physical-revision key, TelemetryStore, EventSource transport, raw/normalized records and import/replay/reset semantics remain in `ObservationSession`. This exposes active/reconnecting/stale/error status even while the data dock is hidden. No private observations or preferences enter project persistence.

## Regression navigation and evidence discipline

Retained browser action sites explicitly navigate the new visible panel/menu before using their original locator and native input action. `tests/browser/visible-controls.ts` opens real workspace/panel buttons and native disclosure summaries; it does not force clicks, invoke handlers or dispatch events. Functional assertions, deadlines, the PH2 export-download cadence and the V2 resource-case trace configuration remain intact. The only allowed exclusions are the existing Chromium/WebKit `public prototype large-campus functional Step 10s` cases; Firefox remains active.

Focused V4 coverage exercises owner identity, normalized paused checkpoints, drafts, campaign continuity, exact/unavailable history, responsive controls, delayed/failed loads and actual CDU surface clicks across compositions. Normal-motion coverage observes named framing after reflow and verifies that subsequent manual camera takeover survives further layout changes. The mandatory real SSE app integration separately checks transport construction/closure, source/sequence/raw-record continuity during workspace, panel, presentation and viewport changes. A live feed may append valid observations; it is not compared as a frozen checkpoint.

`scripts/visuals/v4-measure.mjs` retains three normal-motion 30-second paths, separate inspector/presentation transition intervals, twenty panel/workspace/view cycles and a ten-minute interactive soak. Receipts record the actual machine, browser, viewport, DPR, motion state, raw frame intervals, warmed geometry/texture/cache inventory and available JS heap. These counters do not measure total GPU/native memory. Measurements must identify the tested compiled manifest and are not inferred from V3. Startup readiness and bundle-size comparisons use the unchanged default workload and clearly distinguish compiled/static bytes from release metadata.

Before/after captures use the unchanged default design/time/viewport but disclose intentional layout and camera differences. They are full actual-app captures, not material-only comparisons or offline renders. Native Safari remains a separate limitation unless a visible authorized session is actually established; Playwright WebKit is separately identified. No accessibility certification or physical validation is claimed.

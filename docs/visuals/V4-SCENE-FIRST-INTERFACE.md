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

The PH7 real-canvas journey uses explicit visible panel and disclosure navigation for its known desktop path. Its five camera arrangements, native export cadence, checkpoint/failure assertions and 60-second deadline are unchanged. This removes repeated generic ancestor-discovery round trips identified in the retained Linux WebKit timeout trace. CI distributes the same 13 complete browser files across three groups per engine; all nine jobs verify the same core artifact, retain one worker and zero retries, and must pass within the unchanged 15-minute job limit. The local and hosted full browser gates retain the unsplit file list. PH7 and the V4 CDU compositions use the same checked native keyboard activation as the two retained resource-cycle cases for repeated setup buttons. The V2 resource case also uses that path for Assets/Find navigation. Disclosure clicks, native selects, exports and all scene assertions remain. All eight V4 CDU surface hits still use actual mouse clicks, with unchanged hit ownership, identity, label and screenshot checks; keyboard setup is not claimed as pointer-actionability evidence. CDU readiness reads scene and DOM dimensions together while retaining every view predicate and the original one-pixel agreement bound. The new normal-motion V4 pose-preservation case takes over with a real wheel event on the visible canvas, then applies the same three-publication, 1e-5 m and 12-second settling checks. This isolates preservation across reflow from the inherited frame-count-based angular damping; retained V3 ArrowRight coverage is unchanged. It does not claim that angular damping settles within 12 seconds on every software-rendered runner.

Focused V4 coverage exercises owner identity, normalized paused checkpoints, drafts, campaign continuity, exact/unavailable history, responsive controls, delayed/failed loads and actual CDU surface clicks across compositions. Normal-motion coverage observes named framing after reflow and verifies that subsequent manual camera takeover survives further layout changes. The mandatory real SSE app integration separately checks transport construction/closure, source/sequence/raw-record continuity during workspace, panel, presentation and viewport changes. A live feed may append valid observations; it is not compared as a frozen checkpoint. The rendered app integration uses the same platform graphics configuration as the existing Chromium acceptance project: Metal on macOS, and the installed Mesa/Xvfb display on Linux. It retains its original 40-second deadline and all mapping, calibration, reconnect and reflow assertions. Concise stage timings and the observed renderer are retained for timeout diagnosis.

`scripts/visuals/v4-measure.mjs` retains three normal-motion 30-second paths, separate inspector/presentation transition intervals, twenty panel/workspace/view cycles and a ten-minute interactive soak. Receipts record the actual machine, browser, viewport, DPR, motion state, raw frame intervals, warmed geometry/texture/cache inventory and available JS heap. These counters do not measure total GPU/native memory. Measurements must identify the tested compiled manifest and are not inferred from V3. Startup readiness and bundle-size comparisons use the unchanged default workload and clearly distinguish compiled/static bytes from release metadata.

Completed measurements at source `ab1ee82` used the application payload identified by manifest `5800803bded210b70fde34f23fe0d92cbdb7327e4b5dfdeea7bc4d9e7eef957f`; subsequent corrections concern acceptance navigation and CI. Final release evidence must verify that byte identity again. The available host was an Apple M4 Pro, 14 logical CPUs, 24 GiB, macOS 26.6.2, on AC power. Chromium 153.0.8010.12 ran headless with observed ANGLE Metal, 1440×900 and DPR 1.5, using the default 10,000-accelerator design, workload 0.8 and paused clock 0 s.

| Observation | Recorded result and scope |
| --- | --- |
| Three normal-motion paths | Each exceeded 30 seconds with 1,801 raw intervals; median 59.88 fps each, p95 intervals 16.7 / 16.7 / 16.8 ms, maximum 16.8 ms. Actual camera motion was retained. |
| Layout transitions | Separate twelve-action observation: 12.516 s, p95/maximum 16.8 ms. Its named camera pose stayed constant; camera motion is covered separately. |
| Cycles and interactive soak | Twenty cycles, then 603.457 s and 49 further sequences under reduced motion. Sixty-nine identical warmed-pose comparisons retained 77 geometries, two textures and the three-template cache, with no post-warm detail fetch. JS heap samples were coarsely quantized at 31.2 MB; total GPU/native memory was unavailable. |
| Bundle and startup | Compiled/static bytes increased 31,505 to 5,386,076; locally recompressed startup JS/CSS gzip increased 5,609 bytes. Three fresh contexts per build, alternating order, produced V3/V4 median first completed scene publications of 922.2 / 772.4 ms with zero startup GLBs. Shared process/host caches limit inference; this is descriptive rather than a guaranteed speedup or first-pixel measurement. |
| Representative text contrast | Seven states: 415 passing repeated text fragments, zero measured failures, 213 UNKNOWN and four disabled exclusions; minimum known-background ratio 6.26:1. Unknowns include closed disclosures, canvas backgrounds and covered mobile fragments. This is not an accessibility certification; native controls, icons and focus/nontext contrast need separate assessment. |

The final release report supplies exact acceptance attempts, source/CI/Pages identities, raw/public evidence hashes and hosted media. Native Safari visible-session rendering remains unverified; the hidden-route result is inherited and was not repeated as new evidence.

Before/after captures use the unchanged default design/time/viewport but disclose intentional layout and camera differences. They are full actual-app captures, not material-only comparisons or offline renders. Native Safari remains a separate limitation unless a visible authorized session is actually established; Playwright WebKit is separately identified. No accessibility certification or physical validation is claimed.

## Actual interface review captures

The images below are unretouched browser captures from the committed production preview at `3318290`, compiled/static manifest `5800803bded210b70fde34f23fe0d92cbdb7327e4b5dfdeea7bc4d9e7eef957f`. They document visual review before final release acceptance; the external release receipt binds the final accepted source, CI artifact, measurements and hosted media. Desktop viewport is 1440×900, mobile 390×844, DPR 1.5, reduced motion. Full-page captures include document scrolling; the mobile viewport captures are scrolled to the scene to show the compact/expanded sheet. The source screenshots do not substitute for the later hosted journey.

| View | Actual capture and context |
| --- | --- |
| V3 before / V4 after | [V3 full Explore](v4/v3-explore-before.png), [V4 full Explore](v4/v4-explore.png): same default physical design and paused 0 s, same desktop viewport; shell width, scene height and camera fitting intentionally differ |
| Cooling equipment | [Selected CDU, exploded cooling](v4/v4-cdu.png): same authored kit, lower supported exploded camera; no geometry removal |
| Operate history | [History at 0 s, current clock 10 s](v4/v4-history.png): explicitly prepared healthy cold experiment; controls retain history guards |
| Compare | [Completed nominal campaign](v4/v4-compare.png): declared three-candidate campaign and included-cost evidence, with no active-project replacement |
| Presentation | [Presentation focus](v4/v4-presentation.png): same selected CDU and paused 0 s, inspector hidden by UI state |
| Mobile inspector | [Compact](v4/v4-mobile-compact.png), [expanded](v4/v4-mobile-expanded.png): same selected duty pump and paused 0 s; header provides the explicit route back |

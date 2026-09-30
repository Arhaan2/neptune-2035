# Visual V5 — Evidence-driven cinematic walkthrough

**Simulated, design-stage prototype; physical validation pending.** This extends the shipped result walkthrough in the real Blue Hour application. It does not add an execution algorithm, hardware validation, equipment family, renderer or global store. The final external Visual V5 receipt identifies the accepted source, exact compiled payload, retained attempts, CI, production verification and media; this implementation document alone does not certify a release.

Final test results, measurements, hosted media and the acceptance receipt belong to the [Visual V5 release](https://github.com/Arhaan2/neptune-2035/releases/tag/visual-v5-2026-09-30), published only after its required gates pass. Historical releases remain separate.

## Prepare, load, present, inspect

Open **Compare**, choose/configure the campaign, and explicitly **Start decision campaign**. Completed coverage exposes the evaluated candidate, scenario and run beside **Start result walkthrough**. That explicit action first saves the active project in Compare, then loads one completed run's final checkpoint. Busy, incomplete, stale and storage-failure guards remain. Default project saves exclude private observations and stream URLs; loading an incompatible design revision resets observation mappings. This is not a promise to restore private sessions.

The loaded walkthrough begins with manual navigation. **Play presentation** explicitly opts into foreground pacing and temporarily requests the existing Presentation focus. **Previous walkthrough step** and **Next walkthrough step** retain their semantic chapters. **Details** includes the complete original explanation, source and a Presentation view selector for installed-equipment subshots. Opening Details or using ordinary equipment/history/camera controls pauses guidance. **Resume walkthrough** deliberately reapplies the chapter from the actual camera pose. No global playback shortcut intercepts typing, native selectors or scene shortcuts. Escape closes an active overlay first; otherwise it exits the walkthrough.

**Restart presentation** changes only presentation/history navigation. It does not reload the project, rerun a campaign, save another scenario or evict history. **Exit walkthrough** stops guidance and returns to the loaded result's current checkpoint. The earlier project remains in saved scenarios in Compare and is restored only by an explicit user action. **Review evidence** exposes the retained Compare evidence. Temporary visual settings are restored only while guidance still owns them; explicit later user settings are not overwritten.

Reduced motion defaults to manual progression and immediate framing. Its separately explicit Play action enables chapter advancement without camera animation. A live preference change pauses playback. Hidden documents, real camera/asset takeover, context loss and conflicting history controls pause immediately; returning to a tab never catches up elapsed hidden time and requires explicit Resume. Physical edits, project replacement, new runs and execution replay invalidate old guidance. Execution replay remains a separate operation with its existing guards.

## Three clocks and one owner

`src/twin/presentation/walkthrough.ts` captures the complete evaluated campaign/result and generates typed step sources, captions and shot descriptors. The captured identity includes evidence and provenance; a reused display ID cannot identify an old narration. Price-only active-design edits do not rewrite captured campaign costs. Imported evidence remains supplied evidence, not independent recomputation.

`src/twin/presentation/playback.ts` is the small reducer used by the existing TwinApp walkthrough owner: ready, playing, paused, resolving, completed, invalidated and error. One bounded 100 ms UI cadence measures foreground elapsed time. There is no second solver, physics timeline or chain of competing advancement timeouts.

| Clock | Authority and behavior |
| --- | --- |
| Recorded event/evaluation time | Typed experiment event, controller transition or recovery marker. The opening uses the recorded evaluation origin, including supported settled warmup origins. |
| Displayed canonical boundary | Existing `useInspection` worker and `post`, `previous`, `at-or-after` semantics. A confirmation marker between observations is labeled separately from its resolved scene time. Unsupported exact history remains unavailable. |
| Foreground presentation time | Camera motion and reading holds only. It never advances the solver, creates intermediate physical states or interpolates numerical readings. |

Every navigation binds source/run generation, captured evidence, semantic step and a new request token. History resolves before directed framing becomes eligible. During resolution the same compatible scene/cache stays mounted and its retained frame is clearly labeled as resolving. Old history/asset/camera completions cannot authorize a new chapter. Reading begins only after canonical time/selection agree, a requested representation is terminal, and three completed pose/layout-stable frames have been observed. A 15-second readiness budget stops with an error and Resume/Next/Exit recovery controls; it never skips missing evidence. Layout changes suspend reading readiness. Caption space is reserved so resolving copy cannot repeatedly resize and refit the camera.

## Chapters and shots

The eligible sequence uses four-second reading holds and 1.5-second camera moves, totaling 59 seconds before additional loading, history resolution or settling. Confirmation keeps the onset composition and cuts to its newly resolved boundary, still requiring fresh post-render readiness. Actual video/foreground timing belongs to the receipt. Alternate evidence can shorten the sequence. No timer promises campaign computation or asset-loading duration.

| Semantic step | Presentation and evidence |
| --- | --- |
| `installed` | Wide view of the evaluated candidate's actual installed scale at its recorded origin, then cooling bay, compatible exchanger and compatible CDU subshots. These share the same historical boundary and create no simulated events. |
| `fault` | Actual initiating asset/event and its canonical incident dependency edges. Equipment fault, selection outline and disabled/dashed connections remain separate. |
| `downstream` | Affected module at the corresponding resolved boundary; downstream service loss does not imply every component physically failed. |
| `controller` | Actual controller/tie transition. Its own recorded switch states are distinguished from the final scene after all same-time events. |
| `capacity` | Typed admission, unserved demand, headroom and binding-resource record. Donor and shared-source limits remain explicit. |
| `onset` | Real recovery-predicate onset, distinct from continuous-dwell confirmation, including the zero-dwell case. |
| `confirmation` | Actual continuous-dwell metric marker and first canonical scene boundary at/after it, with the previous-boundary control retained. |
| `unrecovered` | Appears only when disturbance evidence has no sustained confirmation; explains the recorded limit without inventing a source or recovery. |
| `decision` | Return to the same evaluated facility. Original scenario outcome, whole-run interruption/unmet service and campaign ranking are separate facts. Tied preferences remain tied; no feasible result says so. |

Nominal coverage omits nonexistent fault/recovery chapters and identifies its nominal-only scope. Incomplete/resource-limited/invalid evidence cannot present a final recommendation. The original experiment verdict may be FAIL while a candidate satisfies a campaign's separately declared requirements; the final card and full evidence preserve that distinction.

## Camera, assets and lifetime

`src/scene/presentationCamera.ts` composes canonical subjects against the actual canvas. Position and target share elapsed-time easing, stable Y-up and an orbit interpolation to avoid a straight chord through the subject. Supported equipment approaches reuse V4 cooling framing. Positive directed transitions are bounded to 1.5–2.5 seconds; manual and reduced-motion requests cut immediately. Ordinary camera behavior retains its existing owner outside guidance. A pending historical request suspends ordinary refits, and takeover cancels flight ownership immediately.

No scene is cached per chapter, no additional WebGL context is created for a transition, and no equipment geometry is duplicated for scale. The existing three-template cache and private instance material ownership are unchanged. Initial ordinary-campus entry makes no GLB request. Explicit detail preparation/entry admits only compatible local templates. Procedural/plan fallback remains usable and is disclosed; it never counts as authored-detail showcase acceptance.

The authored files are unchanged and must be rehashed against the accepted candidate and served release:

| Asset | SHA-256 |
| --- | --- |
| Pump | `349db03c6513239aac075c85942ae8a79f90827f40c96b52fdcd593b992eaf75` |
| Exchanger | `b18e9ad1d69d2b588e34e9eb06d728a891449d61959d8150b41a47631424c559` |
| CDU | `f5274b9846026b674773bc2f8170b7175aeee202fbbcb9dd34bf38ebff9ee110` |

`useTwin`, `useInspection`, campaign state and observation/transport owners remain mounted. A compatible real SSE session can append observations during playback; continuity is checked through source, sequence, reset history and connection counts, not frozen record totals. Canonical checkpoint/events/metrics and exports are unchanged by presentation navigation.

## Reproduce acceptance and media

Follow the current [Phase 8 release procedure](../phase-8/RELEASE.md) for clean install, full units with both real telemetry integrations, numerical/historical campaigns, exact compiled packaging and normal promotion. V5 browser coverage is part of both the retained PH7 full file list and the CI `interface-visual` group; every group consumes the single core artifact. The only permitted exclusions remain the original Chromium/WebKit large-campus Step 10s cases; Firefox stays active. No retries, new skips, numerical-tolerance changes or acceptance-deadline extensions are admitted.

From a frozen source checkout serving its packaged production candidate:

```sh
node scripts/visual-v5/record.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/external/v5-landscape
node scripts/visual-v5/record.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/external/v5-mobile --mobile=1
node scripts/visual-v5/record.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/external/v5-nominal --fixture=nominal
node scripts/visual-v5/record.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/external/v5-limit --fixture=no-benefit-bus
node scripts/visual-v5/verify.mjs --recording=/absolute/external/v5-landscape --out=/absolute/external/v5-landscape-decoded
node scripts/visual-v5/measure.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/external/v5-measurements --mode=all
node scripts/visual-v5/visibility.mjs --url=http://127.0.0.1:4173/neptune-2035/ --out=/absolute/external/v5-visibility
```

The recorder runs a real campaign through visible controls, exports it, explicitly loads the result and presses Play once. The application performs all chapter advancement. Raw preparation/loading/playback footage, atomic source/step/request/scene records, observed status intervals, chapter stills and caption transcript remain outside Git and the production payload. Any presentation copy can trim only disclosed leading/trailing setup; no mid-sequence removal, speed change, replacement frame, synthetic camera script or audio is used. Decode/seek actual media and inspect representative caption/time/asset frames before publishing. The verifier uses encoder metadata only to seed a search, then brackets actual caption appearance in decoded frames. Metadata-mapped navigation times remain labeled estimates; no frame-exact subtitle timing is claimed. The separate native Chromium visibility route uses an uncaptured disposable browser and actual tab activation, requiring observed hidden/visible document states. Ordinary Playwright tab activation can keep documents visible and is not treated as hidden-tab proof.

The final receipt records exact local/CI/hosted tests and failed attempts; source/tree/lock/manifest identities; media/transcript/shot hashes; three normal-motion paths of at least 30 seconds at 1440×900/DPR≤1.5; loading, resolving, settling and reading durations; twenty lifecycle cycles; a ten-minute interactive soak; warmed resource/cache plateaus; and actual bundle growth. Frame targets are median ≥55 fps and p95 interval ≤25 ms on the declared available host. Allocation counts and JS heap are not total GPU/native memory. Native Safari remains explicitly unverified unless an authorized visible session is actually observed; Playwright WebKit is separate. Physical validation, complete accessibility certification, broader equipment authoring and V6 polish remain outside this phase.

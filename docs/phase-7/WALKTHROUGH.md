# Fault and recovery walkthrough

Simulated, design-stage prototype; physical validation pending.

Open the packaged application. In Compare choose the eligible-feeder transfer fixture, then Start decision campaign. Wait for completed coverage before using Start result walkthrough. The walkthrough chooses actual completed evidence and explicitly loads its saved final checkpoint; the previous project remains in saved scenarios. Subsequent historical inspection leaves that loaded checkpoint and cumulative results unchanged.

Use Next walkthrough step to inspect the installed pump, initiating feeder trip, downstream module, controller transition, bounded electrical admission, restoration onset, sustained recovery confirmation, and whole-campaign decision. The same scene, equipment IDs, camera and history resolver power ordinary inspection and the walkthrough. Read the narrative immediately above the canvas and the selected equipment inspector. Compare exposes actual requirements, full-run versus final values, evidence tables and economic exclusions. The eligible fixture currently evaluates III as preferred under its declared suite; changing the fixture to nominal selects II, while receiving-bus or common-source coverage produces no feasible candidate. Those labels are computed from the campaign, not fixed in the narrative.

An event opens the final canonical state after all engine observations at that timestamp. Previous boundary means the preceding actual committed observation, not an interpolated instant. Recovery confirmation is a metric marker and can fall inside an engine dispatch interval: the walkthrough names the raw marker separately from the actual first canonical scene boundary at or after it. The pre-marker control lets the reviewer inspect the preceding canonical boundary. Unsupported exact times show unavailable history. History resolution is bounded to the contract limits; it never restores a fractional view snapshot as a persisted project.

Pause allows inspection; camera or asset takeover and hidden tabs pause guidance. Resume reapplies the selected step. Exit cancels guided navigation and returns to the loaded current checkpoint. Ordinary history controls provide cancel and return-to-current; stepping requires returning to current. Reduced motion uses immediate framing. The non-WebGL list, narrative, metrics and tables retain the same identities and time context. Scene geometry and module-equivalent flow are representative, without CFD, sensor precision, or a seawater-to-GPU path.

Equipment health and switch position are separate facts: a transfer tie can have unknown equipment health while its actual controller record establishes that it is closed. Read the recorded switch state and projected topology separately; the application does not turn unknown health into a green measured indicator.

## Reproduce an actual recording

Use a clean frozen checkout and a packaged production build with `release.json`. Start its normal preview server. With the supported Playwright Chromium installed, run:

```sh
node scripts/phase-7/record-walkthrough.mjs --url=http://127.0.0.1:4173/ --out=/absolute/external/recording
node scripts/phase-7/verify-video.mjs --input=/absolute/external/recording/neptune-phase7-walkthrough.webm --out=/absolute/external/video-check
```

The script runs the real comparison, exports the actual campaign, uses visible application controls for every step, waits for applied history and matching rendered scene time/asset plus stable camera pose, then records a readable dwell. Outputs include the actual WebM, eight scene/full-page screenshots, native campaign, source/artifact identities and measurement receipt. The dwell is only recording pacing; readiness is observable. Playback verification decodes and seeks the video, writes representative frames, and hashes the media. Inspect these frames and source screenshots before advertising the recording.

All media and receipts stay outside source Git and the application payload. Publish only reviewed selected evidence through the immutable Phase 7 release. A script or storyboard alone is not a recording. Candidate/local recording proves only that named packaged artifact; hosted acceptance and independent Verification are separate gates.

The receipt measures click-to-applied-step latency and renderer heap on the declared fixture, computer and browser with recording enabled. Heap samples exclude worker, GPU and native memory. Emulated desktop/mobile, browser engines, reduced motion and induced context loss are software coverage, not real-device coverage or physical validation.

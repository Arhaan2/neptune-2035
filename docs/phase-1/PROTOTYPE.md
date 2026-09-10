# Public prototype release scope

This release is a public prototype — simulated, design-stage model. It is not full Phase 1 acceptance or physical engineering validation.

Blocking checks are dependency installation, typecheck, lint, production build, the existing unit suite (including both telemetry flags), and a short production-browser journey in Chromium, Firefox and WebKit. The journey exercises the real scene and worker, camera and equipment selection, exact normal Step 10s, start/pause/reset, project export/import/recovery, and 390px layout. One fresh Firefox large-campus step checks exact time and usable controls with a finite 60-second operation safety timeout; elapsed time is informational. The worker terminal-processing and persistence fixes remain intact. No feature is intentionally disabled unless this functional check fails.

The former hard 3-second acknowledgement and 12/20-second campus speed gates and automatic 20-execution stability batch are no longer release requirements. Extended browser journeys, stress tests, long-history measurements, performance benchmarks, and full Phase 1 certification are **DEFERRED**, not passed. Their source remains available for later manual verification. No numerical correctness assertions or model constraints are weakened.

CI runs the prototype checks on the PR candidate, with manual dispatch available. Duplicate exhaustive push/PR/main cycles are not required. A normal history-preserving merge is followed by one production build from the actual main SHA, packaged-subpath smoke verification, publication at the existing Pages root, and live checks. The existing preview and previous production remain recoverable.

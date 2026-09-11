# Phase 5 release and recovery gates

This document defines the release procedure, not a claim of completed acceptance. Native receipts at `/Users/arhaan/Documents/ChatGPT/Neptune/artifacts/phase-5-20260911/` identify completed gates and immutable source trees.

1. Freeze complete source, tests and documentation. Record commit/tree, lock hash and versions. Run clean npm install, typecheck, lint, all unit/integration tests with `NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1`, production build and retained prototype/Phase 2/3/4 plus Phase 5 production browser journeys in Chromium, Firefox and WebKit. Zero retries; only the original Chromium/WebKit 500,000-accelerator prototype Step 10s exclusions remain.
2. Independently review engineering and raw local evidence. Push the branch and run the same source CI against the exact candidate or equivalent merge tree. Preserve failures and repair defects before acceptance.
3. Refresh remote main and Pages immediately before promotion. Inspect any intervening changes; preserve the actual immediate rollback. Repeat affected gates if the accepted source or public baseline changed.
4. Merge through normal repository mechanisms only after all mandatory pre-release gates pass. Rebuild accepted main; require its source tree and every compiled/static payload byte to match the reviewed/tested artifact. `release.json` alone may change promotion fields: source SHA/branch, build timestamp, channel and explicitly recorded release evidence. No unexplained payload or build-manifest differences are permitted.
5. Publish a normal successor commit to existing `codex/pages`. Retain every `v2-preview/` byte. Observe successful completion of the actual Pages deployment; verify every tracked public artifact with the existing full-inventory HTTP verifier and distinguish nonserved Git markers.
6. Execute the complete required hosted browser gate at `https://arhaan2.github.io/neptune-2035/` in all three browsers, including exported numerical results and transfer transitions. Repeat identity and full-inventory verification afterwards, then obtain independent final release review.

## Immediate rollback

The verified pre-Phase-5 Pages identity is initially `b054b720b8a11c2e08e7df44eb3eb9cef1fc180b` (Phase 4), not historical Phase 3. Durable recovery consists of `pre-phase5-pages.tar`, `pre-phase5-recovery.bundle`, `baseline-public.json`, `baseline-pages-tree.txt`, and an extracted byte-matched rehearsal. Archive SHA-256: `11b02822ddc1858fe8aca6a90193572d02793c421ca7dbce1243de9a1ef800bb`. The bundle preserves complete history; a refreshed bundle/archive must be used if a later healthy release appears before promotion.

Rehearsal extracts the archive outside production and compares the entire inventory. It does not replace healthy production. If Phase 5 introduces a verified production regression, inspect the current remote Pages head for unrelated later work, restore the captured artifact using a normal successor commit, observe its deployment, verify public bytes and relevant smoke tests, and report **ROLLED BACK**. Never force-reset main or force-push Pages. Preserve failed evidence and reconcile source through normal history where necessary.

The final machine-readable and human-readable receipts must distinguish queued publication, completed deployment, hosted acceptance and rollback. The public release marker links actual source CI/PR, accepted source/tree and artifact identity. An agent review is software engineering evidence, not physical validation or external professional certification.

# Phase 7 release procedure

Procedure only; this is not a release receipt. Simulated, design-stage prototype; physical validation pending.

Freeze clean source/tree/lock and requirement matrix. Run `node scripts/phase-7/gate.mjs --out=/absolute/external/evidence` in an isolated exact-commit checkout. This extends the Phase 6 gate with Phase 7 browser journeys while preserving full units, both real telemetry integrations, clean npm installation, typecheck/lint, production build/package and all supported Chromium/Firefox/WebKit coverage. No retries; retain every native failure. Serialize resource-heavy checks. Independently reproduce actual exported campaigns using `npm run decision:reproduce -- --input=... --out=...` and compare baseline canonical outputs.

Testing and Verification must agree on the integrated source. Source CI preserves the single-build core artifact and per-browser byte/identity checks with required aggregate acceptance. Push only the integration branch, open the PR to main, inspect actual tested commit/tree and artifact payload, and wait for every required check. Source changes invalidate affected approval.

Immediately before promotion fetch main and codex/pages. Reconcile concurrent work. Refresh the verified root/preview inventory and normal-recovery bundle/tar. Baseline Pages was ce6432451e02a702a8c26fcb0caf6ab1952d4b60 (Phase 6), preview tree 531d00a67da4c1f2f02a22bf249d93e683b2601b; these are not an instruction to overwrite a newer release. Retain earlier immutable tags and recovery history.

Merge normally; accepted main tree must equal reviewed source, otherwise revalidate. Use exact accepted compiled/static payload. Production `scripts/package-preview.mjs` may alter only `release.json` promotion fields: channel, sourceSha/sourceBranch, builtAt, evidence links/rollback/preview references, publicURL, releaseScope and documented model metadata. `sourceTree`, lock and compiled/static artifact digest must still match. Enumerate actual changed metadata separately.

Deploy via the existing legacy Pages source codex/pages at `/` using a normal successor commit. Preserve all v2-preview bytes and both .nojekyll markers, legacy route/base-path behavior and history. Scan outgoing application and evidence for secrets/private observations/unintended files. Raw recording must never enter source Git or application payload. Observe the real Pages deployment to completion.

Run `scripts/phase-2/verify-public.mjs` against the exact committed staged Pages checkout; verify every served file with fresh public HTTP hashes and nonserved markers through Git. Run supported browser acceptance plus Phase 7 journeys at the actual root; preserve native exports and reproduce them independently. Recheck public inventory and preview after acceptance. Verification reviews the exact hosted artifact and independent UI journey.

On hosted failure preserve failure evidence, fetch for concurrent changes, restore the refreshed known-good artifact via normal successor only if it does not overwrite unrelated newer work, verify deployment and every byte, and report ROLLED BACK. A repaired release must repeat all promotion gates.

Publish sanitized receipts, native selected evidence, and actual recorded walkthrough under a new noncolliding Phase 7 release tag. Keep receipts outside frozen source. Verify anonymous access and checksum for every advertised asset. Receipts distinguish candidate source/tree, accepted main, Pages commit, compiled artifact digest, rollback and preview identities, precise local/CI/hosted results and historical exclusions, distinct agents/overlap, experiments, environment limitations and actual release status.

# Phase 8 reproduction, release and rollback

**Simulated, design-stage prototype; physical validation pending.** Procedure, not acceptance receipt. The source contract and requirement matrix define mandatory gates; exact final results belong outside the frozen source tree.

In an isolated checkout of the candidate, install dependencies and recover the six immutable historical expected campaigns. The historical loader verifies the original Phase 7 evidence ZIP SHA-256 before extracting only those inputs. A local original ZIP can be supplied with `--archive=FILE`; it receives the same checksum check. It never generates expected outcomes from current code.

```sh
npm ci
git worktree add --detach /absolute/legacy-reference c22964d48ddca0e7f7db18ede972125f79dad2df
node scripts/phase-8/fetch-historical.mjs --out=/absolute/evidence/historical-inputs
node scripts/phase-8/numerical.mjs --out=/absolute/evidence/numerical
node scripts/phase-8/experiments.mjs --campaigns=/absolute/evidence/historical-inputs --legacy-checkout=/absolute/legacy-reference --out=/absolute/evidence/experiments
node scripts/phase-8/gate.mjs --campaigns=/absolute/evidence/historical-inputs --legacy-checkout=/absolute/legacy-reference --out=/absolute/evidence/local
node scripts/phase-8-history/reproduce.mjs --out=/absolute/evidence/original-regressions
node scripts/phase-8-measure.mjs --out=/absolute/evidence/operating-envelope
```

Solver 2.3.1 corrects V8-05. Historical comparisons first reproduce the untouched original campaigns through verified solver 2.3.0 in the exact legacy checkout, then create separately identified current campaigns with unchanged physical inputs. A path-specific identity ledger and original unit tolerances distinguish representational version changes from numerical differences. Old project checkpoints are inspectable/exportable; explicit current-model recalculation preserves parent identity, while exact old-version resume remains unavailable.

The gate extends the existing Phase 7 machinery: clean install, typecheck, lint, full units with both real telemetry integrations, production build/package, retained browser coverage plus Phase 8 at `/neptune-2035/`, independent numerical checks and complete-run historical reproduction. Native logs/exit status are retained. Failed attempts remain alongside subsequent accepted attempts. The original-regression ledger and bounded performance report provide their separate reproduction commands. Use one heavy test/measurement slot locally; zero retries are allowed for acceptance.

Freeze the exact commit, tree, lock digest, build settings and file manifest. Obtain Testing and independent Verification approval for the same immutable candidate and compiled payload. Push the working branch, open/update the PR and run the existing required workflow on the final PR candidate. Inspect actual run outcomes and download the single compiled artifact tested by all browser jobs. Do not substitute another build. Recheck `main` and branch rules, merge normally and prove the accepted tree equals the reviewed tree; otherwise repeat affected and full required acceptance.

Before promotion, fetch latest `codex/pages`; preserve its complete inventory and all preview bytes. Retain a recoverable Git bundle and Pages tar outside source. Rehearse extraction and hash-match every file. Production packaging uses existing `scripts/package-preview.mjs --channel=production --validated-sha=SHA --ci=URL --pr=URL --rollback=SHA --preview-tree=TREE` from accepted `main`. Only documented release metadata can differ from the tested artifact; compiled/static hashes and source tree/lock must match. The compiled manifest excludes `build-manifest.json` and `release.json`, which are separately hashed and verified. No self-referential digest is claimed.

Stage accepted files into a fresh successor of current `codex/pages`, preserving `v2-preview/`, `.nojekyll` markers and unrelated content. Push a normal successor; never force-update shared history. Wait for actual Pages deployment. Run `node scripts/phase-2/verify-public.mjs --staged=CHECKOUT --source=ACCEPTED_MAIN --out=RECEIPT`, then the same complete browser list with `NEPTUNE_BASE_URL=https://arhaan2.github.io/neptune-2035/`, `--workers=1 --retries=0`. Recheck every served byte and preview path/hash after tests. Independent Verification must approve hosted identity and behavior, separately from CI/local approval.

Publish a new immutable Phase 8 tag/release only with verified receipts, concise report, portable inputs/results, checksums and sanitized supporting evidence. Local paths/private observations are removed from public copies with hash mapping; native originals remain local. The Phase 7 video remains clearly historical and is not relabeled. Anonymously download every advertised new asset and verify its bytes; include that result in final receipts. Do not upload history, caches, recordings or raw test output to production.

If promotion compromises working production, preserve the failure and fetch for concurrent changes. Restore only the verified prior production payload through a normal successor commit, preserving preview and unrelated newer content. Observe Pages deployment and independently verify live bytes plus required behavior. Report ROLLED BACK, with Phase 8 incomplete. Prior Phase 7 baseline is `67bd6e59769172ecf012ce298f9f5353cbb251f9`; never overwrite legitimate newer work with this historical SHA without reconciling it.

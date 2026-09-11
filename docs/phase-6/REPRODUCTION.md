# Reproduce a decision campaign

Use Node 24 and npm. From a clean checkout of the source revision named in the release receipt:

```sh
npm ci
npm run decision:reproduce -- --input=/path/to/neptune-decision-campaign.json --out=artifacts/reproduction
```

The input is the actual browser download from **Compare → Phase 6 · Decision support → Export decision campaign**. Paths belong to the person running the command; the artifact carries portable resolved designs/specifications and checkpoints, without private filesystem dependencies. Import labels stored outcomes as supplied evidence. The command validates the import, reruns every planned experiment with fresh isolated state through the existing physical engine, reconstructs constraint evaluations/rankings and compares full evidence within the declared tolerances. It exits nonzero for mismatches or an incomplete rerun. It never trusts the exported winner field as an oracle.

To generate and execute a named demonstration directly:

```sh
npm run decision:reproduce -- --fixture=transfer --out=artifacts/transfer
npm run decision:reproduce -- --fixture=no-benefit-bus --out=artifacts/bus
npm run decision:reproduce -- --fixture=no-benefit-source --out=artifacts/source
npm run decision:reproduce -- --fixture=nominal --out=artifacts/nominal
npm run decision:reproduce -- --fixture=sizing --out=artifacts/sizing
npm run decision:reproduce -- --fixture=sensitivity --out=artifacts/sensitivity
```

Each output directory contains `campaign.json` (all candidates and resolved runs, including infeasible/unresolved rows), `report.md` and `reproduction.json`. The latter identifies the actual checkout, coverage, ranking and comparison result. CLI execution is serial; browser campaigns use at most two workers over the identical run contract.

The whole-run evidence retains the original Phase 4/5 success outcome. The separately versioned Phase 6 policy evaluates declared loss/interruption/recovery allowances without rewriting that outcome. Every sensitivity is a bounded exploratory assumption, not statistical confidence or manufacturer data. A cold 120-second thermal observation does not establish thermal settling or long-term adequacy.

## State and inspection

Input edits mark old results stale and cancel active work. Restart executes new isolated runs. A cancelled/incomplete campaign cannot make a final recommendation for its declared search. Navigation preserves the decision panel state; local IndexedDB retains bounded campaign definitions and supplied outcomes across refresh. Export is the portable evidence path if local storage is unavailable.

Inspecting a candidate leaves the active project intact. **Load selected candidate** is the explicit replacement action and first saves the prior project in Compare. **Run selected experiment** uses that selected resolved design, scenario, and physical initial checkpoint, then opens Operate. The saved prior project is available for recovery in Compare; the existing project export/replay controls remain supported.

## Acceptance and exclusions

The repository command `npm run decision:gate -- --out=/path/to/evidence` runs clean dependencies, typecheck, lint, all unit/integration tests with both real telemetry integrations, production build/package, and the supported prototype plus Phases 2–6 browser journeys in Chromium, Firefox and WebKit. Use an isolated clean checkout with ports 5173/4173 free. The exact commit/tree and native failures are retained. CI runs the same production browser file set with zero retries.

Only the historical **500,000-accelerator prototype Step 10s** cases in Chromium and WebKit remain excluded. Their exact native test identities and counts are derived from each gate's report. Phase 6 adds no exclusions. Physical validation, marine stability, permitting, environmental effects, protection coordination, excluded costs, meshed/parallel sources and unevaluated joint sensitivities remain unassessed.

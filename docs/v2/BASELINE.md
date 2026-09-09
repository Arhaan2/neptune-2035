# Baseline audit — 2026-09-08

The configured project directory did not exist. The existing repository was found at `/Users/arhaan/Desktop/Neptune/neptune`, clean on `codex/neptune`. An isolated worktree was created at `/Users/arhaan/Documents/ChatGPT/Neptune` on `codex/neptune-digital-twin-v2`. No user changes were moved or overwritten.

Read: AGENTS.md, existing model/source registry, scene/layout/UI, tests, state serialization, README, model, build, QA and release records. The brief explicitly supersedes the launch-only scope restriction in AGENTS.md; its security and release safeguards remain.

Verified with remote refs and live `release.json`:

| Item | Actual identity |
| --- | --- |
| Remote source branch `codex/neptune` | `8b78638838a82ee603fdb001bfc978df49a9665d` |
| Annotated `v0.1.0` tag object | `462f2fbbda5766bdd568ec58c18dd82e542529e9` |
| Tag target | `8b78638838a82ee603fdb001bfc978df49a9665d` |
| Application source reported by live manifest | `127a2fade93112d58f8edd9f6fc6e9e02b12b57c` |
| Remote `codex/pages` deployment | `672805a984feadaab375061817c919fd6849b311` |

The difference between application source and tagged source contains documentation, images and a video verification script, not runtime application changes. Production remains the v0.1.0 application. The v2 branch has not been promoted by this work.

## Fresh execution

Archived tag target into `/private/tmp/neptune-v2-baseline`, using the repository's unchanged npm lockfile dependencies. Ran rather than inherited:

- `npm run lint`: passed.
- `npm test`: 53/53 passed, two files.
- `npm run build`: TypeScript and Vite production build passed.
- `NEPTUNE_BASE_URL=http://127.0.0.1:5181 npm run test:browser`: 15/15 passed across Chromium, Firefox, WebKit, 3.3 minutes.
- Inspected an actual Chromium cooling screenshot. It confirmed a campus-wide view, representative rack glyphs, aggregate values and lack of asset-specific pump inspection.

Browser suites ran on macOS 26.6.2 (25G83), arm64, Node 24.18.0, npm 11.16.0 with installed Playwright browsers. Local bind/browser execution required sandbox escalation. These measurements describe the available machine, not ordinary-laptop or physical-mobile performance.

## Verified old gaps

| Gap | Evidence in old source / running product |
| --- | --- |
| Non-scale geometry | docs/MODEL.md explicitly schematic; layout unit spacing disconnected from 320 m² module allocation |
| Representative racks | ten glyphs represent up to eighty declared rack positions |
| Aggregate calculation | src/domain/model.ts computes counts, PUE-multiplied totals and required flow; no per-pump state |
| Limited thermal behavior | headroom subtraction and Q/(ρcpΔT); no UA, hydraulic solve or thermal capacitance |
| Similar generation meshes | generation changes makeLayout spacing/count, with same Facility geometry |
| Cooling camera | old browser screenshot shows entire campus; heat exchanger remains small |
| Guided interior | representative module with constrained camera, not navigable asset-linked physical layout |
| No telemetry | no import, stream, synchronization, measured observations or physical counterpart |

Legacy reproducibility is preserved in unchanged `src/domain`, `src/state`, `src/ui/App.tsx`, and old scene files. `?legacy=1` opens it. Existing `#s=` links also explicitly select Legacy mode; assumed PUE inputs are not migrated into the new physics.

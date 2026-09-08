# LinkedIn launch package

Drafts only. Nothing has been posted. Confirm the live links in the release record before publishing.

## Draft 1

What if we designed AI infrastructure around energy, cooling, and modularity from the beginning?

I explored that question with NEPTUNE: an interactive offshore AI data-center concept.

Start at sunset. Open the platform in X-ray. Follow the cooling circuits. Pull its systems apart. Then scale a pilot into a compute archipelago and watch the power and heat numbers change.

I supplied the thesis, art direction, scope, and engineering guardrails. Codex implemented the application and tests, then used real browser captures to find and fix issues in the framing, sharing behavior, and interior camera. My role was defining what the experience should explore and what it must not claim.

The model keeps operating power separate from installed peak demand. Its assumptions and sources are visible. The floating facility remains conceptual: power interconnection, marine engineering, maintenance and thermal discharge are unresolved.

Try it: https://arhaan2.github.io/neptune-2035/
Code and assumptions: https://github.com/Arhaan2/neptune-2035

Which constraint would you investigate first?

## Draft 2

100,000 accelerators is a number. The infrastructure around them is the interesting question.

NEPTUNE lets you explore that infrastructure: compute modules, a closed technical-cooling loop, a separate seawater circuit, external power and fiber connections.

For the default illustrative inputs, the model gives 193.2 MW operating demand and 222.0 MW peak design demand. Change utilization, PUE, scale or water temperature and see what changes—and what does not.

I set the product direction and the rules for truthful modeling; Codex built and tested the interactive scene. The working result includes X-ray, exploded views, a representative rack aisle and a repeatable demo. Browser inspection also exposed details that needed correction before release.

This is a concept simulator, not an engineered offshore facility or a forecast for 2035. The question is how making energy, cooling and modularity visible changes the design conversation.

Explore: https://arhaan2.github.io/neptune-2035/
Repository: https://github.com/Arhaan2/neptune-2035

## Demo caption

NEPTUNE — Design the AI Data Center of 2035. Sunset → X-ray → two cooling circuits → exploded systems → compute archipelago. Recorded from the working app. Concept simulator · Not an engineering design.

## Assets and publishing notes

- Preferred upload: the verified `assets/demo/neptune-demo.mp4` once the release record marks encoding/playback complete.
- Hero/social card: `public/social-preview.png`, captured from the application.
- Six inspection screenshots: `docs/images/` after hosted acceptance; full browser captures stay in `assets/screenshots/` locally.
- Portrait composition: `assets/screenshots/presentation-4x5.png` is a real 800×1000 app capture; no separate portrait video is claimed.
- The brief and guardrails were human inputs. Do not imply a specific model identity, elapsed build time, percentage of autonomy, or user intervention during fixes that the user did not actually make.

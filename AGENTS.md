# NEPTUNE

Static Vite + React 19 + TypeScript + React Three Fiber 9. npm is the only package manager. The runtime uses static Vite because the product needs no backend; the Sites starter UI primitives are retained. Public deployment uses a dedicated GitHub Pages repository because its public free hosting eligibility is documented.

Commands: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:browser`.

`src/domain` owns engineering calculations/validation; `src/state` bounded versioned URL serialization; `src/scene/layout.ts` canonical layout and exploded offsets; `src/scene` representative geometry; `src/ui` consumes the same model and owns the real-app storyboard. Tests in `tests`; build log, assumptions, QA and launch in `docs`.

Guardrails: no credentials or recordings in Git, no runtime external assets, no future hardware claims, no duplicate formulas in UI, no seawater-to-GPU path, no utilization reduction of design peak. Keep concept qualifier visible. No backend or stretch features before core acceptance. Only lead owns Sites checkout/deployment. Do not touch parent repository or unrelated services.

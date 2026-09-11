# Validation and readiness

**Design-stage digital twin · Simulated operation.** Readiness is scoped by use and evidence, never a campus-wide green badge.

| Area | Delivered evidence | Status / evidence still required |
| --- | --- | --- |
| Reference design | Versioned exact inventory, packing, masses, ports, routes, provenance | Implemented illustrative design; actual equipment specification and survey pending |
| Software correctness | Unit/integration checks, deterministic replay, input bounds, real-browser acceptance | Verified within recorded cases; final counts and code identity in RELEASE-CANDIDATE.md |
| Numerical verification | Independent analytic/rational fixtures and RK4 comparison; residual and timestep checks | Verified for declared cases/tolerances; no blanket validity outside model-card domain |
| Data integration | Generated samples, raw/normalized imports, historical replay, actual SSE reconnect | Implemented and tested locally; a secure compatible production gateway is not deployed |
| Calibration workflow | Bounded exchanger-UA fitting, chronological held-out evaluation and identifiability checks | Software verified with generated fixtures; compatible calibrated measurements pending |
| Empirical model validation | No physical facility observations supplied | Pending identified counterpart, sensor provenance/uncertainty, representative operating regimes and intended-use acceptance criteria |
| Marine/spatial screening | Exact envelope/overlap, mass, rectangular-pontoon draft/freeboard, average deck load | Reduced screens only; stability, mooring, fatigue, storms, point loads, corrosion and permissions unassessed |
| Operational commissioning | No physical control or deployment authority supplied | Unassessed; site acceptance and authorized read-only mapping required before any operational claim |

## Reviewable next evidence

For one identified module, establish equipment serials/catalog data and a versioned asset/channel mapping. Supply calibrated power, temperature, flow and storage observations with synchronized times, units, quality flags and uncertainty. Cover nominal operation and authorized disturbances across the proposed intended-use envelope. Define acceptance tolerances before fitting. Preserve a chronological held-out interval and report both training and held-out residuals, parameter bounds and identifiability failures. A fitted UA cannot validate unrelated power, structural or marine behavior.

The software has no hidden estimator or forecast. Unmeasured state remains simulated or unknown; stale observations become stale/unknown. Any future assimilation or forecasting capability requires its own explicit model, uncertainty treatment and verification.

## Known implementation limits

- Generic hardware, pump curves, UA, capacitances, efficiencies, costs and structural masses are assumptions. No manufacturer endorsement, quotation or hardware compatibility validation is asserted.
- Electrical analysis is a radial capacity/energy allocation, not AC load flow or protection coordination. Legacy Family III open ties confer no transfer benefit. The explicit Phase 5 preset models one-hop open-before-close whole-platform transfer after eligible local feeder failure, with native-first shared capacity and no independent-feed credit for a common source failure. Energized meshes, synchronized parallel sources, automatic retransfer and physical switchgear control remain unsupported. Exact software acceptance is recorded in [Phase 5 evidence](../phase-5/REQUIREMENT-MATRIX.md); physical validation remains pending.
- Technical and seawater loops are separate equivalent circuits. Rack branches are explicit assets and wet mass, but individually balanced rack hydraulics, cavitation, water hammer and multiphase flow are unmodeled.
- Temperatures are module bulk coolant and air nodes, not GPU junctions or CFD fields. Control thresholds and startup delays are declared assumptions.
- Network demand uses a versioned illustrative traffic profile. Job-specific demand validation, packet latency and training performance remain outside scope.
- Sizing samples a bounded set of whole-platform counts with the same supported constraints and disturbance. It is not a proof of global optimality; unknown site costs and unassessed marine studies cannot become passing constraints.
- Interior navigation is bounded to the modeled clear aisle with guided waypoints. It is not free roaming, an evacuation simulation or accessibility certification. Touch alternatives are exercised through emulation, not a physical phone.
- Geometry export is dimensioned glTF visualization, capped at 30,000 meshes. No manufacturing CAD, STEP, IFC or BIM exporter is claimed.
- Streaming is read-only and optional. Actual HTTP/CORS/native reconnect is tested locally; trusted production TLS/authentication deployment and real hardware synchronization remain pending. GitHub Pages does not host the local gateway.

See DATA.md, MODELS.md and SCENE.md for exact contract, numerical and geometric limits. The release record separates software test results, numerical timings, visual inspection and empirical readiness.

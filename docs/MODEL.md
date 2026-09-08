# Model and representation

NEPTUNE is a conceptual digital-twin-style simulator, not a telemetry-connected digital twin or an engineered offshore facility. Dates label scenarios; they do not forecast hardware or deployment.

All numerical results come from `src/domain/model.ts`. Inputs use explicit units and finite bounds. Invalid domain inputs throw a structured-validation-derived RangeError; UI and sharing restore safe values with a notice. Shared state is bounded to 2,500 encoded characters, versioned, parsed as JSON, validated, and stripped of unknown fields.

## Electrical model

- Eight GPUs per whole node. `nodes = ceil(requested GPUs / 8)`. Requested and provisioned capacity stay distinct.
- Default node maximum: 14.3 kW, anchored to NVIDIA's DGX B200 whole-system maximum. It includes the node's CPUs, memory, fans and onboard networking. It is not GPU-only or measured average draw and does not endorse this cooling architecture.
- External networking/storage adds an illustrative 8% of compute peak.
- Operating compute draw is peak × (idle fraction + (1 − idle fraction) × utilization). Default idle fraction is 30%; utilization is 80%. External networking/storage stays constant.
- PUE defaults to an assumed 1.15. Multiplying power by PUE approximates an energy ratio at constant operating conditions.
- Annual energy is operating facility MW × 8,760 hours. It is a constant-load scenario, not telemetry or a bill.
- Supply ceiling warnings compare against installed peak, even at low utilization. No supply source is inferred from the ocean.

## Capacity and spatial assumptions

Four 10U nodes occupy 40U of a 48U rack, leaving an 8U allowance. Maximum supported node input of 30 kW fits the declared 120 kW/rack allocation. Each module reserves 320 m² for 80 racks (4 m²/rack including circulation). Eight modules form one modeled platform. These are illustrative allocations, not structural, maintenance-clearance or cooling certification. Last racks, modules and platforms can be partially occupied.

Scene geometry is schematic and not to physical scale. A visible module contains ten rack glyphs illustrating up to eighty rack positions. Up to 25 platform glyphs are rendered; larger configurations aggregate platforms. Exact inventory comes from the model, not glyph counting. Platform identity and canonical layout are shared by exterior and guided interior. Instanced meshes bound draw calls without rendering each GPU.

## Thermal model

Boundary: all modeled IT heat is rejected to the seawater heat exchanger; ancillary facility heat is excluded. Closed technical coolant passes through equipment/CDU and the technical side of the exchanger. A separate seawater intake/discharge circuit passes through the seawater side. Fluids do not mix. Animated dots show fluid motion; heat crosses the exchanger.

`flow m³/s = IT heat MW × 1,000,000 / (density kg/m³ × heat capacity J/(kg·K) × rise K)`.

Density = 1,025 kg/m³ and specific heat = 3,990 J/(kg·K), illustrative constants supported as approximate ranges, not surveyed properties. Default seawater rise is 5 K; it is not a permit limit. Operating and peak flow are separate.

`headroom °C = technical supply target − (seawater inlet + exchanger approach)`.

Defaults: target 32°C, seawater 18°C, approach 5°C. Zero or negative headroom warns. Positive headroom does not establish feasibility. Ocean temperature changes this screen without inventing a PUE relationship.

## What remains unresolved

Power availability/interconnection; marine stability and loads; mooring; corrosion; biofouling; environmental thermal discharge; weather and maintenance access; fire safety; external fiber routes; permitting. No pump/hydraulic solver, heat-exchanger area sizing, chiller model, naval architecture, workload throughput, training-duration, cost, renewable-firming, reliability, or investment claims are made.

`src/domain/sources.ts` contains the local source registry, exact supported claims, publishers, URLs, limits and checked dates. The UI reads that registry. NVIDIA, The Green Grid, WHOI, TEOS-10 and Microsoft Research references were checked on 2026-09-08. Natick supplies historical subsea context only, with no transfer of measured outcomes to this floating design.

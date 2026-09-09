# NEPTUNE v2 engineering scenario

Design-stage digital twin · Simulated operation

Creator: Arhaan Aggarwal. Design reference-v2-e2d38cc3; solver 2.0.0-rc.1; simulated interval 0–15 s. No physical counterpart or measured validation is asserted.

## Inputs and provenance

```json
{
  "schemaVersion": 2,
  "generation": 1,
  "requestedAccelerators": 1280,
  "supplyW": 30000000,
  "standbyPumps": 1,
  "seawaterK": 291.15,
  "workload": 0.8,
  "idleFraction": 0.3,
  "exchangerUAWPerK": 350000,
  "foulingResistanceKPerW": 0,
  "batteryWhPerModule": 0,
  "batteryMaxWPerModule": 2200000,
  "pumpSpeed": 1,
  "requireExternalNetwork": false,
  "requireClusterNetwork": true,
  "budgetUSD": null
}
```

## Results (SI)

```json
{
  "timeS": 15,
  "itW": 1651199.9999999998,
  "facilityW": 1783545.271771995,
  "gridW": 1783545.271771995,
  "pumpPowerW": 26238.135346458595,
  "availableAccelerators": 1280,
  "energizedAccelerators": 1280,
  "curtailedAccelerators": 0,
  "maxCoolantK": 303.0330760032551,
  "batteryWh": 0,
  "instantaneousPUE": 1.0801509640092024,
  "energyPUE": 1.0801509640092024,
  "electricalResidualW": 0,
  "thermalResidualW": 9.00399754755199e-11,
  "warnings": []
}
```

## Equations and boundary

Whole-server IT draw = energized units × 12000 W × (idle fraction + (1 − idle fraction) × workload). Power capacity allocation includes cooling and losses. Battery ΔE = (η_charge P_charge − P_discharge / η_discharge) Δt / 3600. Hydraulic work = Δp Q / η. Counterflow HX: Q = ε C_min ΔT; NTU = UA / C_min; fouling: UA_eff = 1/(1/UA + R_f). Thermal storage: C dT/dt = Q_generated − Q_removed. Pontoon draft = supported mass / (ρ × actual waterplane). Energy PUE = facility energy / IT energy over 0–15s; zero denominator undefined.

## Constraints

- EL-01 Installed electrical capacity at peak: **satisfied** — Full workload irrespective of network job blocking, cooling and conversion at configured pump speed, with storage held at reserve: 1280/1280 accelerators energizable through rated source/feeders. Installed IT peak 1.92 MW; supply 30.00 MW.
- EL-02 Current load allocation: **satisfied** — 1280 energized; 1280 workload accessible; 0 accelerators not energized.
- TH-01 Current bulk coolant and residual air: **satisfied** — Maximum coolant 29.88 °C at t=15s. Bulk states and thermal-controller curtailment; not GPU junction temperature.
- TH-02 Peak cooling at declared bulk limits: **satisfied** — 1/1 modules can reject whole-server peak heat at 318.15 K coolant and 313.15 K air using current achieved flows, seawater and fouling. Equivalent-loop steady boundary screen, with assumed air conductance; no CFD certification.
- GE-01 Equipment envelope and overlap: **satisfied** — Declared racks/support equipment fit module bounding boxes without overlaps. Service aisles screened by reference layout; fire code unassessed.
- MA-01 Rectangular pontoon displacement: **satisfied** — Minimum modeled freeboard 4.10 m, with 1 m declared reserve. Buoyancy only.
- MA-02 Declared deck load: **satisfied** — Average supported deck load uses the actual declared deck area and assumed 2500 kg/m² limit; local point loads and structure unassessed. Unknown mass does not pass.
- NW-01 Workload connectivity: **satisfied** — Cluster required: true; external required: false. Enabled typed-graph paths and failed assets: 0 unreachable job domains; 0 unsupported domains. With no energized compute, current workload reachability is not demonstrated.
- NW-02 Network demand bottleneck: **satisfied** — Assumed profile illustrative-job-traffic-v1: 100 Mbit/s cluster + 1 Mbit/s external per energized node when each class is required. Declared demand 16.000 / 0.000 Gbit/s (cluster / external); 160 energized nodes. 0 overloaded edge/port resources; 0 whole job domains unavailable.  Zero energized nodes gives zero offered demand. Capacity acceptance is not delivered throughput, packet latency or training speed.
- MA-03 Marine survival and site permission: **unassessed** — Intact/damage stability, mooring, fatigue, storms, corrosion, thermal discharge and environmental permissions require independent studies.
- VV-01 Physical calibration / commissioning: **unassessed** — Calibration/physical validation pending. No identified facility, compatible measured time series, sensor calibration or commissioning acceptance.

## Cost assumptions

Dated 2026-09-08; editable cost multiplier 1; included scope estimate USD 74325000. Range 52027500–111487500 is a paired assumption range, not a statistical confidence interval. Land, shore/grid works, finance, permits, taxes, mooring, operations, replacement, proprietary hardware options. Illustrative assumptions; no vendor quotations. Base electrical allowance excludes separately counted installed storage at assumed USD 500/kWh; base cooling includes duty/seawater pumps but excludes the optional standby pump at assumed USD 25000/unit.

## Included cost breakdown

| Scope | Quantity | Assumed unit USD | Total USD |
| --- | ---: | ---: | ---: |
| Compute | 160 | 250000 | 40000000 |
| Racks | 40 | 5000 | 200000 |
| Platform + assumed hull scope | 1 | 8000000 | 8000000 |
| Cooling base (duty + seawater pumps, HX, CDU) | 1 | 575000 | 575000 |
| Optional standby pumps | 1 | 25000 | 25000 |
| Electrical base (excludes battery storage) | 1 | 600000 | 600000 |
| Installed battery storage (kWh) | 0 | 500 | 0 |
| Networking | 1 | 150000 | 150000 |
| Installation | 20% of equipment | — | 9910000 |
| Contingency | 25% of equipment + installation | — | 14865000 |

## Numerical evidence

Electrical residual 0 W (0 normalized by max(1 W, total grid input + battery energy-depletion power)); thermal residual 9.00399754755199e-11 W (5.0483706189337725e-17 normalized by max(1 W, total facility heat sources)). Inspect docs/v2/MODELS.md and tests for declared tolerances. Software and numerical verification are separate from empirical validation. Calibration/physical validation pending.

## Sources / assumptions

- illustrative-job-traffic-v1 [assumed], revision 1.0.0, 2026-09-08: cluster 100000000 bit/s/node; external 1000000 bit/s/node. Simultaneous one-direction source-to-node offered demand per energized node; optional network classes carry no required-job demand. No packet, latency, training-speed or delivered-throughput prediction.
- generic-hardware-v2 [assumed] Illustrative DLC-12 whole-server envelope: 8 accelerators, 10U, 12 kW whole-server peak, 120 kg, 90% liquid capture. Generic co-designed envelope, not a commercial product. Scope limit: Power, mass, cooling compatibility and performance require manufacturer evidence before procurement.
- layout-v2 [assumed] Reference packing and structure: 24 × 10 × 4 m modules; two rows of 20 racks; 58 × 28 m deck; two 58 × 6 × 5 m rectangular pontoons. Scope limit: Geometric and hydrostatic screens only. Clearances are declared assumptions, not code certification.
- equipment-v2 [assumed] Support equipment envelope: Pump curves, pipe roughness, exchanger UA, UPS capacity, structural masses and efficiencies are explicit editable/design assumptions. Scope limit: No vendor quotation, performance curve certification, site survey or operational measurements.
- nist-twin [sourced] NIST — Essential Elements: Physical counterpart, connection and synchronization distinguish an operational twin. Scope limit: Provides terminology; does not validate this facility. https://www.nist.gov/digital-twins/essential-elements
- nasa-7009 [sourced] NASA-STD-7009B — Models and Simulations: Separate model credibility, verification, intended use and validation evidence. Scope limit: Methodological reference; no NASA certification or conformance assertion. https://standards.nasa.gov/standard/NASA/NASA-STD-7009
- entu [sourced] MathWorks — Effectiveness–NTU heat transfer: Heat transfer using capacity rates, UA, effectiveness and inlet temperature difference. Scope limit: Equation reference; assumed UA and fluid constants remain unvalidated. https://www.mathworks.com/help/hydro/ref/entuheattransfer.html
- lbl [sourced] LBNL — Modelica Buildings: Dynamic reduced-order systems and controls are useful for design exploration. Scope limit: No Modelica dependency or cross-validation claimed. https://simulationresearch.lbl.gov/modelica/
- seawater [assumed] Constant fluid approximation: Sea density 1025 kg/m³ and cp 3990 J/(kg K); technical water 997 kg/m³ and cp 4180 J/(kg K). Scope limit: Illustrative constants over the declared near-ambient range; no salinity/property solver. https://www.teos-10.org/pubs/gsw/html/gsw_cp_t_exact.html

## Events

```json
[
  {
    "id": "feeder-loss",
    "timeS": 5,
    "kind": "trip",
    "assetId": "shore/bus"
  },
  {
    "id": "feeder-recovery",
    "timeS": 10,
    "kind": "restore",
    "assetId": "shore/bus"
  }
]
```

Raw observations, secrets and private data are excluded from this default artifact. Geometry is dimensioned visualization, not manufacturing CAD.

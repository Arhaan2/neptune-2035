# NEPTUNE v2 observation contract and verification

The default product remains **Design-stage digital twin · Simulated operation**. The data software accepts generated or explicitly labelled measured observations. No identified physical facility, sensor calibration certificates, or compatible measurements have been supplied. **Calibration/physical validation pending.** A working connection and a successful generated fit do not commission equipment.

## Implemented paths

| Path | Implementation | Evidence boundary |
| --- | --- | --- |
| Simulation-generated observations | `generateObservations(design, state, seed, options)` samples actual `SimulationState` channels, with independently keyed deterministic noise/dropout | Verifies solver-to-observation plumbing; generated evidence |
| Local CSV/JSON import | Strict parsing, explicit field/asset/metric mapping, source namespaces, unit normalization, version validation | A file is never implicitly a measurement |
| Historical replay | `replayObservations` sorts by observation time and sequence, stopping at the selected time | No interpolation, gap filling, clock shifting, or assimilation |
| Read-only live stream | Native browser `EventSource`, actual reconnect/Last-Event-ID, received-time metadata, inactivity status | Optional local or HTTPS gateway; static application needs no backend |
| Residual evaluation | Exact channel/version/unit matching, nearest timestamp within explicit tolerance | Generated predictions and observation provenance remain visible |
| Bounded UA proposal | Production exchanger solver, bounded 1-D search, chronological train/holdout split | A fitting proposal; never silently changes the design |

The interactive **Data & replay** panel provides import/mapping controls, source selection, original raw rows, historical time selection, simulated observation dropout, read-only connection controls, source reset boundaries, residuals, and calibration. The panel stays mounted while hidden, so observations persist when switching workspaces/details. A new design revision or page reload starts a new in-memory data session. Default project/share exports exclude private observations and stream URLs.

## Observation schema

```json
{
  "assetId": "platform-001/module-01",
  "metric": "temperatureK",
  "value": 37,
  "unit": "C",
  "sourceId": "generated:import-fixture",
  "evidence": "generated",
  "observedAt": "2026-01-01T00:00:00.000Z",
  "receivedAt": "2026-01-01T00:00:00.050Z",
  "sequence": 0,
  "quality": ["fixture-generated", "simulated-clock"],
  "mappingVersion": "reference-v2-aa6189d9"
}
```

- `assetId` must resolve against the exact design, including lazy rack/node IDs. An asset's existence does not prove a physical sensor is attached to it.
- `metric` names a supported normalized quantity. Module `temperatureK` means bulk technical coolant, not GPU junction temperature. Module `powerW` means IT electrical power; `pumpPowerW` means the module's aggregate pump power.
- `value` must be finite, in range, and compatible with `unit`. Unknown is an absent reading, never zero by default.
- `sourceId` must start with `generated:` or `measured:` and agree with `evidence`. Safe identifier characters are letters, digits, `.`, `_`, `:`, `/`, and `-`; at most 128 characters. Explicitly generated input cannot be promoted to measured by a mapping.
- `observedAt` and `receivedAt` require valid ISO 8601 dates with timezone. Calendar-overflow dates and ambiguous local dates are rejected. Streaming preserves the publisher's raw reception timestamp but uses actual browser reception time for normalized ingestion.
- `sequence` is a nonnegative safe integer. Packet streams normally increment by one per source/channel. Generated simulation sequences are elapsed simulated milliseconds, explicitly flagged `sequence-simulated-ms`.
- `quality` is an array of short flags; CSV uses `|` separators. `bad`, `invalid`, and `sensor-failed` make a reading unknown. The normalizer appends unit/version/source conversion flags; the store appends delay/gap flags.
- `mappingVersion` must exactly match `design.revision`. The current revision is displayed in the application. The example/supplied files target the default reference configuration at file creation; changed designs require an explicit reviewed remapping.

JSON accepts an observation array or `{ "schemaVersion": 2, "observations": [...] }`. Other envelope versions fail visibly. CSV requires unique, nonempty headers and supports quoted commas, doubled quotes, and embedded newlines. Import limits are 2 MiB and 20,000 records. Raw parsed records remain separate from accepted normalized observations and row-specific errors. CSV cells are treated as data; they are never evaluated as spreadsheet formulas.

### Supported quantities

| Normalized metric | SI/declared unit | Accepted input units | Ingestion range |
| --- | --- | --- | --- |
| `temperatureK`, `airTemperatureK` | K | K, C/°C, F/°F | 0–1,000 K |
| `flowM3S` | m³/s | m3/s, m³/s, L/s, L/min, m3/h | 0–1,000 m³/s |
| `seawaterFlowM3S` | m³/s | m3/s, m³/s, L/s, L/min | 0–1,000 m³/s |
| `powerW`, `pumpPowerW` | W | W, kW, MW | 0–10¹² W |
| `batteryWh` | Wh | Wh, kWh, MWh, J | 0–10¹³ Wh |
| `pressurePa` | Pa | Pa, kPa, bar | 0–10⁹ Pa |
| `workloadFraction` | 1 | 1, % | 0–1 |

These broad ranges guard data ingestion; they do not declare equipment safe or extend the narrower solver/model-card validity domain. Energy uses the shared contract's explicit Wh storage unit: J/3,600 = Wh. Absolute Celsius temperature conversion adds 273.15; it must not be applied to a temperature difference.

### Explicit field mapping

The panel accepts mapping JSON such as:

```json
{
  "fields": { "assetId": "sensor", "metric": "channel", "value": "reading" },
  "assetIds": { "loop-a": "platform-001/module-01" },
  "metrics": { "bulk": "temperatureK" }
}
```

`sourceId`, `evidence`, `receivedAt`, and `mappingVersion` can be explicit mapping defaults/overrides when needed. They are not inferred from a filename. The separate design-remap checkbox sets the current design revision and records `explicit-version-remap`; original fields are preserved. A generated-to-measured promotion is rejected even if both the namespace and evidence are overridden. Unit conversions come only from the metric registry, not arbitrary executable expressions.

Sample files: `public/samples/telemetry-generated.csv`, `telemetry-generated.json`, and `calibration-generated.json`. The observation fixtures intentionally omit sequence 3 so the store reports a gap. They are generated pipeline fixtures, not measurements or physical-validation evidence.

## Synchronization and clock behavior

`new TelemetryStore(design, { staleAfterMs: 5000, maxClockSkewMs: 2000 })` indexes every reading by **asset + metric + source**. `latest(assetId, metric, sourceId)` and `staleness(...)` require an explicit source. A generated value cannot replace a measured value under that key. All returned normalized objects are detached copies.

- Exact repeated sequence/value/time is rejected as a duplicate. Same sequence with different value/time is rejected as a sequence conflict.
- Lower sequence or earlier observation time is preserved in raw history and rejected for latest state. Reconnect does not automatically reset sequence checks.
- A packet-sequence jump is accepted with an explicit `sequence-gap:N` flag. Simulation-millisecond sequences do not infer packet gaps; observation age still detects dropout.
- Observations more than the configured skew allowance **ahead** of reception are rejected. Late historical observations are accepted with a delayed flag and remain stale at live time.
- Freshness uses the older of observation and reception age. Missing readings are unknown. Values ahead of the selected live/replay clock are unknown. Invalid source quality is unknown. Stale values remain visibly stale; there is no hidden gap filling.
- `resetSource(sourceId, reason)` is an explicit restart boundary. It clears the source's latest readings and active normalized replay segment to avoid mixing reused sequence/time coordinates. Bounded raw history remains available; the boundary is displayed. Simulation reset/replay automatically records its own generated-source boundary.
- The store retains 5,000 normalized history records, 5,000 original ingestion records, at most 2,000 live channel/source keys, and 100 reset boundaries by default. The panel expands its live-key allowance to eight generated channels per module plus 32 extra source keys, within a 20,000-key cap. This covers all 6,256 generated channels in the supported million-accelerator design; at that size, the 5,000-record historical window cannot retain even one complete multi-channel snapshot. Live/latest readings remain indexed separately. The panel displays these bounds and any recent channel-limit rejections. It retains the last three local imports and shows the first twelve module coolant readings.

The generated clock is `2026-01-01T00:00:00Z + SimulationState.timeS`. Its packet content and seeded noise/dropout depend on asset, metric, simulated time, and seed, so resampling the same state is idempotent. Drop generated observations, then advance more than five simulation seconds to see stale status. Pausing the simulation also pauses this explicitly simulated observation clock. A live external source uses wall time. Imported data starts at its historical clock. Neither operation changes thermal states or unmeasured quantities.

## Actual local SSE publisher

Run the app with `npm run dev`, open Data & replay, and copy the displayed design revision into:

```sh
node scripts/telemetry-publisher.mjs --mapping-version reference-v2-aa6189d9
```

Then connect to `http://127.0.0.1:8787/events` from the local app. This publisher is an explicit **generated fixture**, independently varying by sequence. It is not a physical sensor, simulation truth, or a service deployed on GitHub Pages. The default mapping version is a deliberately unmatched placeholder unless supplied; version mismatches are rejected visibly.

Useful test options:

```sh
node scripts/telemetry-publisher.mjs --mapping-version reference-v2-aa6189d9 --interval-ms 1000 --disconnect-every 3 --dropout-every 4
```

The server binds only `127.0.0.1`, defaults to port 8787, and serves only read-only `GET /events` plus CORS preflight. `--port` and `--asset-id` are configurable. There is no equipment command route, arbitrary URL fetch proxy, database, or credential handling. Each SSE event has a numeric `id` and JSON `data`. Native browser EventSource reconnects using Last-Event-ID. The publisher replays up to 300 retained samples after that ID; older missing ranges remain explicit sequence gaps. Restarting the process restarts sequence numbers and requires an explicit source reset in the panel.

CORS defaults allow exactly `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:4173`, and `http://localhost:4173`. `--origin` accepts a comma-separated exact-origin list. Wildcards are rejected. CORS is not authentication; loopback binding and the absence of real/private measurements are the current boundary.

For a trusted local TLS setup, supply `--tls-cert /path/to/certificate.pem --tls-key /path/to/private-key.pem`. Keep private keys outside the repository. The adapter permits credential-free HTTPS or explicit loopback HTTP, forbids embedded credentials/fragments/secret-bearing query parameters, and sets `withCredentials:false`. It has no authentication/token flow. A protected production gateway requires a separately reviewed deployment/authentication design before real compatible observations are connected. Browser mixed-content, local-network permissions, and certificate trust may block a hosted static page from reaching a local publisher; use the tested localhost development origin. A hosted site does not secretly include this gateway.

`connectStream(url, onSample, onStatus)` returns a disconnect function. The callback receives the original JSON plus `{ receivedAt, lastEventId }`; the caller feeds `store.ingest(raw, { receivedAt })`. The transport handles open/reconnect/invalid JSON/oversize payload/inactivity/close states. Identity, version, units, sequencing, and source quality are validated by the store. Maximum individual payload is 64 KiB.

## Residuals and reproducible bounded calibration

`calculateResiduals(observations, predictions, maxTimeDeltaMs=1000)` matches asset, metric, unit, and design revision, then selects the nearest explicitly generated prediction within the tolerance. It does not interpolate or guess clock offsets. Predictions can be imported as a distinct generated source and selected in the panel to align an intentionally prepared prediction history with real timestamps. Bias, MAE, and RMSE are grouped by channel/unit/source; units are never combined into one error score. A zero prediction yields an undefined relative residual (`null`), not division by zero.

`calibrateUA(design, samples, {minUAWPerK,maxUAWPerK,trainingFraction})` fits the current production effectiveness–NTU exchanger model. Each calibration sample has:

```json
{
  "assetId": "platform-001/module-01/hx",
  "mappingVersion": "reference-v2-aa6189d9",
  "sourceId": "generated:calibration-fixture",
  "evidence": "generated",
  "observedAt": "2026-01-01T00:00:00.000Z",
  "observedHeatW": 2000000,
  "boundary": {
    "technicalInletK": 309,
    "seawaterInletK": 291,
    "technicalFlowM3S": 0.05,
    "seawaterFlowM3S": 0.06,
    "foulingResistanceKPerW": 0
  }
}
```

The example's heat is illustrative; the supplied calibration fixture contains values generated by the actual solver at 280,000 W/K. At least six unique timestamped samples from one mapped exchanger are required. Bounds must remain within the design's 10,000–2,000,000 W/K supported range. Earliest 70% train by default; at least two later samples are held out. The routine scans 81 bounded candidates and refines the best bracket using golden-section search until ≤ max(0.01 W/K, 10⁻⁸ × UA) bracket width or 80 iterations. This is a bounded scalar fitting method, not a proof of a global optimum for arbitrary inconsistent measurements. Zero-flow/equal-temperature/negligibly sensitive datasets fail as unidentifiable.

The result records baseline/proposal, bounds, split time/counts, before/after training and held-out RMSE, convergence, bound contact, source IDs, measured count, design revision, and warnings. Held-out deterioration is flagged. No proposal is automatically applied. Boundary/flow/property/fouling measurement error may be absorbed into the fitted UA; multivariate identification, uncertainty distributions, estimation of unmeasured states, and forecasts are unimplemented. Applying a reviewed proposal through design editing creates a new revision/reset through the existing design workflow.

## Verification and readiness

Focused automated checks cover conversions, lazy asset mapping, invalid units/numbers/timestamps/schema, raw preservation, duplicate/conflict/order/gap/skew/staleness, evidence separation, source resets, bounded history, deterministic simulator sampling, seeded dropout, residual matching, bounded UA recovery, unidentifiability, and held-out deterioration.

Actual transport checks start a temporary localhost HTTP publisher and use Node fetch to verify SSE payloads, Last-Event-ID replay, CORS denial, malformed sequence rejection, and absence of a proxy route. Opt-in Chromium verification loads the production adapter and observes native reconnect/Last-Event-ID, deliberate dropout gaps, and stale transport status. The running-app opt-in test exercises DataPanel mapping, raw rows, simulated dropout, calibration, and actual stream reconnect and saves `artifacts/v2/telemetry-panel.png`.

```sh
npm exec vitest run tests/twin-telemetry.test.ts
NEPTUNE_TELEMETRY_BROWSER=1 npm exec vitest run tests/twin-telemetry.test.ts
# With npm run dev already serving the app at 127.0.0.1:5173:
NEPTUNE_TELEMETRY_BROWSER=1 NEPTUNE_TELEMETRY_APP=1 npm exec vitest run tests/twin-telemetry.test.ts
```

Browser tests require a Playwright Chromium installation. Restricted sandboxes must permit temporary loopback listening and browser launch. These are software integration tests on the available browser, not operational validation of a real facility.

Executed on 2026-09-08 (America/Los_Angeles), Node v24.18.0 and installed Playwright Chromium: the full command with **both opt-in flags passed 47/47 tests, no skips**, in 4.36 seconds. The running-app test reported zero page errors. `npm run typecheck` and `npm run lint` also passed. The generated `artifacts/v2/telemetry-panel.png` was opened and visually inspected: raw Celsius cells remain visible beside normalized output, source labels show generated/unknown correctly, the actual transport reports a reconnect, and the generated 280,000 W/K fit shows seven training and three held-out records with a persistent physical-validation-pending qualifier. The optional TLS certificate path is implemented but a trusted-certificate end-to-end deployment was not tested.

| Readiness area | Status / required next evidence |
| --- | --- |
| Design-linked data contract | Implemented; exact versioned mappings and source namespaces |
| Generated/import/historical/SSE software | Implemented; focused and actual transport verification |
| Bounded parameter-fit workflow | Implemented for one exchanger UA, including held-out evaluation |
| Measured operational integration | Pending an identified asset, compatible channels/times, approved read-only gateway and sensor provenance |
| Empirical physical-model validation | Pending calibrated measurements, operating-regime coverage, uncertainties and acceptance tolerances for an intended use |
| Operational commissioning | Unassessed; no physical counterpart or control authorization supplied |

Connecting one measured sensor would change only that source's evidence scope. It cannot mark the module, offshore platform, campus, physical model, or marine design validated.

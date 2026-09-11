# Phase 3 reference equipment and accounting

Scalable provisioning chooses the smallest fixed shore chassis with at least one output port per platform: 8, 32, or 256 outputs. Each output is 400 Gbit/s; respective shared source-to-node switching budgets are 3.2, 12.8, and 25.6 Tbit/s. A 100,000-accelerator design has 20 platforms and therefore uses the 32-port chassis. The 1,000,000 selectable maximum has 196 platforms and uses the 256-port chassis. No rating is scaled continuously by compute count.

The deliberately undersized chassis has 256 output interfaces sharing only 400 Gbit/s. Multiple connectors cannot multiply its fabric budget. The original Phase 2 network remains a separate supported legacy topology with its original shared 400 Gbit/s output port and workload profile.

| Installed record | Power W | Operational mass kg | Envelope m | Included USD |
| --- | ---: | ---: | --- | ---: |
| Core, 8 outputs | 8,000 | 400 | 1.2 × 2 × 1.2 | 120,000 |
| Core, 32 outputs | 20,000 | 900 | 2 × 2 × 1.2 | 350,000 |
| Core, 256 outputs | 100,000 | 4,000 | 6 × 2.2 × 1.5 | 1,500,000 |
| Undersized shared core | 3,000 | 700 | 2 × 2 × 1.2 | 50,000 |
| Platform switch, 4 outputs | 1,500 | 600 | 2 × 2 × 1 | 25,000 |
| Module switch, 40 outputs | 3,000 | 100 | 1.1 × 1.5 × 0.6 | 20,000 |

Every platform/module output has a distinct deterministic endpoint assignment. Both devices have a fixed 400 Gbit/s shared switching budget. External traffic enters the shore core through one 400 Gbit/s input and shares downstream cluster links, ports and switch budgets. One egress charge per traversed switch counts source traffic and transit traffic exactly once; no reverse-direction pooling is modeled. Each platform remains one conservative required-job domain. A failed local module switch blocks that entire platform job domain; the shore core is common to all domains.

These are synthetic, assumed reference records, not vendor products or measured training traffic. The unchanged declared rates are 100 Mbit/s cluster and 1 Mbit/s external per energized eight-accelerator node when required. Installed assessment evaluates all provisioned nodes independently of power/thermal state. Current assessment uses energized nodes. Neither is training-throughput or whole-campus viability validation.

Root network switches have explicit radial power connections and no modeled UPS. Their fixed loads receive deterministic priority (shore core, then platform ID order) before module loads and battery charging; inadequate or failed supply makes the affected switch unavailable. Module switch draw consumes the existing critical bus and UPS and contributes to the existing module bulk thermal boundary. Root/platform switch heat is outside that module boundary and is not thermally assessed. Source/transformer losses are included in root network electrical demand. Shore mass is excluded from floating-platform hydrostatics; declared platform and module masses remain in inventory and marine screens.

For Phase 3 the entire legacy USD 150,000-per-module bundled networking row is replaced by these itemized switch prices, including a synthetic transceiver/link-material allowance. No second bundled networking charge is retained. Existing installation and contingency percentages still apply once. Independent cable installation design, shore/grid works and unmodeled cooling remain excluded/unknown. Missing explicit network prices produce a known subtotal with identified missing asset IDs, never a complete included-cost claim. Legacy projects retain their original networking allowance.

Changing preset or stored network-link enabled state creates a new engineering revision. Resizing retains disabled links with matching IDs and rejects removed disabled-link mappings explicitly; it never silently enables them. Root workflow preserves the preceding experiment before starting the revised run. Unknown topology/profile/specification versions are rejected.

/** Versioned Phase 3 assumptions; legacy illustrative-job-traffic-v1 is immutable. */
export type NetworkPreset = 'scalable-reference' | 'undersized-shared-core';
export interface NetworkDesignConfiguration {
  id: 'rooted-reference-network';
  version: '1.0.0';
  preset: NetworkPreset;
}
export const PHASE3_TRAFFIC_PROFILE = Object.freeze({
  id: 'illustrative-job-traffic-v2',
  revision: '1.0.0',
  evidence: 'assumed',
  date: '2026-09-10',
  acceleratorsPerNode: 8,
  clusterBitSPerNode: 100e6,
  externalBitSPerNode: 1e6,
  unit: 'bit/s per energized node',
  requiredClasses: 'design.config.requireClusterNetwork / requireExternalNetwork',
  grouping: 'Platform network domain; conservative all-or-none required-job connectivity within each affected domain.',
  routing: 'deterministic-rooted-source-to-node-v1',
  direction: 'Simultaneous source-to-node direction only; no reverse-direction pooling. Cluster and external traffic share downstream resources.',
  switching: 'One charge per traversed switch per traffic class; ingress plus egress is not counted twice.',
  provenance: 'NEPTUNE synthetic reference assumptions; not measured training traffic or vendor validation.',
  scope: 'Offered network demand and connectivity only. No packet, latency, training-speed or delivered-throughput prediction.',
});
export const NETWORK_PRESET_LABELS: Record<NetworkPreset, string> = {
  'scalable-reference': 'Scalable reference network',
  'undersized-shared-core': 'Undersized shared-core network',
};

import { activePowerDesign } from '../twin/transfer/topology';
import { useMemo, useState } from 'react';
import { equipmentFor } from '../twin/catalog/equipment';
import { NETWORK_PRESET_LABELS, type NetworkPreset } from '../twin/network-contract';
import { assessNetworkProvisioning, createNetworkEvaluator } from '../twin/solvers/network';
import { createNetworkPowerEvaluator } from '../twin/solvers/network-power';
import type { Design, SimulationState } from '../twin/types';

const gb = (value: number) => (value / 1e9).toLocaleString('en-US', { maximumFractionDigits: 3 });

/** Displays the canonical evaluator; no independent UI capacity calculation. */
export function TwinNetworkPanel({ design, state, busy, selectedId, onSelect, onApply, onConnection }: {
  design: Design; state: SimulationState | null; busy: boolean; selectedId: string;
  onSelect: (id: string) => void;
  onApply: (preset: NetworkPreset) => void;
  onConnection: (id: string, enabled: boolean) => void;
}) {
  const equipment = equipmentFor(design);
  const [choice, setChoice] = useState<NetworkPreset>('scalable-reference');
  const installed = useMemo(() => assessNetworkProvisioning(design), [design]);
  const active=useMemo(()=>state?activePowerDesign(design,state):design,[design,state]);
  const evaluator = useMemo(() => createNetworkEvaluator(active), [active]);
  const current = useMemo(() => state ? evaluator(state.modules, state.failedAssetIds) : null, [state, evaluator]);
  const selectedResources = installed.resources.filter(resource => resource.assetId === selectedId).sort((a, b) => (a.kind === 'switch' ? 0 : a.kind === 'port' ? 1 : 2) - (b.kind === 'switch' ? 0 : b.kind === 'port' ? 1 : 2));
  const powerEvaluator = useMemo(() => createNetworkPowerEvaluator(active), [active]);
  const power = useMemo(() => state ? powerEvaluator(state.failedAssetIds) : null, [powerEvaluator, state]);
  const selectedPower = power?.allocations.find(allocation => allocation.assetId === selectedId);
  const affectedDomains = [...new Set(selectedResources.flatMap(resource => resource.domainIds))];
  const links = design.connections.filter(edge => (edge.medium === 'cluster' || edge.medium === 'external-network') && (edge.from === selectedId || edge.to === selectedId));
  const networkAssets = design.assets.filter(asset => asset.type === 'network');
  const profile = equipment.workloadProfile;
  return <section className="twin-network" aria-label="Network capacity">
    <h3>Network capacity</h3>
    <p data-testid="network-design-name">{equipment.networkDesign ? NETWORK_PRESET_LABELS[equipment.networkDesign.preset] : 'Legacy Phase 2 shared-core network'}</p>
    <label className="twin-preset">Network configuration
      <select aria-label="Network configuration" value={choice} onChange={event => setChoice(event.target.value as NetworkPreset)}>
        {Object.entries(NETWORK_PRESET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <p>Apply saves this experiment in Compare, starts a new design revision and resets the run to 0 s. Existing observations remain tied to their original revision.</p>
    <button disabled={busy || !state || equipment.networkDesign?.preset === choice} onClick={() => onApply(choice)}>Apply network and reset</button>
    <details>
      <summary>Saved workload assumptions</summary>
      <p>{profile.id} · v{profile.revision} · {profile.evidence}</p>
      <p>Eight accelerators per whole node. Cluster {profile.clusterBitSPerNode.toLocaleString('en-US')} bit/s per energized node; external {profile.externalBitSPerNode.toLocaleString('en-US')} bit/s per energized node.</p>
      <p>Required classes: cluster {String(design.config.requireClusterNetwork)}; external {String(design.config.requireExternalNetwork)}.</p>
      <p>{profile.scope}</p>
      {'routing' in profile && <><p>{profile.direction}</p><p>{profile.grouping}</p><p>{profile.provenance}</p><code>{profile.routing}</code></>}
    </details>
    <div data-testid="network-provisioning">
      <strong>Installed design demand: {installed.status}</strong>
      <p>{design.nodeCount.toLocaleString('en-US')} provisioned nodes · cluster {gb(installed.clusterDemandBitS)} Gbit/s · external {gb(installed.externalDemandBitS)} Gbit/s.</p>
      <p>Full inventory assessment, independent of current power allocation. {installed.blockedDomainIds.length} affected job domains.</p>
    </div>
    <div data-testid="network-current">
      <strong>Current energized demand: {current?.status ?? 'unavailable'}</strong>
      {state && <p>At displayed simulation time {state.timeS} s.</p>}
      <p>{current?.energizedNodes.toLocaleString('en-US') ?? 'Unavailable'} energized nodes · cluster {current ? gb(current.clusterDemandBitS) : 'unavailable'} Gbit/s · external {current ? gb(current.externalDemandBitS) : 'unavailable'} Gbit/s.</p>
      <p>{current ? `${current.blockedDomainIds.length} affected domains.` : 'Affected domains unavailable: no resolved state is displayed.'} A capacity pass is not training performance or physical campus validation.</p>
    </div>
    <label className="twin-preset">Inspect network asset
      <select aria-label="Inspect network asset" value={networkAssets.some(asset => asset.id === selectedId) ? selectedId : ''} onChange={event => onSelect(event.target.value)}>
        <option value="" disabled>Choose switch…</option>
        {networkAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.id}</option>)}
      </select>
    </label>
    <button onClick={() => onSelect('shore/cluster-core')}>Inspect shared core</button>
    {(installed.issues.length > 0 || (current?.issues.length ?? 0) > 0) && <details open>
      <summary>Limiting resources and connectivity</summary>
      {[...new Map([...installed.issues, ...(current?.issues ?? [])].map(issue => [issue.resourceId, issue])).values()].slice(0, 8).map(issue => <p key={issue.resourceId}>
        <button className="twin-text-button" onClick={() => onSelect(issue.assetId)}>{issue.resourceId}</button> {issue.reason} · {issue.domainIds.length} domains
      </p>)}
    </details>}
    {selectedResources.length > 0 && <details open>
      <summary>Selected resource budgets</summary>
      <div className="twin-network-table"><table><thead><tr><th>Resource</th><th>Demand / rating / headroom (Gbit/s)</th></tr></thead>
        <tbody>{selectedResources.map(resource => <tr key={resource.resourceId}><td><span title={resource.resourceId}>{resource.kind === 'switch' ? `${resource.resourceId} · Shared budget` : resource.kind === 'port' ? resource.resourceId.split(':').at(-1) : `Link to ${resource.resourceId.split('>').at(-1)?.split(':')[0]}`}</span><br />{resource.domainIds.length} domains</td><td>{gb(resource.demandBitS)} / {gb(resource.capacityBitS)} / {gb(resource.headroomBitS)}</td></tr>)}</tbody>
      </table></div>
      <details><summary>Affected job domains</summary>{affectedDomains.map(id => <p key={id}><button className="twin-text-button" onClick={() => onSelect(id)}>{id}</button></p>)}</details>
      <p>Installed demand in the declared source-to-node direction. Shared switch budget counts each traversal once. Ports and links retain individual limits.</p>
    </details>}
    {selectedPower && <details open><summary>Selected switch supply</summary><p>{selectedPower.available ? 'Powered' : 'Unpowered'} · declared {selectedPower.requestedW.toLocaleString('en-US')} W; supplied {selectedPower.suppliedW.toLocaleString('en-US')} W; grid draw including conversion {selectedPower.gridW.toLocaleString('en-US', {maximumFractionDigits: 1})} W. No root/platform UPS is modeled.</p><p>Dependencies: {selectedPower.dependencyIds.join(' → ')}.</p></details>}
    {!state && networkAssets.some(asset => asset.id === selectedId) && <details open><summary>Selected switch supply</summary><p>Power status, supplied watts and grid draw are unavailable because no resolved state is displayed. Installed ratings remain available separately.</p></details>}
    {links.length > 0 && <details>
      <summary>Network links · enable / disable</summary>
      <p>Changing a link saves the prior run and resets a new design revision. No alternate route is invented.</p>
      {links.map(edge => <div key={edge.id} className="twin-network-link"><code>{edge.id}</code><p>{edge.fromPort} → {edge.toPort} · {gb(edge.capacity)} Gbit/s · {edge.enabled ? 'enabled' : 'disabled'}</p><button disabled={busy || !state} onClick={() => onConnection(edge.id, !edge.enabled)}>{edge.enabled ? 'Disable' : 'Enable'} network link and reset</button></div>)}
    </details>}
    <p>All domains share the core and shore supply. Module heat is modeled; platform/shore network cooling is outside that thermal boundary. Use Project JSON for full sharing; Legacy URL links carry only Legacy v0.1 settings.</p>
  </section>;
}

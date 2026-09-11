import type { Design, SimulationState } from '../twin/types';
import { resolveAsset } from '../twin/assets/design';
import { assetConnections, assetOperatingStatus } from '../twin/presentation/assets';

const number = (value: number | null | undefined, digits = 3) => value == null || !Number.isFinite(value) ? 'unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: digits });
export type Workspace = 'Explore' | 'Operate' | 'Compare';
const PURPOSE: Record<Workspace, [string, string]> = {
  Explore: ['Understand the installed design', 'Select equipment in the scene or asset list. Trace its power and fluid connections, inspect its installed specification, then open Operate to examine a disturbance.'],
  Operate: ['Follow a disturbance through the system', 'Inspect a recorded fault, its affected domain and the controller response. The current clock belongs to the active simulation; history inspection is a separate view.'],
  Compare: ['Understand the evaluated decision', 'Declare requirements and scenario coverage before ranking candidates. Inspect whole-run outcomes, exact constraint margins and the included-cost tradeoff.'],
};
export function WorkspaceGuide({ workspace, onAssets, onEquipment, onCampus }: { workspace: Workspace; onAssets: () => void; onEquipment: () => void; onCampus: () => void }) {
  return <section className="operator-guide" aria-label={`${workspace} workspace guide`}>
    <div><span className="twin-eyebrow">{workspace.toUpperCase()}</span><h2>{PURPOSE[workspace][0]}</h2><p>{PURPOSE[workspace][1]}</p></div>
    <div className="twin-actions"><button onClick={onCampus}>Campus context</button><button onClick={onAssets}>Browse installed assets</button><button onClick={onEquipment}>Inspect selected equipment</button></div>
  </section>;
}

export function AssetContext({ design, state, assetId, onSelect }: { design: Design; state: SimulationState | null; assetId: string; onSelect: (id: string) => void }) {
  const asset = resolveAsset(design, assetId);
  if (!asset) return <output>Unsupported asset identity. Select an installed asset.</output>;
  const module = design.modules.find(item => assetId === item.id || assetId.startsWith(`${item.id}/`));
  const operating = state?.modules.find(item => item.id === module?.id);
  const connections = assetConnections(design, state, assetId);
  const status = assetOperatingStatus(state, assetId);
  return <section className="asset-context" data-testid="asset-context" data-asset-id={assetId} data-time={state?.timeS ?? ''} aria-label="Connected asset context">
    <p><strong>Selected equipment</strong> · <span className={`twin-tag ${status}`} data-testid="asset-operating-status">{status === 'unknown' ? 'Operating status unknown' : status}</span></p>
    <p>Origin: simulated model · {state ? `state at ${number(state.timeS)} s` : 'state unavailable'}. Installed specifications are design assumptions.</p>
    <dl className="twin-properties"><dt>Installed location / parent</dt><dd>{asset.parentId ? <button className="twin-text-button" onClick={() => onSelect(asset.parentId!)}>{asset.parentId}</button> : 'Campus external infrastructure'}</dd><dt>Canonical equipment center</dt><dd>{asset.positionM.map(value => number(value)).join(', ')} m · X, Y, Z</dd></dl>
    {asset.type === 'pump' && <>
      <h3>Pump and circuit operating point</h3>
      <p>The selected pump has its own installed rating and controller status. Flow, pressure and pump power below are module-equivalent solver outputs; individual pump electrical draw is not retained.</p>
      <dl className="twin-properties" data-testid="pump-operating-point"><dt>{assetId.endsWith('/pump-sea') ? 'Seawater' : 'Technical coolant'} circuit flow</dt><dd>{number(operating ? (assetId.endsWith('/pump-sea') ? operating.seawaterFlowM3S : operating.technicalFlowM3S) * 1000 : null)} L/s · module equivalent</dd><dt>Technical circuit pressure</dt><dd>{number(operating ? operating.pressurePa / 1000 : null)} kPa · module equivalent</dd><dt>All module pumps electrical draw</dt><dd>{number(operating?.pumpPowerW)} W · combined</dd></dl>
      <p>Technical coolant exchanges heat with seawater through the exchanger. The circuits do not mix; no seawater reaches computing equipment.</p>
    </>}
    <details open={asset.type === 'pump'}><summary>Direct supported connections ({connections.length})</summary>{connections.length ? <ul className="asset-connection-list">{connections.map(connection => { const other = connection.from === assetId ? connection.to : connection.from; return <li key={connection.id}><span>{connection.medium} · {connection.enabled ? 'connected' : 'open / disabled'}</span><button className="twin-text-button" onClick={() => onSelect(other)}>{other}</button></li>; })}</ul> : <p>No direct connection is represented for this asset. Inspect its parent or the supporting paths.</p>}</details>
    {operating && <details><summary>Warnings for {module!.id} ({operating.warnings.length})</summary>{operating.warnings.length ? operating.warnings.map((warning, index) => <p key={index}>{warning}</p>) : <p>No module warning recorded at this displayed boundary.</p>}</details>}
  </section>;
}

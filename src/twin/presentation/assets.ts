import { resolveAsset } from '../assets/design';
import { topologyForSelection } from '../analysis/reports';
import { activePowerDesign } from '../transfer/topology';
import type { Design, EquipmentState, SimulationState } from '../types';

/** An explicit fault is distinct from selection and from an unobserved status. */
export function assetOperatingStatus(state: SimulationState | null, assetId: string): EquipmentState {
  if (!state) return 'unknown';
  if (state.failedAssetIds.includes(assetId)) return 'failed';
  for (const module of state.modules) if (Object.hasOwn(module.states, assetId)) return module.states[assetId];
  return 'unknown';
}

/** Existing supported topology, projected through the inspected switch positions. */
export function assetConnections(design: Design, state: SimulationState | null, assetId: string) {
  if (!resolveAsset(design, assetId)) return [];
  return topologyForSelection(state ? activePowerDesign(design, state) : design, assetId)
    .filter(connection => connection.from === assetId || connection.to === assetId);
}

export function visualAssetStates(state: SimulationState): Record<string, EquipmentState> {
  const statuses: Record<string, EquipmentState> = {};
  for (const module of state.modules) Object.assign(statuses, module.states);
  for (const assetId of state.failedAssetIds) statuses[assetId] = 'failed';
  return statuses;
}

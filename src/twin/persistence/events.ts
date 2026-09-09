import { resolveAsset } from '../assets/design';
import { failure, finiteNumber } from '../safety';
import type { Design, OperationEvent } from '../types';
import { CONTRACT } from './limits';
import { array, keys, record, string } from './structure';

export function validateEvent(design: Design, value: unknown): asserts value is OperationEvent {
  record(value, 'event'); keys(value, ['id', 'timeS', 'assetId', 'kind', 'value', 'sequence'], 'event');
  string(value.id, 'event.id', CONTRACT.maxEventIdLength);
  if (!/^[A-Za-z0-9_.:-]+$/.test(value.id)) failure('invalid-input', 'EVENT_ID', 'Event requires a bounded stable alphanumeric ID.', { field: 'event.id' });
  finiteNumber(value.timeS, 'event.timeS', { min: 0, max: CONTRACT.horizonS, integer: true, unit: 's' });
  string(value.assetId, 'event.assetId', CONTRACT.maxAssetIdLength);
  if (Object.hasOwn(value, 'sequence')) finiteNumber(value.sequence, 'event.sequence', { min: 0, max: CONTRACT.maxEvents - 1, integer: true });
  const asset = resolveAsset(design, value.assetId);
  if (!asset) failure('invalid-input', 'EVENT_ASSET', `Unknown event asset: ${value.assetId}`, { assetId: value.assetId });
  const bounds: Record<string, [number, number, string]> = { workload: [0, 1, 'fraction'], seawater: [275.15, 311.15, 'K'], fouling: [0, 0.0001, 'K/W'], 'pump-speed': [0, 1.2, 'fraction'] };
  const limit = typeof value.kind === 'string' && Object.hasOwn(bounds, value.kind) ? bounds[value.kind] : undefined;
  if (limit) {
    if (value.assetId !== 'shore/grid') failure('invalid-input', 'EVENT_BOUNDARY', `${String(value.kind)} is a recorded facility boundary command; assetId must be shore/grid.`, { field: 'event.assetId' });
    finiteNumber(value.value, `event.${String(value.kind)}`, { min: limit[0], max: limit[1], unit: limit[2] });
  } else if (['trip', 'restore', 'maintenance'].includes(String(value.kind))) {
    if (asset.type === 'hull' || (asset.type === 'platform' && value.kind === 'trip')) failure('unsupported-configuration', 'UNSUPPORTED_COMMAND', `Unsupported operational command for ${asset.type}; platform maintenance is supported.`, { assetId: asset.id });
    if (Object.hasOwn(value, 'value')) failure('invalid-input', 'EVENT_VALUE', 'Failure/restoration commands do not accept a numeric value.', { field: 'event.value' });
  } else failure('unsupported-configuration', 'EVENT_KIND', `Unsupported event kind: ${String(value.kind)}`, { field: 'event.kind' });
}
export const eventOrder = (a: OperationEvent, b: OperationEvent) => a.timeS - b.timeS || a.sequence! - b.sequence!;
export function validateEvents(design: Design, value: unknown, requireSequence = true): asserts value is OperationEvent[] {
  array(value, 'events', CONTRACT.maxEvents);
  const ids = new Set<string>(), sequences = new Set<number>();
  let previous: OperationEvent | undefined;
  for (const event of value) {
    validateEvent(design, event);
    if (ids.has(event.id)) failure('invalid-input', 'EVENT_DUPLICATE', `Duplicate event ID: ${event.id}`);
    ids.add(event.id);
    if (requireSequence) {
      finiteNumber(event.sequence, 'event.sequence', { min: 0, max: value.length - 1, integer: true });
      if (sequences.has(event.sequence)) failure('invalid-input', 'EVENT_SEQUENCE', 'Duplicate event admission sequence.');
      sequences.add(event.sequence);
      if (previous && eventOrder(previous, event) >= 0) failure('invalid-input', 'EVENT_ORDER', 'Events must be ordered by time and unique admission sequence.');
      previous = event;
    }
  }
}
export function mergeEventHistory(design: Design, existing: OperationEvent[], incoming: OperationEvent[], timeS: number): OperationEvent[] {
  array(incoming, 'incoming events', CONTRACT.maxEvents);
  const merged = new Map(existing.map(e => [e.id, e]));
  for (const event of incoming) {
    validateEvent(design, event);
    const prior = merged.get(event.id);
    if (prior) {
      if (prior.timeS !== event.timeS || prior.kind !== event.kind || prior.assetId !== event.assetId || prior.value !== event.value || (event.sequence !== undefined && prior.sequence !== event.sequence)) failure('invalid-input', 'EVENT_CONFLICT', `Conflicting event ID ${event.id}`);
    } else {
      if (event.timeS < timeS) failure('invalid-input', 'EVENT_PAST', 'An event in the past requires replay.');
      if (merged.size >= CONTRACT.maxEvents) failure('invalid-input', 'EVENT_COUNT', `Event history exceeds ${CONTRACT.maxEvents} entries.`);
      // Incoming files may be sorted by time. Their already assigned sequence is validated below.
      merged.set(event.id, { ...event, sequence: event.sequence ?? merged.size });
    }
  }
  const result = [...merged.values()].sort(eventOrder); validateEvents(design, result); return result;
}

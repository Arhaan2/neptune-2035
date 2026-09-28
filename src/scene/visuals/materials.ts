import type { Asset, EquipmentState } from '../../twin/types';

/** Art-direction values only: these are not measured material properties. */
export const BLUE_HOUR = Object.freeze({
  pearl: '#E8EEF0',
  silver: '#AEBBC4',
  structure: '#273541',
  ocean: '#102735',
  deck: '#65747E',
  cabinet: '#BBC7CD',
  rack: '#23313D',
  insert: '#15232E',
  selection: '#83D5E8',
  warning: '#F0BE72',
  failure: '#F27B79',
  maintenance: '#BCA786',
  isolated: '#687C8B',
  starting: '#F0BE72',
  standby: '#8BA8B7',
  unknown: '#AD9FC5',
  skyZenith: '#233A55',
  skyHorizon: '#647F99',
  skyLow: '#455D73',
  practical: '#E7F1F4',
});

export interface SurfacePreset {
  color: string;
  roughness: number;
  metalness: number;
}

export const MATERIALS = Object.freeze({
  paint: Object.freeze({
    color: BLUE_HOUR.pearl,
    roughness: 0.43,
    metalness: 0,
  }),
  metal: Object.freeze({
    color: BLUE_HOUR.silver,
    roughness: 0.32,
    metalness: 1,
  }),
  structure: Object.freeze({
    color: BLUE_HOUR.structure,
    roughness: 0.57,
    metalness: 0.2,
  }),
  deck: Object.freeze({
    color: BLUE_HOUR.deck,
    roughness: 0.84,
    metalness: 0.05,
  }),
  cabinet: Object.freeze({
    color: BLUE_HOUR.cabinet,
    roughness: 0.46,
    metalness: 0.12,
  }),
  rack: Object.freeze({
    color: BLUE_HOUR.rack,
    roughness: 0.48,
    metalness: 0.3,
  }),
  insert: Object.freeze({
    color: BLUE_HOUR.insert,
    roughness: 0.27,
    metalness: 0.25,
  }),
}) satisfies Record<string, Readonly<SurfacePreset>>;

const ASSET_FAMILIES: Record<Asset['type'], keyof typeof MATERIALS> = {
  platform: 'deck',
  hull: 'structure',
  module: 'paint',
  rack: 'rack',
  compute: 'insert',
  cdu: 'metal',
  exchanger: 'metal',
  pump: 'metal',
  valve: 'metal',
  pipe: 'metal',
  transformer: 'cabinet',
  switchboard: 'cabinet',
  battery: 'cabinet',
  network: 'cabinet',
  external: 'structure',
};

/** Return values, never shared Three materials: an instance cannot recolor its peers. */
export function assetSurface(type: Asset['type']): SurfacePreset {
  return { ...MATERIALS[ASSET_FAMILIES[type]] };
}

/** Selection has its own outline and never replaces equipment-state color. */
export function stateColor(
  state: EquipmentState | undefined,
  fallback: string,
): string {
  switch (state) {
    case 'failed':
      return BLUE_HOUR.failure;
    case 'maintenance':
      return BLUE_HOUR.maintenance;
    case 'isolated':
      return BLUE_HOUR.isolated;
    case 'starting':
      return BLUE_HOUR.starting;
    case 'standby':
      return BLUE_HOUR.standby;
    case 'unknown':
      return BLUE_HOUR.unknown;
    default:
      return fallback;
  }
}

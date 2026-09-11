import type { Design } from '../types';
import { MODEL_ID, ALGORITHM_ID } from '../persistence/limits';
import { TRANSFER_MODEL } from './types';
export const modelForDesign=(design:Design)=>design.transfer?TRANSFER_MODEL:MODEL_ID;
export const algorithmForDesign=(design:Design)=>design.transfer?'transfer-boundary-1':ALGORITHM_ID;

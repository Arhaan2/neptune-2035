import type { Design, SimulationState } from '../types';
export const TRANSFER_POLICY = 'platform-transfer-1' as const;
export const TRANSFER_TOPOLOGY = 'single-hop-radial-1' as const;
export const TRANSFER_MODEL = 'neptune-transfer-1' as const;
export interface TransferRoute { id:string; recipientPlatformId:string; donorPlatformId:string; originalFeederId:string; receivingBusId:string; donorBusId:string; isolatorId:string; tieId:string; originalConnectionId:string; tieConnectionIds:string[]; priority:number }
export interface TransferDesign { version:1; preset:'platform-transfer-reference'; policy:typeof TRANSFER_POLICY; topology:typeof TRANSFER_TOPOLOGY; enabled:boolean; delayS:number; routes:TransferRoute[] }
export type TransferStatus = 'normal'|'detected'|'isolated'|'evaluating'|'waiting'|'transferred'|'blocked'|'lockout';
export type TransferReason = 'NORMAL'|'FEEDER_FAULT'|'ISOLATION_CONFIRMED'|'EVALUATING'|'WAITING'|'TRANSFERRED'|'DISABLED'|'RECEIVING_BUS_FAILED'|'DOWNSTREAM_FAILED'|'COMMON_SOURCE_FAILED'|'DONOR_UNAVAILABLE'|'TIE_UNAVAILABLE'|'ISOLATION_UNCONFIRMED'|'ORIGINAL_RESTORED'|'NO_HEADROOM'|'INSUFFICIENT_HEADROOM'|'PATH_UNAVAILABLE'|'CAPACITY_SHED';
export interface TransferAllocation { id:string; admittedW:number; unservedW:number; bindingResourceId:string|null; headroomW:number }
export interface TransferAttempt extends TransferAllocation { attemptId:string|null; status:TransferStatus; reason:TransferReason; detectedAtS:number|null; deadlineS:number|null; originalClosed:boolean; tieClosed:boolean; requestedW:number; accelerators:number; originalPath:string[]; donorPath:string[] }
export interface TransferTransition extends TransferAttempt { sequence:number; transitionId:string; timeS:number; previous:TransferStatus; affectedAssetIds:string[] }
export interface TransferState { version:1; policy:typeof TRANSFER_POLICY; topology:typeof TRANSFER_TOPOLOGY; designIdentity:string; splitTimesS:number[]; attempts:TransferAttempt[]; sequence:number; transitions:TransferTransition[]; transitionsTruncated:boolean; transitionCounts:Partial<Record<TransferReason,number>>; resources:TransferResourceUsage[] }
export interface TransferResource { id:string; capacityW:number; nativeW:number }
export interface TransferResourceUsage extends TransferResource { transferredW:number; headroomW:number }
export interface TransferBundle { id:string; priority:number; requestedW:number; resourceIds:string[] }
export interface PowerPath { assetIds:string[]; resourceIds:string[]; supported:boolean; efficiency:number }
export interface TransferDemand { moduleId:string; platformId:string; requestedW:number; resourceIds:string[] }
export type TransferPhysical = Pick<SimulationState,'timeS'|'failedAssetIds'|'transfer'>;
export type TransferDesignInput = Pick<Design,'assets'|'connections'|'config'|'modules'|'transfer'>;

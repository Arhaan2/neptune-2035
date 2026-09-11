import { resolveInspection, type InspectionRequest, type InspectionResolution } from './history';
import type { Design, SimulationState } from '../types';
export interface HistoryWorkerRequest { version: 1; epoch: number; runIdentity: string; design: Design; source: SimulationState; request: InspectionRequest }
export interface HistoryWorkerResponse { version: 1; epoch: number; runIdentity: string; assetId: string; resolution: InspectionResolution }
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = (event: MessageEvent<HistoryWorkerRequest>) => {
    const request = event.data;
    if (request.version !== 1) return;
    void resolveInspection(request.design, request.source, request.request).then(resolution => self.postMessage({ version: 1, epoch: request.epoch, runIdentity: request.runIdentity, assetId: request.request.assetId, resolution } satisfies HistoryWorkerResponse));
  };
}

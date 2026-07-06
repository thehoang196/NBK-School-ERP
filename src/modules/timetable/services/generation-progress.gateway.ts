/**
 * Re-export from the canonical service file.
 * The task spec references this filename; the implementation lives in
 * generation-progress-gateway.service.ts (registered in TimetableModule).
 */
export { GenerationProgressGatewayService as GenerationProgressGateway } from './generation-progress-gateway.service';

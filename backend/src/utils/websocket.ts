import { FastifyInstance } from 'fastify';
import { WebSocketService } from '../services/WebSocketService.js';

let webSocketService: WebSocketService | null = null;

export async function setupWebSocket(fastify: FastifyInstance) {
  try {
    // Initialize WebSocket service
    webSocketService = new WebSocketService();
    await webSocketService.initialize(fastify);
    
    // Attach to fastify instance for access in routes
    (fastify as any).websocketService = webSocketService;
    
    fastify.log.info('✅ WebSocket service initialized successfully');
  } catch (error) {
    fastify.log.error('❌ Failed to initialize WebSocket service:', error);
    throw error;
  }
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}

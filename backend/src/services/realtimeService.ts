import { Response } from 'express';
import { EventEmitter } from 'events';

export type RealtimeEventType =
  | 'STORE_UPDATED'
  | 'STORE_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'STOCK_UPDATED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_DELETED'
  | 'ANALYTICS_UPDATED';

export interface RealtimeEventPayload {
  event: RealtimeEventType;
  storeId: string;
  timestamp: string;
  data: any;
}

class RealtimeService extends EventEmitter {
  private clients: Map<string, Set<Response>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Registers a client response stream for Server-Sent Events on a specific store.
   */
  registerClient(storeId: string, res: Response): void {
    if (!this.clients.has(storeId)) {
      this.clients.set(storeId, new Set());
    }
    this.clients.get(storeId)!.add(res);

    // Initial connection acknowledgement
    this.sendSseMessage(res, {
      event: 'STORE_UPDATED',
      storeId,
      timestamp: new Date().toISOString(),
      data: { message: 'Realtime SSE stream connected' },
    });
  }

  /**
   * Unregisters a client when disconnected.
   */
  unregisterClient(storeId: string, res: Response): void {
    const storeClients = this.clients.get(storeId);
    if (storeClients) {
      storeClients.delete(res);
      if (storeClients.size === 0) {
        this.clients.delete(storeId);
      }
    }
  }

  /**
   * Emits an event to all connected SSE clients belonging to that store.
   */
  broadcast(storeId: string, event: RealtimeEventType, data: any): void {
    const payload: RealtimeEventPayload = {
      event,
      storeId,
      timestamp: new Date().toISOString(),
      data,
    };

    // Emit on internal Node event emitter for internal subscribers (like analytics recalculation)
    this.emit(`store:${storeId}`, payload);
    this.emit('event', payload);

    // Send to active SSE HTTP clients
    const storeClients = this.clients.get(storeId);
    if (storeClients) {
      for (const res of storeClients) {
        try {
          this.sendSseMessage(res, payload);
        } catch {
          storeClients.delete(res);
        }
      }
    }
  }

  private sendSseMessage(res: Response, payload: RealtimeEventPayload): void {
    res.write(`event: ${payload.event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

export const realtimeService = new RealtimeService();

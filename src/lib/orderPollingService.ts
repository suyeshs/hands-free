/**
 * Order Polling Service — DISABLED
 *
 * Real-time order delivery is handled by the Durable Object WebSocket in
 * orderSyncService. Polling is redundant and causes stale/duplicate orders.
 * This stub exists only to satisfy any lingering imports.
 */

class OrderPollingService {
  start(_tenantId: string, _options?: { soundEnabled?: boolean; pollOnlineOrders?: boolean }): Promise<void> {
    return Promise.resolve();
  }

  stop(): void {}

  setSoundEnabled(_enabled: boolean): void {}
}

export const orderPollingService = new OrderPollingService();

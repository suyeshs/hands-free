/**
 * Durable Object Tips Handler
 *
 * Add this to your Durable Object WebSocket message handler
 * to process tip_recorded events and sync them to D1.
 */

// Add to your Durable Object's WebSocket message handler:

async handleWebSocketMessage(ws: WebSocket, message: any, env: Env) {
  const { type } = message;

  switch (type) {
    // ... existing cases (order_created, sale_completed, etc.)

    case 'tip_recorded': {
      const { tip } = message;
      console.log('[DurableObject] Tip recorded:', tip.invoiceNumber, tip.tipAmount);

      // Sync tip to D1 immediately
      try {
        await this.syncTipToD1(tip, env);

        // Optionally broadcast to other connected clients for real-time updates
        this.broadcast(message, ws); // Exclude sender
      } catch (error) {
        console.error('[DurableObject] Failed to sync tip to D1:', error);
      }
      break;
    }

    // ... other cases
  }
}

/**
 * Sync tip to D1 database
 */
async syncTipToD1(tip: any, env: Env): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO tips (
        id, tenant_id, invoice_number, order_number, table_number, order_type,
        tip_amount, staff_id, server_name, entered_by_staff_id, entered_by_name,
        entry_method, created_at, tip_date, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      tip.id,
      tip.tenantId,
      tip.invoiceNumber,
      tip.orderNumber || null,
      tip.tableNumber || null,
      tip.orderType,
      tip.tipAmount,
      tip.staffId || null,
      tip.serverName || null,
      tip.enteredByStaffId || null,
      tip.enteredByName || null,
      tip.entryMethod,
      tip.createdAt,
      tip.tipDate
    ).run();

    console.log('[DurableObject] Tip synced to D1:', tip.invoiceNumber);
  } catch (error) {
    console.error('[DurableObject] Failed to write tip to D1:', error);
    throw error;
  }
}

/**
 * Broadcast message to all connected clients except sender
 */
broadcast(message: any, excludeWs?: WebSocket): void {
  const messageStr = JSON.stringify(message);

  for (const [client, metadata] of this.sessions.entries()) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error('[DurableObject] Failed to broadcast to client:', error);
      }
    }
  }
}

// ==================== INTEGRATION CHECKLIST ====================
/**
 * To integrate tips into your Durable Object:
 *
 * 1. ✅ Add the 'tip_recorded' case to your WebSocket message handler
 * 2. ✅ Implement syncTipToD1() method
 * 3. ✅ Ensure D1 database has the tips table (see cloudflare-worker-sales-endpoints.ts)
 * 4. ✅ Test with a real tip entry from POS
 *
 * Expected WebSocket message format:
 * {
 *   type: 'tip_recorded',
 *   tip: {
 *     id: string,
 *     tenantId: string,
 *     invoiceNumber: string,
 *     orderNumber?: string,
 *     tableNumber?: number,
 *     orderType: string,
 *     tipAmount: number,
 *     staffId?: string,
 *     serverName?: string,
 *     enteredByStaffId?: string,
 *     enteredByName?: string,
 *     entryMethod: string,
 *     createdAt: string (ISO 8601),
 *     tipDate: string (YYYY-MM-DD)
 *   }
 * }
 */

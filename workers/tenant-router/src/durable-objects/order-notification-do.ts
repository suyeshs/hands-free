/**
 * Order Notification Durable Object
 *
 * Maintains WebSocket connections for real-time order updates.
 * Each tenant has its own DO instance identified by tenantId.
 */

import { DurableObject } from 'cloudflare:workers';

interface ClientSession {
  clientId: string;
  deviceType: 'pos' | 'kds' | 'manager';
  connectedAt: string;
  tenantId?: string;
}

interface SalesTransaction {
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  orderType: string;
  tableNumber?: number;
  source: string;
  subtotal: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  discount: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    modifiers?: string[];
  }>;
  cashierName?: string;
  staffId?: string;
  createdAt: string;
  completedAt?: string;
}

interface Env {
  TENANT_DISPATCH: DispatchNamespace;
}

export class OrderNotificationDO extends DurableObject<Env> {
  private sessions: Map<WebSocket, ClientSession> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Restore hibernated WebSocket sessions
    this.ctx.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment();
      if (attachment) {
        this.sessions.set(ws, attachment as ClientSession);
      }
    });

    // Auto ping/pong for keep-alive
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Internal: Broadcast order created
    if (request.method === 'POST' && url.pathname === '/notify/order-created') {
      const data = await request.json() as Record<string, unknown>;
      this.broadcast({ type: 'order_created', ...data });
      return new Response('OK');
    }

    // Internal: Broadcast status update
    if (request.method === 'POST' && url.pathname === '/notify/status-update') {
      const data = await request.json() as Record<string, unknown>;
      this.broadcast({ type: 'order_status_update', ...data });
      return new Response('OK');
    }

    // Internal: Broadcast QR order created
    if (request.method === 'POST' && url.pathname === '/notify/qr-order-created') {
      const data = await request.json() as Record<string, unknown>;
      this.broadcast({ type: 'qr_order_created', ...data });
      return new Response('OK');
    }

    // Internal: Broadcast service request (Call Waiter)
    if (request.method === 'POST' && url.pathname === '/notify/service-request') {
      const data = await request.json() as Record<string, unknown>;
      this.broadcast({ type: 'service_request', ...data });
      return new Response('OK');
    }

    // Get connected clients count
    if (request.method === 'GET' && url.pathname === '/status') {
      return Response.json({
        connectedClients: this.sessions.size,
        clients: Array.from(this.sessions.values()).map(s => ({
          clientId: s.clientId,
          deviceType: s.deviceType,
          connectedAt: s.connectedAt,
        })),
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private handleWebSocketUpgrade(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Extract device type from query param if provided
    const url = new URL(request.url);
    const deviceType = (url.searchParams.get('device') || 'pos') as 'pos' | 'kds' | 'manager';
    const tenantId = url.searchParams.get('tenant') || undefined;

    const clientId = crypto.randomUUID();
    const session: ClientSession = {
      clientId,
      deviceType,
      connectedAt: new Date().toISOString(),
      tenantId,
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(session);
    this.sessions.set(server, session);

    console.log(`[OrderNotificationDO] Client connected: ${clientId} (${deviceType})`);

    // Send initial sync_state with empty arrays
    // The client should fetch current orders via REST if needed
    server.send(JSON.stringify({
      type: 'sync_state',
      activeOrders: [],
      recentOrders: [],
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = this.sessions.get(ws);

    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message);
        console.log(`[OrderNotificationDO] Received from ${session?.clientId}:`, data.type);

        // Handle client messages
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          case 'broadcast_order':
            // Relay order broadcast from POS to all other connected clients (KDS, etc.)
            console.log(`[OrderNotificationDO] Broadcasting order from ${session?.deviceType}: ${data.kitchenOrder?.orderNumber}`);

            // Persist aggregator orders to D1 immediately (for real-time sales reporting)
            if (session?.tenantId && data.order?.aggregator) {
              this.persistAggregatorOrderToD1(session.tenantId, data.order).catch((err: unknown) => {
                console.error(`[OrderNotificationDO] Failed to persist aggregator order to D1:`, err);
              });
            }

            this.broadcast({
              type: 'order_created',
              order: data.order,
              kitchenOrder: data.kitchenOrder,
            }, ws); // exclude sender
            break;

          case 'status_update':
            // Relay status update to all other clients
            // Include extra data (orderNumber, tableNumber, orderType) for proper matching on receiving devices
            console.log(`[OrderNotificationDO] Broadcasting status update: ${data.orderId} -> ${data.status} (order: ${data.orderNumber}, table: ${data.tableNumber})`);
            this.broadcast({
              type: 'order_status_update',
              orderId: data.orderId,
              status: data.status,
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
              orderType: data.orderType,
            }, ws); // exclude sender
            break;

          // Staff sync messages
          case 'staff_sync':
            // Broadcast full staff list to all other clients
            console.log(`[OrderNotificationDO] Broadcasting staff sync from ${session?.deviceType}: ${data.staff?.length} members`);
            this.broadcast({
              type: 'staff_sync',
              staff: data.staff,
              timestamp: data.timestamp || new Date().toISOString(),
            }, ws);
            break;

          case 'staff_added':
            console.log(`[OrderNotificationDO] Broadcasting staff added: ${data.staff?.name}`);
            this.broadcast({
              type: 'staff_added',
              staff: data.staff,
            }, ws);
            break;

          case 'staff_updated':
            console.log(`[OrderNotificationDO] Broadcasting staff updated: ${data.staffId}`);
            this.broadcast({
              type: 'staff_updated',
              staffId: data.staffId,
              updates: data.updates,
            }, ws);
            break;

          case 'staff_removed':
            console.log(`[OrderNotificationDO] Broadcasting staff removed: ${data.staffId}`);
            this.broadcast({
              type: 'staff_removed',
              staffId: data.staffId,
            }, ws);
            break;

          // Floor plan sync messages
          case 'floorplan_sync':
            // Broadcast full floor plan to all other clients
            console.log(`[OrderNotificationDO] Broadcasting floor plan sync from ${session?.deviceType}`);
            this.broadcast({
              type: 'floorplan_sync',
              sections: data.sections,
              tables: data.tables,
              assignments: data.assignments,
              timestamp: data.timestamp || new Date().toISOString(),
            }, ws);
            break;

          case 'section_added':
            console.log(`[OrderNotificationDO] Broadcasting section added: ${data.section?.name}`);
            this.broadcast({
              type: 'section_added',
              section: data.section,
            }, ws);
            break;

          case 'section_removed':
            console.log(`[OrderNotificationDO] Broadcasting section removed: ${data.sectionId}`);
            this.broadcast({
              type: 'section_removed',
              sectionId: data.sectionId,
            }, ws);
            break;

          case 'table_added':
            console.log(`[OrderNotificationDO] Broadcasting table added: ${data.table?.tableNumber}`);
            this.broadcast({
              type: 'table_added',
              table: data.table,
            }, ws);
            break;

          case 'table_removed':
            console.log(`[OrderNotificationDO] Broadcasting table removed: ${data.tableId}`);
            this.broadcast({
              type: 'table_removed',
              tableId: data.tableId,
            }, ws);
            break;

          case 'table_status_updated':
            console.log(`[OrderNotificationDO] Broadcasting table status updated: ${data.tableId} -> ${data.status}`);
            this.broadcast({
              type: 'table_status_updated',
              tableId: data.tableId,
              status: data.status,
            }, ws);
            break;

          case 'staff_assigned':
            console.log(`[OrderNotificationDO] Broadcasting staff assigned: ${data.userId}`);
            this.broadcast({
              type: 'staff_assigned',
              assignment: data.assignment,
            }, ws);
            break;

          // Request sync - client asks for current state from other devices
          case 'request_sync':
            console.log(`[OrderNotificationDO] Client ${session?.clientId} requesting sync`);
            // Broadcast request to all other clients, one of them (likely POS) should respond with full state
            this.broadcast({
              type: 'sync_requested',
              requesterId: session?.clientId,
              deviceType: session?.deviceType,
            }, ws);
            break;

          // Sync state response - relay orders from one device to all others
          case 'sync_state':
            console.log(`[OrderNotificationDO] Relaying sync_state with ${data.activeOrders?.length || 0} orders from ${session?.deviceType}`);
            this.broadcast({
              type: 'sync_state',
              activeOrders: data.activeOrders,
              timestamp: data.timestamp,
            }, ws);
            break;

          // Service request messages (Call Waiter)
          case 'service_request':
            console.log(`[OrderNotificationDO] Broadcasting service request: ${data.request?.type} for table ${data.request?.tableNumber}`);
            this.broadcast({
              type: 'service_request',
              request: data.request,
            }, ws);
            break;

          case 'service_request_acknowledged':
            console.log(`[OrderNotificationDO] Broadcasting service request ack: ${data.requestId} by ${data.staffName}`);
            this.broadcast({
              type: 'service_request_acknowledged',
              requestId: data.requestId,
              staffId: data.staffId,
              staffName: data.staffName,
            }, ws);
            break;

          case 'service_request_resolved':
            console.log(`[OrderNotificationDO] Broadcasting service request resolved: ${data.requestId}`);
            this.broadcast({
              type: 'service_request_resolved',
              requestId: data.requestId,
            }, ws);
            break;

          // Item ready notification (KDS notifying service staff)
          case 'item_ready':
            console.log(`[OrderNotificationDO] Broadcasting item ready: ${data.itemName} for order ${data.orderNumber}${data.tableNumber ? ` (table ${data.tableNumber})` : ''}`);
            this.broadcast({
              type: 'item_ready',
              orderId: data.orderId,
              itemId: data.itemId,
              itemName: data.itemName,
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
              assignedStaffId: data.assignedStaffId,
            }, ws);
            break;

          // Item status update (KDS syncing item status to POS)
          case 'item_status_update':
            console.log(`[OrderNotificationDO] Broadcasting item status update: ${data.itemId} -> ${data.status} for order ${data.orderNumber}${data.tableNumber ? ` (table ${data.tableNumber})` : ''}`);
            this.broadcast({
              type: 'item_status_update',
              orderId: data.orderId,
              itemId: data.itemId,
              status: data.status,
              itemName: data.itemName,
              orderNumber: data.orderNumber,
              tableNumber: data.tableNumber,
            }, ws);
            break;

          // Order update (full order state sync, e.g., when item quantities change due to 86)
          case 'order_update':
            console.log(`[OrderNotificationDO] Broadcasting order update: ${data.order?.orderNumber} (${data.order?.items?.length} items, v${data.order?.version})`);
            this.broadcast({
              type: 'order_update',
              order: data.order,
            }, ws);
            break;

          // Out of Stock (86) notifications - relay from KDS to POS and other devices
          case 'out_of_stock':
            console.log(`[OrderNotificationDO] Broadcasting out of stock (86): ${data.item?.itemName} (${data.item?.portionsOut} portions)`);
            this.broadcast({
              type: 'out_of_stock',
              item: data.item,
              alert: data.alert,
            }, ws);
            break;

          // Back in stock - item is available again
          case 'back_in_stock':
            console.log(`[OrderNotificationDO] Broadcasting back in stock: ${data.itemName}`);
            this.broadcast({
              type: 'back_in_stock',
              itemId: data.itemId,
              itemName: data.itemName,
            }, ws);
            break;

          // Sale completed - persist to D1 and broadcast to all clients for real-time dashboard updates
          case 'sale_completed':
            console.log(`[OrderNotificationDO] Sale completed: ${data.transaction?.invoiceNumber} (${data.transaction?.grandTotal})`);
            if (session?.tenantId && data.transaction) {
              // Persist to D1 via tenant worker (fire and forget, don't block WebSocket)
              this.persistSaleToD1(session.tenantId, data.transaction as SalesTransaction).catch((err) => {
                console.error(`[OrderNotificationDO] Failed to persist sale to D1:`, err);
              });
              // Send acknowledgment back to sender
              ws.send(JSON.stringify({
                type: 'sale_persisted',
                transactionId: data.transaction.id,
                success: true,
              }));
              // IMPORTANT: Broadcast to all OTHER clients for real-time dashboard updates
              // This enables dashboards on remote devices to update instantly
              this.broadcast({
                type: 'sale_completed',
                transaction: data.transaction,
              }, ws); // exclude sender (they already know about the sale)
            } else {
              console.warn(`[OrderNotificationDO] sale_completed missing tenantId or transaction`);
              ws.send(JSON.stringify({
                type: 'sale_persisted',
                transactionId: data.transaction?.id,
                success: false,
                error: 'Missing tenantId or transaction data',
              }));
            }
            break;

          default:
            // Unknown message type - log for debugging
            console.log(`[OrderNotificationDO] Unknown message type: ${data.type}`);
        }
      } catch (e) {
        console.error('[OrderNotificationDO] Failed to parse message:', e);
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    console.log(`[OrderNotificationDO] Client disconnected: ${session?.clientId} (code: ${code}, reason: ${reason})`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    console.error(`[OrderNotificationDO] WebSocket error for ${session?.clientId}:`, error);
  }

  /**
   * Broadcast a message to all connected clients
   */
  private broadcast(message: object, exclude?: WebSocket): void {
    const json = JSON.stringify(message);
    let sentCount = 0;

    for (const [ws, session] of this.sessions.entries()) {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(json);
          sentCount++;
        } catch (e) {
          console.error(`[OrderNotificationDO] Failed to send to ${session.clientId}:`, e);
          // Remove dead connections
          this.sessions.delete(ws);
        }
      }
    }

    console.log(`[OrderNotificationDO] Broadcast ${(message as any).type} to ${sentCount} clients`);
  }

  /**
   * Persist an aggregator order to D1 via the tenant worker
   */
  private async persistAggregatorOrderToD1(tenantId: string, order: Record<string, unknown>): Promise<void> {
    const workerName = `tenant-${tenantId}`;

    try {
      const tenantWorker = this.env.TENANT_DISPATCH.get(workerName);

      // Transform order to sync payload format
      const syncPayload = {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        aggregator: order.aggregator,
        aggregatorOrderId: order.aggregatorOrderId,
        aggregatorStatus: order.aggregatorStatus,
        status: order.status,
        orderType: order.orderType,
        customerName: (order.customer as Record<string, unknown>)?.name,
        customerPhone: (order.customer as Record<string, unknown>)?.phone,
        customerAddress: (order.customer as Record<string, unknown>)?.address,
        items: ((order.cart as Record<string, unknown>)?.items as unknown[]) || [],
        subtotal: (order.cart as Record<string, unknown>)?.subtotal || 0,
        tax: (order.cart as Record<string, unknown>)?.tax || 0,
        deliveryFee: (order.cart as Record<string, unknown>)?.deliveryFee || 0,
        platformFee: (order.cart as Record<string, unknown>)?.platformFee || 0,
        discount: (order.cart as Record<string, unknown>)?.discount || 0,
        total: (order.cart as Record<string, unknown>)?.total || 0,
        paymentMethod: (order.payment as Record<string, unknown>)?.method,
        paymentStatus: (order.payment as Record<string, unknown>)?.status,
        isPrepaid: (order.payment as Record<string, unknown>)?.isPrepaid || false,
        specialInstructions: order.specialInstructions,
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        readyAt: order.readyAt,
        deliveredAt: order.deliveredAt,
      };

      const response = await tenantWorker.fetch(
        new Request('https://internal/aggregator-orders/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
          },
          body: JSON.stringify({ orders: [syncPayload] }),
        })
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Tenant worker returned ${response.status}: ${error}`);
      }

      const result = await response.json() as { success: boolean; synced: number };
      console.log(`[OrderNotificationDO] Aggregator order persisted to D1: ${order.orderNumber} (synced: ${result.synced})`);
    } catch (error) {
      console.error(`[OrderNotificationDO] Failed to persist aggregator order ${order.orderNumber}:`, error);
      throw error;
    }
  }

  /**
   * Persist a sales transaction to D1 via the tenant worker
   */
  private async persistSaleToD1(tenantId: string, transaction: SalesTransaction): Promise<void> {
    const workerName = `tenant-${tenantId}`;

    try {
      const tenantWorker = this.env.TENANT_DISPATCH.get(workerName);

      // Call the sales sync endpoint with a single transaction
      const response = await tenantWorker.fetch(
        new Request('https://internal/sales/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantId,
          },
          body: JSON.stringify({ transactions: [transaction] }),
        })
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Tenant worker returned ${response.status}: ${error}`);
      }

      const result = await response.json() as { success: boolean; synced: number };
      console.log(`[OrderNotificationDO] Sale persisted to D1: ${transaction.invoiceNumber} (synced: ${result.synced})`);
    } catch (error) {
      console.error(`[OrderNotificationDO] Failed to persist sale ${transaction.invoiceNumber}:`, error);
      throw error;
    }
  }
}

/**
 * Realtime Coordinator Durable Object
 *
 * Manages WebSocket connections and broadcasts real-time updates for:
 * - Owner App: Sales, orders, staff activity, inventory alerts
 * - Staff App: KDS orders, team status, attendance, tips
 *
 * Each tenant gets one instance per location (or one for all locations).
 */

interface WebSocketClient {
  webSocket: WebSocket;
  clientId: string;
  appType: 'owner' | 'staff';
  subscriptions: Set<string>; // e.g., ['sales', 'orders', 'kds']
  locationId?: string;
  staffId?: string;
}

interface BroadcastMessage {
  type: string;
  channel: string;
  data: any;
  timestamp: number;
}

export class RealtimeCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private clients: Map<string, WebSocketClient> = new Map();
  private kdsOrders: Map<string, any> = new Map();
  private teamStatus: Map<string, any> = new Map();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Restore state from storage
    this.state.blockConcurrencyWhile(async () => {
      const storedOrders = await this.state.storage.get<Map<string, any>>('kdsOrders');
      if (storedOrders) {
        this.kdsOrders = storedOrders;
      }

      const storedTeam = await this.state.storage.get<Map<string, any>>('teamStatus');
      if (storedTeam) {
        this.teamStatus = storedTeam;
      }
    });

    // Start background tasks
    this.startBackgroundTasks();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // HTTP endpoints for data updates
    switch (url.pathname) {
      case '/orders':
        return this.handleGetOrders(request);
      case '/update':
        return this.handleUpdate(request);
      case '/broadcast':
        return this.handleBroadcast(request);
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  /**
   * Handle WebSocket connection upgrade
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const appType = url.searchParams.get('appType') as 'owner' | 'staff';
    const locationId = url.searchParams.get('locationId') || undefined;
    const staffId = url.searchParams.get('staffId') || undefined;
    const subscriptions = url.searchParams.get('subscriptions')?.split(',') || [];

    if (!appType) {
      return new Response('appType parameter required', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Generate client ID
    const clientId = crypto.randomUUID();

    // Store client info
    const clientInfo: WebSocketClient = {
      webSocket: server,
      clientId,
      appType,
      subscriptions: new Set(subscriptions),
      locationId,
      staffId
    };

    this.clients.set(clientId, clientInfo);

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: Date.now()
    }));

    // Send initial data based on subscriptions
    await this.sendInitialData(clientInfo);

    // Handle incoming messages
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(clientId, event.data);
    });

    // Handle disconnect
    server.addEventListener('close', () => {
      this.clients.delete(clientId);
      console.log(`[Realtime] Client ${clientId} disconnected`);
    });

    server.addEventListener('error', (error) => {
      console.error(`[Realtime] WebSocket error for client ${clientId}:`, error);
      this.clients.delete(clientId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Send initial data to newly connected client
   */
  private async sendInitialData(client: WebSocketClient): Promise<void> {
    // Send KDS orders if subscribed
    if (client.subscriptions.has('kds') && client.appType === 'staff') {
      const orders = Array.from(this.kdsOrders.values()).filter(order =>
        !client.locationId || order.locationId === client.locationId
      );

      client.webSocket.send(JSON.stringify({
        type: 'initial-data',
        channel: 'kds',
        data: orders,
        timestamp: Date.now()
      }));
    }

    // Send team status if subscribed
    if (client.subscriptions.has('team') && client.appType === 'staff') {
      const team = Array.from(this.teamStatus.values()).filter(member =>
        !client.locationId || member.locationId === client.locationId
      );

      client.webSocket.send(JSON.stringify({
        type: 'initial-data',
        channel: 'team',
        data: team,
        timestamp: Date.now()
      }));
    }

    // Sales and stats will be fetched via regular API calls
    // but we'll push updates when they change
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(clientId: string, message: string): void {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (data.type) {
        case 'subscribe':
          // Add new subscription
          if (data.channels && Array.isArray(data.channels)) {
            data.channels.forEach((channel: string) => client.subscriptions.add(channel));
          }
          break;

        case 'unsubscribe':
          // Remove subscription
          if (data.channels && Array.isArray(data.channels)) {
            data.channels.forEach((channel: string) => client.subscriptions.delete(channel));
          }
          break;

        case 'ping':
          // Respond with pong
          client.webSocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'kds-action':
          // Handle KDS actions (mark ready, report delay)
          this.handleKDSAction(data, client);
          break;
      }
    } catch (error) {
      console.error('[Realtime] Error handling message:', error);
    }
  }

  /**
   * Handle KDS actions from staff
   */
  private async handleKDSAction(data: any, client: WebSocketClient): Promise<void> {
    const { action, orderId } = data;

    if (!orderId) return;

    const order = this.kdsOrders.get(orderId);
    if (!order) return;

    switch (action) {
      case 'mark-ready':
        order.status = 'ready';
        order.completedAt = new Date().toISOString();
        this.kdsOrders.set(orderId, order);
        await this.state.storage.put('kdsOrders', this.kdsOrders);

        // Broadcast update
        this.broadcast({
          type: 'kds-update',
          channel: 'kds',
          data: { action: 'order-ready', order },
          timestamp: Date.now()
        }, 'kds', order.locationId);
        break;

      case 'report-delay':
        order.delayReported = true;
        order.delayMinutes = data.delayMinutes || 5;
        order.delayReason = data.reason;
        this.kdsOrders.set(orderId, order);
        await this.state.storage.put('kdsOrders', this.kdsOrders);

        // Broadcast update
        this.broadcast({
          type: 'kds-update',
          channel: 'kds',
          data: { action: 'order-delayed', order },
          timestamp: Date.now()
        }, 'kds', order.locationId);
        break;
    }
  }

  /**
   * GET /orders - Get active KDS orders
   */
  private async handleGetOrders(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const locationId = url.searchParams.get('locationId');

    const orders = Array.from(this.kdsOrders.values())
      .filter(order => !locationId || order.locationId === locationId)
      .filter(order => order.status !== 'ready' && order.status !== 'completed');

    return new Response(JSON.stringify({
      success: true,
      data: orders
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * POST /update - Update data (called by other workers)
   */
  private async handleUpdate(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { type, data } = body;

      switch (type) {
        case 'new-order':
          await this.handleNewOrder(data);
          break;

        case 'order-update':
          await this.handleOrderUpdate(data);
          break;

        case 'staff-clock-in':
          await this.handleStaffClockIn(data);
          break;

        case 'staff-clock-out':
          await this.handleStaffClockOut(data);
          break;

        case 'sales-update':
          await this.handleSalesUpdate(data);
          break;

        case 'inventory-alert':
          await this.handleInventoryAlert(data);
          break;

        case 'team-update':
          await this.handleTeamUpdate(data);
          break;
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[Realtime] Update error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Update failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * POST /broadcast - Broadcast message to clients
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { message, channel, locationId } = body;

      this.broadcast(message, channel, locationId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle new order
   */
  private async handleNewOrder(data: any): Promise<void> {
    const order = {
      id: data.id,
      orderNumber: data.orderNumber,
      tableNumber: data.tableNumber,
      items: data.items,
      status: 'pending',
      createdAt: data.createdAt || new Date().toISOString(),
      locationId: data.locationId,
      urgent: false
    };

    this.kdsOrders.set(order.id, order);
    await this.state.storage.put('kdsOrders', this.kdsOrders);

    // Broadcast to KDS subscribers
    this.broadcast({
      type: 'new-order',
      channel: 'kds',
      data: order,
      timestamp: Date.now()
    }, 'kds', order.locationId);

    // Also broadcast to owner app
    this.broadcast({
      type: 'sales-activity',
      channel: 'activity',
      data: {
        type: 'order',
        title: 'New order received',
        description: `Table ${order.tableNumber || 'N/A'} - Order #${order.orderNumber}`,
        timestamp: order.createdAt
      },
      timestamp: Date.now()
    }, 'activity', order.locationId);
  }

  /**
   * Handle order update
   */
  private async handleOrderUpdate(data: any): Promise<void> {
    const order = this.kdsOrders.get(data.id);
    if (!order) return;

    Object.assign(order, data);
    this.kdsOrders.set(order.id, order);
    await this.state.storage.put('kdsOrders', this.kdsOrders);

    this.broadcast({
      type: 'order-update',
      channel: 'kds',
      data: order,
      timestamp: Date.now()
    }, 'kds', order.locationId);
  }

  /**
   * Handle staff clock in
   */
  private async handleStaffClockIn(data: any): Promise<void> {
    const member = {
      staffId: data.staffId,
      name: data.name,
      status: 'active',
      clockInTime: data.clockInTime,
      locationId: data.locationId
    };

    this.teamStatus.set(data.staffId, member);
    await this.state.storage.put('teamStatus', this.teamStatus);

    // Broadcast to team subscribers
    this.broadcast({
      type: 'staff-clock-in',
      channel: 'team',
      data: member,
      timestamp: Date.now()
    }, 'team', data.locationId);

    // Broadcast to owner activity feed
    this.broadcast({
      type: 'sales-activity',
      channel: 'activity',
      data: {
        type: 'staff',
        title: 'Staff clocked in',
        description: `${data.name} started shift`,
        timestamp: data.clockInTime
      },
      timestamp: Date.now()
    }, 'activity', data.locationId);
  }

  /**
   * Handle staff clock out
   */
  private async handleStaffClockOut(data: any): Promise<void> {
    const member = this.teamStatus.get(data.staffId);
    if (member) {
      member.status = 'offline';
      member.clockOutTime = data.clockOutTime;
      this.teamStatus.set(data.staffId, member);
      await this.state.storage.put('teamStatus', this.teamStatus);

      this.broadcast({
        type: 'staff-clock-out',
        channel: 'team',
        data: member,
        timestamp: Date.now()
      }, 'team', data.locationId);
    }
  }

  /**
   * Handle sales update
   */
  private async handleSalesUpdate(data: any): Promise<void> {
    // Broadcast to owner app - sales stats
    this.broadcast({
      type: 'sales-update',
      channel: 'sales',
      data: {
        totalSales: data.totalSales,
        orderCount: data.orderCount,
        change: data.change
      },
      timestamp: Date.now()
    }, 'sales', data.locationId);
  }

  /**
   * Handle inventory alert
   */
  private async handleInventoryAlert(data: any): Promise<void> {
    this.broadcast({
      type: 'sales-activity',
      channel: 'activity',
      data: {
        type: 'inventory',
        title: 'Low stock alert',
        description: `${data.itemName} needs restock`,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now()
    }, 'activity', data.locationId);
  }

  /**
   * Handle team update
   */
  private async handleTeamUpdate(data: any): Promise<void> {
    this.broadcast({
      type: 'team-update',
      channel: 'team',
      data,
      timestamp: Date.now()
    }, 'team', data.locationId);
  }

  /**
   * Broadcast message to subscribed clients
   */
  private broadcast(message: BroadcastMessage, channel: string, locationId?: string): void {
    const clientsToNotify = Array.from(this.clients.values()).filter(client =>
      client.subscriptions.has(channel) &&
      (!locationId || !client.locationId || client.locationId === locationId || client.locationId === 'all')
    );

    const messageStr = JSON.stringify(message);

    clientsToNotify.forEach(client => {
      try {
        client.webSocket.send(messageStr);
      } catch (error) {
        console.error(`[Realtime] Failed to send to client ${client.clientId}:`, error);
        this.clients.delete(client.clientId);
      }
    });

    console.log(`[Realtime] Broadcasted ${message.type} to ${clientsToNotify.length} clients on channel ${channel}`);
  }

  /**
   * Background tasks (order timing, etc.)
   */
  private startBackgroundTasks(): void {
    // Check for urgent orders every 30 seconds
    setInterval(() => {
      this.checkUrgentOrders();
    }, 30000);

    // Clean up old completed orders every 5 minutes
    setInterval(() => {
      this.cleanupOldOrders();
    }, 300000);
  }

  /**
   * Check and mark urgent orders (>15 minutes)
   */
  private async checkUrgentOrders(): Promise<void> {
    const now = Date.now();
    let hasChanges = false;

    for (const [orderId, order] of this.kdsOrders.entries()) {
      if (order.status === 'pending' && !order.urgent) {
        const createdAt = new Date(order.createdAt).getTime();
        const ageMinutes = (now - createdAt) / 60000;

        if (ageMinutes > 15) {
          order.urgent = true;
          this.kdsOrders.set(orderId, order);
          hasChanges = true;

          // Broadcast urgent update
          this.broadcast({
            type: 'order-urgent',
            channel: 'kds',
            data: order,
            timestamp: now
          }, 'kds', order.locationId);
        }
      }
    }

    if (hasChanges) {
      await this.state.storage.put('kdsOrders', this.kdsOrders);
    }
  }

  /**
   * Clean up completed orders older than 1 hour
   */
  private async cleanupOldOrders(): Promise<void> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    let hasChanges = false;

    for (const [orderId, order] of this.kdsOrders.entries()) {
      if ((order.status === 'ready' || order.status === 'completed') && order.completedAt) {
        const completedAt = new Date(order.completedAt).getTime();
        if (completedAt < oneHourAgo) {
          this.kdsOrders.delete(orderId);
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      await this.state.storage.put('kdsOrders', this.kdsOrders);
    }
  }
}

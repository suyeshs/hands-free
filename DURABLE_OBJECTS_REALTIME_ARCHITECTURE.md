# Durable Objects for Real-Time Multi-Location Updates

## Why Durable Objects?

### ✅ Perfect for Multi-Location Real-Time Sync

**Durable Objects Advantages**:
1. **Persistent WebSocket Connections**: Hold connections to all devices (master + locations)
2. **Single Coordination Point**: One DO instance per chain ensures consistency
3. **In-Memory State**: Fast access to current chain state
4. **Instant Broadcasts**: Push updates to all locations in milliseconds
5. **Automatic Failover**: CF handles instance migration transparently
6. **Global Distribution**: Low latency worldwide

### 🎯 Use Cases

| Use Case | Without DO | With DO | Benefit |
|----------|-----------|---------|---------|
| Menu Update | Location pulls every 5min | Instant push notification | **5min → 100ms** |
| Sales Visibility | Master polls every 5min | Real-time sale broadcast | **Live updates** |
| Inventory Alert | Daily batch sync | Instant low-stock alert | **Proactive** |
| Device Status | Polling + timeout | Heartbeat tracking | **Always current** |
| Menu Override | Database writes | Coordinated updates | **No conflicts** |

---

## Architecture Design

### Durable Object: `ChainCoordinator`

**One instance per restaurant chain**

```typescript
// workers/handsfree-restaurant/src/durable-objects/ChainCoordinator.ts

export class ChainCoordinator {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, WebSocket>; // deviceId -> WebSocket
  private devices: Map<string, DeviceInfo>;  // deviceId -> device metadata
  private chainState: ChainState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.devices = new Map();
    this.chainState = {
      chainId: '',
      masterTenantId: '',
      locations: new Map(),
      realtimeSales: [],
      inventoryAlerts: [],
      menuVersion: 0,
      staffVersion: 0,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // HTTP endpoints
    switch (url.pathname) {
      case '/broadcast/menu-updated':
        return this.broadcastMenuUpdate(request);
      case '/broadcast/sale':
        return this.broadcastSale(request);
      case '/broadcast/inventory-alert':
        return this.broadcastInventoryAlert(request);
      case '/state/devices':
        return this.getDeviceStatus();
      case '/state/realtime-sales':
        return this.getRealtimeSales();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  // WebSocket connection handling
  async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Parse device info from URL params
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId') || crypto.randomUUID();
    const deviceType = url.searchParams.get('deviceType') as 'master' | 'location';
    const locationId = url.searchParams.get('locationId');
    const tenantId = url.searchParams.get('tenantId');

    // Store connection
    this.sessions.set(deviceId, server);
    this.devices.set(deviceId, {
      deviceId,
      deviceType,
      locationId,
      tenantId,
      connectedAt: Date.now(),
      lastHeartbeat: Date.now(),
    });

    console.log(`[ChainCoordinator] Device connected: ${deviceId} (${deviceType})`);

    // Send welcome message with current state
    server.send(JSON.stringify({
      type: 'welcome',
      deviceId,
      chainState: this.getSerializableChainState(),
      connectedDevices: this.devices.size,
    }));

    // Set up message handler
    server.addEventListener('message', async (event: MessageEvent) => {
      await this.handleMessage(deviceId, event.data);
    });

    // Set up close handler
    server.addEventListener('close', () => {
      console.log(`[ChainCoordinator] Device disconnected: ${deviceId}`);
      this.sessions.delete(deviceId);
      this.devices.delete(deviceId);
      this.broadcastDeviceStatus();
    });

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring(deviceId);

    // Broadcast device status to all
    this.broadcastDeviceStatus();

    return new Response(null, { status: 101, webSocket: client });
  }

  // Handle incoming WebSocket messages
  async handleMessage(deviceId: string, data: string) {
    try {
      const message = JSON.parse(data);
      const device = this.devices.get(deviceId);

      if (!device) return;

      switch (message.type) {
        case 'heartbeat':
          device.lastHeartbeat = Date.now();
          this.sessions.get(deviceId)?.send(JSON.stringify({ type: 'heartbeat-ack' }));
          break;

        case 'sale':
          // Location device reports a sale in real-time
          await this.handleRealtimeSale(device, message.data);
          break;

        case 'inventory-update':
          // Location reports inventory change
          await this.handleInventoryUpdate(device, message.data);
          break;

        case 'menu-override':
          // Location sets menu override
          await this.handleMenuOverride(device, message.data);
          break;

        case 'request-sync':
          // Device requests full state sync
          await this.sendFullState(deviceId);
          break;

        default:
          console.warn(`[ChainCoordinator] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`[ChainCoordinator] Error handling message:`, error);
    }
  }

  // Broadcast menu update to all locations
  async broadcastMenuUpdate(request: Request): Promise<Response> {
    const { menuVersion, updatedBy } = await request.json();

    this.chainState.menuVersion = menuVersion;

    // Broadcast to all location devices
    const message = JSON.stringify({
      type: 'menu-updated',
      menuVersion,
      updatedBy,
      timestamp: Date.now(),
      action: 'sync_menu_now', // Triggers immediate sync
    });

    let sent = 0;
    for (const [deviceId, device] of this.devices.entries()) {
      if (device.deviceType === 'location') {
        this.sessions.get(deviceId)?.send(message);
        sent++;
      }
    }

    console.log(`[ChainCoordinator] Menu update broadcast to ${sent} locations`);

    return new Response(JSON.stringify({
      broadcast: true,
      devicesSent: sent
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Handle real-time sale from location
  async handleRealtimeSale(device: DeviceInfo, saleData: any) {
    const sale: RealtimeSale = {
      saleId: saleData.saleId,
      locationId: device.locationId!,
      locationName: saleData.locationName,
      amount: saleData.amount,
      items: saleData.items,
      timestamp: Date.now(),
    };

    // Store in memory (keep last 100 sales)
    this.chainState.realtimeSales.unshift(sale);
    if (this.chainState.realtimeSales.length > 100) {
      this.chainState.realtimeSales.pop();
    }

    // Persist to D1 (async, don't block)
    this.persistSaleToD1(sale).catch(console.error);

    // Broadcast to all master devices
    const message = JSON.stringify({
      type: 'realtime-sale',
      sale,
    });

    for (const [deviceId, dev] of this.devices.entries()) {
      if (dev.deviceType === 'master') {
        this.sessions.get(deviceId)?.send(message);
      }
    }

    console.log(`[ChainCoordinator] Sale broadcast: ${sale.locationName} - $${sale.amount}`);
  }

  // Persist sale to D1 (async)
  async persistSaleToD1(sale: RealtimeSale) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO chain_sales_transactions (
          id, chain_id, location_id, order_id, total_amount,
          items_json, sale_timestamp, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        this.chainState.chainId,
        sale.locationId,
        sale.saleId,
        sale.amount,
        JSON.stringify(sale.items),
        new Date(sale.timestamp).toISOString()
      ).run();
    } catch (error) {
      console.error('[ChainCoordinator] Failed to persist sale:', error);
    }
  }

  // Handle inventory update from location
  async handleInventoryUpdate(device: DeviceInfo, inventoryData: any) {
    const { itemId, itemName, quantity, threshold } = inventoryData;

    // Check if low stock
    if (quantity <= threshold) {
      const alert: InventoryAlert = {
        alertId: crypto.randomUUID(),
        locationId: device.locationId!,
        itemId,
        itemName,
        currentQuantity: quantity,
        threshold,
        timestamp: Date.now(),
        severity: quantity === 0 ? 'critical' : 'warning',
      };

      this.chainState.inventoryAlerts.push(alert);

      // Broadcast to master devices
      const message = JSON.stringify({
        type: 'inventory-alert',
        alert,
      });

      for (const [deviceId, dev] of this.devices.entries()) {
        if (dev.deviceType === 'master') {
          this.sessions.get(deviceId)?.send(message);
        }
      }

      console.log(`[ChainCoordinator] Inventory alert: ${itemName} at ${device.locationId} (${quantity} left)`);
    }
  }

  // Send full state to specific device
  async sendFullState(deviceId: string) {
    const ws = this.sessions.get(deviceId);
    if (!ws) return;

    ws.send(JSON.stringify({
      type: 'full-state',
      chainState: this.getSerializableChainState(),
      timestamp: Date.now(),
    }));
  }

  // Broadcast device status to all
  broadcastDeviceStatus() {
    const deviceList = Array.from(this.devices.values()).map(d => ({
      deviceId: d.deviceId,
      deviceType: d.deviceType,
      locationId: d.locationId,
      connectedAt: d.connectedAt,
      lastHeartbeat: d.lastHeartbeat,
      isOnline: Date.now() - d.lastHeartbeat < 30000, // 30s timeout
    }));

    const message = JSON.stringify({
      type: 'device-status-update',
      devices: deviceList,
      totalDevices: deviceList.length,
    });

    for (const ws of this.sessions.values()) {
      ws.send(message);
    }
  }

  // Heartbeat monitoring
  startHeartbeatMonitoring(deviceId: string) {
    // Check heartbeat every 60 seconds
    const interval = setInterval(() => {
      const device = this.devices.get(deviceId);
      if (!device) {
        clearInterval(interval);
        return;
      }

      const timeSinceHeartbeat = Date.now() - device.lastHeartbeat;
      if (timeSinceHeartbeat > 60000) {
        // No heartbeat for 60s, consider offline
        console.log(`[ChainCoordinator] Device ${deviceId} timed out`);
        this.sessions.get(deviceId)?.close(1000, 'Heartbeat timeout');
        this.sessions.delete(deviceId);
        this.devices.delete(deviceId);
        clearInterval(interval);
      }
    }, 60000);
  }

  // Get device status (HTTP endpoint)
  getDeviceStatus(): Response {
    const devices = Array.from(this.devices.values());
    return new Response(JSON.stringify({
      totalDevices: devices.length,
      masterDevices: devices.filter(d => d.deviceType === 'master').length,
      locationDevices: devices.filter(d => d.deviceType === 'location').length,
      devices: devices.map(d => ({
        ...d,
        isOnline: Date.now() - d.lastHeartbeat < 30000,
      })),
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get realtime sales (HTTP endpoint)
  getRealtimeSales(): Response {
    return new Response(JSON.stringify({
      sales: this.chainState.realtimeSales,
      totalSales: this.chainState.realtimeSales.reduce((sum, s) => sum + s.amount, 0),
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  getSerializableChainState() {
    return {
      chainId: this.chainState.chainId,
      menuVersion: this.chainState.menuVersion,
      staffVersion: this.chainState.staffVersion,
      realtimeSales: this.chainState.realtimeSales.slice(0, 20), // Last 20 sales
      inventoryAlerts: this.chainState.inventoryAlerts.slice(-10), // Last 10 alerts
      connectedDevices: this.devices.size,
    };
  }
}

// Type definitions
interface DeviceInfo {
  deviceId: string;
  deviceType: 'master' | 'location';
  locationId?: string;
  tenantId?: string;
  connectedAt: number;
  lastHeartbeat: number;
}

interface ChainState {
  chainId: string;
  masterTenantId: string;
  locations: Map<string, LocationInfo>;
  realtimeSales: RealtimeSale[];
  inventoryAlerts: InventoryAlert[];
  menuVersion: number;
  staffVersion: number;
}

interface RealtimeSale {
  saleId: string;
  locationId: string;
  locationName: string;
  amount: number;
  items: any[];
  timestamp: number;
}

interface InventoryAlert {
  alertId: string;
  locationId: string;
  itemId: string;
  itemName: string;
  currentQuantity: number;
  threshold: number;
  timestamp: number;
  severity: 'warning' | 'critical';
}

interface LocationInfo {
  locationId: string;
  locationName: string;
  status: 'online' | 'offline';
  lastSeen: number;
}
```

---

## Client-Side Integration

### Location Device: WebSocket Client

```typescript
// src/services/chainWebSocket.ts

class ChainWebSocketService {
  private ws: WebSocket | null = null;
  private deviceId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.deviceId = crypto.randomUUID();
  }

  async connect() {
    const tenantConfig = await invoke<TenantConfig>('get_tenant_config');
    const masterTenantId = tenantConfig.masterTenantId;

    if (!masterTenantId) {
      console.log('[ChainWS] Not a location device, skipping');
      return;
    }

    const locationId = tenantConfig.tenantId;
    const workerUrl = await this.getWorkerUrl(masterTenantId);

    // Connect to Durable Object
    const wsUrl = `${workerUrl.replace('https', 'wss')}/chain/${masterTenantId}/ws?deviceId=${this.deviceId}&deviceType=location&locationId=${locationId}&tenantId=${locationId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[ChainWS] ✅ Connected to chain coordinator');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onclose = () => {
      console.log('[ChainWS] ❌ Disconnected');
      this.stopHeartbeat();
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[ChainWS] Error:', error);
    };
  }

  handleMessage(message: any) {
    switch (message.type) {
      case 'welcome':
        console.log('[ChainWS] Welcome received, chain state:', message.chainState);
        break;

      case 'menu-updated':
        console.log('[ChainWS] 🍽️ Menu updated remotely, syncing now...');
        // Trigger immediate menu sync
        invoke('sync_master_data_to_location').then(() => {
          useMenuStore.getState().loadCategories();
          useMenuStore.getState().loadMenuItems();
          toast.success('Menu updated from master');
        });
        break;

      case 'device-status-update':
        console.log('[ChainWS] Device status update:', message.devices);
        break;

      case 'heartbeat-ack':
        // Heartbeat acknowledged
        break;

      default:
        console.log('[ChainWS] Unknown message:', message);
    }
  }

  // Send sale in real-time
  async sendSale(sale: Sale) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[ChainWS] Not connected, queuing sale for batch sync');
      return;
    }

    const locationName = await invoke<string>('get_restaurant_name');

    this.ws.send(JSON.stringify({
      type: 'sale',
      data: {
        saleId: sale.id,
        locationName,
        amount: sale.total_amount,
        items: sale.items,
        timestamp: Date.now(),
      }
    }));

    console.log('[ChainWS] 💰 Sale sent to master');
  }

  // Send inventory update
  async sendInventoryUpdate(itemId: string, itemName: string, quantity: number, threshold: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'inventory-update',
      data: { itemId, itemName, quantity, threshold }
    }));
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30000); // 30s heartbeat
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ChainWS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[ChainWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  async getWorkerUrl(tenantId: string): Promise<string> {
    // Get worker URL from provisioning data or config
    return `https://handsfree-restaurant.workers.dev`;
  }
}

export const chainWebSocketService = new ChainWebSocketService();

// Auto-connect in App.tsx for location devices
useEffect(() => {
  chainWebSocketService.connect();
  return () => chainWebSocketService.disconnect();
}, []);
```

### Master Device: WebSocket Client

```typescript
// Similar to location, but with master-specific handlers

class MasterChainWebSocketService {
  // ... similar setup ...

  handleMessage(message: any) {
    switch (message.type) {
      case 'realtime-sale':
        // Update Real-Time Sales Dashboard immediately
        const { sale } = message;
        useChainSalesStore.getState().addSale(sale);
        toast.success(`💰 Sale: ${sale.locationName} - $${sale.amount}`);
        break;

      case 'inventory-alert':
        const { alert } = message;
        useChainInventoryStore.getState().addAlert(alert);
        if (alert.severity === 'critical') {
          toast.error(`🚨 Out of stock: ${alert.itemName} at ${alert.locationId}`);
        } else {
          toast.warning(`⚠️ Low stock: ${alert.itemName} at ${alert.locationId}`);
        }
        break;

      // ... other handlers
    }
  }
}
```

---

## Benefits vs. Traditional Polling

### Latency Comparison

| Event | Polling (5min) | Durable Object (WebSocket) |
|-------|---------------|---------------------------|
| Menu Update Notification | 0-5 minutes | 100ms |
| Sale Visibility on Master | 0-5 minutes | 50-200ms |
| Inventory Alert | Hours (daily batch) | 100ms |
| Device Online Status | Unknown until next poll | Real-time heartbeat |

### Cost Comparison

**Polling Approach**:
- Each location: 12 requests/hour × 10 locations × 24h = **2,880 requests/day**
- D1 reads: 2,880 × 5 tables = **14,400 reads/day**
- **Cost**: ~$0.50/day

**Durable Object Approach**:
- WebSocket connections: 10 locations × 24h = **240 connection-hours**
- DO requests: ~100/day (connection + broadcasts)
- D1 writes: Only when data changes (~50/day)
- **Cost**: ~$0.10/day (5x cheaper) + **real-time** benefits

---

## Implementation Checklist

### Phase 1: Durable Object Setup
- [ ] Create `ChainCoordinator` Durable Object class
- [ ] Add DO binding to wrangler.toml
- [ ] Deploy DO to Cloudflare
- [ ] Test WebSocket connection from client

### Phase 2: Client Integration
- [ ] Create `ChainWebSocketService` (location)
- [ ] Create `MasterChainWebSocketService` (master)
- [ ] Auto-connect on app load
- [ ] Handle reconnection with exponential backoff
- [ ] Send heartbeats every 30s

### Phase 3: Real-Time Features
- [ ] Menu update push (master → locations)
- [ ] Sale broadcast (locations → master)
- [ ] Inventory alerts (locations → master)
- [ ] Device status monitoring (bidirectional)
- [ ] Menu override coordination

### Phase 4: UI Integration
- [ ] Real-Time Sales Dashboard (live updates)
- [ ] WebSocket status indicator
- [ ] Device online/offline badges
- [ ] Live inventory alerts
- [ ] Connection quality indicator

---

## Conclusion

**Recommendation**: ✅ **YES, use Durable Objects**

**Benefits**:
- ⚡ **Real-time updates** instead of 5-minute polling
- 💰 **5x cost reduction** on D1 reads
- 🎯 **Better UX**: Instant notifications, live dashboards
- 🔄 **Automatic coordination**: Single DO instance ensures consistency
- 📡 **Persistent connections**: Always connected, always in sync
- 🌍 **Global**: Low latency worldwide

**When to Use**:
- Multi-location chains with 3+ locations
- Owner wants real-time visibility
- Live inventory/sales tracking needed
- High-value transactions (instant confirmation important)

**When NOT to Use**:
- Single location (no real-time coordination needed)
- Batch reporting is sufficient (end-of-day reports)
- Cost-sensitive (though DO is actually cheaper!)

---

**Next Steps**:
1. Deploy `ChainCoordinator` Durable Object
2. Integrate WebSocket clients in frontend
3. Test real-time menu update flow
4. Test real-time sale broadcast
5. Monitor connection stability and latency

**Status**: 📋 Design Complete, Ready for Implementation
**Priority**: 🟡 Medium (nice-to-have, not critical for launch)
**Estimated Effort**: 1-2 weeks

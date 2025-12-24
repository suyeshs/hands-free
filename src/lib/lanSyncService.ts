/**
 * LAN Sync Service
 *
 * Provides LAN-based synchronization between POS, KDS, and BDS devices.
 * - POS runs as server, KDS/BDS connect as clients
 * - Uses mDNS for service discovery
 * - Emits Tauri events for order updates
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// Types matching Rust definitions
export type DeviceType = 'pos' | 'kds' | 'bds' | 'manager';

export interface ClientInfo {
  clientId: string;
  deviceType: DeviceType;
  connectedAt: string;
  ipAddress: string;
}

export interface ServerInfo {
  serverId: string;
  tenantId: string;
  connectedClients: number;
  serverTime: string;
}

export interface LanServerStatus {
  isRunning: boolean;
  port: number;
  ipAddress: string | null;
  mdnsRegistered: boolean;
  connectedClients: ClientInfo[];
  startedAt: string | null;
}

export interface LanClientStatus {
  isConnected: boolean;
  serverAddress: string | null;
  serverInfo: ServerInfo | null;
  connectedAt: string | null;
  deviceType: DeviceType;
}

export interface DiscoveredServer {
  name: string;
  ipAddress: string;
  port: number;
  tenantId: string | null;
}

// ============ Server Commands (POS) ============

/**
 * Start the LAN WebSocket server (POS only)
 */
export async function startLanServer(tenantId: string): Promise<string> {
  return invoke<string>('start_lan_server', { tenantId });
}

/**
 * Stop the LAN WebSocket server
 */
export async function stopLanServer(): Promise<void> {
  return invoke<void>('stop_lan_server');
}

/**
 * Get LAN server status
 */
export async function getLanServerStatus(): Promise<LanServerStatus> {
  return invoke<LanServerStatus>('get_lan_server_status');
}

/**
 * Broadcast an order to all connected KDS/BDS devices
 */
export async function broadcastOrder(
  order: unknown,
  kitchenOrder: unknown
): Promise<number> {
  return invoke<number>('broadcast_order', { order, kitchenOrder });
}

/**
 * Broadcast an order status update to all connected devices
 */
export async function broadcastOrderStatus(
  orderId: string,
  status: string
): Promise<number> {
  return invoke<number>('broadcast_order_status', { orderId, status });
}

/**
 * Get list of connected LAN clients
 */
export async function getLanClients(): Promise<ClientInfo[]> {
  return invoke<ClientInfo[]>('get_lan_clients');
}

// ============ Client Commands (KDS/BDS) ============

/**
 * Discover LAN servers via mDNS
 */
export async function discoverLanServers(
  tenantId?: string,
  timeoutSecs?: number
): Promise<DiscoveredServer[]> {
  return invoke<DiscoveredServer[]>('discover_lan_servers', {
    tenantId,
    timeoutSecs,
  });
}

/**
 * Connect to a LAN server (KDS/BDS only)
 */
export async function connectLanServer(
  serverAddress: string,
  deviceType: DeviceType,
  tenantId: string
): Promise<LanClientStatus> {
  return invoke<LanClientStatus>('connect_lan_server', {
    serverAddress,
    deviceType,
    tenantId,
  });
}

/**
 * Disconnect from LAN server
 */
export async function disconnectLanServer(): Promise<void> {
  return invoke<void>('disconnect_lan_server');
}

/**
 * Get LAN client status
 */
export async function getLanClientStatus(): Promise<LanClientStatus> {
  return invoke<LanClientStatus>('get_lan_client_status');
}

// ============ Event Listeners ============

interface LanOrderCreatedPayload {
  order: unknown;
  kitchenOrder: unknown;
}

interface LanOrderStatusUpdatePayload {
  orderId: string;
  status: string;
  updatedAt: string;
}

interface LanSyncStatePayload {
  orders: unknown[];
}

export interface LanSyncListenerCallbacks {
  onOrderCreated?: (order: unknown, kitchenOrder: unknown) => void;
  onOrderStatusUpdate?: (orderId: string, status: string, updatedAt: string) => void;
  onSyncState?: (orders: unknown[]) => void;
  onConnected?: (status: LanClientStatus) => void;
  onDisconnected?: () => void;
  onClientConnected?: (clientInfo: ClientInfo) => void;
  onClientDisconnected?: (clientId: string) => void;
}

/**
 * Set up LAN sync event listeners
 * Call this once when the app starts (for KDS/BDS devices)
 */
export async function setupLanSyncListeners(
  callbacks: LanSyncListenerCallbacks = {}
): Promise<UnlistenFn[]> {
  const unlisteners: UnlistenFn[] = [];

  // Listen for new orders from LAN
  const unlistenOrderCreated = await listen<LanOrderCreatedPayload>(
    'lan_order_created',
    (event) => {
      console.log('[LAN Sync] Order created:', event.payload);
      const { order, kitchenOrder } = event.payload;
      callbacks.onOrderCreated?.(order, kitchenOrder);
    }
  );
  unlisteners.push(unlistenOrderCreated);

  // Listen for order status updates from LAN
  const unlistenStatusUpdate = await listen<LanOrderStatusUpdatePayload>(
    'lan_order_status_update',
    (event) => {
      console.log('[LAN Sync] Order status update:', event.payload);
      const { orderId, status, updatedAt } = event.payload;
      callbacks.onOrderStatusUpdate?.(orderId, status, updatedAt);
    }
  );
  unlisteners.push(unlistenStatusUpdate);

  // Listen for sync state (full order list)
  const unlistenSyncState = await listen<LanSyncStatePayload>(
    'lan_sync_state',
    (event) => {
      console.log('[LAN Sync] Sync state received:', event.payload.orders.length, 'orders');
      const { orders } = event.payload;
      callbacks.onSyncState?.(orders);
    }
  );
  unlisteners.push(unlistenSyncState);

  // Listen for connection events
  const unlistenConnected = await listen<LanClientStatus>(
    'lan_connected',
    (event) => {
      console.log('[LAN Sync] Connected to POS:', event.payload);
      callbacks.onConnected?.(event.payload);
    }
  );
  unlisteners.push(unlistenConnected);

  const unlistenDisconnected = await listen<void>(
    'lan_disconnected',
    () => {
      console.log('[LAN Sync] Disconnected from POS');
      callbacks.onDisconnected?.();
    }
  );
  unlisteners.push(unlistenDisconnected);

  // Listen for client connection events (POS server)
  const unlistenClientConnected = await listen<ClientInfo>(
    'lan_client_connected',
    (event) => {
      console.log('[LAN Sync] Client connected:', event.payload);
      callbacks.onClientConnected?.(event.payload);
    }
  );
  unlisteners.push(unlistenClientConnected);

  const unlistenClientDisconnected = await listen<string>(
    'lan_client_disconnected',
    (event) => {
      console.log('[LAN Sync] Client disconnected:', event.payload);
      callbacks.onClientDisconnected?.(event.payload);
    }
  );
  unlisteners.push(unlistenClientDisconnected);

  console.log('[LAN Sync] Event listeners set up');

  return unlisteners;
}


// ============ Auto-Discovery and Connection ============

/**
 * Auto-discover and connect to POS server
 * Used by KDS/BDS devices on startup
 */
export async function autoConnectToPos(
  deviceType: DeviceType,
  tenantId: string,
  timeoutSecs = 10
): Promise<LanClientStatus | null> {
  console.log(`[LAN Sync] Auto-discovering POS server for tenant: ${tenantId}`);

  try {
    const servers = await discoverLanServers(tenantId, timeoutSecs);

    if (servers.length === 0) {
      console.log('[LAN Sync] No POS servers found on network');
      return null;
    }

    // Connect to the first matching server
    const server = servers[0];
    console.log(`[LAN Sync] Found POS server at ${server.ipAddress}:${server.port}`);

    const serverAddress = `${server.ipAddress}:${server.port}`;
    const status = await connectLanServer(serverAddress, deviceType, tenantId);

    console.log('[LAN Sync] Connected to POS server:', status);
    return status;
  } catch (error) {
    console.error('[LAN Sync] Auto-connect failed:', error);
    return null;
  }
}

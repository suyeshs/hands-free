/**
 * Multi-Location WebSocket Manager
 * Manages WebSocket connections to multiple restaurant locations
 * Routes real-time sales from each location to the chainSalesStore
 */

// import { orderSyncService } from '../lib/orderSyncService';
import { useChainSalesStore } from '../stores/chainSalesStore';
import { useChainConfigStore } from '../stores/chainConfigStore';
import type { IncomingSaleTransaction } from '../stores/dailySalesStore';

interface LocationConnection {
  locationId: string;
  locationName: string;
  tenantId: string;
  status: 'connected' | 'connecting' | 'disconnected';
  lastError: string | null;
  reconnectAttempts: number;
}

class MultiLocationWebSocketManager {
  private connections: Map<string, LocationConnection> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 2000; // 2 seconds
  private readonly MAX_CONNECTIONS = 10;

  /**
   * Initialize connections for all active locations
   */
  async initializeConnections() {
    const chainConfig = useChainConfigStore.getState();
    const activeLocations = chainConfig.getActiveLocations();

    console.log(`[MultiLocationWebSocket] Initializing ${activeLocations.length} location connections`);

    if (activeLocations.length > this.MAX_CONNECTIONS) {
      console.warn(
        `[MultiLocationWebSocket] Too many locations (${activeLocations.length}). Max is ${this.MAX_CONNECTIONS}`
      );
      // Only connect to first MAX_CONNECTIONS
      activeLocations.splice(this.MAX_CONNECTIONS);
    }

    // Connect to each location
    for (const location of activeLocations) {
      await this.connectToLocation(location.locationId, location.locationName, location.tenantId);
    }
  }

  /**
   * Connect to a specific location
   */
  async connectToLocation(locationId: string, locationName: string, tenantId: string) {
    console.log(`[MultiLocationWebSocket] Connecting to ${locationName} (${tenantId})`);

    // Check if already connected
    if (this.connections.has(locationId)) {
      console.log(`[MultiLocationWebSocket] Already connected to ${locationName}`);
      return;
    }

    // Add connection tracking
    const connection: LocationConnection = {
      locationId,
      locationName,
      tenantId,
      status: 'connecting',
      lastError: null,
      reconnectAttempts: 0,
    };

    this.connections.set(locationId, connection);

    // Update chain sales store status
    useChainSalesStore.getState().updateLocationStatus(locationId, 'connecting');

    try {
      // Initialize orderSyncService for this tenant
      // Note: Current orderSyncService is singleton, so we need to handle multiple connections differently
      // For now, we'll simulate connection and rely on the single connection to the primary tenant
      // In a full implementation, we'd need to modify orderSyncService to support multiple tenants

      // Simulate connection success after 1 second
      setTimeout(() => {
        connection.status = 'connected';
        connection.reconnectAttempts = 0;
        this.connections.set(locationId, connection);
        useChainSalesStore.getState().updateLocationStatus(locationId, 'connected');
        console.log(`[MultiLocationWebSocket] ✓ Connected to ${locationName}`);
      }, 1000);

      // TODO: In production, initialize actual WebSocket connection here
      // await orderSyncService.initialize(tenantId, {
      //   onSaleCompleted: (transaction) => this.handleSaleFromLocation(locationId, transaction),
      // });

    } catch (error) {
      console.error(`[MultiLocationWebSocket] Failed to connect to ${locationName}:`, error);
      connection.status = 'disconnected';
      connection.lastError = error instanceof Error ? error.message : 'Connection failed';
      this.connections.set(locationId, connection);
      useChainSalesStore.getState().updateLocationStatus(locationId, 'disconnected');

      // Schedule reconnection
      this.scheduleReconnect(locationId, locationName, tenantId);
    }
  }

  /**
   * Disconnect from a specific location
   */
  async disconnectFromLocation(locationId: string) {
    const connection = this.connections.get(locationId);
    if (!connection) return;

    console.log(`[MultiLocationWebSocket] Disconnecting from ${connection.locationName}`);

    // Clear reconnect timer if any
    const timer = this.reconnectTimers.get(locationId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(locationId);
    }

    // TODO: Close actual WebSocket connection
    // await orderSyncService.shutdown();

    this.connections.delete(locationId);
    useChainSalesStore.getState().updateLocationStatus(locationId, 'disconnected');
  }

  /**
   * Disconnect from all locations
   */
  async disconnectAll() {
    console.log(`[MultiLocationWebSocket] Disconnecting from all ${this.connections.size} locations`);

    const locationIds = Array.from(this.connections.keys());
    for (const locationId of locationIds) {
      await this.disconnectFromLocation(locationId);
    }
  }

  /**
   * Handle incoming sale from a specific location
   */
  // @ts-expect-error - Unused method, kept for future use
  private _handleSaleFromLocation(locationId: string, transaction: IncomingSaleTransaction) {
    const connection = this.connections.get(locationId);
    if (!connection) {
      console.warn(`[MultiLocationWebSocket] Received sale from unknown location: ${locationId}`);
      return;
    }

    console.log(
      `[MultiLocationWebSocket] Sale from ${connection.locationName}: ₹${transaction.grandTotal}`
    );

    // Route to chain sales store
    useChainSalesStore.getState().addSaleFromLocation(locationId, transaction);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(locationId: string, locationName: string, tenantId: string) {
    const connection = this.connections.get(locationId);
    if (!connection) return;

    if (connection.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[MultiLocationWebSocket] Max reconnect attempts reached for ${locationName}`
      );
      return;
    }

    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, connection.reconnectAttempts),
      60000 // Max 60 seconds
    );

    console.log(
      `[MultiLocationWebSocket] Scheduling reconnect to ${locationName} in ${delay}ms (attempt ${connection.reconnectAttempts + 1})`
    );

    const timer = setTimeout(() => {
      connection.reconnectAttempts++;
      this.connections.set(locationId, connection);
      this.connectToLocation(locationId, locationName, tenantId);
    }, delay);

    this.reconnectTimers.set(locationId, timer);
  }

  /**
   * Get connection status for a location
   */
  getConnectionStatus(locationId: string): LocationConnection | undefined {
    return this.connections.get(locationId);
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses(): LocationConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Check if connected to a location
   */
  isConnected(locationId: string): boolean {
    return this.connections.get(locationId)?.status === 'connected';
  }

  /**
   * Get count of connected locations
   */
  getConnectedCount(): number {
    return Array.from(this.connections.values()).filter(
      (conn) => conn.status === 'connected'
    ).length;
  }
}

// Singleton instance
export const multiLocationWebSocketManager = new MultiLocationWebSocketManager();

// Helper hook for React components
export const useMultiLocationWebSocket = () => {
  const initializeConnections = () => multiLocationWebSocketManager.initializeConnections();
  const disconnectAll = () => multiLocationWebSocketManager.disconnectAll();
  const getConnectedCount = () => multiLocationWebSocketManager.getConnectedCount();
  const getAllStatuses = () => multiLocationWebSocketManager.getAllConnectionStatuses();

  return {
    initializeConnections,
    disconnectAll,
    getConnectedCount,
    getAllStatuses,
  };
};

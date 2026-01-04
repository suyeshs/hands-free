/**
 * Order Sync Service
 *
 * Unified real-time order synchronization with dual-path connectivity:
 * 1. Primary: Cloudflare Durable Objects WebSocket (cloud-based)
 * 2. Fallback: LAN mDNS mesh (local network, offline-capable)
 *
 * The service automatically:
 * - Connects to cloud WebSocket first
 * - Falls back to LAN if cloud is unavailable
 * - Broadcasts orders via both channels when possible (redundancy)
 * - Handles reconnection with exponential backoff
 *
 * Also handles staff and floor plan sync across devices.
 */

import { useKDSStore } from '../stores/kdsStore';
import { useDeviceStore } from '../stores/deviceStore';
import type { KitchenOrder } from '../types/kds';
import type { Order } from '../types/pos';
import type { StaffMember } from '../stores/staffStore';
import type { Section, Table, StaffAssignment, TableStatus } from '../types/floor-plan';
import type { ServiceRequest } from '../types/guest-order';
import type { OutOfStockItem, OutOfStockAlert } from '../types/stock';
import { syncMessageQueue } from './syncMessageQueue';

// Check if we're in Tauri environment (LAN sync only works in Tauri)
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type SyncPath = 'cloud' | 'lan' | 'both' | 'none';

interface OrderStatusUpdateExtra {
  orderNumber?: string;
  tableNumber?: number;
  orderType?: string;
}

interface SyncCallbacks {
  onOrderCreated?: (order: any, kitchenOrder: KitchenOrder) => void;
  onOrderStatusUpdate?: (orderId: string, status: string, extra?: OrderStatusUpdateExtra) => void;
  onConnectionChange?: (status: ConnectionStatus, path: SyncPath) => void;
  onError?: (error: Error, path: 'cloud' | 'lan') => void;
  // Staff sync callbacks
  onStaffSync?: (staff: StaffMember[]) => void;
  onStaffAdded?: (staff: StaffMember) => void;
  onStaffUpdated?: (staffId: string, updates: Partial<StaffMember>) => void;
  onStaffRemoved?: (staffId: string) => void;
  // Floor plan sync callbacks
  onFloorPlanSync?: (sections: Section[], tables: Table[], assignments: StaffAssignment[]) => void;
  onSectionAdded?: (section: Section) => void;
  onSectionRemoved?: (sectionId: string) => void;
  onTableAdded?: (table: Table) => void;
  onTableRemoved?: (tableId: string) => void;
  onTableStatusUpdated?: (tableId: string, status: TableStatus) => void;
  onStaffAssigned?: (assignment: StaffAssignment) => void;
  // Sync request callback (another device is asking for current state)
  onSyncRequested?: (requesterId: string, deviceType: string) => void;
  // QR order callbacks
  onQROrderCreated?: (order: any, tableInfo: { tableId: string; tableNumber: number; sectionName: string }, kitchenOrder: KitchenOrder) => void;
  // Service request callbacks (Call Waiter)
  onServiceRequest?: (request: ServiceRequest) => void;
  onServiceRequestAcknowledged?: (requestId: string, staffId: string, staffName: string) => void;
  onServiceRequestResolved?: (requestId: string) => void;
  // Item ready notification callback (for staff notification when item is ready)
  onItemReady?: (data: {
    orderId: string;
    itemId: string;
    itemName: string;
    orderNumber: string;
    tableNumber?: number;
    assignedStaffId?: string;
  }) => void;
  // Out of Stock (86) callbacks
  onOutOfStock?: (item: OutOfStockItem, alert: OutOfStockAlert) => void;
  onBackInStock?: (itemId: string, itemName: string) => void;
  // Sales sync callbacks (for real-time dashboard updates)
  onSaleCompleted?: (transaction: {
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
  }) => void;
}

interface CloudWSMessage {
  type: string;
  [key: string]: any;
}

class OrderSyncService {
  // Cloud WebSocket state
  private cloudWs: WebSocket | null = null;
  private cloudStatus: ConnectionStatus = 'disconnected';
  private cloudReconnectTimeout: number | undefined;
  private cloudReconnectAttempts = 0;

  // LAN sync state (managed externally via Tauri commands)
  private lanStatus: ConnectionStatus = 'disconnected';
  private lanServerRunning = false;
  private lanConnectedClients = 0;

  // General state
  private tenantId: string | null = null;
  private callbacks: SyncCallbacks = {};
  private isServer = false; // true if this device runs LAN server (POS mode)
  // Dedup map: orderId -> { version, timestamp } for version-based conflict resolution
  private processedOrders = new Map<string, { version: number; timestamp: number }>();
  private lastSyncTimestamp: string | null = null; // For incremental sync on reconnect

  // Config
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private readonly CLOUD_WS_URL = import.meta.env.VITE_ORDERS_WS_URL || 'wss://handsfree-orders.suyesh.workers.dev';
  private readonly DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes (extended from 5 minutes)

  /**
   * Check if order should be processed based on version
   * Returns true if the order should be processed (new or higher version)
   */
  private shouldProcessOrder(orderId: string, version: number): boolean {
    const existing = this.processedOrders.get(orderId);
    const now = Date.now();

    // Clean up expired entries (older than DEDUP_WINDOW_MS)
    this.cleanupProcessedOrders();

    if (!existing) {
      // New order, mark as processed
      this.processedOrders.set(orderId, { version, timestamp: now });
      return true;
    }

    if (version > existing.version) {
      // Higher version, update and process
      this.processedOrders.set(orderId, { version, timestamp: now });
      console.log(`[OrderSyncService] Processing newer version: ${orderId} v${existing.version} -> v${version}`);
      return true;
    }

    // Same or lower version, skip
    console.log(`[OrderSyncService] Skipping duplicate/older: ${orderId} v${version} (have v${existing.version})`);
    return false;
  }

  /**
   * Clean up expired entries from the processed orders map
   */
  private cleanupProcessedOrders(): void {
    const now = Date.now();
    const expireThreshold = now - this.DEDUP_WINDOW_MS;

    for (const [orderId, data] of this.processedOrders.entries()) {
      if (data.timestamp < expireThreshold) {
        this.processedOrders.delete(orderId);
      }
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  private async flushMessageQueue(): Promise<void> {
    try {
      const messages = await syncMessageQueue.flush();
      if (messages.length === 0) {
        console.log('[OrderSyncService] No queued messages to flush');
        return;
      }

      console.log('[OrderSyncService] Flushing', messages.length, 'queued messages');

      for (const msg of messages) {
        if (this.cloudWs?.readyState === WebSocket.OPEN) {
          try {
            this.cloudWs.send(JSON.stringify({
              type: msg.type,
              ...msg.payload,
            }));
            console.log('[OrderSyncService] Flushed queued message:', msg.type, msg.orderId || '');
          } catch (error) {
            console.error('[OrderSyncService] Failed to flush message:', error);
            // Re-queue if send fails
            await syncMessageQueue.enqueue(msg.type, msg.payload, msg.orderId, msg.version);
          }
        } else {
          console.warn('[OrderSyncService] WebSocket closed during flush, re-queueing');
          await syncMessageQueue.enqueue(msg.type, msg.payload, msg.orderId, msg.version);
          break;
        }
      }
    } catch (error) {
      console.error('[OrderSyncService] Failed to flush message queue:', error);
    }
  }

  /**
   * Queue a message for later if WebSocket is not connected
   */
  private async queueMessage(type: string, payload: any, orderId?: string, version?: number): Promise<void> {
    await syncMessageQueue.enqueue(type, payload, orderId, version);
    console.log('[OrderSyncService] Queued message for later:', type, orderId || '');
  }

  /**
   * Initialize the sync service
   */
  async initialize(tenantId: string, callbacks: SyncCallbacks = {}): Promise<void> {
    console.log('[OrderSyncService] Initializing for tenant:', tenantId);

    this.tenantId = tenantId;
    this.callbacks = callbacks;

    // Determine if this device should run LAN server
    const deviceMode = useDeviceStore.getState().deviceMode;
    this.isServer = deviceMode === 'pos' || deviceMode === 'manager';

    // Start cloud WebSocket connection (primary)
    this.connectCloud();

    // Setup LAN sync (if in Tauri environment)
    if (isTauri) {
      await this.setupLanSync();
    }
  }

  /**
   * Shutdown the sync service
   */
  async shutdown(): Promise<void> {
    console.log('[OrderSyncService] Shutting down');

    // Close cloud WebSocket
    this.disconnectCloud();

    // Stop LAN sync
    if (isTauri) {
      await this.stopLanSync();
    }

    this.tenantId = null;
    this.callbacks = {};
    this.processedOrders.clear();
    this.lastSyncTimestamp = null;
  }

  // ==================== CLOUD WEBSOCKET ====================

  private connectCloud(): void {
    if (!this.tenantId) {
      console.warn('[OrderSyncService] No tenantId, skipping cloud connection');
      return;
    }

    if (this.cloudWs?.readyState === WebSocket.OPEN || this.cloudStatus === 'connecting') {
      return;
    }

    const url = `${this.CLOUD_WS_URL}/ws/orders/${this.tenantId}`;
    console.log('[OrderSyncService] Connecting to cloud WebSocket:', url);

    this.cloudStatus = 'connecting';
    this.notifyConnectionChange();

    try {
      this.cloudWs = new WebSocket(url);

      this.cloudWs.onopen = async () => {
        console.log('[OrderSyncService] Cloud WebSocket connected');
        this.cloudStatus = 'connected';
        this.cloudReconnectAttempts = 0;
        this.notifyConnectionChange();

        // Flush queued messages from offline period
        await this.flushMessageQueue();

        // Request sync from other connected devices on connection
        // All devices request sync to get latest data from any connected device
        console.log('[OrderSyncService] Requesting sync from connected devices...');
        this.requestSync();
      };

      this.cloudWs.onmessage = (event) => {
        this.handleCloudMessage(event);
      };

      this.cloudWs.onerror = (error) => {
        console.error('[OrderSyncService] Cloud WebSocket error:', error);
        this.callbacks.onError?.(new Error('Cloud WebSocket error'), 'cloud');
      };

      this.cloudWs.onclose = (event) => {
        console.log('[OrderSyncService] Cloud WebSocket closed:', event.code, event.reason);
        this.cloudWs = null;
        this.cloudStatus = 'disconnected';
        this.notifyConnectionChange();
        this.scheduleCloudReconnect();
      };
    } catch (error) {
      console.error('[OrderSyncService] Cloud connection error:', error);
      this.cloudStatus = 'disconnected';
      this.callbacks.onError?.(error as Error, 'cloud');
      this.scheduleCloudReconnect();
    }
  }

  private disconnectCloud(): void {
    if (this.cloudReconnectTimeout) {
      clearTimeout(this.cloudReconnectTimeout);
      this.cloudReconnectTimeout = undefined;
    }

    if (this.cloudWs) {
      this.cloudWs.close(1000, 'Client shutdown');
      this.cloudWs = null;
    }

    this.cloudStatus = 'disconnected';
    this.cloudReconnectAttempts = 0;
  }

  private scheduleCloudReconnect(): void {
    if (this.cloudReconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn('[OrderSyncService] Max cloud reconnect attempts reached, falling back to LAN only');
      return;
    }

    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, this.cloudReconnectAttempts),
      this.MAX_RECONNECT_DELAY
    ) + Math.random() * 1000;

    console.log(`[OrderSyncService] Scheduling cloud reconnect in ${Math.round(delay)}ms (attempt ${this.cloudReconnectAttempts + 1})`);

    this.cloudReconnectTimeout = window.setTimeout(() => {
      this.cloudReconnectAttempts++;
      this.connectCloud();
    }, delay);
  }

  private handleCloudMessage(event: MessageEvent): void {
    try {
      const message: CloudWSMessage = JSON.parse(event.data);
      console.log('[OrderSyncService] Cloud message:', message.type);

      switch (message.type) {
        case 'order_created': {
          const { order, kitchenOrder } = message;
          const orderId = kitchenOrder?.id || order?.orderId;
          const version = kitchenOrder?.version || 1;

          // Version-based dedup: skip if we already processed this version or higher
          if (orderId && !this.shouldProcessOrder(orderId, version)) {
            return;
          }

          // Add to local stores (kdsStore will handle version conflict resolution)
          if (kitchenOrder) {
            // Ensure version fields are set
            const orderWithVersion = {
              ...kitchenOrder,
              version: version,
              updatedAt: kitchenOrder.updatedAt || new Date().toISOString(),
            };
            useKDSStore.getState().addOrder(orderWithVersion);
          }

          // Track last sync timestamp
          this.lastSyncTimestamp = new Date().toISOString();

          // Notify callback
          this.callbacks.onOrderCreated?.(order, kitchenOrder);
          break;
        }

        case 'order_status_update': {
          const { orderId, status, orderNumber, tableNumber, orderType, version } = message;
          console.log('[OrderSyncService] Status update received:', orderId, status, orderNumber, tableNumber, `v${version || '?'}`);

          // Version-based conflict resolution
          const existingOrder = useKDSStore.getState().getOrderById(orderId);
          if (existingOrder && version !== undefined) {
            const localVersion = existingOrder.version || 0;
            if (version <= localVersion) {
              console.log(`[OrderSyncService] Skipping older status update: v${version} <= local v${localVersion}`);
              return;
            }
          }

          // For completed orders, call moveToCompleted to remove from KDS display
          // The second param (true) indicates this is from a broadcast, preventing re-broadcast loops
          if (status === 'completed') {
            useKDSStore.getState().moveToCompleted(orderId, true);
          } else {
            useKDSStore.getState().updateOrder(orderId, { status, version });
          }

          // Track last sync timestamp
          this.lastSyncTimestamp = new Date().toISOString();

          this.callbacks.onOrderStatusUpdate?.(orderId, status, { orderNumber, tableNumber, orderType });
          break;
        }

        case 'item_status_update': {
          const { orderId, itemId, status, itemName } = message;
          console.log('[OrderSyncService] Item status update received:', orderId, itemId, status, itemName);

          // Update item status in KDS store (in-memory)
          useKDSStore.getState().updateItemStatus(orderId, itemId, status);

          // Also persist to local SQLite to prevent stale data on device restart
          import('./kdsOrderService').then(({ kdsOrderService }) => {
            kdsOrderService.updateItemStatus(orderId, itemId, status).catch((e) => {
              console.warn('[OrderSyncService] Failed to persist remote item status to SQLite:', e);
            });
          }).catch(() => {});
          break;
        }

        case 'sync_state': {
          const { activeOrders = [] } = message;
          console.log('[OrderSyncService] Sync state:', activeOrders.length, 'orders received');

          // Don't wipe existing orders when receiving empty sync_state
          // Empty sync_state is sent on initial connection, real sync comes from other devices
          if (activeOrders.length > 0) {
            // Filter out completed orders - only keep truly active orders
            const nonCompletedOrders = activeOrders.filter(
              (o: any) => o.status !== 'completed'
            );
            console.log('[OrderSyncService] After filtering completed:', nonCompletedOrders.length, 'active orders');

            // Merge incoming orders with existing local orders
            // This ensures we don't lose local orders that the syncing device doesn't have
            const kdsStore = useKDSStore.getState();
            const existingOrders = kdsStore.activeOrders;

            // Filter out completed orders from existing orders too
            const existingActiveOrders = existingOrders.filter(
              (o) => o.status !== 'completed'
            );

            // Build a map of incoming orders by ID and orderNumber for quick lookup
            const incomingById = new Map(nonCompletedOrders.map((o: any) => [o.id, o]));
            const incomingByOrderNumber = new Map(nonCompletedOrders.map((o: any) => [o.orderNumber, o]));

            // Keep local orders that aren't in the incoming set (by ID or orderNumber)
            // and are not completed
            const localOnlyOrders = existingActiveOrders.filter(
              (local) => !incomingById.has(local.id) && !incomingByOrderNumber.has(local.orderNumber)
            );

            // Merge: incoming orders (authoritative) + local-only orders
            const mergedOrders = [...nonCompletedOrders, ...localOnlyOrders];
            console.log('[OrderSyncService] Merged orders:', mergedOrders.length, '(incoming:', nonCompletedOrders.length, ', local-only:', localOnlyOrders.length, ')');

            kdsStore.setActiveOrders(mergedOrders);
          } else {
            console.log('[OrderSyncService] Ignoring empty sync_state, keeping existing orders');
          }

          // Persist synced orders to local SQLite to prevent stale data on restart
          if (this.tenantId) {
            const tenantId = this.tenantId;
            import('./kdsOrderService').then(({ kdsOrderService }) => {
              activeOrders.forEach((order: any) => {
                kdsOrderService.saveOrder(tenantId, order).catch((e) => {
                  console.warn('[OrderSyncService] Failed to persist synced order to SQLite:', e);
                });
              });
            }).catch(() => {});
          }
          break;
        }

        case 'pong':
          // Heartbeat response, ignore
          break;

        // Staff sync messages
        case 'staff_sync': {
          const { staff } = message;
          console.log('[OrderSyncService] Received staff sync:', staff?.length, 'members');
          this.callbacks.onStaffSync?.(staff || []);
          break;
        }

        case 'staff_added': {
          const { staff } = message;
          console.log('[OrderSyncService] Received staff added:', staff?.name);
          if (staff) {
            this.callbacks.onStaffAdded?.(staff);
          }
          break;
        }

        case 'staff_updated': {
          const { staffId, updates } = message;
          console.log('[OrderSyncService] Received staff updated:', staffId);
          this.callbacks.onStaffUpdated?.(staffId, updates);
          break;
        }

        case 'staff_removed': {
          const { staffId } = message;
          console.log('[OrderSyncService] Received staff removed:', staffId);
          this.callbacks.onStaffRemoved?.(staffId);
          break;
        }

        // Floor plan sync messages
        case 'floorplan_sync': {
          const { sections, tables, assignments } = message;
          console.log('[OrderSyncService] Received floor plan sync:', sections?.length, 'sections,', tables?.length, 'tables');
          this.callbacks.onFloorPlanSync?.(sections || [], tables || [], assignments || []);
          break;
        }

        case 'section_added': {
          const { section } = message;
          console.log('[OrderSyncService] Received section added:', section?.name);
          if (section) {
            this.callbacks.onSectionAdded?.(section);
          }
          break;
        }

        case 'section_removed': {
          const { sectionId } = message;
          console.log('[OrderSyncService] Received section removed:', sectionId);
          this.callbacks.onSectionRemoved?.(sectionId);
          break;
        }

        case 'table_added': {
          const { table } = message;
          console.log('[OrderSyncService] Received table added:', table?.tableNumber);
          if (table) {
            this.callbacks.onTableAdded?.(table);
          }
          break;
        }

        case 'table_removed': {
          const { tableId } = message;
          console.log('[OrderSyncService] Received table removed:', tableId);
          this.callbacks.onTableRemoved?.(tableId);
          break;
        }

        case 'table_status_updated': {
          const { tableId, status } = message;
          console.log('[OrderSyncService] Received table status updated:', tableId, '->', status);
          this.callbacks.onTableStatusUpdated?.(tableId, status);
          break;
        }

        case 'staff_assigned': {
          const { assignment } = message;
          console.log('[OrderSyncService] Received staff assigned:', assignment?.userId);
          if (assignment) {
            this.callbacks.onStaffAssigned?.(assignment);
          }
          break;
        }

        case 'sync_requested': {
          const { requesterId, deviceType, since } = message;
          console.log('[OrderSyncService] Sync requested by:', requesterId, deviceType, 'since:', since || 'beginning');

          // Respond with orders sync (filtered by 'since' if provided)
          this.broadcastOrdersSync(since);

          this.callbacks.onSyncRequested?.(requesterId, deviceType);
          break;
        }

        // QR order messages
        case 'qr_order_created': {
          const { order, tableInfo, kitchenOrder } = message;
          const orderId = kitchenOrder?.id || order?.orderId;
          const version = kitchenOrder?.version || 1;
          console.log('[OrderSyncService] QR order created:', orderId, 'for table', tableInfo?.tableNumber, `v${version}`);

          // Version-based dedup
          if (orderId && !this.shouldProcessOrder(orderId, version)) {
            return;
          }

          // Add to KDS with version
          if (kitchenOrder) {
            const orderWithVersion = {
              ...kitchenOrder,
              version: version,
              updatedAt: kitchenOrder.updatedAt || new Date().toISOString(),
            };
            useKDSStore.getState().addOrder(orderWithVersion);
          }

          // Track last sync timestamp
          this.lastSyncTimestamp = new Date().toISOString();

          // Notify callback
          this.callbacks.onQROrderCreated?.(order, tableInfo, kitchenOrder);
          // Also notify general order callback for backwards compatibility
          this.callbacks.onOrderCreated?.(order, kitchenOrder);
          break;
        }

        // Service request messages (Call Waiter)
        case 'service_request': {
          const { request } = message;
          console.log('[OrderSyncService] Service request received:', request?.type, 'for table', request?.tableNumber);
          if (request) {
            this.callbacks.onServiceRequest?.(request);
          }
          break;
        }

        case 'service_request_acknowledged': {
          const { requestId, staffId, staffName } = message;
          console.log('[OrderSyncService] Service request acknowledged:', requestId, 'by', staffName);
          this.callbacks.onServiceRequestAcknowledged?.(requestId, staffId, staffName);
          break;
        }

        case 'service_request_resolved': {
          const { requestId } = message;
          console.log('[OrderSyncService] Service request resolved:', requestId);
          this.callbacks.onServiceRequestResolved?.(requestId);
          break;
        }

        // Item ready notification (when KDS marks an item as ready)
        case 'item_ready': {
          const { orderId, itemId, itemName, orderNumber, tableNumber, assignedStaffId } = message;
          console.log('[OrderSyncService] Item ready received:', itemName, 'for order', orderNumber, 'table', tableNumber);
          this.callbacks.onItemReady?.({
            orderId,
            itemId,
            itemName,
            orderNumber,
            tableNumber,
            assignedStaffId,
          });
          break;
        }

        // Out of Stock (86) notifications
        case 'out_of_stock': {
          const { item, alert } = message;
          console.log('[OrderSyncService] Out of stock received:', item?.itemName, 'portions:', item?.portionsOut);
          if (item && alert) {
            this.callbacks.onOutOfStock?.(item, alert);
          }
          break;
        }

        case 'back_in_stock': {
          const { itemId, itemName } = message;
          console.log('[OrderSyncService] Back in stock received:', itemName);
          this.callbacks.onBackInStock?.(itemId, itemName);
          break;
        }

        // Sales transaction completed (for real-time dashboard updates)
        case 'sale_completed': {
          const { transaction } = message;
          console.log('[OrderSyncService] Sale completed received:', transaction?.invoiceNumber, transaction?.grandTotal);
          if (transaction) {
            this.callbacks.onSaleCompleted?.(transaction);
          }
          break;
        }

        case 'order_update': {
          const { order } = message;
          const incomingVersion = order?.version || 1;
          console.log('[OrderSyncService] Order update received:', order?.orderNumber, order?.items?.length, 'items', `v${incomingVersion}`);

          if (order) {
            // Version-based conflict resolution
            const existingOrder = useKDSStore.getState().getOrderById(order.id);
            if (existingOrder) {
              const localVersion = existingOrder.version || 0;
              if (incomingVersion <= localVersion) {
                console.log(`[OrderSyncService] Skipping older order update: v${incomingVersion} <= local v${localVersion}`);
                break;
              }
            }

            // Update the order in KDS store (replaces the entire order)
            // Pass the version to ensure proper tracking
            useKDSStore.getState().updateOrder(order.id, {
              ...order,
              version: incomingVersion,
              updatedAt: order.updatedAt || new Date().toISOString(),
            });

            // Track last sync timestamp
            this.lastSyncTimestamp = new Date().toISOString();

            // Also persist to SQLite
            if (this.tenantId) {
              const tenantId = this.tenantId;
              import('./kdsOrderService').then(({ kdsOrderService }) => {
                kdsOrderService.saveOrder(tenantId, order).catch((e) => {
                  console.warn('[OrderSyncService] Failed to persist updated order to SQLite:', e);
                });
              }).catch(() => {});
            }
          }
          break;
        }

        default:
          console.warn('[OrderSyncService] Unknown cloud message type:', message.type);
      }
    } catch (error) {
      console.error('[OrderSyncService] Failed to parse cloud message:', error);
    }
  }

  // ==================== LAN SYNC ====================

  private async setupLanSync(): Promise<void> {
    if (!isTauri || !this.tenantId) return;

    try {
      const { setupLanSyncListeners, startLanServer, autoConnectToPos } = await import('./lanSyncService');
      const deviceStore = useDeviceStore.getState();

      // Setup event listeners for LAN messages
      await setupLanSyncListeners({
        onOrderCreated: (order: unknown, kitchenOrder: unknown) => {
          const ko = kitchenOrder as KitchenOrder;
          const orderId = ko?.id;
          const version = ko?.version || 1;

          // Version-based dedup: skip if we already processed this version or higher
          if (orderId && !this.shouldProcessOrder(orderId, version)) {
            console.log('[OrderSyncService] Skipping duplicate/older order from LAN:', orderId);
            return;
          }

          // Add to local KDS with version
          if (ko) {
            const koWithVersion = {
              ...ko,
              version: version,
              updatedAt: ko.updatedAt || new Date().toISOString(),
            };
            useKDSStore.getState().addOrder(koWithVersion);
          }

          this.callbacks.onOrderCreated?.(order, ko);
        },
        onOrderStatusUpdate: (orderId: string, status: string) => {
          // For completed orders, call moveToCompleted to remove from KDS display
          if (status === 'completed') {
            useKDSStore.getState().moveToCompleted(orderId, true);
          } else {
            useKDSStore.getState().updateOrder(orderId, { status: status as any });
          }
          this.callbacks.onOrderStatusUpdate?.(orderId, status);
        },
        onSyncState: (orders: unknown[]) => {
          console.log('[OrderSyncService] LAN sync state:', orders.length, 'orders');
          // Orders from LAN are kitchen orders - use version-based dedup
          orders.forEach((order: any) => {
            const version = order.version || 1;
            if (order.id && this.shouldProcessOrder(order.id, version)) {
              const orderWithVersion = {
                ...order,
                version: version,
                updatedAt: order.updatedAt || new Date().toISOString(),
              };
              useKDSStore.getState().addOrder(orderWithVersion as KitchenOrder);
            }
          });
        },
        onConnected: (_status) => {
          console.log('[OrderSyncService] LAN connected to server');
          this.lanStatus = 'connected';
          deviceStore.setIsLanConnected(true);
          this.notifyConnectionChange();
        },
        onDisconnected: () => {
          console.log('[OrderSyncService] LAN disconnected from server');
          this.lanStatus = 'disconnected';
          deviceStore.setIsLanConnected(false);
          this.notifyConnectionChange();
        },
        onClientConnected: (clientInfo) => {
          console.log('[OrderSyncService] LAN client connected:', clientInfo.deviceType);
          this.lanConnectedClients++;
        },
        onClientDisconnected: (clientId) => {
          console.log('[OrderSyncService] LAN client disconnected:', clientId);
          this.lanConnectedClients = Math.max(0, this.lanConnectedClients - 1);
        },
      });

      // Start LAN server (if POS/Manager) or connect as client (if KDS/BDS)
      if (this.isServer) {
        console.log('[OrderSyncService] Starting LAN server for tenant:', this.tenantId);
        try {
          const address = await startLanServer(this.tenantId);
          console.log('[OrderSyncService] LAN server started at:', address);
          this.lanServerRunning = true;
          this.lanStatus = 'connected'; // Server is "connected" when running
          this.notifyConnectionChange();
        } catch (error) {
          console.error('[OrderSyncService] Failed to start LAN server:', error);
          this.callbacks.onError?.(error as Error, 'lan');
        }
      } else {
        // KDS/BDS mode - connect as client
        console.log('[OrderSyncService] Auto-connecting to POS via LAN...');
        const deviceMode = useDeviceStore.getState().deviceMode;
        const lanDeviceType = deviceMode === 'kds' ? 'kds' : deviceMode === 'bds' ? 'bds' : 'manager';

        try {
          const status = await autoConnectToPos(lanDeviceType, this.tenantId);
          if (status?.isConnected) {
            console.log('[OrderSyncService] Connected to POS via LAN');
            this.lanStatus = 'connected';
          } else {
            console.log('[OrderSyncService] No POS found on LAN, will use cloud only');
            this.lanStatus = 'disconnected';
          }
          this.notifyConnectionChange();
        } catch (error) {
          console.error('[OrderSyncService] LAN connection failed:', error);
          this.lanStatus = 'disconnected';
        }
      }
    } catch (error) {
      console.error('[OrderSyncService] Failed to setup LAN sync:', error);
    }
  }

  private async stopLanSync(): Promise<void> {
    if (!isTauri) return;

    try {
      if (this.isServer && this.lanServerRunning) {
        const { stopLanServer } = await import('./lanSyncService');
        await stopLanServer();
        this.lanServerRunning = false;
      } else {
        const { disconnectLanServer } = await import('./lanSyncService');
        await disconnectLanServer();
      }
      this.lanStatus = 'disconnected';
    } catch (error) {
      console.error('[OrderSyncService] Failed to stop LAN sync:', error);
    }
  }

  // ==================== ORDER BROADCASTING ====================

  /**
   * Broadcast an order to all connected devices
   * Sends via both cloud and LAN for redundancy
   */
  async broadcastOrder(order: Order, kitchenOrder: KitchenOrder): Promise<{ cloud: boolean; lan: number }> {
    const result = { cloud: false, lan: 0 };
    const orderId = kitchenOrder.id;

    // Ensure kitchen order has version
    const version = kitchenOrder.version || 1;
    const kitchenOrderWithVersion = {
      ...kitchenOrder,
      version: version,
      updatedAt: kitchenOrder.updatedAt || new Date().toISOString(),
    };

    // Mark as processed to avoid echo (with version)
    if (orderId) {
      this.processedOrders.set(orderId, { version, timestamp: Date.now() });
    }

    console.log('[OrderSyncService] broadcastOrder called, wsState:', this.cloudWs?.readyState, 'cloudStatus:', this.cloudStatus, 'tenantId:', this.tenantId);

    // If WebSocket is not connected, try to reconnect first
    if (this.cloudWs?.readyState !== WebSocket.OPEN && this.tenantId) {
      console.log('[OrderSyncService] WebSocket not connected for order broadcast, attempting reconnect...');
      this.connectCloud();

      // Wait up to 3 seconds for connection to establish
      let attempts = 0;
      while (this.cloudWs?.readyState !== WebSocket.OPEN && attempts < 6) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      console.log('[OrderSyncService] After reconnect attempt, wsState:', this.cloudWs?.readyState, 'attempts:', attempts);
    }

    // Broadcast via cloud WebSocket (if connected)
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'broadcast_order',
          order,
          kitchenOrder: kitchenOrderWithVersion,
        }));
        result.cloud = true;
        console.log('[OrderSyncService] Order broadcast via cloud:', kitchenOrderWithVersion.orderNumber, `v${version}`);
      } catch (error) {
        console.error('[OrderSyncService] Cloud broadcast failed:', error);
      }
    } else {
      console.warn('[OrderSyncService] WebSocket not connected for order broadcast. State:', this.cloudWs?.readyState, 'tenantId:', this.tenantId);
    }

    // Broadcast via LAN (if server is running with clients)
    if (isTauri && this.isServer && this.lanServerRunning) {
      try {
        const { broadcastOrder } = await import('./lanSyncService');
        result.lan = await broadcastOrder(order, kitchenOrderWithVersion);
        if (result.lan > 0) {
          console.log(`[OrderSyncService] Order broadcast to ${result.lan} LAN client(s) v${version}`);
        }
      } catch (error) {
        console.warn('[OrderSyncService] LAN broadcast failed:', error);
      }
    }

    return result;
  }

  /**
   * Broadcast order status update
   * @param orderId - The kitchen order ID
   * @param status - The new status
   * @param extra - Additional data (orderNumber, tableNumber, orderType) for matching on receiving devices
   * @returns Promise that resolves to true if broadcast was sent successfully
   */
  async broadcastStatusUpdate(orderId: string, status: string, extra?: { orderNumber?: string; tableNumber?: number; orderType?: string }): Promise<boolean> {
    const BROADCAST_TIMEOUT_MS = 5000; // 5 second timeout

    // Get current order version and increment it
    const currentOrder = useKDSStore.getState().getOrderById(orderId);
    const newVersion = (currentOrder?.version || 0) + 1;

    console.log('[OrderSyncService] broadcastStatusUpdate called:', orderId, status, `v${newVersion}`, 'wsState:', this.cloudWs?.readyState, 'cloudStatus:', this.cloudStatus, 'tenantId:', this.tenantId);

    return new Promise<boolean>(async (resolve) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        console.warn('[OrderSyncService] Status broadcast timed out');
        resolve(false);
      }, BROADCAST_TIMEOUT_MS);

      try {
        // If WebSocket is not connected, try to reconnect first
        if (this.cloudWs?.readyState !== WebSocket.OPEN && this.tenantId) {
          console.log('[OrderSyncService] WebSocket not connected, attempting reconnect...');
          this.connectCloud();

          // Wait up to 3 seconds for connection to establish
          let attempts = 0;
          while (this.cloudWs?.readyState !== WebSocket.OPEN && attempts < 6) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
          }
          console.log('[OrderSyncService] After reconnect attempt, wsState:', this.cloudWs?.readyState, 'attempts:', attempts);
        }

        let cloudSuccess = false;
        let lanSuccess = false;

        // Broadcast via cloud
        if (this.cloudWs?.readyState === WebSocket.OPEN) {
          this.cloudWs.send(JSON.stringify({
            type: 'status_update',
            orderId,
            status,
            version: newVersion,
            orderNumber: extra?.orderNumber,
            tableNumber: extra?.tableNumber,
            orderType: extra?.orderType,
          }));
          console.log('[OrderSyncService] Status broadcast sent:', orderId, status, `v${newVersion}`, extra?.orderNumber);
          cloudSuccess = true;
        } else {
          // Queue for later when offline
          console.warn('[OrderSyncService] WebSocket not connected, queueing message for later');
          await this.queueMessage('status_update', {
            orderId,
            status,
            version: newVersion,
            orderNumber: extra?.orderNumber,
            tableNumber: extra?.tableNumber,
            orderType: extra?.orderType,
          }, orderId, newVersion);
        }

        // Broadcast via LAN
        if (isTauri && this.isServer && this.lanServerRunning) {
          try {
            const { broadcastOrderStatus } = await import('./lanSyncService');
            await broadcastOrderStatus(orderId, status);
            lanSuccess = true;
          } catch (error) {
            console.warn('[OrderSyncService] LAN status broadcast failed:', error);
          }
        }

        clearTimeout(timeout);
        resolve(cloudSuccess || lanSuccess);
      } catch (error) {
        console.error('[OrderSyncService] Status broadcast failed:', error);
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * Broadcast individual item status update within an order
   * This syncs item-level status changes (ready, in_progress) to POS devices
   * Returns a promise that resolves when the broadcast is sent (with timeout)
   */
  async broadcastItemStatusUpdate(
    orderId: string,
    itemId: string,
    status: string,
    extra?: { orderNumber?: string; tableNumber?: number; itemName?: string }
  ): Promise<boolean> {
    const BROADCAST_TIMEOUT_MS = 5000; // 5 second timeout
    console.log('[OrderSyncService] broadcastItemStatusUpdate:', orderId, itemId, status, extra);

    return new Promise<boolean>(async (resolve) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        console.warn('[OrderSyncService] Item status broadcast timed out');
        resolve(false);
      }, BROADCAST_TIMEOUT_MS);

      try {
        // If WebSocket is not connected, try to reconnect first
        if (this.cloudWs?.readyState !== WebSocket.OPEN && this.tenantId) {
          this.connectCloud();
          let attempts = 0;
          while (this.cloudWs?.readyState !== WebSocket.OPEN && attempts < 6) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
          }
        }

        // Broadcast via cloud
        if (this.cloudWs?.readyState === WebSocket.OPEN) {
          this.cloudWs.send(JSON.stringify({
            type: 'item_status_update',
            orderId,
            itemId,
            status,
            orderNumber: extra?.orderNumber,
            tableNumber: extra?.tableNumber,
            itemName: extra?.itemName,
          }));
          console.log('[OrderSyncService] Item status broadcast sent:', itemId, status);
          clearTimeout(timeout);
          resolve(true);
        } else {
          console.warn('[OrderSyncService] WebSocket not connected for item status broadcast');
          clearTimeout(timeout);
          resolve(false);
        }
      } catch (error) {
        console.error('[OrderSyncService] Item status broadcast failed:', error);
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  // ==================== STAFF SYNC ====================

  /**
   * Broadcast full staff list (for initial sync or full resync)
   */
  broadcastStaffSync(staff: StaffMember[]): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        // Remove sensitive data before broadcasting
        const safeStaff = staff.map(s => ({
          ...s,
          pin: '****',
          pinHash: undefined, // Don't send hashes over the wire
        }));
        this.cloudWs.send(JSON.stringify({
          type: 'staff_sync',
          staff: safeStaff,
          timestamp: new Date().toISOString(),
        }));
        console.log('[OrderSyncService] Staff sync broadcast:', staff.length, 'members');
      } catch (error) {
        console.error('[OrderSyncService] Staff sync broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast staff added
   */
  broadcastStaffAdded(staff: StaffMember): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        const safeStaff = { ...staff, pin: '****', pinHash: undefined };
        this.cloudWs.send(JSON.stringify({
          type: 'staff_added',
          staff: safeStaff,
        }));
        console.log('[OrderSyncService] Staff added broadcast:', staff.name);
      } catch (error) {
        console.error('[OrderSyncService] Staff added broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast staff updated
   */
  broadcastStaffUpdated(staffId: string, updates: Partial<StaffMember>): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        // Remove sensitive data from updates
        const safeUpdates = { ...updates, pin: undefined, pinHash: undefined };
        this.cloudWs.send(JSON.stringify({
          type: 'staff_updated',
          staffId,
          updates: safeUpdates,
        }));
        console.log('[OrderSyncService] Staff updated broadcast:', staffId);
      } catch (error) {
        console.error('[OrderSyncService] Staff updated broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast staff removed
   */
  broadcastStaffRemoved(staffId: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'staff_removed',
          staffId,
        }));
        console.log('[OrderSyncService] Staff removed broadcast:', staffId);
      } catch (error) {
        console.error('[OrderSyncService] Staff removed broadcast failed:', error);
      }
    }
  }

  // ==================== FLOOR PLAN SYNC ====================

  /**
   * Broadcast full floor plan (for initial sync or full resync)
   */
  broadcastFloorPlanSync(sections: Section[], tables: Table[], assignments: StaffAssignment[]): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'floorplan_sync',
          sections,
          tables,
          assignments,
          timestamp: new Date().toISOString(),
        }));
        console.log('[OrderSyncService] Floor plan sync broadcast:', sections.length, 'sections,', tables.length, 'tables');
      } catch (error) {
        console.error('[OrderSyncService] Floor plan sync broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast section added
   */
  broadcastSectionAdded(section: Section): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'section_added',
          section,
        }));
        console.log('[OrderSyncService] Section added broadcast:', section.name);
      } catch (error) {
        console.error('[OrderSyncService] Section added broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast section removed
   */
  broadcastSectionRemoved(sectionId: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'section_removed',
          sectionId,
        }));
        console.log('[OrderSyncService] Section removed broadcast:', sectionId);
      } catch (error) {
        console.error('[OrderSyncService] Section removed broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast table added
   */
  broadcastTableAdded(table: Table): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'table_added',
          table,
        }));
        console.log('[OrderSyncService] Table added broadcast:', table.tableNumber);
      } catch (error) {
        console.error('[OrderSyncService] Table added broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast table removed
   */
  broadcastTableRemoved(tableId: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'table_removed',
          tableId,
        }));
        console.log('[OrderSyncService] Table removed broadcast:', tableId);
      } catch (error) {
        console.error('[OrderSyncService] Table removed broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast table status update
   */
  broadcastTableStatusUpdated(tableId: string, status: TableStatus): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'table_status_updated',
          tableId,
          status,
        }));
        console.log('[OrderSyncService] Table status broadcast:', tableId, '->', status);
      } catch (error) {
        console.error('[OrderSyncService] Table status broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast staff assignment
   */
  broadcastStaffAssigned(assignment: StaffAssignment): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'staff_assigned',
          assignment,
        }));
        console.log('[OrderSyncService] Staff assigned broadcast:', assignment.userId);
      } catch (error) {
        console.error('[OrderSyncService] Staff assigned broadcast failed:', error);
      }
    }
  }

  /**
   * Request sync from other devices (when device first connects)
   * Includes last sync timestamp for incremental sync
   */
  requestSync(): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'request_sync',
          since: this.lastSyncTimestamp, // Request orders newer than this timestamp
        }));
        console.log('[OrderSyncService] Requesting sync from other devices, since:', this.lastSyncTimestamp || 'beginning');
      } catch (error) {
        console.error('[OrderSyncService] Request sync failed:', error);
      }
    }
  }

  /**
   * Broadcast current orders to requesting device (responding to sync_requested)
   * Filters orders based on the 'since' timestamp for incremental sync
   */
  broadcastOrdersSync(since?: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        const kdsStore = useKDSStore.getState();
        let ordersToSync = [...kdsStore.activeOrders];

        // Filter by timestamp if 'since' is provided
        if (since) {
          const sinceTime = new Date(since).getTime();
          ordersToSync = ordersToSync.filter((order) => {
            const orderTime = new Date(order.updatedAt || order.createdAt).getTime();
            return orderTime > sinceTime;
          });
          console.log(`[OrderSyncService] Incremental sync: ${ordersToSync.length} orders newer than ${since}`);
        }

        // Ensure all orders have version info
        const ordersWithVersion = ordersToSync.map((order) => ({
          ...order,
          version: order.version || 1,
          updatedAt: order.updatedAt || new Date().toISOString(),
        }));

        this.cloudWs.send(JSON.stringify({
          type: 'sync_state',
          activeOrders: ordersWithVersion,
          timestamp: new Date().toISOString(),
        }));
        console.log('[OrderSyncService] Broadcast orders sync:', ordersWithVersion.length, 'orders');
      } catch (error) {
        console.error('[OrderSyncService] Orders sync broadcast failed:', error);
      }
    }
  }

  // ==================== SERVICE REQUEST SYNC ====================

  /**
   * Broadcast a service request (Call Waiter)
   */
  broadcastServiceRequest(request: ServiceRequest): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'service_request',
          request,
        }));
        console.log('[OrderSyncService] Service request broadcast:', request.type, 'for table', request.tableNumber);
      } catch (error) {
        console.error('[OrderSyncService] Service request broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast service request acknowledgment
   */
  broadcastServiceRequestAck(requestId: string, staffId: string, staffName: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'service_request_acknowledged',
          requestId,
          staffId,
          staffName,
        }));
        console.log('[OrderSyncService] Service request ack broadcast:', requestId, 'by', staffName);
      } catch (error) {
        console.error('[OrderSyncService] Service request ack broadcast failed:', error);
      }
    }
  }

  /**
   * Broadcast service request resolution
   */
  broadcastServiceRequestResolved(requestId: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'service_request_resolved',
          requestId,
        }));
        console.log('[OrderSyncService] Service request resolved broadcast:', requestId);
      } catch (error) {
        console.error('[OrderSyncService] Service request resolved broadcast failed:', error);
      }
    }
  }

  // ==================== ITEM READY NOTIFICATION ====================

  /**
   * Broadcast item ready notification
   * Called when KDS marks an individual item as ready
   * Notifies service staff (POS/Service Dashboard) that an item can be served
   */
  broadcastItemReady(
    orderId: string,
    itemId: string,
    itemName: string,
    orderNumber: string,
    tableNumber?: number,
    assignedStaffId?: string
  ): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'item_ready',
          orderId,
          itemId,
          itemName,
          orderNumber,
          tableNumber,
          assignedStaffId,
        }));
        console.log('[OrderSyncService] Item ready broadcast:', itemName, 'for order', orderNumber, tableNumber ? `table ${tableNumber}` : '');
      } catch (error) {
        console.error('[OrderSyncService] Item ready broadcast failed:', error);
      }
    }

    // Also broadcast via LAN if server is running
    if (isTauri && this.isServer && this.lanServerRunning) {
      // LAN broadcast would go here if needed
      // For now, cloud is the primary notification channel
    }
  }

  // ==================== OUT OF STOCK (86) NOTIFICATIONS ====================

  /**
   * Broadcast out of stock notification
   * Called when KDS marks an item as 86'd (out of stock)
   * Notifies POS and Service Dashboard devices
   */
  broadcastOutOfStock(item: OutOfStockItem, alert: OutOfStockAlert): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'out_of_stock',
          item,
          alert,
        }));
        console.log('[OrderSyncService] Out of stock broadcast:', item.itemName, 'portions:', item.portionsOut);
      } catch (error) {
        console.error('[OrderSyncService] Out of stock broadcast failed:', error);
      }
    }

    // Also broadcast via LAN if server is running
    if (isTauri && this.isServer && this.lanServerRunning) {
      // LAN broadcast would go here if needed
    }
  }

  /**
   * Broadcast back in stock notification
   * Called when an item is marked as available again
   */
  broadcastBackInStock(itemId: string, itemName: string): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'back_in_stock',
          itemId,
          itemName,
        }));
        console.log('[OrderSyncService] Back in stock broadcast:', itemName);
      } catch (error) {
        console.error('[OrderSyncService] Back in stock broadcast failed:', error);
      }
    }

    // Also broadcast via LAN if server is running
    if (isTauri && this.isServer && this.lanServerRunning) {
      // LAN broadcast would go here if needed
    }
  }

  /**
   * Broadcast full order update (e.g., when item quantities change due to 86)
   * Syncs the entire order state to all connected devices
   */
  async broadcastOrderUpdate(order: KitchenOrder): Promise<void> {
    // Increment version for the update
    const newVersion = (order.version || 0) + 1;
    const orderWithVersion = {
      ...order,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'order_update',
          order: orderWithVersion,
        }));
        console.log('[OrderSyncService] Order update broadcast:', order.orderNumber, order.items.length, 'items', `v${newVersion}`);
      } catch (error) {
        console.error('[OrderSyncService] Order update broadcast failed:', error);
      }
    } else {
      // Queue for later when offline
      await this.queueMessage('order_update', { order: orderWithVersion }, order.id, newVersion);
    }

    // Also broadcast via LAN if server is running
    if (isTauri && this.isServer && this.lanServerRunning) {
      // LAN broadcast would go here if needed
    }
  }

  // ==================== SALES SYNC TO D1 ====================

  /**
   * Broadcast sale completed for immediate D1 persistence
   * The Durable Object receives this and writes directly to D1 via tenant worker
   */
  broadcastSaleCompleted(transaction: {
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
  }): void {
    if (this.cloudWs?.readyState === WebSocket.OPEN) {
      try {
        this.cloudWs.send(JSON.stringify({
          type: 'sale_completed',
          transaction,
        }));
        console.log('[OrderSyncService] Sale completed broadcast:', transaction.invoiceNumber, transaction.grandTotal);
      } catch (error) {
        console.error('[OrderSyncService] Sale completed broadcast failed:', error);
      }
    } else {
      console.warn('[OrderSyncService] WebSocket not connected, cannot broadcast sale. Will rely on batch sync.');
    }
  }

  // ==================== STATUS & HELPERS ====================

  private notifyConnectionChange(): void {
    const path = this.getActiveSyncPath();
    const status = this.getConnectionStatus();
    this.callbacks.onConnectionChange?.(status, path);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    if (this.cloudStatus === 'connected' || this.lanStatus === 'connected') {
      return 'connected';
    }
    if (this.cloudStatus === 'connecting' || this.lanStatus === 'connecting') {
      return 'connecting';
    }
    return 'disconnected';
  }

  /**
   * Get which sync paths are active
   */
  getActiveSyncPath(): SyncPath {
    const cloudActive = this.cloudStatus === 'connected';
    const lanActive = this.lanStatus === 'connected';

    if (cloudActive && lanActive) return 'both';
    if (cloudActive) return 'cloud';
    if (lanActive) return 'lan';
    return 'none';
  }

  /**
   * Get detailed status for debugging
   */
  getDetailedStatus(): {
    cloud: { status: ConnectionStatus; reconnectAttempts: number };
    lan: { status: ConnectionStatus; isServer: boolean; serverRunning: boolean; connectedClients: number };
    activePath: SyncPath;
  } {
    return {
      cloud: {
        status: this.cloudStatus,
        reconnectAttempts: this.cloudReconnectAttempts,
      },
      lan: {
        status: this.lanStatus,
        isServer: this.isServer,
        serverRunning: this.lanServerRunning,
        connectedClients: this.lanConnectedClients,
      },
      activePath: this.getActiveSyncPath(),
    };
  }

  /**
   * Check if cloud is connected
   */
  isCloudConnected(): boolean {
    return this.cloudStatus === 'connected';
  }

  /**
   * Check if LAN is connected/running
   */
  isLanConnected(): boolean {
    return this.lanStatus === 'connected';
  }
}

// Singleton instance
export const orderSyncService = new OrderSyncService();

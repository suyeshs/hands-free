/**
 * Order Orchestration Service
 *
 * Centralized service that manages the complete order lifecycle across all sources:
 * - Aggregator orders (Swiggy, Zomato, Website)
 * - POS orders (Dine-in, Takeaway)
 * - QR/Online orders
 *
 * This service is the SINGLE SOURCE OF TRUTH for order state transitions.
 * All order operations should go through this service to ensure:
 * 1. Consistent state across all stores (aggregator, KDS, POS)
 * 2. Proper event emission for sync across devices
 * 3. Correct workflow enforcement
 * 4. Audit trail and debugging
 *
 * Order Lifecycle:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  AGGREGATOR                         KDS                                 │
 * │  ──────────                         ───                                 │
 * │  pending ──┬──> confirmed ────────> received ──> preparing ──> ready   │
 * │            │         │                  │            │           │      │
 * │            │         │                  │            │           │      │
 * │  rejected <┘         └──────────────────┴────────────┴───────────┘      │
 * │                                                      │                  │
 * │  pending_pickup <────────────────────────────────────┘                  │
 * │       │                                                                 │
 * │  picked_up ──> out_for_delivery ──> delivered ──> completed            │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import type { AggregatorOrder, AggregatorOrderStatus, AggregatorSource } from '../types/aggregator';
import type { KitchenOrder, KitchenOrderStatus } from '../types/kds';
import { transformAggregatorToKitchenOrder, createKitchenOrderWithId, validateKitchenOrder } from './orderTransformations';
import { isTauri } from './platform';

// Order source types
export type OrderSource = 'aggregator' | 'pos' | 'qr' | 'online';

// Orchestration events
export type OrchestrationEvent =
  | { type: 'ORDER_RECEIVED'; order: AggregatorOrder; source: OrderSource }
  | { type: 'ORDER_ACCEPTED'; orderId: string; prepTime: number; kitchenOrder: KitchenOrder }
  | { type: 'ORDER_REJECTED'; orderId: string; reason: string }
  | { type: 'ORDER_SENT_TO_KDS'; orderId: string; kitchenOrderId: string }
  | { type: 'KDS_STATUS_CHANGED'; kitchenOrderId: string; status: KitchenOrderStatus; orderId?: string }
  | { type: 'AGGREGATOR_STATUS_CHANGED'; orderId: string; status: AggregatorOrderStatus }
  | { type: 'ORDER_READY'; orderId: string }
  | { type: 'ORDER_PICKED_UP'; orderId: string }
  | { type: 'ORDER_DELIVERED'; orderId: string }
  | { type: 'ORDER_COMPLETED'; orderId: string };

// Event listener type
type EventListener = (event: OrchestrationEvent) => void;

// Order ID mapping (aggregator orderId <-> kitchen order id)
interface OrderMapping {
  aggregatorOrderId: string;
  orderNumber: string;
  kitchenOrderId: string | null;
  source: AggregatorSource;
  currentStatus: AggregatorOrderStatus;
  kdsStatus: KitchenOrderStatus | null;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
}

class OrderOrchestrationService {
  private listeners: Set<EventListener> = new Set();
  private orderMappings: Map<string, OrderMapping> = new Map(); // keyed by aggregatorOrderId
  private kitchenToAggregatorMap: Map<string, string> = new Map(); // kitchenOrderId -> aggregatorOrderId
  private processedOrderIds: Set<string> = new Set(); // Prevent duplicate processing

  // Store references (lazy loaded to avoid circular deps)
  private aggregatorStore: any = null;
  private kdsStore: any = null;
  private printerStore: any = null;
  private printerService: any = null;
  private orderSyncService: any = null;
  private notificationStore: any = null;

  constructor() {
    console.log('[OrderOrchestration] Service initialized');
  }

  // ==================== Event System ====================

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: OrchestrationEvent): void {
    console.log('[OrderOrchestration] Event:', event.type, event);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[OrderOrchestration] Listener error:', error);
      }
    });
  }

  // ==================== Lazy Store Loading ====================

  private async getAggregatorStore() {
    if (!this.aggregatorStore) {
      const { useAggregatorStore } = await import('../stores/aggregatorStore');
      this.aggregatorStore = useAggregatorStore;
    }
    return this.aggregatorStore.getState();
  }

  private async getKDSStore() {
    if (!this.kdsStore) {
      const { useKDSStore } = await import('../stores/kdsStore');
      this.kdsStore = useKDSStore;
    }
    return this.kdsStore.getState();
  }

  private async getPrinterStore() {
    if (!this.printerStore) {
      const { usePrinterStore } = await import('../stores/printerStore');
      this.printerStore = usePrinterStore;
    }
    return this.printerStore.getState();
  }

  private async getPrinterService() {
    if (!this.printerService) {
      const { printerService } = await import('./printerService');
      this.printerService = printerService;
    }
    return this.printerService;
  }

  private async getOrderSyncService() {
    if (!this.orderSyncService) {
      const { orderSyncService } = await import('./orderSyncService');
      this.orderSyncService = orderSyncService;
    }
    return this.orderSyncService;
  }

  private async getNotificationStore() {
    if (!this.notificationStore) {
      const { useNotificationStore } = await import('../stores/notificationStore');
      this.notificationStore = useNotificationStore;
    }
    return this.notificationStore.getState();
  }

  // ==================== Core Order Operations ====================

  /**
   * Process a new order from any source (aggregator extraction, API, mock)
   * This is the ENTRY POINT for all new orders
   */
  async processNewOrder(order: AggregatorOrder, source: OrderSource = 'aggregator'): Promise<void> {
    const orderId = order.orderId;

    // Prevent duplicate processing
    if (this.processedOrderIds.has(orderId)) {
      console.log('[OrderOrchestration] Skipping duplicate order:', orderId);
      return;
    }
    this.processedOrderIds.add(orderId);

    console.log('[OrderOrchestration] Processing new order:', order.orderNumber, 'status:', order.status);

    // Create order mapping
    const mapping: OrderMapping = {
      aggregatorOrderId: orderId,
      orderNumber: order.orderNumber,
      kitchenOrderId: null,
      source: order.aggregator,
      currentStatus: order.status,
      kdsStatus: null,
      createdAt: order.createdAt,
      acceptedAt: null,
      readyAt: null,
    };
    this.orderMappings.set(orderId, mapping);

    // Add to aggregator store (this handles auto-accept evaluation)
    const aggregatorStore = await this.getAggregatorStore();

    // Check if order already exists in store
    const existingOrder = aggregatorStore.orders.find(
      (o: AggregatorOrder) => o.orderId === orderId || o.orderNumber === order.orderNumber
    );

    if (!existingOrder) {
      // Use internal add that doesn't trigger acceptOrder again
      this.aggregatorStore.setState((state: any) => ({
        orders: [order, ...state.orders]
      }));
    }

    // Emit event
    this.emit({ type: 'ORDER_RECEIVED', order, source });

    // Play notification sound
    const notificationStore = await this.getNotificationStore();
    notificationStore.playSound('new_order');

    // Send ALL orders to KDS immediately upon capture
    // Kitchen can use 86 (out of stock) feature to reject orders if items unavailable
    console.log('[OrderOrchestration] Sending order to KDS immediately:', order.orderNumber);
    await this.sendToKDS(order);
  }

  /**
   * Accept an order - transitions from pending to confirmed and sends to KDS
   * This is called by aggregatorStore.acceptOrder or auto-accept logic
   */
  async acceptOrder(orderId: string, prepTime: number = 20): Promise<KitchenOrder | null> {
    console.log('[OrderOrchestration] Accepting order:', orderId, 'prepTime:', prepTime);

    const aggregatorStore = await this.getAggregatorStore();
    const order = aggregatorStore.orders.find((o: AggregatorOrder) => o.orderId === orderId);

    if (!order) {
      console.error('[OrderOrchestration] Order not found:', orderId);
      return null;
    }

    // Update mapping
    const mapping = this.orderMappings.get(orderId);
    if (mapping) {
      mapping.currentStatus = 'confirmed';
      mapping.acceptedAt = new Date().toISOString();
    }

    // Update aggregator store status
    const acceptedAt = new Date().toISOString();
    this.aggregatorStore.setState((state: any) => ({
      orders: state.orders.map((o: AggregatorOrder) =>
        o.orderId === orderId
          ? { ...o, status: 'confirmed' as AggregatorOrderStatus, acceptedAt }
          : o
      ),
    }));

    // Persist to database
    if (isTauri()) {
      try {
        const { aggregatorOrderDb } = await import('./aggregatorOrderDb');
        await aggregatorOrderDb.updateStatus(orderId, 'confirmed', { acceptedAt });
      } catch (err) {
        console.error('[OrderOrchestration] Failed to persist status:', err);
      }
    }

    // Transform and send to KDS
    const kitchenOrder = await this.sendToKDS({ ...order, status: 'confirmed', acceptedAt }, prepTime);

    if (kitchenOrder) {
      // Emit event
      this.emit({
        type: 'ORDER_ACCEPTED',
        orderId,
        prepTime,
        kitchenOrder
      });

      // Broadcast to other devices
      await this.broadcastOrder(order, kitchenOrder);

      // Print KOT if auto-print enabled
      await this.printKOT(kitchenOrder);
    }

    return kitchenOrder;
  }

  /**
   * Send an order to KDS (Kitchen Display System)
   */
  async sendToKDS(order: AggregatorOrder, prepTime?: number): Promise<KitchenOrder | null> {
    const orderId = order.orderId;

    // Check if already sent to KDS
    const mapping = this.orderMappings.get(orderId);
    if (mapping?.kitchenOrderId) {
      console.log('[OrderOrchestration] Order already in KDS:', orderId);
      return null;
    }

    console.log('[OrderOrchestration] Sending to KDS:', order.orderNumber);

    try {
      // Transform aggregator order to kitchen order
      const kitchenOrderPartial = transformAggregatorToKitchenOrder(order);

      if (prepTime) {
        kitchenOrderPartial.estimatedPrepTime = prepTime;
      }

      // Validate transformation
      if (!validateKitchenOrder(kitchenOrderPartial)) {
        console.error('[OrderOrchestration] Invalid kitchen order transformation');
        return null;
      }

      // Create complete kitchen order with ID
      const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);

      // Update mapping
      if (mapping) {
        mapping.kitchenOrderId = kitchenOrder.id;
        mapping.kdsStatus = 'pending'; // KDS starts with pending status
      }
      this.kitchenToAggregatorMap.set(kitchenOrder.id, orderId);

      // Add to KDS store
      const kdsStore = await this.getKDSStore();
      kdsStore.addOrder(kitchenOrder);

      console.log('[OrderOrchestration] Order added to KDS:', kitchenOrder.id);

      // Emit event
      this.emit({
        type: 'ORDER_SENT_TO_KDS',
        orderId,
        kitchenOrderId: kitchenOrder.id
      });

      return kitchenOrder;
    } catch (error) {
      console.error('[OrderOrchestration] Failed to send to KDS:', error);
      return null;
    }
  }

  /**
   * Handle KDS status change - sync back to aggregator
   */
  async onKDSStatusChange(kitchenOrderId: string, status: KitchenOrderStatus): Promise<void> {
    console.log('[OrderOrchestration] KDS status change:', kitchenOrderId, status);

    const aggregatorOrderId = this.kitchenToAggregatorMap.get(kitchenOrderId);
    if (!aggregatorOrderId) {
      console.log('[OrderOrchestration] No aggregator mapping for kitchen order:', kitchenOrderId);
      return;
    }

    const mapping = this.orderMappings.get(aggregatorOrderId);
    if (mapping) {
      mapping.kdsStatus = status;
    }

    // Map KDS status to aggregator status
    let aggregatorStatus: AggregatorOrderStatus | null = null;

    switch (status) {
      case 'in_progress':
        aggregatorStatus = 'preparing';
        break;
      case 'ready':
        aggregatorStatus = 'pending_pickup';
        if (mapping) mapping.readyAt = new Date().toISOString();
        break;
      case 'completed':
        aggregatorStatus = 'completed';
        break;
      // received, cancelled don't need sync
    }

    if (aggregatorStatus) {
      // Update aggregator store
      await this.getAggregatorStore(); // Ensure store is loaded
      const updates: Partial<AggregatorOrder> = { status: aggregatorStatus };
      if (status === 'ready') {
        updates.readyAt = new Date().toISOString();
      }

      this.aggregatorStore.setState((state: any) => ({
        orders: state.orders.map((o: AggregatorOrder) =>
          o.orderId === aggregatorOrderId ? { ...o, ...updates } : o
        ),
      }));

      console.log('[OrderOrchestration] Synced KDS status to aggregator:', aggregatorOrderId, aggregatorStatus);

      // Emit event
      this.emit({
        type: 'AGGREGATOR_STATUS_CHANGED',
        orderId: aggregatorOrderId,
        status: aggregatorStatus
      });
    }

    // Emit KDS event
    this.emit({
      type: 'KDS_STATUS_CHANGED',
      kitchenOrderId,
      status,
      orderId: aggregatorOrderId
    });
  }

  /**
   * Mark order as ready (from aggregator dashboard)
   */
  async markReady(orderId: string, tenantId?: string): Promise<void> {
    console.log('[OrderOrchestration] Marking ready:', orderId);

    const mapping = this.orderMappings.get(orderId);
    if (mapping) {
      mapping.currentStatus = 'pending_pickup';
      mapping.readyAt = new Date().toISOString();
    }

    // Update aggregator store
    this.aggregatorStore?.setState((state: any) => ({
      orders: state.orders.map((o: AggregatorOrder) =>
        o.orderId === orderId
          ? { ...o, status: 'pending_pickup' as AggregatorOrderStatus, readyAt: new Date().toISOString() }
          : o
      ),
    }));

    // Also update KDS if we have a mapping
    if (mapping?.kitchenOrderId) {
      const kdsStore = await this.getKDSStore();
      // Mark all items as ready in KDS
      const kitchenOrder = kdsStore.activeOrders.find((o: KitchenOrder) => o.id === mapping.kitchenOrderId);
      if (kitchenOrder) {
        for (const item of kitchenOrder.items) {
          if (item.status !== 'ready') {
            kdsStore.markItemStatus(mapping.kitchenOrderId, item.id, 'ready');
          }
        }
      }
    }

    // Record sale
    if (isTauri() && tenantId) {
      try {
        const { recordAggregatorSale } = await import('./aggregatorSalesService');
        const aggregatorStore = await this.getAggregatorStore();
        const order = aggregatorStore.orders.find((o: AggregatorOrder) => o.orderId === orderId);
        if (order) {
          await recordAggregatorSale(tenantId, { ...order, readyAt: new Date().toISOString() });
        }
      } catch (err) {
        console.error('[OrderOrchestration] Failed to record sale:', err);
      }
    }

    this.emit({ type: 'ORDER_READY', orderId });
  }

  /**
   * Mark order as picked up
   */
  async markPickedUp(orderId: string): Promise<void> {
    console.log('[OrderOrchestration] Marking picked up:', orderId);

    const mapping = this.orderMappings.get(orderId);
    if (mapping) {
      mapping.currentStatus = 'picked_up';
    }

    this.aggregatorStore?.setState((state: any) => ({
      orders: state.orders.map((o: AggregatorOrder) =>
        o.orderId === orderId
          ? { ...o, status: 'picked_up' as AggregatorOrderStatus, pickedUpAt: new Date().toISOString() }
          : o
      ),
    }));

    this.emit({ type: 'ORDER_PICKED_UP', orderId });
  }

  /**
   * Mark order as delivered
   */
  async markDelivered(orderId: string): Promise<void> {
    console.log('[OrderOrchestration] Marking delivered:', orderId);

    const mapping = this.orderMappings.get(orderId);
    if (mapping) {
      mapping.currentStatus = 'delivered';
    }

    this.aggregatorStore?.setState((state: any) => ({
      orders: state.orders.map((o: AggregatorOrder) =>
        o.orderId === orderId
          ? { ...o, status: 'delivered' as AggregatorOrderStatus, deliveredAt: new Date().toISOString() }
          : o
      ),
    }));

    this.emit({ type: 'ORDER_DELIVERED', orderId });
  }

  /**
   * Mark order as completed
   */
  async markCompleted(orderId: string): Promise<void> {
    console.log('[OrderOrchestration] Marking completed:', orderId);

    const mapping = this.orderMappings.get(orderId);
    if (mapping) {
      mapping.currentStatus = 'completed';
    }

    this.aggregatorStore?.setState((state: any) => ({
      orders: state.orders.map((o: AggregatorOrder) =>
        o.orderId === orderId
          ? { ...o, status: 'completed' as AggregatorOrderStatus }
          : o
      ),
    }));

    // Also complete in KDS
    if (mapping?.kitchenOrderId) {
      const kdsStore = await this.getKDSStore();
      kdsStore.markOrderComplete(mapping.kitchenOrderId);
    }

    this.emit({ type: 'ORDER_COMPLETED', orderId });
  }

  // ==================== Helper Methods ====================

  private async broadcastOrder(order: AggregatorOrder, kitchenOrder: KitchenOrder): Promise<void> {
    try {
      const syncService = await this.getOrderSyncService();
      const result = await syncService.broadcastOrder(
        { orderId: order.orderId, orderNumber: order.orderNumber },
        kitchenOrder
      );

      const paths = [];
      if (result.cloud) paths.push('cloud');
      if (result.lan > 0) paths.push(`${result.lan} LAN`);
      if (paths.length > 0) {
        console.log(`[OrderOrchestration] Broadcast to: ${paths.join(', ')}`);
      }
    } catch (error) {
      console.warn('[OrderOrchestration] Broadcast failed (non-critical):', error);
    }
  }

  private async printKOT(kitchenOrder: KitchenOrder): Promise<void> {
    try {
      const printerConfig = (await this.getPrinterStore()).config;
      if (!printerConfig.autoPrintOnAccept) return;

      console.log('[OrderOrchestration] Printing KOT...');
      const printer = await this.getPrinterService();
      await printer.print(kitchenOrder);

      (await this.getPrinterStore()).addPrintHistory(
        kitchenOrder.id,
        kitchenOrder.orderNumber,
        true
      );
      console.log('[OrderOrchestration] KOT printed successfully');
    } catch (error) {
      console.error('[OrderOrchestration] KOT print failed:', error);
      try {
        (await this.getPrinterStore()).addPrintHistory(
          kitchenOrder.id,
          kitchenOrder.orderNumber,
          false
        );
      } catch {}
    }
  }

  // ==================== Query Methods ====================

  getMapping(orderId: string): OrderMapping | undefined {
    return this.orderMappings.get(orderId);
  }

  getMappingByKitchenOrder(kitchenOrderId: string): OrderMapping | undefined {
    const aggregatorId = this.kitchenToAggregatorMap.get(kitchenOrderId);
    return aggregatorId ? this.orderMappings.get(aggregatorId) : undefined;
  }

  getAggregatorOrderId(kitchenOrderId: string): string | undefined {
    return this.kitchenToAggregatorMap.get(kitchenOrderId);
  }

  isOrderProcessed(orderId: string): boolean {
    return this.processedOrderIds.has(orderId);
  }

  // ==================== Cleanup ====================

  clearProcessedOrders(): void {
    // Keep only last 1000 order IDs to prevent memory leak
    if (this.processedOrderIds.size > 1000) {
      const idsArray = Array.from(this.processedOrderIds);
      this.processedOrderIds = new Set(idsArray.slice(-500));
    }
  }

  reset(): void {
    this.orderMappings.clear();
    this.kitchenToAggregatorMap.clear();
    this.processedOrderIds.clear();
    this.listeners.clear();
    console.log('[OrderOrchestration] Service reset');
  }
}

// Export singleton instance
export const orderOrchestrationService = new OrderOrchestrationService();

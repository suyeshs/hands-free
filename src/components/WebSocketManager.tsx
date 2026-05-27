/**
 * WebSocket/Sync Connection Manager
 *
 * Manages real-time order sync using the unified OrderSyncService:
 * - Primary: Cloud Durable Objects WebSocket
 * - Fallback: LAN mDNS mesh (for offline/same-network scenarios)
 *
 * Also handles:
 * - Tauri aggregator order events (Swiggy/Zomato extraction)
 * - Background D1 cloud sync for aggregator orders
 */

import { useEffect, useState, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useOnlineOrderStore } from '../stores/onlineOrderStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useDeviceStore } from '../stores/deviceStore';
import { useStaffStore } from '../stores/staffStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import { usePOSStore } from '../stores/posStore';
import { useServiceRequestStore } from '../stores/serviceRequestStore';
import type { CartItem } from '../types/pos';
import { useSetupWizardStore, useIsReadyForPOS } from '../stores/setupWizardStore';
import { useRestaurantSettingsStore } from '../stores/restaurantSettingsStore';
import { useProvisioningStore } from '../stores/provisioningStore';
import { orderSyncService } from '../lib/orderSyncService';
// Lazy load orderOrchestrationService to improve startup time
// import { orderOrchestrationService } from '../lib/orderOrchestrationService';
import { initRemotePrintHandler, stopRemotePrintHandler } from '../lib/remotePrintHandler';
import { createAggregatorCustomer } from '../lib/handsfreeApi';
import type { AggregatorOrder, AggregatorSource, AggregatorOrderStatus } from '../types/aggregator';
import type { OnlineOrder } from '../types/online';
import type { KitchenOrder } from '../types/kds';

// Check if we're in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// Track Tauri listener setup state (using ref pattern for HMR resilience)
// Note: We use a module-level set but properly manage cleanup

// Map extracted status to AggregatorOrderStatus
function mapExtractedStatus(status: string): AggregatorOrderStatus {
  const statusLower = status?.toLowerCase() || 'pending';

  // Exact matches first (most reliable)
  if (statusLower === 'pending') return 'pending';
  if (statusLower === 'confirmed' || statusLower === 'accepted') return 'confirmed';
  if (statusLower === 'preparing' || statusLower === 'in_progress') return 'preparing';
  if (statusLower === 'ready') return 'ready';
  if (statusLower === 'pending_pickup') return 'pending_pickup';
  if (statusLower === 'picked_up') return 'picked_up';
  if (statusLower === 'out_for_delivery') return 'out_for_delivery';
  if (statusLower === 'delivered') return 'delivered';
  if (statusLower === 'completed') return 'completed';
  if (statusLower === 'cancelled' || statusLower === 'canceled') return 'cancelled';

  // Partial matches as fallback (for variations like "order_confirmed", "food_preparing", etc.)
  if (statusLower.includes('deliver')) return 'delivered';
  if (statusLower.includes('picked_up') || statusLower === 'pickedup') return 'picked_up';
  if (statusLower.includes('pending_pickup')) return 'pending_pickup';
  if (statusLower.includes('ready')) return 'ready';
  if (statusLower.includes('prepar')) return 'preparing';
  if (statusLower.includes('confirm') || statusLower.includes('accept')) return 'confirmed';
  if (statusLower.includes('cancel')) return 'cancelled';
  if (statusLower.includes('out_for') || statusLower.includes('dispatched')) return 'out_for_delivery';

  // Default to pending for new/unknown orders
  // This ensures new orders always show up on KDS
  return 'pending';
}

export function WebSocketManager() {
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const { isComplete: setupWizardComplete } = useSetupWizardStore();
  const isReadyForPOS = useIsReadyForPOS();
  const setupComplete = setupWizardComplete || isReadyForPOS;
  useRestaurantSettingsStore();
  const { addOrder: addAggregatorOrder, loadOrdersFromDb } = useAggregatorStore();
  const { addOrder: addToOnlineOrderStore, fetchFromCloud: fetchOnlineOrders } = useOnlineOrderStore();
  const { addOrder: addToKDS } = useKDSStore();
  const { playSound } = useNotificationStore();
  const { setIsLanConnected } = useDeviceStore();

  // Note: Staff and floor plan stores are accessed via getState() in callbacks
  // to avoid stale closures and unnecessary re-renders

  // Training mode is in provisioning store, not POS settings
  const { isTrainingMode } = useProvisioningStore();

  const [syncStatus, setSyncStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [syncPath, setSyncPath] = useState<'cloud' | 'lan' | 'both' | 'none'>('none');
  const syncInitializedForTenant = useRef<string | null>(null);

  // Track if this is an owner device (for connection persistence)
  const isOwnerDeviceRef = useRef<boolean>(false);

  // Note: KOT/KDS routing is now handled by orderOrchestrationService
  // which provides centralized order lifecycle management

  // Initialize unified Order Sync Service (Cloud + LAN)
  // Priority: Tenant Store (device activation) > Auth Store (user login)
  const effectiveTenantId = tenant?.tenantId || user?.tenantId;

  useEffect(() => {
    // GUARD: Require tenant ID first - essential for all sync operations
    if (!effectiveTenantId) {
      console.log('[WebSocketManager] No tenant ID available, skipping sync initialization');
      return;
    }

    // GUARD: Don't sync during setup - POS must work completely offline during setup
    if (!setupComplete) {
      console.log('[WebSocketManager] Setup not complete, skipping sync initialization');
      return;
    }

    // GUARD: Don't sync in training mode - orders should not be synced
    if (isTrainingMode) {
      console.log('[WebSocketManager] Training mode active, skipping sync initialization');
      return;
    }

    // Skip if already initialized for this tenant
    if (syncInitializedForTenant.current === effectiveTenantId) {
      return;
    }

    // If switching tenants, shutdown old connection first
    if (syncInitializedForTenant.current && syncInitializedForTenant.current !== effectiveTenantId) {
      console.log('[WebSocketManager] Tenant changed, reinitializing sync service...');
      orderSyncService.shutdown();
    }

    // Track if effect is still active (for cleanup)
    let isActive = true;

    // Check if this is an owner device (for connection persistence)
    const deviceStore = useDeviceStore.getState();
    isOwnerDeviceRef.current = deviceStore.shouldReceiveRealtimeSales();

    if (isOwnerDeviceRef.current) {
      console.log('[WebSocketManager] 🔴 Owner device detected - will maintain persistent WebSocket connection');
    }

    // Load staff and floor plan from database BEFORE initializing sync
    // This ensures we have data to respond with when sync is requested
    const initializeSync = async () => {
      // GUARD: Check if tenant-worker is provisioned before initializing sync
      // If setup is already complete (isComplete=true), we treat the tenant as provisioned
      // even if the local SQLite marker is missing (common in dev / fresh install scenarios).
      try {
        console.log('[WebSocketManager] Checking tenant-worker provisioning status...');
        const { getD1ProvisioningService } = await import('../services/d1ProvisioningService');
        const provisioningService = getD1ProvisioningService();
        const d1Status = await provisioningService.checkStatus(effectiveTenantId);

        if (!d1Status.provisioned) {
          console.warn('[WebSocketManager] Provisioning marker not found locally — proceeding anyway because setup is complete');
        } else {
          console.log('[WebSocketManager] Tenant-worker is provisioned, proceeding with sync initialization');
        }
      } catch (err) {
        console.warn('[WebSocketManager] Provisioning check failed, proceeding with sync anyway:', err);
      }

      try {
        console.log('[WebSocketManager] Pre-loading staff and floor plan from database...');
        await Promise.all([
          useStaffStore.getState().loadStaffFromDatabase(effectiveTenantId),
          useFloorPlanStore.getState().loadFloorPlan(effectiveTenantId),
        ]);
        console.log('[WebSocketManager] Stores loaded, now initializing sync service');
      } catch (err) {
        console.warn('[WebSocketManager] Failed to pre-load stores (non-critical):', err);
      }

      // Don't initialize if effect was cleaned up during async operation
      if (!isActive) {
        console.log('[WebSocketManager] Effect cleaned up, skipping sync initialization');
        return;
      }

      console.log('[WebSocketManager] Initializing Order Sync Service for tenant:', effectiveTenantId);
      syncInitializedForTenant.current = effectiveTenantId;

      await orderSyncService.initialize(effectiveTenantId, {
      onOrderCreated: (order, kitchenOrder: KitchenOrder) => {
        console.log('[WebSocketManager] Received order via sync:', kitchenOrder?.orderNumber, 'source:', order?.source);

        // QR/dine-in orders are handled by onQROrderCreated — never route them to web orders
        if (order?.source === 'qr_code' || order?.orderType === 'dine_in' || order?.orderType === 'dine-in') {
          return;
        }

        if (order?.source === 'web') {
          // Web/direct orders go to onlineOrderStore — staff confirms before sending to KDS
          // DB Order uses 'id'; normalised orders from fetchPendingWebOrders use 'orderId'
          const orderId = order.id || order.orderId;
          const isNewOrder = !useOnlineOrderStore.getState().orders.some((o) => o.id === orderId);
          const onlineOrder: OnlineOrder = {
            id: orderId,
            orderNumber: order.orderNumber,
            status: order.status || 'pending',
            orderType: order.orderType === 'delivery' ? 'delivery' : 'pickup',
            createdAt: order.createdAt,
            customer: {
              // kitchenOrder.customer has the name because the restaurant worker
              // falls back to the request body; the DB Order doesn't join customer name
              name: (kitchenOrder as any)?.customer?.name || order.customerName || order.customer?.name || 'Guest',
              phone: (kitchenOrder as any)?.customer?.phone || order.customerPhone || order.customer?.phone || '',
            },
            cart: {
              items: (kitchenOrder?.items || []).map((item: any) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price || 0,
                total: (item.price || 0) * item.quantity,
                variants: (item.modifiers || [])
                  .filter(Boolean)
                  .map((m: any) => (typeof m === 'string' ? m : m.name || '')),
                specialInstructions: item.specialInstructions || null,
              })),
              subtotal: order.subtotal || 0,
              tax: order.tax || 0,
              deliveryFee: order.deliveryFee || order.delivery_fee || 0,
              discount: 0,
              total: order.total || 0,
            },
            payment: {
              method: order.paymentMethod || order.payment_method || 'cash',
              status: order.paymentStatus || order.payment_status || 'pending',
              isPrepaid: (order.paymentMethod || order.payment_method) === 'online',
            },
            specialInstructions: order.notes || null,
          };
          addToOnlineOrderStore(onlineOrder);
          if (isNewOrder) playSound('new_order');
        } else if (kitchenOrder) {
          // POS-to-KDS sync orders (dine-in, takeout from POS) go directly to KDS
          addToKDS(kitchenOrder);
          playSound('new_order');
        }
      },
      onOrderStatusUpdate: async (orderId, status, extra) => {
        console.log('[WebSocketManager] Order status update via sync:', orderId, status, extra);
        // KDS store is updated inside orderSyncService

        // Also update POS store for completed orders
        if (status === 'completed') {
          try {
            const { usePOSStore } = await import('../stores/posStore');
            const currentState = usePOSStore.getState();

            // Use orderNumber from extra data if available (more reliable), otherwise extract from orderId
            const orderNumber = extra?.orderNumber;
            const tableNumber = extra?.tableNumber;

            console.log('[WebSocketManager] Looking for order to update, orderId:', orderId, 'orderNumber:', orderNumber, 'tableNumber:', tableNumber);

            // Update in recentOrders
            const updatedRecentOrders = currentState.recentOrders.map((posOrder) =>
              (orderNumber && posOrder.orderNumber === orderNumber) || posOrder.id === orderId
                ? { ...posOrder, status: 'completed' as const }
                : posOrder
            );

            // Also check activeTables for dine-in orders
            const updatedActiveTables = { ...currentState.activeTables };

            // If we have a specific table number, update that table directly
            if (tableNumber && updatedActiveTables[tableNumber]) {
              const session = updatedActiveTables[tableNumber];
              if (session?.order) {
                updatedActiveTables[tableNumber] = {
                  ...session,
                  order: {
                    ...session.order,
                    status: 'completed' as const,
                  },
                };
                console.log('[WebSocketManager] Updated activeTables for table:', tableNumber);
              }
            } else {
              // Fallback: search by order number
              for (const [tableNum, session] of Object.entries(updatedActiveTables)) {
                if ((orderNumber && session?.order?.orderNumber === orderNumber) || session?.order?.id === orderId) {
                  updatedActiveTables[parseInt(tableNum)] = {
                    ...session,
                    order: {
                      ...session.order,
                      status: 'completed' as const,
                    },
                  };
                  console.log('[WebSocketManager] Updated activeTables for table:', tableNum);
                }
              }
            }

            usePOSStore.setState({
              recentOrders: updatedRecentOrders,
              activeTables: updatedActiveTables,
            });
            console.log('[WebSocketManager] ✓ Updated POS store for completed order:', orderId);
          } catch (error) {
            console.error('[WebSocketManager] Failed to update POS store:', error);
          }
        }
      },
      onConnectionChange: (status, path) => {
        console.log('[WebSocketManager] Sync connection change:', status, path);
        setSyncStatus(status);
        setSyncPath(path);

        // Update device store for UI indicators
        setIsLanConnected(path === 'lan' || path === 'both');
      },
      onError: (error, path) => {
        console.error(`[WebSocketManager] Sync error (${path}):`, error);
      },

      // Staff sync callbacks - use getState() for fresh store access
      onStaffSync: (staff) => {
        console.log('[WebSocketManager] Received staff sync:', staff.length, 'members');
        useStaffStore.getState().applyRemoteStaffSync(staff);
      },
      onStaffAdded: (staff) => {
        console.log('[WebSocketManager] Received staff added:', staff.name);
        useStaffStore.getState().applyRemoteStaffAdded(staff);
      },
      onStaffUpdated: (staffId, updates) => {
        console.log('[WebSocketManager] Received staff updated:', staffId);
        useStaffStore.getState().applyRemoteStaffUpdated(staffId, updates);
      },
      onStaffRemoved: (staffId) => {
        console.log('[WebSocketManager] Received staff removed:', staffId);
        useStaffStore.getState().applyRemoteStaffRemoved(staffId);
      },

      // Floor plan sync callbacks - use getState() for fresh store access
      onFloorPlanSync: (sections, tables, assignments) => {
        console.log('[WebSocketManager] Received floor plan sync:', sections.length, 'sections');
        useFloorPlanStore.getState().applyRemoteFloorPlanSync(sections, tables, assignments);
      },
      onSectionAdded: (section) => {
        console.log('[WebSocketManager] Received section added:', section.name);
        useFloorPlanStore.getState().applyRemoteSectionAdded(section);
      },
      onSectionRemoved: (sectionId) => {
        console.log('[WebSocketManager] Received section removed:', sectionId);
        useFloorPlanStore.getState().applyRemoteSectionRemoved(sectionId);
      },
      onTableAdded: (table) => {
        console.log('[WebSocketManager] Received table added:', table.tableNumber);
        useFloorPlanStore.getState().applyRemoteTableAdded(table);
      },
      onTableRemoved: (tableId) => {
        console.log('[WebSocketManager] Received table removed:', tableId);
        useFloorPlanStore.getState().applyRemoteTableRemoved(tableId);
      },
      onTableStatusUpdated: (tableId, status) => {
        console.log('[WebSocketManager] Received table status updated:', tableId, status);
        useFloorPlanStore.getState().applyRemoteTableStatusUpdated(tableId, status);
      },
      onStaffAssigned: (assignment) => {
        console.log('[WebSocketManager] Received staff assigned:', assignment.userId);
        useFloorPlanStore.getState().applyRemoteStaffAssigned(assignment);
      },

      // Sync request callback - all devices respond with full state
      onSyncRequested: (requesterId, requesterDeviceType) => {
        console.log('[WebSocketManager] Sync requested by:', requesterId, requesterDeviceType);
        // Get fresh state from stores (not captured values from useEffect closure)
        const currentStaff = useStaffStore.getState().staff;
        const currentFloorPlan = useFloorPlanStore.getState();

        console.log('[WebSocketManager] Responding with staff count:', currentStaff.length);

        // All devices respond with full state (no mode restrictions)
        orderSyncService.broadcastStaffSync(currentStaff);
        orderSyncService.broadcastFloorPlanSync(
          currentFloorPlan.sections,
          currentFloorPlan.tables,
          currentFloorPlan.assignments
        );
      },

      // QR order callback — open table in POS floor plan + dine-in session
      onQROrderCreated: async (_order, tableInfo, kitchenOrder) => {
        console.log('[WebSocketManager] QR order for table:', tableInfo?.tableId || tableInfo?.tableNumber);

        const tableId = tableInfo?.tableId || (_order as any)?.tableId;
        const tenantId = useAuthStore.getState().user?.tenantId;
        if (!tableId || !tenantId) {
          playSound('qr_order');
          return;
        }

        // Look up actual table in floor plan by ID
        // Load floor plan if it hasn't been loaded yet (QR orders can arrive at startup)
        const fpStore = useFloorPlanStore.getState();
        if (!fpStore.isLoaded && !fpStore.isLoading) {
          await fpStore.loadFloorPlan(tenantId);
        }
        const { tables } = useFloorPlanStore.getState();
        const floorTable = tables.find((t) => t.id === tableId);

        // Prefer server-resolved tableNumber (from tenant router floor plan lookup),
        // fall back to local floor plan if server didn't resolve it
        const serverTableNumber = tableInfo?.tableNumber || 0;
        const localTableNumber = floorTable ? parseInt(floorTable.tableNumber as any, 10) : 0;
        const tableNumber = serverTableNumber > 0 ? serverTableNumber : localTableNumber;

        // Mark floor plan table as occupied
        if (floorTable) {
          useFloorPlanStore.getState().updateTableStatus(floorTable.id, 'occupied', tenantId);
        }

        // Convert QR order items to CartItems for the POS session
        const orderItems: any[] = (_order as any)?.items || kitchenOrder?.items || [];
        const cartItems: CartItem[] = orderItems.map((item: any, idx: number) => ({
          id: `qr-${kitchenOrder?.id || Date.now()}-item-${idx}`,
          menuItem: {
            id: `qr-item-${idx}`,
            name: item.name,
            description: '',
            category: 'qr',
            price: item.price || 0,
            available: true,
          },
          quantity: item.quantity,
          modifiers: (item.modifiers || []).filter(Boolean).map((m: any, mi: number) => ({
            id: `mod-${idx}-${mi}`,
            name: typeof m === 'string' ? m : (m.name || ''),
            price: m.priceAdjustment || 0,
          })),
          specialInstructions: item.specialInstructions || undefined,
          subtotal: (item.price || 0) * item.quantity,
        }));

        if (tableNumber > 0 && cartItems.length > 0) {
          await usePOSStore.getState().addQROrderToTable(
            tableNumber,
            cartItems,
            kitchenOrder?.orderNumber || `QR-${Date.now()}`,
            tenantId
          );
          console.log('[WebSocketManager] QR order added to table', tableNumber, '—', cartItems.length, 'items');
        }

        // Patch the KDS order with the resolved tableNumber and dine-in type so billing gate works
        if (kitchenOrder?.id && tableNumber > 0) {
          useKDSStore.getState().updateOrder(kitchenOrder.id, {
            tableNumber,
            orderType: 'dine-in',
          });
        }

        playSound('qr_order');
      },

      // Service request callbacks (Call Waiter)
      onServiceRequest: (request) => {
        console.log('[WebSocketManager] Received service request:', request.type, 'for table', request.tableNumber);
        useServiceRequestStore.getState().applyRemoteRequest(request);
        playSound('service_request');
      },
      onServiceRequestAcknowledged: (requestId, staffId, staffName) => {
        console.log('[WebSocketManager] Service request acknowledged:', requestId, 'by', staffName);
        useServiceRequestStore.getState().applyRemoteAcknowledge(requestId, staffId, staffName);
      },
      onServiceRequestResolved: (requestId) => {
        console.log('[WebSocketManager] Service request resolved:', requestId);
        useServiceRequestStore.getState().applyRemoteResolve(requestId);
      },

      // Bill request callback (customer requesting the bill at their table)
      onBillRequested: (billRequest) => {
        console.log('[WebSocketManager] Bill requested for order', billRequest.orderId, 'table', billRequest.tableId);
        import('../stores/billRequestStore').then(({ useBillRequestStore }) => {
          useBillRequestStore.getState().addRequest({ ...billRequest, status: 'pending' });
        });
        playSound('service_request');
      },

      // Item ready notification (from KDS when item is ready to serve)
      onItemReady: (data) => {
        console.log('[WebSocketManager] Item ready:', data.itemName, 'for order', data.orderNumber, 'table', data.tableNumber);
        // Play notification sound for service staff
        playSound('item_ready');
        // Could also update UI state here if needed (e.g., toast notification)
        // The ServiceDashboard will also receive this and can show visual feedback
      },

      // Out of Stock (86) callbacks
      onOutOfStock: (item, alert) => {
        console.log('[WebSocketManager] Out of stock received:', item.itemName, 'portions:', item.portionsOut);
        // Import store dynamically to avoid circular deps
        import('../stores/outOfStockStore').then(({ useOutOfStockStore }) => {
          useOutOfStockStore.getState().applyRemoteOutOfStock(item, alert);
        });
        // Play urgent notification sound
        playSound('order_urgent');
      },

      onBackInStock: (itemId, itemName) => {
        console.log('[WebSocketManager] Back in stock received:', itemName);
        import('../stores/outOfStockStore').then(({ useOutOfStockStore }) => {
          useOutOfStockStore.getState().applyRemoteBackInStock(itemId);
        });
      },

      // Sales transaction completed (for real-time dashboard updates)
      onSaleCompleted: (transaction) => {
        console.log('[WebSocketManager] Sale completed received:', transaction.invoiceNumber, transaction.grandTotal);
        // Update the daily sales store for real-time dashboard updates
        import('../stores/dailySalesStore').then(({ useDailySalesStore }) => {
          useDailySalesStore.getState().addSale(transaction);
        });
      },

      // Tip recorded (for real-time tips dashboard updates)
      onTipRecorded: (tip) => {
        console.log('[WebSocketManager] Tip recorded received:', tip.amount, 'for server', tip.serverName);
        // Update the daily sales store for real-time tips updates
        import('../stores/dailySalesStore').then(({ useDailySalesStore }) => {
          const store = useDailySalesStore.getState();
          if (typeof store.addTip === 'function') {
            store.addTip(tip);
          } else {
            console.warn('[WebSocketManager] addTip method not implemented yet in dailySalesStore');
          }
        });
      },

      // Cash payout recorded (for real-time cash register updates)
      onCashPayoutRecorded: (payout) => {
        console.log('[WebSocketManager] Cash payout recorded:', payout.amount, payout.reason);
        // Update the daily sales store for real-time cash register updates
        import('../stores/dailySalesStore').then(({ useDailySalesStore }) => {
          const store = useDailySalesStore.getState();
          if (typeof store.addCashPayout === 'function') {
            store.addCashPayout(payout);
          } else {
            console.warn('[WebSocketManager] addCashPayout method not implemented yet in dailySalesStore');
          }
        });
      },
      });
    };

    initializeSync().catch((err) => {
      console.error('[WebSocketManager] Failed to initialize sync service:', err);
    });

    return () => {
      isActive = false;

      // Owner devices maintain persistent connections for real-time sales
      if (isOwnerDeviceRef.current) {
        console.log('[WebSocketManager] 🔴 Owner device - maintaining WebSocket connection (not shutting down)');
        // Don't call shutdown() or clear tenant - keep connection alive
        return;
      }

      console.log('[WebSocketManager] Shutting down Order Sync Service');
      orderSyncService.shutdown().catch(console.error);
      syncInitializedForTenant.current = null;
    };
    // Re-initialize when tenant, setup status, or training mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTenantId, setupComplete, isTrainingMode]);

  // Owner device connection health monitor
  // Note: OrderSyncService already has built-in reconnection with exponential backoff
  // This monitor just tracks status for owner devices (mainly for logging/debugging)
  useEffect(() => {
    // Only monitor connection for owner devices
    if (!isOwnerDeviceRef.current || !effectiveTenantId || !setupComplete) {
      return;
    }

    console.log('[WebSocketManager] 🔴 Starting connection health monitor for owner device');

    let lastStatus = syncStatus;

    const healthCheckInterval = setInterval(() => {
      // Log status changes for owner devices
      if (lastStatus !== syncStatus) {
        if (syncStatus === 'disconnected') {
          console.warn('[WebSocketManager] 🔴 Owner device disconnected - OrderSyncService will auto-reconnect');
        } else if (syncStatus === 'connected') {
          console.log('[WebSocketManager] 🔴 Owner device connected - receiving real-time sales updates');
        } else if (syncStatus === 'connecting') {
          console.log('[WebSocketManager] 🔴 Owner device connecting...');
        }
        lastStatus = syncStatus;
      }
    }, 5000); // Check every 5 seconds

    return () => {
      console.log('[WebSocketManager] 🔴 Stopping connection health monitor for owner device');
      clearInterval(healthCheckInterval);
    };
  }, [syncStatus, effectiveTenantId, setupComplete]);

  // Load persisted aggregator orders from local database on startup
  // and fetch from cloud to get any orders we don't have locally
  // Also start background sync service for D1 cloud sync
  const { fetchFromCloud } = useAggregatorStore();

  useEffect(() => {
    if (!isTauri) return;

    // Only load aggregator orders if setup is complete
    // This prevents errors when the aggregator plugin hasn't been installed yet
    if (!setupComplete) {
      console.log('[WebSocketManager] ⏭️  Skipping aggregator orders load - setup not complete');
      return;
    }

    console.log('[WebSocketManager] Loading persisted aggregator orders...');
    loadOrdersFromDb().catch((err) => {
      // Silently handle errors when table doesn't exist (plugin not installed)
      if (String(err).includes('no such table')) {
        console.log('[WebSocketManager] ℹ️  Aggregator orders table not found - plugin may not be installed');
      } else {
        console.error('[WebSocketManager] Failed to load orders from DB:', err);
      }
    });

    // Cloud fetch disabled - using local-only mode
    // Prevents 500 errors from unprovisioned backend tenants
    console.log('[WebSocketManager] Skipping cloud fetch - using local database only');

    // Background sync services removed - using local-only mode

    return () => {
      // Cleanup function (sync services removed)
    };
  }, [loadOrdersFromDb, effectiveTenantId, fetchFromCloud, setupComplete]);

  // Background polling for web/online orders — runs regardless of whether the
  // OnlineOrdersDrawer is open. Fetches immediately on setup, then every 30 s.
  useEffect(() => {
    if (!setupComplete || !effectiveTenantId) return;

    fetchOnlineOrders();
    const interval = setInterval(fetchOnlineOrders, 30_000);
    return () => clearInterval(interval);
  }, [setupComplete, effectiveTenantId, fetchOnlineOrders]);

  // Setup Tauri aggregator event listener (Swiggy/Zomato order extraction)
  useEffect(() => {
    if (!isTauri) return;

    let unlistenFn: UnlistenFn | null = null;
    let isActive = true; // Track if this effect instance is still active

    const setupTauriListener = async () => {
      try {
        console.log('[WebSocketManager] Setting up aggregator-orders-extracted listener...');

        unlistenFn = await listen('aggregator-orders-extracted', (event: { payload: any[] }) => {
          if (!isActive) {
            console.log('[WebSocketManager] Ignoring event - listener inactive');
            return;
          }
          console.log('[WebSocketManager] Received extracted orders:', event.payload?.length);

          const receivedAt = new Date().toISOString();

          event.payload?.forEach((extractedOrder: any) => {
            // Use actual order time from extraction, fallback to received time
            const orderCreatedAt = extractedOrder.created_at || receivedAt;

            const order: AggregatorOrder = {
              aggregator: extractedOrder.platform as AggregatorSource,
              aggregatorOrderId: extractedOrder.order_id,
              aggregatorStatus: extractedOrder.status,
              orderId: extractedOrder.order_id,
              orderNumber: extractedOrder.order_number,
              status: mapExtractedStatus(extractedOrder.status),
              orderType: 'delivery',
              createdAt: orderCreatedAt,
              customer: {
                name: extractedOrder.customer_name || 'Customer',
                phone: extractedOrder.customer_phone || null,
                address: extractedOrder.customer_address || null,
                // Include coordinates if available from extraction
                coordinates: extractedOrder.customer_location || null,
              },
              cart: {
                items: (extractedOrder.items || []).map((item: any, idx: number) => ({
                  id: `${extractedOrder.order_id}-item-${idx}`,
                  name: item.name,
                  quantity: item.quantity || 1,
                  price: item.price || 0,
                  total: (item.price || 0) * (item.quantity || 1),
                  variants: [],
                  addons: [],
                  specialInstructions: item.special_instructions,
                })),
                subtotal: extractedOrder.total || 0,
                tax: 0,
                deliveryFee: 0,
                platformFee: 0,
                discount: 0,
                total: extractedOrder.total || 0,
              },
              payment: {
                method: 'online',
                status: 'paid',
                isPrepaid: true,
              },
            };

            // Use orchestration service for centralized order processing
            // This handles: adding to store, auto-accept evaluation, KDS routing
            console.log('[WebSocketManager] Processing order via orchestration:', order.orderNumber);

            // Lazy load orchestration service to improve startup time
            import('../lib/orderOrchestrationService').then(({ orderOrchestrationService }) => {
              return orderOrchestrationService.processNewOrder(order, 'aggregator');
            })
              .then(() => {
                console.log('[WebSocketManager] Order processed successfully:', order.orderNumber);
              })
              .catch((err: any) => {
                console.error('[WebSocketManager] Orchestration failed, falling back:', err);
                // Fallback: add directly to store AND KDS
                addAggregatorOrder(order);

                // Also add directly to KDS as fallback
                import('../lib/orderTransformations').then(({ transformAggregatorToKitchenOrder, createKitchenOrderWithId }) => {
                  const kitchenOrderPartial = transformAggregatorToKitchenOrder(order);
                  const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);
                  addToKDS(kitchenOrder);
                  console.log('[WebSocketManager] Fallback: Added to KDS directly:', kitchenOrder.id);
                }).catch(e => console.error('[WebSocketManager] Fallback KDS failed:', e));
              });

            // Create/update customer in cloud database (non-blocking)
            if (effectiveTenantId) {
              createAggregatorCustomer(effectiveTenantId, {
                aggregator: extractedOrder.platform,
                orderNumber: extractedOrder.order_number,
                customerName: extractedOrder.customer_name,
                customerPhone: extractedOrder.customer_phone,
                customerAddress: extractedOrder.customer_address,
              }).catch((err) => {
                console.warn('[WebSocketManager] Failed to create aggregator customer:', err);
              });
            }
          });

          // Note: playSound is now handled by orchestration service
        });

        console.log('[WebSocketManager] Tauri aggregator listener setup complete');
      } catch (error) {
        console.error('[WebSocketManager] Failed to setup Tauri listener:', error);
      }
    };

    setupTauriListener();

    return () => {
      isActive = false;
      if (unlistenFn) {
        console.log('[WebSocketManager] Cleaning up aggregator listener');
        unlistenFn();
      }
    };
  }, []); // Empty deps - only setup once on mount

  // Log sync status for debugging (can be used for UI indicator later)
  useEffect(() => {
    if (syncStatus !== 'disconnected' || syncPath !== 'none') {
      console.log(`[WebSocketManager] Sync: ${syncStatus} via ${syncPath}`);
    }
  }, [syncStatus, syncPath]);

  // Initialize remote print handler (for receiving print requests from other devices)
  useEffect(() => {
    if (!isTauri) return;

    console.log('[WebSocketManager] Initializing remote print handler...');
    initRemotePrintHandler().catch((err) => {
      console.error('[WebSocketManager] Failed to initialize remote print handler:', err);
    });

    return () => {
      stopRemotePrintHandler();
    };
  }, []);

  // This component manages connections but doesn't render anything
  return null;
}

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

import { useEffect, useState, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useDeviceStore } from '../stores/deviceStore';
import { useStaffStore } from '../stores/staffStore';
import { useFloorPlanStore } from '../stores/floorPlanStore';
import { useServiceRequestStore } from '../stores/serviceRequestStore';
import { orderSyncService } from '../lib/orderSyncService';
import { aggregatorSyncService } from '../lib/aggregatorSyncService';
import { transformAggregatorToKitchenOrder, createKitchenOrderWithId } from '../lib/orderTransformations';
import { createAggregatorCustomer } from '../lib/handsfreeApi';
import type { AggregatorOrder, AggregatorSource, AggregatorOrderStatus } from '../types/aggregator';
import type { KitchenOrder } from '../types/kds';

// Check if we're in Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// Track sent KOT orders globally to prevent duplicates
const sentToKotOrderIds = new Set<string>();
let tauriAggregatorListenerSetup = false;

// Map extracted status to AggregatorOrderStatus
function mapExtractedStatus(status: string): AggregatorOrderStatus {
  const statusLower = status?.toLowerCase() || 'pending';
  if (statusLower.includes('deliver')) return 'delivered';
  if (statusLower.includes('ready')) return 'ready';
  if (statusLower.includes('prepar')) return 'preparing';
  if (statusLower.includes('confirm')) return 'confirmed';
  if (statusLower.includes('cancel')) return 'cancelled';
  if (statusLower.includes('pick')) return 'out_for_delivery';
  return 'pending';
}

export function WebSocketManager() {
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const { addOrder: addAggregatorOrder, loadOrdersFromDb } = useAggregatorStore();
  const { addOrder: addToKDS } = useKDSStore();
  const { playSound } = useNotificationStore();
  const { setIsLanConnected } = useDeviceStore();

  // Note: Staff and floor plan stores are accessed via getState() in callbacks
  // to avoid stale closures and unnecessary re-renders

  const [syncStatus, setSyncStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [syncPath, setSyncPath] = useState<'cloud' | 'lan' | 'both' | 'none'>('none');
  const syncInitializedForTenant = useRef<string | null>(null);

  // Send order to KOT/KDS and broadcast to other devices
  const sendToKOT = useCallback(async (order: AggregatorOrder) => {
    if (sentToKotOrderIds.has(order.orderId)) {
      console.log('[WebSocketManager] Order already sent to KOT:', order.orderNumber);
      return;
    }

    try {
      console.log('[WebSocketManager] Sending order to KOT:', order.orderNumber);
      const kitchenOrderPartial = transformAggregatorToKitchenOrder(order);
      const kitchenOrder = createKitchenOrderWithId(kitchenOrderPartial);
      addToKDS(kitchenOrder);
      sentToKotOrderIds.add(order.orderId);
      console.log('[WebSocketManager] Order sent to KDS:', order.orderNumber);

      // Broadcast to other devices (KDS tablets, etc.) via cloud WebSocket
      try {
        const result = await orderSyncService.broadcastOrder(
          { orderId: order.orderId, orderNumber: order.orderNumber } as any,
          kitchenOrder
        );
        if (result.cloud || result.lan > 0) {
          console.log(`[WebSocketManager] Order broadcast: cloud=${result.cloud}, lan=${result.lan}`);
        }
      } catch (syncError) {
        console.warn('[WebSocketManager] Broadcast failed (non-critical):', syncError);
      }
    } catch (error) {
      console.error('[WebSocketManager] Failed to send to KOT:', error);
    }
  }, [addToKDS]);

  // Initialize unified Order Sync Service (Cloud + LAN)
  // Use tenant from auth store, or fall back to tenant store (for unauthenticated sync)
  const effectiveTenantId = user?.tenantId || tenant?.tenantId;

  useEffect(() => {
    if (!effectiveTenantId) {
      console.log('[WebSocketManager] No tenant ID available yet, waiting for hydration...');
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

    console.log('[WebSocketManager] Initializing Order Sync Service for tenant:', effectiveTenantId);
    syncInitializedForTenant.current = effectiveTenantId;

    // Track if effect is still active (for cleanup)
    let isActive = true;

    // Load staff and floor plan from database BEFORE initializing sync
    // This ensures we have data to respond with when sync is requested
    const initializeSync = async () => {
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

      await orderSyncService.initialize(effectiveTenantId, {
      onOrderCreated: (_order, kitchenOrder: KitchenOrder) => {
        console.log('[WebSocketManager] Received order via sync:', kitchenOrder?.orderNumber);
        if (kitchenOrder) {
          addToKDS(kitchenOrder);
          playSound('new_order');
        }
      },
      onOrderStatusUpdate: (orderId, status) => {
        console.log('[WebSocketManager] Order status update via sync:', orderId, status);
        // KDS store is updated inside orderSyncService
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

      // QR order callback
      onQROrderCreated: (_order, tableInfo, kitchenOrder) => {
        console.log('[WebSocketManager] Received QR order for table:', tableInfo?.tableNumber);
        if (kitchenOrder) {
          addToKDS(kitchenOrder);
          playSound('qr_order');
        }
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
      });
    };

    initializeSync().catch((err) => {
      console.error('[WebSocketManager] Failed to initialize sync service:', err);
    });

    return () => {
      isActive = false;
      console.log('[WebSocketManager] Shutting down Order Sync Service');
      orderSyncService.shutdown().catch(console.error);
      syncInitializedForTenant.current = null;
    };
    // Only re-initialize when tenant changes - other deps are stable or accessed via getState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTenantId]);

  // Load persisted aggregator orders from local database on startup
  // and fetch from cloud to get any orders we don't have locally
  // Also start background sync service for D1 cloud sync
  const { fetchFromCloud } = useAggregatorStore();

  useEffect(() => {
    if (!isTauri) return;

    console.log('[WebSocketManager] Loading persisted aggregator orders...');
    loadOrdersFromDb().catch((err) => {
      console.error('[WebSocketManager] Failed to load orders from DB:', err);
    });

    // Fetch orders from cloud to sync with other devices
    if (effectiveTenantId) {
      console.log('[WebSocketManager] Fetching orders from cloud...');
      fetchFromCloud(effectiveTenantId).catch((err) => {
        console.error('[WebSocketManager] Failed to fetch orders from cloud:', err);
      });
    }

    // Start background sync service for D1 cloud sync
    aggregatorSyncService.start();

    return () => {
      aggregatorSyncService.stop();
    };
  }, [loadOrdersFromDb, effectiveTenantId, fetchFromCloud]);

  // Setup Tauri aggregator event listener (Swiggy/Zomato order extraction)
  useEffect(() => {
    if (!isTauri || tauriAggregatorListenerSetup) return;

    let unlistenFn: UnlistenFn | null = null;

    const setupTauriListener = async () => {
      try {
        console.log('[WebSocketManager] Setting up aggregator-orders-extracted listener...');

        unlistenFn = await listen('aggregator-orders-extracted', (event: { payload: any[] }) => {
          console.log('[WebSocketManager] Received extracted orders:', event.payload?.length);

          const receivedAt = new Date().toISOString();

          event.payload?.forEach((extractedOrder: any) => {
            const order: AggregatorOrder = {
              aggregator: extractedOrder.platform as AggregatorSource,
              aggregatorOrderId: extractedOrder.order_id,
              aggregatorStatus: extractedOrder.status,
              orderId: extractedOrder.order_id,
              orderNumber: extractedOrder.order_number,
              status: mapExtractedStatus(extractedOrder.status),
              orderType: 'delivery',
              createdAt: receivedAt,
              customer: {
                name: extractedOrder.customer_name || 'Customer',
                phone: extractedOrder.customer_phone || null,
                address: extractedOrder.customer_address || null,
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

            console.log('[WebSocketManager] Adding order to store:', order.orderNumber);
            addAggregatorOrder(order);

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

            // Auto-send to KOT for active orders
            const mappedStatus = mapExtractedStatus(extractedOrder.status);
            if (mappedStatus === 'pending' || mappedStatus === 'confirmed' || mappedStatus === 'preparing') {
              sendToKOT(order);
            }
          });

          playSound('new_order');
        });

        tauriAggregatorListenerSetup = true;
        console.log('[WebSocketManager] Tauri aggregator listener setup complete');
      } catch (error) {
        console.error('[WebSocketManager] Failed to setup Tauri listener:', error);
      }
    };

    setupTauriListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
        tauriAggregatorListenerSetup = false;
      }
    };
  }, [addAggregatorOrder, playSound, sendToKOT, effectiveTenantId]);

  // Log sync status for debugging (can be used for UI indicator later)
  useEffect(() => {
    if (syncStatus !== 'disconnected' || syncPath !== 'none') {
      console.log(`[WebSocketManager] Sync: ${syncStatus} via ${syncPath}`);
    }
  }, [syncStatus, syncPath]);

  // This component manages connections but doesn't render anything
  return null;
}

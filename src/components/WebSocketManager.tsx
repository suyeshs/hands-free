/**
 * WebSocket/Polling Connection Manager
 * Manages real-time order sync using:
 * - LAN mesh (POS ↔ KDS/BDS) for local restaurant devices
 * - Cloud WebSocket/Polling for online orders
 * Also listens for Tauri aggregator order events
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useDeviceStore } from '../stores/deviceStore';
import { posWebSocketClient } from '../lib/posWebSocketClient';
import { orderPollingService } from '../lib/orderPollingService';
import { transformAggregatorToKitchenOrder, createKitchenOrderWithId } from '../lib/orderTransformations';
import {
  startLanServer,
  stopLanServer,
  getLanServerStatus,
  setupLanSyncListeners,
  autoConnectToPos,
  disconnectLanServer,
} from '../lib/lanSyncService';
// Types are imported for callback signatures but used via parameters
import type { AggregatorOrder, AggregatorSource, AggregatorOrderStatus } from '../types/aggregator';

// Use WebSocket for real-time order updates via Durable Objects
// Set to true to fall back to HTTP polling if WebSocket is unavailable
const USE_POLLING = true; // Temporarily use polling for more reliable order loading
const DISABLE_ORDER_SYNC = false;

// LAN sync enabled by default
const ENABLE_LAN_SYNC = true;

// Track sent KOT orders globally
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
  const { addOrder: addAggregatorOrder } = useAggregatorStore();
  const { addOrder: addToKDS } = useKDSStore();
  const { playSound } = useNotificationStore();
  const {
    deviceMode,
    shouldRunLanServer,
    shouldConnectToLanServer,
    setLanServerStatus,
    setLanClientStatus,
    setIsLanConnected,
  } = useDeviceStore();
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [lanStatus, setLanStatus] = useState<'disconnected' | 'running' | 'connected'>('disconnected');
  const lanListenersSetup = useRef(false);

  // Send order to KOT/KDS
  const sendToKOT = useCallback((order: AggregatorOrder) => {
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
    } catch (error) {
      console.error('[WebSocketManager] Failed to send to KOT:', error);
    }
  }, [addToKDS]);

  // Setup Tauri aggregator event listener (runs once globally)
  useEffect(() => {
    if (tauriAggregatorListenerSetup) return;

    const setupTauriListener = async () => {
      try {
        // @ts-ignore - Tauri types
        if (window.__TAURI__?.event) {
          // @ts-ignore
          const { listen } = window.__TAURI__.event;

          await listen('aggregator-orders-extracted', (event: { payload: any[] }) => {
            console.log('[WebSocketManager] Received extracted orders:', event.payload?.length);

            event.payload?.forEach((extractedOrder: any) => {
              const order: AggregatorOrder = {
                aggregator: extractedOrder.platform as AggregatorSource,
                aggregatorOrderId: extractedOrder.order_id,
                aggregatorStatus: extractedOrder.status,
                orderId: extractedOrder.order_id,
                orderNumber: extractedOrder.order_number,
                status: mapExtractedStatus(extractedOrder.status),
                orderType: 'delivery',
                createdAt: extractedOrder.created_at || new Date().toISOString(),
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

              // Add to aggregator store
              addAggregatorOrder(order);

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
        }
      } catch (error) {
        console.error('[WebSocketManager] Failed to setup Tauri listener:', error);
      }
    };

    setupTauriListener();
  }, [addAggregatorOrder, playSound, sendToKOT]);

  // Setup LAN sync listeners (once globally)
  useEffect(() => {
    if (!ENABLE_LAN_SYNC || lanListenersSetup.current) return;

    let unlistenFns: UnlistenFn[] = [];

    const setupListeners = async () => {
      try {
        unlistenFns = await setupLanSyncListeners({
          onOrderCreated: (order: unknown, kitchenOrder: unknown) => {
            const ko = kitchenOrder as { orderNumber?: string; id?: string } | null;
            const o = order as { orderNumber?: string } | null;
            console.log('[WebSocketManager] LAN order received:', o?.orderNumber || ko?.orderNumber);
            if (ko) {
              addToKDS(ko as Parameters<typeof addToKDS>[0]);
            }
            playSound('new_order');
          },
          onOrderStatusUpdate: (orderId, status) => {
            console.log('[WebSocketManager] LAN order status update:', orderId, status);
            // Status updates are handled by stores
          },
          onSyncState: (orders) => {
            console.log('[WebSocketManager] LAN sync state received:', orders.length, 'orders');
            // Add all orders to KDS
            orders.forEach((order: any) => {
              if (!sentToKotOrderIds.has(order.id)) {
                addToKDS(order);
                sentToKotOrderIds.add(order.id);
              }
            });
          },
          onConnected: (status) => {
            console.log('[WebSocketManager] LAN connected:', status);
            setLanClientStatus(status);
            setIsLanConnected(true);
            setLanStatus('connected');
          },
          onDisconnected: () => {
            console.log('[WebSocketManager] LAN disconnected');
            setIsLanConnected(false);
            setLanStatus('disconnected');
          },
          onClientConnected: (clientInfo) => {
            console.log('[WebSocketManager] LAN client connected:', clientInfo);
            // Refresh server status
            getLanServerStatus().then(setLanServerStatus).catch(console.error);
          },
          onClientDisconnected: (clientId) => {
            console.log('[WebSocketManager] LAN client disconnected:', clientId);
            // Refresh server status
            getLanServerStatus().then(setLanServerStatus).catch(console.error);
          },
        });
        lanListenersSetup.current = true;
        console.log('[WebSocketManager] LAN sync listeners setup complete');
      } catch (error) {
        console.error('[WebSocketManager] Failed to setup LAN listeners:', error);
      }
    };

    setupListeners();

    return () => {
      unlistenFns.forEach((unlisten) => unlisten());
      lanListenersSetup.current = false;
    };
  }, [addToKDS, playSound, setLanClientStatus, setLanServerStatus, setIsLanConnected]);

  // LAN Server (POS mode) - start server for KDS/BDS to connect
  useEffect(() => {
    if (!ENABLE_LAN_SYNC || !user?.tenantId || !shouldRunLanServer()) {
      return;
    }

    let serverStarted = false;

    const startServer = async () => {
      try {
        console.log('[WebSocketManager] Starting LAN server for tenant:', user.tenantId);
        const address = await startLanServer(user.tenantId);
        console.log('[WebSocketManager] LAN server started at:', address);
        serverStarted = true;
        setLanStatus('running');

        // Get and store server status
        const status = await getLanServerStatus();
        setLanServerStatus(status);
      } catch (error) {
        console.error('[WebSocketManager] Failed to start LAN server:', error);
      }
    };

    startServer();

    return () => {
      if (serverStarted) {
        console.log('[WebSocketManager] Stopping LAN server');
        stopLanServer().catch(console.error);
        setLanServerStatus(null);
        setLanStatus('disconnected');
      }
    };
  }, [user?.tenantId, deviceMode, shouldRunLanServer, setLanServerStatus]);

  // LAN Client (KDS/BDS mode) - auto-connect to POS
  useEffect(() => {
    if (!ENABLE_LAN_SYNC || !user?.tenantId || !shouldConnectToLanServer()) {
      return;
    }

    let connected = false;

    const connectToLanServer = async () => {
      try {
        console.log('[WebSocketManager] Auto-connecting to POS server...');
        setLanStatus('disconnected');

        // Map DeviceMode to DeviceType for LAN sync
        const lanDeviceType = deviceMode === 'kds' ? 'kds' : deviceMode === 'bds' ? 'bds' : 'manager';
        const status = await autoConnectToPos(lanDeviceType, user.tenantId);
        if (status?.isConnected) {
          console.log('[WebSocketManager] Connected to POS server');
          connected = true;
          setLanClientStatus(status);
          setIsLanConnected(true);
          setLanStatus('connected');
        } else {
          console.log('[WebSocketManager] No POS server found on network');
        }
      } catch (error) {
        console.error('[WebSocketManager] Failed to connect to POS:', error);
      }
    };

    // Initial connection attempt
    connectToLanServer();

    // Retry connection periodically if not connected
    const retryInterval = setInterval(() => {
      if (!connected) {
        connectToLanServer();
      }
    }, 10000); // Retry every 10 seconds

    return () => {
      clearInterval(retryInterval);
      if (connected) {
        console.log('[WebSocketManager] Disconnecting from LAN server');
        disconnectLanServer().catch(console.error);
        setLanClientStatus(null);
        setIsLanConnected(false);
        setLanStatus('disconnected');
      }
    };
  }, [user?.tenantId, deviceMode, shouldConnectToLanServer, setLanClientStatus, setIsLanConnected]);

  useEffect(() => {
    // Temporarily disabled until order endpoints are implemented
    if (DISABLE_ORDER_SYNC) {
      console.log('[ConnectionManager] Order sync disabled (endpoints not implemented)');
      setConnectionStatus('disconnected');
      return;
    }

    if (!user?.tenantId) {
      console.log('[ConnectionManager] No tenantId, stopping sync');
      if (USE_POLLING) {
        orderPollingService.stop();
      } else {
        posWebSocketClient.disconnect();
      }
      setConnectionStatus('disconnected');
      return;
    }

    if (USE_POLLING) {
      // Use HTTP polling for order notifications
      console.log('[ConnectionManager] Starting order polling for tenant:', user.tenantId);
      setConnectionStatus('connected'); // Polling is always "connected"

      orderPollingService.start(user.tenantId, { soundEnabled: true });

      // Cleanup on unmount
      return () => {
        console.log('[ConnectionManager] Unmounting, stopping polling');
        orderPollingService.stop();
        setConnectionStatus('disconnected');
      };
    } else {
      // Use WebSocket
      console.log('[ConnectionManager] Connecting to WebSocket for tenant:', user.tenantId);
      setConnectionStatus('connecting');

      // Load initial orders via HTTP first (WebSocket may not always provide sync_state)
      orderPollingService.setTenantId(user.tenantId);
      orderPollingService.loadInitialOrders().then(() => {
        console.log('[ConnectionManager] Initial orders loaded via HTTP');
      }).catch((err) => {
        console.error('[ConnectionManager] Failed to load initial orders:', err);
      });

      posWebSocketClient.connect(user.tenantId, {
        onConnect: () => {
          console.log('[ConnectionManager] Connected');
          setConnectionStatus('connected');
        },
        onDisconnect: () => {
          console.log('[ConnectionManager] Disconnected');
          setConnectionStatus('disconnected');
        },
        onError: (error) => {
          console.error('[ConnectionManager] Error:', error);
        },
      });

      // Cleanup on unmount
      return () => {
        console.log('[ConnectionManager] Unmounting, disconnecting');
        posWebSocketClient.disconnect();
        setConnectionStatus('disconnected');
      };
    }
  }, [user?.tenantId]);

  // Optional: Show connection status indicator in development
  if (import.meta.env.DEV) {
    const mode = USE_POLLING ? 'POLLING' : 'WS';
    const queuedCount = USE_POLLING ? 0 : posWebSocketClient.getQueuedMessageCount();
    const lanLabel = shouldRunLanServer() ? 'LAN-SRV' : shouldConnectToLanServer() ? 'LAN-CLI' : '';

    return (
      <div
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          display: 'flex',
          gap: '8px',
          zIndex: 9999,
        }}
      >
        {/* LAN Status */}
        {ENABLE_LAN_SYNC && lanLabel && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor:
                lanStatus === 'running' || lanStatus === 'connected'
                  ? '#3b82f6'
                  : '#6b7280',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {lanLabel}: {lanStatus.toUpperCase()}
          </div>
        )}
        {/* Cloud Status */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor:
              connectionStatus === 'connected'
                ? '#10b981'
                : connectionStatus === 'connecting'
                ? '#f59e0b'
                : '#6b7280',
            color: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {mode}: {connectionStatus.toUpperCase()}
          {queuedCount > 0 && ` (${queuedCount} queued)`}
        </div>
      </div>
    );
  }

  return null;
}

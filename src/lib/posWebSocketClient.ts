/**
 * POS WebSocket Client Manager
 * Singleton instance for managing WebSocket connection to backend
 */

import { usePOSStore } from '../stores/posStore';
import { useKDSStore } from '../stores/kdsStore';
import { useOnlineOrderStore } from '../stores/onlineOrderStore';
import type { KitchenOrder } from '../types/kds';
import type { OnlineOrder } from '../types/online';

type WSMessageType =
  | 'submit_order'
  | 'order_created'
  | 'order_status_update'
  | 'sync_state'
  | 'error';

interface WSMessage {
  type: WSMessageType;
  [key: string]: any;
}

interface OrderCreatedMessage extends WSMessage {
  type: 'order_created';
  order: any;
  kitchenOrder: KitchenOrder;
}

interface OrderStatusUpdateMessage extends WSMessage {
  type: 'order_status_update';
  orderId: string;
  orderNumber: string;
  status: string;
  updatedBy: string;
}

interface SyncStateMessage extends WSMessage {
  type: 'sync_state';
  activeOrders: KitchenOrder[];
  recentOrders: any[];
}

class POSWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | undefined;
  private reconnectAttempts = 0;
  private messageQueue: WSMessage[] = [];
  private tenantId: string | null = null;
  private isConnecting = false;

  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;

  // Callbacks
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private onErrorCallback?: (error: Error) => void;

  /**
   * Get WebSocket URL for tenant
   * Connects to the Orders Worker Durable Object for real-time updates
   */
  private getWebSocketURL(tenantId: string): string {
    // Use orders worker WebSocket endpoint
    const ordersWsUrl = import.meta.env.VITE_ORDERS_WS_URL || 'wss://handsfree-orders.suyesh.workers.dev';
    return `${ordersWsUrl}/ws/orders/${tenantId}`;
  }

  /**
   * Calculate exponential backoff delay
   */
  private getReconnectDelay(): number {
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  /**
   * Connect to WebSocket
   */
  connect(tenantId: string, callbacks?: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): void {
    if (!tenantId) {
      console.warn('[POSWebSocketClient] No tenantId provided');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('[POSWebSocketClient] Already connected or connecting');
      return;
    }

    this.tenantId = tenantId;
    this.onConnectCallback = callbacks?.onConnect;
    this.onDisconnectCallback = callbacks?.onDisconnect;
    this.onErrorCallback = callbacks?.onError;

    try {
      const url = this.getWebSocketURL(tenantId);
      console.log('[POSWebSocketClient] Connecting to:', url);

      this.isConnecting = true;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[POSWebSocketClient] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.onConnectCallback?.();
        this.processMessageQueue();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error('[POSWebSocketClient] Error:', error);
        this.isConnecting = false;
        this.onErrorCallback?.(new Error('WebSocket error'));
      };

      this.ws.onclose = (event) => {
        console.log('[POSWebSocketClient] Disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;
        this.onDisconnectCallback?.();

        // Attempt reconnection
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          const delay = this.getReconnectDelay();
          console.log(`[POSWebSocketClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);

          this.reconnectTimeout = window.setTimeout(() => {
            this.reconnectAttempts++;
            if (this.tenantId) {
              this.connect(this.tenantId, {
                onConnect: this.onConnectCallback,
                onDisconnect: this.onDisconnectCallback,
                onError: this.onErrorCallback,
              });
            }
          }, delay);
        } else {
          console.error('[POSWebSocketClient] Max reconnection attempts reached');
          this.onErrorCallback?.(new Error('Failed to reconnect after maximum attempts'));
        }
      };
    } catch (error) {
      console.error('[POSWebSocketClient] Connection error:', error);
      this.isConnecting = false;
      this.onErrorCallback?.(error as Error);
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[POSWebSocketClient] Disconnecting');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnecting = false;
  }

  /**
   * Send message via WebSocket
   */
  sendMessage(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[POSWebSocketClient] Sending message:', message.type);
      this.ws.send(JSON.stringify(message));
    } else {
      console.log('[POSWebSocketClient] Queueing message (not connected):', message.type);
      this.messageQueue.push(message);
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log('[POSWebSocketClient] Processing queued messages:', this.messageQueue.length);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);
      console.log('[POSWebSocketClient] Received message:', message.type);

      switch (message.type) {
        case 'order_created': {
          const msg = message as OrderCreatedMessage;
          console.log('[POSWebSocketClient] Order created:', msg.kitchenOrder?.orderNumber || msg.order?.orderNumber);

          // Add to KDS store if kitchenOrder is present
          if (msg.kitchenOrder) {
            useKDSStore.getState().addOrder(msg.kitchenOrder);
          }

          // Add to online order store (website orders)
          if (msg.order) {
            const onlineOrder: OnlineOrder = {
              id: msg.order.orderId,
              orderNumber: msg.order.orderNumber,
              status: msg.order.status || 'pending',
              orderType: msg.order.orderType === 'delivery' ? 'delivery' : 'pickup',
              createdAt: msg.order.createdAt,
              customer: {
                name: msg.order.customerName || 'Guest',
                phone: msg.order.customerPhone || '',
              },
              cart: {
                items: (msg.kitchenOrder?.items || []).map((item: any) => ({
                  id: item.id,
                  name: item.name,
                  quantity: item.quantity,
                  price: 0,
                  total: 0,
                })),
                subtotal: msg.order.subtotal || 0,
                tax: msg.order.tax || 0,
                deliveryFee: 0,
                discount: 0,
                total: msg.order.total || 0,
              },
              payment: {
                method: msg.order.paymentMethod || 'cash',
                status: 'pending',
                isPrepaid: false,
              },
              specialInstructions: msg.order.notes || null,
            };
            useOnlineOrderStore.getState().addOrder(onlineOrder);
          }

          // Update POS store with backend order number if different
          if (msg.order?.orderNumber) {
            usePOSStore.getState().updateLastOrderNumber(msg.order.orderNumber);
          }
          break;
        }

        case 'order_status_update': {
          const msg = message as OrderStatusUpdateMessage;
          console.log('[POSWebSocketClient] Order status update:', msg.orderNumber, msg.status);

          // Update KDS store
          useKDSStore.getState().updateOrder(msg.orderId, { status: msg.status as any });

          // Update POS recent orders
          const posState = usePOSStore.getState();
          const updatedRecentOrders = posState.recentOrders.map(order =>
            order.orderNumber === msg.orderNumber
              ? { ...order, status: msg.status as any }
              : order
          );
          usePOSStore.setState({ recentOrders: updatedRecentOrders });
          break;
        }

        case 'sync_state': {
          const msg = message as SyncStateMessage;
          console.log('[POSWebSocketClient] State sync:', {
            activeOrders: msg.activeOrders.length,
            recentOrders: msg.recentOrders.length,
          });

          // Sync KDS orders
          useKDSStore.getState().setActiveOrders(msg.activeOrders);

          // Sync POS recent orders
          usePOSStore.setState({ recentOrders: msg.recentOrders });
          break;
        }

        case 'error': {
          console.error('[POSWebSocketClient] Server error:', message.message);
          this.onErrorCallback?.(new Error(message.message));
          break;
        }

        default:
          console.warn('[POSWebSocketClient] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[POSWebSocketClient] Failed to parse message:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get queued message count
   */
  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  /**
   * Submit order via WebSocket
   */
  submitOrder(order: any): void {
    this.sendMessage({
      type: 'submit_order',
      order,
    });
  }
}

// Singleton instance
export const posWebSocketClient = new POSWebSocketClient();

/**
 * POS WebSocket Hook
 * Manages real-time connection to backend order management system
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePOSStore } from '../stores/posStore';
import { useKDSStore } from '../stores/kdsStore';
import type { Order } from '../types/pos';
import type { KitchenOrder } from '../types/kds';

// WebSocket message types
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
  order: any; // Backend order format
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
  recentOrders: Order[];
}

interface ErrorMessage extends WSMessage {
  type: 'error';
  message: string;
  code?: string;
}

interface UsePOSWebSocketOptions {
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

const getWebSocketURL = (tenantId: string): string => {
  // Check for environment variable first
  const wsUrl = import.meta.env.VITE_BACKEND_WS_URL;

  if (wsUrl) {
    return `${wsUrl}/restaurant-pos/${tenantId}`;
  }

  // Fallback to constructing from current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_BACKEND_URL || 'localhost:3001';

  // Remove http:// or https:// from host if present
  const cleanHost = host.replace(/^https?:\/\//, '');

  return `${protocol}//${cleanHost}/ws/restaurant-pos/${tenantId}`;
};

export function usePOSWebSocket(options: UsePOSWebSocketOptions = {}) {
  const { enabled = true, onConnect, onDisconnect, onError } = options;

  const { user } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const messageQueueRef = useRef<WSMessage[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 1000; // 1 second
  const MAX_RECONNECT_DELAY = 30000; // 30 seconds

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
      MAX_RECONNECT_DELAY
    );
    return delay + Math.random() * 1000; // Add jitter
  }, []);

  // Send message via WebSocket
  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[POSWebSocket] Sending message:', message.type);
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      console.log('[POSWebSocket] Queueing message (not connected):', message.type);
      messageQueueRef.current.push(message);
    }
  }, []);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    console.log('[POSWebSocket] Processing queued messages:', messageQueueRef.current.length);

    const messages = [...messageQueueRef.current];
    messageQueueRef.current = [];

    messages.forEach(message => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    });
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      console.log('[POSWebSocket] Received message:', message.type);

      switch (message.type) {
        case 'order_created': {
          const msg = message as OrderCreatedMessage;
          console.log('[POSWebSocket] Order created:', msg.kitchenOrder.orderNumber);

          // Add to KDS store
          useKDSStore.getState().addOrder(msg.kitchenOrder);

          // Update POS store with backend order number if different
          if (msg.order.orderNumber) {
            usePOSStore.getState().updateLastOrderNumber(msg.order.orderNumber);
          }
          break;
        }

        case 'order_status_update': {
          const msg = message as OrderStatusUpdateMessage;
          console.log('[POSWebSocket] Order status update:', msg.orderNumber, msg.status);

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
          console.log('[POSWebSocket] State sync:', {
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
          const msg = message as ErrorMessage;
          console.error('[POSWebSocket] Server error:', msg.message);
          onError?.(new Error(msg.message));
          break;
        }

        default:
          console.warn('[POSWebSocket] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[POSWebSocket] Failed to parse message:', error);
    }
  }, [onError]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabled || !user?.tenantId) {
      console.log('[POSWebSocket] Not connecting (disabled or no tenantId)');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[POSWebSocket] Already connected/connecting');
      return;
    }

    try {
      const url = getWebSocketURL(user.tenantId);
      console.log('[POSWebSocket] Connecting to:', url);

      setIsConnecting(true);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[POSWebSocket] Connected');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;

        onConnect?.();

        // Process queued messages
        processMessageQueue();
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('[POSWebSocket] Error:', error);
        setIsConnecting(false);
        onError?.(new Error('WebSocket error'));
      };

      ws.onclose = (event) => {
        console.log('[POSWebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        onDisconnect?.();

        // Attempt reconnection with exponential backoff
        if (enabled && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = getReconnectDelay();
          console.log(`[POSWebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[POSWebSocket] Max reconnection attempts reached');
          onError?.(new Error('Failed to reconnect after maximum attempts'));
        }
      };
    } catch (error) {
      console.error('[POSWebSocket] Connection error:', error);
      setIsConnecting(false);
      onError?.(error as Error);
    }
  }, [enabled, user?.tenantId, onConnect, onDisconnect, onError, handleMessage, processMessageQueue, getReconnectDelay]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    console.log('[POSWebSocket] Disconnecting');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Auto-connect/disconnect based on enabled and tenantId
  useEffect(() => {
    if (enabled && user?.tenantId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, user?.tenantId, connect, disconnect]);

  // Submit order via WebSocket
  const submitOrder = useCallback((order: any) => {
    sendMessage({
      type: 'submit_order',
      order,
    });
  }, [sendMessage]);

  return {
    isConnected,
    isConnecting,
    sendMessage,
    submitOrder,
    connect,
    disconnect,
    queuedMessages: messageQueueRef.current.length,
  };
}

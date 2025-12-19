/**
 * WebSocket Hook
 * React hook for managing WebSocket connections
 */

import { useEffect, useCallback } from 'react';
import { websocketService } from '../lib/websocket';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useNotificationStore } from '../stores/notificationStore';
import type { AggregatorOrder } from '../types/aggregator';

export function useAggregatorWebSocket() {
  const { tokens, isAuthenticated } = useAuthStore();
  const { addOrder, updateOrder, setConnected } = useAggregatorStore();
  const { playSound } = useNotificationStore();

  // Handle new order
  const handleNewOrder = useCallback(
    (order: AggregatorOrder) => {
      console.log('[WebSocket] New aggregator order:', order.orderNumber);
      addOrder(order);
      playSound('new_order');
    },
    [addOrder, playSound]
  );

  // Handle order update
  const handleOrderUpdate = useCallback(
    (update: { orderId: string; updates: Partial<AggregatorOrder> }) => {
      console.log('[WebSocket] Order update:', update.orderId);
      updateOrder(update.orderId, update.updates);
    },
    [updateOrder]
  );

  // Handle connection status
  const handleConnect = useCallback(() => {
    console.log('[WebSocket] Connected');
    setConnected(true);
  }, [setConnected]);

  const handleDisconnect = useCallback(() => {
    console.log('[WebSocket] Disconnected');
    setConnected(false);
  }, [setConnected]);

  useEffect(() => {
    // Only connect if authenticated
    if (!isAuthenticated || !tokens?.accessToken) {
      console.log('[WebSocket] Not authenticated, skipping connection');
      return;
    }

    // Check if WebSocket is enabled
    const wsEnabled = import.meta.env.VITE_ENABLE_WEBSOCKET !== 'false';
    if (!wsEnabled) {
      console.log('[WebSocket] WebSocket disabled in environment');
      return;
    }

    // Connect to WebSocket
    websocketService.connect(tokens.accessToken);

    // Subscribe to events
    websocketService.on('connect', handleConnect);
    websocketService.on('disconnect', handleDisconnect);
    websocketService.on('aggregator_order', handleNewOrder);
    websocketService.on('aggregator_order_update', handleOrderUpdate);

    // Cleanup on unmount
    return () => {
      websocketService.off('connect', handleConnect);
      websocketService.off('disconnect', handleDisconnect);
      websocketService.off('aggregator_order', handleNewOrder);
      websocketService.off('aggregator_order_update', handleOrderUpdate);
      websocketService.disconnect();
    };
  }, [
    isAuthenticated,
    tokens?.accessToken,
    handleConnect,
    handleDisconnect,
    handleNewOrder,
    handleOrderUpdate,
  ]);

  return {
    isConnected: websocketService.isConnected(),
    reconnectAttempts: websocketService.getReconnectAttempts(),
  };
}

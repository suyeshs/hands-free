/**
 * Kitchen Dashboard (KDS - Kitchen Display System)
 * Comprehensive kitchen order display and management
 */

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useKDSStore } from '../stores/kdsStore';
import { useNotificationStore } from '../stores/notificationStore';
import { usePrinterStore } from '../stores/printerStore';
import { printerService } from '../lib/printerService';

export default function KitchenDashboard() {
  const { user, logout } = useAuthStore();
  const {
    selectedStation,
    setSelectedStation,
    refreshOrders,
    fetchOrders,
    getFilteredOrders,
    getStats,
    getUrgentOrders,
    markItemReady,
    markAllItemsReady,
    markOrderComplete,
    markItemStatus,
  } = useKDSStore();
  const { playSound } = useNotificationStore();
  const { config: printerConfig, addPrintHistory } = usePrinterStore();

  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const previousOrderIds = useRef<Set<string>>(new Set());

  const stats = getStats();
  const filteredOrders = getFilteredOrders();
  const urgentOrders = getUrgentOrders();

  // Fetch initial orders
  useEffect(() => {
    if (user?.tenantId) {
      fetchOrders(user.tenantId, selectedStation === 'all' ? undefined : selectedStation);
    }
  }, [user?.tenantId, selectedStation, fetchOrders]);

  // Set up auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshOrders(user?.tenantId);
    }, 5000);

    return () => clearInterval(interval);
  }, [user?.tenantId, refreshOrders]);

  // Play sound for urgent orders
  useEffect(() => {
    if (urgentOrders.length > 0) {
      playSound('order_urgent');
    }
  }, [urgentOrders.length, playSound]);

  // Auto-print new orders
  useEffect(() => {
    if (!printerConfig.autoPrintOnAccept) return;

    const currentOrderIds = new Set(filteredOrders.map((o) => o.id));
    const newOrders = filteredOrders.filter(
      (order) => !previousOrderIds.current.has(order.id) && order.status === 'pending'
    );

    // Print new orders
    if (newOrders.length > 0) {
      newOrders.forEach(async (order) => {
        try {
          await printerService.print(order);
          addPrintHistory(order.id, order.orderNumber, true);
          console.log('[KitchenDashboard] Auto-printed order:', order.orderNumber);
        } catch (error) {
          console.error('[KitchenDashboard] Auto-print failed:', error);
          addPrintHistory(order.id, order.orderNumber, false);
        }
      });
    }

    // Update previous order IDs
    previousOrderIds.current = currentOrderIds;
  }, [filteredOrders, printerConfig.autoPrintOnAccept, addPrintHistory]);

  // Handle mark item as in progress
  const handleMarkItemInProgress = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    setProcessingItems((prev) => new Set(prev).add(key));
    try {
      markItemStatus(orderId, itemId, 'in_progress');
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Handle mark item ready
  const handleMarkItemReady = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    setProcessingItems((prev) => new Set(prev).add(key));
    try {
      await markItemReady(orderId, itemId);
    } catch (error) {
      console.error('Failed to mark item ready:', error);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Handle mark all items ready
  const handleMarkAllItemsReady = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markAllItemsReady(orderId);
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to mark all items ready:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Handle complete order
  const handleCompleteOrder = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markOrderComplete(orderId);
      playSound('order_completed');
    } catch (error) {
      console.error('Failed to complete order:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Handle print KOT
  const handlePrintKOT = async (orderId: string) => {
    const order = filteredOrders.find((o) => o.id === orderId);
    if (!order) return;

    try {
      await printerService.print(order);
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to print KOT:', error);
      playSound('error');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Kitchen Display System</h1>
              <p className="text-sm text-gray-400 mt-1">
                {user?.name} - {selectedStation === 'all' ? 'All Stations' : selectedStation.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {urgentOrders.length > 0 && (
                <div className="px-4 py-2 bg-red-900 text-red-100 rounded-lg font-bold animate-pulse">
                  {urgentOrders.length} Urgent Order{urgentOrders.length !== 1 ? 's' : ''}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-600 rounded-md hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">Active Orders</p>
              <p className="text-3xl font-bold mt-1">{stats.activeOrders}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">Pending Items</p>
              <p className="text-3xl font-bold mt-1 text-yellow-400">{stats.pendingItems}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">Avg Prep Time</p>
              <p className="text-3xl font-bold mt-1">{stats.averagePrepTime}m</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">Oldest Order</p>
              <p className={`text-3xl font-bold mt-1 ${stats.oldestOrderMinutes > 20 ? 'text-red-400' : ''}`}>
                {stats.oldestOrderMinutes}m
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Station Filter */}
      <div className="bg-gray-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2">
            {['all', 'grill', 'wok', 'fryer', 'salad', 'dessert', 'drinks'].map((station) => (
              <button
                key={station}
                onClick={() => setSelectedStation(station as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedStation === station
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {station.charAt(0).toUpperCase() + station.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-gray-800 rounded-lg">
              <p className="text-gray-400 text-lg">No active orders</p>
              <p className="text-gray-500 text-sm mt-2">New orders will appear here automatically</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-gray-800 rounded-lg p-4 border-l-4 ${
                  order.isUrgent
                    ? 'border-red-500 shadow-lg shadow-red-500/20'
                    : order.status === 'ready'
                    ? 'border-green-500'
                    : order.status === 'in_progress'
                    ? 'border-blue-500'
                    : 'border-gray-600'
                }`}
              >
                {/* Order Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-2xl">#{order.orderNumber}</h3>
                    <p className="text-sm text-gray-400 capitalize">{order.orderType}</p>
                    {order.tableNumber && (
                      <p className="text-sm text-gray-400">Table: {order.tableNumber}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-3 py-1 text-sm font-bold rounded ${
                        order.isUrgent
                          ? 'bg-red-900 text-red-200 animate-pulse'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {order.elapsedMinutes}m
                    </span>
                    {order.estimatedPrepTime && (
                      <p className="text-xs text-gray-500 mt-1">
                        Est: {order.estimatedPrepTime}m
                      </p>
                    )}
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2 mb-4">
                  {order.items.map((item) => {
                    const itemKey = `${order.id}-${item.id}`;
                    const isProcessing = processingItems.has(itemKey);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg ${
                          item.status === 'ready'
                            ? 'bg-green-900/50 border border-green-700'
                            : item.status === 'in_progress'
                            ? 'bg-blue-900/50 border border-blue-700'
                            : 'bg-gray-700 border border-gray-600'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg">{item.quantity}x</span>
                              <span className="font-medium">{item.name}</span>
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <p className="text-sm text-gray-400 mt-1">
                                {item.modifiers.map(m => `${m.name}: ${m.value}`).join(', ')}
                              </p>
                            )}
                            {item.specialInstructions && (
                              <p className="text-sm text-yellow-300 mt-1 font-medium">
                                ⚠️ {item.specialInstructions}
                              </p>
                            )}
                            {item.station && (
                              <p className="text-xs text-gray-500 mt-1 uppercase">
                                {item.station}
                              </p>
                            )}
                          </div>

                          {/* Item Status Buttons */}
                          <div className="flex flex-col gap-1 ml-2">
                            {item.status === 'pending' && (
                              <button
                                onClick={() => handleMarkItemInProgress(order.id, item.id)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                Start
                              </button>
                            )}
                            {(item.status === 'pending' || item.status === 'in_progress') && (
                              <button
                                onClick={() => handleMarkItemReady(order.id, item.id)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {isProcessing ? 'Processing...' : 'Ready'}
                              </button>
                            )}
                            {item.status === 'ready' && (
                              <span className="text-xs text-green-400 font-bold">✓ READY</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Order Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {order.items.every((item) => item.status === 'ready') ? (
                      <button
                        onClick={() => handleCompleteOrder(order.id)}
                        disabled={processingOrders.has(order.id)}
                        className="flex-1 px-4 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {processingOrders.has(order.id) ? 'Completing...' : 'Complete Order'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkAllItemsReady(order.id)}
                        disabled={processingOrders.has(order.id)}
                        className="flex-1 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {processingOrders.has(order.id) ? 'Processing...' : 'Mark All Ready'}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handlePrintKOT(order.id)}
                    className="w-full px-4 py-2 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 border border-gray-600"
                  >
                    🖨️ Print KOT
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

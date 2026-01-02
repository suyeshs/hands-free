/**
 * Aggregator Dashboard
 * Display and manage live orders from Zomato and Swiggy
 */

import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAggregatorStore } from '../stores/aggregatorStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAggregatorWebSocket } from '../hooks/useWebSocket';
import { backendApi } from '../lib/backendApi';

export default function AggregatorDashboard() {
  const { user, logout } = useAuthStore();
  const {
    orders,
    filter,
    setOrders,
    setFilter,
    setLoading,
    setError,
    acceptOrder,
    rejectOrder,
    markPreparing,
    markReady,
  } = useAggregatorStore();
  const { playSound } = useNotificationStore();
  const { isConnected } = useAggregatorWebSocket();
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const { orders: fetchedOrders } = await backendApi.getAggregatorOrders(
        user.tenantId,
        filter.status
      );
      setOrders(fetchedOrders);
      setError(null);
    } catch (error) {
      console.error('[AggregatorDashboard] Failed to fetch orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filter.status, setOrders, setLoading, setError]);

  useEffect(() => {
    // Load initial orders
    fetchOrders();

    // Set up auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchOrders();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Play sound for new orders
  useEffect(() => {
    const pendingOrders = orders.filter((o) => o.status === 'pending');
    if (pendingOrders.length > 0) {
      playSound('new_order');
    }
  }, [orders, playSound]);

  // Handle order accept
  const handleAcceptOrder = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await acceptOrder(orderId, 20); // Default 20 min prep time
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to accept order:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Handle order reject
  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await rejectOrder(orderId, reason);
    } catch (error) {
      console.error('Failed to reject order:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Handle mark preparing
  const handleMarkPreparing = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markPreparing(orderId);
    } catch (error) {
      console.error('Failed to mark as preparing:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Handle mark ready
  const handleMarkReady = async (orderId: string) => {
    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      await markReady(orderId);
      playSound('order_ready');
    } catch (error) {
      console.error('Failed to mark as ready:', error);
    } finally {
      setProcessingOrders((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Aggregator Orders
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-600">
                {user?.name} ({user?.role})
              </p>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  isConnected
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4">
            <select
              value={filter.aggregator}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  aggregator: e.target.value as any,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Aggregators</option>
              <option value="zomato">Zomato</option>
              <option value="swiggy">Swiggy</option>
            </select>

            <select
              value={filter.status}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  status: e.target.value as any,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
            </select>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.orderId}
                className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg">#{order.orderNumber}</h3>
                    <p className="text-sm text-gray-600 capitalize">
                      {order.aggregator}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      order.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : order.status === 'confirmed'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'ready'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <p>
                    <span className="font-medium">Customer:</span>{' '}
                    {order.customer.name}
                  </p>
                  <p>
                    <span className="font-medium">Items:</span>{' '}
                    {order.cart.items.length}
                  </p>
                  <p>
                    <span className="font-medium">Total:</span> ₹
                    {order.cart.total.toFixed(2)}
                  </p>
                  <p className="text-gray-600">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {order.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptOrder(order.orderId)}
                        disabled={processingOrders.has(order.orderId)}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingOrders.has(order.orderId)
                          ? 'Processing...'
                          : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.orderId)}
                        disabled={processingOrders.has(order.orderId)}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {order.status === 'confirmed' && (
                    <button
                      onClick={() => handleMarkPreparing(order.orderId)}
                      disabled={processingOrders.has(order.orderId)}
                      className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingOrders.has(order.orderId)
                        ? 'Processing...'
                        : 'Mark Preparing'}
                    </button>
                  )}

                  {order.status === 'preparing' && (
                    <button
                      onClick={() => handleMarkReady(order.orderId)}
                      disabled={processingOrders.has(order.orderId)}
                      className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingOrders.has(order.orderId)
                        ? 'Processing...'
                        : 'Mark Ready'}
                    </button>
                  )}

                  {order.status === 'ready' && (
                    <div className="text-center py-2 text-sm font-medium text-green-600">
                      Ready for Pickup/Delivery
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

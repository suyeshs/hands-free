/**
 * Track Order Page
 *
 * Customer-facing order tracking page:
 * - Shows order status in real-time via WebSocket
 * - Requests push notification permission
 * - Replaces expensive vibrating pagers
 *
 * Route: /track/:orderNumber?token=xxx
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTenantStore } from '../stores/tenantStore';

type OrderTrackingStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed';

interface TrackingOrder {
  orderNumber: string;
  status: OrderTrackingStatus;
  items: Array<{
    name: string;
    quantity: number;
    status: 'pending' | 'preparing' | 'ready';
  }>;
  createdAt: string;
  estimatedReadyTime?: string;
}

const STATUS_CONFIG: Record<OrderTrackingStatus, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  pending: {
    label: 'Order Received',
    icon: '📋',
    color: 'text-slate-300',
    bgColor: 'bg-slate-700',
  },
  confirmed: {
    label: 'Order Confirmed',
    icon: '✓',
    color: 'text-blue-300',
    bgColor: 'bg-blue-900',
  },
  preparing: {
    label: 'Preparing',
    icon: '🔥',
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-900',
    animate: true,
  },
  ready: {
    label: 'Ready!',
    icon: '🔔',
    color: 'text-green-300',
    bgColor: 'bg-green-900',
    animate: true,
  },
  completed: {
    label: 'Completed',
    icon: '✓',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800',
  },
};

export default function TrackOrderPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { tenant } = useTenantStore();

  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [wsConnected, setWsConnected] = useState(false);

  // Check notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    }
    return false;
  }, []);

  // Show notification when order is ready
  const showReadyNotification = useCallback(() => {
    if (notificationPermission === 'granted' && order) {
      new Notification(`Order ${order.orderNumber} is Ready!`, {
        body: 'Your order is ready for pickup.',
        icon: '/logo.png',
        tag: `order-${order.orderNumber}`,
      });
    }
  }, [notificationPermission, order]);

  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderNumber) {
        setError('No order number provided');
        setIsLoading(false);
        return;
      }

      try {
        // For now, create a mock order - in production, this would fetch from API
        // with token validation
        setOrder({
          orderNumber,
          status: 'preparing',
          items: [
            { name: 'Loading...', quantity: 1, status: 'pending' },
          ],
          createdAt: new Date().toISOString(),
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch order:', err);
        setError('Unable to load order. Please check your link.');
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderNumber, token]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!orderNumber || !tenant?.tenantId) return;

    const wsUrl = import.meta.env.VITE_ORDERS_WS_URL || 'wss://handsfree-orders.suyesh.workers.dev';
    const ws = new WebSocket(`${wsUrl}/ws/orders/${tenant.tenantId}?device=customer&orderId=${orderNumber}`);

    ws.onopen = () => {
      console.log('[TrackOrderPage] WebSocket connected');
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[TrackOrderPage] Message received:', data.type);

        // Handle order status updates
        if (data.type === 'order_status_update' && data.orderNumber === orderNumber) {
          setOrder(prev => {
            if (!prev) return prev;
            const newStatus = data.status as OrderTrackingStatus;

            // Show notification if order becomes ready
            if (newStatus === 'ready' && prev.status !== 'ready') {
              showReadyNotification();
            }

            return { ...prev, status: newStatus };
          });
        }

        // Handle item ready updates
        if (data.type === 'item_ready' && data.orderNumber === orderNumber) {
          setOrder(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              items: prev.items.map(item =>
                item.name === data.itemName
                  ? { ...item, status: 'ready' as const }
                  : item
              ),
            };
          });
        }
      } catch (err) {
        console.error('[TrackOrderPage] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[TrackOrderPage] WebSocket disconnected');
      setWsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('[TrackOrderPage] WebSocket error:', err);
    };

    return () => {
      ws.close();
    };
  }, [orderNumber, tenant?.tenantId, showReadyNotification]);

  // Show notification when status changes to ready
  useEffect(() => {
    if (order?.status === 'ready') {
      showReadyNotification();
    }
  }, [order?.status, showReadyNotification]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <div className="text-white text-xl mb-2">Order Not Found</div>
          <div className="text-slate-400">{error || 'Please check your order link'}</div>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 p-4 text-center border-b border-slate-700">
        <h1 className="text-white font-bold text-lg">
          {tenant?.companyName || 'Restaurant'}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Order number */}
        <div className="text-slate-400 text-sm mb-2">ORDER</div>
        <div className="text-white text-4xl font-bold mb-8">{order.orderNumber}</div>

        {/* Status badge */}
        <div
          className={`
            ${statusConfig.bgColor} ${statusConfig.color}
            rounded-2xl px-8 py-6 text-center
            ${statusConfig.animate ? 'animate-pulse' : ''}
            shadow-lg mb-8
          `}
        >
          <div className="text-5xl mb-2">{statusConfig.icon}</div>
          <div className="text-2xl font-bold">{statusConfig.label}</div>
        </div>

        {/* Items list */}
        <div className="w-full max-w-sm bg-slate-800 rounded-xl p-4 mb-6">
          <h3 className="text-slate-400 text-sm mb-3">YOUR ORDER</h3>
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-white"
              >
                <span>
                  {item.quantity}x {item.name}
                </span>
                {item.status === 'ready' && (
                  <span className="text-green-400 text-xs">Ready</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notification prompt */}
        {notificationPermission === 'default' && (
          <button
            onClick={requestNotificationPermission}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-colors"
          >
            Enable Notifications
          </button>
        )}

        {notificationPermission === 'granted' && (
          <div className="text-green-400 text-sm flex items-center gap-2">
            <span>🔔</span>
            <span>We&apos;ll notify you when ready!</span>
          </div>
        )}

        {/* Connection indicator */}
        <div className={`mt-4 text-xs ${wsConnected ? 'text-green-400' : 'text-slate-500'}`}>
          {wsConnected ? '● Live updates' : '○ Connecting...'}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-800 p-4 text-center border-t border-slate-700">
        <div className="text-slate-500 text-xs">
          Keep this page open to receive updates
        </div>
      </div>
    </div>
  );
}

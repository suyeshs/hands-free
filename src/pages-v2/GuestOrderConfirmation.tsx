/**
 * Guest Order Confirmation Page
 * Shows order success with order number and options to add more items
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Plus, Bell, Clock, Loader2 } from 'lucide-react';
import { getGuestOrderStatus } from '../lib/guestOrderApi';
import { CallWaiterButton } from '../components/guest/CallWaiterButton';

interface OrderStatus {
  status: string;
  orderNumber: string;
  estimatedTime?: number;
  items: Array<{ name: string; quantity: number; status: string }>;
}

export default function GuestOrderConfirmation() {
  const { tableId, orderId } = useParams<{ tableId: string; orderId: string }>();
  const navigate = useNavigate();

  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch order status on mount and poll for updates
  useEffect(() => {
    if (!orderId || !tableId) return;

    const fetchStatus = async () => {
      try {
        const status = await getGuestOrderStatus('default', orderId);
        setOrderStatus(status);
        setError(null);
      } catch (err) {
        console.error('[GuestOrderConfirmation] Failed to fetch status:', err);
        // Don't show error on initial load if we just placed the order
        if (orderStatus) {
          setError('Failed to update order status');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [orderId, tableId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'preparing':
        return 'text-yellow-600 bg-yellow-50';
      case 'ready':
        return 'text-green-600 bg-green-50';
      case 'served':
      case 'completed':
        return 'text-blue-600 bg-blue-50';
      case 'cancelled':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Order Received';
      case 'confirmed':
        return 'Order Confirmed';
      case 'preparing':
        return 'Being Prepared';
      case 'ready':
        return 'Ready to Serve';
      case 'served':
        return 'Served';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success header */}
      <div className="bg-green-500 text-white px-4 py-8 text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
        {orderStatus && (
          <p className="text-green-100">
            Order #{orderStatus.orderNumber}
          </p>
        )}
      </div>

      {/* Order status */}
      <div className="p-4 space-y-4">
        {/* Status card */}
        {orderStatus && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Order Status</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  orderStatus.status
                )}`}
              >
                {getStatusText(orderStatus.status)}
              </span>
            </div>

            {/* Estimated time */}
            {orderStatus.estimatedTime && (
              <div className="flex items-center gap-2 text-gray-600 mb-4">
                <Clock className="w-5 h-5" />
                <span>Estimated time: {orderStatus.estimatedTime} mins</span>
              </div>
            )}

            {/* Items */}
            <div className="border-t border-gray-200 pt-4 space-y-2">
              {orderStatus.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {item.name} x {item.quantity}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${getStatusColor(
                      item.status
                    )}`}
                  >
                    {getStatusText(item.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {/* Add more items */}
          <button
            onClick={() => navigate(`/table/${tableId}`)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add More Items
          </button>

          {/* Request bill */}
          <button
            onClick={() => {
              // This will trigger service request for bill
              // Handled by CallWaiterButton with different type
            }}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            <Bell className="w-5 h-5" />
            Request Bill
          </button>
        </div>

        {/* Previous orders in session */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-2">Your Session</h3>
          <p className="text-sm text-gray-500">
            You can add more items to your order by scanning the QR code again
            or tapping "Add More Items" above.
          </p>
        </div>
      </div>

      {/* Call waiter button */}
      {tableId && (
        <CallWaiterButton
          tenantId="default"
          tableId={tableId}
        />
      )}
    </div>
  );
}

'use client';

import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MapPin, Clock, CreditCard, Truck, Phone, XCircle, ChefHat, Package, Bike, Smartphone, Receipt, Loader2, Bell, Plus } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { cartStore } from '../../stores/cartStore';
import { RESTAURANT_WORKER_URL } from '../../config/api';
import { getTenantId } from '../../lib/restaurant-config-loader';
import ServiceRequestModal from '../ServiceRequestModal';

declare global {
  interface Window { Razorpay: any; }
}

const TENANT_ROUTER_WS_URL = 'wss://handsfree-tenant-router.suyesh.workers.dev';
const TENANT_ROUTER_URL = 'https://handsfree-tenant-router.suyesh.workers.dev';

interface OrderConfirmationProps {
  onNewOrder?: () => void;
}

type LiveStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled';

const TERMINAL_STATUSES: LiveStatus[] = ['delivered', 'completed', 'cancelled'];

const STATUS_STEPS: { status: LiveStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending',   label: 'Order Received',  icon: <Clock className="w-5 h-5" /> },
  { status: 'confirmed', label: 'Confirmed',        icon: <CheckCircle2 className="w-5 h-5" /> },
  { status: 'preparing', label: 'Being Prepared',   icon: <ChefHat className="w-5 h-5" /> },
  { status: 'ready',     label: 'Ready',            icon: <Package className="w-5 h-5" /> },
];

const DELIVERY_STEPS: { status: LiveStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending',          label: 'Order Received', icon: <Clock className="w-5 h-5" /> },
  { status: 'confirmed',        label: 'Confirmed',      icon: <CheckCircle2 className="w-5 h-5" /> },
  { status: 'preparing',        label: 'Being Prepared', icon: <ChefHat className="w-5 h-5" /> },
  { status: 'out_for_delivery', label: 'On the Way',     icon: <Bike className="w-5 h-5" /> },
  { status: 'delivered',        label: 'Delivered',      icon: <CheckCircle2 className="w-5 h-5" /> },
];

const STATUS_ORDER: LiveStatus[] = [
  'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed',
];

function getStepIndex(status: LiveStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export const OrderConfirmation = observer(function OrderConfirmation({
  onNewOrder
}: OrderConfirmationProps) {
  const order = orderStore.currentOrder;
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('pending');
  const [cancelled, setCancelled] = useState(false);
  const [showCallWaiter, setShowCallWaiter] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Bill request state (for dine-in orders)
  type BillRequestStatus = 'idle' | 'choosing' | 'sent' | 'approved';
  const [billStatus, setBillStatus] = useState<BillRequestStatus>('idle');
  const [billPaymentMethod, setBillPaymentMethod] = useState<'online' | 'card' | null>(null);
  const [approvedBill, setApprovedBill] = useState<{
    total?: number;
    subtotal?: number;
    items?: Array<{ name: string; quantity: number; price: number }>;
  } | null>(null);
  const billPollRef = useRef<ReturnType<typeof setInterval>>();

  // Razorpay payment state (for bill online payment)
  const [paymentState, setPaymentState] = useState<'idle' | 'loading' | 'processing' | 'paid' | 'error'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const openRazorpayModal = async () => {
    if (!order?.orderId) return;
    setPaymentState('loading');
    setPaymentError(null);
    try {
      // Load Razorpay script if not already present
      await new Promise<void>((resolve, reject) => {
        if (window.Razorpay) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load payment gateway'));
        document.body.appendChild(script);
      });

      // Create Razorpay order on server
      const tenantId = getTenantId();
      const resp = await fetch(`${RESTAURANT_WORKER_URL}/api/orders/${order.orderId}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
      });
      const data = await resp.json() as { success?: boolean; razorpayOrder?: any; error?: string };
      if (!resp.ok || !data.razorpayOrder) {
        throw new Error(data.error || 'Failed to create payment');
      }
      const rzp = data.razorpayOrder;

      setPaymentState('processing');

      const options = {
        key: rzp.keyId,
        amount: rzp.amount,
        currency: rzp.currency || 'INR',
        order_id: rzp.id,
        name: rzp.restaurantName || 'Restaurant',
        description: 'Table Bill Payment',
        image: rzp.restaurantLogo || undefined,
        prefill: {
          name: orderStore.customer?.name || 'Guest',
          contact: orderStore.customer?.phone || '',
        },
        theme: { color: '#f97316' },
        handler: async (response: any) => {
          try {
            const verifyResp = await fetch(
              `${RESTAURANT_WORKER_URL}/api/orders/${order.orderId}/verify-payment`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': tenantId },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              }
            );
            const verifyData = await verifyResp.json() as { verified?: boolean; error?: string };
            if (!verifyData.verified) throw new Error(verifyData.error || 'Verification failed');
            setPaymentState('paid');
          } catch (err: any) {
            setPaymentError(err.message || 'Payment verification failed');
            setPaymentState('error');
          }
        },
        modal: {
          ondismiss: () => setPaymentState('idle'),
        },
      };
      new window.Razorpay(options).open();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to open payment');
      setPaymentState('error');
    }
  };

  const sendBillRequest = async (paymentMethod: 'online' | 'card') => {
    if (!order?.orderId) return;
    const tenantId = getTenantId();
    setBillPaymentMethod(paymentMethod);
    setBillStatus('sent');
    cartStore.lock();
    try {
      const resp = await fetch(`${TENANT_ROUTER_URL}/api/bill-requests/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          tableId: cartStore.tableId || '',
          paymentMethod,
          total: order.total,
          subtotal: order.subtotal,
          items: order.items.map((i: any) => ({
            name: i.dishName || i.name,
            quantity: i.quantity,
            price: i.price,
          })),
        }),
      });
      await resp.json();
    } catch (err) {
      console.error('[OrderConfirmation] Bill request failed:', err);
    }
  };

  // Poll for bill approval
  useEffect(() => {
    if (billStatus !== 'sent' || !order?.orderId) return;
    const tenantId = getTenantId();
    const poll = async () => {
      try {
        const resp = await fetch(`${TENANT_ROUTER_URL}/api/bill-status/${tenantId}/${order.orderId}`);
        const data = await resp.json() as { status: string; billRequest?: any };
        if (data.status === 'approved') {
          setApprovedBill({
            total: data.billRequest?.total,
            subtotal: data.billRequest?.subtotal,
            items: data.billRequest?.items,
          });
          setBillStatus('approved');
          clearInterval(billPollRef.current);
        }
      } catch { /* ignore */ }
    };
    billPollRef.current = setInterval(poll, 3000);
    return () => clearInterval(billPollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billStatus, order?.orderId]);

  const applyStatus = (s: LiveStatus) => {
    setLiveStatus(s);
    if (s === 'cancelled') setCancelled(true);
    if (TERMINAL_STATUSES.includes(s)) {
      clearInterval(intervalRef.current);
      // Persist the terminal status so restorePersistedOrder() discards this
      // order on the next page load instead of re-showing the confirmation screen.
      if (order) orderStore.setCurrentOrder({ ...order, status: s });
    }
  };

  // WebSocket: real-time status push from the DO when the POS broadcasts a change
  useEffect(() => {
    if (!order?.orderId) return;
    const tenantId = getTenantId();
    if (!tenantId) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(`${TENANT_ROUTER_WS_URL}/ws/orders/${tenantId}?device=customer`);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'order_status_update' && msg.orderId === order.orderId) {
            applyStatus(msg.status as LiveStatus);
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      stopped = true;
      ws?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.orderId]);

  // Polling: fallback for when the WebSocket misses a push (e.g. reconnect gap)
  useEffect(() => {
    if (!order?.orderId) return;
    const tenantId = getTenantId();

    const poll = async () => {
      try {
        const res = await fetch(
          `${RESTAURANT_WORKER_URL}/api/orders/${order.orderId}?tenantId=${tenantId}`
        );
        if (!res.ok) return;
        const data = await res.json() as { success: boolean; order?: { status: string } };
        if (data.success && data.order?.status) {
          applyStatus(data.order.status as LiveStatus);
        }
      } catch {
        // silently ignore network errors during polling
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 10000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.orderId]);

  if (!order) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-gray-500">No order information available</p>
      </div>
    );
  }

  const handleNewOrder = () => {
    cartStore.clearCart();
    orderStore.resetOrder();
    if (onNewOrder) onNewOrder();
  };

  const isDelivery = order.orderType === 'delivery';
  const isDineIn = order.orderType === 'dine-in' || (order.orderType as string) === 'dine_in';
  const steps = isDelivery ? DELIVERY_STEPS : STATUS_STEPS;
  const currentIdx = getStepIndex(liveStatus);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl overflow-y-auto">
      <div className="flex-1 p-6 space-y-6">

        {/* Header icon */}
        <div className="text-center py-6">
          <div className="relative inline-block">
            {!cancelled && <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75" />}
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-lg bg-gradient-to-br ${
              cancelled ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600'
            }`}>
              {cancelled
                ? <XCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                : <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
              }
            </div>
          </div>
          <h2 className="text-3xl font-light neu-text mt-6 mb-1">
            {cancelled ? 'Order Cancelled' : 'Order Placed!'}
          </h2>
          <p className="text-gray-500 text-sm font-mono">#{order.orderId.slice(-8).toUpperCase()}</p>
        </div>

        {/* Live status — single field that updates as the status changes */}
        {!cancelled && (() => {
          const isDone = liveStatus === 'ready' || TERMINAL_STATUSES.includes(liveStatus);
          const current = steps.find(s => s.status === liveStatus)
            ?? steps[Math.min(Math.max(currentIdx, 0), steps.length - 1)]
            ?? steps[0];
          return (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-gray-100/50 shadow-sm flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-md transition-colors ${isDone ? 'bg-green-500' : 'bg-orange-500'}`}>
                {current.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">Order Status</p>
                <p className="text-base font-semibold text-gray-900">{current.label}</p>
              </div>
              {!isDone && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                </span>
              )}
            </div>
          );
        })()}

        {/* Cancelled message */}
        {cancelled && (
          <div className="bg-red-50 rounded-2xl p-5 border border-red-200/50 text-center">
            <p className="text-red-700 font-medium mb-1">Your order was not accepted</p>
            <p className="text-sm text-red-500">Please contact the restaurant or place a new order</p>
          </div>
        )}

        {/* Delivery address */}
        {isDelivery && order.deliveryAddress && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Delivery Address
            </h3>
            {order.deliveryAddress.apartment && (
              <p className="text-sm font-medium text-gray-800">{order.deliveryAddress.apartment}</p>
            )}
            <p className="text-sm text-gray-700 leading-relaxed">{order.deliveryAddress.formatted}</p>
          </div>
        )}

        {/* Payment */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {isDineIn ? 'Bill' : 'Payment'}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {isDineIn ? 'Pay at Table when done' : order.paymentMethod === 'online' ? 'Paid Online' : `Cash on ${order.orderType === 'delivery' ? 'Delivery' : 'Pickup'}`}
            </span>
            <span className="text-lg font-bold text-gray-900">₹{order.total.toFixed(2)}</span>
          </div>
          {order.paymentMethod === 'online' && !isDineIn && (
            <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
              ✓ Payment Successful
            </div>
          )}
          {isDineIn && billStatus === 'idle' && (
            <button
              onClick={() => setBillStatus('choosing')}
              className="mt-3 w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl shadow hover:shadow-md transition-all text-sm flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              Request Bill
            </button>
          )}

          {isDineIn && billStatus === 'choosing' && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-3">How would you like to pay?</p>
              <button
                onClick={() => sendBillRequest('online')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 transition-all text-left"
              >
                <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Pay Online</p>
                  <p className="text-xs text-gray-500">Scan & pay via Razorpay</p>
                </div>
              </button>
              <button
                onClick={() => sendBillRequest('card')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:border-amber-400 transition-all text-left"
              >
                <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Card Machine</p>
                  <p className="text-xs text-gray-500">Pay via POS card machine</p>
                </div>
              </button>
              <button
                onClick={() => setBillStatus('idle')}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {isDineIn && billStatus === 'sent' && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-semibold text-amber-800 animate-pulse">
                ⏳ Waiting for staff to approve your bill…
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {billPaymentMethod === 'card' ? 'Card machine coming to your table' : 'Online payment link coming soon'}
              </p>
            </div>
          )}

          {isDineIn && billStatus === 'approved' && (
            <div className="mt-3 space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-green-800">✓ Bill Approved!</p>
              </div>
              {approvedBill?.items && approvedBill.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  {approvedBill.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.quantity}× {item.name}</span>
                      <span className="text-gray-900 font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-orange-600">₹{(approvedBill.total ?? order.total).toFixed(2)}</span>
                  </div>
                </div>
              )}
              {billPaymentMethod === 'card' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <CreditCard className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-amber-800">Card machine on its way!</p>
                  <p className="text-xs text-amber-600 mt-1">A staff member will be with you shortly</p>
                </div>
              ) : paymentState === 'paid' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-green-800">Payment Successful!</p>
                  <p className="text-xs text-green-600 mt-1">Thank you, enjoy your meal!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentError && (
                    <p className="text-xs text-red-600 text-center">{paymentError}</p>
                  )}
                  <button
                    onClick={openRazorpayModal}
                    disabled={paymentState === 'loading' || paymentState === 'processing'}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow"
                  >
                    {paymentState === 'loading' || paymentState === 'processing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {paymentState === 'loading' ? 'Loading…' : 'Processing…'}
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        Pay ₹{(approvedBill?.total ?? order.total).toFixed(2)} Online
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    UPI · Cards · Net Banking · Wallets via Razorpay
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order items summary */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50">
          <h3 className="font-medium text-gray-900 mb-3">
            Order Summary ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
          </h3>
          <div className="space-y-2">
            {order.items.slice(0, 3).map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.quantity}x {item.dishName || item.name}</span>
                <span className="text-gray-900 font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-sm text-gray-500 italic">+{order.items.length - 3} more items</p>
            )}
            <div className="pt-3 border-t border-gray-200 flex justify-between font-semibold">
              <span className="text-gray-900">Total</span>
              <span className="text-orange-600">₹{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Help */}
        <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-200/50">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Need Help?</h4>
              <p className="text-sm text-blue-700">Contact us if you have any questions about your order</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-gray-200/50">
        {isDineIn ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleNewOrder}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3.5 rounded-xl shadow hover:shadow-md transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Items
              </button>
              <button
                onClick={() => setShowCallWaiter(true)}
                className="flex items-center justify-center gap-2 border-2 border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold py-3.5 rounded-xl transition-all text-sm"
              >
                <Bell className="w-4 h-4" />
                Call Waiter
              </button>
            </div>
            <p className="text-center text-xs text-gray-400">
              Enjoy your meal! Ask staff if you need anything.
            </p>
          </div>
        ) : (
          <button
            onClick={handleNewOrder}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Place New Order
          </button>
        )}
      </div>

      {/* Call waiter modal */}
      {cartStore.tableId && (
        <ServiceRequestModal
          isOpen={showCallWaiter}
          onClose={() => setShowCallWaiter(false)}
          tableId={cartStore.tableId}
          tenantId={getTenantId()}
        />
      )}
    </div>
  );
});

'use client';

import { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { cartStore } from '../../stores/cartStore';
import { RESTAURANT_WORKER_URL } from '../../config/api';
import { getTenantId } from '../../lib/restaurant-config-loader';
import { CustomerInfo } from './CustomerInfo';
import { OrderTypeSelection } from './OrderTypeSelection';
import { AddressEntry } from './AddressEntry';
import { CheckoutSummary } from './CheckoutSummary';
import { Payment } from './Payment';
import { OrderConfirmation } from './OrderConfirmation';

interface SavedAddress {
  formatted: string;
  placeId: string | null;
  coordinates?: { lat: number; lng: number };
  apartment?: string;
  landmark?: string;
  instructions?: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
}

function getLabelIcon(label: string): string {
  switch (label) {
    case 'home': return '🏠';
    case 'work': return '💼';
    default: return '📍';
  }
}

const TENANT_ROUTER_URL = 'https://handsfree-tenant-router.suyesh.workers.dev';

const getRestaurantWorkerUrl = () => RESTAURANT_WORKER_URL;

// OTP Verification toggle (disable to skip PIN entry flow)
const ENABLE_OTP_VERIFICATION = process.env.NEXT_PUBLIC_ENABLE_OTP_VERIFICATION === 'true';

interface OrderFlowProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  backendUrl: string;
  tenantId?: string;
}

export const OrderFlow = observer(function OrderFlow({
  isOpen,
  onClose,
  sessionId,
  backendUrl,
  tenantId
}: OrderFlowProps) {
  const [currentStep, setCurrentStep] = useState<'customer' | 'order-type' | 'address-confirm' | 'address' | 'checkout' | 'submitting' | 'payment' | 'confirmation'>('customer');
  const tableAutoSubmitRef = useRef(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const addressesLoadingRef = useRef(false);

  // Determine if this is a voice session (sessionId provided) or manual order
  const isVoiceSession = !!sessionId;

  // For manual orders, use a simple local ID (no backend session needed)
  const activeSessionId = sessionId || `manual-${Date.now()}`;

  // Detect table context - if tableId exists, this is a table order (dine-in)
  const tableId = cartStore.tableId;
  const isTableOrder = !!tableId;

  // Reset flow when opened
  useEffect(() => {
    if (isOpen) {
      // Order already placed (e.g. restored from localStorage after a page refresh)
      if (orderStore.currentOrder) {
        setCurrentStep('confirmation');
        return;
      }
      if (isTableOrder) {
        // Table orders: always dine-in, pay at table, no customer info step.
        // The cart drawer already serves as the review, so place the order
        // directly ("Send to Kitchen") instead of showing a second checkout screen.
        orderStore.setOrderType('dine-in');
        orderStore.setPaymentMethod('cash');
        if (!orderStore.customer) {
          orderStore.setCustomer({ name: 'Guest', phone: '' });
        }
        setCurrentStep('submitting');
      } else if (!orderStore.customer) {
        setCurrentStep('customer');
      } else if (!orderStore.orderType || orderStore.orderType === 'delivery') {
        setCurrentStep('order-type');
      } else {
        setCurrentStep('checkout');
      }
    }
  }, [isOpen, isTableOrder]);

  // Reset the auto-submit guard whenever the flow closes
  useEffect(() => {
    if (!isOpen) tableAutoSubmitRef.current = false;
  }, [isOpen]);

  // Auto-place table orders once we enter the submitting step (fires exactly once)
  useEffect(() => {
    if (currentStep === 'submitting' && !tableAutoSubmitRef.current) {
      tableAutoSubmitRef.current = true;
      handleCheckoutConfirm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  if (!isOpen) return null;

  const handleCustomerInfoComplete = () => {
    if (isTableOrder) {
      setCurrentStep('checkout');
      return;
    }

    setCurrentStep('order-type');

    // Pre-fetch saved addresses for returning customers — must complete before order-type step
    const customerPhone = orderStore.customer?.phone;
    const customerId = orderStore.customer?.id;
    if (customerId && customerPhone) {
      const effectiveTenantId = tenantId || getTenantId();
      const encodedPhone = encodeURIComponent(customerPhone);
      setAddressesLoading(true);
      addressesLoadingRef.current = true;
      fetch(`${getRestaurantWorkerUrl()}/api/customers/phone/${encodedPhone}/addresses?tenantId=${effectiveTenantId}`)
        .then(r => r.json())
        .then((data: any) => {
          if (data.success && data.addresses?.length > 0) {
            setSavedAddresses(data.addresses.map((addr: any) => ({
              formatted: addr.formatted,
              placeId: addr.placeId || null,
              coordinates: addr.coordinates,
              apartment: addr.apartment,
              landmark: addr.landmark,
              instructions: addr.instructions,
              label: addr.label || 'other',
              isDefault: addr.isDefault || false,
            })));
          }
        })
        .catch(err => console.error('[OrderFlow] Failed to pre-fetch addresses:', err))
        .finally(() => {
          setAddressesLoading(false);
          addressesLoadingRef.current = false;
        });
    }
  };

  const handleOrderTypeSelected = async () => {
    if (orderStore.orderType === 'delivery') {
      // If address fetch is still in flight, wait up to 2s for it to finish
      if (addressesLoadingRef.current) {
        await new Promise<void>(resolve => {
          const interval = setInterval(() => {
            if (!addressesLoadingRef.current) { clearInterval(interval); resolve(); }
          }, 50);
          setTimeout(() => { clearInterval(interval); resolve(); }, 2000);
        });
      }
      setCurrentStep(savedAddresses.length > 0 ? 'address-confirm' : 'address');
    } else {
      setCurrentStep('checkout');
    }
  };

  const handleAddressConfirmDeliverHere = (address: SavedAddress) => {
    orderStore.setDeliveryAddress({
      formatted: address.formatted,
      coordinates: address.coordinates!,
      placeId: address.placeId || undefined,
      apartment: address.apartment,
      landmark: address.landmark,
      instructions: address.instructions,
    });
    orderStore.setDeliveryFee(0);
    orderStore.setEstimatedDeliveryTime('30–45 min');
    setCurrentStep('checkout');
  };

  const handleAddressVerified = async () => {
    // Auto-save address to Restaurant Worker for future quick access
    // Uses simplified schema: placeId + coordinates + formatted
    const customerPhone = orderStore.customer?.phone;
    const address = orderStore.deliveryAddress;

    if (customerPhone && address && address.placeId && address.coordinates) {
      try {
        const effectiveTenantId = tenantId || getTenantId();
        const encodedPhone = encodeURIComponent(customerPhone);

        await fetch(`${getRestaurantWorkerUrl()}/api/customers/phone/${encodedPhone}/addresses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': effectiveTenantId,
          },
          body: JSON.stringify({
            // Simplified schema - required fields
            placeId: address.placeId,
            coordinates: address.coordinates,
            formatted: address.formatted,
            // Optional user-provided fields
            apartment: address.apartment || undefined,
            instructions: address.instructions || undefined,
            label: 'home', // Default label for addresses saved during checkout
            isDefault: true, // Make first delivery address the default
          }),
        });
        console.log('[OrderFlow] Address saved to customer profile');
      } catch (err) {
        // Non-blocking - don't fail checkout if address save fails
        console.error('[OrderFlow] Failed to save address:', err);
      }
    }

    setCurrentStep('checkout');
  };

  const handleCheckoutConfirm = async () => {
    try {
      orderStore.setProcessing(true);

      const effectiveTenantId = tenantId || getTenantId();
      const subtotal = cartStore.total;
      let data: any;

      if (isTableOrder) {
        // QR table orders go to the tenant router's dedicated QR endpoint so they are
        // broadcast as qr_order_created (→ KDS / dine-in table) NOT as web orders.
        const qrPayload = {
          tableId,
          sessionToken: (cartStore as any).sessionToken || null,
          sessionExpires: (cartStore as any).sessionExpires || null,
          sessionSig: (cartStore as any).sessionSig || null,
          guestName: orderStore.customer?.name || 'Guest',
          paymentMethod: 'cash',
          specialInstructions: orderStore.specialInstructions || null,
          items: cartStore.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            modifiers: item.customization ? [{ name: item.customization, priceAdjustment: 0 }] : [],
            specialInstructions: null,
          })),
        };

        const response = await fetch(`${TENANT_ROUTER_URL}/api/qr-orders/${effectiveTenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(qrPayload),
        });

        data = await response.json() as any;
        if (response.status === 403) {
          throw new Error(data.error || 'Session expired. Please scan the QR code again to continue ordering.');
        }
        if (!response.ok) throw new Error(data.error || 'Failed to create table order');
      } else {
        // Website orders (delivery/pickup) go through the restaurant worker
        const orderPayload = {
          orderType: orderStore.orderType || 'pickup',
          items: cartStore.items.map((item: any, index: number) => ({
            menuItemId: item.id || `menu-item-${index}-${Date.now()}`,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            itemTotal: item.quantity * item.price,
            modifiers: item.customization || null,
            isVegetarian: item.isVeg || false,
            isVegan: item.isVegan || false,
            category: item.category || null,
          })),
          subtotal,
          tax: 0,
          total: subtotal + (orderStore.orderType === 'delivery' ? orderStore.deliveryFee : 0),
          customer: {
            phone: orderStore.customer?.phone || '',
            name: orderStore.customer?.name || 'Guest',
            email: orderStore.customer?.email || undefined,
          },
          paymentMethod: orderStore.paymentMethod || 'cash',
          deliveryAddress: orderStore.deliveryAddress ? {
            addressLine1: orderStore.deliveryAddress.formatted,
            addressLine2: orderStore.deliveryAddress.apartment || undefined,
            city: orderStore.deliveryAddress.city || undefined,
            postalCode: orderStore.deliveryAddress.pincode || undefined,
            instructions: orderStore.deliveryAddress.instructions || undefined,
          } : undefined,
          notes: orderStore.specialInstructions || null,
          source: 'web',
        };

        const response = await fetch(`${getRestaurantWorkerUrl()}/api/orders?tenantId=${effectiveTenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });

        data = await response.json() as any;
        if (!response.ok) throw new Error(data.error || data.message || 'Failed to create order');
      }

      // Store order data for the confirmation screen
      const total = isTableOrder ? (data.total || subtotal) : (subtotal + (orderStore.orderType === 'delivery' ? orderStore.deliveryFee : 0));
      orderStore.setCurrentOrder({
        orderId: data.orderId,
        customer: orderStore.customer || { name: 'Guest', phone: '' },
        items: cartStore.items,
        subtotal,
        deliveryFee: isTableOrder ? 0 : (orderStore.orderType === 'delivery' ? orderStore.deliveryFee : 0),
        tax: 0,
        total,
        orderType: isTableOrder ? 'dine-in' : ((orderStore.orderType as 'delivery' | 'pickup' | 'dine-in') || 'pickup'),
        paymentMethod: (orderStore.paymentMethod as 'online' | 'cash') || 'cash',
        deliveryAddress: orderStore.deliveryAddress || undefined,
        specialInstructions: orderStore.specialInstructions,
        status: 'pending',
        createdAt: Date.now(),
      });

      // Move to payment step only for non-table online payments
      if (!isTableOrder && orderStore.paymentMethod === 'online' && data.razorpayOrder) {
        orderStore.setRazorpayOrder(data.razorpayOrder);
        setCurrentStep('payment');
      } else {
        cartStore.clearCart();
        // Lock the cart for dine-in sessions so the user can't place
        // additional orders within the same QR session.
        if (isTableOrder) cartStore.lock();
        setCurrentStep('confirmation');
      }
    } catch (error) {
      console.error('[OrderFlow] Order creation failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to create order');
      // Table orders auto-submit with no checkout screen to fall back to —
      // close the flow so the customer returns to their (still-populated) cart to retry.
      if (isTableOrder) onClose();
    } finally {
      orderStore.setProcessing(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Clear cart after successful payment
    cartStore.clearCart();
    setCurrentStep('confirmation');
  };

  const handlePaymentError = (error: any) => {
    console.error('[OrderFlow] Payment error:', error);
    alert('Payment failed. Please try again.');
  };

  const handleNewOrder = () => {
    cartStore.clearCart();
    orderStore.resetOrder();
    setCurrentStep('customer');
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'order-type') {
      setCurrentStep('customer');
    } else if (currentStep === 'address-confirm') {
      setCurrentStep('order-type');
    } else if (currentStep === 'address') {
      if (savedAddresses.length > 0) {
        orderStore.clearAddress();
        setCurrentStep('address-confirm');
      } else {
        setCurrentStep('order-type');
      }
    } else if (currentStep === 'checkout') {
      if (orderStore.orderType === 'delivery') {
        setCurrentStep('address');
      } else {
        setCurrentStep('order-type');
      }
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'customer':
        return (
          <CustomerInfo
            onComplete={handleCustomerInfoComplete}
            backendUrl={backendUrl}
            sessionId={activeSessionId}
            isVoiceSession={isVoiceSession}
            tenantId={tenantId || 'khao-piyo-7766'}
            enableOTPVerification={ENABLE_OTP_VERIFICATION}
            isTableOrder={isTableOrder}
            tableId={tableId || undefined}
          />
        );

      case 'order-type':
        return (
          <OrderTypeSelection
            onContinue={handleOrderTypeSelected}
            onBack={handleBack}
          />
        );

      case 'address-confirm': {
        const defaultAddress = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
        return (
          <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
            <div className="p-6 pb-4">
              <h2 className="text-2xl font-light neu-text tracking-tight">Delivery Address</h2>
              <p className="text-sm neu-text-secondary opacity-60 mt-1">
                Deliver to your saved address?
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
              {defaultAddress && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-gray-200/50 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{getLabelIcon(defaultAddress.label)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize mb-1">{defaultAddress.label}</p>
                      {defaultAddress.apartment && (
                        <p className="text-sm text-gray-600">{defaultAddress.apartment}</p>
                      )}
                      <p className="text-sm text-gray-600 break-words">{defaultAddress.formatted}</p>
                      {defaultAddress.instructions && (
                        <p className="text-xs text-gray-400 mt-1">{defaultAddress.instructions}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => defaultAddress && handleAddressConfirmDeliverHere(defaultAddress)}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Deliver here
              </button>

              <button
                onClick={() => setCurrentStep('address')}
                className="w-full border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium py-4 rounded-xl transition-all"
              >
                Use a different address
              </button>
            </div>
            <div className="p-6 border-t border-gray-200/50">
              <button
                onClick={handleBack}
                className="w-full text-gray-600 hover:text-gray-900 py-2 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        );
      }

      case 'address':
        return (
          <div className="h-full flex flex-col bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
            <div className="p-6 pb-4">
              <h2 className="text-2xl font-light neu-text tracking-tight">Delivery Address</h2>
              <p className="text-sm neu-text-secondary opacity-60 mt-1">
                Where should we deliver your order?
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6">
              <AddressEntry
                sessionId={activeSessionId}
                backendUrl={backendUrl}
                onAddressVerified={handleAddressVerified}
                isVoiceSession={isVoiceSession}
                preloadedAddresses={savedAddresses.length > 0 ? savedAddresses : undefined}
              />
            </div>
            <div className="p-6 border-t border-gray-200/50">
              <button
                onClick={handleBack}
                className="w-full text-gray-600 hover:text-gray-900 py-2 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        );

      case 'checkout':
        return (
          <CheckoutSummary
            onConfirm={handleCheckoutConfirm}
            onBack={isTableOrder ? undefined : handleBack}
            isTableOrder={isTableOrder}
          />
        );

      case 'submitting':
        return (
          <div className="h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-white/95 to-gray-50/95 backdrop-blur-xl">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 font-medium">Sending your order to the kitchen…</p>
          </div>
        );

      case 'payment':
        return (
          <Payment
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
          />
        );

      case 'confirmation':
        return (
          <OrderConfirmation
            onNewOrder={handleNewOrder}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex" onClick={onClose}>
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" />

      {/* Slide-in Panel */}
      <div
        className="ml-auto relative w-full max-w-md h-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close Button - Hidden on confirmation and while the order is being placed */}
        {currentStep !== 'confirmation' && currentStep !== 'submitting' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm hover:bg-white/80 flex items-center justify-center transition-all shadow-lg"
            aria-label="Close order flow"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        )}

        {renderStep()}
      </div>
    </div>
  );
});

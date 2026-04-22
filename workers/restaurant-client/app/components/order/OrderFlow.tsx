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

// Orders Worker URL for direct order creation
const ORDERS_WORKER_URL = process.env.NEXT_PUBLIC_ORDERS_WORKER_URL || 'https://handsfree-orders.suyesh.workers.dev';

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
  const [currentStep, setCurrentStep] = useState<'customer' | 'order-type' | 'address-confirm' | 'address' | 'checkout' | 'payment' | 'confirmation'>('customer');
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
      // Auto-set order type and payment method for table orders
      if (isTableOrder) {
        if (!orderStore.orderType) {
          orderStore.setOrderType('dine-in');
        }
        // Default to pay-at-table for table orders (users can still change if needed)
        if (!orderStore.paymentMethod) {
          orderStore.setPaymentMethod('cash');
        }
      }

      // Determine starting step based on what info we already have
      if (!orderStore.customer) {
        setCurrentStep('customer');
      } else if (isTableOrder) {
        // Table orders skip order-type selection, go directly to checkout
        setCurrentStep('checkout');
      } else if (!orderStore.orderType || orderStore.orderType === 'delivery') {
        // If we have customer but no order type, or order type is delivery, start at order-type
        setCurrentStep('order-type');
      } else {
        // If we have customer and non-delivery order type, start at checkout
        setCurrentStep('checkout');
      }
    }
  }, [isOpen, isTableOrder]);

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
    // Pre-set address in orderStore — AddressEntry's auto-verify will pick it up
    orderStore.setDeliveryAddress({
      formatted: address.formatted,
      // Saved addresses always have coordinates (set when verified at save time)
      coordinates: address.coordinates!,
      placeId: address.placeId || undefined,
      apartment: address.apartment,
      landmark: address.landmark,
      instructions: address.instructions,
    });
    setCurrentStep('address');
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

      // Build order payload matching the OrderInput interface expected by the restaurant worker:
      // customer: { phone, name?, email? } (nested)
      // deliveryAddress: { addressLine1, city?, postalCode?, instructions? } (nested object, not a string)
      const orderPayload = {
        orderType: isTableOrder ? 'dine_in' : (orderStore.orderType || 'dine_in'),
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
        subtotal: cartStore.total,
        tax: Math.round(cartStore.total * 0.05 * 100) / 100,
        total: Math.round(cartStore.total * 1.05 * 100) / 100,
        // Nested customer object as required by OrderCustomerInput
        customer: {
          phone: orderStore.customer?.phone || '',
          name: orderStore.customer?.name || 'Guest',
          email: orderStore.customer?.email || undefined,
        },
        paymentMethod: orderStore.paymentMethod || 'cash',
        tableNumber: isTableOrder ? tableId : null,
        sessionToken: isTableOrder ? (cartStore as any).sessionToken : null,
        // Nested delivery address object as required by OrderDeliveryAddress
        deliveryAddress: isTableOrder ? undefined : (orderStore.deliveryAddress ? {
          addressLine1: orderStore.deliveryAddress.formatted,
          city: orderStore.deliveryAddress.city || undefined,
          postalCode: orderStore.deliveryAddress.pincode || undefined,
          instructions: orderStore.deliveryAddress.instructions || undefined,
        } : undefined),
        notes: orderStore.specialInstructions || null,
        source: 'web',
      };

      // Create order via restaurant worker API
      const effectiveTenantId = tenantId || 'khao-piyo-7766';
      const response = await fetch(`${getRestaurantWorkerUrl()}/api/orders?tenantId=${effectiveTenantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create order');
      }

      // Store order data (OrderData type requires specific fields)
      orderStore.setCurrentOrder({
        orderId: data.orderId,
        customer: orderStore.customer || { name: 'Guest', phone: '' },
        items: cartStore.items,
        subtotal: orderPayload.subtotal,
        deliveryFee: 0,
        tax: orderPayload.tax,
        total: orderPayload.total,
        orderType: (orderStore.orderType as 'delivery' | 'pickup' | 'dine-in') || 'dine-in',
        paymentMethod: (orderStore.paymentMethod as 'online' | 'cash') || 'cash',
        deliveryAddress: orderStore.deliveryAddress || undefined,
        specialInstructions: orderStore.specialInstructions,
        status: 'pending',
        createdAt: Date.now(),
      });

      // If online payment, move to payment step
      if (orderStore.paymentMethod === 'online' && data.razorpayOrder) {
        orderStore.setRazorpayOrder(data.razorpayOrder);
        setCurrentStep('payment');
      } else {
        // Cash payment - order is confirmed, clear cart
        cartStore.clearCart();
        setCurrentStep('confirmation');
      }
    } catch (error) {
      console.error('[OrderFlow] Order creation failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to create order');
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
            onBack={handleBack}
          />
        );

      case 'payment':
        return (
          <Payment
            backendUrl={backendUrl}
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
        {/* Close Button - Only show if not on confirmation */}
        {currentStep !== 'confirmation' && (
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

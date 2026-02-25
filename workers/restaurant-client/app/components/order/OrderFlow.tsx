'use client';

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { X } from 'lucide-react';
import { orderStore } from '../../stores/orderStore';
import { cartStore } from '../../stores/cartStore';
import { CustomerInfo } from './CustomerInfo';
import { OrderTypeSelection } from './OrderTypeSelection';
import { AddressEntry } from './AddressEntry';
import { CheckoutSummary } from './CheckoutSummary';
import { Payment } from './Payment';
import { OrderConfirmation } from './OrderConfirmation';

// Orders Worker URL for direct order creation
const ORDERS_WORKER_URL = process.env.NEXT_PUBLIC_ORDERS_WORKER_URL || 'https://handsfree-orders.suyesh.workers.dev';

// Restaurant Worker URL for customer data (addresses, etc.)
// Use current origin in browser so requests stay on the same tenant domain and avoid CORS
const getRestaurantWorkerUrl = () =>
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev');

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
  const [currentStep, setCurrentStep] = useState<'customer' | 'order-type' | 'address' | 'checkout' | 'payment' | 'confirmation'>('customer');

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
    // Table orders skip order-type selection, go directly to checkout
    if (isTableOrder) {
      setCurrentStep('checkout');
    } else {
      setCurrentStep('order-type');
    }
  };

  const handleOrderTypeSelected = () => {
    if (orderStore.orderType === 'delivery') {
      setCurrentStep('address');
    } else {
      setCurrentStep('checkout');
    }
  };

  const handleAddressVerified = async () => {
    // Auto-save address to Restaurant Worker for future quick access
    // Uses simplified schema: placeId + coordinates + formatted
    const customerPhone = orderStore.customer?.phone;
    const address = orderStore.deliveryAddress;

    if (customerPhone && address && address.placeId && address.coordinates) {
      try {
        const effectiveTenantId = tenantId || window.location.hostname.split('.')[0] || 'default';
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

      // Build order payload for the orders worker
      // Note: customerId is required (FK constraint in orders table)
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
        tax: Math.round(cartStore.total * 0.05 * 100) / 100, // 5% tax
        total: Math.round(cartStore.total * 1.05 * 100) / 100,
        // Customer info - customerId required for FK constraint
        customerId: orderStore.customer?.id || null,
        customerName: orderStore.customer?.name || 'Guest',
        customerPhone: orderStore.customer?.phone || null,
        // Payment
        paymentMethod: orderStore.paymentMethod || 'cash',
        // Table number for dine-in orders
        tableNumber: isTableOrder ? tableId : null,
        // Session token for secure table ordering
        sessionToken: isTableOrder ? (cartStore as any).sessionToken : null,
        // Delivery address - use formatted address string (null for table orders)
        deliveryAddress: isTableOrder ? null : (orderStore.deliveryAddress?.formatted || null),
        deliveryInstructions: isTableOrder ? null : (orderStore.deliveryAddress?.instructions || null),
        notes: orderStore.specialInstructions || null,
        // Source identifies this as a web order (vs POS, voice, etc.)
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
    } else if (currentStep === 'address') {
      setCurrentStep('order-type');
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

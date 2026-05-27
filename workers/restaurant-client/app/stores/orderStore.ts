import { makeAutoObservable } from 'mobx';
import { getTenantId } from '../lib/restaurant-config-loader';

export interface DeliveryAddress {
  formatted: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId?: string;
  pincode?: string;
  city?: string;
  state?: string;
  apartment?: string;
  landmark?: string;
  instructions?: string;
}

export interface CustomerInfo {
  id?: string; // Customer ID from database (required for orders)
  name: string;
  phone: string;
  email?: string;
}

export interface OrderData {
  orderId: string;
  customer: CustomerInfo;
  items: any[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  orderType: 'delivery' | 'pickup' | 'dine-in';
  paymentMethod: 'online' | 'cash';
  deliveryAddress?: DeliveryAddress;
  deliveryTime?: string;
  specialInstructions?: string;
  estimatedDeliveryTime?: string;
  status: string;
  createdAt: number;
}

export interface RazorpayOrderData {
  id: string;
  amount: number;
  currency: string;
  keyId: string;
  restaurantName?: string;
  restaurantLogo?: string;
}

class OrderStore {
  // Customer information
  customer: CustomerInfo | null = null;

  // Delivery address
  deliveryAddress: DeliveryAddress | null = null;
  isAddressVerified: boolean = false;
  deliveryFee: number = 0;
  estimatedDeliveryTime: string = '';

  // Order configuration
  orderType: 'delivery' | 'pickup' | 'dine-in' = 'delivery';
  paymentMethod: 'online' | 'cash' = 'online';
  specialInstructions: string = '';
  deliveryTime: string = '';

  // Order state
  currentOrder: OrderData | null = null;
  razorpayOrder: RazorpayOrderData | null = null;

  // UI state
  isProcessing: boolean = false;
  error: string | null = null;
  currentStep: 'address' | 'checkout' | 'payment' | 'confirmation' = 'address';

  constructor() {
    makeAutoObservable(this);
  }

  // Customer actions
  setCustomer(customer: CustomerInfo) {
    this.customer = customer;

    // Load saved cart for this customer (will be imported at top of file)
    if (customer.phone && typeof window !== 'undefined') {
      // Dynamic import to avoid circular dependency
      import('./cartStore').then(({ cartStore }) => {
        import('../lib/restaurant-config-loader').then(({ getTenantId }) => {
          const tenantId = getTenantId();
          cartStore.loadCart(customer.phone, tenantId);
        });
      });
    }
  }

  // Address actions
  setDeliveryAddress(address: DeliveryAddress) {
    this.deliveryAddress = address;
    this.isAddressVerified = true;
  }

  setDeliveryFee(fee: number) {
    this.deliveryFee = fee;
  }

  setEstimatedDeliveryTime(time: string) {
    this.estimatedDeliveryTime = time;
  }

  clearAddress() {
    this.deliveryAddress = null;
    this.isAddressVerified = false;
    this.deliveryFee = 0;
    this.estimatedDeliveryTime = '';
  }

  // Order configuration
  setOrderType(type: 'delivery' | 'pickup' | 'dine-in') {
    this.orderType = type;
    if (type !== 'delivery') {
      this.clearAddress();
    }
  }

  setPaymentMethod(method: 'online' | 'cash') {
    this.paymentMethod = method;
  }

  setSpecialInstructions(instructions: string) {
    this.specialInstructions = instructions;
  }

  setDeliveryTime(time: string) {
    this.deliveryTime = time;
  }

  // Order flow
  setCurrentStep(step: 'address' | 'checkout' | 'payment' | 'confirmation') {
    this.currentStep = step;
  }

  setCurrentOrder(order: OrderData) {
    this.currentOrder = order;
    if (typeof window !== 'undefined') {
      try {
        const key = `handsfree_order_${getTenantId()}`;
        // Store the tableId so restorePersistedOrder can match it to the current QR page
        const pathMatch = window.location.pathname.match(/^\/table\/([^/]+)/);
        const tableId = pathMatch ? pathMatch[1] : null;
        localStorage.setItem(key, JSON.stringify({ order, savedAt: Date.now(), tableId }));
      } catch {}
    }
  }

  // Restore an in-flight order from localStorage after a page refresh.
  // Returns true if an order was found and restored.
  restorePersistedOrder(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const key = `handsfree_order_${getTenantId()}`;
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const { order, savedAt, tableId: storedTableId } = JSON.parse(raw) as {
        order: OrderData; savedAt: number; tableId: string | null;
      };

      // Only restore a table order when the exact same table QR is open.
      // A different table (or the main website) must not inherit another table's order.
      const pathMatch = window.location.pathname.match(/^\/table\/([^/]+)/);
      const currentTableId = pathMatch ? pathMatch[1] : null;
      if (storedTableId !== currentTableId) {
        // Stale entry for a different context — remove it so it doesn't reappear
        localStorage.removeItem(key);
        return false;
      }

      // Discard orders older than 24 hours
      if (Date.now() - savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return false;
      }
      // Discard terminal orders (no point showing a "delivered" status screen)
      if (['delivered', 'completed', 'cancelled'].includes(order.status)) {
        localStorage.removeItem(key);
        return false;
      }
      this.currentOrder = order;
      return true;
    } catch {
      return false;
    }
  }

  setRazorpayOrder(razorpayOrder: RazorpayOrderData) {
    this.razorpayOrder = razorpayOrder;
  }

  // Processing state
  setProcessing(isProcessing: boolean) {
    this.isProcessing = isProcessing;
  }

  setError(error: string | null) {
    this.error = error;
  }

  // Validation
  get isReadyForCheckout(): boolean {
    if (!this.customer) return false;
    if (this.orderType === 'delivery' && !this.isAddressVerified) return false;
    return true;
  }

  get canPlaceOrder(): boolean {
    return this.isReadyForCheckout && !this.isProcessing;
  }

  // Reset
  resetOrder() {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(`handsfree_order_${getTenantId()}`); } catch {}
    }
    this.customer = null;
    this.deliveryAddress = null;
    this.isAddressVerified = false;
    this.deliveryFee = 0;
    this.estimatedDeliveryTime = '';
    this.orderType = 'delivery';
    this.paymentMethod = 'online';
    this.specialInstructions = '';
    this.deliveryTime = '';
    this.currentOrder = null;
    this.razorpayOrder = null;
    this.isProcessing = false;
    this.error = null;
    this.currentStep = 'address';
  }
}

export const orderStore = new OrderStore();

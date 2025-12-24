/**
 * Order Polling Service
 * Polls backend API for new orders and plays sound notifications
 * Alternative to WebSocket for real-time order updates
 * Supports multi-tenant dynamic configuration via tenantStore.
 */

import { useKDSStore } from '../stores/kdsStore';
import { useOnlineOrderStore } from '../stores/onlineOrderStore';
import { useTenantStore } from '../stores/tenantStore';
import type { KitchenOrder } from '../types/kds';
import type { OnlineOrder } from '../types/online';
import { getCurrentPlatform } from './platform';

const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';
const DEFAULT_ORDERS_URL = import.meta.env.VITE_ORDERS_API_URL || 'https://handsfree-orders.suyesh.workers.dev';
const POLL_INTERVAL = 10000; // Poll every 10 seconds
const ORDER_SOUND_URL = '/sounds/new-order.mp3'; // Sound file for new orders

/**
 * Get orders worker URL from tenant store or fallback to default
 */
function getOrdersWorkerUrl(): string {
  try {
    const tenant = useTenantStore.getState().tenant;
    return tenant?.ordersEndpoint || DEFAULT_ORDERS_URL;
  } catch {
    return DEFAULT_ORDERS_URL;
  }
}

// Tauri HTTP client wrapper to bypass CORS
async function tauriFetch(url: string, options?: RequestInit): Promise<Response> {
  const platform = getCurrentPlatform();

  // Use Tauri's HTTP client on desktop (bypasses CORS)
  if (platform === 'tauri') {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, options);
  }

  // Use browser fetch on web
  return fetch(url, options);
}

interface OrdersResponse {
  success: boolean;
  orders: KitchenOrder[];
  count: number;
}

interface OnlineOrdersResponse {
  success: boolean;
  orders: any[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

class OrderPollingService {
  private pollInterval: number | undefined;
  private tenantId: string | null = null;
  private lastOrderTime: number = 0;
  private lastOnlineOrderIds: Set<string> = new Set();
  private audio: HTMLAudioElement | null = null;
  private soundEnabled: boolean = true;

  /**
   * Initialize audio element
   */
  private initializeAudio() {
    try {
      this.audio = new Audio(ORDER_SOUND_URL);
      this.audio.volume = 0.8;

      // Handle audio file not found - use Web Audio API fallback
      this.audio.addEventListener('error', () => {
        console.warn('[OrderPolling] Audio file not found, will use Web Audio API fallback');
        this.audio = null;
      });

      console.log('[OrderPolling] Audio initialized');
    } catch (error) {
      console.error('[OrderPolling] Failed to initialize audio:', error);
    }
  }

  /**
   * Play notification sound using Web Audio API (fallback)
   */
  private playBeepSound() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure pleasant notification sound (two-tone beep)
      oscillator.frequency.value = 800; // Hz
      oscillator.type = 'sine';

      // Envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      // Play first beep
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);

      // Second beep (higher pitch)
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      oscillator2.frequency.value = 1000; // Hz
      oscillator2.type = 'sine';

      gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.3);
      gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.31);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator2.start(audioContext.currentTime + 0.3);
      oscillator2.stop(audioContext.currentTime + 0.5);

    } catch (error) {
      console.error('[OrderPolling] Failed to play beep sound:', error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound() {
    if (!this.soundEnabled) {
      return;
    }

    if (this.audio) {
      try {
        // Reset audio to start
        this.audio.currentTime = 0;

        // Play sound
        this.audio.play().catch(() => {
          console.warn('[OrderPolling] Failed to play audio file, using beep fallback');
          // Fallback to beep sound
          this.playBeepSound();
        });
      } catch (error) {
        console.error('[OrderPolling] Error playing sound:', error);
        this.playBeepSound();
      }
    } else {
      // No audio file loaded, use beep sound
      this.playBeepSound();
    }
  }

  /**
   * Fetch orders from backend API (KDS orders)
   */
  private async fetchOrders(): Promise<KitchenOrder[]> {
    if (!this.tenantId) {
      return [];
    }

    try {
      const response = await tauriFetch(
        `${DEFAULT_BACKEND_URL}/kds/orders?tenantId=${this.tenantId}&status=pending,preparing`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OrdersResponse = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch orders');
      }

      return data.orders || [];
    } catch (error) {
      console.error('[OrderPolling] Failed to fetch KDS orders:', error);
      return [];
    }
  }

  /**
   * Fetch online orders from orders worker
   * @param allStatuses - If true, fetch all orders (for initial load), otherwise only pending
   */
  private async fetchOnlineOrders(allStatuses: boolean = false): Promise<OnlineOrder[]> {
    if (!this.tenantId) {
      return [];
    }

    try {
      // Fetch orders from the orders worker (dynamic URL from tenant store)
      // For initial load, get all orders from today; for polling, only pending
      const ordersUrl = getOrdersWorkerUrl();
      const statusFilter = allStatuses ? '' : '&status=pending';
      const url = `${ordersUrl}/api/orders/${this.tenantId}?limit=100${statusFilter}`;
      console.log('[OrderPolling] Fetching from URL:', url);

      const response = await tauriFetch(url);
      console.log('[OrderPolling] Response status:', response.status, response.ok);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OnlineOrdersResponse = await response.json();
      console.log('[OrderPolling] Response data:', data.success, 'orders count:', data.orders?.length);

      if (!data.success) {
        throw new Error('Failed to fetch online orders');
      }

      // Transform orders worker response to OnlineOrder format
      return (data.orders || []).map((order: any): OnlineOrder => {
        const items = (order.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.item_total || item.quantity * item.price,
          specialInstructions: item.special_instructions || null,
        }));

        const subtotal = order.subtotal || 0;
        const tax = order.tax || 0;
        const deliveryFee = 0;
        const total = order.total || subtotal + tax;

        return {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status as any,
          orderType: (order.order_type === 'delivery' ? 'delivery' : 'pickup') as any,
          createdAt: order.created_at,
          customer: {
            name: order.customer_name || 'Guest',
            phone: order.customer_phone || '',
            address: order.delivery_address || null,
          },
          cart: {
            items,
            subtotal,
            tax,
            deliveryFee,
            discount: 0,
            total,
          },
          payment: {
            method: order.payment_method || 'cash',
            status: order.payment_status || 'pending',
            isPrepaid: order.payment_status === 'paid',
          },
          specialInstructions: order.notes || null,
          deliveryInstructions: order.delivery_instructions || null,
        };
      });
    } catch (error) {
      console.error('[OrderPolling] Failed to fetch online orders:', error);
      return [];
    }
  }

  /**
   * Set tenant ID for orders loading (used when loading without starting polling)
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Load all orders on startup (includes all statuses)
   */
  async loadInitialOrders(): Promise<void> {
    if (!this.tenantId) {
      console.warn('[OrderPolling] Cannot load initial orders: no tenantId');
      return;
    }

    try {
      console.log('[OrderPolling] Loading initial orders for tenant:', this.tenantId);
      console.log('[OrderPolling] Orders URL:', getOrdersWorkerUrl());
      const orders = await this.fetchOnlineOrders(true); // Get all statuses
      console.log('[OrderPolling] Fetched orders count:', orders.length);

      const onlineOrderStore = useOnlineOrderStore.getState();

      // Set all orders in the store
      onlineOrderStore.setOrders(orders);

      // Verify orders were stored
      const storedCount = useOnlineOrderStore.getState().orders.length;
      console.log('[OrderPolling] Orders in store after setOrders:', storedCount);

      // Update tracked IDs to avoid duplicate notifications on first poll
      this.lastOnlineOrderIds = new Set(orders.map(o => o.id));

      console.log(`[OrderPolling] Successfully loaded ${orders.length} initial orders`);
    } catch (error) {
      console.error('[OrderPolling] Failed to load initial orders:', error);
    }
  }

  /**
   * Poll for new online orders from orders worker
   */
  private async pollOnlineOrders() {
    try {
      const orders = await this.fetchOnlineOrders(false); // Only pending for polling
      const onlineOrderStore = useOnlineOrderStore.getState();

      // Check for new orders
      const newOrders = orders.filter(order => !this.lastOnlineOrderIds.has(order.id));

      if (newOrders.length > 0) {
        console.log(`[OrderPolling] ${newOrders.length} new online order(s) received`);

        // Play notification sound
        this.playNotificationSound();

        // Add orders to online order store
        newOrders.forEach(order => {
          onlineOrderStore.addOrder(order);

          // Show browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const notification = new Notification('New Online Order!', {
                body: `Order ${order.orderNumber} - ₹${order.cart.total}`,
                icon: '/icon-192.png',
                tag: order.id,
                requireInteraction: true,
              });
              setTimeout(() => notification.close(), 10000);
            } catch (e) {
              console.error('[OrderPolling] Failed to show notification:', e);
            }
          }
        });
      }

      // Update tracked order IDs (only for pending orders in polling mode)
      orders.forEach(o => this.lastOnlineOrderIds.add(o.id));

    } catch (error) {
      console.error('[OrderPolling] Online orders polling failed:', error);
    }
  }

  /**
   * Poll for new orders (KDS orders from old backend)
   */
  private async pollOrders() {
    try {
      const orders = await this.fetchOrders();

      if (orders.length === 0) {
        return;
      }

      // Check for new orders
      const kdsStore = useKDSStore.getState();
      const existingOrderIds = new Set(kdsStore.activeOrders.map((o: { id: string }) => o.id));

      const newOrders = orders.filter(order => {
        // Order is new if:
        // 1. Not in existing orders
        // 2. Created after last poll time
        const isNewOrder = !existingOrderIds.has(order.id);
        const isRecent = new Date(order.createdAt).getTime() > this.lastOrderTime;
        return isNewOrder && isRecent;
      });

      if (newOrders.length > 0) {
        console.log(`[OrderPolling] ${newOrders.length} new order(s) received`);

        // Play notification sound
        this.playNotificationSound();

        // Add orders to KDS store
        newOrders.forEach(order => {
          kdsStore.addOrder(order);

          // Show browser notification if permission granted
          this.showBrowserNotification(order);
        });

        // Update last order time
        const latestOrderTime = Math.max(
          ...newOrders.map(o => new Date(o.createdAt).getTime())
        );
        this.lastOrderTime = latestOrderTime;
      }

      // Update all orders in store (for status changes)
      kdsStore.setActiveOrders(orders);

    } catch (error) {
      console.error('[OrderPolling] Polling failed:', error);
    }
  }

  /**
   * Show browser notification for new order
   */
  private showBrowserNotification(order: KitchenOrder) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification('New Order Received!', {
          body: `Order #${order.orderNumber} - ${order.items.length} items`,
          icon: '/icon-192.png',
          tag: order.id,
          requireInteraction: true,
        });

        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);
      } catch (error) {
        console.error('[OrderPolling] Failed to show notification:', error);
      }
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[OrderPolling] Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Start polling for orders
   */
  async start(tenantId: string, options?: { soundEnabled?: boolean; pollOnlineOrders?: boolean }) {
    if (this.pollInterval) {
      console.warn('[OrderPolling] Already polling, stopping previous poll');
      this.stop();
    }

    this.tenantId = tenantId;
    this.soundEnabled = options?.soundEnabled !== false;
    this.lastOrderTime = Date.now();
    this.lastOnlineOrderIds = new Set();

    // Initialize audio
    if (this.soundEnabled) {
      this.initializeAudio();
    }

    // Request notification permission
    this.requestNotificationPermission();

    console.log('[OrderPolling] Starting polling for tenant:', tenantId);

    // Log orders URL being used
    console.log('[OrderPolling] Using orders URL:', getOrdersWorkerUrl());

    // Load all initial orders first (including past orders)
    await this.loadInitialOrders();

    // Then start polling for new pending orders
    this.pollOrders();
    this.pollOnlineOrders();

    // Set up interval for both types of orders
    this.pollInterval = window.setInterval(() => {
      this.pollOrders();
      this.pollOnlineOrders();
    }, POLL_INTERVAL);
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      console.log('[OrderPolling] Stopped polling');
    }

    // Cleanup audio
    if (this.audio) {
      this.audio = null;
    }
  }

  /**
   * Enable/disable notification sound
   */
  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    console.log('[OrderPolling] Sound notifications:', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Check if currently polling
   */
  isPolling(): boolean {
    return this.pollInterval !== undefined;
  }
}

// Singleton instance
export const orderPollingService = new OrderPollingService();

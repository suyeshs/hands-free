/**
 * Order Polling Service
 * Polls backend API for new orders and plays sound notifications
 * Alternative to WebSocket for real-time order updates
 */

import { useKDSStore } from '../stores/kdsStore';
import { usePOSStore } from '../stores/posStore';
import type { KitchenOrder } from '../types/kds';
import { getCurrentPlatform } from './platform';

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';
const POLL_INTERVAL = 10000; // Poll every 10 seconds
const ORDER_SOUND_URL = '/sounds/new-order.mp3'; // Sound file for new orders

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

class OrderPollingService {
  private pollInterval: number | undefined;
  private tenantId: string | null = null;
  private lastOrderTime: number = 0;
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
        this.audio.play().catch(error => {
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
   * Fetch orders from backend API
   */
  private async fetchOrders(): Promise<KitchenOrder[]> {
    if (!this.tenantId) {
      return [];
    }

    try {
      const response = await tauriFetch(
        `${BACKEND_URL}/kds/orders?tenantId=${this.tenantId}&status=pending,preparing`
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
      console.error('[OrderPolling] Failed to fetch orders:', error);
      return [];
    }
  }

  /**
   * Poll for new orders
   */
  private async pollOrders() {
    try {
      const orders = await this.fetchOrders();

      if (orders.length === 0) {
        return;
      }

      // Check for new orders
      const kdsStore = useKDSStore.getState();
      const existingOrderIds = new Set(kdsStore.orders.map(o => o.id));

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
  start(tenantId: string, options?: { soundEnabled?: boolean }) {
    if (this.pollInterval) {
      console.warn('[OrderPolling] Already polling, stopping previous poll');
      this.stop();
    }

    this.tenantId = tenantId;
    this.soundEnabled = options?.soundEnabled !== false;
    this.lastOrderTime = Date.now();

    // Initialize audio
    if (this.soundEnabled) {
      this.initializeAudio();
    }

    // Request notification permission
    this.requestNotificationPermission();

    console.log('[OrderPolling] Starting polling for tenant:', tenantId);

    // Initial poll
    this.pollOrders();

    // Set up interval
    this.pollInterval = window.setInterval(() => {
      this.pollOrders();
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

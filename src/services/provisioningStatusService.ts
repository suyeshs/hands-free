/**
 * Provisioning Status Service
 *
 * Manages WebSocket connection to Durable Object for real-time provisioning updates.
 * Follows the same pattern as orderSyncService.ts for consistency.
 */

export interface ProvisioningStatus {
  tenantId: string;
  status: 'initializing' | 'in_progress' | 'complete' | 'failed';
  progress: {
    metadata: boolean;
    kvNamespaces: boolean;
    d1Database: boolean;
    d1Schema: boolean;
    r2Bucket: boolean;
  };
  currentStep: string;
  progressPercent: number;
  error?: string;
  estimatedTimeRemaining?: number;
  resourceIds?: {
    d1DatabaseId?: string;
    r2BucketName?: string;
  };
}

export interface ProvisioningUpdate {
  type: 'status' | 'progress' | 'complete' | 'error';
  data: ProvisioningStatus | { error: string };
}

class ProvisioningStatusService {
  private ws: WebSocket | null = null;
  private listeners: Set<(update: ProvisioningUpdate) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimeoutId: number | null = null;
  private wsUrl: string | null = null;

  connect(wsUrl: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[ProvisioningStatus] Already connected');
      return;
    }

    this.wsUrl = wsUrl;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[ProvisioningStatus] Connected to WebSocket');
      this.reconnectAttempts = 0;
      if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const update: ProvisioningUpdate = JSON.parse(event.data);
        console.log('[ProvisioningStatus] Received update:', update);

        // Notify all listeners
        this.listeners.forEach(listener => {
          try {
            listener(update);
          } catch (error) {
            console.error('[ProvisioningStatus] Error in listener:', error);
          }
        });

        // Auto-disconnect on completion or error
        if (update.type === 'complete' || update.type === 'error') {
          setTimeout(() => {
            this.disconnect();
          }, 5000); // Keep connection for 5 seconds to allow final updates
        }
      } catch (error) {
        console.error('[ProvisioningStatus] Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[ProvisioningStatus] WebSocket error:', error);
    };

    this.ws.onclose = (event) => {
      console.log('[ProvisioningStatus] WebSocket closed:', { code: event.code, reason: event.reason });
      this.ws = null;

      // Auto-reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.wsUrl) {
        const delay = Math.min(
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
          30000 // Max 30 seconds
        );

        console.log(`[ProvisioningStatus] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        this.reconnectTimeoutId = window.setTimeout(() => {
          this.reconnectAttempts++;
          if (this.wsUrl) {
            this.connect(this.wsUrl);
          }
        }, delay);
      } else {
        console.log('[ProvisioningStatus] Max reconnect attempts reached or no URL available');
      }
    };
  }

  subscribe(callback: (update: ProvisioningUpdate) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  disconnect() {
    console.log('[ProvisioningStatus] Disconnecting');

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.wsUrl = null;
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Singleton instance
export const provisioningStatusService = new ProvisioningStatusService();

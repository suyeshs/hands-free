/**
 * WebSocket Service
 * Handles real-time connections for live order updates
 */

type WebSocketEventType = 'connect' | 'disconnect' | 'error' | 'message' | 'aggregator_order' | 'aggregator_order_update';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

type WebSocketCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<WebSocketEventType, Set<WebSocketCallback>> = new Map();
  private isIntentionallyClosed = false;

  constructor() {
    const wsUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001/api';
    // Convert HTTP to WS protocol
    this.url = wsUrl.replace(/^http/, 'ws') + '/ws';
  }

  /**
   * Connect to WebSocket server
   */
  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    try {
      console.log('[WebSocket] Connecting to:', this.url);

      // Add token as query parameter if provided
      const url = token ? `${this.url}?token=${token}` : this.url;
      this.ws = new WebSocket(url);
      this.isIntentionallyClosed = false;

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        this.reconnectAttempts = 0;
        this.emit('connect', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', message.type);

          // Emit to general message listeners
          this.emit('message', message);

          // Emit to specific event type listeners
          if (message.type) {
            this.emit(message.type as WebSocketEventType, message.data);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        this.emit('disconnect', { connected: false });

        // Attempt to reconnect if not intentionally closed
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(token);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      this.emit('error', error);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(token?: string) {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect(token);
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    console.log('[WebSocket] Disconnecting...');
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * Send message to server
   */
  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };
      this.ws.send(JSON.stringify(message));
      console.log('[WebSocket] Message sent:', type);
    } else {
      console.error('[WebSocket] Cannot send message - not connected');
    }
  }

  /**
   * Subscribe to events
   */
  on(event: WebSocketEventType, callback: WebSocketCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event: WebSocketEventType, callback: WebSocketCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: WebSocketEventType, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in ${event} callback:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get reconnect attempts
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

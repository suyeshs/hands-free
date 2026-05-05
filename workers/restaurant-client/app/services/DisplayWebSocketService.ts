import React from 'react';
import type { MenuItem } from './RecommendationService';

// Display Update Types (matching server-side conversation-types.ts)
export type DisplayUpdateType =
  | 'transcription'
  | 'dish_card'
  | 'menu_section'
  | 'menu_grid'
  | 'order_summary'
  | 'confirmation'
  | 'time_based_suggestions'
  | 'category_filter'
  | 'choice_selection'
  | 'webpage'
  | 'snippet'
  | 'advice_card'
  | 'product_comparison'
  | 'document_viewer';

export interface BaseDisplayUpdate {
  type: DisplayUpdateType;
  timestamp: number;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

export interface TranscriptionUpdate extends BaseDisplayUpdate {
  type: 'transcription';
  text: string;
  speaker: 'user' | 'assistant';
}

export interface DishCardUpdate extends BaseDisplayUpdate {
  type: 'dish_card';
  dish: MenuItem;
  animation?: 'fade_in' | 'slide_up' | 'pulse' | 'highlight';
}

export interface MenuSectionUpdate extends BaseDisplayUpdate {
  type: 'menu_section';
  category: string;
  items: MenuItem[];
  animation?: 'fade_in' | 'slide_up';
}

export interface OrderSummaryUpdate extends BaseDisplayUpdate {
  type: 'order_summary';
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    customization?: string;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
}

export interface TimeBasedSuggestionUpdate extends BaseDisplayUpdate {
  type: 'time_based_suggestions';
  timeOfDay: 'morning' | 'lunch' | 'evening' | 'night';
  items: MenuItem[];
  headline: string; // e.g., "Morning favorites"
}

export interface CategoryFilterUpdate extends BaseDisplayUpdate {
  type: 'category_filter';
  category: string;
  dietaryFilter?: 'vegetarian' | 'non-veg' | 'vegan';
  items: MenuItem[];
}

export interface ChoiceSelectionUpdate extends BaseDisplayUpdate {
  type: 'choice_selection';
  itemName: string;
  choiceType: string; // "flavor", "sauce", "pasta type"
  choices: string[];
}

export interface ConfirmationUpdate extends BaseDisplayUpdate {
  type: 'confirmation';
  message: string;
  orderNumber?: string;
}

export interface MenuGridUpdate extends BaseDisplayUpdate {
  type: 'menu_grid';
  title: string;
  dishes: MenuItem[];
  searchQuery?: string;
  category?: string;
  filters?: {
    dietary?: string;
    maxPrice?: number;
    minPrice?: number;
  };
  totalCount: number;
}

export interface AdviceCardUpdate extends BaseDisplayUpdate {
  type: 'advice_card';
  text: string;
  adviceType?: 'tip' | 'warning' | 'suggestion' | 'info';
}

export type DisplayUpdate =
  | TranscriptionUpdate
  | DishCardUpdate
  | MenuSectionUpdate
  | MenuGridUpdate
  | OrderSummaryUpdate
  | TimeBasedSuggestionUpdate
  | CategoryFilterUpdate
  | ChoiceSelectionUpdate
  | ConfirmationUpdate
  | AdviceCardUpdate;

export interface ConversationMessage {
  type: 'initial_state' | 'update' | 'pong';
  state?: any;
  update?: DisplayUpdate;
  timestamp: number;
}

// Update callback type
export type DisplayUpdateCallback = (update: DisplayUpdate) => void;

/**
 * Display WebSocket Service
 * Manages real-time connection to ConversationSession for parallel display updates
 * Includes update queue for batched rendering to prevent UI jank
 */
export class DisplayWebSocketService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private tenantId: string;
  private category: 'restaurant' | 'travel' | 'financial';
  private isConnected: boolean = false;
  private callbacks: Map<DisplayUpdateType, DisplayUpdateCallback[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second
  private wsUrl: string;

  // Update queue for batched rendering
  private updateQueue: DisplayUpdate[] = [];
  private isProcessingQueue: boolean = false;
  private queueFlushScheduled: boolean = false;

  constructor(params: {
    tenantId: string;
    category?: 'restaurant' | 'travel' | 'financial';
    wsUrl?: string;
  }) {
    this.tenantId = params.tenantId;
    this.category = params.category || 'restaurant';

    // Use theme-edge-worker for WebSocket connections
    if (!params.wsUrl) {
      // Get theme worker URL from environment or default
      const themeWorkerUrl = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_THEME_WORKER_URL || 'https://theme-edge-worker.suyesh.workers.dev')
        : 'https://theme-edge-worker.suyesh.workers.dev';

      // Convert to WebSocket protocol
      const wsUrl = themeWorkerUrl.replace('https://', 'wss://').replace('http://', 'ws://');
      this.wsUrl = `${wsUrl}/api/conversation/display`;
    } else {
      this.wsUrl = params.wsUrl;
    }

    console.log('[DisplayWebSocket] Configured WebSocket URL:', this.wsUrl);
  }

  /**
   * Connect to ConversationSession WebSocket
   */
  async connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      try {
        const url = `${this.wsUrl}?tenant=${this.tenantId}&category=${this.category}&session=${sessionId}`;
        console.log('[DisplayWebSocket] Connecting to:', url);

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[DisplayWebSocket] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ConversationMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (err) {
            console.error('[DisplayWebSocket] Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DisplayWebSocket] Error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.log('[DisplayWebSocket] Closed:', event.code, event.reason);
          this.isConnected = false;
          this.attemptReconnect();
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        console.error('[DisplayWebSocket] Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(message: ConversationMessage): void {
    switch (message.type) {
      case 'initial_state':
        console.log('[DisplayWebSocket] Received initial state:', message.state);
        // Replay recent display updates from state
        if (message.state?.displayUpdates) {
          message.state.displayUpdates.forEach((update: DisplayUpdate) => {
            this.triggerCallbacks(update);
          });
        }
        break;

      case 'update':
        if (message.update) {
          console.log('[DisplayWebSocket] Received update:', message.update.type);
          this.triggerCallbacks(message.update);
        }
        break;

      case 'pong':
        console.log('[DisplayWebSocket] Pong received');
        break;

      default:
        console.warn('[DisplayWebSocket] Unknown message type:', (message as any).type);
    }
  }

  /**
   * Queue update and schedule batch processing
   * Uses requestAnimationFrame to batch updates within a single frame
   */
  private triggerCallbacks(update: DisplayUpdate): void {
    // Add to queue
    this.updateQueue.push(update);

    // Schedule queue flush if not already scheduled
    if (!this.queueFlushScheduled) {
      this.queueFlushScheduled = true;
      requestAnimationFrame(() => this.flushUpdateQueue());
    }
  }

  /**
   * Flush the update queue - process all pending updates in one batch
   */
  private flushUpdateQueue(): void {
    this.queueFlushScheduled = false;

    if (this.updateQueue.length === 0 || this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    // Get all queued updates and clear the queue
    const updates = this.updateQueue.splice(0);

    // Process each update
    updates.forEach((update) => {
      this.processUpdate(update);
    });

    this.isProcessingQueue = false;

    // If more updates arrived during processing, schedule another flush
    if (this.updateQueue.length > 0) {
      this.queueFlushScheduled = true;
      requestAnimationFrame(() => this.flushUpdateQueue());
    }
  }

  /**
   * Process a single update by triggering its callbacks
   */
  private processUpdate(update: DisplayUpdate): void {
    const callbacks = this.callbacks.get(update.type) || [];
    callbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (err) {
        console.error('[DisplayWebSocket] Callback error:', err);
      }
    });

    // Also trigger 'all' callbacks
    const allCallbacks = this.callbacks.get('*' as any) || [];
    allCallbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (err) {
        console.error('[DisplayWebSocket] Global callback error:', err);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DisplayWebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[DisplayWebSocket] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId).catch((err) => {
          console.error('[DisplayWebSocket] Reconnect failed:', err);
        });
      }
    }, this.reconnectDelay);

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
  }

  /**
   * Register callback for specific update type
   */
  on(type: DisplayUpdateType | '*', callback: DisplayUpdateCallback): void {
    const callbacks = this.callbacks.get(type as any) || [];
    callbacks.push(callback);
    this.callbacks.set(type as any, callbacks);
  }

  /**
   * Remove callback for specific update type
   */
  off(type: DisplayUpdateType | '*', callback: DisplayUpdateCallback): void {
    const callbacks = this.callbacks.get(type as any) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      this.callbacks.set(type as any, callbacks);
    }
  }

  /**
   * Send ping to keep connection alive
   */
  ping(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }

  /**
   * Send user action back to backend (e.g., button clicks from dish cards)
   */
  sendAction(action: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[DisplayWebSocket] Sending action:', action, data);
      this.ws.send(
        JSON.stringify({
          type: 'action',
          action: action,
          data: data,
          timestamp: Date.now(),
        })
      );
    } else {
      console.error('[DisplayWebSocket] Cannot send action - not connected');
    }
  }

  /**
   * Disconnect from WebSocket and clean up all resources
   */
  disconnect(): void {
    // Stop any pending reconnection attempts
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;

    // Clear all callbacks to prevent memory leaks
    this.callbacks.clear();

    // Clear update queue
    this.updateQueue = [];
    this.isProcessingQueue = false;
    this.queueFlushScheduled = false;

    // Reset reconnection state for future connections
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  /**
   * Check if connected
   */
  getConnectionStatus(): {
    connected: boolean;
    sessionId: string | null;
    reconnecting: boolean;
  } {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      reconnecting: this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts,
    };
  }
}

/**
 * React hook for using DisplayWebSocketService
 */
export function useDisplayUpdates(params: {
  tenantId: string;
  sessionId: string;
  category?: 'restaurant' | 'travel' | 'financial';
  enabled?: boolean;
}) {
  const [service] = React.useState(
    () =>
      new DisplayWebSocketService({
        tenantId: params.tenantId,
        category: params.category,
      })
  );

  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (params.enabled === false) return;

    // Connect to WebSocket
    service
      .connect(params.sessionId)
      .then(() => {
        setConnected(true);
      })
      .catch((err: unknown) => {
        console.error('[useDisplayUpdates] Connection failed:', err);
      });

    // Set up ping interval (every 30 seconds)
    const pingInterval = setInterval(() => {
      service.ping();
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval);
      service.disconnect();
    };
  }, [params.sessionId, params.enabled]);

  return {
    service,
    connected,
    on: service.on.bind(service),
    off: service.off.bind(service),
    status: service.getConnectionStatus(),
  };
}

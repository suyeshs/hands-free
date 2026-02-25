/**
 * ServiceRequestService - WebSocket client for table service requests
 * Handles real-time communication for call waiter, request bill, etc.
 */

export interface ServiceRequest {
  type: 'call_waiter' | 'request_bill' | 'need_help' | 'refill' | 'clean_table' | 'custom';
  tableNumber: string;
  customMessage?: string;
  timestamp: number;
}

export interface ServiceRequestAcknowledgment {
  requestId: string;
  acknowledgedBy?: string;
  acknowledgedAt: number;
  estimatedWaitTime?: number;
}

type ServiceRequestCallback = (ack: ServiceRequestAcknowledgment) => void;

export class ServiceRequestService {
  private ws: WebSocket | null = null;
  private tenantId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  private acknowledgmentCallback: ServiceRequestCallback | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Connect to WebSocket server
   * Returns promise that resolves when connection is established
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use orders worker WebSocket endpoint
        const wsUrl = `wss://orders-worker.suyesh.workers.dev/ws/${this.tenantId}`;
        console.log('[ServiceRequest] Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[ServiceRequest] Connected successfully');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[ServiceRequest] Received message:', data);

            if (data.type === 'service_request_acknowledged') {
              this.handleAcknowledgment(data);
            }
          } catch (err) {
            console.error('[ServiceRequest] Failed to parse message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[ServiceRequest] WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.log('[ServiceRequest] Connection closed:', event.code, event.reason);
          this.ws = null;

          // Auto-reconnect if not closed intentionally
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[ServiceRequest] Reconnecting (attempt ${this.reconnectAttempts})...`);

            setTimeout(() => {
              this.connect().catch(err => {
                console.error('[ServiceRequest] Reconnect failed:', err);
              });
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send service request to backend
   */
  sendServiceRequest(request: ServiceRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      try {
        const message = JSON.stringify({
          type: 'service_request',
          request: {
            ...request,
            timestamp: Date.now()
          }
        });

        console.log('[ServiceRequest] Sending:', message);
        this.ws.send(message);
        resolve();
      } catch (err) {
        console.error('[ServiceRequest] Failed to send request:', err);
        reject(err);
      }
    });
  }

  /**
   * Set callback for acknowledgment messages
   */
  onAcknowledgment(callback: ServiceRequestCallback) {
    this.acknowledgmentCallback = callback;
  }

  /**
   * Handle acknowledgment from staff
   */
  private handleAcknowledgment(data: any) {
    console.log('[ServiceRequest] Request acknowledged:', data);

    if (this.acknowledgmentCallback) {
      this.acknowledgmentCallback({
        requestId: data.requestId || 'unknown',
        acknowledgedBy: data.acknowledgedBy,
        acknowledgedAt: data.acknowledgedAt || Date.now(),
        estimatedWaitTime: data.estimatedWaitTime
      });
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.ws) {
      console.log('[ServiceRequest] Disconnecting...');
      this.ws.close(1000, 'Client disconnect'); // 1000 = normal closure
      this.ws = null;
    }
    this.acknowledgmentCallback = null;
  }
}

/**
 * Durable Object for managing real-time WebSocket connections
 * Enables bi-directional communication between WhatsApp and your POS system
 *
 * Use cases:
 * - Real-time order updates sent to WhatsApp
 * - Live chat support between staff and customers
 * - Multi-user group conversations
 * - Real-time notifications
 */

import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  userType: 'whatsapp' | 'admin' | 'staff';
  tenantId?: string;
  connectedAt: number;
  metadata?: Record<string, any>;
}

interface Message {
  id: string;
  from: string;
  to?: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'notification' | 'status';
  metadata?: Record<string, any>;
}

/**
 * ConversationRoom Durable Object
 * Manages a single conversation/room with multiple WebSocket connections
 */
export class ConversationRoom {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private clients: Map<string, WebSocketClient>;
  private messageHistory: Message[];

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.storage = state.storage;
    this.clients = new Map();
    this.messageHistory = [];

    // Block concurrent execution until initialization is complete
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  /**
   * Load conversation state from storage
   */
  private async loadState(): Promise<void> {
    try {
      // Load message history (last 100 messages)
      const history = await this.storage.get<Message[]>('messageHistory');
      if (history) {
        this.messageHistory = history;
      }

      console.log('[ConversationRoom] State loaded:', {
        roomId: this.state.id.toString(),
        messageCount: this.messageHistory.length,
      });
    } catch (error) {
      console.error('[ConversationRoom] Error loading state:', error);
    }
  }

  /**
   * Save state to durable storage
   */
  private async saveState(): Promise<void> {
    try {
      // Keep only last 100 messages
      const recentMessages = this.messageHistory.slice(-100);
      await this.storage.put('messageHistory', recentMessages);
    } catch (error) {
      console.error('[ConversationRoom] Error saving state:', error);
    }
  }

  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      // WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request);
      }

      // REST API endpoints
      switch (pathname) {
        case '/messages':
          return this.handleGetMessages();

        case '/broadcast':
          if (request.method === 'POST') {
            return await this.handleBroadcast(request);
          }
          break;

        case '/clients':
          return this.handleGetClients();

        case '/status':
          return Response.json({
            roomId: this.state.id.toString(),
            activeConnections: this.clients.size,
            messageCount: this.messageHistory.length,
            timestamp: new Date().toISOString(),
          });

        default:
          return Response.json({ error: 'Not found' }, { status: 404 });
      }

      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    } catch (error) {
      console.error('[ConversationRoom] Error handling request:', error);
      return Response.json(
        {
          error: 'Internal error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const userType = url.searchParams.get('userType') as 'whatsapp' | 'admin' | 'staff' || 'whatsapp';
    const tenantId = url.searchParams.get('tenantId');

    if (!userId) {
      return new Response('Missing userId parameter', { status: 400 });
    }

    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);

    // Store client info
    const clientId = crypto.randomUUID();
    const wsClient: WebSocketClient = {
      ws: server,
      userId,
      userType,
      tenantId,
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, wsClient);

    console.log('[ConversationRoom] New WebSocket connection:', {
      clientId,
      userId,
      userType,
      totalClients: this.clients.size,
    });

    // Send connection confirmation
    server.send(
      JSON.stringify({
        type: 'connection',
        status: 'connected',
        clientId,
        roomId: this.state.id.toString(),
        timestamp: Date.now(),
      })
    );

    // Send recent message history
    if (this.messageHistory.length > 0) {
      server.send(
        JSON.stringify({
          type: 'history',
          messages: this.messageHistory.slice(-20), // Last 20 messages
        })
      );
    }

    // Notify other clients about new connection
    this.broadcastToOthers(clientId, {
      type: 'user_joined',
      userId,
      userType,
      timestamp: Date.now(),
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, messageData: string | ArrayBuffer): Promise<void> {
    try {
      const clientId = this.findClientId(ws);
      if (!clientId) {
        console.error('[ConversationRoom] WebSocket not found');
        return;
      }

      const client = this.clients.get(clientId);
      if (!client) {
        return;
      }

      // Parse message
      const data =
        typeof messageData === 'string'
          ? JSON.parse(messageData)
          : JSON.parse(new TextDecoder().decode(messageData));

      console.log('[ConversationRoom] Message received:', {
        clientId,
        userId: client.userId,
        type: data.type,
      });

      // Handle different message types
      switch (data.type) {
        case 'message':
          await this.handleMessageReceived(client, data);
          break;

        case 'typing':
          this.broadcastToOthers(clientId, {
            type: 'typing',
            userId: client.userId,
            isTyping: data.isTyping,
          });
          break;

        case 'read':
          this.broadcastToOthers(clientId, {
            type: 'read',
            userId: client.userId,
            messageId: data.messageId,
          });
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          console.warn('[ConversationRoom] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[ConversationRoom] Error handling WebSocket message:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Failed to process message',
        })
      );
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const clientId = this.findClientId(ws);
    if (clientId) {
      const client = this.clients.get(clientId);
      console.log('[ConversationRoom] WebSocket closed:', {
        clientId,
        userId: client?.userId,
        code,
        reason,
      });

      // Notify others
      if (client) {
        this.broadcastToOthers(clientId, {
          type: 'user_left',
          userId: client.userId,
          timestamp: Date.now(),
        });
      }

      this.clients.delete(clientId);
    }
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error('[ConversationRoom] WebSocket error:', error);
    const clientId = this.findClientId(ws);
    if (clientId) {
      this.clients.delete(clientId);
    }
  }

  /**
   * Handle message received from client
   */
  private async handleMessageReceived(client: WebSocketClient, data: any): Promise<void> {
    const message: Message = {
      id: crypto.randomUUID(),
      from: client.userId,
      to: data.to,
      content: data.content,
      timestamp: Date.now(),
      type: data.messageType || 'text',
      metadata: data.metadata,
    };

    // Add to history
    this.messageHistory.push(message);

    // Save to storage
    await this.saveState();

    // Broadcast to all clients (or specific recipient)
    if (data.to) {
      // Send to specific user
      this.sendToUser(data.to, {
        type: 'message',
        message,
      });

      // Send confirmation to sender
      client.ws.send(
        JSON.stringify({
          type: 'message_sent',
          messageId: message.id,
          timestamp: message.timestamp,
        })
      );
    } else {
      // Broadcast to all
      this.broadcast({
        type: 'message',
        message,
      });
    }
  }

  /**
   * Get message history
   */
  private handleGetMessages(): Response {
    return Response.json({
      messages: this.messageHistory,
      count: this.messageHistory.length,
    });
  }

  /**
   * Handle broadcast request (REST API)
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const body = await request.json() as any;

      this.broadcast({
        type: 'notification',
        content: body.message,
        timestamp: Date.now(),
      });

      return Response.json({ success: true, recipients: this.clients.size });
    } catch (error) {
      return Response.json(
        { error: 'Failed to broadcast', message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Get connected clients
   */
  private handleGetClients(): Response {
    const clients = Array.from(this.clients.values()).map(client => ({
      userId: client.userId,
      userType: client.userType,
      tenantId: client.tenantId,
      connectedAt: client.connectedAt,
    }));

    return Response.json({
      clients,
      count: clients.length,
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(data: any): void {
    const message = JSON.stringify(data);
    for (const client of this.clients.values()) {
      try {
        client.ws.send(message);
      } catch (error) {
        console.error('[ConversationRoom] Error sending to client:', error);
      }
    }
  }

  /**
   * Broadcast to all clients except one
   */
  private broadcastToOthers(excludeClientId: string, data: any): void {
    const message = JSON.stringify(data);
    for (const [clientId, client] of this.clients.entries()) {
      if (clientId !== excludeClientId) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error('[ConversationRoom] Error sending to client:', error);
        }
      }
    }
  }

  /**
   * Send message to specific user
   */
  private sendToUser(userId: string, data: any): void {
    const message = JSON.stringify(data);
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error('[ConversationRoom] Error sending to user:', error);
        }
      }
    }
  }

  /**
   * Find client ID by WebSocket instance
   */
  private findClientId(ws: WebSocket): string | undefined {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws === ws) {
        return clientId;
      }
    }
    return undefined;
  }

  /**
   * Clean up inactive connections (called periodically)
   */
  async alarm(): Promise<void> {
    console.log('[ConversationRoom] Alarm triggered - cleaning up...');

    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [clientId, client] of this.clients.entries()) {
      const age = now - client.connectedAt;
      if (age > timeout) {
        console.log('[ConversationRoom] Closing inactive connection:', clientId);
        client.ws.close(1000, 'Timeout');
        this.clients.delete(clientId);
      }
    }

    // Set next alarm if there are still connections
    if (this.clients.size > 0) {
      await this.storage.setAlarm(Date.now() + 60000); // Check again in 1 minute
    }
  }
}

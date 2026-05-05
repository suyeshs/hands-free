/**
 * ConversationSession Durable Object
 * Real-time conversation state management with multimodal display support
 * Handles transcriptions, display updates, and WebSocket broadcasting
 */

import type {
  DisplayClient,
  ConversationState,
  DisplayUpdate,
  SessionInit,
  ConversationMessage,
} from './conversation-types';
import { ConversationStorageKeys, DEFAULT_CONVERSATION_CONFIG } from './conversation-types';
import { CanvasManager } from './CanvasManager';

export class ConversationSession implements DurableObject {
  private state: DurableObjectState;
  private displays: Map<WebSocket, DisplayClient>;
  private conversationState: ConversationState;
  private config: typeof DEFAULT_CONVERSATION_CONFIG;
  private canvasManager: CanvasManager;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.displays = new Map();
    this.config = DEFAULT_CONVERSATION_CONFIG;
    this.canvasManager = new CanvasManager();

    // Initialize empty conversation state
    this.conversationState = {
      sessionId: '',
      tenantId: '',
      category: 'restaurant',
      currentOrder: null,
      transcriptions: [],
      displayUpdates: [],
      startedAt: Date.now(),
    };

    // Restore hibernated WebSocket connections
    this.state.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment();
      if (attachment) {
        this.displays.set(ws, attachment as DisplayClient);
      }
    });

    // Set up WebSocket auto-response for keep-alive
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );

    // Restore state from storage
    this.restoreState();
  }

  /**
   * Restore conversation state from durable storage
   */
  async restoreState() {
    const saved = await this.state.storage.get<ConversationState>(
      ConversationStorageKeys.STATE
    );

    if (saved) {
      this.conversationState = saved;
    }
  }

  /**
   * Handle HTTP requests (WebSocket upgrade + REST API)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection endpoint for display clients
    if (url.pathname.endsWith('/display')) {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      await this.handleDisplayConnection(pair[1], request);

      return new Response(null, {
        status: 101,
        webSocket: pair[0],
      });
    }

    // HTTP endpoint for updates from Bun server
    if (url.pathname.endsWith('/update') && request.method === 'POST') {
      const update = await request.json<DisplayUpdate>();
      await this.handleUpdate(update);

      return new Response(
        JSON.stringify({
          success: true,
          connectedClients: this.displays.size,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // HTTP endpoint for session initialization from backend
    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      const initData = await request.json<SessionInit>();

      // Initialize conversation state
      this.conversationState.sessionId = initData.sessionId;
      this.conversationState.tenantId = initData.tenantId;
      this.conversationState.category = initData.category || 'restaurant';

      // Persist initial state
      await this.persistState();

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: this.conversationState.sessionId,
          tenantId: this.conversationState.tenantId,
          category: this.conversationState.category,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // HTTP endpoint to get current session state
    if (url.pathname.endsWith('/state') && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          success: true,
          state: this.conversationState,
          connectedClients: this.displays.size,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // HTTP endpoint for batch updates from backend
    if (url.pathname.endsWith('/batch') && request.method === 'POST') {
      const batchData = await request.json<{ updates: DisplayUpdate[] }>();

      if (!batchData.updates || !Array.isArray(batchData.updates)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid batch data' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Process each update in sequence
      for (const update of batchData.updates) {
        await this.handleUpdate(update);
      }

      return new Response(
        JSON.stringify({
          success: true,
          updatesProcessed: batchData.updates.length,
          connectedClients: this.displays.size,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Handle incoming display client connection
   */
  async handleDisplayConnection(ws: WebSocket, request: Request) {
    const url = new URL(request.url);
    // Support both 'tenant' (from frontend) and 'tenantId' (legacy) query params
    const tenantId = url.searchParams.get('tenant') || url.searchParams.get('tenantId') || 'default';
    const clientId = url.searchParams.get('clientId') || Math.random().toString(36).substring(7);

    const client: DisplayClient = {
      connectedAt: Date.now(),
      clientId,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      category: 'restaurant',
      tenantId,
    };

    this.state.acceptWebSocket(ws);
    ws.serializeAttachment(client);
    this.displays.set(ws, client);

    // Send initial state
    ws.send(JSON.stringify({
      type: 'initial_state',
      state: this.conversationState,
      timestamp: Date.now(),
    }));
  }

  /**
   * Handle display update and broadcast to clients
   */
  async handleUpdate(update: DisplayUpdate) {
    // Basic validation - type is required, timestamp is optional (we'll add it if missing)
    if (!update.type) {
      console.warn('[ConversationSession] Update missing type, ignoring');
      return;
    }

    // Add timestamp if missing (backend may not include it)
    if (!update.timestamp) {
      update.timestamp = Date.now();
    }

    // Update session state based on type
    switch (update.type) {
      case 'transcription':
        this.conversationState.transcriptions.push({
          text: update.text || '',
          speaker: update.speaker || 'assistant',
          timestamp: update.timestamp,
        });
        if (this.conversationState.transcriptions.length > this.config.maxTranscriptions) {
          this.conversationState.transcriptions = this.conversationState.transcriptions.slice(
            -this.config.maxTranscriptions
          );
        }
        break;

      default:
        // Add to display updates history
        this.conversationState.displayUpdates.push(update);
        if (this.conversationState.displayUpdates.length > this.config.maxDisplayUpdates) {
          this.conversationState.displayUpdates = this.conversationState.displayUpdates.slice(
            -this.config.maxDisplayUpdates
          );
        }
        break;

      case 'order_update':
        if (update.order) {
          this.conversationState.currentOrder = update.order;
        }
        break;
    }

    // Process update through CanvasManager
    const canvasState = this.canvasManager.processUpdate(update);
    this.conversationState.canvasState = canvasState;

    // Persist state to durable storage
    await this.persistState();

    // Broadcast to all connected displays
    this.broadcast({
      type: 'update',
      update: update,
      state: this.conversationState,
      timestamp: Date.now(),
    });
  }

  /**
   * Persist conversation state to durable storage
   */
  async persistState() {
    await this.state.storage.put(ConversationStorageKeys.STATE, this.conversationState);
  }

  /**
   * Broadcast message to all connected displays
   */
  broadcast(message: ConversationMessage) {
    const msgStr = JSON.stringify(message);
    const failed: WebSocket[] = [];

    this.state.getWebSockets().forEach((ws) => {
      try {
        ws.send(msgStr);
      } catch (err) {
        console.error('Failed to send to client:', err);
        failed.push(ws);
      }
    });

    // Clean up failed connections
    failed.forEach((ws) => {
      this.displays.delete(ws);
      try {
        ws.close();
      } catch (err) { }
    });
  }

  /**
   * Handle WebSocket message, close, and error events
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Handle incoming actions from display (e.g. user clicks on dish card)
    try {
      const msg = JSON.parse(message as string);
      if (msg.type === 'action') {
        const client = this.displays.get(ws);
        if (client) {
          console.log(`Action received from ${client.clientId}:`, msg.action, msg.data);
          // Potential to forward to backend here
        }
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.displays.delete(ws);
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: any) {
    this.displays.delete(ws);
    console.error('WebSocket error:', error);
  }
}

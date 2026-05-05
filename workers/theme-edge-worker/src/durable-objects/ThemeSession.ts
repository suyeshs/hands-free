/**
 * ThemeSession Durable Object
 * Real-time theme collaboration with WebSocket Hibernation
 * Handles theme updates, broadcasting, and multi-user coordination
 */

import type {
  SessionData,
  Message,
  ThemeData,
  ThemeVersion,
  ThemeSessionConfig,
  InitialMessage,
  ThemeUpdateMessage,
  ComponentUpdateMessage,
  CursorMoveMessage,
  UserJoinedMessage,
  UserLeftMessage,
} from './types';
import { StorageKeys, DEFAULT_CONFIG } from './types';

export class ThemeSession implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, SessionData>;
  private currentTheme: ThemeData | null;
  private config: ThemeSessionConfig;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.sessions = new Map();
    this.currentTheme = null;
    this.config = DEFAULT_CONFIG;

    // Restore hibernated sessions
    this.state.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment();
      if (attachment) {
        this.sessions.set(ws, attachment as SessionData);
      }
    });

    // Set up WebSocket auto-response for keep-alive
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }

  /**
   * Handle HTTP requests (WebSocket upgrade + REST API)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // REST API endpoints
    switch (url.pathname) {
      case '/theme':
        return this.handleThemeRequest(request);
      case '/versions':
        return this.handleVersionsRequest(request);
      case '/users':
        return this.handleUsersRequest(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket with hibernation support
    this.state.acceptWebSocket(server);

    // Extract session data from headers
    const sessionData: SessionData = {
      userId: request.headers.get('X-User-Id') || `user-${crypto.randomUUID().slice(0, 8)}`,
      deviceId: request.headers.get('X-Device-Id') || `device-${crypto.randomUUID().slice(0, 8)}`,
      userName: request.headers.get('X-User-Name') || undefined,
      userColor: request.headers.get('X-User-Color') || this.generateUserColor(),
      joinedAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Serialize session data for hibernation
    server.serializeAttachment(sessionData);
    this.sessions.set(server, sessionData);

    // Load theme if not cached
    if (!this.currentTheme) {
      this.currentTheme = await this.state.storage.get<ThemeData>(StorageKeys.THEME) || null;
    }

    // Send initial state
    const initialMessage: InitialMessage = {
      type: 'initial',
      theme: this.currentTheme,
      session: sessionData,
      users: Array.from(this.sessions.values()),
      timestamp: Date.now(),
    };

    server.send(JSON.stringify(initialMessage));

    // Notify other users
    const userJoinedMessage: UserJoinedMessage = {
      type: 'userJoined',
      user: sessionData,
      timestamp: Date.now(),
    };

    this.broadcast(userJoinedMessage, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data: Message = typeof message === 'string'
        ? JSON.parse(message)
        : JSON.parse(new TextDecoder().decode(message as ArrayBuffer));

      const sessionData = this.sessions.get(ws);
      if (!sessionData) {
        ws.send(JSON.stringify({ type: 'error', error: 'Session not found' }));
        return;
      }

      // Update last activity
      sessionData.lastActivity = Date.now();

      // Handle message by type
      switch (data.type) {
        case 'themeUpdate':
          await this.handleThemeUpdate(ws, data as ThemeUpdateMessage);
          break;

        case 'componentUpdate':
          await this.handleComponentUpdate(ws, data as ComponentUpdateMessage);
          break;

        case 'cursorMove':
          this.handleCursorMove(ws, data as CursorMoveMessage);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'versionRestore':
          await this.handleVersionRestore(ws, data);
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            error: `Unknown message type: ${(data as any).type}`
          }));
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const sessionData = this.sessions.get(ws);
    this.sessions.delete(ws);

    if (sessionData) {
      const userLeftMessage: UserLeftMessage = {
        type: 'userLeft',
        user: sessionData,
        timestamp: Date.now(),
      };

      this.broadcast(userLeftMessage);
    }
  }

  /**
   * Handle WebSocket error
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
  }

  /**
   * Handle theme update
   */
  private async handleThemeUpdate(ws: WebSocket, data: ThemeUpdateMessage): Promise<void> {
    const sessionData = this.sessions.get(ws)!;

    // Merge theme changes
    this.currentTheme = {
      ...this.currentTheme,
      ...data.changes,
    } as ThemeData;

    // Persist to storage
    await this.state.storage.put(StorageKeys.THEME, this.currentTheme);

    // Save version
    await this.saveVersion({
      id: crypto.randomUUID(),
      changes: data.changes,
      message: data.message,
      userId: sessionData.userId,
      timestamp: Date.now(),
    });

    // Broadcast to all clients
    const updateMessage: ThemeUpdateMessage = {
      type: 'themeUpdate',
      changes: data.changes,
      userId: sessionData.userId,
      message: data.message,
      timestamp: Date.now(),
    };

    this.broadcast(updateMessage);
  }

  /**
   * Handle component update
   */
  private async handleComponentUpdate(ws: WebSocket, data: ComponentUpdateMessage): Promise<void> {
    const sessionData = this.sessions.get(ws)!;
    const componentKey = StorageKeys.COMPONENT(data.componentId);

    // Get existing component
    const component = await this.state.storage.get<Record<string, any>>(componentKey) || {};

    // Merge props
    const updated = {
      ...component,
      ...data.props,
      updatedAt: Date.now(),
      updatedBy: sessionData.userId,
    };

    // Persist
    await this.state.storage.put(componentKey, updated);

    // Broadcast to all except sender
    const updateMessage: ComponentUpdateMessage = {
      type: 'componentUpdate',
      componentId: data.componentId,
      props: updated,
      userId: sessionData.userId,
      timestamp: Date.now(),
    };

    this.broadcast(updateMessage, ws);
  }

  /**
   * Handle cursor move
   */
  private handleCursorMove(ws: WebSocket, data: CursorMoveMessage): void {
    const sessionData = this.sessions.get(ws)!;

    const cursorMessage: CursorMoveMessage = {
      type: 'cursorMove',
      userId: sessionData.userId,
      position: data.position,
      timestamp: Date.now(),
    };

    this.broadcast(cursorMessage, ws);
  }

  /**
   * Handle version restore
   */
  private async handleVersionRestore(ws: WebSocket, data: any): Promise<void> {
    const version = await this.state.storage.get<ThemeVersion>(`version:${data.versionId}`);

    if (version) {
      // Restore theme
      this.currentTheme = {
        ...this.currentTheme,
        ...version.changes,
      } as ThemeData;

      await this.state.storage.put(StorageKeys.THEME, this.currentTheme);

      // Broadcast to all
      this.broadcast({
        type: 'versionRestore',
        version,
        timestamp: Date.now(),
      });
    } else {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Version not found'
      }));
    }
  }

  /**
   * Save theme version
   */
  private async saveVersion(version: ThemeVersion): Promise<void> {
    // Save version
    await this.state.storage.put(`version:${version.id}`, version);

    // Update version history
    const history = await this.state.storage.get<string[]>(StorageKeys.VERSION_HISTORY) || [];
    history.push(version.id);

    // Keep only last N versions
    if (history.length > this.config.maxVersions) {
      const removed = history.shift();
      if (removed) {
        await this.state.storage.delete(`version:${removed}`);
      }
    }

    await this.state.storage.put(StorageKeys.VERSION_HISTORY, history);
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: Message, exclude?: WebSocket): void {
    const json = JSON.stringify(message);

    this.state.getWebSockets().forEach((ws) => {
      if (ws !== exclude && ws.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          ws.send(json);
        } catch (error) {
          console.error('Failed to send message to client:', error);
        }
      }
    });
  }

  /**
   * Handle REST API theme request
   */
  private async handleThemeRequest(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const theme = await this.state.storage.get<ThemeData>(StorageKeys.THEME);
      return new Response(JSON.stringify(theme), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'PUT') {
      const theme = await request.json() as ThemeData;
      await this.state.storage.put(StorageKeys.THEME, theme);
      this.currentTheme = theme;

      this.broadcast({
        type: 'themeUpdate',
        changes: theme,
        userId: 'system',
        timestamp: Date.now(),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Handle versions request
   */
  private async handleVersionsRequest(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const historyIds = await this.state.storage.get<string[]>(StorageKeys.VERSION_HISTORY) || [];
      const versions = await Promise.all(
        historyIds.map(id => this.state.storage.get<ThemeVersion>(`version:${id}`))
      );

      return new Response(JSON.stringify(versions.filter(Boolean)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Handle users request
   */
  private async handleUsersRequest(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const users = Array.from(this.sessions.values());
      return new Response(JSON.stringify(users), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Generate random user color
   */
  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

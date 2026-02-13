/**
 * Durable Objects Type Definitions
 * Message types and interfaces for real-time theme collaboration
 */

// ============================================================================
// Session Types
// ============================================================================

export interface SessionData {
  /** Unique user identifier */
  userId: string;
  /** Device identifier for multi-device support */
  deviceId: string;
  /** User display name */
  userName?: string;
  /** User avatar color */
  userColor?: string;
  /** Timestamp when user joined */
  joinedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType =
  | 'initial'           // Initial state on connection
  | 'themeUpdate'       // Theme property changes
  | 'componentUpdate'   // Component property changes
  | 'cursorMove'        // User cursor position
  | 'userJoined'        // New user connected
  | 'userLeft'          // User disconnected
  | 'ping'              // Keep-alive ping
  | 'pong'              // Keep-alive pong
  | 'error'             // Error message
  | 'versionRestore'    // Restore theme version
  | 'ack';              // Acknowledgment

/**
 * Base message interface
 */
export interface BaseMessage {
  type: MessageType;
  timestamp?: number;
}

/**
 * Initial state message sent on connection
 */
export interface InitialMessage extends BaseMessage {
  type: 'initial';
  theme: any;
  session: SessionData;
  users: SessionData[];
}

/**
 * Theme update message
 */
export interface ThemeUpdateMessage extends BaseMessage {
  type: 'themeUpdate';
  changes: Record<string, any>;
  userId: string;
  message?: string;
}

/**
 * Component update message
 */
export interface ComponentUpdateMessage extends BaseMessage {
  type: 'componentUpdate';
  componentId: string;
  props: Record<string, any>;
  userId: string;
}

/**
 * Cursor position message
 */
export interface CursorMoveMessage extends BaseMessage {
  type: 'cursorMove';
  userId: string;
  position: { x: number; y: number };
}

/**
 * User joined message
 */
export interface UserJoinedMessage extends BaseMessage {
  type: 'userJoined';
  user: SessionData;
}

/**
 * User left message
 */
export interface UserLeftMessage extends BaseMessage {
  type: 'userLeft';
  user: SessionData;
}

/**
 * Ping/Pong messages
 */
export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
  code?: string;
}

/**
 * Version restore message
 */
export interface VersionRestoreMessage extends BaseMessage {
  type: 'versionRestore';
  version: ThemeVersion;
}

/**
 * Acknowledgment message
 */
export interface AckMessage extends BaseMessage {
  type: 'ack';
  messageId: string;
}

/**
 * Union type of all messages
 */
export type Message =
  | InitialMessage
  | ThemeUpdateMessage
  | ComponentUpdateMessage
  | CursorMoveMessage
  | UserJoinedMessage
  | UserLeftMessage
  | PingMessage
  | PongMessage
  | ErrorMessage
  | VersionRestoreMessage
  | AckMessage;

// ============================================================================
// Theme Types
// ============================================================================

export interface ThemeVersion {
  id: string;
  changes: Record<string, any>;
  message?: string;
  userId: string;
  timestamp: number;
}

export interface ThemeData {
  id: string;
  name: string;
  platform: 'web' | 'mobile' | 'both';
  colors?: Record<string, string>;
  typography?: Record<string, any>;
  spacing?: Record<string, string>;
  shadows?: Record<string, string>;
  borderRadius?: Record<string, string>;
  components?: Record<string, any>;
  [key: string]: any;
}

// ============================================================================
// Storage Keys
// ============================================================================

export const StorageKeys = {
  THEME: 'theme',
  VERSION_HISTORY: 'versionHistory',
  COMPONENT: (id: string) => `component:${id}`,
  USER_SETTINGS: (userId: string) => `user:${userId}`,
} as const;

// ============================================================================
// Configuration
// ============================================================================

export interface ThemeSessionConfig {
  /** Maximum number of versions to keep */
  maxVersions: number;
  /** Ping interval in milliseconds */
  pingInterval: number;
  /** Session timeout in milliseconds */
  sessionTimeout: number;
  /** Maximum message size in bytes */
  maxMessageSize: number;
}

export const DEFAULT_CONFIG: ThemeSessionConfig = {
  maxVersions: 100,
  pingInterval: 30000, // 30 seconds
  sessionTimeout: 300000, // 5 minutes
  maxMessageSize: 1024 * 1024, // 1MB
};

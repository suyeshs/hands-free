/**
 * Conversation Session Types
 * Types for multimodal conversation with real-time display updates
 */

export interface DisplayClient {
  connectedAt: number;
  clientId: string;
  userAgent: string;
  category: 'financial' | 'restaurant';
  tenantId: string;
}

export interface Transcription {
  text: string;
  speaker: 'user' | 'assistant';
  timestamp: number;
}

export interface Order {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  estimatedTime?: number;
}

export interface OrderItem {
  dishName: string;
  quantity: number;
  customizations: string[];
  itemPrice: number;
}

export interface Dish {
  name: string;
  description: string;
  price: number;
  imageUrl: string;  // Normalized to single field name
  allergens?: string[];
  dietary?: string[];
  spiceLevel?: number;
  customizations?: string[];
  nutritionalInfo?: Record<string, any>;
}

/**
 * DisplayUpdate types for multimodal display updates
 * Backend sends: { type: 'dish_card', data: {...} }
 * ConversationSession broadcasts this to all connected clients
 */
export type DisplayUpdateType =
  | 'transcription'
  | 'dish_card'
  | 'menu_section'
  | 'menu_grid'
  | 'order_summary'
  | 'order_update'
  | 'confirmation'
  | 'checkout_summary'
  | 'payment_pending'
  | 'order_confirmed'
  | 'address_verification'
  | 'manual_address_form'
  | 'cart_item_added'
  | 'cart_updated'
  | 'customer_update'
  | 'customer_addresses'
  | 'webpage'
  | 'snippet'
  | 'advice_card'
  | 'product_comparison'
  | 'document_viewer';

export interface DisplayUpdate {
  type: DisplayUpdateType;
  timestamp: number;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;

  // Transcription fields (when type === 'transcription')
  text?: string;
  speaker?: 'user' | 'assistant';
  isFinal?: boolean;

  // Data payload for non-transcription updates
  // Contains type-specific fields (name, price, items, etc.)
  data?: Record<string, any>;

  // Legacy field - use data instead
  order?: Order;
}

export interface ConversationState {
  sessionId: string;
  tenantId: string;
  category: 'financial' | 'restaurant';
  currentOrder: Order | null;
  transcriptions: Transcription[];
  displayUpdates: DisplayUpdate[];
  themeData?: any;
  canvasState?: CanvasState;
  startedAt: number;
}

export type CanvasLayoutMode = 'grid' | 'highlight' | 'stack';

export interface RankedPrimitive {
  id: string;
  type: string;
  data: any;
  score: number;
}

export interface CanvasState {
  layoutMode: CanvasLayoutMode;
  activePrimitives: RankedPrimitive[];
  priorityHints: Record<string, { priority: string; metadata: any; timestamp: number }>;
}

export interface SessionInit {
  sessionId: string;
  tenantId: string;
  category: 'financial' | 'restaurant';
}

export interface ConversationMessage {
  type: 'initial_state' | 'update' | 'ping' | 'pong';
  state?: ConversationState;
  update?: DisplayUpdate;
  timestamp: number;
}

// Storage keys
export enum ConversationStorageKeys {
  STATE = 'conversation:state',
  TRANSCRIPTIONS = 'conversation:transcriptions',
  DISPLAY_UPDATES = 'conversation:display_updates',
  THEME = 'conversation:theme',
}

// Default configuration
export const DEFAULT_CONVERSATION_CONFIG = {
  maxTranscriptions: 100,
  maxDisplayUpdates: 50,
  sessionTimeout: 3600000, // 1 hour
  pingInterval: 30000, // 30 seconds
};

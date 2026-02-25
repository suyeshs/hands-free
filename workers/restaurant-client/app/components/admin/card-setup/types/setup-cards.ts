/**
 * Type definitions for Card-Based Setup Flow
 * Handsfree Platform - Restaurant Admin Setup
 */

import { LucideIcon } from 'lucide-react';

/**
 * Setup Card Identifiers
 */
export enum SetupCardId {
  RESTAURANT = 'restaurant',
  MENU = 'menu',
  THEME = 'theme',
  AI = 'ai',
  POS = 'pos',
}

/**
 * Card Completion Status
 */
export enum CardStatus {
  INCOMPLETE = 'incomplete',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
}

/**
 * Payment Gateway Configuration
 */
export interface PaymentConfig {
  useHandsfreeAccount: boolean;
  porterApiKey?: string;
  porterSecretKey?: string;
  razorpayKeyId?: string;
  razorpaySecretKey?: string;
}

/**
 * Restaurant Basic Information
 */
export interface RestaurantData {
  name: string;
  cuisine: string;
  address: string;
  phone: string;
  email: string;
  hours?: string;
  about?: string;
}

/**
 * Menu Item
 */
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
  available?: boolean;
}

/**
 * Theme Configuration
 */
export interface ThemeConfig {
  preset: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  tagline?: string;
}

/**
 * AI Configuration
 */
export interface AIConfig {
  voicePreset: string;
  tone: string;
  languages: string[];
  customInstructions?: string;
}

/**
 * Individual Setup Card Data
 */
export interface SetupCardData {
  id: SetupCardId;
  title: string;
  description: string;
  icon: LucideIcon;
  status: CardStatus;
  required: boolean;
  data?: any; // Card-specific data
}

/**
 * Complete Card Setup State
 */
export interface CardSetupState {
  activeCardId: SetupCardId | null;
  cards: Record<SetupCardId, SetupCardData>;
  paymentConfig: PaymentConfig;
  restaurantData: RestaurantData | null;
  menuItems: MenuItem[];
  themeConfig: ThemeConfig | null;
  aiConfig: AIConfig | null;
  completionStatus: Record<SetupCardId, boolean>;
}

/**
 * Card Setup Context API
 */
export interface CardSetupContextValue {
  state: CardSetupState;

  // Card Navigation
  openCard: (cardId: SetupCardId) => void;
  closeCard: () => void;

  // Completion Management
  markCardComplete: (cardId: SetupCardId) => void;
  markCardInProgress: (cardId: SetupCardId) => void;
  markCardIncomplete: (cardId: SetupCardId) => void;

  // Data Management
  saveRestaurantData: (data: RestaurantData) => Promise<void>;
  savePaymentConfig: (config: PaymentConfig) => Promise<void>;
  saveMenuItems: (items: MenuItem[]) => Promise<void>;
  saveThemeConfig: (config: ThemeConfig) => Promise<void>;
  saveAIConfig: (config: AIConfig) => Promise<void>;

  // Utilities
  canGoLive: () => boolean;
  getCompletionPercentage: () => number;

  // Backend Sync
  syncWithBackend: () => Promise<void>;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
}

/**
 * Setup Card Props (for SetupCard component)
 */
export interface SetupCardProps {
  id: SetupCardId;
  title: string;
  description: string;
  icon: LucideIcon;
  status: CardStatus;
  isActive: boolean;
  isCompact: boolean;
  required: boolean;
  onClick: () => void;
}

/**
 * Card Form Container Props
 */
export interface CardFormContainerProps {
  cardId: SetupCardId;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Form Save Handler
 */
export type FormSaveHandler<T> = (data: T) => Promise<void>;

/**
 * Restaurant Setup Form Data
 */
export interface RestaurantSetupFormData {
  restaurantData: RestaurantData;
  paymentConfig: PaymentConfig;
}

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
  CARD_SETUP_STATE: 'handsfree_card_setup_state',
  COMPLETION_STATUS: 'handsfree_completion_status',
  PAYMENT_CONFIG: 'handsfree_payment_config',
  RESTAURANT_DATA: 'handsfree_restaurant_data',
  MENU_ITEMS: 'handsfree_menu_items',
  THEME_CONFIG: 'handsfree_theme_config',
  AI_CONFIG: 'handsfree_ai_config',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  RESTAURANT: '/api/restaurant/setup/restaurant',
  MENU: '/api/restaurant/setup/menu',
  THEME: '/api/config/theme',
  AI: '/api/restaurant/setup/ai',
  STATUS: '/api/restaurant/setup/status',
  ACTIVATE: '/api/restaurant/setup/activate',
} as const;

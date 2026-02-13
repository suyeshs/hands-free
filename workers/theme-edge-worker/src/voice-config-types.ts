/**
 * Voice Configuration Types for Tenant-Specific Voice AI Settings
 * Enables dynamic prompt management without code deployments
 */

export type VoiceCategory = 'restaurant' | 'travel' | 'financial';

export type VoiceTone = 'casual' | 'professional' | 'friendly' | 'formal';
export type VoiceFormality = 'informal' | 'semi-formal' | 'formal';
export type PromptMode = 'replace' | 'append' | 'prepend';

export interface TenantVoiceBranding {
  name: string;              // Display name (e.g., "The Coorg Food Company")
  shortName?: string;        // Short name for audio (e.g., "Coorg Food")
  tagline?: string;          // Brand tagline
  logo?: string;             // Logo URL for display
  favicon?: string;          // Favicon URL
}

export interface TenantVoiceSettings {
  name: string;              // Voice name: Aoede, Kore, Puck, Charon
  language: string;          // Default language: en-IN, hi-IN, etc.
  temperature?: number;      // Generation temperature (0.0-1.0)
  accent?: string;           // Accent override if supported
}

export interface TenantVoicePrompts {
  // System instructions
  systemPrompt?: string;     // Custom system instructions
  promptMode: PromptMode;    // How to apply systemPrompt

  // Greeting templates
  welcomeGreeting: string;   // First greeting: "Welcome to {name}!"
  returningCustomerGreeting?: string;  // Greeting for returning customers
  newCustomerGreeting?: string;        // Greeting for new customers
  firstTimeUserDiscovery?: string;     // Help choosing flow: "I'd love to help! First, do you prefer..."
  choiceHandling?: string;             // Choice handling: "Which {choiceType} would you like? We have: {choicesList}"

  // Conversation templates (category-specific)
  templates: {
    // Restaurant-specific
    menuRecommendation?: string;
    dishDescription?: string;
    orderConfirmation?: string;
    checkoutPrompt?: string;
    timeBasedSuggestion?: string;      // Time-based recommendations: "Since it's {timeOfDay}, how about our {timeCategory} favorites?"

    // Travel-specific
    flightRecommendation?: string;
    hotelRecommendation?: string;
    itineraryConfirmation?: string;

    // Financial-specific
    fraudAlert?: string;
    transactionConfirmation?: string;

    // Generic templates
    [key: string]: string | undefined;
  };
}

export interface TenantVoiceBehavior {
  tone: VoiceTone;
  formality: VoiceFormality;
  personality?: string[];    // e.g., ["enthusiastic", "helpful", "patient"]

  // Conversation flow settings
  askNameImmediately?: boolean;
  requirePhoneNumber?: boolean;
  enableProactiveRecommendations?: boolean;
}

export interface TenantVoiceFeatures {
  // Restaurant
  multilingualSupport?: boolean;
  collaborativeOrdering?: boolean;
  autoSaveAddresses?: boolean;

  // Travel
  groupTripPlanning?: boolean;
  multiCityBooking?: boolean;

  // Financial
  fraudDetection?: boolean;
  multiAccountSupport?: boolean;

  // Generic features
  [key: string]: boolean | undefined;
}

export interface TenantVoiceConfig {
  // Tenant identification
  tenantId: string;
  category: VoiceCategory;

  // Configuration sections
  branding: TenantVoiceBranding;
  voice: TenantVoiceSettings;
  prompts: TenantVoicePrompts;
  behavior: TenantVoiceBehavior;
  features?: TenantVoiceFeatures;

  // Metadata
  version: number;               // Config version for tracking updates
  updatedAt: number;             // Timestamp of last update
  updatedBy: string;             // User/system that made the update
  active: boolean;               // Whether this config is active
}

export interface VoiceConfigUpdate {
  branding?: Partial<TenantVoiceBranding>;
  voice?: Partial<TenantVoiceSettings>;
  prompts?: Partial<TenantVoicePrompts>;
  behavior?: Partial<TenantVoiceBehavior>;
  features?: Partial<TenantVoiceFeatures>;
  updatedBy?: string;
}

export interface VoiceConfigResponse {
  success: boolean;
  config?: TenantVoiceConfig;
  error?: string;
  previousVersion?: number;
  newVersion?: number;
}

export interface VoiceConfigHistoryEntry {
  version: number;
  updatedAt: number;
  updatedBy: string;
  changes: {
    [key: string]: {
      from: any;
      to: any;
    };
  };
}

/**
 * Get default voice config for a tenant
 */
export function getDefaultVoiceConfig(
  tenantId: string,
  category: VoiceCategory = 'restaurant'
): TenantVoiceConfig {
  return {
    tenantId,
    category,
    branding: {
      name: 'Restaurant',
      shortName: 'Restaurant',
    },
    voice: {
      name: 'Aoede',
      language: 'en-IN',
      temperature: 0.9,
    },
    prompts: {
      promptMode: 'append',
      welcomeGreeting: 'Welcome! How may I help you today?',
      templates: {},
    },
    behavior: {
      tone: 'casual',
      formality: 'informal',
      personality: ['warm', 'helpful'],
    },
    version: 0,
    updatedAt: Date.now(),
    updatedBy: 'system',
    active: true,
  };
}

/**
 * Default voice config for Coorg Food Company
 */
export function getCoorgFoodCompanyConfig(tenantId: string = 'coorg-food-company'): TenantVoiceConfig {
  return {
    tenantId,
    category: 'restaurant',
    branding: {
      name: 'The Coorg Food Company',
      shortName: 'CFC',
      tagline: 'Authentic Coorg Cuisine',
    },
    voice: {
      name: 'Aoede',
      language: 'en-IN',
      temperature: 0.9,
    },
    prompts: {
      promptMode: 'replace',
      welcomeGreeting: 'Welcome to Coorg Food Company, how may I help you today?',
      returningCustomerGreeting: 'Welcome back to Coorg Food Company, {customerName}! How may I help you today?',
      newCustomerGreeting: 'Welcome to Coorg Food Company! How may I help you today?',
      templates: {
        menuRecommendation: "I'd love to recommend our signature {dishName}. {description}. Would you like to try it?",
        orderConfirmation: 'Perfect! I\'ve added {quantity} {dishName} to your order.',
        checkoutPrompt: 'Your order looks great! Would you like to proceed to checkout?',
      },
    },
    behavior: {
      tone: 'casual',
      formality: 'informal',
      personality: ['warm', 'enthusiastic', 'helpful'],
      requirePhoneNumber: false,
      enableProactiveRecommendations: true,
    },
    features: {
      multilingualSupport: true,
      collaborativeOrdering: true,
      autoSaveAddresses: true,
    },
    version: 1,
    updatedAt: Date.now(),
    updatedBy: 'system',
    active: true,
  };
}

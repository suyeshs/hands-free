/**
 * Type definitions for theme edge worker
 */

export interface Env {
  // KV Namespace
  THEME_KV: KVNamespace;
  VOICE_CONFIGS?: KVNamespace; // Voice AI configuration storage
  TENANT_METADATA?: KVNamespace; // Tenant metadata storage

  // Durable Objects
  THEME_DO: DurableObjectNamespace;
  THEME_SESSION: DurableObjectNamespace;
  CONVERSATION_SESSION: DurableObjectNamespace;

  // D1 Database
  THEME_DB: D1Database;
  DB?: D1Database; // Alias for compatibility
  MENU_DB?: D1Database; // Menu & voice config database (stonepot-menu-db)

  // Analytics Engine
  ANALYTICS: AnalyticsEngineDataset;

  // Queues
  THEME_QUEUE: Queue;
  
  // Secrets
  CACHE_PURGE_TOKEN: string;
  SIGNING_KEY: string;
  TURNSTILE_SECRET?: string;
  THEME_API_TOKEN?: string; // For admin-app API access
  GROK_API_KEY: string; // xAI Grok API key for AI theme generation

  // Environment variables
  ENVIRONMENT: string;
  ZONE_ID?: string;
  ACCESS_TEAM?: string;
}

export interface ThemeJSON {
  version: string;
  meta: {
    name: string;
    description?: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  };
  global: {
    colors: {
      primary: ColorScale;
      secondary?: ColorScale;
      accent?: ColorScale;
      background: {
        main: string;
        gradient?: {
          from: string;
          to: string;
          direction: string;
        };
      };
    };
    typography: {
      fontFamily: {
        sans: string[];
        serif?: string[];
        mono?: string[];
        heading?: string[];
      };
      scale: Record<string, string>;
    };
    spacing: {
      scale: number;
      unit: 'px' | 'rem';
    };
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
  };
  components: {
    avatarGrid?: {
      layout: {
        columns: {
          mobile: number;
          tablet: number;
          desktop: number;
          largeDesktop: number;
        };
        gap: string;
        aspectRatio: string;
      };
      card: Record<string, any>;
      header: Record<string, any>;
    };
    avatarDetail?: {
      layout: {
        style: 'stacked' | 'split' | 'overlay' | 'minimal';
        maxWidth: string;
        imageAspectRatio: string;
      };
      button: Record<string, any>;
    };
  };
  customCSS?: string;
  animations?: {
    duration: Record<string, string>;
    easing: string;
  };
  signature?: string;
}

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface CacheMetrics {
  hit: number;
  miss: number;
  total: number;
  hitRate: number;
}

export interface AnalyticsEvent {
  timestamp: number;
  tenantId: string;
  cacheStatus: 'hit' | 'miss';
  latency: number;
  region: string;
}

export interface ThemeUpdateMessage {
  tenantId: string;
  action: 'update' | 'delete';
  timestamp: number;
  userId?: string;
}


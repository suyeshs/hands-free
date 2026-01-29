/**
 * Application Configuration
 * Single source of truth for app config - no more .env confusion!
 */

import appConfigJson from '../../app.config.json';

type Environment = 'development' | 'production';

interface AppConfig {
  skipAuth: boolean;
  defaultTenantId: string | null;
  backendApiUrl: string;
  adminPanelUrl: string;
  platformApiUrl: string;
  ordersApiUrl: string;
  ordersWsUrl: string;
}

const ENV: Environment = import.meta.env.MODE === 'production' ? 'production' : 'development';

// Load config from JSON based on environment
const config: AppConfig = appConfigJson[ENV];

console.log('[AppConfig] Environment:', ENV);
console.log('[AppConfig] Configuration loaded:', config);

// Export individual config values for easy access
export const SKIP_AUTH = config.skipAuth;
export const DEFAULT_TENANT_ID = config.defaultTenantId;
export const BACKEND_API_URL = config.backendApiUrl;
export const ADMIN_PANEL_URL = config.adminPanelUrl;
export const PLATFORM_API_URL = config.platformApiUrl;
export const ORDERS_API_URL = config.ordersApiUrl;
export const ORDERS_WS_URL = config.ordersWsUrl;

// Export full config object
export default config;

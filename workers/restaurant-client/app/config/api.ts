/**
 * Centralized API Configuration
 *
 * All backend URLs should be imported from here.
 * Environment variables are set in wrangler.jsonc for production.
 */

import { getTenantId } from '../lib/restaurant-config-loader';

// Backend API URL (Cloud Run - handles voice, orders, menu, etc.)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-265169210248.us-central1.run.app';

// Alias for backward compatibility
export const BACKEND_URL = API_URL;

// Theme/Edge Worker URL (Cloudflare Worker)
export const THEME_WORKER_URL = process.env.NEXT_PUBLIC_THEME_WORKER_URL || 'https://theme-edge-worker.suyesh.workers.dev';

// Restaurant Worker URL (Cloudflare Worker - customer data)
// Always route to the canonical *.handsfree.tech tenant subdomain so API calls reach
// the tenant worker even when the app is served from a custom domain (e.g. thecoorgfoodco.com).
function getRestaurantWorkerUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev';
  }
  const hostname = window.location.hostname;
  // Already on the tenant subdomain — use origin directly
  if (hostname.endsWith('.handsfree.tech')) {
    return window.location.origin;
  }
  // Custom domain or localhost — derive tenant ID then build the subdomain URL
  const tenantId = getTenantId();
  return `https://${tenantId}.handsfree.tech`;
}
export const RESTAURANT_WORKER_URL = getRestaurantWorkerUrl();

// WebSocket URL (derived from API_URL)
export const getWebSocketUrl = (path: string) => {
  return API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + path;
};

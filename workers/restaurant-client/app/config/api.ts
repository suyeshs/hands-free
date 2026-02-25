/**
 * Centralized API Configuration
 *
 * All backend URLs should be imported from here.
 * Environment variables are set in wrangler.jsonc for production.
 */

// Backend API URL (Cloud Run - handles voice, orders, menu, etc.)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-265169210248.us-central1.run.app';

// Alias for backward compatibility
export const BACKEND_URL = API_URL;

// Theme/Edge Worker URL (Cloudflare Worker)
export const THEME_WORKER_URL = process.env.NEXT_PUBLIC_THEME_WORKER_URL || 'https://theme-edge-worker.suyesh.workers.dev';

// Restaurant Worker URL (Cloudflare Worker - customer data)
// In the browser, use the current tenant domain (window.location.origin) so API calls
// go to the same origin (e.g. coorg-food-company-6943.handsfree.tech) and avoid CORS issues.
// The restaurant worker handles all *.handsfree.tech/* routes including /api/customers.
export const RESTAURANT_WORKER_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL || 'https://handsfree-restaurant.suyesh.workers.dev');

// WebSocket URL (derived from API_URL)
export const getWebSocketUrl = (path: string) => {
  return API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + path;
};

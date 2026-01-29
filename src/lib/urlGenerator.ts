/**
 * URL Generation Utilities for Online Presence
 *
 * Generates customer-facing URLs based on tenant configuration.
 * Note: Subdomain is set during provisioning and cannot be changed.
 */

import { useTenantStore } from '../stores/tenantStore';

/**
 * Generate the customer-facing site URL
 *
 * Priority:
 * 1. Tenant subdomain (subdomain.handsfree.tech) - set during provisioning
 * 2. Localhost (development fallback)
 *
 * Note: Subdomain is READ-ONLY, set during tenant activation
 */
export function generateCustomerSiteUrl(options?: {
  useLocalhost?: boolean;
  path?: string;
}): string {
  const path = options?.path || '';

  // Check if we should force localhost
  if (options?.useLocalhost) {
    return `http://localhost:5173${path}`;
  }

  // Try to get tenant subdomain (set during provisioning)
  const tenant = useTenantStore.getState().tenant;

  if (tenant?.subdomain) {
    return `https://${tenant.subdomain}.handsfree.tech${path}`;
  }

  // Fallback to localhost for development or if tenant not provisioned
  if (import.meta.env.DEV || typeof window !== 'undefined') {
    return `http://localhost:5173${path}`;
  }

  // Last resort fallback
  return 'https://handsfree.tech';
}

/**
 * Get the customer menu URL (for Visit Site button)
 */
export function getCustomerMenuUrl(): string {
  return generateCustomerSiteUrl({ path: '/#/order' });
}

/**
 * Get URL for specific table ordering
 */
export function getTableOrderUrl(tableId: string): string {
  return generateCustomerSiteUrl({ path: `/#/table/${tableId}` });
}

/**
 * Check if tenant subdomain is configured
 */
export function hasSubdomainConfigured(): boolean {
  const tenant = useTenantStore.getState().tenant;
  return !!tenant?.subdomain && tenant.subdomain.length > 0;
}

/**
 * Get the tenant subdomain (read-only)
 */
export function getTenantSubdomain(): string | null {
  const tenant = useTenantStore.getState().tenant;
  return tenant?.subdomain || null;
}

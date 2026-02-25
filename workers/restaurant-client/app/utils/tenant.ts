/**
 * Tenant ID extraction utility
 * Supports multiple hostname formats for the routing architecture
 */

/**
 * Extract tenant ID from current hostname
 * Supports:
 * - Direct access: handsfree-restaurant-client.suyesh.workers.dev → 'demo'
 * - Proxied access: test-restaurant-2025.handsfree.tech → 'test-restaurant-2025'
 * - Subdomain format: tenant.domain.com → 'tenant'
 * - Localhost: localhost:3000 → 'demo'
 */
export function getTenantId(): string {
  if (typeof window === 'undefined') {
    return 'demo';
  }

  // Support forcing tenant via query parameter (useful for debugging)
  const urlParams = new URLSearchParams(window.location.search);
  const forcedTenant = urlParams.get('tenant');
  if (forcedTenant) {
    return forcedTenant;
  }

  const hostname = window.location.hostname;

  // Localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'demo';
  }

  // Direct worker access (not proxied)
  if (hostname.includes('handsfree-restaurant-client') || hostname.includes('.workers.dev')) {
    // Check if it's a subdomain of the worker URL
    const parts = hostname.split('.');
    if (parts.length >= 4) {
      return parts[0];
    }
    return 'demo';
  }

  // Extract tenant from hostname
  // Format: tenant-name.handsfree.tech → 'tenant-name'
  // Format: tenant.customdomain.com → 'tenant'
  const parts = hostname.split('.');

  if (parts.length >= 2) {
    const subdomain = parts[0];

    // Validate subdomain is not empty
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }

  // Fallback to demo
  console.warn('[Tenant] Could not extract tenant ID from hostname:', hostname);
  return 'demo';
}

/**
 * Get API base URL for backend requests
 * Uses environment variable or default Cloudflare Workers endpoint
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'https://handsfree-domain-service-prod.suyesh.workers.dev';
}

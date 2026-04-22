/**
 * Restaurant Config Loader - Fetches restaurant profile from backend
 * Includes caching and tenant detection
 */

import { RestaurantProfile } from '../types/restaurant';

/**
 * Get tenant ID from hostname
 * Examples:
 *   - demo.handsfree.tech -> demo
 *   - tcfc.handsfree.tech -> tcfc
 *   - localhost:3000 -> demo (fallback)
 */
export function getTenantId(): string {
  if (typeof window === 'undefined') {
    // Server-side: check environment or default to demo
    return process.env.NEXT_PUBLIC_TENANT_ID || 'demo';
  }

  // Support forcing tenant via query parameter (useful for debugging)
  const urlParams = new URLSearchParams(window.location.search);
  const forcedTenant = urlParams.get('tenant');
  if (forcedTenant) {
    return forcedTenant;
  }

  const hostname = window.location.hostname;

  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'khao-piyo-7766';
  }

  // Cloudflare Workers dev (*.workers.dev)
  if (hostname.includes('.workers.dev')) {
    // If it's a subdomain of workers.dev (e.g. tenant.worker.workers.dev)
    const parts = hostname.split('.');
    if (parts.length >= 4) {
      return parts[0];
    }
    return 'demo';
  }

  // Custom domains — map to the canonical tenant subdomain
  const CUSTOM_DOMAIN_TENANT_MAP: Record<string, string> = {
    'thecoorgfoodco.com': 'coorg-food-company-1413',
    'www.thecoorgfoodco.com': 'coorg-food-company-1413',
  };
  if (CUSTOM_DOMAIN_TENANT_MAP[hostname]) {
    return CUSTOM_DOMAIN_TENANT_MAP[hostname];
  }

  // Production: Extract subdomain
  // Example: tcfc.handsfree.tech -> tcfc
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  // Fallback
  return 'demo';
}

/**
 * Fetch restaurant profile directly from D1 database
 * Direct database access for optimal performance
 */
export async function fetchRestaurantProfile(
  tenantId?: string,
  tenantsDb?: D1Database
): Promise<RestaurantProfile | null> {
  if (!tenantId) {
    console.error('[RestaurantConfig] Tenant ID is required');
    return null;
  }

  if (!tenantsDb) {
    console.error('[RestaurantConfig] TENANTS_DB binding is required');
    return null;
  }

  try {
    console.log(`[RestaurantConfig] Fetching profile from D1 for tenant: ${tenantId}`);

    // Query restaurant_tenants table
    const tenantResult = await tenantsDb.prepare(
      'SELECT * FROM restaurant_tenants WHERE tenant_id = ?'
    ).bind(tenantId).first();

    if (!tenantResult) {
      console.warn(`[RestaurantConfig] Tenant not found in restaurant_tenants: ${tenantId}`);
      return null;
    }

    // Query restaurant_theme_configs table
    const themeResult = await tenantsDb.prepare(
      'SELECT * FROM restaurant_theme_configs WHERE tenant_id = ?'
    ).bind(tenantId).first();

    if (!themeResult) {
      console.warn(`[RestaurantConfig] Theme config not found for tenant: ${tenantId}, using tenant data only`);
    }

    // Parse cuisine JSON
    const cuisineArray = themeResult?.cuisine
      ? JSON.parse(themeResult.cuisine as string)
      : ['Multi-cuisine'];

    // Build profile response
    // Prefer company_name from restaurant_tenants over name from theme_configs
    console.log(`[RestaurantConfig] Raw D1 data - company_name: "${tenantResult.company_name}", theme name: "${themeResult?.name}"`);
    const displayName = (tenantResult.company_name as string) || (themeResult?.name as string) || 'Restaurant';
    console.log(`[RestaurantConfig] Final displayName: "${displayName}"`);

    const profile: RestaurantProfile = {
      tenantId,
      name: displayName,
      cuisine: cuisineArray.join(', '),
      address: 'Address not configured',
      phone: tenantResult.phone as string || '+1234567890',
      hours: '10 AM - 10 PM',
      about: themeResult?.description as string || 'Welcome to our restaurant',
      brandIdentity: {
        primaryColor: themeResult?.primary_color as string || '#ff9500',
        logo: themeResult?.logo_url as string || null,
        tagline: themeResult?.tagline as string || null,
      },
      status: (tenantResult.status as 'active' | 'inactive') || 'active',
      createdAt: tenantResult.created_at as string || new Date().toISOString(),
      updatedAt: tenantResult.updated_at as string || new Date().toISOString(),
    };

    console.log(`[RestaurantConfig] Profile loaded from D1:`, {
      name: profile.name,
      tenantId: profile.tenantId,
      hasLogo: !!profile.brandIdentity?.logo
    });

    return profile;
  } catch (error) {
    console.error(`[RestaurantConfig] Error fetching profile from D1:`, error);
    return null;
  }
}

import { getApiBaseUrl } from '../utils/tenant';

/**
 * Fetch restaurant profile client-side (for dynamic updates)
 * The API route extracts tenantId from the request hostname
 */
export async function fetchRestaurantProfileClient(tenantId?: string): Promise<RestaurantProfile | null> {
  // Use internal API route which fetches from D1
  const url = tenantId
    ? `/api/profile?tenantId=${tenantId}`
    : `/api/profile`;

  try {
    const response = await fetch(url, {
      cache: 'no-store', // Client-side: always fresh
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const data = await response.json() as { success: boolean; profile: RestaurantProfile };
    return data.success ? data.profile : null;
  } catch (error) {
    console.error('Error fetching restaurant profile:', error);
    return null;
  }
}

/**
 * Get fallback profile for when backend is unavailable
 */
export function getFallbackProfile(tenantId: string): RestaurantProfile {
  return {
    tenantId,
    name: 'Restaurant',
    cuisine: 'Multi-cuisine',
    address: 'Address not configured',
    phone: '+1234567890',
    hours: '10 AM - 10 PM',
    about: 'Welcome to our restaurant',
    brandIdentity: {
      primaryColor: '#ff9500',
      logo: null,
      tagline: null,
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

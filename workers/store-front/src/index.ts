/**
 * Handsfree Store Front Worker
 *
 * Main worker that handles all tenant subdomain requests (*.handsfree.tech)
 * Routes requests to appropriate workers based on tenant type and path
 */

import type { KVNamespace, ExecutionContext } from '@cloudflare/workers-types';

export interface Env {
  // KV Namespaces
  DOMAIN_METADATA: KVNamespace;     // Tenant configurations
  THEME_CACHE: KVNamespace;         // Theme cache
  ADMIN_SESSIONS: KVNamespace;      // Admin sessions
  TENANT_METADATA: KVNamespace;     // Tenant metadata

  // Environment Variables
  PLATFORM_DOMAIN: string;          // e.g., "handsfree.tech"
  PLATFORM_WORKER_URL: string;      // Platform worker URL

  // Cloudflare Credentials (for D1 HTTP API)
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      const path = url.pathname;

      console.log(`[StoreFront] ${request.method} ${hostname}${path}`);

      // Extract tenant ID from subdomain
      const tenantId = extractTenantFromHostname(hostname, env.PLATFORM_DOMAIN);

      if (!tenantId) {
        return new Response('Invalid subdomain', { status: 404 });
      }

      console.log(`[StoreFront] Tenant: ${tenantId}`);

      // Get tenant metadata to determine business category
      const tenantMetadata = await getTenantMetadata(tenantId, env);
      const businessCategory = tenantMetadata?.businessCategory || 'PRINTING_STORE';

      console.log(`[StoreFront] Business Category: ${businessCategory}`);

      // Handle admin routes FIRST (before business category routing)
      if (isAdminPath(path)) {
        return handleAdminProxy(request, tenantId, businessCategory, path, url);
      }

      // Handle static assets (_next/*, favicon, etc.)
      if (path.startsWith('/_next/') || path.startsWith('/favicon.ico')) {
        const referer = request.headers.get('Referer') || '';
        const isAdminContext = isAdminPath(referer);

        if (isAdminContext) {
          return handleAdminStaticAsset(request, path);
        } else {
          return handleStoreFrontStaticAsset(request, path);
        }
      }

      // Route RESTAURANT tenants to dedicated restaurant-client worker
      if (businessCategory === 'RESTAURANT') {
        return handleRestaurantProxy(request, tenantId, tenantMetadata, path, url, env);
      }

      // Handle API routes
      if (path.startsWith('/api/')) {
        return handleApiRoutes(request, env, tenantId, path);
      }

      // All other routes - proxy to customer-facing store-front-app
      return handleStoreFrontProxy(request, tenantId, path, url);

    } catch (error) {
      console.error('[StoreFront] Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};

/**
 * Extract tenant ID from hostname
 */
function extractTenantFromHostname(hostname: string, platformDomain: string): string | null {
  if (hostname.endsWith(platformDomain)) {
    const subdomain = hostname.replace(`.${platformDomain}`, '');
    return subdomain;
  }
  return null;
}

/**
 * Check if path is an admin path
 */
function isAdminPath(path: string): boolean {
  const adminPaths = [
    '/admin',
    '/dashboard',
    '/product-settings',
    '/avatar-settings',
    '/theme-editor',
    '/theme-customizer',
    '/settings',
    '/tenant-detail',
    '/tenant-status',
    '/onboarding',
    '/auth/',
    '/api/tenants/'
  ];

  return adminPaths.some(p => path.startsWith(p));
}

/**
 * Get tenant metadata from KV
 */
async function getTenantMetadata(tenantId: string, env: Env) {
  try {
    // Try admin_tenants first
    const tenants = await env.TENANT_METADATA.get('admin_tenants', 'json') as any[];
    if (tenants) {
      const tenant = tenants.find((t: any) => t.tenantId === tenantId);
      if (tenant) return tenant;
    }

    // Fallback to individual tenant key
    const tenantKey = `tenant:${tenantId}`;
    const tenant = await env.TENANT_METADATA.get(tenantKey, 'json');
    return tenant;
  } catch (error) {
    console.error('[StoreFront] Error getting tenant metadata:', error);
    return null;
  }
}

/**
 * Handle restaurant tenant requests - proxy to restaurant-client worker
 */
async function handleRestaurantProxy(
  request: Request,
  tenantId: string,
  tenantMetadata: any,
  path: string,
  url: URL,
  env: Env
): Promise<Response> {
  console.log(`[StoreFront] Routing RESTAURANT tenant: ${tenantId}`);

  // Validate tenant is a restaurant (moved from restaurant worker)
  if (tenantMetadata?.businessCategory !== 'RESTAURANT') {
    console.error(`[StoreFront] Invalid business category: ${tenantMetadata?.businessCategory} for tenant: ${tenantId}`);
    return new Response('Not a restaurant tenant', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Handle select API endpoints inline for performance (skip restaurant worker hop)
  // These use KV storage for read-only data
  if (path.startsWith('/api/config') ||
    path.startsWith('/api/menu') ||
    path.startsWith('/api/restaurant') ||
    path.startsWith('/api/specials')) {

    console.log(`[StoreFront] Attempting inline API handler for: ${path}`);
    const inlineResponse = await handleRestaurantMenuAPI(path, tenantId, env);

    if (inlineResponse) {
      console.log(`[StoreFront] Handled API inline: ${path}`);
      return inlineResponse;
    }

    console.log(`[StoreFront] API not handled inline, falling through to proxy: ${path}`);
  }

  // Proxy UI requests directly to restaurant-client (skip restaurant worker)
  const restaurantClientUrl = 'https://handsfree-restaurant-client.suyesh.workers.dev';
  const proxyUrl = `${restaurantClientUrl}${path}${url.search}`;

  console.log(`[StoreFront] Proxying to restaurant-client: ${proxyUrl}`);

  // Filter problematic headers and add tenant context
  const filteredHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'host' || lowerKey.startsWith('cf-') || lowerKey === 'x-forwarded-host') {
      continue;
    }
    filteredHeaders.set(key, value);
  }

  // Ensure User-Agent is present (required by Next.js)
  if (!filteredHeaders.has('User-Agent')) {
    filteredHeaders.set('User-Agent', 'Handsfree-Platform/1.0');
  }

  // Add tenant context headers
  filteredHeaders.set('X-Tenant-ID', tenantId);
  filteredHeaders.set('X-Business-Category', 'RESTAURANT');
  filteredHeaders.set('X-Company-Name', tenantMetadata?.companyName || tenantId);

  const proxyRequest = new Request(proxyUrl, {
    method: request.method,
    headers: filteredHeaders,
    body: request.body
  });

  const response = await fetch(proxyRequest);

  // Pass through redirects to the browser instead of proxying them
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location');
    if (location) {
      console.log(`[StoreFront] Passing through redirect to: ${location}`);
      return new Response(null, {
        status: response.status,
        headers: {
          'Location': location,
          'Cache-Control': 'no-store',
          'X-Store-Front-Redirect': 'true'
        }
      });
    }
  }

  // Add header to verify this code is running
  const headers = new Headers(response.headers);
  headers.set('X-Store-Front-Version', '2.0');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Handle admin routes - proxy to admin app (Cloudflare Pages)
 */
async function handleAdminProxy(
  request: Request,
  tenantId: string,
  businessCategory: string,
  path: string,
  url: URL
): Promise<Response> {
  console.log(`[StoreFront] Proxying admin route: ${path}`);

  // For RESTAURANT tenants, route to restaurant-client (which handles admin redirects)
  if (businessCategory === 'RESTAURANT') {
    const restaurantClientUrl = 'https://handsfree-restaurant-client.suyesh.workers.dev';
    const proxyUrl = `${restaurantClientUrl}${url.pathname}${url.search}`;

    console.log(`[StoreFront] Proxying restaurant admin to: ${proxyUrl}`);

    const filteredHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'host' || lowerKey.startsWith('cf-') || lowerKey === 'x-forwarded-host') {
        continue;
      }
      filteredHeaders.set(key, value);
    }

    filteredHeaders.set('X-Tenant-ID', tenantId);
    filteredHeaders.set('X-Business-Category', 'RESTAURANT');

    const proxyRequest = new Request(proxyUrl, {
      method: request.method,
      headers: filteredHeaders,
      body: request.body
    });

    const response = await fetch(proxyRequest);

    // Pass through redirects to the browser
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        console.log(`[StoreFront] Passing through admin redirect to: ${location}`);
        return new Response(null, {
          status: response.status,
          headers: {
            'Location': location,
            'Cache-Control': 'no-store'
          }
        });
      }
    }

    return response;
  }

  // Default: Admin app URL for platform/printing stores
  const adminAppUrl = 'https://handsfree-admin.pages.dev';

  // For static assets, proxy as-is
  const isStaticAsset = path.startsWith('/_next/') || path.startsWith('/static/');

  let proxyUrl: string;
  if (isStaticAsset) {
    proxyUrl = `${adminAppUrl}${path}${url.search}`;
  } else {
    // Ensure trailing slash for HTML routes (required by Next.js admin app)
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;

    // Add tenant context to query params
    const params = new URLSearchParams(url.search);
    params.set('tenantId', tenantId);
    params.set('businessCategory', businessCategory);
    proxyUrl = `${adminAppUrl}${normalizedPath}?${params.toString()}`;
  }

  console.log(`[StoreFront] Proxying to admin app: ${proxyUrl}`);

  // For HTML pages, redirect to preserve query params in browser URL
  if (!isStaticAsset && !path.startsWith('/api/')) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': proxyUrl }
    });
  }

  // For static assets and API routes, proxy the request
  const response = await fetch(proxyUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

/**
 * Handle customer storefront routes - proxy to store-front-app
 */
async function handleStoreFrontProxy(
  request: Request,
  tenantId: string,
  path: string,
  url: URL
): Promise<Response> {
  console.log(`[StoreFront] Proxying customer route: ${path}`);

  const storeFrontAppUrl = 'https://store-front-app.suyesh.workers.dev';
  const proxyUrl = `${storeFrontAppUrl}/${tenantId}${path}${url.search}`;

  console.log(`[StoreFront] Proxying to: ${proxyUrl}`);

  const headers = new Headers(request.headers);
  headers.set('X-Tenant-ID', tenantId);
  headers.set('X-Original-Host', url.hostname);

  const response = await fetch(proxyUrl, {
    method: request.method,
    headers: headers,
    body: request.body
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

/**
 * Handle admin static assets
 */
async function handleAdminStaticAsset(request: Request, path: string): Promise<Response> {
  console.log(`[StoreFront] Proxying admin static asset: ${path}`);

  const adminAppUrl = 'https://handsfree-admin.pages.dev';
  const proxyUrl = `${adminAppUrl}${path}`;

  const response = await fetch(proxyUrl, {
    method: request.method,
    headers: request.headers
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

/**
 * Handle storefront static assets
 */
async function handleStoreFrontStaticAsset(request: Request, path: string): Promise<Response> {
  console.log(`[StoreFront] Proxying storefront static asset: ${path}`);

  const storeFrontAppUrl = 'https://store-front-app.suyesh.workers.dev';
  const url = new URL(request.url);
  const proxyUrl = `${storeFrontAppUrl}${path}${url.search}`;

  const response = await fetch(proxyUrl, {
    method: request.method,
    headers: request.headers
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

/**
 * Handle API routes
 */
async function handleApiRoutes(
  request: Request,
  env: Env,
  tenantId: string,
  path: string
): Promise<Response> {
  console.log(`[StoreFront] Handling API route: ${path}`);

  // Add API route handlers here as needed
  // For now, return a placeholder
  return new Response(JSON.stringify({
    error: 'API endpoint not implemented',
    path
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle Restaurant Menu API Endpoints
 * Reads menu data from KV storage (eliminates restaurant worker hop)
 */
async function handleRestaurantMenuAPI(
  path: string,
  tenantId: string,
  env: Env
): Promise<Response | null> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    console.log(`[StoreFront] Restaurant Menu API: ${path} for tenant: ${tenantId}`);

    // GET /api/menu - Get all menu items
    if (path === '/api/menu' || path === '/api/menu/') {
      const menuData = await env.TENANT_METADATA.get(`menu:${tenantId}:data`, 'json');

      if (!menuData) {
        console.log(`[StoreFront] Menu data missing in KV for ${tenantId}`);
        return null;
      }

      return new Response(JSON.stringify(menuData), {
        status: 200,
        headers: corsHeaders
      });
    }

    // GET /api/menu/metadata - Get menu metadata (stats, tier-1 categories)
    if (path === '/api/menu/metadata' || path === '/api/menu/metadata/') {
      const metadata = await env.TENANT_METADATA.get(`menu:${tenantId}:metadata`, 'json');

      if (!metadata) {
        return null;
      }

      return new Response(JSON.stringify(metadata), {
        status: 200,
        headers: corsHeaders
      });
    }

    // GET /api/menu/categories - Get category hierarchy
    if (path === '/api/menu/categories' || path === '/api/menu/categories/') {
      const categories = await env.TENANT_METADATA.get(`menu:${tenantId}:categories`, 'json');

      if (!categories) {
        return null;
      }

      return new Response(JSON.stringify(categories), {
        status: 200,
        headers: corsHeaders
      });
    }

    // GET /api/config/voice - Get voice ordering configuration
    if (path === '/api/config/voice' || path === '/api/config/voice/') {
      const voiceConfig = await env.TENANT_METADATA.get(`config:${tenantId}:voice`, 'json');

      if (!voiceConfig) {
        return null;
      }

      return new Response(JSON.stringify(voiceConfig), {
        status: 200,
        headers: corsHeaders
      });
    }

    // GET /api/config/theme - Get theme configuration
    if (path === '/api/config/theme' || path === '/api/config/theme/') {
      const themeConfig = await env.TENANT_METADATA.get(`config:${tenantId}:theme`, 'json');

      if (!themeConfig) {
        return null;
      }

      return new Response(JSON.stringify(themeConfig), {
        status: 200,
        headers: corsHeaders
      });
    }

    // GET /api/restaurant/:tenantId/profile - Get restaurant profile
    const profileMatch = path.match(/^\/api\/restaurant\/([^/]+)\/profile\/?$/);
    if (profileMatch) {
      const requestedTenantId = profileMatch[1];

      // Verify requested tenant matches authenticated tenant
      if (requestedTenantId !== tenantId) {
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          message: 'Cannot access profile for different tenant'
        }), {
          status: 403,
          headers: corsHeaders
        });
      }

      // Get theme config for brand colors
      const themeConfig: any = await env.TENANT_METADATA.get(`config:${tenantId}:theme`, 'json') || {};
      const menuMetadata: any = await env.TENANT_METADATA.get(`menu:${tenantId}:metadata`, 'json') || {};

      // Build restaurant profile from available data
      const profile = {
        tenantId,
        name: themeConfig.branding?.name || 'Restaurant',
        cuisine: themeConfig.branding?.cuisine?.join(', ') || 'Multi-cuisine',
        address: 'Address not configured',
        phone: '+1234567890',
        hours: '10 AM - 10 PM',
        about: themeConfig.branding?.description || 'Welcome to our restaurant',
        brandIdentity: {
          primaryColor: themeConfig.branding?.colors?.primary || '#FFA000',
          logo: themeConfig.branding?.logo?.url || null,
          tagline: themeConfig.branding?.tagline || null,
        },
        status: 'active',
        createdAt: themeConfig.createdAt || new Date().toISOString(),
        updatedAt: themeConfig.updatedAt || new Date().toISOString(),
        menuStats: menuMetadata.stats || null,
      };

      return new Response(JSON.stringify({
        success: true,
        profile
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // GET /api/specials/:tenantId - Get today's specials
    const specialsMatch = path.match(/^\/api\/specials\/([^/]+)\/?$/);
    if (specialsMatch) {
      const requestedTenantId = specialsMatch[1];
      console.log(`[StoreFront] Fetching specials for tenant: ${requestedTenantId}`);

      const specialsData = await env.TENANT_METADATA.get(`specials:${requestedTenantId}`, 'json') as any[] | null;

      if (!specialsData) {
        return new Response(JSON.stringify({
          success: true,
          specials: [],
          count: 0
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Basic filtering: active only
      const activeSpecials = specialsData.filter(s => s.isActive);

      return new Response(JSON.stringify({
        success: true,
        specials: activeSpecials,
        count: activeSpecials.length
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Unknown API endpoint or missing data - allow fallback to proxy
    return null;

  } catch (error) {
    console.error('[StoreFront] Restaurant Menu API error:', error);

    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

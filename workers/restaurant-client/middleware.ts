import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
  'Access-Control-Max-Age': '86400',
};

// Map custom domains to tenant IDs
const CUSTOM_DOMAIN_TENANT_MAP: Record<string, string> = {
  'thecoorgfoodco.com': 'coorg-food-company-1413',
  'www.thecoorgfoodco.com': 'coorg-food-company-1413',
};

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const hostname = url.hostname;
  const pathname = url.pathname;

  // Handle CORS preflight for all API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Check if Cloudflare already set tenant headers (Workers for Platforms)
  const existingTenantId = request.headers.get('x-tenant-id') || request.headers.get('x-company-name');

  // Check for tenant in query parameter (useful for debugging)
  const queryTenantId = url.searchParams.get('tenant');

  let tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'demo';

  if (queryTenantId) {
    tenantId = queryTenantId;
    console.log('[Middleware] Using tenant from query param:', tenantId);
  } else if (existingTenantId) {
    // Use tenant ID from Cloudflare custom domain headers
    tenantId = existingTenantId;
    console.log('[Middleware] Using Cloudflare tenant header:', tenantId);
  } else if (CUSTOM_DOMAIN_TENANT_MAP[hostname]) {
    tenantId = CUSTOM_DOMAIN_TENANT_MAP[hostname];
    console.log('[Middleware] Using custom domain mapping:', hostname, '->', tenantId);
  } else {
    const parts = hostname.split('.');
    if (!hostname.includes('.workers.dev') && !hostname.includes('localhost') && parts.length >= 3) {
      tenantId = parts[0]; // resttest2020.handsfree.tech -> resttest2020
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      tenantId = 'khao-piyo-7766';
    }
    console.log('[Middleware] Extracted tenant from hostname:', tenantId);
  }

  // For /admin routes, validate session with auth worker
  // Skip auth check for debug page
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/debug-cookies')) {
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('[Middleware] Admin route detected:', pathname);
    console.log('[Middleware] Cookies present:', cookieHeader ? 'YES' : 'NO');
    console.log('[Middleware] Cookie header length:', cookieHeader.length);

    // Check if admin_access_token exists
    const hasAccessToken = cookieHeader.includes('admin_access_token');
    console.log('[Middleware] Has admin_access_token:', hasAccessToken);

    try {
      // Check session with auth worker
      const sessionResponse = await fetch('https://auth.handsfree.tech/auth/session', {
        headers: {
          'Cookie': cookieHeader
        }
      });

      const sessionData = await sessionResponse.json() as any;
      console.log('[Middleware] Session response status:', sessionResponse.status);
      console.log('[Middleware] Session validation:', JSON.stringify(sessionData));

      if (!sessionResponse.ok || !sessionData.authenticated) {
        console.log('[Middleware] Not authenticated, redirecting to login');
        console.log('[Middleware] Response OK:', sessionResponse.ok);
        console.log('[Middleware] Authenticated:', sessionData.authenticated);
        // Not authenticated, redirect to login
        return NextResponse.redirect(new URL('/auth/login', request.url));
      }

      console.log('[Middleware] Authenticated, allowing access to admin route');
      // Authenticated, allow access
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-tenant-id', tenantId);
      requestHeaders.set('x-original-host', hostname);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch (error) {
      console.error('[Middleware] Session validation error:', error);
      // On error, redirect to login for safety
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  // Pass tenant info to layout via header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);
  requestHeaders.set('x-original-host', hostname);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Inject CORS headers on all API responses
  if (pathname.startsWith('/api/')) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * NOTE: API routes are now included to pass tenant ID headers
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

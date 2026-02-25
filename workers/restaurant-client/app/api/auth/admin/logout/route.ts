/**
 * POST /api/auth/admin/logout
 * Purpose: Destroy admin session and clear cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseCookies, clearCookieHeader, logAuditEvent } from '@/lib/admin-auth';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
    TENANT_METADATA: KVNamespace;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);

    const sessionId = cookies['admin_session_id'];
    const currentTenant = cookies['admin_current_tenant'];

    // Delete session from KV
    if (sessionId) {
      const sessionData = await env.TENANT_METADATA.get(`session:admin:${sessionId}`);

      if (sessionData) {
        const session = JSON.parse(sessionData);

        // Log logout event
        if (currentTenant) {
          await logAuditEvent(env.TENANTS_DB, {
            tenantId: currentTenant,
            adminUserId: session.userId,
            action: 'logout',
            ipAddress: request.headers.get('cf-connecting-ip') || undefined,
            userAgent: request.headers.get('user-agent') || undefined
          });
        }
      }

      await env.TENANT_METADATA.delete(`session:admin:${sessionId}`);
    }

    // Create response with cleared cookies
    const response = NextResponse.json({ success: true });

    response.headers.append('Set-Cookie', clearCookieHeader('admin_access_token'));
    response.headers.append('Set-Cookie', clearCookieHeader('admin_refresh_token'));
    response.headers.append('Set-Cookie', clearCookieHeader('admin_session_id'));
    response.headers.append('Set-Cookie', clearCookieHeader('admin_current_tenant'));

    return response;

  } catch (error) {
    console.error('[Admin Auth] Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to logout',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

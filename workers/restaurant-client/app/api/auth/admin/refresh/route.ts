/**
 * POST /api/auth/admin/refresh
 * Purpose: Refresh expired access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseCookies, createCookieHeader, createJWT, type AdminSession } from '@/lib/admin-auth';

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

    const refreshToken = cookies['admin_refresh_token'];
    const sessionId = cookies['admin_session_id'];

    if (!refreshToken || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'No refresh token found' },
        { status: 401 }
      );
    }

    // Get session from KV
    const sessionData = await env.TENANT_METADATA.get(`session:admin:${sessionId}`);

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found or expired' },
        { status: 401 }
      );
    }

    const session: AdminSession = JSON.parse(sessionData);

    // Verify refresh token matches
    if (session.refreshToken !== refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    // Check if session has expired (30 days)
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt < new Date()) {
      // Session expired, delete it
      await env.TENANT_METADATA.delete(`session:admin:${sessionId}`);
      return NextResponse.json(
        { success: false, error: 'Session expired, please login again' },
        { status: 401 }
      );
    }

    // Generate new access token (24 hours)
    const newAccessToken = createJWT(
      {
        userId: session.userId,
        sessionId: session.sessionId,
        tenantAccess: session.tenantAccess
      },
      86400 // 24 hours
    );

    // Update session with new access token and last activity
    session.accessToken = newAccessToken;
    session.lastActivityAt = new Date().toISOString();

    // Save updated session
    await env.TENANT_METADATA.put(
      `session:admin:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    // Create response with new access token cookie
    const response = NextResponse.json({
      success: true,
      expiresAt: session.expiresAt
    });

    response.headers.append('Set-Cookie', createCookieHeader('admin_access_token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 86400 // 24 hours
    }));

    return response;

  } catch (error) {
    console.error('[Admin Auth] Token refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh token',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

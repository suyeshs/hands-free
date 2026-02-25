/**
 * GET /api/auth/admin/session
 * Purpose: Check current admin session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseCookies, verifyJWT, type AdminSession } from '@/lib/admin-auth';

declare global {
  interface CloudflareEnv {
    TENANT_METADATA: KVNamespace;
    TENANTS_DB: D1Database;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);

    console.log('[Session API] Cookie header:', cookieHeader);
    console.log('[Session API] Parsed cookies:', Object.keys(cookies));

    const accessToken = cookies['admin_access_token'];
    const sessionId = cookies['admin_session_id'];

    console.log('[Session API] Access token present:', !!accessToken);
    console.log('[Session API] Session ID present:', !!sessionId);

    if (!accessToken || !sessionId) {
      console.log('[Session API] Missing auth cookies, returning 401');
      return NextResponse.json(
        { success: false, error: 'No session found' },
        { status: 401 }
      );
    }

    // Verify JWT
    try {
      console.log('[Session API] Verifying JWT...');
      const decoded = verifyJWT(accessToken);
      console.log('[Session API] JWT verified, userId:', decoded.userId);

      // Get full session from KV
      const sessionKey = `session:admin:${sessionId}`;
      console.log('[Session API] Fetching session from KV:', sessionKey);
      const sessionData = await env.TENANT_METADATA.get(sessionKey);

      if (!sessionData) {
        console.log('[Session API] Session not found in KV');
        return NextResponse.json(
          { success: false, error: 'Session not found' },
          { status: 401 }
        );
      }

      console.log('[Session API] Session found in KV');
      const session: AdminSession = JSON.parse(sessionData);
      console.log('[Session API] Session parsed, userId:', session.userId, 'tenantId:', session.currentTenantId);

      // Fetch user details from database
      const userQuery = `
        SELECT
          au.id, au.name, au.email,
          ata.tenant_id, ata.role,
          rt.company_name
        FROM admin_users au
        LEFT JOIN admin_tenant_access ata ON au.id = ata.admin_user_id
        LEFT JOIN restaurant_tenants rt ON ata.tenant_id = rt.tenant_id
        WHERE au.id = ? AND au.is_active = 1 AND ata.is_active = 1
      `;

      console.log('[Session API] Querying database for user:', session.userId);
      const userResult = await env.TENANTS_DB.prepare(userQuery).bind(session.userId).all();
      console.log('[Session API] Database query result count:', userResult.results?.length || 0);

      if (!userResult.results || userResult.results.length === 0) {
        console.log('[Session API] User not found in database');
        return NextResponse.json(
          { success: false, error: 'User not found or inactive' },
          { status: 401 }
        );
      }

      const firstRow: any = userResult.results[0];
      const userName = firstRow.name;
      const userEmail = firstRow.email;
      console.log('[Session API] User found:', userName, userEmail);

      // Build tenants list from database (more up-to-date than session)
      const tenants: any[] = [];
      for (const row of userResult.results) {
        const typedRow = row as any;
        if (typedRow.tenant_id) {
          tenants.push({
            tenantId: typedRow.tenant_id,
            companyName: typedRow.company_name || typedRow.tenant_id,
            role: typedRow.role
          });
        }
      }

      // Get current role
      const currentRole = session.tenantAccess[session.currentTenantId]?.role || null;

      console.log('[Session API] Returning successful response with', tenants.length, 'tenants');
      return NextResponse.json({
        success: true,
        user: {
          id: session.userId,
          name: userName,
          email: userEmail,
          currentTenantId: session.currentTenantId,
          currentRole,
          tenants
        },
        expiresAt: session.expiresAt
      });

    } catch (jwtError) {
      // JWT expired or invalid
      console.log('[Session API] JWT verification failed:', jwtError);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('[Admin Auth] Session check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check session',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

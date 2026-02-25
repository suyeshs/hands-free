/**
 * POST /api/auth/admin/switch-tenant
 * Purpose: Switch admin's current tenant context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { parseCookies, createCookieHeader, logAuditEvent, type AdminSession } from '@/lib/admin-auth';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
    TENANT_METADATA: KVNamespace;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const body = await request.json() as { targetTenantId?: string };
    const { targetTenantId } = body;

    if (!targetTenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing targetTenantId' },
        { status: 400 }
      );
    }

    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const sessionId = cookies['admin_session_id'];

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'No active session' },
        { status: 401 }
      );
    }

    // Get session from KV
    const sessionData = await env.TENANT_METADATA.get(`session:admin:${sessionId}`);

    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 401 }
      );
    }

    const session: AdminSession = JSON.parse(sessionData);

    // Check if user has access to target tenant
    if (!session.tenantAccess[targetTenantId] || !session.tenantAccess[targetTenantId].isActive) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this tenant' },
        { status: 403 }
      );
    }

    // Update session with new current tenant
    session.currentTenantId = targetTenantId;
    session.lastActivityAt = new Date().toISOString();

    // Save updated session
    await env.TENANT_METADATA.put(
      `session:admin:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    // Log tenant switch
    await logAuditEvent(env.TENANTS_DB, {
      tenantId: targetTenantId,
      adminUserId: session.userId,
      action: 'tenant_switch',
      ipAddress: request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        fromTenant: cookies['admin_current_tenant'],
        toTenant: targetTenantId
      }
    });

    // Create response with updated cookie
    const response = NextResponse.json({
      success: true,
      currentTenantId: targetTenantId,
      currentRole: session.tenantAccess[targetTenantId].role,
      redirectUrl: `https://${targetTenantId}.handsfree.tech/admin`
    });

    response.headers.append('Set-Cookie', createCookieHeader('admin_current_tenant', targetTenantId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    }));

    return response;

  } catch (error) {
    console.error('[Admin Auth] Tenant switch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to switch tenant',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

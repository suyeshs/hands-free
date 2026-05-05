/**
 * TOTP Login Verification API - Verify 2FA during login
 * POST /api/auth/admin/totp/verify
 *
 * After phone SMS verification, if user has TOTP enabled,
 * they must verify with their authenticator app code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  decryptTOTPSecret,
  verifyTOTPToken,
  isValidTOTPFormat,
  isValidBackupCodeFormat,
  verifyBackupCode,
  removeUsedBackupCode,
} from '@/lib/totp';
import { createJWT, parseCookies, verifyJWT } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('[TOTP Verify] Starting TOTP login verification');

    // Parse request body first to get temp token
    const body = await request.json() as any;
    const { token, isBackupCode, tempAccessToken } = body;

    if (!tempAccessToken) {
      console.error('[TOTP Verify] No temp access token found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please complete phone verification first' },
        { status: 401 }
      );
    }

    // Verify JWT and get user ID
    let decoded;
    try {
      decoded = verifyJWT(tempAccessToken);
    } catch (jwtError) {
      console.error('[TOTP Verify] Invalid JWT:', jwtError);
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;
    const tenantId = request.headers.get('x-tenant-id') || decoded.tenantAccess ? Object.keys(decoded.tenantAccess)[0] : 'demo';

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate format based on type
    if (isBackupCode) {
      if (!isValidBackupCodeFormat(token)) {
        return NextResponse.json(
          { success: false, error: 'Invalid backup code format' },
          { status: 400 }
        );
      }
    } else {
      if (!isValidTOTPFormat(token)) {
        return NextResponse.json(
          { success: false, error: 'Invalid token format. Must be 6 digits.' },
          { status: 400 }
        );
      }
    }

    console.log('[TOTP Verify] User:', userId, 'verifying', isBackupCode ? 'backup code' : 'TOTP token');

    // Get database from Cloudflare context
    const { env } = await getCloudflareContext();
    const db = env.TENANTS_DB;

    // Get user's TOTP data
    const user = await db
      .prepare('SELECT totp_secret, totp_enabled, totp_backup_codes FROM admin_users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      console.error('[TOTP Verify] User not found:', userId);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const totpSecret = (user as any).totp_secret;
    const totpEnabled = (user as any).totp_enabled;
    const backupCodesJson = (user as any).totp_backup_codes;

    if (totpEnabled !== 1) {
      console.error('[TOTP Verify] TOTP not enabled for user');
      return NextResponse.json(
        { success: false, error: 'TOTP is not enabled for this account' },
        { status: 400 }
      );
    }

    if (!totpSecret) {
      console.error('[TOTP Verify] No TOTP secret found');
      return NextResponse.json(
        { success: false, error: 'TOTP configuration error' },
        { status: 500 }
      );
    }

    let isValid = false;
    let eventType = '';

    if (isBackupCode) {
      // Verify backup code
      if (!backupCodesJson) {
        return NextResponse.json(
          { success: false, error: 'No backup codes available' },
          { status: 400 }
        );
      }

      const backupCodes = JSON.parse(backupCodesJson);
      isValid = verifyBackupCode(token, backupCodes);
      eventType = isValid ? 'backup_code_used' : 'backup_code_failure';

      if (isValid) {
        // Remove used backup code
        const updatedCodes = removeUsedBackupCode(token, backupCodes);
        await db
          .prepare('UPDATE admin_users SET totp_backup_codes = ? WHERE id = ?')
          .bind(JSON.stringify(updatedCodes), userId)
          .run();

        console.log('[TOTP Verify] Backup code used and removed');
      }
    } else {
      // Verify TOTP token
      try {
        const decryptedSecret = decryptTOTPSecret(totpSecret);
        isValid = verifyTOTPToken(token, decryptedSecret);
        eventType = isValid ? 'verify_success' : 'verify_failure';
      } catch (decryptError) {
        console.error('[TOTP Verify] Failed to decrypt secret:', decryptError);
        return NextResponse.json(
          { success: false, error: 'Failed to decrypt TOTP secret' },
          { status: 500 }
        );
      }
    }

    // Log verification attempt
    await db
      .prepare(`
        INSERT INTO admin_totp_audit (admin_user_id, event_type, created_at)
        VALUES (?, ?, datetime('now'))
      `)
      .bind(userId, eventType)
      .run();

    if (!isValid) {
      console.log('[TOTP Verify] Invalid token/code provided');
      return NextResponse.json(
        { success: false, error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // TOTP verified successfully!
    // Update last login time
    await db
      .prepare('UPDATE admin_users SET last_login_at = datetime(\'now\') WHERE id = ?')
      .bind(userId)
      .run();

    console.log('[TOTP Verify] TOTP verification successful for user:', userId);

    // Fetch user data with tenant access to return to client
    const query = `
      SELECT
        au.id, au.name, au.email,
        ata.tenant_id, ata.role,
        rt.company_name
      FROM admin_users au
      LEFT JOIN admin_tenant_access ata ON au.id = ata.admin_user_id
      LEFT JOIN restaurant_tenants rt ON ata.tenant_id = rt.tenant_id
      WHERE au.id = ? AND au.is_active = 1 AND ata.is_active = 1
    `;

    const userResult = await db.prepare(query).bind(userId).all();

    let userData = null;
    const tenantAccessMap: Record<string, { role: string; isActive: boolean; companyName: string }> = {};
    const tenantsList: any[] = [];

    if (userResult.results && userResult.results.length > 0) {
      const firstRow: any = userResult.results[0];

      for (const row of userResult.results) {
        const typedRow = row as any;
        if (typedRow.tenant_id) {
          tenantAccessMap[typedRow.tenant_id] = {
            role: typedRow.role,
            isActive: true,
            companyName: typedRow.company_name || typedRow.tenant_id
          };

          tenantsList.push({
            tenantId: typedRow.tenant_id,
            companyName: typedRow.company_name || typedRow.tenant_id,
            role: typedRow.role
          });
        }
      }

      userData = {
        id: firstRow.id,
        name: firstRow.name,
        email: firstRow.email,
        currentTenantId: tenantId,
        tenants: tenantsList
      };
    }

    // Generate final tokens (24 hours access, 30 days refresh)
    const { generateSessionId, generateRefreshToken } = await import('@/lib/admin-auth');
    const sessionId = generateSessionId();
    const finalAccessToken = createJWT({
      userId,
      sessionId,
      tenantAccess: tenantAccessMap
    }, 86400); // 24 hours
    const finalRefreshToken = generateRefreshToken();

    // Store full session in KV
    const session = {
      sessionId,
      userId,
      phoneHash: '', // Not available in this context
      tenantAccess: tenantAccessMap,
      currentTenantId: tenantId,
      accessToken: finalAccessToken,
      refreshToken: finalRefreshToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    await env.TENANT_METADATA.put(
      `session:admin:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    console.log('[TOTP Verify] Session created, returning tokens');

    // Return tokens in JSON response (cookieless)
    return NextResponse.json({
      success: true,
      accessToken: finalAccessToken,
      refreshToken: finalRefreshToken,
      message: 'TOTP verification successful',
      user: userData
    });
  } catch (error) {
    console.error('[TOTP Verify] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify TOTP',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

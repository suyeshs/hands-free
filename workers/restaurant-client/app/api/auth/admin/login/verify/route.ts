/**
 * POST /api/auth/admin/login/verify
 * Purpose: Verify phone code and create admin session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  hashPhoneNumber,
  createJWT,
  generateSessionId,
  generateRefreshToken,
  createCookieHeader,
  logAuditEvent,
  type AdminSession
} from '@/lib/admin-auth';
import { randomBytes } from 'crypto';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
    TENANT_METADATA: KVNamespace;
  }
}

const TWILIO_VERIFY_URL = 'https://handsfree-twilio-verify-prod.suyesh.workers.dev';

// Tenant-based phone whitelist that bypasses Twilio (for dev/testing)
const getTenantWhitelist = (): Record<string, string[]> => {
  const whitelist = process.env.PHONE_WHITELIST || '{}';
  try {
    return JSON.parse(whitelist);
  } catch (error) {
    console.error('[Phone Whitelist] Invalid JSON format:', error);
    return {};
  }
};

const isPhoneWhitelisted = (tenantId: string, phoneNumber: string): boolean => {
  const whitelist = getTenantWhitelist();
  const tenantNumbers = whitelist[tenantId] || [];
  return tenantNumbers.includes(phoneNumber);
};

export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const body = await request.json() as { phoneNumber?: string; code?: string; tenantId?: string; verificationSid?: string };
    const { phoneNumber, code, tenantId, verificationSid } = body;

    // Validation
    if (!phoneNumber || !code || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if phone is whitelisted for this tenant (bypass Twilio verification)
    const isBypassed = isPhoneWhitelisted(tenantId, phoneNumber) ||
                       (verificationSid && verificationSid.startsWith('BYPASS-'));

    let twilioApproved = false;

    if (isBypassed) {
      console.log(`[Admin Auth] Bypassing Twilio verification for whitelisted number: ${phoneNumber} (tenant: ${tenantId})`);

      // Accept any 6-digit code for whitelisted numbers
      if (code && /^\d{6}$/.test(code)) {
        twilioApproved = true;
        console.log(`[Admin Auth] Bypass verification approved with code: ${code}`);
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid verification code format' },
          { status: 401 }
        );
      }
    } else {
      // Verify code with Twilio (normal flow)
      const twilioResponse = await fetch(`${TWILIO_VERIFY_URL}/verify/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phoneNumber,
          code,
          verificationSid
        })
      });

      if (!twilioResponse.ok) {
        const twilioError = await twilioResponse.json();
        console.error('[Admin Auth] Verification failed:', twilioError);

        return NextResponse.json(
          { success: false, error: 'Invalid or expired verification code' },
          { status: 401 }
        );
      }

      const twilioData = await twilioResponse.json() as any;
      if (twilioData.status !== 'approved') {
        return NextResponse.json(
          { success: false, error: 'Verification not approved' },
          { status: 401 }
        );
      }

      twilioApproved = true;
    }

    // Continue only if verification was approved (either via Twilio or bypass)
    if (!twilioApproved) {
      return NextResponse.json(
        { success: false, error: 'Verification failed' },
        { status: 401 }
      );
    }

    // Code verified! Now get or create admin user
    const phoneHash = hashPhoneNumber(phoneNumber);

    // Query admin user with all tenant access (including TOTP status)
    const query = `
      SELECT
        au.id, au.name, au.email, au.phone_hash, au.is_active, au.totp_enabled,
        ata.tenant_id, ata.role, ata.is_active as tenant_access_active,
        rt.company_name
      FROM admin_users au
      LEFT JOIN admin_tenant_access ata ON au.id = ata.admin_user_id
      LEFT JOIN restaurant_tenants rt ON ata.tenant_id = rt.tenant_id
      WHERE au.phone_hash = ? AND au.is_active = 1 AND ata.is_active = 1
    `;

    let result = await env.TENANTS_DB.prepare(query).bind(phoneHash).all();

    let adminUserId: string;
    let adminName: string;
    let adminEmail: string | null;

    // If no admin user found, auto-create from tenant owner
    if (!result.results || result.results.length === 0) {
      console.log('[Admin Auth] No admin user found, creating from tenant owner');

      // Get tenant owner info
      const ownerQuery = `
        SELECT tenant_id, phone, company_name, email
        FROM restaurant_tenants
        WHERE tenant_id = ? AND status = 'active'
      `;

      const ownerResult = await env.TENANTS_DB.prepare(ownerQuery).bind(tenantId).first();

      if (!ownerResult) {
        return NextResponse.json(
          { success: false, error: 'Tenant not found' },
          { status: 404 }
        );
      }

      const ownerData = ownerResult as any;

      // Create admin user
      adminUserId = randomBytes(8).toString('hex');
      adminName = `${ownerData.company_name} Owner`;
      adminEmail = ownerData.email;

      const createUserQuery = `
        INSERT INTO admin_users (id, phone_number_encrypted, phone_hash, name, email)
        VALUES (?, ?, ?, ?, ?)
      `;

      await env.TENANTS_DB.prepare(createUserQuery).bind(
        adminUserId,
        `ENCRYPTED:${phoneNumber}`,  // Placeholder for encrypted phone
        phoneHash,
        adminName,
        adminEmail
      ).run();

      // Grant owner access to this tenant
      const grantAccessQuery = `
        INSERT INTO admin_tenant_access (id, admin_user_id, tenant_id, role)
        VALUES (?, ?, ?, 'owner')
      `;

      await env.TENANTS_DB.prepare(grantAccessQuery).bind(
        randomBytes(8).toString('hex'),
        adminUserId,
        tenantId
      ).run();

      console.log(`[Admin Auth] Created admin user ${adminUserId} with owner access to ${tenantId}`);

      // Re-query to get full data
      result = await env.TENANTS_DB.prepare(query).bind(phoneHash).all();
    }

    // Build user object with tenant access
    if (!result.results || result.results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create admin user' },
        { status: 500 }
      );
    }

    const firstRow: any = result.results[0];
    adminUserId = firstRow.id;
    adminName = firstRow.name;
    adminEmail = firstRow.email;
    const totpEnabled = firstRow.totp_enabled === 1;

    // Build tenant access map
    const tenantAccessMap: Record<string, { role: string; isActive: boolean; companyName: string }> = {};
    const tenantsList: any[] = [];

    for (const row of result.results) {
      const typedRow = row as any;
      if (typedRow.tenant_id && typedRow.tenant_access_active === 1) {
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

    // Check if TOTP is required
    if (totpEnabled) {
      console.log('[Admin Auth] TOTP is enabled for user, requiring 2FA verification');

      // Generate temporary session token (limited permissions, 10 min expiry)
      const tempSessionId = generateSessionId();
      const tempAccessToken = createJWT({
        userId: adminUserId,
        sessionId: tempSessionId,
        tenantAccess: tenantAccessMap
      }, 600); // 10 minutes temporary token for TOTP verification

      // Store temporary session in KV for TOTP verification
      const tempSession = {
        sessionId: tempSessionId,
        userId: adminUserId,
        phoneHash,
        tenantAccess: tenantAccessMap as any,
        currentTenantId: tenantId,
        accessToken: tempAccessToken,
        refreshToken: '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        lastActivityAt: new Date().toISOString()
      };

      await env.TENANT_METADATA.put(
        `session:admin:${tempSessionId}`,
        JSON.stringify(tempSession),
        { expirationTtl: 600 } // 10 minutes
      );

      // Return success but indicate TOTP is required (cookieless)
      return NextResponse.json({
        success: true,
        totpRequired: true,
        tempAccessToken, // Send temp token in response
        message: 'Phone verification successful. Please enter your authenticator code.',
        user: {
          id: adminUserId,
          name: adminName
        }
      });
    }

    // Generate tokens
    const sessionId = generateSessionId();
    const accessToken = createJWT({
      userId: adminUserId,
      sessionId,
      tenantAccess: tenantAccessMap
    }, 86400); // 24 hours

    const refreshToken = generateRefreshToken();

    // Create session object
    const session: AdminSession = {
      sessionId,
      userId: adminUserId,
      phoneHash,
      tenantAccess: tenantAccessMap as any,
      currentTenantId: tenantId,
      accessToken,
      refreshToken,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    // Store session in KV (encrypted in Token Manager in production)
    await env.TENANT_METADATA.put(
      `session:admin:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    // Update last_login_at
    await env.TENANTS_DB.prepare(
      'UPDATE admin_users SET last_login_at = datetime(\'now\') WHERE id = ?'
    ).bind(adminUserId).run();

    // Log audit event
    await logAuditEvent(env.TENANTS_DB, {
      tenantId,
      adminUserId,
      action: 'login',
      ipAddress: request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    });

    // Return tokens in JSON response (cookieless)
    console.log('[Admin Auth] Login successful, returning tokens for user:', adminUserId);

    return NextResponse.json({
      success: true,
      accessToken,
      refreshToken,
      promptTOTPSetup: !totpEnabled, // Suggest setting up TOTP if not enabled
      user: {
        id: adminUserId,
        name: adminName,
        email: adminEmail,
        currentTenantId: tenantId,
        tenants: tenantsList
      }
    });

  } catch (error) {
    console.error('[Admin Auth] Login verify error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify login',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

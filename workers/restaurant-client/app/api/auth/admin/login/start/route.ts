/**
 * POST /api/auth/admin/login/start
 * Purpose: Start phone verification for admin login
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { hashPhoneNumber, isValidPhoneNumber, formatPhoneNumber } from '@/lib/admin-auth';

declare global {
  interface CloudflareEnv {
    TENANTS_DB: D1Database;
  }
}

const TWILIO_VERIFY_URL = 'https://handsfree-twilio-verify-prod.suyesh.workers.dev';

// Tenant-based phone whitelist that bypasses Twilio (for dev/testing)
// Format: JSON object mapping tenant IDs to arrays of phone numbers
// Example: {"khao-piyo-7766": ["+919900024260", "+919900024261"], "demo": ["+14155551234"]}
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
    const body = await request.json() as { phoneNumber?: string; tenantId?: string };
    const { phoneNumber, tenantId } = body;

    // Validation
    if (!phoneNumber || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Missing phoneNumber or tenantId' },
        { status: 400 }
      );
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)' },
        { status: 400 }
      );
    }

    // Hash phone number for lookup
    const phoneHash = hashPhoneNumber(formattedPhone);

    // Query admin user with tenant access
    const query = `
      SELECT
        au.id, au.name, au.email, au.is_active,
        ata.tenant_id, ata.role, ata.is_active as tenant_access_active
      FROM admin_users au
      LEFT JOIN admin_tenant_access ata ON au.id = ata.admin_user_id
      WHERE au.phone_hash = ? AND au.is_active = 1
    `;

    const result = await env.TENANTS_DB.prepare(query).bind(phoneHash).all();

    // Check if user exists and has access to this tenant
    let hasAccess = false;
    if (result.results && result.results.length > 0) {
      hasAccess = result.results.some((row: any) =>
        row.tenant_id === tenantId && row.tenant_access_active === 1
      );
    }

    // If user doesn't exist or doesn't have access, check if phone matches tenant owner
    if (!hasAccess) {
      // Query restaurant_tenants to check if this is the owner
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

      // Check if phone matches owner phone
      const ownerPhone = (ownerResult as any).phone;
      const formattedOwnerPhone = formatPhoneNumber(ownerPhone);
      const ownerPhoneHash = hashPhoneNumber(formattedOwnerPhone);

      if (phoneHash !== ownerPhoneHash) {
        return NextResponse.json(
          {
            success: false,
            error: 'This phone number is not authorized for this restaurant. Please contact the restaurant owner.'
          },
          { status: 403 }
        );
      }

      // Phone matches owner - will auto-create admin on verification
      console.log(`[Admin Auth] Phone matches owner for ${tenantId}, will auto-create admin`);
    }

    // Check if phone is whitelisted for this tenant (bypass Twilio)
    if (isPhoneWhitelisted(tenantId, formattedPhone)) {
      console.log(`[Admin Auth] Phone ${formattedPhone} is whitelisted for tenant ${tenantId}, bypassing Twilio`);

      return NextResponse.json({
        success: true,
        verificationSid: `BYPASS-${tenantId}-${Date.now()}`, // Special SID for bypass mode
        phoneNumber: formattedPhone,
        message: 'Verification code sent via SMS',
        bypassMode: true // Internal flag (not shown to client)
      });
    }

    // Send verification code via Twilio
    const twilioResponse = await fetch(`${TWILIO_VERIFY_URL}/verify/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedPhone,
        channel: 'sms',
        locale: 'en'
      })
    });

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.json() as any;
      console.error('[Admin Auth] Twilio error:', twilioError);

      // Handle rate limiting
      if (twilioResponse.status === 429) {
        return NextResponse.json(
          {
            success: false,
            error: 'Too many verification attempts. Please try again later.',
            retryAfter: twilioError.retryAfter || 3600
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Failed to send verification code' },
        { status: 500 }
      );
    }

    const twilioData = await twilioResponse.json() as any;

    return NextResponse.json({
      success: true,
      verificationSid: twilioData.verificationSid,
      phoneNumber: formattedPhone,
      message: 'Verification code sent via SMS'
    });

  } catch (error) {
    console.error('[Admin Auth] Login start error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start login process',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

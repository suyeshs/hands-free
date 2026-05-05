/**
 * Authentication Handler for Mobile Apps
 * Handles owner and staff authentication with OTP verification
 */

interface Env {
  TENANTS_DB: D1Database;
  MSG91_VERIFY_WORKER_URL: string;
  JWT_SECRET: string;
  TENANT_METADATA?: KVNamespace;
}

// Simple JWT generation (in production, use proper JWT library)
async function generateJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  }));

  const data = `${headerB64}.${payloadB64}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${data}.${signatureB64}`;
}

/**
 * Verify Owner Phone Number
 * Checks if phone matches owner phone in tenant record and sends OTP
 */
export async function verifyOwnerPhone(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { phone: string };

    if (!body.phone) {
      return Response.json({
        success: false,
        error: 'Phone number is required',
      }, { status: 400 });
    }

    // Validate phone format (E.164)
    if (!/^\+[1-9]\d{1,14}$/.test(body.phone)) {
      return Response.json({
        success: false,
        error: 'Invalid phone number format. Use E.164 format (e.g., +919876543210)',
      }, { status: 400 });
    }

    // Check if phone matches owner phone in TENANTS_DB
    const tenant = await env.TENANTS_DB.prepare(
      `SELECT tenant_id, company_name, phone FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(tenantId).first();

    if (!tenant) {
      return Response.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    if (tenant.phone !== body.phone) {
      return Response.json({
        success: false,
        error: 'Phone number not registered as owner for this restaurant',
      }, { status: 403 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in KV with 5-minute expiration
    if (env.TENANT_METADATA) {
      const otpKey = `otp:${body.phone}`;
      await env.TENANT_METADATA.put(otpKey, otp, { expirationTtl: 300 }); // 5 minutes
    }

    // For testing: return OTP in response (in production, only send via SMS)
    return Response.json({
      success: true,
      otpSent: true,
      message: 'OTP generated (shown for testing - in production will be sent via SMS)',
      phone: body.phone,
      otp: otp, // TESTING ONLY - remove in production
    });

  } catch (error: any) {
    console.error('[Auth] Error verifying owner phone:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Verify Owner OTP and Generate Token
 * Verifies OTP and returns JWT token for authenticated owner
 */
export async function verifyOwnerOTP(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { phone: string; otp: string };

    if (!body.phone || !body.otp) {
      return Response.json({
        success: false,
        error: 'Phone number and OTP are required',
      }, { status: 400 });
    }

    // Verify OTP from KV store
    if (env.TENANT_METADATA) {
      const otpKey = `otp:${body.phone}`;
      const storedOtp = await env.TENANT_METADATA.get(otpKey);

      if (!storedOtp || storedOtp !== body.otp) {
        return Response.json({
          success: false,
          error: 'Invalid or expired OTP',
        }, { status: 401 });
      }

      // Delete OTP after successful verification
      await env.TENANT_METADATA.delete(otpKey);
    } else {
      return Response.json({
        success: false,
        error: 'OTP verification not configured',
      }, { status: 500 });
    }

    // Get tenant details
    const tenant = await env.TENANTS_DB.prepare(
      `SELECT tenant_id, company_name, subdomain, email, phone FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(tenantId).first();

    if (!tenant) {
      return Response.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    // Generate JWT token
    const token = await generateJWT({
      userId: tenantId,
      phone: body.phone,
      role: 'owner',
      tenantId: tenantId,
    }, env.JWT_SECRET || 'default-jwt-secret-change-in-production');

    return Response.json({
      success: true,
      token,
      user: {
        id: tenantId,
        phone: body.phone,
        email: tenant.email,
        role: 'owner',
        tenantId: tenantId,
        tenantName: tenant.company_name,
        subdomain: tenant.subdomain,
      },
    });

  } catch (error: any) {
    console.error('[Auth] Error verifying owner OTP:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Verify Staff Credentials (Phone + PIN)
 * Authenticates staff member with phone and PIN
 */
export async function verifyStaffCredentials(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as { phone: string; pin: string };

    if (!body.phone || !body.pin) {
      return Response.json({
        success: false,
        error: 'Phone number and PIN are required',
      }, { status: 400 });
    }

    // Check staff_users table for matching phone and PIN
    // Note: In production, PIN should be hashed
    const staff = await env.TENANTS_DB.prepare(
      `SELECT id, name, phone, role, location_id, is_active
       FROM staff_users
       WHERE phone = ? AND pin = ? AND is_active = 1`
    ).bind(body.phone, body.pin).first();

    if (!staff) {
      return Response.json({
        success: false,
        error: 'Invalid phone number or PIN',
      }, { status: 401 });
    }

    // Get tenant details
    const tenant = await env.TENANTS_DB.prepare(
      `SELECT company_name, subdomain FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(tenantId).first();

    // Generate JWT token
    const token = await generateJWT({
      userId: staff.id,
      phone: body.phone,
      role: staff.role || 'staff',
      tenantId: tenantId,
      locationId: staff.location_id,
    }, env.JWT_SECRET || 'default-jwt-secret-change-in-production');

    return Response.json({
      success: true,
      token,
      user: {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        role: staff.role || 'staff',
        tenantId: tenantId,
        tenantName: tenant?.company_name,
        subdomain: tenant?.subdomain,
        locationId: staff.location_id,
      },
    });

  } catch (error: any) {
    console.error('[Auth] Error verifying staff credentials:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Refresh Token
 * Generates a new token for authenticated user
 */
export async function refreshToken(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // In production, verify the old token first
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({
        success: false,
        error: 'Authorization token required',
      }, { status: 401 });
    }

    const oldToken = authHeader.substring(7);

    // TODO: Decode and verify old token
    // For now, return error - implement JWT verification in production
    return Response.json({
      success: false,
      error: 'Token refresh not yet implemented',
    }, { status: 501 });

  } catch (error: any) {
    console.error('[Auth] Error refreshing token:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

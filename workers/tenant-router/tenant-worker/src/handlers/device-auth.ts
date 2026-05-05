/**
 * Device-Based Authentication Handler
 * Each device must be registered individually via QR code
 * No OTP required - device-dependent authentication
 */

interface Env {
  TENANTS_DB: D1Database;
  TENANT_METADATA?: KVNamespace;
  JWT_SECRET: string;
}

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceModel: string;
  deviceOs: string;
  deviceFingerprint: string;
}

// Generate JWT token
async function generateJWT(payload: any, secret: string, expiresInSeconds: number): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
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

// Verify JWT token
async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));

  if (!valid) throw new Error('Invalid token signature');

  const payload = JSON.parse(atob(payloadB64));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// Generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Hash device token for storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate QR Registration Token
 * Called by desktop app when owner wants to add a new device
 */
export async function generateQRToken(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      role: string;
      userId?: string;
      expiresInMinutes?: number;
      maxUses?: number;
    };

    const role = body.role || 'owner';
    const expiresInMinutes = body.expiresInMinutes || 10;
    const maxUses = body.maxUses || 1;

    // Get tenant details
    const tenant = await env.TENANTS_DB.prepare(
      `SELECT tenant_id, company_name, subdomain FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(tenantId).first();

    if (!tenant) {
      return Response.json({
        success: false,
        error: 'Tenant not found',
      }, { status: 404 });
    }

    // Generate registration token
    const tokenId = generateId();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Create JWT token for QR code
    const registrationToken = await generateJWT({
      iss: 'handsfree.tech',
      sub: 'device-registration',
      typ: 'registration',
      tenantId: tenant.tenant_id,
      tenantName: tenant.company_name,
      subdomain: tenant.subdomain,
      apiUrl: `https://${tenant.subdomain}.handsfree.tech`,
      role: role,
      userId: body.userId || null,
      tokenId: tokenId,
    }, env.JWT_SECRET || 'default-secret', expiresInMinutes * 60);

    // Store token in database
    await env.TENANTS_DB.prepare(
      `INSERT INTO registration_tokens
       (token_id, tenant_id, user_id, role, created_at, expires_at, is_active, max_uses, use_count)
       VALUES (?, ?, ?, ?, datetime('now'), ?, 1, ?, 0)`
    ).bind(
      tokenId,
      tenant.tenant_id,
      body.userId || null,
      role,
      expiresAt.toISOString(),
      maxUses
    ).run();

    // Create QR code data URL
    const qrData = `handsfree://register?token=${registrationToken}`;

    return Response.json({
      success: true,
      qrData: qrData,
      token: {
        tokenId: tokenId,
        expiresAt: expiresAt.toISOString(),
        maxUses: maxUses,
      },
    });

  } catch (error: any) {
    console.error('[DeviceAuth] Error generating QR token:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Register Device
 * Called by mobile app after scanning QR code
 */
export async function registerDevice(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as {
      registrationToken: string;
      deviceInfo: DeviceInfo;
    };

    if (!body.registrationToken || !body.deviceInfo) {
      return Response.json({
        success: false,
        error: 'Registration token and device info are required',
      }, { status: 400 });
    }

    // Verify registration token
    let tokenPayload;
    try {
      tokenPayload = await verifyJWT(body.registrationToken, env.JWT_SECRET || 'default-secret');
    } catch (error) {
      return Response.json({
        success: false,
        error: 'Invalid or expired registration token',
      }, { status: 401 });
    }

    // Check token in database
    const token = await env.TENANTS_DB.prepare(
      `SELECT token_id, tenant_id, user_id, role, is_active, max_uses, use_count, expires_at
       FROM registration_tokens
       WHERE token_id = ?`
    ).bind(tokenPayload.tokenId).first();

    if (!token) {
      return Response.json({
        success: false,
        error: 'Registration token not found',
      }, { status: 404 });
    }

    if (!token.is_active) {
      return Response.json({
        success: false,
        error: 'Registration token has been revoked',
      }, { status: 403 });
    }

    if (token.use_count >= token.max_uses) {
      return Response.json({
        success: false,
        error: 'Registration token has already been used',
      }, { status: 403 });
    }

    if (new Date(token.expires_at) < new Date()) {
      return Response.json({
        success: false,
        error: 'Registration token has expired',
      }, { status: 403 });
    }

    // Check if device already exists
    const existingDevice = await env.TENANTS_DB.prepare(
      `SELECT device_id FROM registered_devices
       WHERE device_fingerprint = ? AND is_active = 1`
    ).bind(body.deviceInfo.deviceFingerprint).first();

    if (existingDevice) {
      return Response.json({
        success: false,
        error: 'Device already registered. Please use existing device token.',
      }, { status: 409 });
    }

    // Generate device token (90 days)
    const deviceToken = await generateJWT({
      iss: 'handsfree.tech',
      sub: 'device-authentication',
      typ: 'device',
      deviceId: body.deviceInfo.deviceId,
      tenantId: token.tenant_id,
      userId: token.user_id || token.tenant_id,
      role: token.role,
      deviceFingerprint: body.deviceInfo.deviceFingerprint,
    }, env.JWT_SECRET || 'default-secret', 90 * 24 * 60 * 60); // 90 days

    // Generate session token (7 days)
    const sessionToken = await generateJWT({
      iss: 'handsfree.tech',
      sub: token.user_id || token.tenant_id,
      typ: 'session',
      tenantId: token.tenant_id,
      role: token.role,
      deviceId: body.deviceInfo.deviceId,
    }, env.JWT_SECRET || 'default-secret', 7 * 24 * 60 * 60); // 7 days

    // Hash device token for storage
    const deviceTokenHash = await hashToken(deviceToken);

    // Register device in database
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await env.TENANTS_DB.prepare(
      `INSERT INTO registered_devices
       (device_id, tenant_id, user_id, user_role, device_name, device_model, device_os,
        device_fingerprint, device_token_hash, registered_at, registered_via, last_seen_at,
        expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'qr', datetime('now'), ?, 1)`
    ).bind(
      body.deviceInfo.deviceId,
      token.tenant_id,
      token.user_id || token.tenant_id,
      token.role,
      body.deviceInfo.deviceName,
      body.deviceInfo.deviceModel,
      body.deviceInfo.deviceOs,
      body.deviceInfo.deviceFingerprint,
      deviceTokenHash,
      expiresAt.toISOString()
    ).run();

    // Mark token as used
    await env.TENANTS_DB.prepare(
      `UPDATE registration_tokens
       SET use_count = use_count + 1,
           used_at = datetime('now'),
           used_by_device_id = ?
       WHERE token_id = ?`
    ).bind(body.deviceInfo.deviceId, tokenPayload.tokenId).run();

    // Get tenant details
    const tenant = await env.TENANTS_DB.prepare(
      `SELECT company_name, subdomain FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(token.tenant_id).first();

    return Response.json({
      success: true,
      deviceToken: deviceToken,
      sessionToken: sessionToken,
      tenant: {
        tenantId: token.tenant_id,
        tenantName: tenant?.company_name,
        subdomain: tenant?.subdomain,
        apiUrl: `https://${tenant?.subdomain}.handsfree.tech`,
      },
      user: {
        userId: token.user_id || token.tenant_id,
        role: token.role,
        permissions: token.role === 'owner' ? ['all'] : [],
      },
      device: {
        deviceId: body.deviceInfo.deviceId,
        registeredAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });

  } catch (error: any) {
    console.error('[DeviceAuth] Error registering device:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Device Login
 * Called by mobile app on subsequent launches
 */
export async function deviceLogin(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as {
      deviceToken: string;
      deviceFingerprint: string;
    };

    if (!body.deviceToken || !body.deviceFingerprint) {
      return Response.json({
        success: false,
        error: 'Device token and fingerprint are required',
      }, { status: 400 });
    }

    // Verify device token
    let tokenPayload;
    try {
      tokenPayload = await verifyJWT(body.deviceToken, env.JWT_SECRET || 'default-secret');
    } catch (error) {
      return Response.json({
        success: false,
        error: 'Invalid or expired device token',
      }, { status: 401 });
    }

    // Verify fingerprint matches
    if (tokenPayload.deviceFingerprint !== body.deviceFingerprint) {
      return Response.json({
        success: false,
        error: 'Device fingerprint mismatch',
      }, { status: 403 });
    }

    // Check device is still active
    const device = await env.TENANTS_DB.prepare(
      `SELECT device_id, tenant_id, user_id, user_role, is_active, expires_at
       FROM registered_devices
       WHERE device_id = ?`
    ).bind(tokenPayload.deviceId).first();

    if (!device) {
      return Response.json({
        success: false,
        error: 'Device not found',
      }, { status: 404 });
    }

    if (!device.is_active) {
      return Response.json({
        success: false,
        error: 'Device has been revoked',
      }, { status: 403 });
    }

    if (new Date(device.expires_at) < new Date()) {
      return Response.json({
        success: false,
        error: 'Device token has expired',
      }, { status: 403 });
    }

    // Update last seen
    await env.TENANTS_DB.prepare(
      `UPDATE registered_devices SET last_seen_at = datetime('now') WHERE device_id = ?`
    ).bind(tokenPayload.deviceId).run();

    // Generate new session token
    const sessionToken = await generateJWT({
      iss: 'handsfree.tech',
      sub: device.user_id,
      typ: 'session',
      tenantId: device.tenant_id,
      role: device.user_role,
      deviceId: device.device_id,
    }, env.JWT_SECRET || 'default-secret', 7 * 24 * 60 * 60); // 7 days

    // Get tenant details
    const tenant = await env.TENANTS_DB.prepare(
      `SELECT company_name, subdomain FROM restaurant_tenants WHERE tenant_id = ?`
    ).bind(device.tenant_id).first();

    return Response.json({
      success: true,
      sessionToken: sessionToken,
      user: {
        userId: device.user_id,
        role: device.user_role,
        permissions: device.user_role === 'owner' ? ['all'] : [],
      },
      tenant: {
        tenantId: device.tenant_id,
        tenantName: tenant?.company_name,
        subdomain: tenant?.subdomain,
      },
    });

  } catch (error: any) {
    console.error('[DeviceAuth] Error during device login:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * List Registered Devices
 */
export async function listDevices(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const devices = await env.TENANTS_DB.prepare(
      `SELECT device_id, device_name, device_model, device_os, user_role,
              registered_at, last_seen_at, expires_at, is_active
       FROM registered_devices
       WHERE tenant_id = ?
       ORDER BY registered_at DESC`
    ).bind(tenantId).all();

    return Response.json({
      success: true,
      devices: devices.results || [],
    });

  } catch (error: any) {
    console.error('[DeviceAuth] Error listing devices:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Revoke Device
 */
export async function revokeDevice(
  request: Request,
  env: Env,
  tenantId: string,
  deviceId: string
): Promise<Response> {
  try {
    const body = await request.json() as { reason?: string };

    await env.TENANTS_DB.prepare(
      `UPDATE registered_devices
       SET is_active = 0,
           revoked_at = datetime('now'),
           revoke_reason = ?
       WHERE device_id = ? AND tenant_id = ?`
    ).bind(body.reason || 'Revoked by owner', deviceId, tenantId).run();

    return Response.json({
      success: true,
      message: 'Device revoked successfully',
    });

  } catch (error: any) {
    console.error('[DeviceAuth] Error revoking device:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Check QR Token Status (for desktop polling)
 */
export async function checkQRTokenStatus(
  request: Request,
  env: Env,
  tokenId: string
): Promise<Response> {
  try {
    const token = await env.TENANTS_DB.prepare(
      `SELECT used_at, used_by_device_id, expires_at
       FROM registration_tokens
       WHERE token_id = ?`
    ).bind(tokenId).first();

    if (!token) {
      return Response.json({
        success: false,
        error: 'Token not found',
      }, { status: 404 });
    }

    const used = !!token.used_at;

    if (used) {
      const device = await env.TENANTS_DB.prepare(
        `SELECT device_name, device_model
         FROM registered_devices
         WHERE device_id = ?`
      ).bind(token.used_by_device_id).first();

      return Response.json({
        success: true,
        used: true,
        usedAt: token.used_at,
        deviceName: device?.device_name || 'Unknown Device',
        deviceModel: device?.device_model,
      });
    }

    return Response.json({
      success: true,
      used: false,
      expiresAt: token.expires_at,
    });

  } catch (error: any) {
    console.error('[DeviceAuth] Error checking token status:', error);
    return Response.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

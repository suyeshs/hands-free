/**
 * Admin Authentication Utilities
 * Purpose: Shared utilities for admin authentication, session management, and encryption
 */

import { createHmac, randomBytes } from 'crypto';

// Environment configuration
const HMAC_KEY = process.env.ADMIN_PHONE_HMAC_KEY || 'handsfree-admin-phone-hmac-key-2025';
const JWT_SECRET = process.env.JWT_SECRET || 'handsfree-jwt-secret-2025-change-in-production';

/**
 * Admin User Interface
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phoneHash: string;
  isActive: boolean;
}

/**
 * Admin Tenant Access Interface
 */
export interface AdminTenantAccess {
  tenantId: string;
  companyName: string;
  role: 'owner' | 'manager' | 'staff';
  isActive: boolean;
}

/**
 * Admin Session Interface
 */
export interface AdminSession {
  sessionId: string;
  userId: string;
  phoneHash: string;
  tenantAccess: {
    [tenantId: string]: {
      role: 'owner' | 'manager' | 'staff';
      isActive: boolean;
    };
  };
  currentTenantId: string;
  accessToken: string;
  refreshToken: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

/**
 * JWT Payload Interface
 */
export interface JWTPayload {
  userId: string;
  sessionId: string;
  tenantAccess: Record<string, { role: string; isActive: boolean }>;
  iat: number;
  exp: number;
}

/**
 * Hash phone number using HMAC-SHA256
 */
export function hashPhoneNumber(phoneNumber: string): string {
  const hmac = createHmac('sha256', HMAC_KEY);
  hmac.update(phoneNumber);
  return hmac.digest('hex');
}

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

/**
 * Create JWT access token
 */
export function createJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: number = 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  // Simple JWT implementation (in production, use jose or jsonwebtoken library)
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode JWT
 */
export function verifyJWT(token: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  // Verify signature
  const expectedSignature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Invalid JWT signature');
  }

  // Decode payload
  const payload: JWTPayload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT expired');
  }

  return payload;
}

/**
 * Validate E.164 phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  // E.164 format: +[country code][subscriber number]
  // Example: +14155551234
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Format phone number to E.164
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // Assume US/Canada if no country code
    cleaned = '+1' + cleaned;
  }

  return cleaned;
}

/**
 * Get admin user by phone hash from D1
 */
export async function getAdminUserByPhone(
  phoneHash: string,
  db: D1Database
): Promise<(AdminUser & { tenantAccess: AdminTenantAccess[] }) | null> {
  try {
    // Query admin user with all tenant access
    const query = `
      SELECT
        au.id, au.name, au.email, au.phone_hash, au.is_active,
        ata.tenant_id, ata.role, ata.is_active as tenant_access_active,
        rt.company_name
      FROM admin_users au
      LEFT JOIN admin_tenant_access ata ON au.id = ata.admin_user_id
      LEFT JOIN restaurant_tenants rt ON ata.tenant_id = rt.tenant_id
      WHERE au.phone_hash = ? AND au.is_active = 1 AND ata.is_active = 1
    `;

    const result = await db.prepare(query).bind(phoneHash).all();

    if (!result.results || result.results.length === 0) {
      return null;
    }

    const firstRow: any = result.results[0];
    const adminUser: AdminUser & { tenantAccess: AdminTenantAccess[] } = {
      id: firstRow.id,
      name: firstRow.name,
      email: firstRow.email,
      phoneHash: firstRow.phone_hash,
      isActive: firstRow.is_active === 1,
      tenantAccess: []
    };

    // Build tenant access list
    for (const row of result.results) {
      const typedRow = row as any;
      if (typedRow.tenant_id) {
        adminUser.tenantAccess.push({
          tenantId: typedRow.tenant_id,
          companyName: typedRow.company_name || typedRow.tenant_id,
          role: typedRow.role as 'owner' | 'manager' | 'staff',
          isActive: typedRow.tenant_access_active === 1
        });
      }
    }

    return adminUser;
  } catch (error) {
    console.error('[AdminAuth] Error fetching admin user:', error);
    throw error;
  }
}

/**
 * Check if admin has access to tenant
 */
export function hasAccessToTenant(
  session: AdminSession,
  tenantId: string
): boolean {
  return (
    session.tenantAccess[tenantId] &&
    session.tenantAccess[tenantId].isActive
  );
}

/**
 * Get admin role for tenant
 */
export function getAdminRole(
  session: AdminSession,
  tenantId: string
): 'owner' | 'manager' | 'staff' | null {
  if (!hasAccessToTenant(session, tenantId)) {
    return null;
  }
  return session.tenantAccess[tenantId].role;
}

/**
 * Log admin audit event
 */
export async function logAuditEvent(
  db: D1Database,
  event: {
    tenantId: string;
    adminUserId: string | null;
    action: 'login' | 'logout' | 'failed_login' | 'permission_denied' | 'tenant_switch' | 'admin_invited' | 'admin_deactivated';
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    const query = `
      INSERT INTO admin_audit_log (tenant_id, admin_user_id, action, ip_address, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(query).bind(
      event.tenantId,
      event.adminUserId,
      event.action,
      event.ipAddress || null,
      event.userAgent || null,
      event.metadata ? JSON.stringify(event.metadata) : null
    ).run();
  } catch (error) {
    console.error('[AdminAuth] Error logging audit event:', error);
    // Don't throw - audit logging failures shouldn't break the flow
  }
}

/**
 * Parse cookies from request headers
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {} as Record<string, string>);
}

/**
 * Create cookie header string
 */
export function createCookieHeader(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join('; ');
}

/**
 * Clear cookie header string
 */
export function clearCookieHeader(name: string, path: string = '/'): string {
  return createCookieHeader(name, '', {
    maxAge: 0,
    path,
    httpOnly: true,
    secure: true,
    sameSite: 'Strict'
  });
}

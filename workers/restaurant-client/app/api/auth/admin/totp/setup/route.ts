/**
 * TOTP Setup API - Initialize 2FA setup
 * POST /api/auth/admin/totp/setup
 *
 * This endpoint generates a new TOTP secret and returns a QR code
 * User must be authenticated (just completed phone SMS verification)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  generateTOTPSecret,
  encryptTOTPSecret,
  generateTOTPQRCode,
  generateBackupCodes,
  hashBackupCode,
} from '@/lib/totp';
import { parseCookies, verifyJWT } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('[TOTP Setup] Starting TOTP setup initialization');

    // Get authentication from cookies
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies['admin_access_token'];

    if (!accessToken) {
      console.error('[TOTP Setup] No access token found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in first' },
        { status: 401 }
      );
    }

    // Verify JWT and get user ID
    let decoded;
    try {
      decoded = verifyJWT(accessToken);
    } catch (jwtError) {
      console.error('[TOTP Setup] Invalid JWT:', jwtError);
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;
    const tenantId = request.headers.get('x-tenant-id') || 'demo';

    console.log('[TOTP Setup] User:', userId, 'Tenant:', tenantId);

    // Get database from Cloudflare context
    const { env } = await getCloudflareContext();
    const db = env.TENANTS_DB;

    // Check if user already has TOTP enabled
    const existingUser = await db
      .prepare('SELECT totp_enabled FROM admin_users WHERE id = ?')
      .bind(userId)
      .first();

    if (!existingUser) {
      console.error('[TOTP Setup] User not found:', userId);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if ((existingUser as any).totp_enabled === 1) {
      console.log('[TOTP Setup] TOTP already enabled for user');
      return NextResponse.json(
        { success: false, error: 'TOTP is already enabled. Disable it first to set up again.' },
        { status: 400 }
      );
    }

    // Generate TOTP secret
    const userIdentifier = userId.slice(0, 8); // Use shortened user ID as identifier
    const { secret, base32, otpauthUrl } = generateTOTPSecret(userIdentifier);

    console.log('[TOTP Setup] Generated TOTP secret for user');

    // Generate QR code
    const qrCodeDataUrl = await generateTOTPQRCode(otpauthUrl);

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

    // Encrypt the secret before storing
    const encryptedSecret = encryptTOTPSecret(base32);

    // Store encrypted secret temporarily (not enabled yet)
    // User must verify by entering a code before TOTP is enabled
    await db
      .prepare(`
        UPDATE admin_users
        SET
          totp_secret = ?,
          totp_backup_codes = ?,
          totp_created_at = datetime('now'),
          totp_enabled = 0
        WHERE id = ?
      `)
      .bind(encryptedSecret, JSON.stringify(hashedBackupCodes), userId)
      .run();

    console.log('[TOTP Setup] Stored TOTP secret (not enabled yet)');

    // Return QR code and backup codes to user
    return NextResponse.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        secret: base32, // Show secret in case user wants to enter manually
        backupCodes: backupCodes, // Show once, user should save these
        otpauthUrl: otpauthUrl,
      },
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error) {
    console.error('[TOTP Setup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to set up TOTP',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

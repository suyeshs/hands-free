/**
 * TOTP Setup Verification API - Complete 2FA setup
 * POST /api/auth/admin/totp/setup/verify
 *
 * After user scans QR code, they must verify by entering a code
 * This enables TOTP for their account
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { decryptTOTPSecret, verifyTOTPToken, isValidTOTPFormat } from '@/lib/totp';
import { parseCookies, verifyJWT } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    console.log('[TOTP Setup Verify] Starting TOTP setup verification');

    // Get authentication from cookies
    const cookieHeader = request.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies['admin_access_token'];

    if (!accessToken) {
      console.error('[TOTP Setup Verify] No access token found');
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
      console.error('[TOTP Setup Verify] Invalid JWT:', jwtError);
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;

    // Parse request body
    const body = await request.json() as any;
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    if (!isValidTOTPFormat(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format. Must be 6 digits.' },
        { status: 400 }
      );
    }

    console.log('[TOTP Setup Verify] User:', userId, 'verifying token');

    // Get database from Cloudflare context
    const { env } = await getCloudflareContext();
    const db = env.TENANTS_DB;

    // Get user's TOTP secret
    const user = await db
      .prepare('SELECT totp_secret, totp_enabled FROM admin_users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      console.error('[TOTP Setup Verify] User not found:', userId);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const totpSecret = (user as any).totp_secret;
    const totpEnabled = (user as any).totp_enabled;

    if (!totpSecret) {
      console.error('[TOTP Setup Verify] No TOTP secret found for user');
      return NextResponse.json(
        { success: false, error: 'TOTP setup not initialized. Please start setup first.' },
        { status: 400 }
      );
    }

    if (totpEnabled === 1) {
      console.log('[TOTP Setup Verify] TOTP already enabled');
      return NextResponse.json(
        { success: false, error: 'TOTP is already enabled' },
        { status: 400 }
      );
    }

    // Decrypt the secret
    let decryptedSecret;
    try {
      decryptedSecret = decryptTOTPSecret(totpSecret);
    } catch (decryptError) {
      console.error('[TOTP Setup Verify] Failed to decrypt secret:', decryptError);
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt TOTP secret' },
        { status: 500 }
      );
    }

    // Verify the token
    const isValid = verifyTOTPToken(token, decryptedSecret);

    if (!isValid) {
      console.log('[TOTP Setup Verify] Invalid token provided');

      // Log failed verification attempt
      await db
        .prepare(`
          INSERT INTO admin_totp_audit (admin_user_id, event_type, created_at)
          VALUES (?, 'setup_verify_failure', datetime('now'))
        `)
        .bind(userId)
        .run();

      return NextResponse.json(
        { success: false, error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Token is valid! Enable TOTP for the user
    await db
      .prepare(`
        UPDATE admin_users
        SET
          totp_enabled = 1,
          totp_verified_at = datetime('now')
        WHERE id = ?
      `)
      .bind(userId)
      .run();

    // Log successful setup
    await db
      .prepare(`
        INSERT INTO admin_totp_audit (admin_user_id, event_type, created_at)
        VALUES (?, 'setup_success', datetime('now'))
      `)
      .bind(userId)
      .run();

    console.log('[TOTP Setup Verify] TOTP enabled successfully for user:', userId);

    return NextResponse.json({
      success: true,
      message: 'TOTP enabled successfully! You will now be prompted for a code on login.',
    });
  } catch (error) {
    console.error('[TOTP Setup Verify] Error:', error);
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

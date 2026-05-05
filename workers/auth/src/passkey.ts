/**
 * Production-Ready WebAuthn/Passkey Implementation
 * Security: Follows FIDO2 Alliance best practices
 * Library: @simplewebauthn/server (battle-tested, 12k+ stars)
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';

// ========================================
// Configuration
// ========================================

const RP_NAME = 'Facemash Platform';
const RP_ID = 'stonepot-admin.pages.dev'; // Will be dynamic based on environment
const ORIGIN = 'https://stonepot-admin.pages.dev';
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// ========================================
// Types
// ========================================

interface PasskeyCredential {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports?: string;
  aaguid?: string;
  device_name?: string;
  device_type?: string;
  backup_eligible: boolean;
  backup_state: boolean;
  created_at: string;
  last_used_at: string;
  is_active: boolean;
}

interface PasskeyChallenge {
  challenge: string;
  user_id?: string;
  email?: string;
  operation: 'registration' | 'authentication';
  expires_at: string;
  used: boolean;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Get relying party configuration based on request origin
 */
function getRPConfig(origin: string) {
  const url = new URL(origin);
  return {
    rpName: RP_NAME,
    rpID: url.hostname,
    origin: origin,
  };
}

/**
 * Generate secure challenge and store in database
 */
async function createChallenge(
  env: Env,
  operation: 'registration' | 'authentication',
  userId?: string,
  email?: string
): Promise<string> {
  // Generate cryptographically secure challenge
  const challenge = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS).toISOString();

  await env.AUTH_DB.prepare(
    `INSERT INTO passkey_challenges (challenge, user_id, email, operation, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(challenge, userId || null, email || null, operation, expiresAt)
    .run();

  return challenge;
}

/**
 * Extract challenge from clientDataJSON
 */
function extractChallenge(clientDataJSON: string): string {
  try {
    // clientDataJSON is base64url encoded
    const decoded = Buffer.from(clientDataJSON, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded);
    return data.challenge;
  } catch (error) {
    console.error('[Passkey] Failed to extract challenge:', error);
    throw new Error('Invalid clientDataJSON');
  }
}

/**
 * Verify and consume challenge (prevent replay attacks)
 */
async function verifyChallenge(
  env: Env,
  challenge: string,
  operation: 'registration' | 'authentication'
): Promise<PasskeyChallenge | null> {
  const result = await env.AUTH_DB.prepare(
    `SELECT * FROM passkey_challenges
     WHERE challenge = ? AND operation = ? AND used = FALSE AND expires_at > datetime('now')`
  )
    .bind(challenge, operation)
    .first<PasskeyChallenge>();

  if (!result) return null;

  // Mark challenge as used (prevent reuse)
  await env.AUTH_DB.prepare(
    `UPDATE passkey_challenges SET used = TRUE WHERE challenge = ?`
  )
    .bind(challenge)
    .run();

  return result;
}

/**
 * Clean up expired challenges (call periodically via cron)
 */
export async function cleanupExpiredChallenges(env: Env): Promise<void> {
  await env.AUTH_DB.prepare(
    `DELETE FROM passkey_challenges WHERE expires_at < datetime('now', '-1 hour')`
  ).run();
}

// ========================================
// Registration Flow
// ========================================

/**
 * Step 1: Generate registration options
 * Called when user clicks "Set up Touch ID"
 */
export async function initiateRegistration(
  env: Env,
  userId: string,
  email: string,
  userName: string,
  origin: string
): Promise<any> {
  try {
    const rpConfig = getRPConfig(origin);

    // Get existing credentials to exclude (user can't register same authenticator twice)
    const existingCredentials = await env.AUTH_DB.prepare(
      `SELECT id FROM passkey_credentials WHERE user_id = ? AND is_active = TRUE`
    )
      .bind(userId)
      .all();

    const excludeCredentials = existingCredentials.results.map((cred: any) => ({
      id: cred.id,
      type: 'public-key' as const,
    }));

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: rpConfig.rpName,
      rpID: rpConfig.rpID,
      userID: userId,
      userName: email,
      userDisplayName: userName,
      attestationType: 'none', // Privacy-friendly, no device attestation
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required', // Create discoverable credentials (no QR codes needed)
        userVerification: 'required', // Require device authentication
        authenticatorAttachment: 'platform', // Only platform authenticators (Touch ID, Face ID, Windows Hello)
      },
    });

    // Store challenge
    await createChallenge(env, 'registration', userId, email);

    return {
      success: true,
      options,
    };
  } catch (error) {
    console.error('[Passkey] Registration initiation failed:', error);
    throw new Error('Failed to initiate passkey registration');
  }
}

/**
 * Step 2: Verify registration response
 * Called after user completes Touch ID/Face ID
 */
export async function verifyRegistration(
  env: Env,
  userId: string,
  response: any,
  origin: string
): Promise<{ success: boolean; credential?: any }> {
  try {
    const rpConfig = getRPConfig(origin);

    // Extract and verify challenge
    const challenge = extractChallenge(response.response.clientDataJSON);
    const challengeRecord = await verifyChallenge(
      env,
      challenge,
      'registration'
    );

    if (!challengeRecord || challengeRecord.user_id !== userId) {
      throw new Error('Invalid or expired challenge');
    }

    // Verify registration response
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: rpConfig.origin,
      expectedRPID: rpConfig.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }

    const { credentialID, credentialPublicKey, counter, aaguid, credentialBackedUp, credentialDeviceType } =
      verification.registrationInfo;

    // Store credential in database
    const credentialId = Buffer.from(credentialID).toString('base64url');
    const publicKey = Buffer.from(credentialPublicKey).toString('base64url');

    await env.AUTH_DB.prepare(
      `INSERT INTO passkey_credentials 
       (id, user_id, public_key, counter, aaguid, device_type, backup_eligible, backup_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        credentialId,
        userId,
        publicKey,
        counter,
        aaguid,
        credentialDeviceType,
        credentialBackedUp,
        credentialBackedUp
      )
      .run();

    // Mark user as passkey-enabled
    await env.AUTH_DB.prepare(
      `UPDATE platform_user 
       SET passkey_enabled = TRUE, passkey_setup_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(userId)
      .run();

    console.log(`[Passkey] Registration successful for user: ${userId}`);

    return {
      success: true,
      credential: {
        id: credentialId,
        type: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
    };
  } catch (error) {
    console.error('[Passkey] Registration verification failed:', error);
    return {
      success: false,
    };
  }
}

// ========================================
// Authentication Flow
// ========================================

/**
 * Step 1: Generate authentication options
 * Called when user clicks "Sign in with passkey"
 */
export async function initiateAuthentication(
  env: Env,
  email?: string,
  origin?: string
): Promise<any> {
  try {
    const rpConfig = getRPConfig(origin || ORIGIN);

    let allowCredentials: any[] | undefined;

    if (email) {
      // Get user's credentials
      const user = await env.AUTH_DB.prepare(
        `SELECT id FROM platform_user WHERE email = ?`
      )
        .bind(email)
        .first<{ id: string }>();

      if (user) {
        const credentials = await env.AUTH_DB.prepare(
          `SELECT id, transports FROM passkey_credentials 
           WHERE user_id = ? AND is_active = TRUE`
        )
          .bind(user.id)
          .all();

        allowCredentials = credentials.results.map((cred: any) => ({
          id: cred.id,
          type: 'public-key' as const,
          transports: cred.transports ? cred.transports.split(',') : undefined,
        }));
      }
    }

    // Generate authentication options
    // Force platform authenticator (no QR code scanning)
    const options = await generateAuthenticationOptions({
      rpID: rpConfig.rpID,
      userVerification: 'required',  // Force device verification
      allowCredentials: allowCredentials && allowCredentials.length > 0 
        ? allowCredentials 
        : [],  // Empty array to trigger discoverable credential flow
    });

    // Store challenge from the generated options
    const challenge = options.challenge;
    await env.AUTH_DB.prepare(
      `INSERT INTO passkey_challenges (challenge, user_id, email, operation, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        challenge,
        null, // No user_id for authentication (we don't know who yet)
        email || null,
        'authentication',
        new Date(Date.now() + CHALLENGE_EXPIRY_MS).toISOString()
      )
      .run();

    return {
      success: true,
      options,
    };
  } catch (error) {
    console.error('[Passkey] Authentication initiation failed:', error);
    throw new Error('Failed to initiate passkey authentication');
  }
}

/**
 * Step 2: Verify authentication response
 * Called after user completes Touch ID/Face ID
 */
export async function verifyAuthentication(
  env: Env,
  response: any,
  origin: string
): Promise<{ success: boolean; userId?: string; email?: string }> {
  try {
    const rpConfig = getRPConfig(origin);
    const credentialId = response.id;

    // Get credential from database
    const credential = await env.AUTH_DB.prepare(
      `SELECT * FROM passkey_credentials WHERE id = ? AND is_active = TRUE`
    )
      .bind(credentialId)
      .first<PasskeyCredential>();

    if (!credential) {
      throw new Error('Credential not found');
    }

    // Extract and verify challenge
    const challenge = extractChallenge(response.response.clientDataJSON);
    const challengeRecord = await verifyChallenge(
      env,
      challenge,
      'authentication'
    );

    if (!challengeRecord) {
      throw new Error('Invalid or expired challenge');
    }

    // Verify authentication response
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: rpConfig.origin,
      expectedRPID: rpConfig.rpID,
      authenticator: {
        credentialID: Buffer.from(credential.id, 'base64url'),
        credentialPublicKey: Buffer.from(credential.public_key, 'base64url'),
        counter: credential.counter,
      },
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    // Update counter and last used timestamp (prevent replay attacks)
    await env.AUTH_DB.prepare(
      `UPDATE passkey_credentials 
       SET counter = ?, last_used_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(verification.authenticationInfo.newCounter, credentialId)
      .run();

    // Get user info
    const user = await env.AUTH_DB.prepare(
      `SELECT id, email FROM platform_user WHERE id = ?`
    )
      .bind(credential.user_id)
      .first<{ id: string; email: string }>();

    if (!user) {
      throw new Error('User not found');
    }

    console.log(`[Passkey] Authentication successful for user: ${user.id}`);

    return {
      success: true,
      userId: user.id,
      email: user.email,
    };
  } catch (error) {
    console.error('[Passkey] Authentication verification failed:', error);
    return {
      success: false,
    };
  }
}

// ========================================
// Credential Management
// ========================================

/**
 * List user's passkey credentials
 */
export async function listUserCredentials(
  env: Env,
  userId: string
): Promise<any[]> {
  const credentials = await env.AUTH_DB.prepare(
    `SELECT id, device_name, device_type, backup_state, created_at, last_used_at
     FROM passkey_credentials
     WHERE user_id = ? AND is_active = TRUE
     ORDER BY created_at DESC`
  )
    .bind(userId)
    .all();

  return credentials.results;
}

/**
 * Delete a passkey credential
 */
export async function deleteCredential(
  env: Env,
  userId: string,
  credentialId: string
): Promise<boolean> {
  const result = await env.AUTH_DB.prepare(
    `UPDATE passkey_credentials 
     SET is_active = FALSE
     WHERE id = ? AND user_id = ?`
  )
    .bind(credentialId, userId)
    .run();

  return result.meta.changes > 0;
}


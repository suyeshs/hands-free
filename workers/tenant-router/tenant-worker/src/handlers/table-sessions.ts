/**
 * Table Sessions Handler
 * Manages secure table sessions with time-based expiry and HMAC signing
 */

import { Env } from '../types';

// Default session duration: 4 hours
const DEFAULT_SESSION_DURATION = 4 * 60 * 60 * 1000;

async function ensureSchema(env: Env): Promise<void> {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS table_sessions (' +
    'id TEXT PRIMARY KEY,' +
    'tenant_id TEXT NOT NULL,' +
    'table_id TEXT NOT NULL,' +
    'table_number INTEGER NOT NULL DEFAULT 0,' +
    'started_at TEXT NOT NULL DEFAULT "",' +
    'status TEXT NOT NULL DEFAULT "active",' +
    'session_token TEXT NOT NULL,' +
    'signature TEXT NOT NULL,' +
    'activated_at INTEGER NOT NULL,' +
    'expires_at INTEGER NOT NULL,' +
    'activated_by TEXT,' +
    'device_fingerprint TEXT,' +
    'closed_at TEXT,' +
    'closed_by TEXT' +
    ')'
  ).run();
}

/**
 * Generate cryptographic signature for table session
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  // Import key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Generate signature
  const signature = await crypto.subtle.sign('HMAC', key, messageData);

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate secure session token
 */
function generateSessionToken(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * POST /api/tables/:tenantId/:tableId/activate
 * Activate a table for ordering with time-limited session
 */
export async function activateTable(
  request: Request,
  env: Env,
  tenantId: string,
  tableId: string
): Promise<Response> {
  try {
    await ensureSchema(env);

    const body = await request.json() as {
      activatedBy: string;
      durationMs?: number;
      deviceFingerprint?: string;
    };

    const now = Date.now();
    const sessionToken = generateSessionToken();
    const expiresAt = now + (body.durationMs || DEFAULT_SESSION_DURATION);

    // Generate HMAC signature for URL validation
    const payload = `${tableId}:${sessionToken}:${expiresAt}`;
    const signature = await generateSignature(payload, env.TABLE_SESSION_SECRET || 'default-secret-change-me');

    // Check if table already has an active session
    const existing = await env.DB.prepare(
      `SELECT id, status FROM table_sessions
       WHERE table_id = ? AND tenant_id = ? AND status = 'active' AND expires_at > ?`
    )
      .bind(tableId, tenantId, now)
      .first();

    if (existing) {
      // Close existing session
      await env.DB.prepare(
        `UPDATE table_sessions
         SET status = 'closed', closed_at = ?, closed_by = ?
         WHERE id = ?`
      )
        .bind(new Date(now).toISOString(), body.activatedBy, existing.id)
        .run();
    }

    // Create new session — use INSERT OR REPLACE to handle legacy UNIQUE constraint on (table_id, tenant_id)
    const sessionId = crypto.randomUUID();
    const nowIso = new Date(now).toISOString();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO table_sessions (
        id, tenant_id, table_id, table_number, started_at, status,
        session_token, signature, activated_at, expires_at, activated_by, device_fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        sessionId,
        tenantId,
        tableId,
        0,        // table_number placeholder (schema requires NOT NULL)
        nowIso,   // started_at placeholder (schema requires NOT NULL)
        'active',
        sessionToken,
        signature,
        now,
        expiresAt,
        body.activatedBy,
        body.deviceFingerprint || null
      )
      .run();

    // Update floor_tables status
    await env.DB.prepare(
      `UPDATE floor_tables SET status = 'occupied' WHERE id = ?`
    )
      .bind(tableId)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: sessionId,
          tableId,
          sessionToken,
          signature,
          expiresAt,
          qrUrl: `https://${tenantId}.handsfree.tech/table/${tableId}?token=${sessionToken}&expires=${expiresAt}&sig=${signature}`,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Activation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to activate table', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/tables/:tenantId/:tableId/validate
 * Validate table session token and signature
 */
export async function validateTableSession(
  request: Request,
  env: Env,
  tenantId: string,
  tableId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      sessionToken: string;
      expires: number;
      signature: string;
      deviceFingerprint?: string;
    };

    const now = Date.now();

    // Check if session is expired
    if (body.expires < now) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session expired' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const payload = `${tableId}:${body.sessionToken}:${body.expires}`;
    const expectedSignature = await generateSignature(
      payload,
      env.TABLE_SESSION_SECRET || 'default-secret-change-me'
    );

    if (body.signature !== expectedSignature) {
      console.error('[Table Sessions] Invalid signature', {
        expected: expectedSignature,
        received: body.signature,
      });
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid signature' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Lookup session in database
    const session = await env.DB.prepare(
      `SELECT * FROM table_sessions
       WHERE table_id = ? AND tenant_id = ? AND session_token = ? AND status = 'active'`
    )
      .bind(tableId, tenantId, body.sessionToken)
      .first();

    if (!session) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session not found or inactive' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check device fingerprint if enabled
    if (session.device_fingerprint && body.deviceFingerprint) {
      if (session.device_fingerprint !== body.deviceFingerprint) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Device mismatch' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        valid: true,
        session: {
          id: session.id,
          tableId: session.table_id,
          activatedAt: session.activated_at,
          expiresAt: session.expires_at,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Validation error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Validation failed', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /tables/:tableId/session
 * Returns the current active session for a table (for POS to load modal state on open).
 */
export async function getTableSession(
  request: Request,
  env: Env,
  tenantId: string,
  tableId: string
): Promise<Response> {
  try {
    const now = Date.now();
    const session = await env.DB.prepare(
      `SELECT id, session_token, signature, expires_at FROM table_sessions
       WHERE table_id = ? AND tenant_id = ? AND status = 'active' AND expires_at > ?`
    )
      .bind(tableId, tenantId, now)
      .first();

    if (!session) {
      return new Response(
        JSON.stringify({ active: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        active: true,
        session: {
          id: session.id,
          sessionToken: session.session_token,
          signature: session.signature,
          expiresAt: session.expires_at,
          qrUrl: `https://${tenantId}.handsfree.tech/table/${tableId}?token=${session.session_token}&expires=${session.expires_at}&sig=${session.signature}`,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Get session error:', error);
    return new Response(
      JSON.stringify({ active: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /tables/:tableId/check-session
 * Lightweight token check — verifies session is still active in DB.
 * Used server-side before accepting QR orders (no HMAC needed, token already verified on page load).
 */
export async function checkSession(
  request: Request,
  env: Env,
  tenantId: string,
  tableId: string
): Promise<Response> {
  try {
    const body = await request.json() as { sessionToken: string };
    const now = Date.now();

    const session = await env.DB.prepare(
      `SELECT id FROM table_sessions
       WHERE table_id = ? AND tenant_id = ? AND session_token = ? AND status = 'active' AND expires_at > ?`
    )
      .bind(tableId, tenantId, body.sessionToken, now)
      .first();

    if (!session) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Session not found, expired, or table deactivated' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Check session error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/tables/:tenantId/:tableId/deactivate
 * Deactivate/close table session
 */
export async function deactivateTable(
  request: Request,
  env: Env,
  tenantId: string,
  tableId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      closedBy: string;
    };

    const now = Date.now();

    // Close active session
    await env.DB.prepare(
      `UPDATE table_sessions
       SET status = 'closed', closed_at = ?, closed_by = ?
       WHERE table_id = ? AND tenant_id = ? AND status = 'active'`
    )
      .bind(new Date(now).toISOString(), body.closedBy, tableId, tenantId)
      .run();

    // Update floor_tables status
    await env.DB.prepare(
      `UPDATE floor_tables SET status = 'available' WHERE id = ?`
    )
      .bind(tableId)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Table deactivated' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Deactivation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to deactivate table', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/tables/:tenantId/active-sessions
 * Get all active table sessions for tenant
 */
export async function getActiveSessions(
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const now = Date.now();

    const sessions = await env.DB.prepare(
      `SELECT
        ts.id, ts.table_id, ts.session_token, ts.activated_at,
        ts.expires_at, ts.activated_by,
        ft.table_number, ft.capacity, fs.name as section_name
       FROM table_sessions ts
       JOIN floor_tables ft ON ts.table_id = ft.id
       LEFT JOIN floor_sections fs ON ft.section_id = fs.id
       WHERE ts.tenant_id = ? AND ts.status = 'active' AND ts.expires_at > ?
       ORDER BY ft.table_number`
    )
      .bind(tenantId, now)
      .all();

    return new Response(
      JSON.stringify({ success: true, sessions: sessions.results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Get active sessions error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get active sessions', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/tables/:tenantId/cleanup-expired
 * Cleanup expired sessions (cron job)
 */
export async function cleanupExpiredSessions(
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const now = Date.now();

    // Get expired sessions
    const expiredSessions = await env.DB.prepare(
      `SELECT id, table_id FROM table_sessions
       WHERE tenant_id = ? AND status = 'active' AND expires_at <= ?`
    )
      .bind(tenantId, now)
      .all();

    if (expiredSessions.results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, cleaned: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark sessions as closed
    await env.DB.prepare(
      `UPDATE table_sessions
       SET status = 'closed', closed_at = ?
       WHERE tenant_id = ? AND status = 'active' AND expires_at <= ?`
    )
      .bind(now, tenantId, now)
      .run();

    // Update table statuses
    const tableIds = expiredSessions.results.map((s: any) => s.table_id);
    for (const tableId of tableIds) {
      await env.DB.prepare(
        `UPDATE floor_tables SET status = 'available' WHERE id = ?`
      )
        .bind(tableId)
        .run();
    }

    return new Response(
      JSON.stringify({ success: true, cleaned: expiredSessions.results.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Table Sessions] Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to cleanup sessions', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

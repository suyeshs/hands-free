/**
 * Restaurant Settings Handler
 * Manages restaurant settings storage in D1
 */

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Ensure restaurant_settings table exists
 */
async function ensureSettingsTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      tenant_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

/**
 * GET /settings - Get restaurant settings
 */
export async function handleGetSettings(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureSettingsTable(env);

    const result = await env.DB.prepare(
      `SELECT settings_json, updated_at FROM restaurant_settings WHERE tenant_id = ?`
    )
      .bind(tenantId)
      .first<{ settings_json: string; updated_at: string }>();

    if (!result) {
      return Response.json(
        { success: false, error: 'Settings not found' },
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const settings = JSON.parse(result.settings_json);

    return Response.json(
      {
        success: true,
        settings,
        updatedAt: result.updated_at,
      },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Get settings error:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to get settings',
        message: error.message,
      },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /settings - Save restaurant settings
 */
export async function handleSaveSettings(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureSettingsTable(env);

    const body = (await request.json()) as { settings: any };
    const settingsJson = JSON.stringify(body.settings);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO restaurant_settings (tenant_id, settings_json, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         settings_json = excluded.settings_json,
         updated_at = excluded.updated_at`
    )
      .bind(tenantId, settingsJson, now, now)
      .run();

    console.log(`[TenantWorker] Saved settings for tenant: ${tenantId}`);

    return Response.json(
      {
        success: true,
        message: 'Settings saved',
        updatedAt: now,
      },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Save settings error:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to save settings',
        message: error.message,
      },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Config Handler
 * Manages various configuration storage in D1 (printer config, aggregator settings)
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
 * Ensure config table exists
 */
async function ensureConfigTable(env: Env): Promise<void> {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS tenant_config (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      config_type TEXT NOT NULL,
      config_data TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await env.DB.exec(`CREATE INDEX IF NOT EXISTS idx_config_tenant ON tenant_config(tenant_id)`);
  await env.DB.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_config_type ON tenant_config(tenant_id, config_type)`);
}

/**
 * GET /printer-config - Get printer configuration
 */
export async function handleGetPrinterConfig(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureConfigTable(env);

    const result = await env.DB.prepare(
      `SELECT config_data FROM tenant_config WHERE tenant_id = ? AND config_type = ?`
    )
      .bind(tenantId, 'printer')
      .first<{ config_data: string }>();

    if (!result) {
      return Response.json(
        { success: false, error: 'Printer config not found' },
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const config = JSON.parse(result.config_data);

    return Response.json(
      { success: true, config },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Get printer config error:', error);
    return Response.json(
      { success: false, error: 'Failed to get printer config', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /printer-config - Save printer configuration
 */
export async function handleSavePrinterConfig(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureConfigTable(env);

    const body = (await request.json()) as { config: any };
    const now = new Date().toISOString();
    const configData = JSON.stringify(body.config);
    const id = `printer-${tenantId}`;

    await env.DB.prepare(
      `INSERT OR REPLACE INTO tenant_config (id, tenant_id, config_type, config_data, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, tenantId, 'printer', configData, now)
      .run();

    console.log(`[TenantWorker] Saved printer config for tenant ${tenantId}`);

    return Response.json(
      { success: true, message: 'Printer config saved', savedAt: now },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Save printer config error:', error);
    return Response.json(
      { success: false, error: 'Failed to save printer config', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /aggregator-settings - Get aggregator settings (auto-accept rules)
 */
export async function handleGetAggregatorSettings(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureConfigTable(env);

    const result = await env.DB.prepare(
      `SELECT config_data FROM tenant_config WHERE tenant_id = ? AND config_type = ?`
    )
      .bind(tenantId, 'aggregator')
      .first<{ config_data: string }>();

    if (!result) {
      return Response.json(
        { success: false, error: 'Aggregator settings not found' },
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const settings = JSON.parse(result.config_data);

    return Response.json(
      { success: true, settings },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Get aggregator settings error:', error);
    return Response.json(
      { success: false, error: 'Failed to get aggregator settings', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PUT /aggregator-settings - Save aggregator settings
 */
export async function handleSaveAggregatorSettings(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    await ensureConfigTable(env);

    const body = (await request.json()) as { settings: any };
    const now = new Date().toISOString();
    const configData = JSON.stringify(body.settings);
    const id = `aggregator-${tenantId}`;

    await env.DB.prepare(
      `INSERT OR REPLACE INTO tenant_config (id, tenant_id, config_type, config_data, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, tenantId, 'aggregator', configData, now)
      .run();

    console.log(`[TenantWorker] Saved aggregator settings for tenant ${tenantId}`);

    return Response.json(
      { success: true, message: 'Aggregator settings saved', savedAt: now },
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TenantWorker] Save aggregator settings error:', error);
    return Response.json(
      { success: false, error: 'Failed to save aggregator settings', message: error.message },
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}

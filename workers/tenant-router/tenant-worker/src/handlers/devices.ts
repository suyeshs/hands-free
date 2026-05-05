/**
 * Device Management Handler
 * Manages POS devices connected to tenants
 */

interface Env {
  DB: D1Database;
  TENANTS_DB?: D1Database; // Central database for device registry
  TENANT_METADATA?: any; // KV namespace
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
};

/**
 * GET /devices - List all devices for tenant
 */
export async function handleListDevices(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Device tracking not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    const result = await env.TENANTS_DB.prepare(`
      SELECT
        id, device_id, device_name, hardware_info, status,
        registered_at, last_seen_at, last_heartbeat_at, last_ip_address
      FROM pos_devices
      WHERE tenant_id = ?
      ORDER BY last_seen_at DESC NULLS LAST, registered_at DESC
    `).bind(tenantId).all();

    const devices = result.results.map((row: any) => ({
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      hardwareInfo: row.hardware_info ? JSON.parse(row.hardware_info) : null,
      status: row.status,
      registeredAt: row.registered_at,
      lastSeenAt: row.last_seen_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      lastIpAddress: row.last_ip_address,
    }));

    return Response.json({
      success: true,
      devices,
      totalDevices: devices.length,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Devices] List error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to list devices'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * POST /devices/heartbeat - Update device heartbeat
 */
export async function handleDeviceHeartbeat(
  request: Request,
  env: Env,
  tenantId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      deviceId: string;
      metadata?: any;
    };

    const { deviceId, metadata } = body;

    if (!deviceId) {
      return Response.json({
        success: false,
        error: 'deviceId is required'
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Device tracking not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Get client IP
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

    // Update device in central DB
    const dbResult = await env.TENANTS_DB.prepare(`
      UPDATE pos_devices
      SET last_heartbeat_at = datetime('now'),
          last_seen_at = datetime('now'),
          last_ip_address = ?,
          metadata = ?
      WHERE tenant_id = ? AND device_id = ?
    `).bind(clientIp, JSON.stringify(metadata || {}), tenantId, deviceId).run();

    if (dbResult.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Device not found or not registered'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Update KV cache
    if (env.TENANT_METADATA) {
      await env.TENANT_METADATA.put(`device:${deviceId}:last_seen`, new Date().toISOString(), { expirationTtl: 86400 });
    }

    // Optional: Log heartbeat
    if (metadata) {
      await env.TENANTS_DB.prepare(`
        INSERT INTO device_heartbeats (device_id, tenant_id, heartbeat_at, ip_address, metadata)
        VALUES (?, ?, datetime('now'), ?, ?)
      `).bind(deviceId, tenantId, clientIp, JSON.stringify(metadata)).run();
    }

    return Response.json({
      success: true,
      message: 'Heartbeat updated',
      timestamp: new Date().toISOString(),
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Devices] Heartbeat error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to update heartbeat'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PATCH /devices/:deviceId/suspend - Suspend a device
 */
export async function handleSuspendDevice(
  request: Request,
  env: Env,
  tenantId: string,
  deviceId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      reason?: string;
      suspendedBy?: string;
    };

    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Device tracking not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Update device status
    const result = await env.TENANTS_DB.prepare(`
      UPDATE pos_devices
      SET status = 'suspended',
          suspended_at = datetime('now'),
          suspended_by = ?,
          suspended_reason = ?
      WHERE tenant_id = ? AND device_id = ?
    `).bind(body.suspendedBy || 'admin', body.reason || 'Manual suspension', tenantId, deviceId).run();

    if (result.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Device not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Update KV cache
    if (env.TENANT_METADATA) {
      await env.TENANT_METADATA.put(`device:${deviceId}:status`, 'suspended');
    }

    console.log(`[Devices] Suspended device ${deviceId} for tenant ${tenantId}`);

    return Response.json({
      success: true,
      message: 'Device suspended successfully',
      deviceId,
      reason: body.reason,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Devices] Suspend error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to suspend device'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PATCH /devices/:deviceId/revoke - Revoke a device permanently
 */
export async function handleRevokeDevice(
  request: Request,
  env: Env,
  tenantId: string,
  deviceId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      revokedBy?: string;
    };

    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Device tracking not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Update device status (irreversible)
    const result = await env.TENANTS_DB.prepare(`
      UPDATE pos_devices
      SET status = 'revoked',
          revoked_at = datetime('now'),
          revoked_by = ?
      WHERE tenant_id = ? AND device_id = ?
    `).bind(body.revokedBy || 'admin', tenantId, deviceId).run();

    if (result.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Device not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    // Update KV cache
    if (env.TENANT_METADATA) {
      await env.TENANT_METADATA.put(`device:${deviceId}:status`, 'revoked');
      // Remove from tenant device list
      const devicesKey = `tenant:${tenantId}:devices`;
      const devices = await env.TENANT_METADATA.get(devicesKey, 'json') || [];
      const updatedDevices = devices.filter((d: string) => d !== deviceId);
      await env.TENANT_METADATA.put(devicesKey, JSON.stringify(updatedDevices));
    }

    console.log(`[Devices] Revoked device ${deviceId} for tenant ${tenantId}`);

    return Response.json({
      success: true,
      message: 'Device revoked permanently',
      deviceId,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Devices] Revoke error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to revoke device'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PATCH /devices/:deviceId/name - Update device name
 */
export async function handleUpdateDeviceName(
  request: Request,
  env: Env,
  tenantId: string,
  deviceId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      deviceName: string;
    };

    if (!body.deviceName) {
      return Response.json({
        success: false,
        error: 'deviceName is required'
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Device tracking not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Update device name
    const result = await env.TENANTS_DB.prepare(`
      UPDATE pos_devices
      SET device_name = ?
      WHERE tenant_id = ? AND device_id = ?
    `).bind(body.deviceName, tenantId, deviceId).run();

    if (result.meta.changes === 0) {
      return Response.json({
        success: false,
        error: 'Device not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    return Response.json({
      success: true,
      message: 'Device name updated',
      deviceId,
      deviceName: body.deviceName,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Devices] Update name error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to update device name'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * PATCH /devices/:deviceId/reactivate - Reactivate a suspended device
 */
export async function handleReactivateDevice(
  request: Request,
  env: Env,
  tenantId: string,
  deviceId: string
): Promise<Response> {
  try {
    if (!env.TENANTS_DB) {
      return Response.json({
        success: false,
        error: 'Device tracking not configured'
      }, { status: 503, headers: CORS_HEADERS });
    }

    // Check current status
    const device = await env.TENANTS_DB.prepare(`
      SELECT status FROM pos_devices WHERE tenant_id = ? AND device_id = ?
    `).bind(tenantId, deviceId).first();

    if (!device) {
      return Response.json({
        success: false,
        error: 'Device not found'
      }, { status: 404, headers: CORS_HEADERS });
    }

    if (device.status === 'revoked') {
      return Response.json({
        success: false,
        error: 'Cannot reactivate revoked device'
      }, { status: 403, headers: CORS_HEADERS });
    }

    // Reactivate device
    await env.TENANTS_DB.prepare(`
      UPDATE pos_devices
      SET status = 'active',
          suspended_at = NULL,
          suspended_by = NULL,
          suspended_reason = NULL
      WHERE tenant_id = ? AND device_id = ?
    `).bind(tenantId, deviceId).run();

    // Update KV cache
    if (env.TENANT_METADATA) {
      await env.TENANT_METADATA.put(`device:${deviceId}:status`, 'active');
    }

    console.log(`[Devices] Reactivated device ${deviceId} for tenant ${tenantId}`);

    return Response.json({
      success: true,
      message: 'Device reactivated',
      deviceId,
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('[Devices] Reactivate error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to reactivate device'
    }, { status: 500, headers: CORS_HEADERS });
  }
}

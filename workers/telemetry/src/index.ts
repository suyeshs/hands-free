/**
 * Telemetry Worker
 * Receives telemetry events from the POS app
 * Stores in R2 with tenant mapping and sends notifications for critical errors
 */

interface Env {
  TELEMETRY_LOGS: R2Bucket;
  ENVIRONMENT: string;
  // Optional: Add notification services
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISCORD_WEBHOOK_URL?: string;
  SLACK_WEBHOOK_URL?: string;
}

interface TelemetryEvent {
  type: 'error' | 'warning' | 'info' | 'provision_flow';
  timestamp: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
  userAgent?: string;
  platform?: string;
  appVersion?: string;
  sessionId?: string;
  tenantId?: string;
}

interface TelemetryBatch {
  events: TelemetryEvent[];
  sessionId: string;
  tenantId?: string; // Tenant mapping
  installationId?: string; // Unique installation identifier
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // POST /api/telemetry - Receive telemetry events
      if (url.pathname === '/api/telemetry' && request.method === 'POST') {
        const batch: TelemetryBatch = await request.json();

        console.log(`[Telemetry] Received ${batch.events.length} events from session ${batch.sessionId}`, {
          tenantId: batch.tenantId || 'unknown',
          installationId: batch.installationId || 'unknown',
        });

        // Store in R2
        await storeTelemetryBatch(env, batch);

        // Send notifications for critical events
        const criticalEvents = batch.events.filter(
          (e) => e.type === 'error' || (e.type === 'provision_flow' && e.message.includes('failed'))
        );

        if (criticalEvents.length > 0) {
          await sendNotifications(env, batch, criticalEvents);
        }

        return new Response(
          JSON.stringify({ success: true, received: batch.events.length }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // GET /api/telemetry/session/:sessionId - Retrieve session logs
      if (url.pathname.startsWith('/api/telemetry/session/') && request.method === 'GET') {
        const sessionId = url.pathname.split('/').pop();
        if (!sessionId) {
          return new Response('Session ID required', { status: 400, headers: corsHeaders });
        }

        const logs = await getSessionLogs(env, sessionId);
        return new Response(JSON.stringify(logs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/telemetry/tenant/:tenantId - Get logs for a specific tenant
      if (url.pathname.startsWith('/api/telemetry/tenant/') && request.method === 'GET') {
        const tenantId = url.pathname.split('/').pop();
        if (!tenantId) {
          return new Response('Tenant ID required', { status: 400, headers: corsHeaders });
        }

        const limit = parseInt(url.searchParams.get('limit') || '50');
        const logs = await getTenantLogs(env, tenantId, limit);
        return new Response(JSON.stringify(logs), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/telemetry/recent - Get recent errors
      if (url.pathname === '/api/telemetry/recent' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const recentErrors = await getRecentErrors(env, limit);
        return new Response(JSON.stringify(recentErrors), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // GET /api/telemetry/dashboard - Get summary dashboard data
      if (url.pathname === '/api/telemetry/dashboard' && request.method === 'GET') {
        const dashboard = await getDashboardData(env);
        return new Response(JSON.stringify(dashboard), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Dashboard UI
      if (url.pathname === '/' || url.pathname === '/dashboard') {
        return new Response(getDashboardHTML(), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', environment: env.ENVIRONMENT }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('[Telemetry] Error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

/**
 * Store telemetry batch in R2
 */
async function storeTelemetryBatch(env: Env, batch: TelemetryBatch): Promise<void> {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0]; // YYYY-MM-DD
  const hour = timestamp.split('T')[1].split(':')[0]; // HH

  // Store by date/hour/session for easy querying
  const key = `logs/${date}/${hour}/${batch.sessionId}-${Date.now()}.json`;

  await env.TELEMETRY_LOGS.put(key, JSON.stringify(batch, null, 2), {
    httpMetadata: {
      contentType: 'application/json',
    },
    customMetadata: {
      sessionId: batch.sessionId,
      tenantId: batch.tenantId || 'unknown',
      installationId: batch.installationId || 'unknown',
      eventCount: batch.events.length.toString(),
      hasErrors: batch.events.some((e) => e.type === 'error').toString(),
      timestamp,
    },
  });

  console.log(`[Telemetry] Stored batch at ${key}`);

  // Also store index for quick lookup
  await updateSessionIndex(env, batch.sessionId, key);

  // Store tenant index if tenant ID is present
  if (batch.tenantId) {
    await updateTenantIndex(env, batch.tenantId, key);
  }
}

/**
 * Update session index for quick lookup
 */
async function updateSessionIndex(
  env: Env,
  sessionId: string,
  logKey: string
): Promise<void> {
  const indexKey = `index/sessions/${sessionId}.json`;

  // Get existing index
  let index: string[] = [];
  const existing = await env.TELEMETRY_LOGS.get(indexKey);
  if (existing) {
    index = JSON.parse(await existing.text());
  }

  // Add new log key
  index.push(logKey);

  // Save updated index
  await env.TELEMETRY_LOGS.put(indexKey, JSON.stringify(index, null, 2));
}

/**
 * Update tenant index for quick lookup by tenant
 */
async function updateTenantIndex(
  env: Env,
  tenantId: string,
  logKey: string
): Promise<void> {
  const indexKey = `index/tenants/${tenantId}.json`;

  // Get existing index
  let index: string[] = [];
  const existing = await env.TELEMETRY_LOGS.get(indexKey);
  if (existing) {
    index = JSON.parse(await existing.text());
  }

  // Add new log key
  index.push(logKey);

  // Save updated index (keep last 100 entries per tenant)
  const trimmedIndex = index.slice(-100);
  await env.TELEMETRY_LOGS.put(indexKey, JSON.stringify(trimmedIndex, null, 2));
}

/**
 * Get all logs for a session
 */
async function getSessionLogs(env: Env, sessionId: string): Promise<TelemetryEvent[]> {
  const indexKey = `index/sessions/${sessionId}.json`;
  const index = await env.TELEMETRY_LOGS.get(indexKey);

  if (!index) {
    return [];
  }

  const logKeys: string[] = JSON.parse(await index.text());
  const allEvents: TelemetryEvent[] = [];

  // Fetch all log files for this session
  for (const key of logKeys) {
    const log = await env.TELEMETRY_LOGS.get(key);
    if (log) {
      const batch: TelemetryBatch = JSON.parse(await log.text());
      allEvents.push(...batch.events);
    }
  }

  return allEvents;
}

/**
 * Get logs for a specific tenant
 */
async function getTenantLogs(env: Env, tenantId: string, limit: number): Promise<any[]> {
  const indexKey = `index/tenants/${tenantId}.json`;
  const index = await env.TELEMETRY_LOGS.get(indexKey);

  if (!index) {
    return [];
  }

  const logKeys: string[] = JSON.parse(await index.text());
  const logs: any[] = [];

  // Fetch log files (most recent first)
  for (const key of logKeys.reverse().slice(0, limit)) {
    const log = await env.TELEMETRY_LOGS.get(key);
    if (log) {
      const batch: TelemetryBatch = JSON.parse(await log.text());
      logs.push({
        sessionId: batch.sessionId,
        tenantId: batch.tenantId,
        installationId: batch.installationId,
        events: batch.events,
        logKey: key,
      });
    }
  }

  return logs;
}

/**
 * Get recent error events
 */
async function getRecentErrors(env: Env, limit: number): Promise<any[]> {
  const errors: any[] = [];
  const today = new Date().toISOString().split('T')[0];

  // List recent log files
  const listed = await env.TELEMETRY_LOGS.list({
    prefix: `logs/${today}/`,
    limit: 100,
  });

  // Process each file
  for (const object of listed.objects) {
    if (errors.length >= limit) break;

    const log = await env.TELEMETRY_LOGS.get(object.key);
    if (log) {
      const batch: TelemetryBatch = JSON.parse(await log.text());
      const batchErrors = batch.events
        .filter((e) => e.type === 'error')
        .map((e) => ({
          ...e,
          sessionId: batch.sessionId,
          tenantId: batch.tenantId,
          installationId: batch.installationId,
          logKey: object.key,
        }));

      errors.push(...batchErrors);
    }
  }

  return errors.slice(0, limit);
}

/**
 * Get dashboard summary data
 */
async function getDashboardData(env: Env): Promise<any> {
  const today = new Date().toISOString().split('T')[0];
  const errors: any[] = [];
  const tenantMap = new Map<string, number>();
  const sessionMap = new Map<string, number>();

  // List today's log files
  const listed = await env.TELEMETRY_LOGS.list({
    prefix: `logs/${today}/`,
    limit: 1000,
  });

  // Process each file
  for (const object of listed.objects) {
    const log = await env.TELEMETRY_LOGS.get(object.key);
    if (log) {
      const batch: TelemetryBatch = JSON.parse(await log.text());

      // Count by tenant
      const tenantId = batch.tenantId || 'unknown';
      tenantMap.set(tenantId, (tenantMap.get(tenantId) || 0) + batch.events.length);

      // Count by session
      sessionMap.set(batch.sessionId, (sessionMap.get(batch.sessionId) || 0) + batch.events.length);

      // Collect errors
      const batchErrors = batch.events
        .filter((e) => e.type === 'error')
        .map((e) => ({
          ...e,
          sessionId: batch.sessionId,
          tenantId: batch.tenantId,
          installationId: batch.installationId,
        }));

      errors.push(...batchErrors);
    }
  }

  return {
    date: today,
    totalFiles: listed.objects.length,
    totalErrors: errors.length,
    totalSessions: sessionMap.size,
    totalTenants: tenantMap.size,
    errorsByTenant: Object.fromEntries(
      Array.from(tenantMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    ),
    recentErrors: errors.slice(0, 20),
  };
}

/**
 * Send notifications for critical events
 */
async function sendNotifications(
  env: Env,
  batch: TelemetryBatch,
  events: TelemetryEvent[]
): Promise<void> {
  const message = formatNotificationMessage(batch, events);

  // Send to configured notification services
  const promises: Promise<any>[] = [];

  // Telegram
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    promises.push(sendTelegramNotification(env, message));
  }

  // Discord
  if (env.DISCORD_WEBHOOK_URL) {
    promises.push(sendDiscordNotification(env, message));
  }

  // Slack
  if (env.SLACK_WEBHOOK_URL) {
    promises.push(sendSlackNotification(env, message));
  }

  // Wait for all notifications
  await Promise.allSettled(promises);
}

/**
 * Format notification message
 */
function formatNotificationMessage(batch: TelemetryBatch, events: TelemetryEvent[]): string {
  const errorCount = events.filter((e) => e.type === 'error').length;
  const provisionErrors = events.filter((e) => e.type === 'provision_flow').length;

  let message = '🚨 *Critical Event Alert*\n\n';
  message += `Tenant: \`${batch.tenantId || 'unknown'}\`\n`;
  message += `Installation: \`${batch.installationId || 'unknown'}\`\n`;
  message += `Session: \`${batch.sessionId}\`\n`;
  message += `Errors: ${errorCount}\n`;
  message += `Provisioning Issues: ${provisionErrors}\n\n`;

  // Add first few events
  events.slice(0, 3).forEach((event, i) => {
    message += `${i + 1}. **${event.type.toUpperCase()}**: ${event.message}\n`;
    if (event.context) {
      message += `   Context: ${JSON.stringify(event.context).substring(0, 100)}\n`;
    }
  });

  if (events.length > 3) {
    message += `\n... and ${events.length - 3} more events`;
  }

  return message;
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(env: Env, message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    }),
  });
}

/**
 * Send Discord notification
 */
async function sendDiscordNotification(env: Env, message: string): Promise<void> {
  await fetch(env.DISCORD_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: message,
    }),
  });
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(env: Env, message: string): Promise<void> {
  await fetch(env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message,
    }),
  });
}

/**
 * Get dashboard HTML
 */
function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telemetry Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 {
            color: white;
            margin-bottom: 30px;
            text-align: center;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-label {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .stat-value {
            color: #667eea;
            font-size: 36px;
            font-weight: bold;
        }
        .controls {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
        }
        .controls label { font-weight: 600; color: #333; }
        .controls input, .controls button, .controls select {
            padding: 12px 20px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.2s;
        }
        .controls input:focus, .controls select:focus {
            outline: none;
            border-color: #667eea;
        }
        .controls button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            cursor: pointer;
            border: none;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .controls button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .tenant-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .tenant-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            cursor: pointer;
            border: 2px solid transparent;
            transition: all 0.2s;
        }
        .tenant-item:hover {
            border-color: #667eea;
            transform: translateY(-2px);
        }
        .tenant-item.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        }
        .tenant-name { font-weight: bold; margin-bottom: 5px; }
        .tenant-count { font-size: 14px; color: #666; }
        .events {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .event {
            padding: 25px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        .event:hover { background: #f9f9f9; }
        .event:last-child { border-bottom: none; }
        .event-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .event-type {
            font-weight: bold;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .event-type.error { background: #fee; color: #c00; }
        .event-type.warning { background: #ffc; color: #880; }
        .event-type.info { background: #eef; color: #008; }
        .event-type.provision_flow { background: #efe; color: #080; }
        .event-time {
            color: #999;
            font-size: 13px;
            font-family: monospace;
        }
        .event-message {
            font-size: 16px;
            margin-bottom: 15px;
            color: #333;
            font-weight: 500;
        }
        .event-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 15px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            font-size: 13px;
        }
        .event-meta-item { color: #666; }
        .event-meta-item strong { color: #333; font-weight: 600; }
        .event-stack, .event-context {
            margin-top: 15px;
            padding: 15px;
            background: #f5f5f5;
            border-left: 4px solid #667eea;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .event-stack { border-left-color: #c00; }
        .loading {
            text-align: center;
            padding: 60px;
            color: #999;
            font-size: 18px;
        }
        .error-message {
            background: linear-gradient(135deg, #fee 0%, #fdd 100%);
            color: #c00;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #c00;
        }
        .refresh-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px 20px;
            border-radius: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 12px;
            color: #667eea;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Telemetry Dashboard</h1>

        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-label">Total Errors</div>
                <div class="stat-value" id="totalErrors">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Sessions</div>
                <div class="stat-value" id="totalSessions">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Tenants</div>
                <div class="stat-value" id="totalTenants">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Log Files</div>
                <div class="stat-value" id="totalFiles">-</div>
            </div>
        </div>

        <div class="controls">
            <label>View:</label>
            <select id="viewType">
                <option value="recent">Recent Errors</option>
                <option value="dashboard">Dashboard</option>
                <option value="session">By Session ID</option>
                <option value="tenant">By Tenant ID</option>
            </select>

            <input type="text" id="searchInput" placeholder="Enter Session ID or Tenant ID" style="display:none; flex: 1; max-width: 300px;">
            <input type="number" id="limitInput" placeholder="Limit" value="50" style="width: 100px;">

            <button onclick="loadData()">🔍 Load</button>
            <button onclick="autoRefresh()" id="refreshBtn">🔄 Auto Refresh (30s)</button>
            <button onclick="clearAutoRefresh()">⏸️ Stop</button>
        </div>

        <div id="errorMessage"></div>
        <div class="tenant-list" id="tenantList" style="display: none;"></div>
        <div class="events" id="events">
            <div class="loading">Select a view and click Load to start</div>
        </div>
        <div id="refreshIndicator" class="refresh-indicator" style="display: none;">Auto-refreshing...</div>
    </div>

    <script>
        const ENDPOINT = window.location.origin;
        let refreshInterval = null;

        document.getElementById('viewType').addEventListener('change', function() {
            const searchInput = document.getElementById('searchInput');
            const value = this.value;
            if (value === 'session' || value === 'tenant') {
                searchInput.style.display = 'block';
                searchInput.placeholder = value === 'session' ? 'Enter Session ID' : 'Enter Tenant ID';
            } else {
                searchInput.style.display = 'none';
            }
        });

        async function loadData() {
            const viewType = document.getElementById('viewType').value;
            const searchInput = document.getElementById('searchInput').value;
            const limit = document.getElementById('limitInput').value;
            const eventsDiv = document.getElementById('events');
            const errorDiv = document.getElementById('errorMessage');
            const tenantListDiv = document.getElementById('tenantList');

            errorDiv.innerHTML = '';
            eventsDiv.innerHTML = '<div class="loading">Loading...</div>';
            tenantListDiv.style.display = 'none';

            try {
                let url = '';
                if (viewType === 'recent') {
                    url = \`\${ENDPOINT}/api/telemetry/recent?limit=\${limit}\`;
                } else if (viewType === 'dashboard') {
                    url = \`\${ENDPOINT}/api/telemetry/dashboard\`;
                } else if (viewType === 'session' && searchInput) {
                    url = \`\${ENDPOINT}/api/telemetry/session/\${searchInput}\`;
                } else if (viewType === 'tenant' && searchInput) {
                    url = \`\${ENDPOINT}/api/telemetry/tenant/\${searchInput}?limit=\${limit}\`;
                } else {
                    errorDiv.innerHTML = '<div class="error-message">Please enter a Session ID or Tenant ID</div>';
                    eventsDiv.innerHTML = '';
                    return;
                }

                const response = await fetch(url);
                if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                const data = await response.json();

                if (viewType === 'dashboard') {
                    displayDashboard(data);
                } else if (viewType === 'tenant') {
                    displayTenantLogs(data);
                } else {
                    displayEvents(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('Error loading data:', error);
                errorDiv.innerHTML = \`<div class="error-message">❌ Error: \${error.message}</div>\`;
                eventsDiv.innerHTML = '';
            }
        }

        function displayDashboard(data) {
            document.getElementById('totalErrors').textContent = data.totalErrors || 0;
            document.getElementById('totalSessions').textContent = data.totalSessions || 0;
            document.getElementById('totalTenants').textContent = data.totalTenants || 0;
            document.getElementById('totalFiles').textContent = data.totalFiles || 0;

            const tenantListDiv = document.getElementById('tenantList');
            if (data.errorsByTenant && Object.keys(data.errorsByTenant).length > 0) {
                tenantListDiv.style.display = 'grid';
                tenantListDiv.innerHTML = Object.entries(data.errorsByTenant)
                    .map(([tenantId, count]) => \`
                        <div class="tenant-item" onclick="filterByTenant('\${tenantId}')">
                            <div class="tenant-name">🏢 \${tenantId}</div>
                            <div class="tenant-count">\${count} events</div>
                        </div>
                    \`).join('');
            }
            displayEvents(data.recentErrors || []);
        }

        function displayTenantLogs(logs) {
            const events = [];
            logs.forEach(log => {
                log.events.forEach(event => {
                    events.push({ ...event, sessionId: log.sessionId, tenantId: log.tenantId, installationId: log.installationId });
                });
            });
            displayEvents(events);
        }

        function displayEvents(events) {
            const eventsDiv = document.getElementById('events');
            if (!events || events.length === 0) {
                eventsDiv.innerHTML = '<div class="loading">No events found</div>';
                return;
            }

            eventsDiv.innerHTML = events.map(event => \`
                <div class="event">
                    <div class="event-header">
                        <span class="event-type \${event.type}">\${event.type}</span>
                        <span class="event-time">\${new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="event-message">\${escapeHtml(event.message)}</div>
                    <div class="event-meta">
                        \${event.sessionId ? \`<div class="event-meta-item"><strong>Session:</strong> \${event.sessionId}</div>\` : ''}
                        \${event.tenantId ? \`<div class="event-meta-item"><strong>🏢 Tenant:</strong> \${event.tenantId}</div>\` : ''}
                        \${event.installationId ? \`<div class="event-meta-item"><strong>💻 Installation:</strong> \${event.installationId}</div>\` : ''}
                        \${event.platform ? \`<div class="event-meta-item"><strong>Platform:</strong> \${event.platform}</div>\` : ''}
                        \${event.appVersion ? \`<div class="event-meta-item"><strong>Version:</strong> \${event.appVersion}</div>\` : ''}
                    </div>
                    \${event.context ? \`<div class="event-context">\${escapeHtml(JSON.stringify(event.context, null, 2))}</div>\` : ''}
                    \${event.stack ? \`<div class="event-stack">\${escapeHtml(event.stack)}</div>\` : ''}
                </div>
            \`).join('');
        }

        function filterByTenant(tenantId) {
            document.getElementById('viewType').value = 'tenant';
            document.getElementById('searchInput').value = tenantId;
            document.getElementById('searchInput').style.display = 'block';
            loadData();
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function autoRefresh() {
            clearAutoRefresh();
            document.getElementById('refreshIndicator').style.display = 'block';
            refreshInterval = setInterval(() => loadData(), 30000);
            loadData();
        }

        function clearAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
                document.getElementById('refreshIndicator').style.display = 'none';
            }
        }

        // Load dashboard on page load
        document.getElementById('viewType').value = 'dashboard';
        loadData();
    </script>
</body>
</html>`;
}

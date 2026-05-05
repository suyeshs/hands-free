# Telemetry Worker

Receives error and event telemetry from the POS app, stores logs in R2 with tenant mapping, and sends notifications for critical issues.

## Features

- 📊 Collects errors, warnings, and provisioning flow events
- 💾 Stores logs in R2 bucket organized by date/hour/session
- 🏢 Maps events to tenants and installations for easy tracking
- 🔔 Sends notifications to Telegram, Discord, or Slack for critical errors
- 🔍 Query logs by session ID, tenant ID, or get recent errors
- 📈 Automatic indexing for fast lookup
- 📊 Dashboard view with tenant breakdown

## Setup

### 1. Install Dependencies

```bash
cd workers/telemetry
bun install
```

### 2. Create R2 Bucket

```bash
# Create the R2 bucket
wrangler r2 bucket create handsfree-telemetry-logs

# Optional: Create lifecycle policy to auto-delete old logs (e.g., after 30 days)
```

### 3. Configure Notifications (Optional)

Add secrets for your notification service(s):

#### Telegram
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

To get these:
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get the bot token
3. Start a chat with your bot
4. Get your chat ID from `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`

#### Discord
```bash
wrangler secret put DISCORD_WEBHOOK_URL
```

To get this:
1. Go to your Discord server settings → Integrations → Webhooks
2. Create a new webhook
3. Copy the webhook URL

#### Slack
```bash
wrangler secret put SLACK_WEBHOOK_URL
```

To get this:
1. Create a Slack app at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add a webhook to your workspace
4. Copy the webhook URL

### 4. Deploy

```bash
cd workers/telemetry
wrangler deploy
```

### 5. Update Frontend

Set the telemetry endpoint in your `.env`:

```bash
VITE_TELEMETRY_ENDPOINT=https://handsfree-telemetry.YOUR_SUBDOMAIN.workers.dev
```

## API Endpoints

### POST /api/telemetry

Submit telemetry events.

**Request:**
```json
{
  "sessionId": "1234567890-abc",
  "tenantId": "my-restaurant",
  "installationId": "install-1234567890-xyz",
  "events": [
    {
      "type": "error",
      "timestamp": "2024-01-01T12:00:00Z",
      "message": "Failed to save tenant config",
      "stack": "Error: ...",
      "context": {
        "step": "provisioning",
        "tenantId": "my-restaurant"
      },
      "userAgent": "Mozilla/5.0...",
      "platform": "MacIntel",
      "appVersion": "v1.0.0"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "received": 1
}
```

### GET /api/telemetry/session/:sessionId

Get all logs for a specific session.

**Response:**
```json
[
  {
    "type": "provision_flow",
    "timestamp": "2024-01-01T12:00:00Z",
    "message": "Provisioning: provisioning_completed",
    "context": {
      "tenantId": "my-restaurant",
      "hasActivationCode": true
    }
  }
]
```

### GET /api/telemetry/tenant/:tenantId?limit=50

Get logs for a specific tenant.

**Response:**
```json
[
  {
    "sessionId": "session-123",
    "tenantId": "my-restaurant",
    "installationId": "install-456",
    "events": [...],
    "logKey": "logs/2024-01-01/12/..."
  }
]
```

### GET /api/telemetry/recent?limit=50

Get recent error events.

**Response:**
```json
[
  {
    "type": "error",
    "timestamp": "2024-01-01T12:00:00Z",
    "message": "Activation failed",
    "sessionId": "1234567890-abc",
    "tenantId": "my-restaurant",
    "installationId": "install-456",
    "logKey": "logs/2024-01-01/12/1234567890-abc-1234567890.json"
  }
]
```

### GET /api/telemetry/dashboard

Get summary dashboard data.

**Response:**
```json
{
  "date": "2024-01-01",
  "totalFiles": 42,
  "totalErrors": 15,
  "totalSessions": 8,
  "totalTenants": 5,
  "errorsByTenant": {
    "tenant1": 10,
    "tenant2": 5
  },
  "recentErrors": [...]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "environment": "production"
}
```

## Viewing Telemetry

### Dashboard (Web UI)

Open `dashboard.html` in a browser and configure the endpoint URL at the top of the file.

Features:
- View recent errors
- Filter by tenant or session
- Auto-refresh every 30 seconds
- See tenant breakdown
- View error details with stack traces

### Command Line

```bash
# Get recent errors
curl https://handsfree-telemetry.YOUR_SUBDOMAIN.workers.dev/api/telemetry/recent?limit=10

# Get logs for specific session
curl https://handsfree-telemetry.YOUR_SUBDOMAIN.workers.dev/api/telemetry/session/SESSION_ID

# Get logs for specific tenant
curl https://handsfree-telemetry.YOUR_SUBDOMAIN.workers.dev/api/telemetry/tenant/TENANT_ID?limit=50

# Get dashboard summary
curl https://handsfree-telemetry.YOUR_SUBDOMAIN.workers.dev/api/telemetry/dashboard
```

## Telemetry in Frontend

The frontend automatically captures:

- **Unhandled errors and promise rejections**
- **Provisioning flow events** (form submission, API calls, activation)
- **Manual error captures** with context
- **Tenant and installation mapping** for tracking issues

### Automatic Tracking

The telemetry service automatically:
- Generates a unique installation ID (stored in localStorage)
- Captures the tenant ID from the tenant store
- Includes installation and tenant info in all events

### Usage Example

```typescript
import { captureError, captureProvisioningEvent } from '../lib/telemetry';

// Capture an error with context
try {
  await someOperation();
} catch (error) {
  captureError(error, {
    operation: 'save_config',
    tenantId: 'my-restaurant',
  });
  throw error;
}

// Track provisioning steps
captureProvisioningEvent('tenant_created', {
  tenantId: 'my-restaurant',
  hasDatabase: true,
});
```

## R2 Storage Structure

```
logs/
  2024-01-15/
    12/
      session1-1705324800.json
      session2-1705324900.json
    13/
      session3-1705328400.json

index/
  sessions/
    session1.json  # List of log file keys for session1
    session2.json
  tenants/
    tenant1.json   # List of log file keys for tenant1 (last 100)
    tenant2.json
```

## Notifications

Critical events trigger notifications:
- **Errors** (type: 'error')
- **Provisioning failures** (type: 'provision_flow' with 'failed' in message)

Notification format:
```
🚨 Critical Event Alert

Tenant: `my-restaurant`
Installation: `install-1234567890-xyz`
Session: session-123-abc
Errors: 2
Provisioning Issues: 1

1. ERROR: Failed to save tenant config
   Context: {"step":"save_tenant_config","tenantId":"my-restaurant"}

2. PROVISION_FLOW: Provisioning: activation_failed
   Context: {"error":"Invalid activation code"}
```

## Development

```bash
# Run locally
wrangler dev

# Test endpoint
curl -X POST http://localhost:8787/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"test",
    "tenantId":"test-tenant",
    "installationId":"test-install",
    "events":[{
      "type":"error",
      "timestamp":"2024-01-01T12:00:00Z",
      "message":"Test error"
    }]
  }'
```

## Monitoring by Tenant

View all issues for a specific tenant:

```bash
# API
curl https://handsfree-telemetry.YOUR_SUBDOMAIN.workers.dev/api/telemetry/tenant/TENANT_ID?limit=100

# Dashboard
# Select "By Tenant ID" and enter the tenant ID
```

This is especially useful when users report issues - you can quickly see all errors for their installation.

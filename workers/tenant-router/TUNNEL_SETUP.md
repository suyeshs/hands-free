# Named Tunnel Setup Guide

This document explains how to configure Cloudflare Named Tunnels for persistent restaurant URLs in the Handsfree POS system.

## Overview

Each restaurant gets a permanent subdomain URL for online ordering:
- Format: `{restaurant-slug}.menu.handsfree.com`
- Example: `mahesh-dhaba.menu.handsfree.com`

The system uses Cloudflare Named Tunnels to securely expose the local POS ordering server to the internet.

## Architecture

1. **Provisioning (Cloud)**:
   - Tenant worker creates tunnel via Cloudflare API during restaurant setup
   - Stores credentials in `tenant_config` table (both cloud D1 and local SQLite)

2. **Runtime (POS App)**:
   - Tauri app retrieves credentials from local SQLite
   - Starts `cloudflared` process with stored credentials
   - Tunnel connects `localhost:3000` → `{slug}.menu.handsfree.com`

## Required Environment Variables

Add these variables to your tenant worker's wrangler configuration:

### Cloudflare Account Credentials

```jsonc
{
  "vars": {
    // Your Cloudflare account ID (found in dashboard URL)
    "CLOUDFLARE_ACCOUNT_ID": "your-account-id-here",

    // Zone ID for handsfree.com domain (found in DNS settings)
    "CLOUDFLARE_ZONE_ID": "your-zone-id-here"
  }
}
```

### API Token (Secret)

Create a Cloudflare API token with the following permissions:
- **Account** → Cloudflare Tunnel: Edit
- **Zone** → DNS: Edit
- **Zone** → Zone: Read

Store as a secret using `wrangler secret put`:

```bash
cd workers/tenant-router/tenant-worker
wrangler secret put CLOUDFLARE_API_TOKEN
# Paste your API token when prompted
```

## Cloudflare API Token Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Profile → API Tokens
2. Click "Create Token"
3. Use "Create Custom Token"
4. Set token name: `Handsfree Tunnel Manager`
5. Configure permissions:
   - **Account**:
     - Cloudflare Tunnel: Edit
   - **Zone**:
     - DNS: Edit
     - Zone: Read
6. Set account/zone resources:
   - Account: Your account
   - Zone: handsfree.com
7. Click "Continue to summary" → "Create Token"
8. Copy the token and store it using `wrangler secret put`

## Finding Your IDs

### Account ID
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select any domain
3. Look at the URL: `dash.cloudflare.com/{account-id}/...`
4. Or find it in the right sidebar under "Account ID"

### Zone ID
1. Go to your domain (handsfree.com)
2. Click "Overview" in the left sidebar
3. Scroll down to "API" section
4. Copy the "Zone ID"

## Database Schema

The `tenant_config` table stores tunnel information:

```sql
CREATE TABLE tenant_config (
  tenant_id TEXT PRIMARY KEY,
  tunnel_id TEXT,              -- Cloudflare tunnel UUID
  tunnel_name TEXT,            -- Restaurant slug
  tunnel_url TEXT,             -- Full URL (https://slug.menu.handsfree.com)
  tunnel_credentials TEXT,     -- Base64-encoded JSON credentials
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Tunnel Credentials Format

Credentials are stored as a JSON object and base64-encoded:

```json
{
  "AccountTag": "your-account-id",
  "TunnelSecret": "base64-secret",
  "TunnelID": "tunnel-uuid"
}
```

## API Endpoints

### Provision Tunnel
```
POST /api/provision-tunnel
Headers: X-Tenant-ID: {tenantId}
Body: { "restaurantSlug": "mahesh-dhaba" }

Response:
{
  "success": true,
  "tunnelId": "abc-def-123",
  "tunnelName": "mahesh-dhaba",
  "url": "https://mahesh-dhaba.menu.handsfree.com",
  "credentials": "{...}"  // JSON string
}
```

### Get Tunnel Status
```
GET /api/tunnel-status
Headers: X-Tenant-ID: {tenantId}

Response:
{
  "provisioned": true,
  "tunnelId": "abc-def-123",
  "tunnelName": "mahesh-dhaba",
  "url": "https://mahesh-dhaba.menu.handsfree.com"
}
```

### Delete Tunnel
```
DELETE /api/tunnel
Headers: X-Tenant-ID: {tenantId}

Response:
{
  "success": true,
  "message": "Tunnel deleted successfully"
}
```

## Setup Wizard Integration

The tunnel provisioning screen appears after "Restaurant Basics" in the setup wizard:

1. **Restaurant Basics** → User enters restaurant name
2. **Tunnel Provisioning** → Auto-generates slug from name
3. User can customize slug (lowercase, alphanumeric, hyphens only)
4. Click "Create My URL" to provision tunnel
5. Credentials stored in local SQLite
6. Continue with rest of setup

## Starting the Tunnel (POS App)

The Tauri app provides commands to manage tunnels:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Start named tunnel with stored credentials
await invoke('start_named_tunnel', {
  tunnelName: 'mahesh-dhaba',
  credentialsJson: credentialsString,
  tunnelUrl: 'https://mahesh-dhaba.menu.handsfree.com'
});

// Get current tunnel URL
const url = await invoke('get_tunnel_url');

// Stop tunnel
await invoke('stop_cloudflare_tunnel');

// Check if running
const isRunning = await invoke('is_tunnel_running');
```

## Fallback to Quick Tunnels

If named tunnel provisioning fails or is not configured, the app falls back to Quick Tunnels:

```typescript
// Start Quick Tunnel (random URL, no auth needed)
await invoke('start_cloudflare_tunnel');
```

Quick Tunnels provide temporary URLs like `https://random-name.trycloudflare.com`.

## Security Considerations

1. **Credentials Storage**: Tunnel credentials are stored in local SQLite, not in code
2. **API Token Permissions**: Use minimal required permissions (no account-wide access)
3. **Secret Management**: Never commit API tokens to version control
4. **Slug Validation**: Slugs are validated to prevent injection attacks

## Troubleshooting

### "Failed to provision tunnel"
- Check that API token has correct permissions
- Verify account ID and zone ID are correct
- Ensure domain is active in Cloudflare

### "Tunnel already exists for this slug"
- Choose a different restaurant slug
- Or delete the existing tunnel first

### "Cannot start named tunnel"
- Verify credentials are stored in `tenant_config` table
- Check that `cloudflared` binary exists in resources
- Ensure tunnel ID is valid in Cloudflare dashboard

### "Tunnel URL not reachable"
- Check that local ordering server is running on port 3000
- Verify DNS CNAME record points to `{tunnel-id}.cfargotunnel.com`
- Allow 1-2 minutes for DNS propagation

## Monitoring

Check tunnel status in Cloudflare Dashboard:
1. Go to Zero Trust → Access → Tunnels
2. Find your tunnel by name (restaurant slug)
3. View connection status and traffic stats

## References

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare API Docs](https://developers.cloudflare.com/api/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)

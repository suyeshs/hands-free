# Token Manager Service

Centralized secret/token management for all Handsfree platform workers.

## Features

- 🔐 **Encrypted Storage** - All tokens encrypted at rest using AES-256-GCM
- 🔄 **Automatic Rotation** - Configurable token rotation with zero downtime
- 🎯 **Access Control** - Per-worker access policies with audit logging
- 📊 **Audit Trail** - Complete audit log of all token access and changes
- ☁️ **Cloudflare Integration** - Automated creation and management of Cloudflare API tokens
- 🚀 **Zero-Config for Workers** - Workers use simple client library to fetch tokens

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Manager Service                     │
│                                                               │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │ Token Vault  │  │ Access Control │  │ Audit Logger     │ │
│  │ (Encrypted)  │  │ (Policies)     │  │ (D1)             │ │
│  └──────────────┘  └───────────────┘  └──────────────────┘ │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Cloudflare Token Manager                       │   │
│  │  - Create tokens with specific permissions            │   │
│  │  - Rotate tokens automatically                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │         Token Client Library            │
        │  (Used by all platform workers)         │
        └─────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ domain-service│   │ store-front     │   │ theme-edge      │
│               │   │                 │   │                 │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## Quick Start

### 1. Deploy Token Manager

```bash
cd workers/token-manager

# Create KV namespaces
npx wrangler kv namespace create TOKEN_VAULT
npx wrangler kv namespace create TOKEN_METADATA
npx wrangler kv namespace create ACCESS_POLICIES

# Create D1 database
npx wrangler d1 create handsfree-token-audit

# Update wrangler.jsonc with the created IDs

# Generate encryption key
openssl rand -hex 32

# Set secrets
echo "YOUR_ENCRYPTION_KEY" | npx wrangler secret put MASTER_ENCRYPTION_KEY
echo "YOUR_BOOTSTRAP_TOKEN" | npx wrangler secret put BOOTSTRAP_API_TOKEN
echo "$(openssl rand -base64 32)" | npx wrangler secret put ADMIN_API_KEY

# Deploy
npx wrangler deploy
```

### 2. Create Access Policies

```bash
# Create policy for domain-service worker
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "handsfree-domain-service",
    "allowedTokens": [
      "cloudflare:api_token",
      "cloudflare:zone_token"
    ]
  }'
```

### 3. Create Cloudflare Tokens

```bash
# Create a token with specific permissions
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/cloudflare/create-token \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "domain-service-api-token",
    "permissions": [
      "DNS Write",
      "Workers KV Storage Write",
      "D1 Write",
      "Workers R2 Storage Write"
    ],
    "scope": {
      "zoneId": "a87f103cc0e697543f91213a71bafe01",
      "accountId": "0f3287b287060e3215662501ee96292e"
    },
    "expiresIn": 365
  }'
```

### 4. Use in Workers

Install the token client library:

```bash
cd shared/token-client
npm install
npm run build
```

In your worker:

```typescript
import { createTokenClient } from '@handsfree/token-client';

const tokenClient = createTokenClient('handsfree-domain-service');

export default {
  async fetch(request: Request, env: Env) {
    // Get a token
    const cfToken = await tokenClient.getToken('cloudflare:api_token');

    // Use the token
    const response = await fetch('https://api.cloudflare.com/client/v4/...', {
      headers: {
        'Authorization': `Bearer ${cfToken.value}`
      }
    });

    return response;
  }
};
```

## API Reference

### Public API (for workers)

#### GET `/api/tokens/{tokenKey}`

Get a token by key.

**Headers:**
- `X-Worker-Name: string` - Name of the worker requesting the token

**Response:**
```json
{
  "success": true,
  "data": {
    "value": "token_value",
    "expires": "2025-12-31T00:00:00Z"
  }
}
```

### Admin API

All admin endpoints require `Authorization: Bearer {ADMIN_API_KEY}` header.

#### POST `/api/admin/tokens`

Create a new token.

**Body:**
```json
{
  "service": "cloudflare",
  "key": "api_token",
  "value": "token_value",
  "expires": "2025-12-31T00:00:00Z",
  "metadata": {
    "description": "Main Cloudflare API token"
  }
}
```

#### PUT `/api/admin/tokens/{tokenKey}`

Update an existing token.

#### DELETE `/api/admin/tokens/{tokenKey}`

Delete a token.

#### POST `/api/admin/tokens/rotate`

Rotate a token (creates new token, updates all references, deletes old token).

**Body:**
```json
{
  "tokenKey": "cloudflare:api_token"
}
```

#### GET `/api/admin/tokens`

List all tokens (metadata only, no values).

#### POST `/api/admin/policies`

Create an access policy for a worker.

**Body:**
```json
{
  "workerName": "handsfree-domain-service",
  "allowedTokens": ["cloudflare:api_token"],
  "ipWhitelist": ["192.168.1.0/24"]
}
```

#### GET `/api/admin/policies`

List all access policies.

#### POST `/api/admin/cloudflare/create-token`

Create a Cloudflare API token with specific permissions.

**Body:**
```json
{
  "name": "domain-service-token",
  "permissions": ["DNS Write", "Workers KV Storage Write"],
  "scope": {
    "zoneId": "zone_id",
    "accountId": "account_id"
  },
  "expiresIn": 365
}
```

#### GET `/api/admin/cloudflare/permissions`

Get all available Cloudflare permission groups.

#### GET `/api/admin/audit`

Get audit logs.

**Query Parameters:**
- `limit: number` - Number of logs to return (default: 100)
- `offset: number` - Offset for pagination
- `worker: string` - Filter by worker name
- `token: string` - Filter by token key

## Token Naming Convention

Tokens should follow the pattern: `{service}:{name}`

Examples:
- `cloudflare:api_token` - Main Cloudflare API token
- `cloudflare:zone_token` - Zone-specific Cloudflare token
- `google:service_account` - Google Cloud service account
- `twilio:api_key` - Twilio API key
- `stripe:api_key` - Stripe API key

## Security

### Encryption

- All tokens encrypted at rest using AES-256-GCM
- Encryption key never stored in code or KV
- Separate encryption key per environment

### Access Control

- Workers must provide `X-Worker-Name` header
- Access validated against policies before returning token
- Unauthorized access attempts logged for audit

### Audit Logging

- All token access logged with:
  - Worker name
  - Token key
  - Timestamp
  - Request IP (from CF-Connecting-IP header)
- Failed access attempts logged separately
- Weekly audit reports generated

### Token Rotation

- Automatic rotation based on configurable schedule
- Zero-downtime rotation (old token valid during grace period)
- Manual rotation available via API
- Rotation events logged in audit trail

## Monitoring

### Health Check

```bash
curl https://handsfree-token-manager.suyesh.workers.dev/api/health
```

### Metrics

The service tracks:
- Token access frequency
- Failed access attempts
- Token rotation events
- Cache hit/miss ratio

## Migration from Direct Secrets

### Step 1: Identify Current Secrets

List all secrets in your workers:

```bash
cd workers/domain-service
npx wrangler secret list
```

### Step 2: Import to Token Manager

```bash
# For each secret, create a token
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{
    "service": "cloudflare",
    "key": "api_token",
    "value": "YOUR_SECRET_VALUE"
  }'
```

### Step 3: Update Worker Code

Replace direct secret access:

```typescript
// Before
const apiToken = env.CLOUDFLARE_API_TOKEN;

// After
const apiToken = (await tokenClient.getToken('cloudflare:api_token')).value;
```

### Step 4: Deploy and Verify

```bash
npx wrangler deploy
# Test the worker
# Verify token access in audit logs
```

### Step 5: Remove Old Secrets

```bash
npx wrangler secret delete CLOUDFLARE_API_TOKEN
```

## Troubleshooting

### Token Access Denied

Check:
1. Worker name in `X-Worker-Name` header matches policy
2. Token key exists in access policy for that worker
3. Audit logs for failed access attempts

### Token Not Found

Check:
1. Token key format (`service:name`)
2. Token hasn't expired
3. Token was created successfully (check audit logs)

### Encryption Error

Check:
1. `MASTER_ENCRYPTION_KEY` is set correctly (32-byte hex)
2. Same encryption key used for storing and retrieving

## Best Practices

1. **Use specific tokens** - Create separate tokens for different services/purposes
2. **Rotate regularly** - Set up automatic rotation (every 90 days recommended)
3. **Least privilege** - Grant workers access only to tokens they need
4. **Monitor audit logs** - Review weekly audit reports
5. **Test rotation** - Test token rotation in staging before production
6. **Document usage** - Keep track of which workers use which tokens

## Development

### Project Structure

```
workers/token-manager/
├── src/
│   ├── index.ts                 # Main worker entry point
│   ├── core/
│   │   ├── token-vault.ts       # Encrypted token storage
│   │   ├── access-control.ts    # Access policy management
│   │   ├── audit-logger.ts      # Audit logging
│   │   ├── token-rotator.ts     # Token rotation logic
│   │   └── cloudflare-token-manager.ts
│   └── durable-objects/
│       └── token-rotator-do.ts  # Durable object for rotation
├── migrations/                   # D1 database migrations
├── wrangler.jsonc
├── package.json
└── README.md
```

### Local Development

```bash
npm install
npx wrangler dev
```

### Running Tests

```bash
npm test
```

## Support

For issues or questions, see the main Handsfree platform documentation or create an issue in the repository.

## License

Copyright © 2025 Handsfree Platform

# File Search Sync Worker

Cloudflare Worker that handles uploading menu data to Google Vertex AI File Search.

## Purpose

This worker acts as a proxy for File Search uploads because:
- Cloudflare Workers edge runtime can use Node.js APIs with `nodejs_compat` flag
- Can use `@google-cloud/discoveryengine` SDK
- Restaurant-client (Next.js edge) cannot use Node.js SDKs directly

## Architecture

```
Menu CRUD Operation (restaurant-client)
         ↓
  [Trigger D1→File Search sync]
         ↓
  [restaurant-client sync endpoint]
         ↓
  [Calls filesearch-sync-worker] ← This worker
         ↓
  [Uploads to Vertex AI File Search]
         ↓
  Voice Ordering Ready ✅
```

## Setup

### 1. Install Dependencies

```bash
cd /Users/stonepot-tech/stonepot-platform/handsfree-platform/workers/filesearch-sync
npm install
```

### 2. Set GCP Credentials Secret

```bash
# Get your GCP service account JSON key
# Then set it as a secret:
wrangler secret put GOOGLE_CLOUD_CREDENTIALS
# Paste the entire JSON key when prompted
```

### 3. Deploy

```bash
CLOUDFLARE_ACCOUNT_ID=0f3287b287060e3215662501ee96292e wrangler deploy
```

## API

### POST /

Upload menu to File Search.

**Request:**
```json
{
  "tenantId": "khao-piyo-7766",
  "menuText": "RESTAURANT MENU...",
  "itemCount": 719,
  "itemsWithChoices": 6
}
```

**Response:**
```json
{
  "success": true,
  "tenantId": "khao-piyo-7766",
  "dataStore": "khao-piyo-7766-menu-store",
  "stats": {
    "itemCount": 719,
    "itemsWithChoices": 6,
    "textSize": 186057
  },
  "uploadedAt": "2025-12-13T18:00:00.000Z"
}
```

## Usage

### From restaurant-client sync endpoint

```typescript
const uploadResponse = await fetch(
  'https://filesearch-sync.handsfree.tech/',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      menuText,
      itemCount: menuItems.length,
      itemsWithChoices: itemsWithChoices.length,
    }),
  }
);
```

## Environment Variables

- `GCP_PROJECT_ID` - Google Cloud project ID (sahamati-labs)
- `GCP_LOCATION` - Location for File Search (global)

## Secrets

- `GOOGLE_CLOUD_CREDENTIALS` - GCP service account JSON key

## Monitoring

```bash
# View logs
wrangler tail filesearch-sync-worker

# Check deployment status
wrangler deployments list
```

## Testing

```bash
# Test locally
wrangler dev

# Then make a request
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "khao-piyo-7766",
    "menuText": "MENU...",
    "itemCount": 719,
    "itemsWithChoices": 6
  }'
```

# Recipe AI Worker - Token Manager Integration

The recipe-ai worker now fetches API keys from the centralized token-manager service instead of storing them directly.

## ✅ Deployment Status

**Worker:** https://recipe-ai.suyesh.workers.dev (LIVE)
**Token Manager:** https://handsfree-token-manager.suyesh.workers.dev

## 🔑 Required Tokens in Token Manager

The recipe-ai worker needs two tokens to be added to the token-manager:

### 1. Gemini API Key
- **Token Key:** `gemini:api_key`
- **Description:** Google AI API key for Gemini 1.5 Flash recipe generation
- **Get from:** https://aistudio.google.com/app/apikey (select "handsfree-restaurant" project)

### 2. Cloudflare API Token
- **Token Key:** `cloudflare:api_token`
- **Description:** Cloudflare API token for D1 database access
- **Reuse:** Same token used by handsfree-orders worker

## 📝 Setup Steps

### Step 1: Get Admin API Key

The token-manager requires an admin API key for authentication. Get it from:

```bash
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/token-manager
wrangler secret list
# Look for ADMIN_API_KEY
```

### Step 2: Create Access Policy for Recipe-AI Worker

```bash
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "recipe-ai",
    "allowedTokens": [
      "gemini:api_key",
      "cloudflare:api_token"
    ]
  }'
```

### Step 3: Add Gemini API Key

Get your Gemini API key:
1. Visit: https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Select "handsfree-restaurant" project
4. Copy the generated key

Add to token-manager:

```bash
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "gemini",
    "key": "api_key",
    "value": "YOUR_GEMINI_API_KEY_HERE",
    "metadata": {
      "description": "Gemini 1.5 Flash API key for recipe generation",
      "project": "handsfree-restaurant"
    }
  }'
```

### Step 4: Add Cloudflare API Token

```bash
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "cloudflare",
    "key": "api_token",
    "value": "YOUR_CLOUDFLARE_API_TOKEN_HERE",
    "metadata": {
      "description": "Cloudflare API token for D1 database access",
      "permissions": ["D1 Read", "Workers KV Storage Read"]
    }
  }'
```

## ✅ Verify Setup

### 1. Check Token Manager Health

```bash
curl https://handsfree-token-manager.suyesh.workers.dev/health
```

### 2. Verify Tokens Are Accessible

```bash
# Test gemini:api_key
curl https://handsfree-token-manager.suyesh.workers.dev/api/tokens/gemini:api_key \
  -H "X-Worker-Name: recipe-ai"

# Test cloudflare:api_token
curl https://handsfree-token-manager.suyesh.workers.dev/api/tokens/cloudflare:api_token \
  -H "X-Worker-Name: recipe-ai"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "value": "your_token_value",
    "expires": "2025-12-31T00:00:00Z"
  }
}
```

### 3. Test Recipe AI Worker

```bash
curl -X POST https://recipe-ai.suyesh.workers.dev/api/recipes/test-tenant/generate \
  -H "Content-Type: application/json" \
  -d '{
    "menu_items": [
      {
        "id": "item-1",
        "name": "Paneer Tikka",
        "description": "Grilled cottage cheese with spices"
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "recipes": [...],
  "metadata": {
    "model": "gemini-1.5-flash",
    "processing_time_ms": 3200
  }
}
```

## 🔍 Troubleshooting

### Error: "Failed to fetch token gemini:api_key"

**Causes:**
1. Token not added to token-manager
2. Access policy not created for recipe-ai worker
3. Token-manager service is down

**Solution:**
```bash
# Check if token exists
curl -X GET https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens/gemini:api_key \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"

# Check access policy
curl -X GET https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies/recipe-ai \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### Error: "Failed to fetch token cloudflare:api_token"

Same troubleshooting steps as above, but for `cloudflare:api_token`.

### Recipe AI Worker Returns 500

**Check logs:**
```bash
cd /Users/stonepot-tech/projects/restaurant-pos-ai/workers/recipe-ai
npm run tail
```

## 🔐 Security Benefits

Using token-manager provides:

1. **Centralized Management**: All tokens in one place
2. **Encrypted Storage**: Tokens encrypted at rest with AES-256-GCM
3. **Access Control**: Per-worker access policies
4. **Audit Trail**: Complete audit log in D1 database
5. **Automatic Rotation**: Configurable token rotation
6. **Zero Downtime**: Token rotation with no service interruption

## 📚 Additional Resources

- [Token Manager README](/Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/token-manager/README.md)
- [Recipe AI Worker README](./README.md)
- [Recipe System Documentation](../AI_RECIPE_SYSTEM_COMPLETE.md)

## 🎯 Summary

**Architecture:**
```
Recipe AI Worker
    ↓
Token Manager Service (fetches tokens)
    ↓
Encrypted Token Vault (KV Storage)
```

**No secrets stored directly** in recipe-ai worker - all tokens fetched securely from token-manager!

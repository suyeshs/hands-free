# Recipe AI Worker - Quick Start (Token Manager Integration)

## ✅ Deployment Status

**Worker is LIVE:** https://recipe-ai.suyesh.workers.dev
**Token Manager:** https://handsfree-token-manager.suyesh.workers.dev

```bash
curl https://recipe-ai.suyesh.workers.dev/health
# {"status":"ok","service":"recipe-ai","version":"1.0.0",...}
```

## 🔑 Token Management Architecture

The recipe-ai worker now uses **centralized token management** via the token-manager service:

```
Recipe AI Worker
    ↓ (fetches tokens)
Token Manager Service
    ↓ (encrypted storage)
KV Storage (AES-256-GCM)
```

**No secrets are stored directly** in the recipe-ai worker!

## 📋 Setup Checklist

- [ ] Token manager is deployed
- [ ] Access policy created for recipe-ai worker
- [ ] Gemini API key added to token-manager
- [ ] Cloudflare API token added to token-manager
- [ ] Tokens verified accessible

## 🚀 Setup Steps

### 1. Add Tokens to Token Manager

See detailed guide: [TOKEN_MANAGER_SETUP.md](./TOKEN_MANAGER_SETUP.md)

**Quick setup:**

```bash
# Get admin API key (from token-manager secrets)
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/token-manager
wrangler secret list

# Create access policy
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workerName": "recipe-ai",
    "allowedTokens": ["gemini:api_key", "cloudflare:api_token"]
  }'

# Add Gemini API key (get from https://aistudio.google.com/app/apikey)
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "gemini",
    "key": "api_key",
    "value": "YOUR_GEMINI_API_KEY"
  }'

# Add Cloudflare API token
curl -X POST https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "cloudflare",
    "key": "api_token",
    "value": "YOUR_CLOUDFLARE_TOKEN"
  }'
```

### 2. Verify Tokens

```bash
# Test token access
curl https://handsfree-token-manager.suyesh.workers.dev/api/tokens/gemini:api_key \
  -H "X-Worker-Name: recipe-ai"

# Should return:
# {"success":true,"data":{"value":"...","expires":"..."}}
```

### 3. Test Recipe Generation

```bash
curl -X POST https://recipe-ai.suyesh.workers.dev/api/recipes/test-tenant/generate \
  -H "Content-Type: application/json" \
  -d '{
    "menu_items": [
      {
        "id": "item-1",
        "name": "Paneer Tikka"
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
    "cost_usd": 0.001
  }
}
```

## 📱 Use in POS App

Once tokens are configured:

1. Open POS → Inventory Dashboard
2. Click **"Recipe Management"** tab
3. Select menu items
4. Click **"Generate AI Recipes"**
5. Review and save

## 📊 Configuration

| Setting | Value |
|---------|-------|
| Project | handsfree-restaurant |
| Worker URL | https://recipe-ai.suyesh.workers.dev |
| Token Manager | https://handsfree-token-manager.suyesh.workers.dev |
| Frontend Config | VITE_RECIPE_AI_WORKER_URL (in .env) |

## 🔍 Monitoring

```bash
# View recipe-ai worker logs
cd /Users/stonepot-tech/projects/restaurant-pos-ai/workers/recipe-ai
npm run tail

# Check token-manager audit logs
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/token-manager
npm run tail
```

## 🐛 Troubleshooting

### Error: "Failed to fetch token"

**Check:**
1. Token exists in token-manager
2. Access policy created for recipe-ai
3. Token-manager service is healthy

**Solution:**
```bash
# Verify token exists
curl https://handsfree-token-manager.suyesh.workers.dev/api/admin/tokens/gemini:api_key \
  -H "Authorization: Bearer ADMIN_API_KEY"

# Check access policy
curl https://handsfree-token-manager.suyesh.workers.dev/api/admin/policies/recipe-ai \
  -H "Authorization: Bearer ADMIN_API_KEY"
```

### Error: "No D1 database found"

**Cause:** Tenant hasn't been provisioned
**Solution:** Ensure tenant has D1 database via handsfree-orders worker

### Error: Rate limited (429)

**Cause:** Gemini free tier limit (15 RPM)
**Solution:** Wait 1 minute or upgrade to paid tier

## 💰 Cost

- **Free Tier:** 15 RPM, 1500 requests/day
- **Cost:** ~$0.001 per 10 menu items
- **Monthly:** <$1 for typical usage

## 🔐 Security Benefits

Using token-manager provides:

- ✅ **Encrypted storage** (AES-256-GCM)
- ✅ **Access control** (per-worker policies)
- ✅ **Audit logging** (complete trail in D1)
- ✅ **Automatic rotation** (configurable intervals)
- ✅ **Zero downtime** (rotation with no interruption)

## 📚 Documentation

- [Token Manager Setup](./TOKEN_MANAGER_SETUP.md) - Detailed setup guide
- [API Documentation](./README.md) - Worker API reference
- [Complete System](../AI_RECIPE_SYSTEM_COMPLETE.md) - Full system overview

---

**Next Step:** Follow [TOKEN_MANAGER_SETUP.md](./TOKEN_MANAGER_SETUP.md) to add tokens to the token-manager! 🚀

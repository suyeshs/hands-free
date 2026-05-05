# Recipe AI Worker - Deployment Guide

## Prerequisites

1. **Cloudflare Account**: You need access to Cloudflare Workers
2. **Wrangler CLI**: Install with `npm install -g wrangler`
3. **Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. **Cloudflare API Token**: For D1 database access (same as handsfree-orders worker)

## Step-by-Step Deployment

### 1. Install Dependencies

```bash
cd workers/recipe-ai
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

### 3. Set Up Secrets

#### A. Gemini API Key

```bash
wrangler secret put GEMINI_API_KEY
```

When prompted, paste your Gemini API key from Google AI Studio.

**To get your Gemini API Key:**
1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Select your Google Cloud project (or create one)
4. Copy the generated key

#### B. Cloudflare API Token

```bash
wrangler secret put CLOUDFLARE_API_TOKEN
```

Use the same token as the handsfree-orders worker.

**To create a Cloudflare API Token:**
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Add permissions:
   - D1: Edit
   - Workers KV Storage: Edit
5. Copy the token

### 4. Verify Configuration

Check `wrangler.jsonc` to ensure:

```jsonc
{
  "name": "recipe-ai",
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "0f3287b287060e3215662501ee96292e"
  },
  "kv_namespaces": [
    {
      "binding": "TENANT_METADATA",
      "id": "15fc93ae3a074ad7868caef4234edd71"
    }
  ]
}
```

### 5. Deploy to Production

```bash
npm run deploy
```

Output should show:
```
✨ Built successfully
✨ Uploaded recipe-ai
✨ Published recipe-ai (X.XX sec)
   https://recipe-ai.suyesh.workers.dev
```

### 6. Verify Deployment

Test the health endpoint:

```bash
curl https://recipe-ai.suyesh.workers.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "recipe-ai",
  "version": "1.0.0",
  "timestamp": "2026-01-29T...",
  "endpoints": [
    "POST /api/recipes/:tenantId/generate"
  ]
}
```

### 7. Update Frontend Configuration

Add to your `.env` file:

```env
VITE_RECIPE_AI_WORKER_URL=https://recipe-ai.suyesh.workers.dev
```

## Testing

### Test with Sample Menu Items

```bash
curl -X POST https://recipe-ai.suyesh.workers.dev/api/recipes/test-tenant/generate \
  -H "Content-Type: application/json" \
  -d '{
    "menu_items": [
      {
        "id": "item-1",
        "name": "Butter Chicken",
        "description": "Creamy tomato curry with tender chicken",
        "category": "Main Course"
      }
    ],
    "options": {
      "cuisineType": "Indian",
      "minConfidence": 0.7
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "recipes": [
    {
      "menu_item_id": "item-1",
      "menu_item_name": "Butter Chicken",
      "confidence": 0.95,
      "ingredients": [...]
    }
  ],
  "metadata": {
    "model": "gemini-1.5-flash",
    "processing_time_ms": 3200,
    "cost_usd": 0.001
  }
}
```

## Monitoring

### View Real-Time Logs

```bash
npm run tail
```

### Check Worker Status

```bash
wrangler deployments list
```

### View Metrics

Go to: Cloudflare Dashboard → Workers & Pages → recipe-ai → Metrics

## Troubleshooting

### Error: "Gemini API key not configured"

**Solution:** Set the secret:
```bash
wrangler secret put GEMINI_API_KEY
```

### Error: "No D1 database found for tenant"

**Cause:** The tenant hasn't been provisioned with a D1 database yet.

**Solution:**
1. Ensure the tenant has a D1 database via handsfree-orders worker
2. Or use a test tenant that has been provisioned

### Error: "Failed to parse AI response"

**Cause:** Gemini returned non-JSON or invalid JSON.

**Solution:**
1. Check the logs: `npm run tail`
2. The worker will retry 3 times automatically
3. If persistent, check Gemini API status

### Error: Rate limited (429)

**Cause:** Too many requests to Gemini API.

**Solution:**
- Gemini 1.5 Flash free tier: 15 RPM (requests per minute)
- Upgrade to paid tier for higher limits
- Implement request batching in frontend

## Cost Management

### Free Tier Limits

**Gemini 1.5 Flash (Free):**
- 15 requests per minute
- 1 million tokens per minute
- 1500 requests per day

**Cloudflare Workers (Free):**
- 100,000 requests per day
- 10ms CPU time per request

### Estimated Costs (Paid Tier)

**Per 10 Menu Items:**
- Input: ~6,300 tokens × $0.075/1M = $0.00047
- Output: ~2,000 tokens × $0.30/1M = $0.00060
- **Total: ~$0.001**

**Monthly (100 restaurants, 50 items each, 2x generation):**
- 100 × 50 ÷ 10 × 2 = 1,000 requests
- 1,000 × $0.001 = **$1.00/month**

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use wrangler secrets** for API keys (not environment variables)
3. **Rotate API keys** periodically
4. **Monitor usage** to detect abuse
5. **Set up alerts** for unexpected cost spikes

## Updating the Worker

### 1. Make Code Changes

Edit files in `src/` directory.

### 2. Test Locally

```bash
npm run dev
```

Access at: http://localhost:8787

### 3. Deploy Updates

```bash
npm run deploy
```

### 4. Verify Changes

```bash
curl https://recipe-ai.suyesh.workers.dev/health
```

## Rollback

If deployment fails or causes issues:

```bash
wrangler rollback
```

This reverts to the previous deployment.

## Support

For issues or questions:
- Check logs: `npm run tail`
- View worker metrics in Cloudflare Dashboard
- Report issues: https://github.com/anthropics/claude-code/issues

## Next Steps

1. **Test with real menu items** from your restaurant
2. **Monitor API costs** via Google Cloud Console
3. **Tune prompts** based on recipe quality
4. **Add more cuisines** to improve accuracy
5. **Implement caching** for frequently requested items

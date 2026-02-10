# Setting Secrets for Tenant Router Worker

The tenant router worker needs Cloudflare API credentials for D1 provisioning.

## Required Secrets

1. **CLOUDFLARE_API_TOKEN** - API token with D1 database permissions

## Set the Secret

```bash
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/tenant-router

# Set the API token (you'll be prompted to paste the value)
wrangler secret put CLOUDFLARE_API_TOKEN
```

When prompted, paste your Cloudflare API token that has these permissions:
- Account > D1 > Edit
- Account > Workers KV Storage > Edit

## Getting the Token

### Option 1: Use Existing Token (Recommended)

If you've already set up the `restaurant-provisioning` worker, you can use the same token:

1. Get the token from your secure storage/password manager
2. Run: `wrangler secret put CLOUDFLARE_API_TOKEN`
3. Paste the same token value

### Option 2: Create a New Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Add permissions:
   - Account > D1 > Edit
   - Account > Workers KV Storage > Edit
5. Copy the generated token
6. Run: `wrangler secret put CLOUDFLARE_API_TOKEN`
7. Paste the token when prompted

## Verify Secrets

```bash
wrangler secret list
```

You should see:
```
[
  {
    "name": "CLOUDFLARE_API_TOKEN",
    "type": "secret_text"
  }
]
```

## Test the Endpoint

After setting the secret, test the provision endpoint:

```bash
curl -X POST "https://handsfree-tenant-router.suyesh.workers.dev/api/provision/test-7492" \
  -H "Content-Type: application/json" \
  -d '{
    "databaseName": "test-7492_db",
    "schema": [
      "CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, name TEXT, price REAL)"
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "output": "Created 1 tables",
  "databaseId": "<uuid>",
  "tables_created": 1
}
```

## Note

The `CLOUDFLARE_ACCOUNT_ID` is already set as an environment variable in `wrangler.toml`, so you only need to set the `CLOUDFLARE_API_TOKEN` secret.

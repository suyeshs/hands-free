# Setting Secrets for Restaurant Provisioning Worker

The worker needs Cloudflare API tokens to provision infrastructure (D1, KV, R2).

## Required Secrets

### 1. CLOUDFLARE_API_TOKEN or CLOUDFLARE_STORAGE_TOKEN

Set one of these secrets with a Cloudflare API token that has permissions for:
- D1 database creation
- KV namespace creation
- R2 bucket creation

## Option 1: Copy from existing worker

If you already have tokens set in the `domain-service` worker:

```bash
# Get the current token from domain-service (if set)
npx wrangler secret list --name handsfree-domain-service

# Set the same token in restaurant-provisioning
# (You'll need to manually copy the value)
```

## Option 2: Set a new token

```bash
# Set the token (you'll be prompted to paste the value)
npx wrangler secret put CLOUDFLARE_API_TOKEN --name handsfree-restaurant-provisioning

# OR use the storage token name
npx wrangler secret put CLOUDFLARE_STORAGE_TOKEN --name handsfree-restaurant-provisioning
```

## Getting a Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Add permissions for:
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit
   - Account > D1 > Edit
5. Copy the generated token
6. Paste it when running the `wrangler secret put` command above

## Verify Secrets

After setting the secret:

```bash
# List secrets (won't show values, just names)
npx wrangler secret list --name handsfree-restaurant-provisioning
```

## Test the Worker

After setting secrets, test provisioning:

```bash
curl -X POST https://handsfree-restaurant-provisioning.suyesh.workers.dev/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-'$(date +%s)'",
    "companyName": "Test Restaurant",
    "email": "test@example.com",
    "phone": "+1234567890",
    "city": "Test City",
    "pincode": "123456",
    "businessCategory": "RESTAURANT"
  }'
```

If successful, you'll get a response with an activation code!

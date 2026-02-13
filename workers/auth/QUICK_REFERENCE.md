# Quick Reference - Stonepot OAuth

## Common Commands

### Deployment
```bash
# Deploy to production
npm run deploy

# Check deployment status
wrangler deployments list

# View live worker
open https://stonepot-oauth.suyesh.workers.dev
```

### Database Management
```bash
# Apply migrations (local)
npx wrangler d1 migrations apply AUTH_DB --local

# Apply migrations (remote)
npx wrangler d1 migrations apply AUTH_DB --remote

# Execute SQL query
npx wrangler d1 execute AUTH_DB --remote --command "SELECT * FROM tenants"

# Open D1 console
npx wrangler d1 console AUTH_DB --remote
```

### Tenant Management

#### Create New Tenant
```bash
npx wrangler d1 execute AUTH_DB --remote --command "
INSERT INTO tenants (domain, client_id, client_secret, theme_config)
VALUES (
  'auth.newcustomer.com',
  'client_$(uuidgen | tr '[:upper:]' '[:lower:]')',
  'secret_$(openssl rand -hex 32)',
  '{\"title\":\"Customer Auth\",\"primary\":\"#FF6B6B\"}'
);"
```

#### List All Tenants
```bash
npx wrangler d1 execute AUTH_DB --remote --command \
  "SELECT id, domain, client_id, is_active, created_at FROM tenants"
```

#### Update Tenant Theme
```bash
npx wrangler d1 execute AUTH_DB --remote --command "
UPDATE tenants 
SET theme_config = '{\"title\":\"New Title\",\"primary\":\"#00AA00\"}'
WHERE domain = 'auth.customer.com';"
```

#### Deactivate Tenant
```bash
npx wrangler d1 execute AUTH_DB --remote --command \
  "UPDATE tenants SET is_active = 0 WHERE domain = 'auth.customer.com'"
```

### Cloudflare for SaaS

#### Add Custom Hostname
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "hostname": "auth.customer.com",
    "ssl": {"method": "txt", "type": "dv"}
  }'
```

#### Check SSL Status
```bash
curl "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" | jq '.result[] | {hostname, status: .ssl.status}'
```

#### Delete Custom Hostname
```bash
curl -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${HOSTNAME_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}"
```

### KV Storage

#### List All KV Namespaces
```bash
npx wrangler kv namespace list
```

#### List Keys in Namespace
```bash
npx wrangler kv key list --namespace-id=8bab447ef6c7472bbe41b71544ed8e80
```

#### Get Value
```bash
npx wrangler kv key get "session_key" --namespace-id=8bab447ef6c7472bbe41b71544ed8e80
```

#### Delete Key
```bash
npx wrangler kv key delete "session_key" --namespace-id=8bab447ef6c7472bbe41b71544ed8e80
```

### Development

#### Run Locally
```bash
npm run dev
# Access at http://localhost:8787
```

#### Test Custom Domain Locally
```bash
# Add to /etc/hosts
echo "127.0.0.1 auth.test.local" | sudo tee -a /etc/hosts

# Start dev server
npm run dev

# Visit
open http://auth.test.local:8787
```

#### View Logs
```bash
# Live tail logs
npx wrangler tail

# Filter by status
npx wrangler tail --status error

# Filter by method
npx wrangler tail --method POST
```

### Monitoring

#### View Analytics
```bash
# Open Cloudflare Dashboard
open "https://dash.cloudflare.com/?to=/:account/workers/services/view/stonepot-oauth/production/analytics"
```

#### Check Worker Status
```bash
curl -I https://stonepot-oauth.suyesh.workers.dev/
```

## Useful SQL Queries

### List All Users by Tenant
```sql
SELECT 
  t.domain as tenant,
  u.email,
  u.created_at
FROM user u
JOIN tenants t ON u.tenant_id = t.id
ORDER BY t.domain, u.created_at DESC;
```

### Count Users per Tenant
```sql
SELECT 
  t.domain,
  COUNT(u.id) as user_count
FROM tenants t
LEFT JOIN user u ON t.id = u.tenant_id
GROUP BY t.id, t.domain
ORDER BY user_count DESC;
```

### Find Tenant by Client ID
```sql
SELECT * FROM tenants WHERE client_id = 'client_xxx';
```

### Recent Users (Last 7 Days)
```sql
SELECT 
  t.domain,
  COUNT(u.id) as new_users
FROM user u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.created_at >= datetime('now', '-7 days')
GROUP BY t.id, t.domain;
```

## Configuration Files

### wrangler.json
```json
{
  "name": "stonepot-oauth",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "kv_namespaces": [
    {
      "binding": "AUTH_STORAGE",
      "id": "8bab447ef6c7472bbe41b71544ed8e80"
    }
  ],
  "d1_databases": [
    {
      "binding": "AUTH_DB",
      "database_name": "openauth-template-auth-db",
      "database_id": "3a4055fd-7b5a-4f6b-8e08-271f2c10118e"
    }
  ]
}
```

### Environment Variables
Set in Cloudflare Dashboard or wrangler.json:

```json
{
  "vars": {
    "CF_ZONE_ID": "your_zone_id",
    "CF_API_TOKEN": "your_api_token",
    "ENVIRONMENT": "production"
  }
}
```

## DNS Configuration for Customers

### CNAME Record
```
Type: CNAME
Name: auth (or auth.customer.com)
Target: stonepot-oauth.suyesh.workers.dev
Proxy Status: DNS only (grey cloud)
TTL: Auto
```

### TXT Record (for SSL validation)
Provided by Cloudflare API response after adding custom hostname.

## Troubleshooting

| Issue | Check | Solution |
|-------|-------|----------|
| 404 Tenant not found | Tenant exists in DB | `SELECT * FROM tenants WHERE domain = ?` |
| SSL Pending | Certificate status | Check custom hostname API, wait for validation |
| DNS not resolving | CNAME record | `dig auth.customer.com CNAME` |
| Users can't login | Tenant is active | Check `is_active = 1` in tenants table |
| Sessions not persisting | KV namespace | Verify AUTH_STORAGE binding |

## Support URLs

- **Worker URL**: https://stonepot-oauth.suyesh.workers.dev
- **Dashboard**: https://dash.cloudflare.com/
- **OpenAuth Docs**: https://openauth.js.org/
- **CF for SaaS**: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/

## Emergency Commands

### Rollback Deployment
```bash
npx wrangler deployments list
npx wrangler rollback --version-id <previous-version-id>
```

### Disable All Tenants (Emergency)
```bash
npx wrangler d1 execute AUTH_DB --remote --command \
  "UPDATE tenants SET is_active = 0"
```

### Clear All Sessions
```bash
# Be careful with this!
npx wrangler kv key delete --all --namespace-id=8bab447ef6c7472bbe41b71544ed8e80
```

### Export Tenant Data
```bash
npx wrangler d1 export AUTH_DB --remote --output=backup.sql
```


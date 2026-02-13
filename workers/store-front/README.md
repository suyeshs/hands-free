# Store Front Worker

Main entry point for all tenant subdomain requests (`*.handsfree.tech`)

## Responsibilities

- **Tenant Extraction**: Extract tenant ID from subdomain (`tenant-123.handsfree.tech` → `tenant-123`)
- **Request Routing**: Route requests to appropriate workers based on tenant type and path:
  - RESTAURANT tenants → Restaurant Client Worker
  - Admin paths → Admin App (Cloudflare Pages)
  - Customer paths → Store Front App
- **Static Assets**: Proxy static assets to appropriate apps
- **Tenant Context**: Add tenant metadata headers to all proxied requests

## Configuration

### Environment Variables

```bash
PLATFORM_DOMAIN=handsfree.tech
PLATFORM_WORKER_URL=https://handsfree-store-front-prod.suyesh.workers.dev
```

### KV Namespaces

- `DOMAIN_METADATA`: Tenant configurations
- `THEME_CACHE`: Theme cache
- `ADMIN_SESSIONS`: Admin session storage
- `TENANT_METADATA`: Tenant metadata (shared with admin-app)

### Secrets

```bash
# Set Cloudflare credentials
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_API_TOKEN
```

## Request Flow

### Restaurant Tenants

```
*.handsfree.tech → Store Front Worker
  ↓ (businessCategory === 'RESTAURANT')
  → Restaurant Client Worker
```

### Printing Store Tenants (Admin Routes)

```
*.handsfree.tech/admin → Store Front Worker
  ↓ (isAdminPath)
  → Admin App (stonepot-admin.pages.dev)
    + Query params: ?tenantId=xxx&businessCategory=PRINTING_STORE
```

### Printing Store Tenants (Customer Routes)

```
*.handsfree.tech/* → Store Front Worker
  ↓ (default)
  → Store Front App
    + Headers: X-Tenant-ID, X-Original-Host
```

## Deployment

### Development

```bash
npm install
wrangler dev
```

### Production

```bash
wrangler deploy --env production
```

## Route Configuration

Routes are configured in `wrangler.toml`:

```toml
routes = [
  { pattern = "*.handsfree.tech/*", zone_name = "handsfree.tech" }
]
```

## Dependencies

- **Admin App**: https://stonepot-admin.pages.dev
- **Store Front App**: https://store-front-app.suyesh.workers.dev
- **Restaurant Client**: https://stonepot-restaurant-client.suyesh.workers.dev
- **Restaurant Worker**: https://restaurant-worker-prod.suyesh.workers.dev

## Logs

View logs in real-time:

```bash
wrangler tail --env production
```

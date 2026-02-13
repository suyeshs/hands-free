# Domain Service Worker

Automated subdomain provisioning and DNS management for the Handsfree Platform.

## Responsibilities

- **Subdomain Creation**: Create DNS records for new tenant subdomains (`tenant-123.handsfree.tech`)
- **Database Provisioning**: Create and initialize D1 databases for each tenant
- **Storage Provisioning**: Set up KV and R2 storage for tenants
- **Status Tracking**: Monitor provisioning status and handle failures
- **Firestore Sync**: Sync tenant metadata to Firestore for admin panel access

## Key Features

### 1. DNS Management
- Create CNAME records pointing to `handsfree-store-front-prod.suyesh.workers.dev`
- Update DNS records when needed
- Delete DNS records when tenants are removed
- Support for custom domains (future)

### 2. Database Provisioning
- Create tenant-specific D1 databases
- Execute schema SQL to create tables
- Insert seed data (categories, shipping costs)
- Track provisioning status

### 3. Metadata Storage
- Store tenant configurations in KV
- Sync metadata to Firestore
- Cache tenant data for fast lookups

## Configuration

### Environment Variables

```bash
SERVICE_VERSION=1.0.0
MAX_DOMAINS_PER_TENANT=10
VALIDATION_TIMEOUT_HOURS=168
```

### Secrets

```bash
# Set required secrets
wrangler secret put BASE_DOMAIN
# Enter: handsfree.tech

wrangler secret put CLOUDFLARE_ZONE_ID
# Enter: a87f103cc0e697543f91213a71bafe01

wrangler secret put CLOUDFLARE_ACCOUNT_ID
# Enter: <your-account-id>

wrangler secret put CLOUDFLARE_API_TOKEN
# Enter: <your-api-token>

wrangler secret put LETSENCRYPT_EMAIL
# Enter: admin@handsfree.tech

wrangler secret put FIRESTORE_PROJECT_ID
# Enter: <your-firestore-project-id>

wrangler secret put FIRESTORE_KEY_FILE
# Paste entire JSON key file content
```

## API Endpoints

### Create Tenant

```bash
POST /api/provision
Content-Type: application/json

{
  "tenantId": "test-restaurant-123",
  "subdomain": "test-restaurant-123",
  "companyName": "Test Restaurant",
  "email": "admin@example.com",
  "phone": "+1234567890",
  "businessCategory": "RESTAURANT"
}
```

### Check Subdomain Availability

```bash
GET /api/check-subdomain?subdomain=test-restaurant-123
```

### Get Tenant Status

```bash
GET /api/tenant-status?tenantId=test-restaurant-123
```

### Get Tenant Metadata

```bash
GET /api/test/tenant-metadata?tenantId=test-restaurant-123
```

## Provisioning Flow

```
1. Receive provision request
   ↓
2. Validate subdomain availability
   ↓
3. Create D1 database
   ↓
4. Execute schema SQL (create tables)
   ↓
5. Insert seed data
   ↓
6. Create DNS CNAME record
   ↓
7. Store metadata in KV
   ↓
8. Sync metadata to Firestore
   ↓
9. Return success response
```

## Database Schema

The provisioner creates the following tables for each tenant:

- `users` - User accounts
- `products` - Product catalog
- `orders` - Order history
- `carts` - Shopping carts
- `addresses` - User addresses
- `file_uploads` - Uploaded files tracking
- `CategoryTable` - Product categories
- `shipping_costs` - Shipping rate table
- ... and more

See [database-provisioner.ts](../../domain-service/src/core/database-provisioner.ts) for full schema.

## Code Migration

**Source to migrate from:**
```
/domain-service/src/
├── index.ts                          # Main worker entry point
├── core/
│   ├── database-provisioner.ts       # D1 database provisioning
│   ├── subdomain-service.ts          # DNS management
│   └── firestore-sync.ts             # Firestore synchronization
└── integration/
    ├── store-workflow.ts             # Complete provisioning workflow
    └── tracked-store-creation.ts     # Status tracking
```

**Target structure:**
```
src/
├── index.ts                          # Main worker entry point
├── database-provisioner.ts           # D1 provisioning
├── subdomain-service.ts              # DNS management
├── firestore-sync.ts                 # Firestore sync
└── durable-objects/
    └── DeploymentStatusDO.ts         # Status tracking (Durable Object)
```

## Deployment

### Development

```bash
npm install
wrangler dev
```

### Production

```bash
# Set all secrets first (see Configuration section above)
wrangler deploy --env production
```

## Dependencies

- Cloudflare DNS API
- Cloudflare D1 API
- Cloudflare KV
- Google Firestore
- Store Front Worker (for DNS target)

## Logs

View provisioning logs:

```bash
wrangler tail --env production
```

Filter for specific tenant:

```bash
wrangler tail --env production | grep "tenant-123"
```

## Troubleshooting

### DNS not resolving
- Check CLOUDFLARE_ZONE_ID is correct
- Verify API token has DNS edit permissions
- Wait 2-5 minutes for propagation

### Database provisioning fails
- Check CLOUDFLARE_ACCOUNT_ID is correct
- Verify API token has D1 permissions
- Check database schema SQL is valid

### Firestore sync fails
- Verify FIRESTORE_PROJECT_ID is correct
- Check service account has Firestore permissions
- Validate JSON key file format

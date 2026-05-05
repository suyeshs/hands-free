# Stonepot OAuth Server

A multitenant OpenAuth server deployed on Cloudflare Workers, designed for use with [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/) to provide authentication services across multiple custom domains.

![OpenAuth Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/b2ff10c6-8f7c-419f-8757-e2ccf1c84500/public)

## Overview

[OpenAuth](https://openauth.js.org/) is a universal provider for managing user authentication. This deployment is configured for **multitenant use**, allowing multiple applications/tenants to use a centralized authentication service with their own custom domains, branding, and isolated user databases.

**Key Features:**
- 🏢 **Multitenant Architecture** - Isolated authentication per tenant/domain
- 🌐 **Custom Domain Support** - Via Cloudflare for SaaS
- 🔐 **Secure by Default** - OAuth 2.0 compliant with OpenAuth
- ⚡ **Edge-Native** - Powered by Cloudflare Workers, D1, and KV
- 🎨 **Customizable UI** - Theme and branding per tenant

**Live Deployment:** [https://stonepot-oauth.suyesh.workers.dev](https://stonepot-oauth.suyesh.workers.dev)

## Table of Contents

- [Setup Steps](#setup-steps)
- [Multitenant Configuration](#multitenant-configuration)
- [Cloudflare for SaaS Integration](#cloudflare-for-saas-integration)
- [Custom Domain Setup](#custom-domain-setup)
- [Tenant Isolation](#tenant-isolation)
- [Development](#development)
- [Architecture](#architecture)

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

Create a [D1 database](https://developers.cloudflare.com/d1/get-started/) for user authentication data:

```bash
npx wrangler d1 create openauth-template-auth-db
```

Update the `database_id` in `wrangler.json` with the new database ID from the output.

### 3. Apply Database Migrations

Initialize the user table and schema:

```bash
npx wrangler d1 migrations apply AUTH_DB --remote
```

### 4. Create KV Namespace

Create a [KV namespace](https://developers.cloudflare.com/kv/get-started/) for session storage:

```bash
npx wrangler kv namespace create AUTH_STORAGE
```

Update the `kv_namespaces` -> `id` field in `wrangler.json` with the new namespace ID.

### 5. Deploy

```bash
npm run deploy
```

Your authentication server will be deployed at: `https://stonepot-oauth.YOUR_SUBDOMAIN.workers.dev`

---

## Multitenant Configuration

This OpenAuth server is designed to serve multiple tenants (applications/customers) from a single deployment. Each tenant can have:

- **Isolated user databases** - Users are scoped to tenant domains
- **Custom branding** - Logo, colors, and styling per tenant
- **Custom domains** - Via Cloudflare for SaaS
- **Separate OAuth clients** - Per-tenant client credentials

### Tenant Identification

Tenants are identified by the **hostname** of incoming requests:

```typescript
const url = new URL(request.url);
const tenantDomain = url.hostname; // e.g., "auth.customer1.com"
```

### User Isolation

Users are automatically isolated per tenant using the email domain or tenant ID. Update the `getOrCreateUser` function to include tenant context:

```typescript
async function getOrCreateUser(
  env: Env,
  email: string,
  tenantId: string
): Promise<string> {
  const result = await env.AUTH_DB.prepare(
    `
    INSERT INTO user (email, tenant_id)
    VALUES (?, ?)
    ON CONFLICT (email, tenant_id) DO UPDATE SET email = email
    RETURNING id;
    `
  )
    .bind(email, tenantId)
    .first<{ id: string }>();
  
  if (!result) {
    throw new Error(`Unable to process user: ${email} for tenant: ${tenantId}`);
  }
  
  return result.id;
}
```

### Tenant-Specific Theming

Configure branding per tenant using a configuration store:

```typescript
// Store tenant config in KV or D1
const tenantConfig = {
  "auth.customer1.com": {
    title: "Customer1 Auth",
    primary: "#FF6B6B",
    logo: {
      light: "https://cdn.customer1.com/logo-light.png",
      dark: "https://cdn.customer1.com/logo-dark.png"
    }
  },
  "auth.customer2.com": {
    title: "Customer2 Login",
    primary: "#4ECDC4",
    logo: {
      light: "https://cdn.customer2.com/logo-light.png",
      dark: "https://cdn.customer2.com/logo-dark.png"
    }
  }
};

// Apply in issuer config
const hostname = new URL(request.url).hostname;
const theme = tenantConfig[hostname] || defaultTheme;
```

---

## Cloudflare for SaaS Integration

[Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/) allows your customers to use their own custom domains (e.g., `auth.customer.com`) while still being served by your Worker.

### Prerequisites

1. **Cloudflare for SaaS subscription** - Required for custom hostname support
2. **Fallback origin** - Your Worker domain (`stonepot-oauth.suyesh.workers.dev`)
3. **SSL/TLS certificates** - Automatically provisioned by Cloudflare

### Setup Steps

#### 1. Enable Cloudflare for SaaS

In your Cloudflare dashboard:
1. Navigate to **SSL/TLS** → **Custom Hostnames**
2. Add a fallback origin: `stonepot-oauth.suyesh.workers.dev`

#### 2. Add Custom Hostnames via API

Use the Cloudflare API to add customer domains:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/custom_hostnames" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "hostname": "auth.customer.com",
    "ssl": {
      "method": "txt",
      "type": "dv",
      "settings": {
        "min_tls_version": "1.2"
      }
    }
  }'
```

#### 3. Customer DNS Configuration

Your customers need to add a CNAME record:

```
CNAME auth.customer.com -> stonepot-oauth.suyesh.workers.dev
```

#### 4. Verify SSL Provisioning

Check certificate status:

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/{zone_id}/custom_hostnames/{hostname_id}" \
  -H "Authorization: Bearer {api_token}"
```

Once `ssl.status` is `active`, the custom domain is ready.

### Worker Integration

The Worker automatically handles requests from custom domains. Extract tenant info from the hostname:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Determine if this is a custom domain
    const isCustomDomain = !hostname.endsWith('.workers.dev');
    
    if (isCustomDomain) {
      // Load tenant configuration from KV or D1
      const tenantConfig = await env.AUTH_DB.prepare(
        'SELECT * FROM tenants WHERE domain = ?'
      ).bind(hostname).first();
      
      if (!tenantConfig) {
        return new Response('Tenant not found', { status: 404 });
      }
      
      // Apply tenant-specific settings
      request.headers.set('X-Tenant-ID', tenantConfig.id);
    }
    
    // Continue with OpenAuth issuer...
  }
}
```

---

## Custom Domain Setup

### For Each Tenant

When onboarding a new tenant:

1. **Generate OAuth Client Credentials**
   ```typescript
   const clientId = crypto.randomUUID();
   const clientSecret = crypto.randomUUID();
   ```

2. **Store Tenant Configuration**
   ```sql
   INSERT INTO tenants (id, domain, client_id, client_secret, theme_config)
   VALUES (?, ?, ?, ?, ?);
   ```

3. **Add Custom Hostname via API**
   ```typescript
   await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`, {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${env.CF_API_TOKEN}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       hostname: tenantDomain,
       ssl: { method: 'txt', type: 'dv' }
     })
   });
   ```

4. **Provide DNS Instructions**
   - Send CNAME record details to customer
   - Include TXT record for SSL validation

### Domain Verification

Implement a verification endpoint:

```typescript
app.get('/verify-domain/:domain', async (req, res) => {
  const { domain } = req.params;
  
  // Check DNS records
  const dnsRecords = await fetch(
    `https://dns.google/resolve?name=${domain}&type=CNAME`
  ).then(r => r.json());
  
  const isConfigured = dnsRecords.Answer?.some(
    record => record.data.includes('stonepot-oauth.suyesh.workers.dev')
  );
  
  return res.json({ verified: isConfigured });
});
```

---

## Tenant Isolation

### Database Schema

Update your migrations to include tenant context:

```sql
-- migrations/0002_add_tenant_support.sql
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    theme_config TEXT, -- JSON string
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add tenant_id to user table
ALTER TABLE user ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
CREATE UNIQUE INDEX idx_user_email_tenant ON user(email, tenant_id);
```

### Session Isolation

Store sessions with tenant context in KV:

```typescript
// Session key format: tenant_id:session_id
const sessionKey = `${tenantId}:${sessionId}`;
await env.AUTH_STORAGE.put(sessionKey, sessionData, {
  expirationTtl: 86400 // 24 hours
});
```

### Security Considerations

1. **Validate tenant ownership** - Ensure users can only access their tenant's data
2. **Rate limiting per tenant** - Prevent abuse from individual tenants
3. **Audit logging** - Track authentication events per tenant
4. **Secret rotation** - Allow tenants to rotate OAuth credentials

---

## Development

### Local Development

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

### Testing with Custom Domains Locally

Use `/etc/hosts` to simulate custom domains:

```bash
# Add to /etc/hosts
127.0.0.1 auth.testclient.local
```

Then access: `http://auth.testclient.local:8787`

### Environment Variables

Configure in `wrangler.json`:

```json
{
  "vars": {
    "ENVIRONMENT": "production",
    "DEFAULT_REDIRECT_URI": "https://app.example.com/callback"
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Internet/Users                       │
└────────────┬────────────────────────────────────────────┘
             │
             │ HTTPS Requests
             │
┌────────────▼────────────────────────────────────────────┐
│              Cloudflare for SaaS Layer                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Custom Hostnames (auth.customer1.com, etc.)     │   │
│  │  - SSL/TLS Termination                           │   │
│  │  - Certificate Management                        │   │
│  └──────────────────┬───────────────────────────────┘   │
└────────────────────┬┘                                    │
                     │                                      │
                     │ Routes to Fallback Origin           │
                     │                                      │
┌────────────────────▼─────────────────────────────────────┐
│           Stonepot OAuth Worker                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Request Handler                                 │    │
│  │  - Extract hostname (tenant identification)      │    │
│  │  - Load tenant config                           │    │
│  │  - Apply branding/theme                         │    │
│  └──────────┬───────────────────────────────────────┘   │
│             │                                            │
│  ┌──────────▼───────────────────────────────────────┐   │
│  │  OpenAuth Issuer                                 │   │
│  │  - OAuth 2.0 flows                              │   │
│  │  - Password Provider                            │   │
│  │  - Session Management                           │   │
│  └──────────┬───────────────────────────────────────┘   │
└─────────────┼──────────────────────────────────────────┘
              │
      ┌───────┴────────┐
      │                │
┌─────▼─────┐    ┌────▼─────┐
│ D1 Database│    │ KV Store │
│            │    │          │
│ - Users    │    │ Sessions │
│ - Tenants  │    │ Tokens   │
└────────────┘    └──────────┘
```

### Request Flow

1. **User visits** `https://auth.customer.com`
2. **Cloudflare for SaaS** resolves to `stonepot-oauth.suyesh.workers.dev`
3. **Worker extracts** hostname → tenant ID
4. **Worker loads** tenant config from D1
5. **OpenAuth handles** OAuth flow with tenant context
6. **User authenticated** and redirected to tenant's application

---

## Deployment

### Production Deployment

```bash
npm run deploy
```

### Monitoring

Enable observability in `wrangler.json`:

```json
{
  "observability": {
    "enabled": true
  }
}
```

Monitor in Cloudflare Dashboard → Workers → Analytics

### Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to specific version
wrangler rollback --version-id <version-id>
```

---

## Resources

- [OpenAuth Documentation](https://openauth.js.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Workers KV](https://developers.cloudflare.com/kv/)

---

## License

MIT License - See LICENSE file for details

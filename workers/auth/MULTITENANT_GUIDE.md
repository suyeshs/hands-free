# Multitenant Setup Guide

This guide walks you through setting up the Stonepot OAuth server for a multitenant SaaS application using Cloudflare for SaaS.

## Quick Start Example

### Step 1: Apply Tenant Migrations

```bash
npx wrangler d1 migrations apply AUTH_DB --remote
```

This will create the `tenants` table and add tenant support to the `user` table.

### Step 2: Create Your First Tenant

```bash
# Insert a test tenant directly into D1
npx wrangler d1 execute AUTH_DB --remote --command "
INSERT INTO tenants (domain, client_id, client_secret, theme_config)
VALUES (
  'auth.customer1.com',
  'client_' || lower(hex(randomblob(16))),
  'secret_' || lower(hex(randomblob(32))),
  '{\"title\":\"Customer1 Auth\",\"primary\":\"#FF6B6B\"}'
);
"
```

### Step 3: Add Custom Hostname in Cloudflare

```bash
# Replace with your zone ID and API token
export CF_ZONE_ID="your_zone_id"
export CF_API_TOKEN="your_api_token"

curl -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "hostname": "auth.customer1.com",
    "ssl": {
      "method": "txt",
      "type": "dv",
      "settings": {
        "min_tls_version": "1.2",
        "http2": "on"
      }
    }
  }'
```

### Step 4: Configure DNS

Instruct your customer to add a CNAME record:

```
Type: CNAME
Name: auth.customer1.com
Target: stonepot-oauth.suyesh.workers.dev
Proxy: DNS only (grey cloud)
```

## Implementation Example

### Enhanced Worker Code

Update `src/index.ts` to support multitenancy:

```typescript
import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { createSubjects } from "@openauthjs/openauth/subject";
import { object, string } from "valibot";

const subjects = createSubjects({
  user: object({
    id: string(),
    tenantId: string(),
  }),
});

interface TenantConfig {
  id: string;
  domain: string;
  client_id: string;
  client_secret: string;
  theme_config: string | null;
  is_active: number;
}

interface ThemeConfig {
  title: string;
  primary: string;
  favicon?: string;
  logo?: {
    light: string;
    dark: string;
  };
}

// Default theme for fallback
const DEFAULT_THEME: ThemeConfig = {
  title: "myAuth",
  primary: "#0051c3",
  favicon: "https://workers.cloudflare.com/favicon.ico",
  logo: {
    dark: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/db1e5c92-d3a6-4ea9-3e72-155844211f00/public",
    light: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fa5a3023-7da9-466b-98a7-4ce01ee6c700/public",
  },
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    // Load tenant configuration
    let tenantConfig: TenantConfig | null = null;
    let theme: ThemeConfig = DEFAULT_THEME;
    
    // Only load tenant config for non-workers.dev domains
    const isCustomDomain = !hostname.endsWith('.workers.dev');
    
    if (isCustomDomain) {
      tenantConfig = await env.AUTH_DB.prepare(
        'SELECT * FROM tenants WHERE domain = ? AND is_active = 1'
      )
        .bind(hostname)
        .first<TenantConfig>();
      
      if (!tenantConfig) {
        return new Response('Tenant not found or inactive', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      
      // Parse theme config if available
      if (tenantConfig.theme_config) {
        try {
          const customTheme = JSON.parse(tenantConfig.theme_config);
          theme = { ...DEFAULT_THEME, ...customTheme };
        } catch (e) {
          console.error('Failed to parse theme config:', e);
        }
      }
    }
    
    // Demo OAuth flow handlers
    if (url.pathname === "/") {
      url.searchParams.set("redirect_uri", url.origin + "/callback");
      url.searchParams.set("client_id", tenantConfig?.client_id || "your-client-id");
      url.searchParams.set("response_type", "code");
      url.pathname = "/authorize";
      return Response.redirect(url.toString());
    } else if (url.pathname === "/callback") {
      return Response.json({
        message: "OAuth flow complete!",
        tenant: tenantConfig?.domain || "default",
        params: Object.fromEntries(url.searchParams.entries()),
      });
    }
    
    // OpenAuth issuer with tenant context
    return issuer({
      storage: CloudflareStorage({
        namespace: env.AUTH_STORAGE,
      }),
      subjects,
      providers: {
        password: PasswordProvider(
          PasswordUI({
            sendCode: async (email, code) => {
              // Log code with tenant context
              console.log(
                `[${tenantConfig?.domain || 'default'}] Sending code ${code} to ${email}`
              );
              
              // TODO: Integrate with email service (Resend, SendGrid, etc.)
              // Send tenant-branded emails here
            },
            copy: {
              input_code: "Code (check Worker logs)",
            },
          }),
        ),
      },
      theme: theme,
      success: async (ctx, value) => {
        const userId = await getOrCreateUser(
          env,
          value.email,
          tenantConfig?.id || 'default'
        );
        
        return ctx.subject("user", {
          id: userId,
          tenantId: tenantConfig?.id || 'default',
        });
      },
    }).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

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
  
  console.log(
    `[Tenant: ${tenantId}] Found or created user ${result.id} with email ${email}`
  );
  
  return result.id;
}
```

## Tenant Management API

Consider building a separate Worker or adding routes for tenant management:

### Create Tenant Endpoint

```typescript
// POST /api/tenants
async function createTenant(request: Request, env: Env) {
  const { domain } = await request.json();
  
  // Generate secure credentials
  const tenantId = crypto.randomUUID();
  const clientId = `client_${crypto.randomUUID()}`;
  const clientSecret = `secret_${crypto.randomUUID()}`;
  
  // Store in D1
  await env.AUTH_DB.prepare(
    `INSERT INTO tenants (id, domain, client_id, client_secret)
     VALUES (?, ?, ?, ?)`
  )
    .bind(tenantId, domain, clientId, clientSecret)
    .run();
  
  // Add custom hostname via Cloudflare API
  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname: domain,
        ssl: { method: 'txt', type: 'dv' },
      }),
    }
  );
  
  const cfData = await cfResponse.json();
  
  return Response.json({
    success: true,
    tenant: {
      id: tenantId,
      domain,
      clientId,
      clientSecret,
    },
    ssl: {
      status: cfData.result?.status,
      validation_records: cfData.result?.ssl?.validation_records,
    },
    dns: {
      type: 'CNAME',
      name: domain,
      target: 'stonepot-oauth.suyesh.workers.dev',
    },
  });
}
```

### Update Tenant Theme

```typescript
// PATCH /api/tenants/:id/theme
async function updateTenantTheme(tenantId: string, theme: ThemeConfig, env: Env) {
  await env.AUTH_DB.prepare(
    `UPDATE tenants 
     SET theme_config = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(JSON.stringify(theme), tenantId)
    .run();
  
  return Response.json({ success: true });
}
```

### List Tenant Users

```typescript
// GET /api/tenants/:id/users
async function listTenantUsers(tenantId: string, env: Env) {
  const users = await env.AUTH_DB.prepare(
    `SELECT id, email, created_at 
     FROM user 
     WHERE tenant_id = ?
     ORDER BY created_at DESC`
  )
    .bind(tenantId)
    .all();
  
  return Response.json({ users: users.results });
}
```

## Testing Locally

### 1. Add Test Tenant to Local DB

```bash
# Apply migrations locally first
npx wrangler d1 migrations apply AUTH_DB --local

# Add test tenant
npx wrangler d1 execute AUTH_DB --local --command "
INSERT INTO tenants (domain, client_id, client_secret, theme_config)
VALUES (
  'auth.test.local',
  'test_client_123',
  'test_secret_456',
  '{\"title\":\"Test Auth\",\"primary\":\"#4ECDC4\"}'
);
"
```

### 2. Configure /etc/hosts

```bash
sudo sh -c 'echo "127.0.0.1 auth.test.local" >> /etc/hosts'
```

### 3. Start Dev Server

```bash
npm run dev
```

### 4. Test in Browser

Visit: `http://auth.test.local:8787`

You should see the custom theme applied!

## Security Best Practices

### 1. Secure Client Secrets

Store client secrets encrypted:

```typescript
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 2. Rate Limiting Per Tenant

```typescript
async function checkRateLimit(tenantId: string, env: Env): Promise<boolean> {
  const key = `ratelimit:${tenantId}:${Date.now()}`;
  const count = await env.AUTH_STORAGE.get(key);
  
  if (count && parseInt(count) > 100) {
    return false; // Rate limit exceeded
  }
  
  await env.AUTH_STORAGE.put(key, (parseInt(count || '0') + 1).toString(), {
    expirationTtl: 60, // 1 minute window
  });
  
  return true;
}
```

### 3. Audit Logging

```typescript
async function logAuthEvent(
  tenantId: string,
  event: string,
  userId: string | null,
  env: Env
) {
  await env.AUTH_DB.prepare(
    `INSERT INTO audit_log (tenant_id, event, user_id, timestamp)
     VALUES (?, ?, ?, ?)`
  )
    .bind(tenantId, event, userId, new Date().toISOString())
    .run();
}
```

## Monitoring

### Key Metrics to Track

1. **Authentications per tenant** - Monitor usage
2. **Failed login attempts** - Security monitoring
3. **Custom domain SSL status** - Ensure certificates are active
4. **Response times** - Performance per tenant

### Example Analytics Query

```sql
SELECT 
  t.domain,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(*) as total_logins
FROM tenants t
LEFT JOIN user u ON t.id = u.tenant_id
GROUP BY t.id, t.domain
ORDER BY total_users DESC;
```

## Troubleshooting

### Custom Domain Not Working

1. **Check DNS**: Verify CNAME points to your Worker
   ```bash
   dig auth.customer.com CNAME
   ```

2. **Check SSL Status**: Verify certificate is active
   ```bash
   curl -X GET "https://api.cloudflare.com/client/v4/zones/{zone_id}/custom_hostnames/{hostname_id}" \
     -H "Authorization: Bearer {api_token}"
   ```

3. **Check Tenant Config**: Ensure tenant exists and is active
   ```bash
   npx wrangler d1 execute AUTH_DB --remote --command \
     "SELECT * FROM tenants WHERE domain = 'auth.customer.com'"
   ```

### Users Can't Login

1. **Verify tenant isolation**: Check user has correct tenant_id
2. **Check KV storage**: Ensure sessions are being created
3. **Review logs**: Check Worker logs for errors

## Next Steps

1. ✅ Deploy the worker
2. ✅ Apply tenant migrations
3. 🔲 Build tenant management UI
4. 🔲 Integrate email service (Resend/SendGrid)
5. 🔲 Add OAuth provider options (Google, GitHub, etc.)
6. 🔲 Implement role-based access control (RBAC)
7. 🔲 Set up monitoring and alerts

## Resources

- [Cloudflare for SaaS Docs](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [OpenAuth Documentation](https://openauth.js.org/)
- [Custom Hostname API Reference](https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname)


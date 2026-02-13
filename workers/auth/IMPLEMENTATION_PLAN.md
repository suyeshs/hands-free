# 🔐 Stonepot Auth Implementation Plan

## ✅ Current State

**Location**: `/facemash-platform/stonepot-auth`  
**Source**: Copied from `/ship-workers/auth/ship-track`  
**Status**: Base OpenAuth setup ready

### **What We Have:**
```
✅ OpenAuth worker base
✅ D1 database setup (user table)
✅ Migration 0001: user table
✅ Migration 0002: tenants table + tenant_id column
✅ KV storage binding (AUTH_STORAGE)
✅ Password provider with email verification
```

### **Current Schema:**
```sql
-- user table
id, email, created_at, tenant_id

-- tenants table  
id, domain, client_id, client_secret, theme_config, is_active, created_at, updated_at
```

---

## 🎯 Required Changes

### **Changes Needed for Multi-Level Auth:**

#### **1. Database Schema Updates**

**Create Migration 0003:**
```sql
-- migrations/0003_add_platform_and_tenant_users.sql

-- Drop old constraint (email was unique globally)
DROP INDEX IF EXISTS user_email_unique;

-- Rename existing user table to platform_user
ALTER TABLE user RENAME TO platform_user;

-- Add role and tenant_ids to platform_user
ALTER TABLE platform_user ADD COLUMN role TEXT NOT NULL DEFAULT 'store_owner';
ALTER TABLE platform_user ADD COLUMN tenant_ids TEXT; -- JSON array
ALTER TABLE platform_user DROP COLUMN tenant_id; -- Remove single tenant_id

-- Create tenant_user table (per-store customers)
CREATE TABLE IF NOT EXISTS tenant_user (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    name TEXT,
    metadata TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_verified INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    last_login TIMESTAMP,
    UNIQUE(email, tenant_id)
);

-- Update tenants table
ALTER TABLE tenants ADD COLUMN company_name TEXT;
ALTER TABLE tenants ADD COLUMN owner_id TEXT; -- References platform_user.id
ALTER TABLE tenants ADD COLUMN settings TEXT; -- JSON

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_user_email ON tenant_user(email);
CREATE INDEX IF NOT EXISTS idx_tenant_user_tenant ON tenant_user(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_lookup ON tenant_user(email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
```

#### **2. Update src/index.ts**

**Current subjects** (line 11-15):
```typescript
const subjects = createSubjects({
  user: object({
    id: string(),
  }),
});
```

**New subjects needed**:
```typescript
import { object, string, array, optional, literal } from "valibot";

const subjects = createSubjects({
  platformUser: object({
    id: string(),
    email: string(),
    role: string(),
    tenantIds: optional(array(string())),
    context: literal('platform'),
  }),
  
  tenantUser: object({
    id: string(),
    email: string(),
    role: string(),
    tenantId: string(),
    context: literal('tenant'),
  }),
});
```

**New main handler needed** (replace lines 17-78):
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // Determine auth context
    const clientId = url.searchParams.get('client_id');
    const referer = request.headers.get('referer') || '';
    
    let authContext: 'platform' | 'tenant';
    let tenantId: string | null = null;
    
    // Platform auth (admin-app)
    if (clientId === 'admin-app' || referer.includes('setup.handsfree.tech')) {
      authContext = 'platform';
    } else {
      // Tenant auth (store customers)
      authContext = 'tenant';
      tenantId = clientId || extractTenantFromDomain(url.hostname);
      
      if (!tenantId) {
        return new Response('Invalid authentication context', { status: 400 });
      }
      
      // Verify tenant exists
      const tenant = await env.AUTH_DB.prepare(
        'SELECT id FROM tenants WHERE id = ? AND is_active = 1'
      ).bind(tenantId).first();
      
      if (!tenant) {
        return new Response('Tenant not found', { status: 404 });
      }
    }
    
    // Demo OAuth redirect handlers
    if (url.pathname === "/") {
      url.searchParams.set("redirect_uri", url.origin + "/callback");
      url.searchParams.set("client_id", clientId || "demo-client");
      url.searchParams.set("response_type", "code");
      url.pathname = "/authorize";
      return Response.redirect(url.toString());
    } else if (url.pathname === "/callback") {
      return Response.json({
        message: "OAuth flow complete!",
        context: authContext,
        tenant: tenantId,
        params: Object.fromEntries(url.searchParams.entries()),
      });
    }
    
    return issuer({
      storage: CloudflareStorage({ namespace: env.AUTH_STORAGE }),
      subjects,
      providers: {
        password: PasswordProvider(
          PasswordUI({
            sendCode: async (email, code) => {
              console.log(
                `[${authContext}${tenantId ? ':' + tenantId : ''}] Code ${code} to ${email}`
              );
            },
            copy: {
              input_code: "Code (check Worker logs)",
            },
          }),
        ),
      },
      theme: getTheme(authContext, tenantId),
      success: async (ctx, value) => {
        if (authContext === 'platform') {
          return handlePlatformAuth(ctx, value.email, env);
        } else {
          return handleTenantAuth(ctx, value.email, tenantId!, env);
        }
      },
    }).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

function extractTenantFromDomain(domain: string): string | null {
  const match = domain.match(/^([^.]+)\.thestonepot\.pro$/);
  return match ? match[1] : null;
}

function getTheme(context: 'platform' | 'tenant', tenantId: string | null) {
  if (context === 'platform') {
    return {
      title: "Facemash Platform Admin",
      primary: "#0ea5e9",
      favicon: "https://workers.cloudflare.com/favicon.ico",
    };
  } else {
    return {
      title: "Store Admin",
      primary: "#6366f1",
      favicon: "https://workers.cloudflare.com/favicon.ico",
    };
  }
}
```

**New auth handler functions** (replace getOrCreateUser):
```typescript
async function handlePlatformAuth(ctx: any, email: string, env: Env) {
  let user = await env.AUTH_DB.prepare(
    'SELECT id, email, role, tenant_ids FROM platform_user WHERE email = ?'
  )
    .bind(email)
    .first<{
      id: string;
      email: string;
      role: string;
      tenant_ids: string | null;
    }>();

  if (!user) {
    await env.AUTH_DB.prepare(
      'INSERT INTO platform_user (email, role) VALUES (?, ?)'
    )
      .bind(email, 'store_owner')
      .run();
    
    user = await env.AUTH_DB.prepare(
      'SELECT id, email, role, tenant_ids FROM platform_user WHERE email = ?'
    )
      .bind(email)
      .first();
  }

  if (!user) {
    throw new Error(`Unable to create platform user: ${email}`);
  }

  const tenantIds = user.tenant_ids ? JSON.parse(user.tenant_ids) : [];

  console.log(`Platform auth: ${user.email} (${user.role}) - Tenants: ${tenantIds.join(', ')}`);

  return ctx.subject("platformUser", {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantIds,
    context: 'platform',
  });
}

async function handleTenantAuth(ctx: any, email: string, tenantId: string, env: Env) {
  let user = await env.AUTH_DB.prepare(
    'SELECT id, email, role FROM tenant_user WHERE email = ? AND tenant_id = ?'
  )
    .bind(email, tenantId)
    .first<{
      id: string;
      email: string;
      role: string;
    }>();

  if (!user) {
    await env.AUTH_DB.prepare(
      'INSERT INTO tenant_user (email, tenant_id, role) VALUES (?, ?, ?)'
    )
      .bind(email, tenantId, 'customer')
      .run();
    
    user = await env.AUTH_DB.prepare(
      'SELECT id, email, role FROM tenant_user WHERE email = ? AND tenant_id = ?'
    )
      .bind(email, tenantId)
      .first();
  }

  if (!user) {
    throw new Error(`Unable to create tenant user: ${email} for ${tenantId}`);
  }

  console.log(`Tenant auth: ${user.email} → ${tenantId} (${user.role})`);

  return ctx.subject("tenantUser", {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId,
    context: 'tenant',
  });
}
```

---

## 🚀 Deployment Steps

### **Step 1: Update Package** (if needed)
```bash
cd /Users/stonepot-tech/facemash-platform/stonepot-auth
npm install
```

### **Step 2: Create D1 Database**
```bash
npx wrangler d1 create stonepot-auth-db
# Copy the database_id from output
```

### **Step 3: Update wrangler.json**
```json
{
  "d1_databases": [{
    "binding": "AUTH_DB",
    "database_name": "stonepot-auth-db",
    "database_id": "paste-id-here"
  }],
  "kv_namespaces": [{
    "binding": "AUTH_STORAGE",
    "id": "paste-kv-id-here"
  }]
}
```

### **Step 4: Create KV Namespace**
```bash
npx wrangler kv namespace create AUTH_STORAGE
# Copy the id from output
```

### **Step 5: Apply Migrations**
```bash
# Apply existing migrations
npx wrangler d1 migrations apply stonepot-auth-db --remote

# Create and apply new migration
# (after creating 0003_add_platform_and_tenant_users.sql)
npx wrangler d1 migrations apply stonepot-auth-db --remote
```

### **Step 6: Create Super Admin**
```bash
npx wrangler d1 execute stonepot-auth-db --remote --command \
  "INSERT INTO platform_user (email, role) VALUES ('admin@facemash.com', 'super_admin')"
```

### **Step 7: Deploy Worker**
```bash
npx wrangler deploy
```

### **Step 8: Test Authentication**
```bash
# Visit the deployed URL
# Login with admin@facemash.com
# Check logs for verification code
```

---

## 📋 Next Steps After Deployment

### **1. Integrate with Admin App**
- Add OpenAuth client
- Create /auth/callback handler
- Add auth middleware
- Protect routes

### **2. Test Flows**
- Platform admin login
- Store owner with multiple stores
- Tenant customer login

### **3. Sync Tenants**
- When creating tenant in admin-app
- Write to both D1 (auth) and KV (admin-app)

---

## 🎯 Summary

### **What's Ready:**
✅ Auth worker copied to stonepot-auth  
✅ Base OpenAuth setup  
✅ Migrations for tenants support  

### **What Needs Changes:**
📝 Create migration 0003 (platform_user + tenant_user split)  
📝 Update src/index.ts (context detection + dual auth handlers)  
📝 Create D1 database  
📝 Create KV namespace  
📝 Deploy worker  

### **Files to Create/Modify:**
1. `migrations/0003_add_platform_and_tenant_users.sql` (new)
2. `src/index.ts` (modify - complete rewrite)
3. `wrangler.json` (update with D1 and KV IDs)

**Ready to implement these changes!** 🚀


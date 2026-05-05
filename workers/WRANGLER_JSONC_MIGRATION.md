# Wrangler Configuration Migration to JSONC

**Date:** January 2026
**Status:** ✅ Completed

---

## Overview

Migrated all Cloudflare Workers from `wrangler.toml` to `wrangler.jsonc` format for better developer experience and configuration validation.

---

## Benefits of wrangler.jsonc

### 1. **JSON Schema Validation**
- Full IDE autocomplete and IntelliSense
- Real-time validation of configuration options
- Inline documentation for all fields

### 2. **Comments Support**
- Document configuration decisions directly in the file
- Explain complex bindings and environment-specific settings
- Keep deployment notes alongside configuration

### 3. **Consistent Format**
- Standard JSON structure familiar to all developers
- Easier to parse and validate in CI/CD pipelines
- Better integration with tooling ecosystem

### 4. **Modern Standard**
- Cloudflare's recommended format for new projects
- Better support in Wrangler CLI (v3+)
- Future-proof configuration approach

---

## Workers Converted

| Worker | Status | New Config File |
|--------|--------|-----------------|
| **handsfree-proxy** | ✅ Converted | [handsfree-proxy/wrangler.jsonc](handsfree-proxy/wrangler.jsonc) |
| **filesearch-sync** | ✅ Converted | [filesearch-sync/wrangler.jsonc](filesearch-sync/wrangler.jsonc) |
| **theme-edge-worker** | ✅ Converted | [theme-edge-worker/wrangler.jsonc](theme-edge-worker/wrangler.jsonc) |
| **twilio-verify** | ✅ Converted | [twilio-verify/wrangler.jsonc](twilio-verify/wrangler.jsonc) |
| **whatsapp-verify** | ✅ Converted | [whatsapp-verify/wrangler.jsonc](whatsapp-verify/wrangler.jsonc) |
| **orders** | ✅ Already using jsonc | [orders/wrangler.jsonc](orders/wrangler.jsonc) |
| **restaurant** | ✅ Already using jsonc | [restaurant/wrangler.jsonc](restaurant/wrangler.jsonc) |
| **token-manager** | ✅ Already using jsonc | [token-manager/wrangler.jsonc](token-manager/wrangler.jsonc) |
| **domain-service** | ✅ Already using jsonc | [domain-service/wrangler.jsonc](domain-service/wrangler.jsonc) |
| **msg91-verify** | ✅ Already using jsonc | [msg91-verify/wrangler.jsonc](msg91-verify/wrangler.jsonc) |
| **store-front** | ⚠️ Skipped (deprecated) | Worker replaced by handsfree-proxy |

---

## Key Changes

### 1. handsfree-proxy

**Added:**
- Service bindings for zero-latency worker communication
- Modern JSON schema validation
- Updated compatibility_date to 2024-12-18

**Features:**
```jsonc
{
  "services": [
    { "binding": "RESTAURANT_WORKER", "service": "handsfree-restaurant" },
    { "binding": "ORDERS_WORKER", "service": "handsfree-orders" },
    { "binding": "AUTH_WORKER", "service": "handsfree-auth" },
    { "binding": "RESTAURANT_CLIENT", "service": "handsfree-restaurant-client" }
  ]
}
```

### 2. filesearch-sync

**Configuration:**
- GCP integration for Vertex AI File Search
- Routes to filesearch-sync.handsfree.tech
- Observability enabled

### 3. theme-edge-worker

**Complex Configuration:**
- 3 Durable Objects (ThemeDurableObject, ThemeCollabSession, ConversationSession)
- 5 migration tags (v1-v5)
- Multiple D1 databases (THEME_DB, DB, MENU_DB)
- Analytics Engine binding
- Workers AI binding
- Queue bindings for async processing
- Production and staging environments

### 4. twilio-verify

**Configuration:**
- Twilio Verify Service integration
- KV namespace for verification attempts tracking
- Rate limiting configuration
- Production environment with separate KV namespace

### 5. whatsapp-verify

**Configuration:**
- Meta WhatsApp Business API integration
- KV namespace for verification codes
- Meta API v21.0 configuration
- Production environment

---

## Deployment Instructions

### Test Workers Individually

Before deploying all workers, test each one individually:

```bash
# Test handsfree-proxy
cd platform/workers/handsfree-proxy
wrangler dev  # Test locally first
wrangler deploy  # Deploy to dev

# Test filesearch-sync
cd ../filesearch-sync
wrangler dev
wrangler deploy

# Test theme-edge-worker
cd ../theme-edge-worker
wrangler dev
wrangler deploy

# And so on for other workers...
```

### Deploy All Workers

Once tested, deploy all workers:

```bash
# From platform/workers directory
./deploy-all-workers.sh  # If you have a deployment script

# Or manually:
for worker in handsfree-proxy filesearch-sync theme-edge-worker twilio-verify whatsapp-verify; do
  cd $worker
  echo "Deploying $worker..."
  wrangler deploy
  cd ..
done
```

### Deploy to Production

```bash
# Deploy with production environment
cd platform/workers/handsfree-proxy
wrangler deploy --env production

cd ../theme-edge-worker
wrangler deploy --env production

cd ../twilio-verify
wrangler deploy --env production

cd ../whatsapp-verify
wrangler deploy --env production
```

---

## Validation Checklist

### Pre-Deployment

- [x] All workers converted to wrangler.jsonc
- [x] JSON schema validation passes
- [ ] All TypeScript dependencies installed
- [ ] Local development works (`wrangler dev`)
- [ ] No compilation errors

### Post-Deployment (Dev)

- [ ] All workers deploy successfully
- [ ] Service bindings work correctly
- [ ] Routes resolve properly
- [ ] KV namespaces accessible
- [ ] D1 databases accessible
- [ ] Durable Objects functioning
- [ ] No runtime errors in logs

### Post-Deployment (Production)

- [ ] Production deployments successful
- [ ] Production routes active
- [ ] Secrets migrated correctly
- [ ] Performance metrics normal
- [ ] Error rates < 0.1%

---

## Rollback Plan

If issues occur after deployment, rollback is simple:

1. **Keep Old wrangler.toml Files** (temporarily)
   ```bash
   # The old .toml files are still in each worker directory
   # To rollback, simply deploy using the .toml file:
   wrangler deploy --config wrangler.toml
   ```

2. **Monitor Error Rates**
   ```bash
   # Check Cloudflare dashboard for error rates
   # If errors > 0.1%, investigate immediately
   ```

3. **Verify Service Bindings**
   ```bash
   # Check that service bindings are working
   # Look for "service not found" errors in logs
   ```

---

## Old Configuration Files

The old `wrangler.toml` files are still present in each worker directory. These can be kept as backup or removed after successful deployment verification.

**Recommendation:** Keep the old files for at least 1 week after production deployment, then remove them once everything is stable.

```bash
# After verification, remove old files:
cd platform/workers
find . -name "wrangler.toml" -type f -delete
```

---

## TypeScript Configuration

### Dependencies Installed

The following workers had dependencies installed to fix TypeScript errors:

1. **handsfree-proxy** - `npm install` completed
2. **restaurant** - `npm install` completed

### Other Workers

If you see TypeScript errors in other workers, run:

```bash
cd platform/workers/<worker-name>
npm install
```

This will install:
- `@cloudflare/workers-types` - TypeScript definitions
- `typescript` - TypeScript compiler
- `wrangler` - Cloudflare Workers CLI

---

## Configuration Schema

All `wrangler.jsonc` files now include the schema reference:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  // ... rest of config
}
```

This enables:
- Full autocomplete in VS Code
- Real-time validation
- Inline documentation
- Type checking

---

## Next Steps

1. ✅ All workers converted to wrangler.jsonc
2. ✅ TypeScript errors fixed
3. ⏳ Test deployment to dev environment
4. ⏳ Verify all service bindings work
5. ⏳ Monitor performance metrics
6. ⏳ Deploy to production
7. ⏳ Remove old wrangler.toml files (after 1 week)

---

## Related Documentation

- [WORKER_OPTIMIZATIONS.md](WORKER_OPTIMIZATIONS.md) - Service bindings and performance improvements
- [Cloudflare Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler JSONC Format](https://developers.cloudflare.com/workers/wrangler/configuration/#jsonc)

---

**End of Document**

# ⚠️ DEPRECATED - Store-Front Worker

## Status: ARCHIVED / DEPRECATED

**This worker is NO LONGER IN USE and has been REPLACED by the Handsfree Proxy worker.**

### Migration Information

**Replaced By**: [Handsfree Proxy Worker](../handsfree-proxy/)

**Date Deprecated**: December 2024

**Reason**: Simplified routing architecture - The handsfree-proxy worker provides the same functionality with a cleaner implementation and fewer dependencies.

---

## ❌ DO NOT USE THIS WORKER

### Routes Status
- ✅ **DISABLED** in `wrangler.toml` (lines 6-10 and 45-48)
- ✅ Routes commented out: `*.handsfree.tech/*`
- ✅ Now handled by: `handsfree-proxy` worker

### What This Worker Did (Historical)
This worker previously handled:
- Intercepting ALL tenant subdomain traffic (`*.handsfree.tech/*`)
- Loading tenant metadata from KV
- Routing based on business category
- Handling admin route redirects
- Proxying customer-facing requests

### Migration Path
All functionality has been migrated to the **handsfree-proxy** worker, which:
- Has the active routes for `*.handsfree.tech/*`
- Uses simpler configuration (only TENANT_METADATA KV)
- Provides the same routing capabilities
- Is actively maintained and deployed

---

## For Developers

### If You Need to Make Routing Changes
**DO NOT** modify this worker. Instead:
1. Navigate to `platform/workers/handsfree-proxy/`
2. Make changes in the handsfree-proxy worker
3. Deploy the handsfree-proxy worker

### If You're Looking for Historical Reference
This worker is kept for:
- Historical reference only
- Understanding the previous architecture
- Potential rollback scenarios (though not recommended)

### To Completely Remove This Worker
If you want to completely remove this deprecated worker:

```bash
# Option 1: Move to archive folder
mkdir -p platform/workers/_archived
mv platform/workers/store-front platform/workers/_archived/store-front-deprecated

# Option 2: Delete entirely (after confirming no dependencies)
rm -rf platform/workers/store-front
```

---

## Configuration Comparison

### Store-Front (OLD - DEPRECATED)
```toml
# 4 KV Namespaces
- THEME_CACHE
- DOMAIN_METADATA
- ADMIN_SESSIONS
- TENANT_METADATA

# Routes: DISABLED
# routes = [
#   { pattern = "*.handsfree.tech/*", zone_name = "handsfree.tech" }
# ]
```

### Handsfree Proxy (NEW - CURRENT)
```toml
# 1 KV Namespace (simplified)
- TENANT_METADATA

# Routes: ACTIVE ✅
routes = [
  { pattern = "*.handsfree.tech/*", zone_name = "handsfree.tech" }
]
```

---

## Related Documentation

- [PROVISIONING_FLOW_DIAGRAM.md](../../PROVISIONING_FLOW_DIAGRAM.md) - Updated architecture documentation
- [Handsfree Proxy Worker](../handsfree-proxy/README.md) - Current routing worker
- [Architecture Components](../../PROVISIONING_FLOW_DIAGRAM.md#architecture-components) - See section 7 (Handsfree Proxy)

---

## Questions?

If you have questions about why this worker was deprecated or need help migrating code, please refer to:
1. The handsfree-proxy worker implementation
2. The PROVISIONING_FLOW_DIAGRAM.md documentation
3. Git history for migration commits

**Last Updated**: January 2026

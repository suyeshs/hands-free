# Handsfree Platform Workers

This directory contains all Cloudflare Workers for the Handsfree multi-tenant restaurant platform.

## Active Workers (✅ In Production)

### 1. handsfree-proxy ✅ **[PRIMARY ROUTING]**
**Status**: 🟢 ACTIVE - Current production routing worker
- **Purpose**: Main request routing proxy for all tenant subdomains (`*.handsfree.tech/*`)
- **Routes**: `*.handsfree.tech/*` ✅ ACTIVE
- **Location**: [handsfree-proxy/](./handsfree-proxy/)
- **Bindings**: TENANT_METADATA (KV)
- **Use This For**: All tenant subdomain routing and traffic management

### 2. domain-service ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Tenant provisioning, subdomain assignment, DNS management
- **Location**: [domain-service/](./domain-service/)
- **Key APIs**: `/api/subdomains/assign`, `/api/subdomains/provision-database`

### 3. restaurant ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Restaurant-specific business logic and APIs
- **Location**: [restaurant/](./restaurant/)
- **Features**: Menu management, customer data (encrypted), order processing
- **Bindings**: TENANT_METADATA, CUSTOMER_CACHE, TOKEN_MANAGER (service), per-tenant D1 databases

### 4. token-manager ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Centralized secret and token management
- **Location**: [token-manager/](./token-manager/)
- **Features**: AES-256-GCM encryption, 90-day rotation, access control, audit logging
- **Access**: Service binding only (internal)

### 5. orders ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Multi-tenant order processing with dispatch namespaces
- **Location**: [orders/](./orders/)
- **Features**: Order routing, Durable Objects for notifications, tenant isolation

### 6. theme-edge-worker ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Theme rendering and customization
- **Location**: [theme-edge-worker/](./theme-edge-worker/)

### 7. filesearch-sync ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Sync menu data to Google FileSearch (Vertex AI)
- **Location**: [filesearch-sync/](./filesearch-sync/)
- **Routes**: `filesearch-sync.handsfree.tech`

### 8. twilio-verify ✅
**Status**: 🟢 ACTIVE
- **Purpose**: SMS-based phone verification
- **Location**: [twilio-verify/](./twilio-verify/)
- **Features**: 6-digit codes, 10-minute expiry, rate limiting

### 9. whatsapp-verify ✅
**Status**: 🟢 ACTIVE
- **Purpose**: WhatsApp-based phone verification via Meta Business API
- **Location**: [whatsapp-verify/](./whatsapp-verify/)
- **Features**: Template messaging, rate limiting

### 10. auth ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Multitenant OAuth 2.0 authentication server
- **Location**: [auth/](./auth/)
- **Features**: OpenAuth-based, custom domain support, tenant isolation

### 11. google-places ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Google Places API integration for address verification
- **Location**: [google-places/](./google-places/)
- **Features**: Address verification, token management, POS integration

### 12. msg91-verify ✅
**Status**: 🟢 ACTIVE
- **Purpose**: SMS verification via MSG91 (India-focused)
- **Location**: [msg91-verify/](./msg91-verify/)
- **Features**: OTP sending, rate limiting

### 13. recipe-ai ✅
**Status**: 🟢 ACTIVE
- **Purpose**: AI-powered recipe and menu suggestions
- **Location**: [recipe-ai/](./recipe-ai/)
- **Features**: Recipe generation, menu optimization

### 14. restaurant-provisioning ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Restaurant tenant provisioning and setup
- **Location**: [restaurant-provisioning/](./restaurant-provisioning/)
- **Features**: Database provisioning, tenant worker deployment, durable objects coordination

### 15. tenant-management ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Tenant management and configuration
- **Location**: [tenant-management/](./tenant-management/)
- **Features**: Tenant CRUD operations, metadata management

### 16. tenant-router ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Advanced tenant routing with per-tenant workers
- **Location**: [tenant-router/](./tenant-router/)
- **Features**: Tenant-specific deployments, order notifications, sync engine
- **Sub-Workers**: [tenant-worker/](./tenant-router/tenant-worker/)

### 17. whatsapp-webhook ✅
**Status**: 🟢 ACTIVE
- **Purpose**: WhatsApp Business webhook handler
- **Location**: [whatsapp-webhook/](./whatsapp-webhook/)
- **Features**: Message handling, WebSocket integration, conversation rooms

### 18. testing-agent ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Testing and monitoring agent
- **Location**: [testing-agent/](./testing-agent/)
- **Features**: Automated testing, health checks

### 19. geolocation-service ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Geolocation and location-based services
- **Location**: [geolocation-service/](./geolocation-service/)
- **Features**: Location lookup, distance calculation

### 20. plugin-registry ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Plugin registry and marketplace
- **Location**: [plugin-registry/](./plugin-registry/)
- **Features**: Plugin discovery, version management, installation

### 21. tax-nomenclature ✅
**Status**: 🟢 ACTIVE
- **Purpose**: Tax calculation and nomenclature for different jurisdictions
- **Location**: [tax-nomenclature/](./tax-nomenclature/)
- **Features**: Tax rules engine, multi-jurisdiction support

---

## Deprecated Workers (⚠️ Do Not Use)

### ⚠️ store-front (DEPRECATED)
**Status**: ❌ DEPRECATED - Replaced by handsfree-proxy
- **Deprecated**: December 2024
- **Location**: [store-front/](./store-front/) ⚠️
- **Routes**: DISABLED (commented out in wrangler.toml)
- **Replaced By**: [handsfree-proxy/](./handsfree-proxy/)
- **Action Required**:
  - **DO NOT** make changes to this worker
  - **DO NOT** deploy this worker
  - Use [handsfree-proxy/](./handsfree-proxy/) instead
- **Documentation**: See [store-front/README-DEPRECATED.md](./store-front/README-DEPRECATED.md)

**To Archive**: Run `./ARCHIVE-store-front.sh` to move to `_archived/` directory

---

## Worker Communication Patterns

### HTTP Fetch (Worker-to-Worker)
- Handsfree Proxy → Restaurant Worker
- Restaurant Worker → FileSearch Sync

### Service Bindings (Internal)
- Any Worker → Token Manager
- Zero-latency local calls

### Dispatch Namespaces (Tenant Isolation)
- Orders Worker → Tenant-specific Workers

### Durable Objects (Stateful)
- Order notifications (WebSockets)
- Token rotation coordination

---

## Deployment

### Individual Worker Deployment
```bash
cd platform/workers/{worker-name}
wrangler deploy
```

### Production Deployment
```bash
cd platform/workers/{worker-name}
wrangler deploy --env production
```

### Deploy All Active Workers
```bash
cd platform/workers
./deploy-all.sh  # if script exists
```

---

## Development

### Local Development
```bash
cd platform/workers/{worker-name}
wrangler dev
```

### Testing
```bash
cd platform/workers/{worker-name}
npm test
```

---

## Configuration Files

Each worker has:
- `wrangler.toml` or `wrangler.jsonc` - Cloudflare Workers configuration
- `src/index.ts` - Main entry point
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

---

## Important Notes

### ⚠️ Deprecated Workers
The **store-front** worker is DEPRECATED and should NOT be used:
- Routes are disabled in wrangler.toml
- All traffic is handled by **handsfree-proxy**
- See [store-front/README-DEPRECATED.md](./store-front/README-DEPRECATED.md) for details

### 🔒 Internal-Only Workers
These workers are NOT publicly accessible:
- **token-manager** (service binding only)
- **restaurant** (accessed via proxy)
- **orders** (accessed via dispatch)
- **twilio-verify** (internal)
- **whatsapp-verify** (internal)

### 🌐 Public Routes
These workers handle public traffic:
- **handsfree-proxy** - `*.handsfree.tech/*` ✅ PRIMARY
- **domain-service** - Domain management APIs
- **filesearch-sync** - `filesearch-sync.handsfree.tech`
- **auth** - OAuth endpoints

---

## Documentation

For detailed architecture and integration patterns, see:
- [PROVISIONING_FLOW_DIAGRAM.md](../PROVISIONING_FLOW_DIAGRAM.md)
- [Architecture Components](../PROVISIONING_FLOW_DIAGRAM.md#architecture-components)
- [Service Dependencies](../PROVISIONING_FLOW_DIAGRAM.md#service-dependencies--integration)

---

## Quick Reference

| Worker | Status | Routes | Purpose |
|--------|--------|--------|---------|
| **handsfree-proxy** | ✅ ACTIVE | `*.handsfree.tech/*` | Main routing proxy (CURRENT) |
| store-front | ❌ DEPRECATED | DISABLED | Replaced by handsfree-proxy |
| domain-service | ✅ ACTIVE | API endpoints | Tenant provisioning |
| restaurant | ✅ ACTIVE | Internal | Restaurant APIs |
| token-manager | ✅ ACTIVE | Service binding | Secret management |
| orders | ✅ ACTIVE | Dispatch | Order processing |
| theme-edge-worker | ✅ ACTIVE | Internal | Theme rendering |
| filesearch-sync | ✅ ACTIVE | `filesearch-sync.handsfree.tech` | Menu AI indexing |
| twilio-verify | ✅ ACTIVE | Internal | SMS verification |
| whatsapp-verify | ✅ ACTIVE | Internal | WhatsApp verification |
| auth | ✅ ACTIVE | OAuth endpoints | Authentication server |
| google-places | ✅ ACTIVE | API endpoints | Address verification |
| msg91-verify | ✅ ACTIVE | Internal | SMS verification (India) |
| recipe-ai | ✅ ACTIVE | API endpoints | AI recipe generation |
| restaurant-provisioning | ✅ ACTIVE | API endpoints | Restaurant setup |
| tenant-management | ✅ ACTIVE | API endpoints | Tenant management |
| tenant-router | ✅ ACTIVE | Internal | Advanced tenant routing |
| whatsapp-webhook | ✅ ACTIVE | Webhook | WhatsApp Business |
| testing-agent | ✅ ACTIVE | Internal | Testing & monitoring |
| geolocation-service | ✅ ACTIVE | API endpoints | Location services |
| plugin-registry | ✅ ACTIVE | API endpoints | Plugin marketplace |
| tax-nomenclature | ✅ ACTIVE | API endpoints | Tax calculation |

---

**Last Updated**: January 2026

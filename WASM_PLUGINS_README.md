# WASM Plugin System - Feature Branch

**Branch**: `feature/wasm-plugins`
**Status**: ✅ Phase 1 Complete - Plugin SDK & Registry Architecture
**Started**: 2026-01-29

## Quick Links

- **Architecture Plan**: [/Users/stonepot-tech/.claude/plans/zany-cooking-koala.md](/.claude/plans/zany-cooking-koala.md)
- **Migration Guide**: [MIGRATION.md](./MIGRATION.md)
- **Plugin Types**: [src/types/plugin.ts](./src/types/plugin.ts)

## Overview

This branch implements a complete WASM plugin system for the HandsFree POS application, enabling:

✅ **Dynamic Business Logic**: Update features without app rebuilds
✅ **Client + Worker WASM**: Offline-capable client logic + scalable server logic
✅ **Per-Tenant Customization**: Each restaurant can have unique plugins
✅ **Smaller Base App**: 30-50% size reduction after migrating optional features

## Current Status

### ✅ Completed (Phase 0-1: Week 1)

#### Phase 0: Foundation
- [x] Created `feature/wasm-plugins` branch
- [x] Written comprehensive MIGRATION.md
- [x] Designed plugin manifest schema with TypeScript types
- [x] Defined two-tier registry architecture (global + per-tenant)
- [x] Established plugin lifecycle and permissions model

#### Phase 1: Plugin SDK & Registry
- [x] Created infrastructure setup guide (docs/infrastructure/plugin-registry-setup.md)
- [x] Implemented plugin resolution logic (src/services/plugins/pluginResolver.ts)
- [x] Created `@handsfree/plugin-sdk` npm package with:
  - Type-safe plugin definition helpers
  - Comprehensive TypeScript type definitions (20+ interfaces)
  - Helper utilities (version checking, checksums, logging, retry logic)
  - Manifest and permission validation
  - Support for client, worker, and hybrid plugins
- [x] Updated documentation to use `handsfree-tenant-router` worker name

### 🚧 In Progress (Phase 2: Worker Plugin System)

- [ ] Worker plugin loader implementation
- [ ] Worker plugin host bindings
- [ ] Plugin routing in Cloudflare Workers
- [ ] Example worker plugin (tax calculator)

### 📋 Upcoming (Phases 2-8: Weeks 4-16)

- Phase 2: Worker plugin system
- Phase 3: Client plugin system
- Phase 4: Cross-repo integration
- Phase 5: Developer SDK
- Phase 6: Bar plugin migration
- Phase 7: Multi-location plugin
- Phase 8: Public marketplace

## Key Architecture Decisions

### 1. Two-Tier Plugin Registry

**Global Registry** (Official plugins):
- Path: `/global/plugins/{plugin-id}/{version}/`
- Accessible to all tenants
- Examples: Bar Management, Multi-location Sync

**Per-Tenant Registry** (Custom plugins):
- Path: `/tenants/{tenant-id}/plugins/{plugin-id}/{version}/`
- Only visible to specific tenant
- Use cases: Enterprise integrations, white-label features, regional plugins

**Resolution Order**: Tenant override → Tenant custom → Global

### 2. Hybrid WASM Architecture

**Client WASM** (Browser):
- Offline-capable calculations
- Instant feedback (no network)
- Example: Drink pricing, input validation

**Worker WASM** (Cloudflare):
- Heavy data processing
- Database operations
- Example: Full closing reports, cross-location sync

**Optimal Split**:
- Simple calculations: Client
- Complex/data-heavy: Worker

### 3. Feature Migration Strategy

**Priority 1**: Bar Management (Weeks 11-12)
**Priority 2**: Multi-location Sync (Weeks 13-14)
**Priority 3**: Aggregator Integration (Week 15+)

## File Structure

```
feature/wasm-plugins/
├── MIGRATION.md                                # Breaking changes guide
├── WASM_PLUGINS_README.md                     # This file
├── src/
│   ├── types/
│   │   └── plugin.ts                          # ✅ Plugin type definitions
│   ├── services/
│   │   ├── plugins/
│   │   │   └── pluginResolver.ts              # ✅ Plugin resolution logic
│   │   └── pluginManager.ts                   # (Coming: Phase 3)
│   ├── lib/
│   │   └── pluginHost.ts                      # (Coming: Phase 3)
│   ├── hooks/
│   │   └── useWasm.ts                         # (Coming: Phase 3)
│   └── stores/
│       └── pluginStore.ts                     # (Coming: Phase 3)
├── packages/
│   └── plugin-sdk/                            # ✅ Plugin SDK npm package
│       ├── src/
│       │   ├── index.ts                       # Main entry point
│       │   ├── types.ts                       # Type definitions
│       │   ├── definePlugin.ts                # Plugin definition helpers
│       │   ├── helpers.ts                     # Utility functions
│       │   └── validators.ts                  # Validation logic
│       ├── package.json                       # NPM package config
│       ├── tsconfig.json                      # TypeScript config
│       └── README.md                          # SDK documentation
├── docs/
│   ├── infrastructure/
│   │   └── plugin-registry-setup.md           # ✅ R2 + KV setup guide
│   └── plugin-development.md                  # (Coming: Phase 5)
└── plugins/
    ├── examples/                              # (Coming: Phase 5)
    │   ├── hello-world/
    │   ├── bar-management/
    │   └── multi-location-sync/
    └── templates/                             # (Coming: Phase 5)
```

## Development Workflow

### Current Branch Strategy

**Main branch** (production):
- Bug fixes only
- Critical security patches
- No new features

**Feature branch** (this):
- All new development
- Plugin system implementation
- Cherry-pick critical fixes from main

### Testing Locally

```bash
# Switch to feature branch
git checkout feature/wasm-plugins

# Install dependencies
bun install

# Run in development mode
bun tauri:dev

# Run tests
bun test

# Build (with plugin system)
bun run build
```

### Environment Setup

Create `.env.local` with:
```bash
VITE_PLUGIN_REGISTRY_URL=https://handsfree-restaurant.suyesh.workers.dev/plugins
VITE_ENABLE_PLUGIN_SYSTEM=true
VITE_PLUGIN_DEBUG=true
```

## Key Technologies

- **WASM Compilation**: Rust → `wasm32-unknown-unknown`
- **Client WASM Runtime**: Browser WebAssembly API
- **Worker WASM Runtime**: Cloudflare Workers (native WASM support)
- **Plugin Storage**: IndexedDB (client cache)
- **Plugin Registry**: Cloudflare R2 + KV
- **Plugin SDK**: TypeScript + Rust

## Performance Targets

| Metric | Target | Current Baseline |
|--------|--------|------------------|
| Base app size | 20-25MB | ~40MB |
| Plugin load time | <2s | N/A (new) |
| WASM overhead | <10% | N/A (will benchmark) |
| Offline capability | 100% | Partial |

## Security Model

### Permission System

Plugins declare required permissions in manifest:
```json
{
  "requires_permissions": [
    "database.read.customers",
    "database.write.orders",
    "events.subscribe.order.completed"
  ]
}
```

### Sandboxing

- WASM runs in isolated memory space
- No direct system access
- All interactions via Plugin Host API
- Resource limits enforced

### Code Signing

- Plugins signed with developer certificates
- Signature verification before loading
- Trust levels: Official → Verified → Community

## Rollout Plan

### Week 11-12: Beta (Bar Plugin)

- Deploy to 5-10 friendly restaurants
- Test all bar features
- Gather feedback
- Fix issues

### Week 13-16: Gradual Rollout

- Week 13: 10% of tenants
- Week 14: 25% of tenants
- Week 15: 50% of tenants
- Week 16: 100% of tenants

### Week 17+: Deprecation

- Remove old code from main branch
- Plugin system becomes mandatory
- Archive old implementation

## Monitoring & Metrics

Track:
- Plugin install rates
- Load times
- Error rates
- User satisfaction
- App size reduction

## Support & Communication

### Internal

- **Slack**: #wasm-plugins
- **Stand-ups**: Daily updates
- **Demos**: Weekly progress demos

### External

- **Beta users**: Direct email support
- **Documentation**: Progressive updates
- **Release notes**: Detailed changelogs

## Troubleshooting

### Plugin fails to load

1. Check network connectivity
2. Verify R2 bucket permissions
3. Check IndexedDB quota
4. Review browser console

### WASM compilation errors

1. Ensure Rust toolchain installed: `rustup target add wasm32-unknown-unknown`
2. Check `wasm-bindgen` version compatibility
3. Review Cargo.toml dependencies

### Performance issues

1. Profile WASM execution
2. Minimize WASM-JS boundary crossings
3. Batch database operations
4. Use compression for large payloads

## Contributing

### For Core Team

1. Create feature branch off `feature/wasm-plugins`
2. Implement feature
3. Add tests
4. Create PR to `feature/wasm-plugins`
5. Merge after review

### For Plugin Developers (Phase 5+)

1. Clone plugin template
2. Implement plugin logic
3. Test locally
4. Publish to registry

## Roadmap Visualization

```
Week 1 ████████ Phase 0-1: Foundation + SDK ✅
Week 2 ████████ Phase 2: Worker System 🚧
Week 3 ████████ Phase 2-3: Worker + Client System
Week 4 ████████ Phase 3: Client System
Week 5 ████████ Phase 4: Integration
Week 6 ████████ Phase 4: Integration
Week 7 ████████ Phase 5: Developer SDK
Week 8 ████████ Phase 5: Developer SDK
Week 9 ████████ Phase 6: Bar Plugin (Beta)
Week 10 ███████ Phase 6: Bar Plugin (Beta)
Week 11 ███████ Phase 7: Multi-location (Beta)
Week 12 ███████ Phase 7: Multi-location (Beta)
Week 13 ███████ Phase 8: Marketplace
Week 14 ███████ Gradual Rollout
Week 15+ ██████ Production & Optimization
```

## Resources

- [Rust WASM Book](https://rustwasm.github.io/docs/book/)
- [wasm-bindgen Guide](https://rustwasm.github.io/docs/wasm-bindgen/)
- [Cloudflare Workers WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- [WebAssembly MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

---

**Last Updated**: 2026-01-29
**Next Milestone**: Implement worker plugin system (Phase 2)
**Completed This Session**:
- ✅ Plugin SDK npm package (@handsfree/plugin-sdk)
- ✅ Plugin resolution logic (tenant → global fallback)
- ✅ Infrastructure setup documentation
- ✅ Updated worker references to handsfree-tenant-router

**Questions?**: Ask in #wasm-plugins Slack channel

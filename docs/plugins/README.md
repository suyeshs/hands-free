# Plugin System Documentation

This directory contains documentation for the Guanix Restaurant plugin system, which enables extensibility through WASM plugins.

---

## 📚 Contents

### Getting Started
- **[Plugin System Quickstart](./PLUGIN_SYSTEM_QUICKSTART.md)** - Quick start guide
- **[Plugin Integration Guide](./PLUGIN_INTEGRATION_GUIDE.md)** - Integration walkthrough

### Plugin Manifest V2
- **[Migration Guide](./PLUGIN_MANIFEST_V2_MIGRATION.md)** - Upgrading to V2
- **[Quick Reference](./PLUGIN_MANIFEST_V2_QUICK_REFERENCE.md)** - V2 specification

### Implementation Details
- **[Plugin System Workflow](./PLUGIN_SYSTEM_WORKFLOW.md)** - System architecture
- **[Plugin System V2 Implementation](./PLUGIN_SYSTEM_V2_IMPLEMENTATION.md)** - Technical details
- **[Critical Fixes](./PLUGIN_SYSTEM_CRITICAL_FIXES.md)** - Known issues and fixes

### Deployment
- **[Plugin Registry Deployment](./PLUGIN_REGISTRY_DEPLOYMENT.md)** - Registry setup
- **[Plugin Update Mechanism](./PLUGIN_UPDATE_MECHANISM.md)** - Update system

---

## 🧩 Plugin System Overview

The plugin system allows extending Guanix Restaurant with custom functionality:

- **WASM Plugins** - Run securely in WebAssembly sandbox
- **Plugin Registry** - Centralized plugin distribution
- **Auto-updates** - Automatic plugin version management
- **Settings Management** - Dynamic plugin configuration

---

## 🚀 Quick Start

1. Read [Plugin System Quickstart](./PLUGIN_SYSTEM_QUICKSTART.md)
2. Review [Plugin Integration Guide](./PLUGIN_INTEGRATION_GUIDE.md)
3. Check [Plugin Manifest V2 Quick Reference](./PLUGIN_MANIFEST_V2_QUICK_REFERENCE.md)
4. Explore [Plugin System Workflow](./PLUGIN_SYSTEM_WORKFLOW.md) for architecture

---

## 🔧 Developer Resources

- **SDK**: See `packages/plugin-sdk/`
- **Examples**: See `docs/worker-integration-reference/plugin-system/`
- **Worker Reference**: See `docs/worker-integration-reference/`

---

**Last Updated**: 2026-02-05

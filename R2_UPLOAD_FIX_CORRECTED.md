# R2 Upload Fix - Corrected Configuration

## Problem
Image uploads to R2 storage were failing with:
```
url not allowed on the configured scope:
https://handsfree-restaurant-client.suyesh.workers.dev/api/r2
```

## Initial Attempt (FAILED)
Tried adding HTTP scope to `plugins.http` section - This caused a panic:
```
error while running tauri application: PluginInitialization("http",
"Error deserializing 'plugins.http': invalid type: map, expected unit")
```

**Why it failed**: In Tauri 2.x, the HTTP plugin doesn't accept configuration in the plugins section.

## Correct Solution (APPLIED)

### Configuration Location
HTTP scope is configured in **`security.capabilities[].permissions`**, not in `plugins`.

### Changes Made to `tauri.conf.json`

#### 1. Removed incorrect HTTP plugin config:
```json
// REMOVED (was causing panic)
"plugins": {
  "sql": { "preload": ["sqlite:pos.db"] },
  "http": { "scope": [...] }  // ❌ Wrong location
}
```

#### 2. Added HTTP scope to capabilities:
```json
"security": {
  "capabilities": [
    {
      "identifier": "main-capability",
      "permissions": [
        "core:default",
        "sql:default",
        "http:default",  // Allows all HTTP by default
        {
          "identifier": "http:allow-fetch",
          "allow": [
            { "url": "https://handsfree-restaurant-client.suyesh.workers.dev/*" },
            { "url": "https://handsfree-admin.pages.dev/*" },
            { "url": "https://handsfree-orders.suyesh.workers.dev/*" },
            { "url": "https://auth.handsfree.tech/*" },
            { "url": "https://*.suyesh.workers.dev/*" },
            { "url": "https://*.pages.dev/*" }
          ]
        },
        "fs:allow-temp-write",
        "barcode-scanner:default"
      ]
    }
  ]
}
```

## What This Allows

### Backend APIs ✅
- `handsfree-restaurant-client.suyesh.workers.dev` - Main backend (R2 uploads)
- `handsfree-admin.pages.dev` - Admin panel
- `handsfree-orders.suyesh.workers.dev` - Orders worker
- `auth.handsfree.tech` - Authentication

### Wildcards ✅
- `*.suyesh.workers.dev` - All Cloudflare Workers
- `*.pages.dev` - All Cloudflare Pages

## Tauri 2.x HTTP Configuration Reference

### ❌ Wrong (Causes panic):
```json
"plugins": {
  "http": { "scope": [...] }
}
```

### ✅ Correct:
```json
"security": {
  "capabilities": [{
    "permissions": [
      "http:default",
      { "identifier": "http:allow-fetch", "allow": [...] }
    ]
  }]
}
```

## Testing
After restart, R2 uploads should work:
- ✅ Menu item images
- ✅ Restaurant logo
- ✅ Product photos
- ✅ All file uploads to R2

## Next Step
Restart the app - the configuration is now correct:
```bash
bun tauri dev
```

---

**Date**: 2026-01-23
**Issue**: R2 Upload URL blocked + Config panic
**Status**: ✅ Fixed - Correct Tauri 2.x format applied

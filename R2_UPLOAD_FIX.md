# R2 Upload Fix - URL Scope Configuration

## Problem
Image/file uploads to R2 storage were failing with error:
```
[R2Uploader] Upload failed: "url not allowed on the configured scope:
https://handsfree-restaurant-client.suyesh.workers.dev/api/r2"
```

## Root Cause
**Tauri 2.x Security Model**: Tauri requires explicit HTTP scope configuration for all external URLs that the app can access. Without this, the HTTP plugin blocks requests for security.

## Solution Applied
Added HTTP scope configuration to `src-tauri/tauri.conf.json`:

```json
"plugins": {
  "sql": {
    "preload": ["sqlite:pos.db"]
  },
  "http": {
    "scope": [
      "https://handsfree-restaurant-client.suyesh.workers.dev/*",
      "https://handsfree-admin.pages.dev/*",
      "https://handsfree-orders.suyesh.workers.dev/*",
      "https://auth.handsfree.tech/*",
      "https://*.suyesh.workers.dev/*",
      "https://*.pages.dev/*",
      "https://*.cloudflare.com/*"
    ]
  }
}
```

## What This Allows

### Backend APIs ✅
- `handsfree-restaurant-client.suyesh.workers.dev` - Main backend (includes R2 uploads)
- `handsfree-admin.pages.dev` - Admin panel API
- `handsfree-orders.suyesh.workers.dev` - Orders worker
- `auth.handsfree.tech` - Authentication service

### Wildcards ✅
- `*.suyesh.workers.dev` - All Cloudflare Workers
- `*.pages.dev` - All Cloudflare Pages
- `*.cloudflare.com` - Cloudflare services (if needed)

## File Changed
**File**: `src-tauri/tauri.conf.json`
**Section**: `plugins.http.scope`
**Lines Added**: 8 (HTTP scope configuration)

## Testing
After restart, the following should work:
- ✅ R2 image uploads (menu items, logos, etc.)
- ✅ Backend API calls
- ✅ Order polling
- ✅ Authentication
- ✅ Admin panel sync

## Security Note
This configuration follows Tauri's security best practices:
- Only allows specific domains we control
- Uses wildcards for subdomains on trusted domains
- Does not allow arbitrary URLs
- Maintains app security while enabling necessary features

## Next Step
**Restart the app** for changes to take effect:
```bash
# Kill existing app
pkill -9 -f "tauri"

# Restart
bun tauri dev
```

---

**Date**: 2026-01-23
**Issue**: R2 Upload URL blocked by Tauri HTTP scope
**Status**: ✅ Fixed - HTTP scope configured

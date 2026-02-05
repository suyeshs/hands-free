# Complete Reset Guide

## The Problem: Persistent Tenant Data

Even after deleting the main application directory, tenant activation data persists in WebView storage, causing the app to show the Hub page instead of the Tenant Activation screen.

## Root Cause

Tauri WebView stores localStorage/sessionStorage in multiple locations:
1. **Main App Data**: `~/Library/Application Support/com.stonepot-tech.handsfree-pos/`
2. **WebView Storage**: `~/Library/WebKit/` (various subdirectories)
3. **Database Files**: Can be in multiple locations with similar names

## Complete Reset Procedure

### Method 1: Terminal Script (Recommended)

Run this script to delete ALL data:

```bash
#!/bin/bash
echo "🔥 COMPLETE RESET..."

# 1. Kill ALL processes
pkill -9 -f "tauri" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null
pkill -9 -f "bun" 2>/dev/null
pkill -9 -f "cargo" 2>/dev/null
pkill -9 -f "restaurant" 2>/dev/null
lsof -ti:1420 | xargs kill -9 2>/dev/null
sleep 2

# 2. Delete ALL application data
rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos*
rm -rf ~/Library/Caches/com.stonepot-tech.handsfree-pos*
rm -rf ~/Library/WebKit/com.stonepot-tech.handsfree-pos*
rm -rf ~/Library/Preferences/com.stonepot-tech.handsfree-pos*
rm -rf ~/Library/Saved\ Application\ State/com.stonepot-tech.handsfree-pos*

# 3. Delete WebView storage (CRITICAL - this is where localStorage persists!)
rm -rf ~/Library/WebKit/com.apple.WebKit.WebContent/
rm -rf ~/Library/Containers/com.stonepot-tech.handsfree-pos*

# 4. Clear any Tauri state
rm -rf ~/.tauri/
rm -rf ~/.local/share/com.stonepot-tech.handsfree-pos/

# 5. Find and delete any stray database files
find ~/Library/Application\ Support -name "*handsfree-pos*.db" -delete 2>/dev/null

echo "✅ COMPLETE!"
```

Save this as `/tmp/complete_reset.sh`, make it executable, and run:

```bash
chmod +x /tmp/complete_reset.sh
/tmp/complete_reset.sh
```

### Method 2: In-App Keyboard Shortcut

**Press: Cmd + Shift + Delete**

This triggers the force reset logic in `src/main.tsx`:
- Clears localStorage
- Clears sessionStorage
- Deletes IndexedDB databases
- Reloads the app

**NOTE**: This only works if the app is running and not frozen.

### Method 3: Console Command

If the console is accessible, paste this:

```javascript
sessionStorage.setItem('FORCE_RESET', 'true');
location.reload();
```

## Verification

After reset, verify all data is cleared:

```bash
# 1. Check for remaining app directories
ls -la ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos* 2>&1

# 2. Check for database files
find ~/Library -name "*handsfree-pos*.db" 2>/dev/null

# 3. Check WebView storage
ls -la ~/Library/WebKit/ | grep handsfree

# Expected output: "No such file or directory" for all commands
```

## Starting Fresh

After complete reset:

```bash
bun tauri dev
```

You should see:
- ✅ **Tenant Activation screen** (not Hub page)
- ✅ No pre-filled restaurant data
- ✅ Fresh setup wizard
- ✅ No existing tenant

## Common Issues

### Issue: Still seeing Hub page after reset

**Cause**: WebView storage not cleared

**Solution**:
```bash
rm -rf ~/Library/WebKit/com.apple.WebKit.WebContent/
rm -rf ~/Library/WebKit/*/com.stonepot-tech.handsfree-pos*
```

### Issue: Database files persist

**Cause**: Database in unexpected location

**Solution**:
```bash
find ~/Library -name "*handsfree*" -o -name "*stonepot*" 2>/dev/null | grep -v "Google\|Adobe\|node_modules"
# Delete any suspicious files found
```

### Issue: App shows old data after rebuild

**Cause**: Tauri cache not cleared

**Solution**:
```bash
rm -rf src-tauri/target/
cargo clean
bun tauri dev
```

## Persistent Data Locations (macOS)

The app stores data in these locations:

| Location | Purpose | Reset Priority |
|----------|---------|----------------|
| `~/Library/Application Support/com.stonepot-tech.handsfree-pos/` | Main database (pos.db) | **CRITICAL** |
| `~/Library/WebKit/com.apple.WebKit.WebContent/` | WebView localStorage/sessionStorage | **CRITICAL** |
| `~/Library/WebKit/*/handsfree-pos*` | WebView caches | **HIGH** |
| `~/Library/Caches/com.stonepot-tech.handsfree-pos*` | App caches | MEDIUM |
| `~/Library/Preferences/com.stonepot-tech.handsfree-pos*` | App preferences | LOW |

## Developer Notes

### Why Data Persists

Tauri uses the system WebView (WKWebView on macOS), which stores data separately from the app bundle:

1. **localStorage/sessionStorage**: Stored in WebView data directory, NOT in app data directory
2. **IndexedDB**: Stored in WebView data directory
3. **Cookies**: Stored in WebView cookie storage
4. **SQLite Database**: Stored in app data directory

### Zustand Persistence

The app uses Zustand with `persist` middleware, which stores data in localStorage:

```typescript
// These stores persist in localStorage:
- tenant-storage (tenant activation data)
- auth-storage (authentication data)
- setup-wizard-storage (setup completion status)
- restaurant-settings-storage (restaurant settings)
```

To truly reset, you MUST clear WebView storage, not just the app directory.

## Automated Reset Script Location

The complete reset script is stored at:
- **Location**: `/tmp/complete_reset.sh`
- **Created by**: `nuclear_reset.sh` (see bash history)

To regenerate:

```bash
cat > /tmp/complete_reset.sh << 'EOF'
#!/bin/bash
# (paste the complete reset script from Method 1 above)
EOF
chmod +x /tmp/complete_reset.sh
```

## Quick Reference

**One-line complete reset:**

```bash
pkill -9 -f "tauri"; pkill -9 -f "vite"; rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos* ~/Library/WebKit/com.apple.WebKit.WebContent/ ~/Library/Caches/com.stonepot-tech.handsfree-pos*; echo "✅ Reset complete"
```

---

**Last Updated**: 2026-01-23
**Platform**: macOS
**Tauri Version**: 2.x
**App Bundle ID**: `com.stonepot-tech.handsfree-pos`

# Diagnostic Instructions

## 🔍 Finding Out Why You're Seeing the Hub Page

The app is currently running. Here's how to see what's in localStorage that's causing the hub page to appear:

## Method 1: Keyboard Shortcut (Easiest)

**Press: `Cmd + Shift + D`** (or `Ctrl + Shift + D` on Windows/Linux)

This will toggle the diagnostic overlay and reload the app.

You'll see:
- ✅ **CLEAN STATE** (green) = localStorage is empty, you should see Tenant Activation
- ⚠️ **DATA FOUND** (red) = localStorage has data, this is why you see the Hub

If you see **TENANT DATA DETECTED**, that's the problem! The `tenant-storage` key in localStorage is making the app think it's already activated.

## Method 2: Navigate to Diagnostic URL

Change the URL to:
```
http://localhost:1420/#/diagnostic
```

Or if using a different port, just add `/#/diagnostic` to the end of the URL.

## What the Diagnostic Page Shows

The diagnostic overlay displays:

1. **Storage Status Summary**
   - Green box = Clean state (empty localStorage)
   - Red box = Data found (shows why you're seeing hub)

2. **Tenant Data Detection**
   - If tenant data exists, it shows:
     - `isActivated: true/false`
     - `tenantId`
     - `companyName`
     - `apiUrl`
   - ⚠️ This is why the Hub page appears instead of Tenant Activation!

3. **Full Storage Contents**
   - All localStorage keys and values
   - All sessionStorage keys and values
   - Environment variables
   - Current URL and user agent

## How to Clear Storage from Diagnostic Page

Click the big red button: **🔥 CLEAR STORAGE & RELOAD**

This will:
1. Clear all localStorage
2. Clear all sessionStorage
3. Reload the app

After clearing, you should see the Tenant Activation screen (not Hub).

## Alternative: Nuclear Reset Keyboard Shortcut

**Press: `Cmd + Shift + Backspace`** (or `Ctrl + Shift + Delete`)

This will:
1. Clear all localStorage
2. Clear all sessionStorage
3. Reload the app immediately

## Understanding the Problem

The issue is that **Tauri WebView stores localStorage separately from the app database**.

When we delete the database at:
```
~/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db
```

The localStorage (which is stored in WebKit's storage) survives! It's stored at:
```
~/Library/WebKit/com.apple.WebKit.WebContent/
```

The `tenant-storage` localStorage key contains:
```json
{
  "state": {
    "isActivated": true,
    "tenant": {
      "tenantId": "...",
      "companyName": "..."
    }
  }
}
```

When the app starts, it checks `isActivated` from this localStorage key. If `true`, it shows the Hub page. If `false` or missing, it shows Tenant Activation.

## Verification Steps

### Step 1: Open Diagnostic Overlay
Press `Cmd + Shift + D` to see what's in localStorage.

### Step 2: Check Storage Status
- **Green box** = Good! Empty storage, you should see Tenant Activation
- **Red box with "TENANT DATA DETECTED"** = Problem! This is why you see Hub

### Step 3: If Tenant Data Exists
Click **🔥 CLEAR STORAGE & RELOAD** button.

### Step 4: Verify Clean State
After reload, press `Cmd + Shift + D` again to verify:
- You should see: **✅ CLEAN STATE** (green box)
- localStorage should be: **EMPTY**

### Step 5: Normal App Flow
Press `Cmd + Shift + D` again to hide diagnostics and use the app normally.
You should now see the Tenant Activation screen.

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Cmd + Shift + D` | Toggle diagnostic overlay |
| `Cmd + Shift + Backspace` | Nuclear reset (clear all storage & reload) |
| `Cmd + Option + I` | Open DevTools console (for seeing console logs) |

## Console Logs to Look For

If you open DevTools console (`Cmd + Option + I`), look for:

```
╔════════════════════════════════════════════════════════════╗
║              🔍 STARTUP DIAGNOSTICS                       ║
╚════════════════════════════════════════════════════════════╝

📦 localStorage contents:
  ✅ localStorage is EMPTY (clean state)
```

Or if there's data:

```
📦 localStorage contents:
  ⚠️  localStorage has 4 items:
    - tenant-storage: {...}
      ⚠️  TENANT DATA FOUND IN LOCALSTORAGE!
      Tenant state: { isActivated: true, tenantId: '...', ... }
```

## Next Steps

1. **Right now**: Press `Cmd + Shift + D` to see the diagnostic overlay
2. **If you see tenant data**: Click the clear button
3. **Verify**: Press `Cmd + Shift + D` again to confirm clean state
4. **Continue**: Press `Cmd + Shift + D` to hide diagnostics and proceed with activation

---

**Created**: 2026-01-23
**App**: Handsfree POS
**Platform**: macOS (Tauri 2.x)

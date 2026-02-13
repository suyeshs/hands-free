# Complete System Reset Guide

This guide provides multiple ways to reset your Guanix Restaurant POS system and start completely fresh.

## ⚠️ Warning

**All reset methods will permanently delete data. This action cannot be undone.**

---

## Option 1: Complete Reset UI (Recommended)

The easiest and safest way with visual progress tracking.

### Steps:

1. **Navigate to the Complete Reset page:**
   ```
   /#/complete-reset
   ```

2. **Read the warnings carefully**

3. **Click "Delete Everything"**

4. **Type "DELETE EVERYTHING" to confirm**

5. **Wait for the reset to complete** (progress is shown)

6. **App will automatically reload** and take you to setup

### What it deletes:
- ✅ Database files (pos-dev.db, guanix.db)
- ✅ All menu items, categories, and prices
- ✅ All staff members and PINs
- ✅ All orders and sales history
- ✅ Restaurant settings and configurations
- ✅ Floor plans and tables
- ✅ Inventory data and suppliers
- ✅ Tenant activation and cloud sync
- ✅ All browser storage (localStorage, sessionStorage, IndexedDB)

---

## Option 2: Simple Storage Reset

Quick reset that clears storage but preserves database file.

### Steps:

1. **Navigate to:**
   ```
   /#/reset
   ```

2. **Page will automatically:**
   - Clear localStorage
   - Clear sessionStorage
   - Reload the app

**Note:** This doesn't delete the database file, only browser storage.

---

## Option 3: Reset Setup Page

UI for resetting stores and localStorage (but not database files).

### Steps:

1. **Navigate to:**
   ```
   /#/reset-setup
   ```

2. **Click "Reset All"**

3. **Confirm the action**

4. **App will reload**

---

## Option 4: Manual Database File Deletion

For when you want complete control.

### macOS:

```bash
# 1. Quit the app first
# 2. Open Terminal and run:

cd ~/Library/Application\ Support/com.handsfree.pos/
ls -la                    # See what's there
rm pos-dev.db*           # Delete dev database
rm guanix.db*            # Delete prod database

# 3. Clear browser storage:
# Navigate to /#/reset in the app
```

### Windows:

```cmd
# 1. Quit the app first
# 2. Open Command Prompt and run:

cd %APPDATA%\com.handsfree.pos
dir                       # See what's there
del pos-dev.db*          # Delete dev database
del guanix.db*           # Delete prod database

# 3. Clear browser storage:
# Navigate to /#/reset in the app
```

### Linux:

```bash
# 1. Quit the app first
# 2. Open Terminal and run:

cd ~/.local/share/com.handsfree.pos/
ls -la                    # See what's there
rm pos-dev.db*           # Delete dev database
rm guanix.db*            # Delete prod database

# 3. Clear browser storage:
# Navigate to /#/reset in the app
```

---

## Option 5: Browser Console Script

For developers who want quick access.

### Steps:

1. **Open DevTools** (F12 or Cmd+Option+I on Mac)

2. **Go to Console tab**

3. **Copy and paste:**
   ```javascript
   window.location.href = '/#/complete-reset';
   ```

4. **Press Enter**

This takes you to the Complete Reset UI.

---

## Option 6: Programmatic Reset (Dev Mode Only)

For developers during development.

### Quick Dev Reset (bypasses confirmation):

```javascript
// Open DevTools Console
const { quickResetDev } = await import('./src/lib/resetEverything.ts');
await quickResetDev();
```

**⚠️ Warning:** This bypasses all confirmations and immediately deletes everything. Only works in development mode.

---

## After Reset

Once reset is complete, you'll need to:

1. ✅ **Activate the device** with a new activation code
2. ✅ **Complete setup wizard** with restaurant details
3. ✅ **Import or create menu** items and categories
4. ✅ **Add staff members** and assign PINs
5. ✅ **Configure floor plan** if using dine-in
6. ✅ **Set up printers** for receipts and KOT

---

## Troubleshooting

### Reset fails with errors

1. **Close the app completely**
2. **Manually delete database files** (see Option 4)
3. **Clear browser cache:**
   - Chrome/Edge: Settings → Privacy → Clear browsing data
   - Firefox: Settings → Privacy → Clear Data
4. **Restart the app**

### App won't start after reset

1. **Check if database files are deleted:**
   - macOS: `~/Library/Application Support/com.handsfree.pos/`
   - Windows: `%APPDATA%\com.handsfree.pos`
   - Linux: `~/.local/share/com.handsfree.pos/`

2. **If files still exist, delete manually**

3. **Clear browser storage:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   window.location.reload();
   ```

### Need help?

- Check console logs (F12 → Console)
- Look for error messages
- File an issue on GitHub

---

## Quick Reference

| Method | Database | Stores | Storage | UI | Confirmation |
|--------|----------|--------|---------|-----|--------------|
| Complete Reset UI | ✅ | ✅ | ✅ | ✅ | Double |
| `/#/reset` | ❌ | ❌ | ✅ | ❌ | None |
| Reset Setup | ❌ | ✅ | ✅ | ✅ | Single |
| Manual Delete | ✅ | ❌ | ❌ | ❌ | Manual |
| Console Script | ✅ | ✅ | ✅ | ❌ | Double |
| Dev Quick Reset | ✅ | ✅ | ✅ | ❌ | None |

---

## Files Reference

- **Reset Library:** `src/lib/resetEverything.ts`
- **Reset UI Page:** `src/pages/CompleteReset.tsx`
- **Console Script:** `reset-console-script.js`
- **This Guide:** `RESET_GUIDE.md`

---

**Last Updated:** 2024

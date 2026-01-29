# Online Presence Settings - Diagnostic Guide

## Implementation Status: ✅ COMPLETE

All code has been successfully implemented and verified:

### Files Created:
1. ✅ `src/lib/themePresets.ts` - 16 theme presets across 6 categories
2. ✅ `src/lib/urlGenerator.ts` - URL generation helpers
3. ✅ `src/pages-v2/OnlinePresenceSettings.tsx` - Main settings component

### Files Modified:
1. ✅ `src/stores/restaurantSettingsStore.ts` - Added onlinePresence field
2. ✅ `src/pages-v2/SettingsPage.tsx` - Registered Online Presence setting in Business Setup category

### Code Verification:
- ✅ Business Setup category has `priority: true` (line 357)
- ✅ Online Presence setting registered (lines 366-372)
- ✅ All imports are correct
- ✅ No TypeScript compilation errors
- ✅ Vite dev server running successfully

## If Online Presence Settings Are Not Visible:

### Step 1: Hard Refresh the Browser/App
The most common issue is browser cache. Try these in order:

1. **Hard Refresh**: Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows/Linux)
2. **Clear Browser Cache**: Open Dev Tools (F12) → Application → Clear Storage → Clear site data
3. **Restart Tauri App**: Close the app completely and reopen

### Step 2: Navigate to Settings
1. Open the app
2. Click on **Settings** from the main menu/hub
3. Look for the **Business Setup** category card (orange colored)
4. Click on **Business Setup**
5. You should see two settings:
   - Restaurant Information
   - **Online Presence** ← This is the new setting

### Step 3: Check Browser Console for Errors
1. Open Developer Tools: Press `F12` or `Cmd+Option+I` (Mac)
2. Go to the **Console** tab
3. Look for any red error messages
4. Look specifically for errors mentioning:
   - `OnlinePresenceSettings`
   - `themePresets`
   - `urlGenerator`
   - Import errors
   - Module errors

### Step 4: Verify Files Exist
Run these commands in terminal:

```bash
# Check if all files exist
ls -la src/lib/themePresets.ts
ls -la src/lib/urlGenerator.ts
ls -la src/pages-v2/OnlinePresenceSettings.tsx

# Check if imports are correct
grep "OnlinePresenceSettings" src/pages-v2/SettingsPage.tsx
```

### Step 5: Check Network Tab
1. Open Developer Tools: `F12`
2. Go to **Network** tab
3. Refresh the page
4. Look for failed requests (red status codes)
5. Check if `OnlinePresenceSettings.tsx` loads successfully

### Step 6: Verify Settings Page Structure
Open the diagnostic page in your browser:
```
http://localhost:1420/test-settings-structure.html
```

This will show you exactly which files are loading correctly.

## Expected Behavior:

### Main Settings Page:
- Should show 6-7 category cards
- **Business Setup** should be one of them (orange colored)
- **Business Setup** has a "Popular" badge because `priority: true`

### Business Setup Category Detail:
- Shows 2 settings:
  1. Restaurant Information
  2. **Online Presence** (with Globe icon 🌐)

### Online Presence Settings Page:
When you click on Online Presence, you should see:
- ✅ Status Card (shows online/offline status)
- ✅ URL Display (subdomain.handsfree.tech or localhost)
- ✅ Visit Site button
- ✅ Theme Selection (16 themes with category filters)
- ✅ Theme Customization (colors, background, fonts, logo)
- ✅ Live Preview (iframe of customer menu)
- ✅ How It Works section
- ✅ Save button

## Common Issues & Solutions:

### Issue 1: "Business Setup category not showing"
**Cause**: Browser cache issue
**Solution**: Hard refresh with `Cmd+Shift+R`

### Issue 2: "Online Presence setting not in list"
**Cause**: Component import error or cache
**Solution**:
1. Check browser console for errors
2. Restart dev server
3. Clear all caches

### Issue 3: "Page loads but content is blank"
**Cause**: Missing subdomain or tenant not provisioned
**Solution**: The page should still load with a warning message explaining subdomain is not set

### Issue 4: "Import errors in console"
**Cause**: Module resolution issue
**Solution**:
```bash
# Clear all caches and rebuild
rm -rf node_modules/.vite
rm -rf src-tauri/target/debug
pkill -f "tauri dev"
bun install
bun run tauri dev
```

## Testing Checklist:

Once you can see the Online Presence settings page, test these features:

- [ ] Theme Selection
  - [ ] Click different theme presets
  - [ ] Verify colors update in customization section
  - [ ] Try category filters (All, Indian, Pizza, Cafe, etc.)

- [ ] Theme Customization
  - [ ] Change primary color using color picker
  - [ ] Change secondary color
  - [ ] Upload a logo image
  - [ ] Select different font
  - [ ] Adjust background settings
  - [ ] Modify card style settings

- [ ] URL & Preview
  - [ ] Copy URL to clipboard
  - [ ] Click Visit Site button
  - [ ] Toggle desktop/mobile preview
  - [ ] Verify iframe loads

- [ ] Persistence
  - [ ] Make changes and click Save
  - [ ] Refresh page
  - [ ] Verify settings persisted

## Current Tenant Info:
- Tenant ID: `airarang-8131`
- Owner: Suyesh
- Database: `/Users/stonepot-tech/Library/Application Support/com.stonepot-tech.handsfree-pos/pos.db`

## Dev Server Status:
✅ Running on port 1420
✅ Vite compiled successfully
✅ No compilation errors

## Next Steps:

1. Try the diagnostic steps above
2. Check browser console for specific errors
3. Verify you're looking at the correct Settings page location
4. Take a screenshot if the issue persists and share what you see

---

**Note**: If you've verified all the above and still don't see the Online Presence settings, please share:
1. Screenshot of the Settings page (main view with category cards)
2. Screenshot of Business Setup category detail (if visible)
3. Any error messages from the browser console
4. The exact location/path you're looking at

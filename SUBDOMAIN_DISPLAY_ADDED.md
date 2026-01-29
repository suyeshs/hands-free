# Subdomain Display Feature

## Summary

Added subdomain display to the provisioning modal so users can see their restaurant's online URL immediately after provisioning completes.

## Changes Made

### 1. StoreCreationModal.tsx

**Added State:**
```typescript
const [subdomain, setSubdomain] = useState<string | null>(null);
```

**Extract Subdomain from API:**
```typescript
// After receiving API result
const sub = result.subdomain || result.tenantId;
if (sub) {
  console.log('[StoreCreationModal] Subdomain:', sub);
  setSubdomain(sub);
}
```

**Display Subdomain in UI:**
```tsx
{/* Subdomain Display */}
{isCompleted && subdomain && (
  <div className="mb-6">
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 text-center">
      Your Restaurant URL
    </p>
    <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl text-center">
      <p className="text-lg font-mono font-bold text-purple-400 break-all">
        {subdomain}.handsfree-admin.pages.dev
      </p>
    </div>
    <p className="text-xs text-muted-foreground/60 mt-2 text-center">
      Your online ordering and management dashboard
    </p>
  </div>
)}
```

**Added Logging:**
```typescript
console.log('[StoreCreationModal] Full API result:', JSON.stringify(result, null, 2));
```

**Updated Debug Info:**
```typescript
<div>subdomain: {subdomain || 'null'}</div>
```

## UI Layout

After provisioning completes, users will see:

```
┌─────────────────────────────────────┐
│     ACTIVATION CODE                 │
│   ┌─────────────────────────────┐  │
│   │     ABC-123-XYZ             │  │
│   └─────────────────────────────┘  │
│   This code has been saved          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     YOUR RESTAURANT URL             │
│   ┌─────────────────────────────┐  │
│   │ cozy-cafe-1234.handsfree-   │  │
│   │    admin.pages.dev          │  │
│   └─────────────────────────────┘  │
│   Your online ordering dashboard    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      Go to Dashboard Button         │
└─────────────────────────────────────┘
```

## API Response Expected

The provisioning API (`POST /api/tenants`) should return:

```json
{
  "success": true,
  "activationCode": "ABC-123-XYZ",
  "subdomain": "cozy-cafe-1234",
  "tenantId": "cozy-cafe-1234"
}
```

**Fallback Logic:**
- If `result.subdomain` exists → use it
- Otherwise → use `result.tenantId` as subdomain

## Visual Design

- **Color**: Purple gradient background (from-purple-500/10 to-blue-500/10)
- **Border**: Purple border (border-purple-500/30)
- **Text**: Purple-400 color for subdomain
- **Font**: Monospace font for URL
- **Responsive**: `break-all` class to handle long subdomains

## Testing

To test the subdomain display:

```bash
# Clear data and restart
rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos/
bun tauri dev

# Complete setup wizard
# → Provisioning modal appears
# → After provisioning completes, you should see:
#   1. Activation code
#   2. Subdomain URL  ← NEW!
#   3. "Go to Dashboard" button
```

**Check Console Logs:**
```
[StoreCreationModal] Full API result: { ... }
[StoreCreationModal] Subdomain: cozy-cafe-1234
```

**Check Debug Info Section:**
```
Debug Info:
  isCompleted: true
  activationCode: ABC-123-XYZ
  subdomain: cozy-cafe-1234  ← Should show subdomain!
  buttonShouldShow: true
```

## Files Changed

- ✅ `src/components/StoreCreationModal.tsx` - Added subdomain state, extraction, and display

## Benefits

1. **Immediate Visibility** - Users see their restaurant URL right away
2. **Copy-Paste Ready** - URL is displayed in monospace font for easy copying
3. **No Extra Steps** - Information shown during setup, no need to navigate elsewhere
4. **Clear Branding** - Shows the full handsfree-admin.pages.dev URL
5. **Debug Friendly** - Added to debug info for troubleshooting

## Future Enhancements

Potential improvements:

1. **Copy Button** - Add a copy button next to the subdomain (like activation code)
2. **Link** - Make the URL clickable to open in browser
3. **QR Code** - Generate QR code for the URL
4. **Custom Domain Support** - Show custom domain if configured
5. **Email Link** - Option to email the URL to owner
6. **Test Button** - "Test Your Site" button to verify deployment

## Notes

- The subdomain is extracted from the API response but not currently stored in tenantStore
- If you need to persist the subdomain, update the `handleProvisioningComplete` in SystemCheckScreen to save it to tenantStore
- The URL format assumes `handsfree-admin.pages.dev` - update if domain changes

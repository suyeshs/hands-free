# Dashboard Embedding Troubleshooting

## Issue: Dashboards Opening in External Browser

If clicking "Open Dashboard" opens the partner portal in Chrome/Safari instead of an embedded webview:

### Possible Causes:

1. **Tauri Security Policy**: Tauri v2 may block external URLs by default
2. **Capabilities Missing**: The dashboard windows need proper permissions
3. **Navigation Handler**: External navigation might need explicit handling

### Solutions:

#### Solution 1: Check Console for Errors
Open the Tauri app dev tools (Cmd+Option+I on Mac) and check for errors when clicking "Open Dashboard".

Common errors:
```
Error creating webview window: [permission denied]
Failed to build window: [...]
```

#### Solution 2: Verify Capabilities Are Loaded
Check that `src-tauri/capabilities/dashboards.json` exists and contains:
```json
{
  "identifier": "dashboards",
  "windows": ["swiggy-dashboard", "zomato-dashboard"],
  "permissions": [...]
}
```

#### Solution 3: Add Navigation Handler (if needed)
If Tauri is blocking external navigation, we may need to add a navigation handler in `dashboard_manager.rs`:

```rust
.on_navigation(|url| {
    // Allow navigation to partner domains
    let allowed_domains = ["partner.swiggy.com", "www.zomato.com"];
    allowed_domains.iter().any(|domain| url.host_str() == Some(domain))
})
```

#### Solution 4: Alternative - Use System Webview
If embedded webviews don't work, we can modify the approach to:
1. Open in system default browser
2. Use browser extension for order extraction
3. WebSocket communication back to the app

### Testing Steps:

1. **Kill all Tauri processes**:
   ```bash
   pkill -f restaurant-pos-ai
   ```

2. **Rebuild with verbose output**:
   ```bash
   bun tauri dev
   ```

3. **Click "Open Dashboard"** and watch console output

4. **Check if window appears** in system task manager/Activity Monitor

### Current Configuration:

- ✅ Capabilities file created: `src-tauri/capabilities/dashboards.json`
- ✅ Window labels configured: `swiggy-dashboard`, `zomato-dashboard`
- ✅ Permissions added: window creation, webview, events
- ✅ Global Tauri API enabled

### Next Steps if Still Not Working:

If dashboards continue opening in external browser, we have two options:

**Option A: Accept Browser-Based Workflow**
- Keep "Open Dashboard" buttons as links to browser
- Use browser extension for order extraction
- Desktop app acts as order manager/display only

**Option B: Debug Webview Creation**
- Add logging to `open_dashboard()` function
- Check if `WebviewWindowBuilder::build()` returns error
- Try creating window with local URL first, then navigate

### Debug Commands:

```bash
# Check if Tauri is creating windows
ps aux | grep restaurant-pos-ai

# Watch for error logs
tail -f /path/to/tauri/logs

# Test window creation manually
# (Add temporary button that creates simple local webview)
```

### Related Files:
- `src-tauri/src/dashboard_manager.rs:77-119` - Window creation logic
- `src-tauri/capabilities/dashboards.json` - Permissions
- `src/components/aggregator/DashboardManager.tsx:83-105` - Frontend buttons

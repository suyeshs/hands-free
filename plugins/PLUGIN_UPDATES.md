# Plugin Updates - February 3, 2026

## Summary of Changes

### 1. New Plugin: reCamera Integration v1.0.0
**Status**: ✅ Ready to upload

**Features**:
- Automatic camera discovery on local network
- Live video feed viewer
- Seat occupancy tracking with AI
- Edge AI processing
- WiFi configuration

**Files**:
- `plugins/recamera/manifest.json`
- `plugins/sample-plugins/recamera.json`
- `plugins/recamera/README.md`

**Upload Command**:
```bash
./plugins/upload-plugin-manifest.sh recamera
```

---

### 2. Multi-Location Plugin Consolidation
**Status**: ✅ Unified

**Problem**: Two conflicting versions existed
- `multi-location-sync` v1.8.0 (Enterprise features)
- `multi-location` v2.0.0 (Simplified)

**Solution**: Created unified v2.1.0 combining best features

**New Version**: `multi-location` v2.1.0
**Includes**:
- Real-time sales dashboard (from v2.0.0)
- Master menu management (from v1.8.0)
- Menu overrides per location (from v1.8.0)
- Staff transfers (from v1.8.0)
- Inventory sync (from v1.8.0)
- Location-specific pricing (from v1.8.0)

**Deprecated**:
- `multi-location-sync-v1.8.0-deprecated.json` (archived)
- `multi-location-v2.0.0-deprecated.json` (archived)

**Migration**: Automatic from both v1.8.0 and v2.0.0

---

### 3. Checksums Updated
All plugin manifests now have correct SHA-256 checksums:
- ✅ reCamera v1.0.0
- ✅ Multi-Location v2.1.0
- ✅ Vision AI v1.0.0 (existing)

---

## Plugin Architecture

### Hybrid Plugins (Main App + Manifest)
Plugins that enable features already built into the app:

1. **reCamera** - Uses main app components:
   - Backend: `src-tauri/src/commands/recamera.rs`
   - Frontend: `src/components/vision/CameraFeedPanel.tsx`
   - Services: `src/services/reCameraDetectionService.ts`
   - Manifest: Declares permissions and routes

### Full WASM Plugins
Plugins that bundle all functionality as WASM:

1. **Vision AI** - Database schema + future WASM components
2. **Multi-Location** - Location management + sync logic
3. **Bar Management** - Bar-specific features
4. **Aggregator Integration** - Third-party delivery integration

---

## Upload Instructions

### Upload reCamera Plugin
```bash
cd /Users/stonepot-tech/projects/restaurant-pos-ai
./plugins/upload-plugin-manifest.sh recamera
```

### Upload Multi-Location Plugin (Updated)
```bash
./plugins/upload-plugin-manifest.sh multi-location
```

### Upload All Plugins
```bash
# Upload manifests
for plugin in recamera multi-location vision-ai bar-management-v2; do
  ./plugins/upload-plugin-manifest.sh $plugin
done

# Upload WASM (if available)
./plugins/upload-wasm-to-r2.sh
```

---

## Testing

### reCamera Plugin
1. Install Vision AI plugin (dependency)
2. Navigate to Settings → Plugins
3. Search for "reCamera Integration"
4. Install plugin
5. Go to `/camera-feed` to view

### Multi-Location Plugin
1. Navigate to Settings → Plugins
2. Search for "Multi-Location Management"
3. If upgrading from v1.8.0 or v2.0.0, migration runs automatically
4. Go to `/chain` for chain dashboard

---

## Database Schema

### Vision AI Plugin Tables
- `vision_cameras` - Camera devices
- `vision_detections` - AI detection results
- `vision_events` - Alerts and events
- `vision_snapshots` - Image snapshots
- `vision_analytics_hourly` - Analytics

### Multi-Location Plugin Tables
- `locations` - Restaurant locations
- `master_menu` - Centralized menu
- `location_menu_overrides` - Location-specific overrides
- `location_pricing_rules` - Pricing rules per location
- `cross_location_transfers` - Staff/inventory transfers

---

## Next Steps

1. ✅ Upload reCamera plugin to R2
2. ✅ Upload updated Multi-Location plugin to R2
3. 🔄 Test plugin installation from Plugin Store
4. 🔄 Verify migration from old versions
5. 📝 Update documentation
6. 📢 Announce new plugins

---

## Support

For issues or questions:
- **GitHub**: https://github.com/handsfree-pos/plugins
- **Discord**: https://discord.gg/handsfree-pos
- **Email**: support@handsfree.com

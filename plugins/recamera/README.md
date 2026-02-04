# reCamera Integration Plugin

Connect and manage Seeed Studio reCamera devices for live video feeds, AI-powered detection, and seat occupancy tracking.

## Features

- 🔍 **Automatic Discovery**: Scan local network for reCamera devices
- 📺 **Live Video Feed**: View real-time camera feeds with detection overlays
- 🪑 **Seat Occupancy**: Track table occupancy with AI detection
- 🧠 **Edge AI**: On-device processing for privacy and low latency
- 📡 **WiFi Config**: Configure camera WiFi from the app

## Installation

### From Plugin Store
1. Open HandsFree POS
2. Navigate to Settings → Plugins
3. Search for "reCamera Integration"
4. Click "Install"

### Manual Installation
```bash
# Upload to R2
cd plugins
./upload-plugin-to-r2.sh recamera
```

## Setup

### 1. Install Vision AI Plugin (Dependency)
The reCamera plugin requires the Vision AI plugin for database tables.

### 2. Add reCamera Device
1. Power on your reCamera
2. Go to Settings → Vision AI
3. Click "Scan for Cameras"
4. Select your camera and click "Add"

### 3. View Camera Feed
Navigate to `/camera-feed` to view live feeds and occupancy data.

## Configuration

### Table Layout
Configure your restaurant's table layout in the camera feed settings:

```json
{
  "table_1": 4,  // Table 1 has 4 seats
  "table_2": 2,  // Table 2 has 2 seats
  "table_3": 6   // Table 3 has 6 seats
}
```

### Camera Settings
- **IP Address**: Static IP recommended (e.g., 192.168.1.100)
- **Stream Quality**: Auto-adjusts based on network
- **Detection Threshold**: 0.6 (60% confidence minimum)

## Architecture

### Main App Components
These are built into the app and enabled by the plugin:

**Backend** (`src-tauri/src/commands/recamera.rs`):
- `scan_recameras()` - Network discovery
- `test_recamera_connection()` - Connection testing
- `configure_recamera_wifi()` - WiFi setup
- `get_recamera_network_status()` - Status monitoring

**Frontend** (`src/components/vision/CameraFeedPanel.tsx`):
- Camera feed viewer
- Occupancy overlay
- Table breakdown

**Services** (`src/services/reCameraDetectionService.ts`):
- Detection processing
- Occupancy calculation
- Analytics storage

### Plugin Manifest
The plugin manifest (`manifest.json`) enables these features and declares:
- Required permissions
- Dependencies (Vision AI plugin)
- UI routes and menu items
- Analytics events

## Development

### Building
```bash
# The reCamera plugin uses the main app's components
# No separate build needed - components are bundled with the app

# To test:
1. Install Vision AI plugin
2. Restart app
3. Navigate to /camera-feed
```

### Updating
```bash
# 1. Update version in manifest.json
# 2. Update checksum
sha256sum manifest.json

# 3. Upload to R2
cd plugins
./upload-plugin-to-r2.sh recamera
```

## API Reference

### Detection Processing
```typescript
import { processDetection } from '@/services/reCameraDetectionService';

await processDetection({
  camera_id: 'cam_123',
  timestamp: Date.now(),
  detections: [
    {
      class_name: 'person',
      confidence: 0.92,
      bbox: { x: 100, y: 150, width: 80, height: 200 },
      zone_id: 'table_1'
    }
  ]
});
```

### Occupancy Calculation
```typescript
import { calculateOccupancy } from '@/services/reCameraDetectionService';

const snapshot = await calculateOccupancy('cam_123', {
  table_1: 4,
  table_2: 2,
  table_3: 6
});

console.log(`Occupancy: ${snapshot.overall_occupancy * 100}%`);
```

## Troubleshooting

### Camera Not Found
1. Ensure camera is powered on
2. Check camera is on same network
3. Verify IP address is accessible
4. Try manual IP entry

### Connection Failed
1. Test camera web interface: `http://<camera-ip>/`
2. Check firewall settings
3. Verify credentials (default: recamera / StonePot@2026)

### No Video Feed
1. Refresh the page
2. Check camera status in settings
3. Verify browser/app has camera permissions
4. Try different network (avoid VPN)

## Support

- **Documentation**: https://docs.handsfree.com/plugins/recamera
- **Issues**: https://github.com/handsfree-pos/plugins/issues
- **Community**: https://discord.gg/handsfree-pos

## License

MIT License - HandsFree POS Team

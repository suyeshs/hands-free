# reCamera 200x Setup Guide for Vision AI Plugin

Quick guide to connect your Seeed Studio reCamera 200x to the Vision AI plugin.

## Prerequisites

- ✅ reCamera 200x powered on (green light)
- ✅ Connected to same network as POS device
- ✅ Default password changed (if prompted)

## Setup Steps

### 1. Connect reCamera to Network

**Option A: Via WiFi AP (First Time)**
1. Connect phone/laptop to reCamera WiFi
   - SSID: `reCamera_XXXXXX`
   - Password: `12345678`
2. Open browser: `http://192.168.16.1`
3. Go to network settings
4. Connect reCamera to your restaurant WiFi
5. Note the IP address assigned (e.g., `192.168.1.100`)

**Option B: Via USB**
1. Connect USB-C cable to reCamera and PC
2. Open browser: `http://192.168.42.1`
3. Configure network settings
4. Note the IP address

### 2. Update reCamera Firmware (Recommended)

1. Access reCamera web interface
2. Go to Settings → System Update
3. Click "Check for Updates"
4. If available, click "Update" and wait 5-10 minutes
5. Reboot when complete

### 3. Configure Node-RED (Optional but Recommended)

The reCamera runs Node-RED for custom AI flows.

**Access Node-RED:**
```
http://<recamera-ip>:1880
```

**Install Vision AI Flow (if needed):**
1. Go to Menu → Manage Palette
2. Install: `node-red-contrib-websocket`
3. Import pre-built flow (coming soon)

### 4. Add to Vision AI Plugin

**In POS App:**
1. Go to `Settings → Plugins → Vision AI`
2. Click `Add Camera`
3. Fill in details:

```
Camera Type: reCamera
Name: Kitchen Camera
Location: Kitchen
IP Address: 192.168.1.100
Enable Edge AI: ✓ Yes
```

4. **Features to Enable:**
   - ✓ People Counting
   - ✓ Motion Detection
   - ✓ Cloud Analysis (optional)
   - Cloud Interval: 300 seconds (5 min)

5. **Processing Mode:**
   - Choose `Hybrid` for best performance

6. Click `Test Connection`
7. If successful, click `Save`

### 5. Verify Connection

**Check Status:**
- Green indicator = Online & working
- Orange indicator = Connected but no data
- Red indicator = Offline

**View Live Feed:**
1. Go to `Vision AI → Live Monitoring`
2. You should see reCamera feed with people count overlay
3. Move in front of camera to test detection

## reCamera-Specific Features

### Edge AI Models

reCamera comes with pre-installed YOLO11 models:

**Available Models:**
- Person Detection (default)
- Object Detection (80 classes)
- Face Detection
- Custom models (upload your own)

**Switch Models:**
1. Access reCamera web interface
2. Go to Node-RED dashboard
3. Select model from dropdown
4. Click "Load Model"

### RTSP Stream URLs

**Main Stream (1080p@15fps):**
```
rtsp://admin:admin@192.168.1.100:554/live
```

**Sub Stream (720p@15fps):**
```
rtsp://admin:admin@192.168.1.100:554/stream2
```

Test in VLC:
```bash
vlc rtsp://admin:admin@192.168.1.100:554/live
```

### WebSocket AI Results

reCamera sends real-time AI results via WebSocket:

**URL:**
```
ws://192.168.1.100:80/ai-stream
```

**Data Format:**
```json
{
  "boxes": [
    {
      "class_name": "person",
      "confidence": 0.89,
      "x": 120,
      "y": 180,
      "w": 80,
      "h": 200,
      "tracking_id": 1
    }
  ],
  "fps": 15,
  "inference_time": 45
}
```

The Vision AI plugin automatically connects to this WebSocket when "Enable Edge AI" is checked.

## Use Cases

### Kitchen Surveillance
```
Location: Kitchen
Features:
  - Motion Detection: ✓
  - Safety Monitoring: ✓
  - Cloud Analysis: ✓ (every 10 min)
Processing: Hybrid

Alerts:
  - Motion detected after hours
  - Safety violations (via Gemini)
```

### Dining Area Monitoring
```
Location: Dining
Features:
  - People Counting: ✓
  - Table Occupancy: ✓
  - Cloud Analysis: ✗ (not needed)
Processing: Edge Only

Benefits:
  - Real-time guest count
  - Table availability
  - Peak hours tracking
```

### Entrance Tracking
```
Location: Entrance
Features:
  - People Counting: ✓
  - Motion Detection: ✓
Processing: Edge Only

Benefits:
  - Visitor count
  - Entry/exit patterns
  - Wait time estimation
```

## Troubleshooting

### Can't Connect to reCamera

**Check Power:**
- Green light on = powered
- No light = check USB-C cable

**Check Network:**
```bash
ping 192.168.1.100
```

**Reset Network:**
1. Hold reset button 10 seconds
2. Reconnect to reCamera WiFi AP
3. Reconfigure network

### No AI Results in App

**Check WebSocket:**
1. Open browser console
2. Check for WebSocket errors
3. Verify IP address is correct

**Check Model:**
1. Access Node-RED dashboard
2. Ensure SSCMA model is loaded
3. Try switching to different model

**Test with Curl:**
```bash
curl http://192.168.1.100:80/ai-stream
```

### Low FPS / Laggy

**Reduce Resolution:**
1. Node-RED → Camera Node
2. Set resolution to 720p
3. Reduce FPS to 10

**Network Issues:**
- Use 5GHz WiFi instead of 2.4GHz
- Move router closer
- Check for interference

### Edge AI Not Working

**Verify Model Loaded:**
1. Access reCamera web interface
2. Go to Node-RED dashboard
3. Check model status = "Loaded"

**Restart reCamera:**
1. Unplug power
2. Wait 10 seconds
3. Plug back in
4. Wait for boot (30-60 seconds)

## Performance Tips

### Best Practices

**Mounting:**
- Mount 7-8 feet high
- Angle down 30-45 degrees
- Avoid backlighting (windows)

**Network:**
- Use wired ethernet (adapter needed) for best stability
- 5GHz WiFi for wireless
- Ensure strong signal (-65 dBm or better)

**Power:**
- Use 5V 2A power adapter (minimum)
- USB power banks work for temporary use
- PoE adapter available separately

### Expected Performance

**Edge AI:**
- Inference: ~45ms
- FPS: 15
- Latency: ~500ms (RTSP + WebSocket)
- Accuracy: ~90% for person detection

**Video Stream:**
- Resolution: 1920×1080 @ 15fps
- Codec: H.264
- Bitrate: ~2-4 Mbps
- Latency: ~500ms

## Advanced Configuration

### Custom AI Models

You can upload custom YOLO models to reCamera:

1. Train model with [SSCMA](https://github.com/Seeed-Studio/SSCMA)
2. Convert to SG200X format
3. Upload via Node-RED interface
4. Select custom model in dropdown

### API Integration

**HTTP Snapshot:**
```bash
curl http://192.168.1.100/snapshot -o snapshot.jpg
```

**Send Commands:**
```javascript
fetch('http://192.168.1.100/api/command', {
  method: 'POST',
  body: JSON.stringify({
    command: 'switch_model',
    model: 'face_detection'
  })
});
```

### Multi-reCamera Setup

For multiple reCamera units:

1. Configure each with unique name
2. Assign static IPs in router
3. Add each to Vision AI plugin separately
4. Use location field to distinguish

**Example:**
- reCamera 1: `192.168.1.101` → Kitchen
- reCamera 2: `192.168.1.102` → Dining
- reCamera 3: `192.168.1.103` → Entrance

## Resources

**Official Docs:**
- https://wiki.seeedstudio.com/recamera_getting_started/
- https://wiki.seeedstudio.com/recamera_develop_with_node-red/

**Community:**
- Seeed Forum: https://forum.seeedstudio.com/
- Discord: Seeed Studio server

**Support:**
- Email: techsupport@seeed.cc
- GitHub: https://github.com/Seeed-Studio/reCamera-OS

---

**Plugin Version**: 1.0.0
**Compatible with**: reCamera 200x, reCamera 2002 series
**Last Updated**: 2026-02-02

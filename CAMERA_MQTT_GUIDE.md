# reCamera MQTT Streaming Guide

## Quick Start

```bash
# Start MQTT-based camera server
bun run camera:mqtt
```

Then open: **http://localhost:3002**

## Current Status

- ✅ MQTT library installed (`mqtt@5.15.0`)
- ✅ MQTT server created (`camera-mqtt-server.ts`)
- ❌ MQTT broker port (1883) is **CLOSED** on reCamera

## How It Works

```
┌──────────┐   MQTT Topics    ┌─────────────┐   WebSocket   ┌──────────┐
│reCamera  │ ───────────────► │ Bun Server  │ ────────────► │ Browser  │
│192.168   │  sscma/v0/#     │camera-mqtt  │  JSON frames  │ Viewer   │
│.68.100   │  camera/frame   │  -server.ts │               │          │
│Port 1883 │                 └─────────────┘               └──────────┘
└──────────┘
```

## Prerequisites

### 1. Enable MQTT Broker on reCamera

The MQTT broker needs to be enabled on the reCamera. Options:

**Option A: Via Node-RED**
1. Open Node-RED: http://192.168.68.100:1880
2. Check if `mqtt-broker` node is configured
3. If not, add an MQTT broker node:
   - Port: 1883
   - Host: localhost or 0.0.0.0 (to allow external connections)
   - Deploy the flow

**Option B: Via SSH/Terminal**
```bash
# SSH into reCamera (if enabled)
ssh admin@192.168.68.100

# Start Mosquitto MQTT broker
mosquitto -p 1883 -v
```

**Option C: Check SSCMA Service**
The SSCMA service should start the MQTT broker automatically. Check if it's running:
```bash
# From your computer
curl http://192.168.68.100/api/get_model
```

### 2. Configure Camera to Publish Frames

The camera needs to be configured to publish frames to MQTT topics. In Node-RED:

1. Add `sscma-camera` node
2. Add `mqtt out` node
3. Configure MQTT out node:
   - Topic: `camera/frame` or `sscma/v0/frame`
   - QoS: 0 or 1
4. Wire camera → mqtt out
5. Deploy

## MQTT Topics

The server subscribes to multiple topics:

- `sscma/v0/#` - All SSCMA messages
- `camera/frame` - Camera frames
- `camera/image` - Image data
- `camera/stream` - Stream data
- `recamera/#` - All reCamera topics

## Testing MQTT Connection

### Check if MQTT Broker is Running

```bash
nc -zv 192.168.68.100 1883
```

Should show: `Connection to 192.168.68.100 port 1883 succeeded`

### Subscribe to MQTT Topics (CLI)

```bash
# Install MQTT CLI tools (if not installed)
bun mqtt sub -h 192.168.68.100 -t 'sscma/v0/#' -v

# Or use mosquitto client
mosquitto_sub -h 192.168.68.100 -t 'sscma/v0/#' -v
```

### Publish Test Message

```bash
bun mqtt pub -h 192.168.68.100 -t 'camera/test' -m 'Hello from CLI'
```

## Running the Server

### Development Mode

```bash
bun run camera:mqtt
```

The server will:
1. Connect to MQTT broker at `192.168.68.100:1883`
2. Subscribe to camera topics
3. Start HTTP server on port 3002
4. Relay MQTT messages to WebSocket clients

### Production Mode

```bash
# Run in background with logging
nohup bun run camera:mqtt > camera-mqtt.log 2>&1 &

# Check logs
tail -f camera-mqtt.log

# Stop server
pkill -f camera-mqtt-server
```

## Server Endpoints

- **GET /** - HTML viewer page
- **WebSocket /stream** - Live frame stream
- **GET /health** - Server status and stats
- **GET /stats** - Detailed statistics
- **GET /topics** - Subscribed MQTT topics

## Viewer Features

The built-in viewer (http://localhost:3002) shows:

- 📹 Live camera feed
- 📊 Real-time stats (FPS, frame count, messages)
- 📡 MQTT topic information
- 📝 Message log (last 50 messages)
- 🔄 Auto-reconnection

## Integrating with React App

### Simple Component

```tsx
import { useEffect, useRef, useState } from 'react';

export function MQTTCameraViewer() {
  const [connected, setConnected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3002/stream');
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'frame' && imgRef.current) {
          imgRef.current.src = msg.data;
          setFrameCount(prev => prev + 1);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="mqtt-camera">
      <div className="status">
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
        <span className="ml-4">Frames: {frameCount}</span>
      </div>
      <img
        ref={imgRef}
        alt="Camera Feed"
        className="w-full rounded-lg"
      />
    </div>
  );
}
```

## Troubleshooting

### MQTT Connection Refused

**Problem:** `Connection refused` on port 1883

**Solutions:**
1. Check if MQTT broker is running on reCamera
2. Enable MQTT in Node-RED
3. Check firewall settings
4. Verify reCamera is on same network

### No Frames Received

**Problem:** Server connects but no frames appear

**Solutions:**
1. Check if camera is publishing to MQTT
2. Verify topic names match
3. Check Node-RED flow is deployed
4. Look at server logs for MQTT messages

### High Latency

**Problem:** Frames are delayed

**Solutions:**
1. Use QoS 0 for lower latency
2. Reduce image quality in camera settings
3. Check network bandwidth
4. Reduce frame rate

## Message Formats

The server handles multiple message formats:

### JSON Format

```json
{
  "image": "base64-encoded-jpeg",
  "timestamp": 1234567890,
  "topic": "camera/frame"
}
```

### Binary Format

Raw JPEG or PNG binary data (detected by magic bytes)

### Base64 String

Direct base64-encoded image string

## Performance

- **Latency:** ~100-500ms (MQTT + WebSocket)
- **Throughput:** Depends on camera FPS
- **Bandwidth:** ~50-200 KB/frame (JPEG compressed)
- **Clients:** Supports multiple concurrent viewers

## Next Steps

1. **Enable MQTT on reCamera**
   - Configure MQTT broker in Node-RED
   - Set up camera → MQTT flow

2. **Test Connection**
   - Verify MQTT port is open
   - Subscribe to topics via CLI

3. **Run Server**
   ```bash
   bun run camera:mqtt
   ```

4. **View Stream**
   - Open http://localhost:3002

5. **Integrate into POS**
   - Add MQTTCameraViewer component
   - Customize styling
   - Add to relevant pages

## Alternative: Use RTSP Instead

If MQTT is not available, use the RTSP server instead:

```bash
bun run camera:server  # Requires FFmpeg
```

See `CAMERA_STREAMING_SETUP.md` for RTSP setup.

## Need Help?

- Check Node-RED flows: http://192.168.68.100:1880
- View server stats: http://localhost:3002/stats
- Check logs for errors
- Verify network connectivity

---

**Summary:** MQTT provides a lightweight way to stream camera frames. Enable the MQTT broker on your reCamera, configure it to publish frames, then run `bun run camera:mqtt` to view in browser!

# reCamera Browser Streaming Setup

This guide shows you how to view your reCamera feed directly in the browser using the Bun-based transcoding server.

## Prerequisites

1. **FFmpeg** - Required for RTSP transcoding
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg

   # Check installation
   ffmpeg -version
   ```

2. **Enable RTSP Stream on reCamera**
   - Open Node-RED: http://192.168.68.100:1880
   - Add `sscma-camera` node
   - Add `sscma-stream` node
   - Connect them and configure stream node:
     - Port: 554
     - Format: H.264
     - Resolution: 1080p or 720p
     - FPS: 15
   - Click "Deploy"

3. **Verify RTSP is Running**
   ```bash
   nc -zv 192.168.68.100 554
   # Should show: Connection to 192.168.68.100 port 554 succeeded
   ```

## Quick Start

1. **Start the Camera Server**
   ```bash
   bun run camera:server
   ```

2. **Open Browser**
   - Navigate to: http://localhost:3001
   - You should see the live camera feed!

## How It Works

```
┌─────────────┐      RTSP       ┌──────────────┐    WebSocket    ┌─────────────┐
│  reCamera   │  ──────────────► │ Bun Server   │ ──────────────► │   Browser   │
│192.168.68.100│   H.264 video   │   FFmpeg     │  JPEG frames   │  (React App)│
│   Port 554  │                 │  Transcoder  │                 │             │
└─────────────┘                 └──────────────┘                 └─────────────┘
```

### Technical Details

- **Input:** RTSP stream from reCamera (H.264, 1080p@15fps)
- **Processing:** FFmpeg transcodes to JPEG frames
- **Output:** WebSocket stream (base64-encoded JPEGs)
- **Latency:** ~500-1000ms (typical for RTSP transcoding)
- **FPS:** 10fps (configurable in camera-server.ts)

## Configuration

### Camera Server Settings

Edit `camera-server.ts` to customize:

```typescript
const RTSP_URL = 'rtsp://admin:admin@192.168.68.100:554/live';
const HTTP_PORT = 3001;

// FFmpeg frame rate (line 44)
'-r', '10',  // Change to 15 or 20 for higher FPS

// JPEG quality (line 42)
'-q:v', '5',  // Range 2-31 (2=best, 31=worst)
```

### Network Configuration

If your reCamera is on a different IP:

1. Update `RTSP_URL` in `camera-server.ts`
2. Update credentials if changed from default (admin/admin)

## API Endpoints

The camera server provides:

- **GET /**
  - Returns HTML viewer page

- **WebSocket /stream**
  - Streams JPEG frames in base64 format
  - Auto-reconnects on disconnect

- **GET /health**
  - Returns server status
  ```json
  {
    "status": "ok",
    "clients": 2,
    "ffmpeg": "running",
    "rtspUrl": "rtsp://admin:admin@192.168.68.100:554/live"
  }
  ```

## Integrating with React App

### Option 1: Component Integration

Create a camera viewer component:

```tsx
// src/components/CameraViewer.tsx
import { useEffect, useRef, useState } from 'react';

export function CameraViewer() {
  const [connected, setConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/stream');
    wsRef.current = ws;

    let frameCount = 0;
    const fpsInterval = setInterval(() => {
      setFps(frameCount);
      frameCount = 0;
    }, 1000);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      if (event.data.startsWith('data:image/jpeg') && imgRef.current) {
        imgRef.current.src = event.data;
        frameCount++;
      }
    };

    return () => {
      clearInterval(fpsInterval);
      ws.close();
    };
  }, []);

  return (
    <div className="camera-viewer">
      <div className="status">
        {connected ? '🟢 Connected' : '🔴 Disconnected'} | {fps} FPS
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

### Option 2: Embed in Existing Page

```tsx
<iframe
  src="http://localhost:3001"
  className="w-full h-96 border-0 rounded-lg"
  title="Camera Feed"
/>
```

## Production Deployment

### Option 1: Run as Background Service

```bash
# Using systemd (Linux)
sudo nano /etc/systemd/system/camera-server.service
```

```ini
[Unit]
Description=reCamera Streaming Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/restaurant-pos-ai
ExecStart=/usr/local/bin/bun run camera-server.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable camera-server
sudo systemctl start camera-server
```

### Option 2: Docker Container

```dockerfile
FROM oven/bun:1

WORKDIR /app

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

COPY package.json bun.lockb ./
RUN bun install

COPY camera-server.ts ./

EXPOSE 3001

CMD ["bun", "run", "camera-server.ts"]
```

## Troubleshooting

### FFmpeg Not Found

```bash
# Install FFmpeg
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Linux

# Verify
ffmpeg -version
```

### RTSP Connection Failed

1. **Check if reCamera RTSP is enabled:**
   ```bash
   nc -zv 192.168.68.100 554
   ```

2. **Test with VLC first:**
   ```
   rtsp://admin:admin@192.168.68.100:554/live
   ```

3. **Check Node-RED deployment:**
   - Ensure stream node is deployed
   - Check for errors in Node-RED debug panel

### High Latency

1. **Reduce resolution** in Node-RED stream node (720p or 480p)
2. **Increase FPS** in camera-server.ts
3. **Use TCP transport** (already configured)

### Connection Drops

- Add reconnection logic in React component
- Implement heartbeat/ping mechanism
- Check network stability

## Performance Optimization

### For Low-End Devices

```typescript
// In camera-server.ts, reduce quality:
'-q:v', '8',  // Lower quality
'-r', '5',    // 5 FPS
```

### For High-Quality Streaming

```typescript
// Higher quality, more bandwidth:
'-q:v', '2',   // Best quality
'-r', '15',    // 15 FPS (match camera)
```

## Security Considerations

⚠️ **Important for Production:**

1. **Authentication:** Add authentication to WebSocket endpoint
2. **HTTPS/WSS:** Use secure connections
3. **Firewall:** Restrict access to camera server
4. **Credentials:** Don't hardcode RTSP credentials

## Next Steps

Once the camera server is running:

1. ✅ View feed at http://localhost:3001
2. 📱 Integrate into your POS React app
3. 🔒 Add authentication if needed
4. 🚀 Deploy to production

Need help with any of these? Let me know!

# reCamera RTSP Streaming Setup Guide

## Current Status
- **Camera IP:** 192.168.68.100
- **RTSP Port (554):** CLOSED (not enabled yet)
- **Node-RED:** http://192.168.68.100:1880 (accessible)
- **Web UI:** http://192.168.68.100 (accessible)

## Step-by-Step: Enable RTSP Streaming

### Method 1: Using Node-RED Editor (Recommended)

1. **Open Node-RED Editor**
   - Go to: http://192.168.68.100:1880

2. **Create a New Flow**
   - Click the "+" button to create a new tab
   - Name it "Camera RTSP Stream"

3. **Add Camera Node**
   - From the left palette, find `sscma-camera` node
   - Drag it onto the canvas
   - Double-click to configure:
     - Select your SSCMA configuration (dec794eaeb95589c)
     - Click Done

4. **Add Stream Node**
   - Find `sscma-stream` node in the palette
   - Drag it onto the canvas
   - Connect the camera node output to the stream node input (drag wire between them)
   - Double-click stream node to configure:
     - Port: 554
     - Format: H.264
     - Resolution: 1080p (or 720p for better performance)
     - FPS: 15
     - Click Done

5. **Deploy the Flow**
   - Click the red "Deploy" button in the top-right
   - Wait for "Successfully deployed" message

6. **Verify RTSP Stream**
   - The RTSP port 554 should now be open
   - Stream URL: `rtsp://admin:admin@192.168.68.100:554/live`

### Method 2: Import Pre-made Flow

1. **Open Node-RED**
   - Go to: http://192.168.68.100:1880

2. **Import Flow**
   - Click the hamburger menu (☰) in top-right
   - Select "Import"
   - Click "select a file to import"
   - Choose: `recamera-enable-rtsp-flow.json`
   - Click "Import"

3. **Deploy**
   - Click "Deploy" button
   - RTSP stream should now be active

## Viewing the Stream

### Option 1: VLC Media Player (Easiest)

1. **Install VLC**
   - Download from: https://www.videolan.org/vlc/

2. **Open Network Stream**
   - Open VLC
   - Menu: Media → Open Network Stream (Ctrl+N)
   - Enter URL: `rtsp://admin:admin@192.168.68.100:554/live`
   - Click Play

### Option 2: FFplay (Command Line)

```bash
ffplay -rtsp_transport tcp rtsp://admin:admin@192.168.68.100:554/live
```

### Option 3: Browser (Requires Transcoding)

Browsers can't play RTSP directly. You need to convert it to HTTP/WebSocket.

## Troubleshooting

### RTSP Port Still Closed

1. **Check Node-RED Status**
   ```bash
   curl http://192.168.68.100:1880/flows | jq '.[] | select(.type=="sscma-stream")'
   ```

2. **Restart Node-RED Service**
   - Access camera via SSH or terminal
   - Restart Node-RED: `systemctl restart node-red`

3. **Check Camera Logs**
   - In Node-RED, check the Debug panel for errors

### Stream Not Working in VLC

1. **Try Different Transport**
   - VLC: Tools → Preferences → Input/Codecs
   - Change "Network caching" to 1000ms or higher
   - Use URL: `rtsp://admin:admin@192.168.68.100:554/live?tcp`

2. **Check Network**
   - Ping the camera: `ping 192.168.68.100`
   - Test port: `nc -zv 192.168.68.100 554`

3. **Verify Credentials**
   - Default username: admin
   - Default password: admin

### Low FPS or Lag

1. **Reduce Resolution**
   - In stream node, change from 1080p to 720p or 480p

2. **Increase Buffer in VLC**
   - Tools → Preferences → All → Input/Codecs
   - Network caching: 1500-3000ms

## Advanced: Browser-Based Viewing

If you need to view the stream in a web browser, you'll need a transcoding solution:

### Solution 1: FFmpeg + Node.js WebSocket Server

I can help you set up a server that converts RTSP → WebSocket for browser viewing.

### Solution 2: Node-RED MJPEG Converter

Create a Node-RED flow that converts RTSP to MJPEG HTTP stream.

### Solution 3: WebRTC Gateway

Use a WebRTC gateway for low-latency browser streaming.

Let me know which solution you prefer!

## Stream Specifications

- **Format:** H.264
- **Resolution:** 1920×1800 @ 15fps (default)
- **Latency:** ~500ms
- **Protocol:** RTSP over TCP/UDP
- **Port:** 554
- **Authentication:** admin/admin

## Next Steps

1. Enable RTSP stream using Method 1 or Method 2 above
2. Test with VLC using the RTSP URL
3. Let me know if you need browser-based viewing (I'll set up transcoding)

## Files Created

- `recamera-rtsp-viewer.html` - Instructions and RTSP info
- `recamera-enable-rtsp-flow.json` - Pre-configured Node-RED flow
- `RECAMERA_SETUP_GUIDE.md` - This guide

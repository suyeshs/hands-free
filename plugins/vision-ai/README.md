# Vision AI Plugin

**Multi-camera AI intelligence system for restaurant operations**

Monitor dining areas, kitchens, and entrances with AI-powered vision analytics. Supports webcams, IP cameras, reCamera, and Airtel Xsafe cameras.

## Features

### 🎥 Multi-Camera Support
- **Webcams**: Built-in laptop/tablet cameras, USB webcams
- **IP Cameras**: RTSP/HTTP streaming cameras
- **reCamera**: Seeed Studio reCamera with edge AI
- **Airtel Xsafe**: Via ONVIF or manual RTSP configuration
- **Generic ONVIF**: Any ONVIF-compatible camera

### 🧠 AI Processing Modes

#### Edge AI (Free, Local)
- Runs TensorFlow.js in browser
- COCO-SSD object detection
- Real-time people counting
- No internet required for basic features
- ~50-100ms latency

#### Cloud AI (Advanced Analysis)
- **Gemini Vision**: Scene understanding, safety compliance, anomaly detection
- **Cloudflare Worker AI**: Fast object detection, classification
- Periodic snapshot analysis
- Configurable intervals (5min - 1hr)

#### Hybrid Mode (Best of Both)
- Edge AI for real-time monitoring
- Periodic cloud analysis for insights
- Automatic failover

### 📊 Core Capabilities

**People Counting**
- Real-time visitor tracking
- Occupancy trends
- Peak hours analysis

**Table Occupancy Detection**
- Identify empty vs occupied tables
- Table turnover metrics
- Guest waiting time optimization

**Kitchen Surveillance**
- Motion detection
- Safety compliance monitoring
- Staff activity tracking

**Smart Alerts**
- High occupancy warnings
- Safety violations
- Motion in restricted areas
- Anomaly detection

## Setup

### 1. Install Plugin
```
Settings → Plugins → Vision AI → Install
```

### 2. Add Cameras

#### Webcam
1. Go to Vision AI → Cameras → Add Camera
2. Select "Webcam"
3. Choose device from dropdown
4. Select location (Dining, Kitchen, etc.)
5. Enable desired features

#### IP/RTSP Camera
1. Add Camera → Select "IP Camera"
2. Enter RTSP URL: `rtsp://username:password@ip:554/stream`
3. Or HTTP URL for MJPEG streams
4. Test connection
5. Configure features

#### reCamera (Seeed Studio)
1. Power on reCamera
2. Connect to reCamera's WiFi AP (password: `12345678`)
3. Configure reCamera to join your network
4. Add Camera → Select "reCamera"
5. Enter IP address: `192.168.x.x`
6. Enable "Use Edge AI" for camera's built-in processing
7. Configure features

#### Airtel Xsafe
**Option A: ONVIF (Recommended)**
1. Add Camera → Select "ONVIF"
2. Enter camera IP and credentials
3. Auto-discover ONVIF profiles
4. Select profile and test

**Option B: Manual RTSP**
1. Find RTSP URL from Xsafe camera settings
2. Add Camera → Select "IP Camera"
3. Enter RTSP URL manually
4. Test connection

### 3. Configure Processing

**Edge AI Only (Free)**
- Runs locally in browser
- Real-time processing
- Best for: Basic people counting, motion detection

**Cloud AI (Requires Credits)**
- Advanced scene analysis
- Safety compliance checks
- Best for: Kitchen monitoring, security

**Hybrid (Recommended)**
- Edge AI for real-time
- Cloud AI every 5-15 minutes
- Best balance of speed and insights

### 4. Set Up Alerts

Configure alerts for:
- Max occupancy threshold (e.g., 50 people)
- Table ready notifications
- Kitchen motion detection
- Safety violations

## Usage

### Live Monitoring Dashboard
```
Vision AI → Live Monitoring
```
- Grid view of all cameras
- Real-time people count
- Recent alerts
- Camera status

### Analytics
```
Vision AI → Analytics
```
- Occupancy trends (hourly/daily)
- Peak hours analysis
- Table turnover rates
- Heat maps (coming soon)

### Event History
```
Vision AI → Events
```
- All alerts and detections
- Filter by camera, severity, type
- View snapshots
- Acknowledge events

## Camera Recommendations

### Dining Area
- **Best**: reCamera 200x (edge AI + cloud)
- **Budget**: USB webcam (edge AI only)
- **Wide view**: 1080p IP camera with 110° FOV

### Kitchen
- **Best**: IP camera with night vision
- **Budget**: Webcam mounted on wall
- **Features needed**: Motion detection, cloud safety analysis

### Entrance/Exit
- **Best**: reCamera or ONVIF camera
- **Budget**: Webcam
- **Features**: People counting, time-lapse

## Technical Details

### Edge AI Models
- **COCO-SSD**: 80-class object detection
- **Inference time**: 50-150ms
- **Accuracy**: ~85% for people detection
- **Browser requirements**: Modern browser with WebGL

### Cloud AI
- **Gemini 2.0 Flash**: Scene understanding, compliance
- **Cloudflare Worker AI**: Fast object detection
- **Rate limits**: 100 requests/minute
- **Cost**: ~$0.001 per analysis

### Network Requirements
- **Webcam**: No network required
- **IP Camera**: Local network access
- **reCamera**: WiFi (2.4GHz or 5GHz)
- **Cloud AI**: Internet connection

### Storage
- **Snapshots**: Stored in R2 (Cloudflare Object Storage)
- **Retention**: 30 days (configurable)
- **Analytics**: SQLite (local) + D1 (cloud sync)

## Troubleshooting

### Camera Not Connecting
1. Check camera is powered on
2. Verify network connectivity
3. Test RTSP URL in VLC player
4. Check firewall settings

### Edge AI Not Working
1. Ensure modern browser (Chrome, Edge, Firefox)
2. Check WebGL support: `chrome://gpu`
3. Clear cache and reload
4. Disable ad blockers

### Low FPS / Lag
1. Reduce stream resolution to 720p
2. Decrease FPS to 10-15
3. Use edge AI instead of cloud
4. Close other tabs/apps

### Cloud AI Errors
1. Check internet connection
2. Verify API keys in settings
3. Check cloud usage limits
4. Review error logs

## Privacy & Security

- **Local Processing**: Edge AI runs entirely in browser
- **Encryption**: All cloud transmissions use HTTPS
- **Data Retention**: Configurable (7-30 days)
- **Access Control**: Plugin permissions required
- **GDPR Compliant**: Data can be exported/deleted

## Roadmap

- [ ] Face blurring for privacy
- [ ] Heat map generation
- [ ] Custom zone detection
- [ ] Video recording
- [ ] Multi-location comparison
- [ ] Advanced behavior analysis
- [ ] Integration with POS for table linking
- [ ] Staff attendance via face recognition

## Support

For issues or questions:
1. Check logs: Vision AI → Settings → View Logs
2. GitHub: [issues](https://github.com/handsfree-pos/plugins/issues)
3. Discord: [#vision-ai channel](https://discord.gg/handsfree)

## License

MIT License - Copyright (c) 2026 HandsFree POS Team

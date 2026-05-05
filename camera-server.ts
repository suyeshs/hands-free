#!/usr/bin/env bun
/**
 * reCamera RTSP to WebSocket/HTTP Transcoding Server
 *
 * This server transcodes the reCamera RTSP stream to formats viewable in browsers:
 * - WebSocket: Real-time streaming via Canvas/Video element
 * - MJPEG: HTTP multipart stream for <img> tags
 *
 * Usage:
 *   bun run camera-server.ts
 *
 * Then open: http://localhost:3001
 */

import { spawn } from 'child_process';

const RTSP_URL = 'rtsp://admin:admin@192.168.68.100:554/live';
const HTTP_PORT = 3001;

// Store connected WebSocket clients
const wsClients = new Set<any>();

// FFmpeg process for transcoding RTSP to JPEG frames
let ffmpegProcess: any = null;

/**
 * Start FFmpeg process to convert RTSP stream to JPEG frames
 */
function startFFmpeg() {
  console.log('🎥 Starting FFmpeg RTSP transcoding...');

  ffmpegProcess = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-i', RTSP_URL,
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-q:v', '5',
    '-r', '10', // 10 fps for web streaming
    '-'
  ]);

  let frameBuffer = Buffer.alloc(0);

  ffmpegProcess.stdout.on('data', (data: Buffer) => {
    // Append new data to buffer
    frameBuffer = Buffer.concat([frameBuffer, data]);

    // Look for JPEG markers (FFD8 = start, FFD9 = end)
    let start = frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]));
    let end = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]));

    while (start !== -1 && end !== -1 && end > start) {
      // Extract complete JPEG frame
      const frame = frameBuffer.slice(start, end + 2);

      // Broadcast to all WebSocket clients
      broadcastFrame(frame);

      // Remove processed frame from buffer
      frameBuffer = frameBuffer.slice(end + 2);

      // Look for next frame
      start = frameBuffer.indexOf(Buffer.from([0xFF, 0xD8]));
      end = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]));
    }
  });

  ffmpegProcess.stderr.on('data', (data: Buffer) => {
    // Log FFmpeg output (verbose)
    const message = data.toString();
    if (message.includes('frame=') || message.includes('fps=')) {
      // Show frame rate info
      const match = message.match(/frame=\s*(\d+)\s+fps=\s*([\d.]+)/);
      if (match) {
        process.stdout.write(`\r📊 Frames: ${match[1]}, FPS: ${match[2]}   `);
      }
    }
  });

  ffmpegProcess.on('error', (error: Error) => {
    console.error('❌ FFmpeg error:', error);
  });

  ffmpegProcess.on('close', (code: number) => {
    console.log(`\n⚠️  FFmpeg process exited with code ${code}`);
    // Attempt to restart after 5 seconds
    setTimeout(() => {
      console.log('🔄 Restarting FFmpeg...');
      startFFmpeg();
    }, 5000);
  });
}

/**
 * Broadcast frame to all connected WebSocket clients
 */
function broadcastFrame(frame: Buffer) {
  const base64Frame = `data:image/jpeg;base64,${frame.toString('base64')}`;

  for (const client of wsClients) {
    try {
      client.send(base64Frame);
    } catch (error) {
      console.error('Failed to send frame to client:', error);
      wsClients.delete(client);
    }
  }
}

/**
 * HTTP Server with WebSocket support
 */
const server = Bun.serve({
  port: HTTP_PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade to WebSocket for video streaming
    if (url.pathname === '/stream') {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return undefined;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // Serve the viewer HTML page
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(getViewerHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        clients: wsClients.size,
        ffmpeg: ffmpegProcess ? 'running' : 'stopped',
        rtspUrl: RTSP_URL
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log('✅ Client connected');
      wsClients.add(ws);

      // Send initial status
      ws.send(JSON.stringify({
        type: 'status',
        message: 'Connected to reCamera stream',
        clients: wsClients.size
      }));
    },

    message(ws, message) {
      console.log('📨 Received message:', message);

      // Handle client messages if needed
      if (message === 'ping') {
        ws.send('pong');
      }
    },

    close(ws) {
      console.log('❌ Client disconnected');
      wsClients.delete(ws);
    },

    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    }
  }
});

/**
 * HTML viewer page
 */
function getViewerHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>reCamera Live Stream</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: #2d3748;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
        }
        .status.connected { background: #48bb78; }
        .status.disconnected { background: #f56565; }
        .video-container {
            position: relative;
            background: #000;
            min-height: 480px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #videoFeed {
            width: 100%;
            height: auto;
            display: block;
        }
        .loading {
            position: absolute;
            color: white;
            font-size: 18px;
        }
        .stats {
            padding: 20px;
            background: #f7fafc;
            border-top: 1px solid #e2e8f0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .stat-item {
            padding: 15px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎥 reCamera Live Stream</h1>
            <span class="status disconnected" id="status">Disconnected</span>
        </div>

        <div class="video-container">
            <div class="loading" id="loading">Connecting to camera...</div>
            <img id="videoFeed" style="display: none;" alt="Live Camera Feed">
        </div>

        <div class="stats">
            <div class="stat-item">
                <div class="stat-label">Camera IP</div>
                <div class="stat-value" style="font-size: 18px;">192.168.68.100</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">FPS</div>
                <div class="stat-value" id="fps">0</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Frames Received</div>
                <div class="stat-value" id="frames">0</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Latency</div>
                <div class="stat-value" id="latency">~500ms</div>
            </div>
        </div>
    </div>

    <script>
        let ws = null;
        let frameCount = 0;
        let lastFrameTime = Date.now();
        let fpsCounter = 0;
        let fpsInterval = null;

        function connect() {
            const wsUrl = \`ws://\${window.location.host}/stream\`;
            console.log('Connecting to:', wsUrl);

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('✅ Connected to stream');
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status connected';
                document.getElementById('loading').style.display = 'none';

                // Start FPS counter
                fpsInterval = setInterval(updateFPS, 1000);
            };

            ws.onmessage = (event) => {
                const data = event.data;

                // Handle status messages
                if (data.startsWith('{')) {
                    try {
                        const msg = JSON.parse(data);
                        console.log('Status:', msg);
                    } catch (e) {}
                    return;
                }

                // Handle image frames
                if (data.startsWith('data:image/jpeg')) {
                    const img = document.getElementById('videoFeed');
                    img.src = data;
                    img.style.display = 'block';

                    frameCount++;
                    fpsCounter++;
                    document.getElementById('frames').textContent = frameCount;
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('❌ Disconnected from stream');
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';
                document.getElementById('loading').style.display = 'block';
                document.getElementById('loading').textContent = 'Reconnecting...';

                if (fpsInterval) {
                    clearInterval(fpsInterval);
                }

                // Attempt reconnection after 3 seconds
                setTimeout(connect, 3000);
            };
        }

        function updateFPS() {
            document.getElementById('fps').textContent = fpsCounter;
            fpsCounter = 0;
        }

        // Connect on load
        connect();

        // Ping every 30 seconds to keep connection alive
        setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);
    </script>
</body>
</html>`;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');

  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
  }

  process.exit(0);
});

// Start the server
console.log(`
╔═══════════════════════════════════════════════════════╗
║   reCamera RTSP Streaming Server                     ║
║                                                       ║
║   📹 RTSP Source: ${RTSP_URL.padEnd(30)} ║
║   🌐 HTTP Server: http://localhost:${HTTP_PORT}            ║
║   🔌 WebSocket:   ws://localhost:${HTTP_PORT}/stream      ║
║                                                       ║
║   Open http://localhost:${HTTP_PORT} to view stream       ║
╚═══════════════════════════════════════════════════════╝
`);

// Check if FFmpeg is installed
try {
  const checkFFmpeg = spawn('ffmpeg', ['-version']);
  checkFFmpeg.on('close', (code) => {
    if (code === 0) {
      console.log('✅ FFmpeg detected');
      startFFmpeg();
    }
  });
  checkFFmpeg.on('error', () => {
    console.error('❌ FFmpeg not found! Please install FFmpeg:');
    console.error('   macOS: brew install ffmpeg');
    console.error('   Linux: sudo apt install ffmpeg');
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Error checking for FFmpeg:', error);
}

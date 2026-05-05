#!/usr/bin/env bun
/**
 * reCamera MQTT to WebSocket Streaming Server
 *
 * This server subscribes to the reCamera's MQTT topics and relays
 * video frames to browser clients via WebSocket.
 *
 * Usage:
 *   bun run camera-mqtt-server.ts
 *
 * Then open: http://localhost:3002
 */

import mqtt from 'mqtt';

const MQTT_BROKER = 'mqtt://192.168.68.100:1883';
const MQTT_TOPICS = [
  'sscma/v0/#',           // All SSCMA topics
  'camera/frame',         // Camera frame topic
  'camera/image',         // Image topic
  'camera/stream',        // Stream topic
  'recamera/#',          // All reCamera topics
];
const HTTP_PORT = 3002;

// Store connected WebSocket clients
const wsClients = new Set<any>();

// MQTT client
let mqttClient: mqtt.MqttClient | null = null;

// Stats
let stats = {
  messagesReceived: 0,
  framesReceived: 0,
  lastFrameTime: 0,
  fps: 0,
  connectedClients: 0,
};

/**
 * Connect to MQTT broker
 */
function connectMQTT() {
  console.log('🔌 Connecting to MQTT broker:', MQTT_BROKER);

  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: `recamera_viewer_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000,
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');

    // Subscribe to all camera topics
    MQTT_TOPICS.forEach(topic => {
      mqttClient?.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📡 Subscribed to: ${topic}`);
        }
      });
    });
  });

  mqttClient.on('message', (topic, payload, packet) => {
    stats.messagesReceived++;

    console.log(`📨 [${topic}] Received ${payload.length} bytes`);

    // Try to parse as JSON first
    try {
      const jsonData = JSON.parse(payload.toString());
      console.log(`   JSON data:`, JSON.stringify(jsonData).substring(0, 200));

      // Check if it contains image data
      if (jsonData.image || jsonData.frame || jsonData.data) {
        handleImageData(topic, jsonData);
      }
    } catch (e) {
      // Not JSON, might be binary image data
      if (payload.length > 1000) { // Likely an image if > 1KB
        handleBinaryImage(topic, payload);
      } else {
        console.log(`   Text data:`, payload.toString().substring(0, 100));
      }
    }
  });

  mqttClient.on('error', (error) => {
    console.error('❌ MQTT error:', error);
  });

  mqttClient.on('offline', () => {
    console.log('⚠️  MQTT client offline');
  });

  mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to MQTT broker...');
  });
}

/**
 * Handle JSON image data
 */
function handleImageData(topic: string, data: any) {
  let imageData = data.image || data.frame || data.data;

  if (!imageData) return;

  // Check if it's base64
  if (typeof imageData === 'string') {
    let base64Image = imageData;

    // Add data URI prefix if not present
    if (!base64Image.startsWith('data:image')) {
      base64Image = `data:image/jpeg;base64,${base64Image}`;
    }

    broadcastFrame(base64Image, topic);
    stats.framesReceived++;
  }
}

/**
 * Handle binary image data
 */
function handleBinaryImage(topic: string, payload: Buffer) {
  // Check if it's a JPEG (starts with FFD8)
  if (payload[0] === 0xFF && payload[1] === 0xD8) {
    const base64Image = `data:image/jpeg;base64,${payload.toString('base64')}`;
    broadcastFrame(base64Image, topic);
    stats.framesReceived++;
  }
  // Check if it's a PNG (starts with 89504E47)
  else if (payload[0] === 0x89 && payload[1] === 0x50 && payload[2] === 0x4E && payload[3] === 0x47) {
    const base64Image = `data:image/png;base64,${payload.toString('base64')}`;
    broadcastFrame(base64Image, topic);
    stats.framesReceived++;
  }
}

/**
 * Broadcast frame to all connected WebSocket clients
 */
function broadcastFrame(imageData: string, topic: string) {
  const message = JSON.stringify({
    type: 'frame',
    data: imageData,
    topic: topic,
    timestamp: Date.now(),
  });

  // Update FPS
  const now = Date.now();
  if (stats.lastFrameTime > 0) {
    const timeDiff = (now - stats.lastFrameTime) / 1000;
    stats.fps = Math.round(1 / timeDiff);
  }
  stats.lastFrameTime = now;

  // Broadcast to all clients
  for (const client of wsClients) {
    try {
      client.send(message);
    } catch (error) {
      console.error('Failed to send to client:', error);
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

    // Upgrade to WebSocket
    if (url.pathname === '/stream') {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return undefined;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // Serve viewer HTML
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(getViewerHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Stats/Health endpoint
    if (url.pathname === '/health' || url.pathname === '/stats') {
      stats.connectedClients = wsClients.size;
      return Response.json({
        status: 'ok',
        mqtt: mqttClient?.connected ? 'connected' : 'disconnected',
        ...stats,
      });
    }

    // MQTT topics debug
    if (url.pathname === '/topics') {
      return Response.json({
        subscribedTopics: MQTT_TOPICS,
        broker: MQTT_BROKER,
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log('✅ WebSocket client connected');
      wsClients.add(ws);
      stats.connectedClients = wsClients.size;

      // Send initial status
      ws.send(JSON.stringify({
        type: 'status',
        message: 'Connected to reCamera MQTT stream',
        clients: wsClients.size,
        topics: MQTT_TOPICS,
      }));
    },

    message(ws, message) {
      // Handle client messages
      const msg = message.toString();

      if (msg === 'ping') {
        ws.send('pong');
      } else if (msg === 'stats') {
        ws.send(JSON.stringify({ type: 'stats', data: stats }));
      }
    },

    close(ws) {
      console.log('❌ WebSocket client disconnected');
      wsClients.delete(ws);
      stats.connectedClients = wsClients.size;
    },

    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
      stats.connectedClients = wsClients.size;
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
    <title>reCamera MQTT Stream</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
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
            text-align: center;
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
        .log {
            padding: 20px;
            background: #2d3748;
            color: #e2e8f0;
            max-height: 200px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
        }
        .log-entry {
            margin-bottom: 5px;
            padding: 5px;
            border-left: 3px solid #667eea;
            padding-left: 10px;
        }
        .log-entry.frame {
            border-left-color: #48bb78;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>📡 reCamera MQTT Stream</h1>
                <small style="opacity: 0.8;">Broker: 192.168.68.100:1883</small>
            </div>
            <span class="status disconnected" id="status">Disconnected</span>
        </div>

        <div class="video-container">
            <div class="loading" id="loading">
                Connecting to MQTT stream...<br>
                <small style="margin-top: 10px; display: block;">
                    Waiting for camera frames on topic: sscma/v0/#
                </small>
            </div>
            <img id="videoFeed" style="display: none;" alt="Live Camera Feed">
        </div>

        <div class="stats">
            <div class="stat-item">
                <div class="stat-label">MQTT Messages</div>
                <div class="stat-value" id="messages">0</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Frames Received</div>
                <div class="stat-value" id="frames">0</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">FPS</div>
                <div class="stat-value" id="fps">0</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Last Topic</div>
                <div class="stat-value" style="font-size: 14px;" id="lastTopic">-</div>
            </div>
        </div>

        <div class="log" id="log">
            <div class="log-entry">📡 MQTT Stream Viewer initialized...</div>
        </div>
    </div>

    <script>
        let ws = null;
        let messageCount = 0;
        let frameCount = 0;
        let lastTopic = '-';

        function log(message, isFrame = false) {
            const logEl = document.getElementById('log');
            const entry = document.createElement('div');
            entry.className = 'log-entry' + (isFrame ? ' frame' : '');
            const time = new Date().toLocaleTimeString();
            entry.textContent = \`[\${time}] \${message}\`;
            logEl.appendChild(entry);
            logEl.scrollTop = logEl.scrollHeight;

            // Keep only last 50 entries
            while (logEl.children.length > 50) {
                logEl.removeChild(logEl.firstChild);
            }
        }

        function connect() {
            const wsUrl = \`ws://\${window.location.host}/stream\`;
            console.log('Connecting to:', wsUrl);
            log('Connecting to WebSocket...');

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('✅ Connected to stream');
                log('✅ Connected to WebSocket', false);
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status connected';
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.type === 'status') {
                        log('📡 ' + msg.message);
                    } else if (msg.type === 'frame') {
                        const img = document.getElementById('videoFeed');
                        img.src = msg.data;
                        img.style.display = 'block';
                        document.getElementById('loading').style.display = 'none';

                        frameCount++;
                        lastTopic = msg.topic;

                        document.getElementById('frames').textContent = frameCount;
                        document.getElementById('lastTopic').textContent = msg.topic;

                        log(\`🖼️  Frame from: \${msg.topic}\`, true);
                    }

                    messageCount++;
                    document.getElementById('messages').textContent = messageCount;
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                log('❌ WebSocket error');
            };

            ws.onclose = () => {
                console.log('❌ Disconnected');
                log('⚠️  Disconnected, reconnecting in 3s...');
                document.getElementById('status').textContent = 'Disconnected';
                document.getElementById('status').className = 'status disconnected';

                // Attempt reconnection
                setTimeout(connect, 3000);
            };
        }

        // Fetch stats periodically
        setInterval(async () => {
            try {
                const response = await fetch('/stats');
                const stats = await response.json();
                document.getElementById('fps').textContent = stats.fps || 0;
            } catch (e) {}
        }, 1000);

        // Connect on load
        connect();

        // Ping every 30 seconds
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

  if (mqttClient) {
    mqttClient.end();
  }

  process.exit(0);
});

// Start the server
console.log(`
╔═══════════════════════════════════════════════════════╗
║   reCamera MQTT Streaming Server                     ║
║                                                       ║
║   📡 MQTT Broker: ${MQTT_BROKER.padEnd(34)} ║
║   🌐 HTTP Server: http://localhost:${HTTP_PORT}            ║
║   🔌 WebSocket:   ws://localhost:${HTTP_PORT}/stream      ║
║                                                       ║
║   Subscribed topics:                                  ║
${MQTT_TOPICS.map(t => `║     - ${t.padEnd(47)} ║`).join('\n')}
║                                                       ║
║   Open http://localhost:${HTTP_PORT} to view stream       ║
╚═══════════════════════════════════════════════════════╝
`);

// Connect to MQTT
connectMQTT();

console.log('\n💡 Waiting for MQTT messages...\n');

# WebSocket Integration Guide

Real-time bidirectional communication for WhatsApp webhook using Cloudflare Durable Objects.

## Overview

This setup enables real-time WebSocket connections that work alongside your WhatsApp integration:

```
┌──────────────────────────────────────────────────────────────┐
│                    Architecture Flow                          │
└──────────────────────────────────────────────────────────────┘

WhatsApp User          Admin Dashboard         Staff App
     │                       │                      │
     │ Message via           │  WebSocket           │  WebSocket
     │ WhatsApp API          │  Connection          │  Connection
     │                       │                      │
     ▼                       ▼                      ▼
┌────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (Main Handler)               │
│  • Receives WhatsApp webhooks                              │
│  • Routes to Durable Object                                │
│  • Processes with AI (Claude/OpenClaw)                     │
└───────────────┬────────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────┐
│          Durable Object (ConversationRoom)                  │
│  • Maintains WebSocket connections                         │
│  • Stores conversation history                             │
│  • Broadcasts messages to all connected clients            │
│  • Handles real-time events                                │
└────────────────────────────────────────────────────────────┘
                │
                ├──► Admin sees messages in real-time
                ├──► Staff receives order updates instantly
                └──► Customer gets responses via WhatsApp
```

## Key Benefits

### 1. **Real-Time Updates**
- Order status changes pushed instantly to WhatsApp
- Customer messages appear in admin dashboard immediately
- Staff app updates live without polling

### 2. **Multi-User Conversations**
- Multiple admins can join same conversation
- All see the same message history
- Typing indicators and read receipts

### 3. **Persistent State**
- Conversation history stored in Durable Object
- Survives Worker restarts
- Accessible across multiple connections

### 4. **Scalable**
- Each conversation runs in its own Durable Object
- Automatic scaling by Cloudflare
- No connection limits

## Use Cases

### Customer Support Chat
**Scenario**: Customer messages your restaurant on WhatsApp, support staff responds from admin dashboard

```javascript
// Customer sends WhatsApp message
"Hi, I want to book a table for 4 people at 7pm"

// Message flows to Durable Object
// All connected admins see it instantly in their dashboard

// Admin responds via WebSocket
"Sure! I've booked table #12 for you. See you at 7pm!"

// Response sent to customer via WhatsApp
// And logged in conversation history
```

### Live Order Tracking
**Scenario**: Customer orders food, tracks status in real-time

```javascript
// Order placed
notifyOrderStatus("919876543210", "ORD-123", "confirmed")
  → WebSocket: "Your order has been confirmed ✓"
  → WhatsApp: "Your order #ORD-123 has been confirmed"

// Kitchen starts preparing
notifyOrderStatus("919876543210", "ORD-123", "preparing")
  → WebSocket: "Chef is preparing your food 👨‍🍳"
  → WhatsApp: "Your order is being prepared"

// Order ready
notifyOrderStatus("919876543210", "ORD-123", "ready")
  → WebSocket: "Your order is ready for pickup! 📦"
  → WhatsApp: "Your order is ready! Please collect from counter."
```

### Staff Notifications
**Scenario**: New order comes in, notify all kitchen staff

```javascript
// New order received
broadcastToRole("kitchen_staff", {
  type: "new_order",
  orderId: "ORD-123",
  items: ["Butter Chicken", "Naan x2"],
  table: 5,
  priority: "high"
})

// All kitchen staff WebSocket clients receive notification instantly
// Staff can acknowledge via WebSocket
// Status synced back to POS system
```

## API Reference

### Connect to WebSocket

**Endpoint**: `GET /ws`

**Query Parameters**:
- `userId` (required): User's phone number or ID
- `userType` (optional): `whatsapp` | `admin` | `staff` (default: `whatsapp`)
- `tenantId` (optional): Restaurant tenant ID for multi-tenant setups

**Example**:
```javascript
const ws = new WebSocket(
  'wss://your-worker.workers.dev/ws?userId=919876543210&userType=admin&tenantId=restaurant-123'
);

ws.onopen = () => {
  console.log('Connected to conversation room');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);

  switch (data.type) {
    case 'connection':
      console.log('Connected! Client ID:', data.clientId);
      break;

    case 'history':
      console.log('Message history:', data.messages);
      break;

    case 'message':
      console.log('New message:', data.message);
      break;

    case 'notification':
      console.log('Notification:', data.notification);
      break;

    case 'user_joined':
      console.log('User joined:', data.userId);
      break;

    case 'user_left':
      console.log('User left:', data.userId);
      break;

    case 'typing':
      console.log('User typing:', data.userId, data.isTyping);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### Send Message via WebSocket

```javascript
ws.send(JSON.stringify({
  type: 'message',
  content: 'Hello! How can I help you?',
  to: '919876543210', // Optional: specific recipient
  metadata: {
    senderName: 'Support Agent',
    department: 'Customer Service'
  }
}));
```

### Send Typing Indicator

```javascript
ws.send(JSON.stringify({
  type: 'typing',
  isTyping: true
}));

// Stop typing
ws.send(JSON.stringify({
  type: 'typing',
  isTyping: false
}));
```

### Mark Message as Read

```javascript
ws.send(JSON.stringify({
  type: 'read',
  messageId: 'msg-12345'
}));
```

### Ping/Pong (Keep-Alive)

```javascript
// Send ping every 30 seconds
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);

// Receive pong
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'pong') {
    console.log('Server alive, latency:', Date.now() - data.timestamp, 'ms');
  }
};
```

## Integration Examples

### React Component (Admin Dashboard)

```typescript
import { useEffect, useState, useRef } from 'react';

interface Message {
  id: string;
  from: string;
  content: string;
  timestamp: number;
}

export function LiveChat({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket(
      `wss://your-worker.workers.dev/ws?userId=${userId}&userType=admin`
    );

    ws.onopen = () => {
      console.log('Connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'history':
          setMessages(data.messages);
          break;

        case 'message':
          setMessages(prev => [...prev, data.message]);
          break;

        case 'typing':
          setTyping(data.isTyping);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect logic
      setTimeout(() => {
        // Reconnect
      }, 5000);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [userId]);

  const sendMessage = (content: string) => {
    if (wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
      }));
    }
  };

  return (
    <div className="chat-container">
      <div className="status">
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <strong>{msg.from}:</strong> {msg.content}
          </div>
        ))}
        {typing && <div className="typing">User is typing...</div>}
      </div>

      <input
        type="text"
        placeholder="Type a message..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  );
}
```

### Node.js/Bun Server Integration

```typescript
import { WebSocket } from 'ws';

class WhatsAppWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number = 5000;

  connect(userId: string, userType: 'admin' | 'staff' = 'admin') {
    this.ws = new WebSocket(
      `wss://your-worker.workers.dev/ws?userId=${userId}&userType=${userType}`
    );

    this.ws.on('open', () => {
      console.log('✓ Connected to conversation room');
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });

    this.ws.on('close', () => {
      console.log('✗ Disconnected, reconnecting...');
      setTimeout(() => this.connect(userId, userType), this.reconnectTimeout);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'message':
        console.log('New message:', message.message.content);
        // Process message
        // Maybe send to another system, log to database, etc.
        break;

      case 'notification':
        console.log('Notification:', message.notification);
        // Trigger desktop notification, email, SMS, etc.
        break;
    }
  }

  sendMessage(content: string, to?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'message',
        content,
        to,
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const client = new WhatsAppWebSocketClient();
client.connect('919876543210', 'admin');

// Send message after 2 seconds
setTimeout(() => {
  client.sendMessage('Hello from server!');
}, 2000);
```

### Python Integration (using websockets library)

```python
import asyncio
import websockets
import json

async def connect_to_whatsapp_chat(user_id: str, user_type: str = 'admin'):
    url = f"wss://your-worker.workers.dev/ws?userId={user_id}&userType={user_type}"

    async with websockets.connect(url) as websocket:
        print("✓ Connected to conversation room")

        # Listen for messages
        async for message in websocket:
            data = json.loads(message)

            if data['type'] == 'message':
                print(f"New message: {data['message']['content']}")

            elif data['type'] == 'notification':
                print(f"Notification: {data['notification']}")

        # Send message
        await websocket.send(json.dumps({
            'type': 'message',
            'content': 'Hello from Python!'
        }))

# Run
asyncio.run(connect_to_whatsapp_chat('919876543210', 'admin'))
```

## REST API (Alternative to WebSocket)

If WebSocket is not available, you can use REST API:

### Broadcast Message

```bash
curl -X POST https://your-worker.workers.dev/rooms/919876543210/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Your order is ready!",
    "type": "notification"
  }'
```

### Get Message History

```bash
curl https://your-worker.workers.dev/rooms/919876543210/messages
```

### Get Active Connections

```bash
curl https://your-worker.workers.dev/rooms/919876543210/clients
```

## Deployment

1. **Deploy Worker with Durable Objects**:
   ```bash
   cd platform/workers/whatsapp-webhook
   wrangler deploy
   ```

2. **Migrate Durable Objects** (first time only):
   ```bash
   wrangler deployments list
   # Migrations run automatically on first deployment
   ```

3. **Test WebSocket Connection**:
   ```bash
   wscat -c "wss://your-worker.workers.dev/ws?userId=test&userType=admin"
   ```

## Monitoring & Debugging

### View Durable Object Logs

```bash
wrangler tail --format=json | grep "ConversationRoom"
```

### Check Active Rooms

```bash
curl https://your-worker.workers.dev/metrics
```

### Debug WebSocket Connection

```javascript
// Browser console
const ws = new WebSocket('wss://your-worker.workers.dev/ws?userId=test&userType=admin');
ws.onopen = () => console.log('open');
ws.onmessage = (e) => console.log('message:', e.data);
ws.onerror = (e) => console.error('error:', e);
ws.onclose = () => console.log('closed');

// Send test message
ws.send(JSON.stringify({ type: 'message', content: 'test' }));
```

## Best Practices

### 1. Reconnection Logic
Always implement reconnection with exponential backoff:

```javascript
let reconnectDelay = 1000;
const maxDelay = 30000;

function connect() {
  const ws = new WebSocket('wss://...');

  ws.onclose = () => {
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
      connect();
    }, reconnectDelay);
  };

  ws.onopen = () => {
    reconnectDelay = 1000; // Reset on successful connection
  };
}
```

### 2. Heartbeat/Keep-Alive
Send ping every 30 seconds to keep connection alive:

```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

### 3. Message Queuing
Queue messages when disconnected:

```javascript
const messageQueue = [];

function sendMessage(message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    messageQueue.push(message);
  }
}

ws.onopen = () => {
  // Flush queue on reconnection
  while (messageQueue.length > 0) {
    ws.send(JSON.stringify(messageQueue.shift()));
  }
};
```

### 4. Error Handling
Always handle errors gracefully:

```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // Show user-friendly error message
  // Attempt reconnection
  // Fall back to polling if WebSocket fails repeatedly
};
```

## Troubleshooting

### WebSocket connection fails
- Check Durable Object binding in wrangler.jsonc
- Verify migrations ran successfully
- Check browser console for errors
- Test with `wscat` from command line

### Messages not delivered
- Verify user is connected (check `/clients` endpoint)
- Check Durable Object logs
- Ensure message format is correct
- Verify WebSocket is in OPEN state

### High latency
- Check Cloudflare region routing
- Verify Durable Object is in correct region
- Monitor CPU usage in Durable Object
- Consider message batching for high volume

## Security Considerations

1. **Authentication**: Add token-based auth before allowing WebSocket connections
2. **Rate Limiting**: Prevent abuse with per-user rate limits
3. **Input Validation**: Validate all messages before processing
4. **Tenant Isolation**: Ensure users can only access their own conversations
5. **Encryption**: Use WSS (WebSocket Secure) only

## Next Steps

- [ ] Add authentication middleware
- [ ] Implement message encryption
- [ ] Add file upload support
- [ ] Build admin dashboard
- [ ] Add analytics and monitoring
- [ ] Implement message search
- [ ] Add push notifications as fallback

## Resources

- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [WebSocket API Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)

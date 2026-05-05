# 🚀 Quick Start Guide

Get your WhatsApp + AI integration running in 15 minutes!

## Prerequisites

- [ ] WhatsApp Business account with API access
- [ ] Cloudflare account (free tier works!)
- [ ] Claude API key OR OpenClaw service URL
- [ ] Basic command line knowledge

## Step 1: Configure Secrets (5 minutes)

```bash
cd platform/workers/whatsapp-webhook

# WhatsApp credentials
wrangler secret put WHATSAPP_VERIFY_TOKEN
# Enter: mySecureToken123 (or any random string)

wrangler secret put WHATSAPP_ACCESS_TOKEN
# Get from: Meta Developer Console → WhatsApp → API Setup

wrangler secret put WHATSAPP_PHONE_NUMBER_ID
# Get from: Meta Developer Console → WhatsApp → API Setup

wrangler secret put WHATSAPP_BUSINESS_ACCOUNT_ID
# Get from: Meta Developer Console → App Settings

# AI service (choose one)
wrangler secret put ANTHROPIC_API_KEY
# Get from: https://console.anthropic.com/

# OR
wrangler secret put OPENCLAW_API_KEY
# Your OpenClaw API key
```

## Step 2: Create Cloudflare Resources (3 minutes)

```bash
# Create KV namespace for sessions
wrangler kv:namespace create "WHATSAPP_SESSIONS"
# Copy the ID that's printed

# List your D1 databases
wrangler d1 list
# Copy your restaurant database ID
```

Edit `wrangler.jsonc` and update these values:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "WHATSAPP_SESSIONS",
      "id": "paste-your-kv-id-here"  // ← Update this
    }
  ],
  "d1_databases": [
    {
      "binding": "RESTAURANT_DB",
      "database_id": "paste-your-d1-id-here"  // ← Update this
    }
  ]
}
```

## Step 3: Deploy (2 minutes)

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
wrangler deploy
```

You'll see:
```
✨ Deployment complete!
🌐 https://whatsapp-webhook.your-subdomain.workers.dev
```

Copy this URL!

## Step 4: Configure WhatsApp Webhook (3 minutes)

1. Go to [Meta Developer Console](https://developers.facebook.com/apps/)
2. Select your app → WhatsApp → Configuration
3. Click "Edit" next to Webhook

Fill in:
- **Callback URL**: `https://whatsapp-webhook.your-subdomain.workers.dev/webhook`
- **Verify Token**: Same as `WHATSAPP_VERIFY_TOKEN` you set earlier
- Click "Verify and Save"

4. Subscribe to webhook fields:
   - ✅ messages
   - ✅ message_status

## Step 5: Test! (2 minutes)

### Test 1: Send a WhatsApp Message

Send a message to your WhatsApp Business number:

```
"Hi, what's on the menu?"
```

You should get an AI response!

### Test 2: Connect via WebSocket

Open browser console (F12) and run:

```javascript
const ws = new WebSocket(
  'wss://whatsapp-webhook.your-subdomain.workers.dev/ws?userId=test&userType=admin'
);

ws.onopen = () => console.log('✓ Connected!');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));

// Send a test message
ws.send(JSON.stringify({
  type: 'message',
  content: 'Hello from WebSocket!'
}));
```

### Test 3: Check Health

```bash
curl https://whatsapp-webhook.your-subdomain.workers.dev/health
```

Should return:
```json
{
  "status": "ok",
  "environment": "development",
  "timestamp": "2024-02-01T10:30:00.000Z",
  "version": "2.0.0"
}
```

## 🎉 You're Live!

Your WhatsApp integration is now running. Here's what works:

✅ Customers can message your WhatsApp Business number
✅ AI (Claude/OpenClaw) responds automatically
✅ Database queries work (menu, orders, reservations)
✅ Real-time updates via WebSocket
✅ Admin dashboard can connect
✅ Staff app can connect

## What to Build Next

### Option 1: Admin Dashboard

Create a React app that connects to WebSocket:

```typescript
import { useEffect, useState } from 'react';

function AdminDashboard() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket(
      'wss://your-worker.workers.dev/ws?userId=admin&userType=admin'
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setMessages(prev => [...prev, data.message]);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div>
      <h1>Live Customer Conversations</h1>
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.from}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}
```

### Option 2: Integrate with Existing POS

In your Tauri app (`src-tauri/src/main.rs`):

```rust
use tauri::command;

#[command]
async fn send_whatsapp_notification(phone: String, message: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://your-worker.workers.dev/send")
        .json(&serde_json::json!({
            "to": phone,
            "message": message
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

Then call from React:

```typescript
import { invoke } from '@tauri-apps/api/core';

// When order is ready
await invoke('send_whatsapp_notification', {
  phone: '919876543210',
  message: 'Your order #123 is ready for pickup!'
});
```

### Option 3: Kitchen Display System

```typescript
const ws = new WebSocket(
  'wss://your-worker.workers.dev/ws?userId=kitchen-1&userType=staff'
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'new_order') {
    // Show in kitchen display
    displayOrder(data.order);
    playAlertSound();
  }
};

// When order is prepared
function markPrepared(orderId) {
  ws.send(JSON.stringify({
    type: 'order_update',
    orderId: orderId,
    status: 'prepared'
  }));
}
```

## Monitoring & Debugging

### View Logs

```bash
wrangler tail

# Filter errors only
wrangler tail --status error

# Filter by search term
wrangler tail --search "WhatsApp"
```

### Check Metrics

```bash
curl https://your-worker.workers.dev/metrics
```

Returns:
```json
{
  "timestamp": "2024-02-01T10:30:00.000Z",
  "environment": "development",
  "activeSessions": 42,
  "uptime": "healthy"
}
```

### Test Specific User Conversation

```bash
curl https://your-worker.workers.dev/rooms/919876543210/messages
```

## Troubleshooting

### Problem: Webhook verification fails

**Solution**: Make sure `WHATSAPP_VERIFY_TOKEN` in Cloudflare matches the token in Meta Console

```bash
# Check what's configured
wrangler secret list

# Update if needed
wrangler secret put WHATSAPP_VERIFY_TOKEN
```

### Problem: Messages not being processed

**Solution**: Check logs for errors

```bash
wrangler tail --status error
```

Common causes:
- Missing API keys
- Invalid D1 database ID
- Rate limit exceeded

### Problem: WebSocket won't connect

**Solution**: Test with curl first

```bash
curl https://your-worker.workers.dev/health

# Should return 200 OK
```

Then test WebSocket with `wscat`:

```bash
npm install -g wscat
wscat -c "wss://your-worker.workers.dev/ws?userId=test&userType=admin"
```

## Need Help?

1. Check logs: `wrangler tail`
2. Read documentation:
   - `README.md` - Full setup guide
   - `WORKFLOW_EXPLAINED.md` - How everything works
   - `WEBSOCKET_GUIDE.md` - WebSocket details
3. Test endpoints manually with `curl`
4. Check WhatsApp API status: https://developers.facebook.com/status

## Production Checklist

Before going to production:

- [ ] Set up custom domain
- [ ] Configure production environment in `wrangler.jsonc`
- [ ] Enable rate limiting
- [ ] Add authentication for WebSocket
- [ ] Set up monitoring/alerts
- [ ] Add error tracking (Sentry, etc.)
- [ ] Configure backups for D1 database
- [ ] Test with high message volume
- [ ] Document API for your team
- [ ] Train staff on new system

## Congratulations! 🎊

You've successfully deployed a production-ready WhatsApp + AI integration!

**What you built**:
- ✅ AI-powered customer service
- ✅ Real-time order management
- ✅ WebSocket notifications
- ✅ Scalable architecture
- ✅ Database integration

**Cost**: Likely $0/month on Cloudflare free tier for moderate usage!

Ready to take orders via WhatsApp? 🚀

# WhatsApp Webhook Worker for Restaurant POS

This Cloudflare Worker enables WhatsApp Business integration with your restaurant POS system, allowing AI-powered conversations with customers and staff via WhatsApp.

## Features

- ✅ **Real-time Message Handling**: Receive and process WhatsApp messages instantly
- ✅ **AI-Powered Responses**: Integrate with Claude AI or OpenClaw agent service
- ✅ **Restaurant Database Integration**: Query orders, inventory, staff schedules, etc.
- ✅ **Session Management**: Maintain conversation context across messages
- ✅ **Status Tracking**: Track message delivery and read receipts
- ✅ **Interactive Buttons**: Send rich messages with buttons and lists
- ✅ **Multi-tenant Support**: Isolated data access per restaurant

## Use Cases

### For Customers
- Menu inquiries
- Order placement and tracking
- Table reservations
- Feedback and support

### For Staff
- Check work schedules
- View payroll information
- Request time off
- Get shift notifications

### For Managers
- Sales reports
- Inventory alerts
- Staff management
- Real-time notifications

## Prerequisites

1. **WhatsApp Business Account**
   - Meta Business Account
   - WhatsApp Business API access
   - Phone number verification

2. **Cloudflare Account**
   - Workers plan (paid or free)
   - D1 Database
   - KV Namespace
   - R2 Bucket (optional, for media)

3. **AI Service** (choose one)
   - Anthropic API key (for Claude)
   - OpenClaw agent service URL and API key

## Setup Instructions

### Step 1: WhatsApp Business Setup

1. **Create Meta Business Account**
   - Go to https://business.facebook.com
   - Create a new business account or use existing

2. **Create WhatsApp Business App**
   - Go to https://developers.facebook.com
   - Create a new app → Business → WhatsApp
   - Follow the setup wizard

3. **Get Your Credentials**
   - Phone Number ID: Found in WhatsApp → API Setup
   - Business Account ID: Found in App Settings
   - Access Token: Generate in WhatsApp → API Setup
   - Verify Token: Create a random string (e.g., `mySecureToken123`)

### Step 2: Cloudflare Setup

1. **Create KV Namespace**
   ```bash
   # Create KV namespace for sessions
   wrangler kv:namespace create "WHATSAPP_SESSIONS"

   # For preview/dev
   wrangler kv:namespace create "WHATSAPP_SESSIONS" --preview
   ```

   Copy the IDs and update `wrangler.toml`

2. **Configure D1 Database**
   ```bash
   # List your existing D1 databases
   wrangler d1 list

   # Copy your restaurant database ID
   # Update wrangler.toml with the database_id
   ```

3. **Set Environment Secrets**
   ```bash
   # WhatsApp credentials
   wrangler secret put WHATSAPP_VERIFY_TOKEN
   # Enter your verify token (e.g., mySecureToken123)

   wrangler secret put WHATSAPP_ACCESS_TOKEN
   # Enter your WhatsApp access token

   wrangler secret put WHATSAPP_PHONE_NUMBER_ID
   # Enter your phone number ID

   wrangler secret put WHATSAPP_BUSINESS_ACCOUNT_ID
   # Enter your business account ID

   # AI integration (choose one)
   wrangler secret put ANTHROPIC_API_KEY
   # Enter your Anthropic API key

   # OR
   wrangler secret put OPENCLAW_API_KEY
   # Enter your OpenClaw API key
   ```

4. **Update wrangler.toml**
   ```toml
   # Replace these with your actual IDs
   [[kv_namespaces]]
   binding = "WHATSAPP_SESSIONS"
   id = "your-actual-kv-id"

   [[d1_databases]]
   binding = "RESTAURANT_DB"
   database_id = "your-actual-d1-id"
   ```

### Step 3: Deploy Worker

1. **Install Dependencies**
   ```bash
   cd workers/whatsapp-webhook
   npm install
   ```

2. **Test Locally**
   ```bash
   npm run dev
   ```

   The worker will run at http://localhost:8787

3. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

   Copy the deployed URL (e.g., `https://whatsapp-webhook.your-subdomain.workers.dev`)

### Step 4: Configure WhatsApp Webhook

1. **Go to Meta Developer Console**
   - Navigate to your WhatsApp app
   - Go to WhatsApp → Configuration

2. **Set Webhook URL**
   - Callback URL: `https://whatsapp-webhook.your-subdomain.workers.dev/webhook`
   - Verify Token: Same token you set in WHATSAPP_VERIFY_TOKEN
   - Click "Verify and Save"

3. **Subscribe to Webhook Fields**
   - Check: `messages`
   - Check: `message_status`
   - Save

4. **Test Webhook**
   - Send a message to your WhatsApp Business number
   - Check Cloudflare Workers logs: `wrangler tail`
   - You should see the message being processed

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_VERIFY_TOKEN` | Yes | Token for webhook verification |
| `WHATSAPP_ACCESS_TOKEN` | Yes | WhatsApp API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Your WhatsApp Business phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Yes | Your WhatsApp Business account ID |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for Claude AI |
| `OPENCLAW_API_URL` | Optional | OpenClaw agent service URL |
| `OPENCLAW_API_KEY` | Optional | OpenClaw API key |
| `ENVIRONMENT` | No | Environment name (development/production) |

### Database Schema

The worker expects your D1 database to have these tables (adjust as needed):

```sql
-- Menu items
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  price REAL,
  category TEXT,
  available BOOLEAN
);

-- Inventory
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  item_name TEXT,
  current_stock REAL,
  unit TEXT,
  low_stock_threshold REAL
);

-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  customer_id TEXT,
  status TEXT,
  total REAL,
  created_at TEXT
);

-- Staff
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  phone TEXT,
  role TEXT
);

-- Schedules
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  staff_id TEXT,
  date TEXT,
  start_time TEXT,
  end_time TEXT
);
```

## Usage Examples

### Customer Conversation

**Customer**: "Hi, what's on the menu today?"

**Bot**: "Hello! 👋 We have a great menu today. Here are some popular dishes:
- Butter Chicken - ₹350
- Paneer Tikka - ₹280
- Biryani - ₹320
- Dal Makhani - ₹200

What would you like to order? 🍽️"

**Customer**: "I want to book a table for 4 at 7pm"

**Bot**: "I'd be happy to help you book a table! 🪑

Please confirm:
- Date: Today
- Time: 7:00 PM
- Guests: 4

Any special requests?"

### Staff Conversation

**Staff**: "When is my next shift?"

**Bot**: "Let me check your schedule. Please provide your employee ID or name. 📅"

**Staff**: "John Doe"

**Bot**: "Hi John! 👋 Your upcoming shifts:

Tomorrow (Feb 1):
- 10:00 AM - 6:00 PM
- Role: Waiter
- Location: Main Hall

Friday (Feb 2):
- 2:00 PM - 10:00 PM
- Role: Waiter
- Location: Outdoor Section"

### Manager Conversation

**Manager**: "Show me today's sales"

**Bot**: "Today's Sales Summary 📊

Total Sales: ₹45,230
Orders: 67
Average Order: ₹675

Top Items:
1. Biryani (18 orders)
2. Butter Chicken (15 orders)
3. Paneer Tikka (12 orders)

Would you like a detailed report?"

## Customization

### Adding Custom Intents

Edit `src/index.ts` and add your intent in `processWithRules()`:

```typescript
// Custom intent example
if (lowerMessage.includes('feedback')) {
  return {
    message: "We'd love to hear your feedback! Please rate your experience from 1-5.",
    intent: 'feedback',
    actions: [{
      type: 'query_database',
      params: { query: 'feedback_collection' },
    }],
  };
}
```

### Adding Database Actions

Add new action handlers in the `executeAction()` function:

```typescript
case 'custom_action':
  return await handleCustomAction(action.params, session, env);
```

### Integrating with OpenClaw

If using OpenClaw, update the `processWithOpenClaw()` function:

```typescript
const response = await fetch(`${env.OPENCLAW_API_URL}/process`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.OPENCLAW_API_KEY}`,
  },
  body: JSON.stringify({
    message,
    context: session.conversationContext,
    userId: session.userId,
    tenantId: session.tenantId,
    // Add any additional context your OpenClaw service needs
  }),
});
```

## Testing

### Manual Testing

1. **Test Webhook Verification**
   ```bash
   curl "https://your-worker-url.workers.dev/webhook?hub.mode=subscribe&hub.verify_token=mySecureToken123&hub.challenge=test123"
   ```

   Should return: `test123`

2. **Test Health Check**
   ```bash
   curl https://your-worker-url.workers.dev/health
   ```

   Should return: `{"status":"ok","timestamp":"..."}`

3. **Test Send Message** (internal API)
   ```bash
   curl -X POST https://your-worker-url.workers.dev/send \
     -H "Content-Type: application/json" \
     -d '{
       "to": "919876543210",
       "message": "Hello from the restaurant!"
     }'
   ```

### Monitor Logs

```bash
# Real-time logs
wrangler tail

# Filter by status
wrangler tail --status error
```

## Troubleshooting

### Webhook Not Receiving Messages

1. Check webhook URL is correct in Meta console
2. Verify WHATSAPP_VERIFY_TOKEN matches
3. Ensure worker is deployed and accessible
4. Check Cloudflare Workers logs for errors

### Messages Not Sending

1. Verify WHATSAPP_ACCESS_TOKEN is valid
2. Check WHATSAPP_PHONE_NUMBER_ID is correct
3. Ensure phone number is verified with WhatsApp
4. Check rate limits (WhatsApp has limits)

### AI Not Responding

1. Verify ANTHROPIC_API_KEY or OPENCLAW_API_KEY
2. Check API endpoint URLs
3. Review logs for API errors
4. Verify Claude API quota

### Database Errors

1. Check D1 database binding in wrangler.toml
2. Verify database schema matches queries
3. Ensure tenant_id filtering is correct
4. Check D1 rate limits

## Rate Limits

- **WhatsApp API**: 80 messages/second per phone number
- **Cloudflare Workers**: 100,000 requests/day (free), unlimited (paid)
- **D1 Database**: 5 million reads/day (free)
- **KV**: 100,000 reads/day (free)

## Security Best Practices

1. **Webhook Security**
   - Always verify webhook signature (TODO: implement)
   - Use HTTPS only
   - Rotate verify token regularly

2. **API Keys**
   - Store all keys as secrets (not in code)
   - Rotate access tokens periodically
   - Use different keys for dev/prod

3. **Database Access**
   - Always use parameterized queries
   - Implement tenant isolation
   - Validate all user inputs
   - Limit query complexity

4. **Rate Limiting**
   - Implement per-user rate limits
   - Track failed attempts
   - Add CAPTCHA for suspicious activity

## Production Checklist

- [ ] All secrets configured in Cloudflare
- [ ] Custom domain configured
- [ ] Webhook verified in Meta console
- [ ] Database schema created
- [ ] Tenant isolation tested
- [ ] Error handling tested
- [ ] Monitoring set up
- [ ] Rate limiting implemented
- [ ] Security audit completed
- [ ] Load testing done

## Monitoring & Analytics

### Key Metrics to Track

- Message volume (received/sent)
- Response time
- Error rate
- AI processing time
- Database query time
- Popular intents
- User engagement

### Using Cloudflare Analytics

```bash
# View analytics
wrangler tail --format json | jq '.logs[] | select(.message contains "Message sent")'
```

## Support

- WhatsApp Business API Docs: https://developers.facebook.com/docs/whatsapp
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers
- Anthropic Claude Docs: https://docs.anthropic.com

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

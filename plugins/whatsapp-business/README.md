# WhatsApp Business Integration Plugin

**Version**: 1.0.0
**Type**: Hybrid (Client + Worker)
**Author**: HandsFree POS Team

## Overview

This plugin enables tenant-specific WhatsApp Business integration for the HandsFree POS system. Each restaurant tenant can connect their own WhatsApp Business account to:

1. **Chat with customers** directly through the POS interface
2. **Get real-time analytics** by texting the business WhatsApp number (owner/manager only)
3. **Automate customer service** with AI-powered responses via OpenClaw
4. **Send order confirmations** and notifications automatically

## Features

### Customer Messaging
- Real-time inbox interface in POS
- Message history and conversation management
- Media support (images, documents, videos)
- Message templates for quick responses
- Staff assignment for conversations

### Owner Analytics (OpenClaw Integration)
- Text natural language questions to get analytics
- "Show me today's sales" → AI generates SQL and responds
- "Top selling items?" → Instant analysis
- "Low stock items?" → Inventory check
- Completely tenant-isolated and secure

### Security & Isolation
- Tenant-specific credentials (encrypted)
- Unique webhook URL per tenant
- Cross-tenant data isolation
- Permission-based access control

## Architecture

```
Customer WhatsApp → Meta API → Worker Webhook (/webhook/{tenant_id})
                                     ↓
                          Extract tenant_id, validate signature
                                     ↓
                   Query D1 for tenant credentials & authorized users
                                     ↓
                   Is sender owner/staff? → OpenClaw /analyze (analytics)
                   Is sender customer? → OpenClaw /process (customer service)
                                     ↓
                          Store message in whatsapp_messages
                                     ↓
                     Broadcast to Durable Object WebSocket room
                                     ↓
                        POS Client receives real-time update
                                     ↓
                     Display in inbox or send analytics response
```

## Setup Guide

### Prerequisites

1. **WhatsApp Business Account**:
   - Create Meta Business Account
   - Add WhatsApp Business product
   - Create WhatsApp Business phone number
   - Generate permanent access token

2. **OpenClaw Configuration** (optional for analytics):
   - OpenClaw API URL
   - OpenClaw API key

### Installation Steps

#### 1. Install Plugin

```bash
# From POS admin panel
Settings → Plugins → Browse Marketplace → "WhatsApp Business Integration" → Install
```

#### 2. Configure Credentials

Navigate to: `Settings → Plugins → WhatsApp Business → Settings`

Enter:
- **Phone Number ID**: From Meta Business Manager
- **Business Account ID**: From Meta Business Manager
- **Access Token**: Generated from Meta
- **Owner Phone Number**: Your phone (for analytics)

Click **Save & Test Connection**

#### 3. Register Webhook with Meta

1. Copy the webhook URL shown (e.g., `https://worker.handsfree.dev/api/whatsapp/webhook/tenant-123`)
2. Go to Meta Business Manager → WhatsApp → Configuration
3. Add webhook URL
4. Enter verify token (shown in POS settings)
5. Subscribe to fields: `messages`, `message_status`

#### 4. Start Using

- Navigate to `/whatsapp` in POS to see inbox
- Send test message from customer phone
- Reply from POS
- **Owner**: Text your business number with "Show me today's sales"

## Configuration

### Plugin Settings

| Setting | Description | Required |
|---------|-------------|----------|
| `openclaw_api_url` | OpenClaw API endpoint | No |
| `openclaw_api_key` | OpenClaw authentication key | No |
| `enable_auto_replies` | Enable AI auto-replies | No (default: false) |
| `enable_daily_reports` | Send daily reports to owner | No (default: false) |
| `media_storage_bucket` | R2 bucket for media files | No |

### Permissions

The plugin requires these permissions:

**Database**:
- Read/Write: `whatsapp_*` tables
- Read: `orders`, `menu_items`, `staff_users`, `inventory_items` (for analytics)

**Network**:
- `graph.facebook.com` - Meta WhatsApp API
- `*.r2.cloudflarestorage.com` - Media storage
- `openclaw` - AI analytics service

**Events**:
- Subscribe: `order.completed`, `order.cancelled`
- Emit: `whatsapp.new_message`, `whatsapp.message_sent`

## API Endpoints

### Worker Endpoints

#### `POST /api/whatsapp/webhook/:tenant_id`
Receives webhook deliveries from Meta WhatsApp API.

#### `POST /api/whatsapp/send`
Send WhatsApp message to customer.

```json
{
  "tenant_id": "restaurant-123",
  "to": "1234567890",
  "message": "Your order is ready!",
  "type": "text"
}
```

#### `POST /api/whatsapp/analytics/query`
Process owner analytics query via OpenClaw.

```json
{
  "tenant_id": "restaurant-123",
  "query": "Show me today's sales"
}
```

## Database Schema

### Tables Created

- `whatsapp_credentials` - Tenant credentials (encrypted)
- `whatsapp_conversations` - Customer conversations
- `whatsapp_messages` - Message history
- `whatsapp_templates` - Message templates
- `whatsapp_authorized_users` - Analytics access control
- `whatsapp_analytics_requests` - Analytics query log
- `whatsapp_webhooks_log` - Webhook audit log
- `whatsapp_media` - Downloaded media files

## Development

### Build WASM Plugins

```bash
# Worker plugin
cd plugins/whatsapp-business/worker
cargo build --target wasm32-unknown-unknown --release
wasm-opt -Oz -o whatsapp-worker.wasm target/wasm32-unknown-unknown/release/whatsapp_business_worker.wasm

# Client plugin
cd ../client
cargo build --target wasm32-unknown-unknown --release
wasm-opt -Oz -o whatsapp-client.wasm target/wasm32-unknown-unknown/release/whatsapp_business_client.wasm
```

### Run Tests

```bash
cargo test
wasm-pack test --headless --firefox
```

## Troubleshooting

### Webhook Not Receiving Messages

1. Check webhook URL in Meta Business Manager
2. Verify verify_token matches
3. Check webhook subscription (messages, message_status)
4. View logs in `whatsapp_webhooks_log` table

### Owner Analytics Not Working

1. Verify owner phone number is added to `whatsapp_authorized_users`
2. Check OpenClaw API configuration
3. View `whatsapp_analytics_requests` for errors
4. Verify OpenClaw API key is valid

### Message Delivery Failed

1. Check access token validity
2. Verify phone number ID is correct
3. Check WhatsApp Business API rate limits
4. View message status in `whatsapp_messages` table

## Security Considerations

- **Credentials encrypted** at rest using AES-256-GCM
- **Webhook signature validation** prevents unauthorized access
- **Tenant isolation** enforced at database query level
- **Analytics authorization** via phone number whitelist
- **Rate limiting** on all endpoints

## Support

- **Email**: support@handsfree.tech
- **Forum**: https://community.handsfree.tech/c/plugins/whatsapp-business
- **Docs**: https://docs.handsfree.tech/plugins/whatsapp-business

## License

Proprietary - HandsFree POS Team

## Changelog

### v1.0.0 (2026-01-31)
- Initial release
- Tenant-specific WhatsApp messaging
- OpenClaw analytics integration
- Real-time WebSocket updates
- Media support
- Message templates

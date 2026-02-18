# Social Media Webhooks Router

Cloudflare Worker that receives webhooks from social media platforms (Instagram, TikTok, WhatsApp) and routes them to tenant devices via cloudflared tunnels.

## Architecture

```
Social Media Platform
        ↓
Cloudflare Worker (this service)
        ↓
Cloudflare Tunnel (per tenant)
        ↓
Local Device (Tauri app with Actix-web webhook server)
```

## Security Model

**IMPORTANT:** This worker does NOT verify webhook signatures. All signature verification happens on the local device using tenant-provided API secrets that are stored encrypted and never sent to the cloud.

This worker's role is **routing only**:
- Receives webhooks from platforms
- Looks up tenant tunnel URL from KV
- Forwards webhook with original headers to device
- Returns OK to prevent retries

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create KV Namespace

```bash
# Production namespace
wrangler kv:namespace create "TENANT_TUNNELS"

# Preview namespace for dev
wrangler kv:namespace create "TENANT_TUNNELS" --preview
```

Update the namespace IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "TENANT_TUNNELS"
id = "YOUR_PRODUCTION_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_NAMESPACE_ID"
```

### 3. Configure Custom Domain

Configure a custom domain in Cloudflare Dashboard:
- Domain: `webhooks.handsfree.com`
- Worker: `social-media-webhooks`

Or update the routes in `wrangler.toml`.

### 4. Deploy

```bash
# Deploy to production
npm run deploy:production

# Deploy to staging
npm run deploy:staging

# Dev mode (local)
npm run dev
```

## Webhook URLs

After deployment, tenants will register webhooks with social media platforms:

### Instagram
```
https://webhooks.handsfree.com/webhooks/instagram?tenant_id=TENANT_ID
```

### TikTok
```
https://webhooks.handsfree.com/webhooks/tiktok?tenant_id=TENANT_ID
```

### WhatsApp Business
```
https://webhooks.handsfree.com/webhooks/whatsapp?tenant_id=TENANT_ID
```

## API Endpoints

### `POST /register-tunnel`

Register a tenant's tunnel URL (called by device during setup).

**Request:**
```json
{
  "tenant_id": "tenant-123",
  "tunnel_url": "https://social-webhooks-tenant-123.handsfree.tech"
}
```

**Response:**
```json
{
  "success": true,
  "tenant_id": "tenant-123",
  "tunnel_url": "https://social-webhooks-tenant-123.handsfree.tech"
}
```

### `GET /tunnel-status?tenant_id=xxx`

Check if a tenant has registered a tunnel.

**Response:**
```json
{
  "success": true,
  "tenant_id": "tenant-123",
  "tunnel_registered": true,
  "tunnel_url": "https://social-webhooks-tenant-123.handsfree.tech"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "social-media-webhooks",
  "version": "1.0.0"
}
```

## Webhook Flow

### Instagram Webhook

1. **Verification (GET request)**
   - Instagram sends: `GET /webhooks/instagram?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=xxx&tenant_id=yyy`
   - Worker forwards to device tunnel: `GET https://tunnel-url/webhooks/instagram?hub.mode=...`
   - Device verifies token locally and returns challenge
   - Worker returns challenge to Instagram

2. **Event (POST request)**
   - Instagram sends: `POST /webhooks/instagram?tenant_id=xxx` with `X-Hub-Signature-256` header
   - Worker forwards to device with all original headers
   - Device verifies signature using locally-stored app secret
   - Worker returns OK to Instagram

### TikTok Webhook

1. **Event (POST request)**
   - TikTok sends: `POST /webhooks/tiktok?tenant_id=xxx` with `X-TikTok-Signature` and `X-TikTok-Timestamp` headers
   - Worker forwards to device with all original headers
   - Device verifies signature using locally-stored client secret
   - Worker returns OK to TikTok

### WhatsApp Webhook

Same flow as Instagram (uses Facebook Graph API webhooks).

## Monitoring

### View Logs

```bash
# Production logs
npm run tail:production

# Dev logs
npm run tail
```

### Metrics

Monitor in Cloudflare Dashboard:
- Request count per tenant
- Webhook delivery success rate
- Average response time
- Error rates

## Troubleshooting

### Webhook not received on device

1. Check if tunnel is registered:
   ```bash
   curl "https://webhooks.handsfree.com/tunnel-status?tenant_id=YOUR_TENANT_ID"
   ```

2. Check if tunnel is running on device:
   ```bash
   cloudflared tunnel info social-webhooks-YOUR_TENANT_ID
   ```

3. Check worker logs:
   ```bash
   wrangler tail --env production
   ```

### Verification failing

The worker forwards verification requests to the device. If verification fails:
1. Check device is online and tunnel is running
2. Check device's local webhook server is running (port 8787)
3. Check device has correct verify token configured

## Security Notes

- **No secrets in worker**: All API secrets and verify tokens stay on device
- **Signature verification on device**: Worker cannot verify signatures (doesn't have secrets)
- **HTTPS only**: All tunnel URLs must use HTTPS
- **Rate limiting**: Consider adding rate limiting per tenant if needed
- **Tenant isolation**: Each tenant has separate tunnel URL in KV

## Development

### Local Development

```bash
npm run dev
```

This starts a local worker at `http://localhost:8787`.

For testing with real webhooks, use ngrok or cloudflared tunnel:
```bash
cloudflared tunnel --url http://localhost:8787
```

### Testing

Use curl to simulate webhooks:

```bash
# Test Instagram webhook
curl -X POST "http://localhost:8787/webhooks/instagram?tenant_id=test" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d '{"object":"instagram","entry":[]}'
```

## License

MIT

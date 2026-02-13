# MSG91 Verify Worker - Deployment Guide

Complete guide to deploy and configure the MSG91 OTP verification worker.

## Prerequisites

- Cloudflare account with Workers enabled
- MSG91 account with API key
- Node.js 18+ and npm installed
- Wrangler CLI configured

## Step 1: Create KV Namespaces

Create KV namespaces for rate limiting:

```bash
cd platform/workers/msg91-verify

# Create development KV namespace
npm run kv:create

# Create production KV namespace
npm run kv:create:prod
```

You'll get output like:

```
Development:
  id = "abc123def456..."

Production:
  id = "xyz789uvw123..."
```

Update `wrangler.jsonc` with these IDs:

```jsonc
"kv_namespaces": [
  {
    "binding": "VERIFY_RATE_LIMIT",
    "id": "abc123def456..."  // Replace with your dev ID
  }
]

// And in the production env:
"env": {
  "production": {
    "kv_namespaces": [
      {
        "binding": "VERIFY_RATE_LIMIT",
        "id": "xyz789uvw123..."  // Replace with your prod ID
      }
    ]
  }
}
```

## Step 2: Get MSG91 Credentials

### Get Your API Key

Your API key is: `370406AINWfsxDGl69678664P1`

### Get Your Template ID

1. Login to [MSG91 Dashboard](https://control.msg91.com/)
2. Navigate to **Templates** → **OTP Templates**
3. Create a new OTP template or select existing:
   - **Template Name**: "Handsfree OTP"
   - **Message**: "Your verification code is ##OTP##. Valid for 10 minutes."
   - **Variable**: Use `##OTP##` for OTP placeholder
4. Copy the **Template ID** (format: `Template_ID_123456`)

## Step 3: Set Secrets

Set the MSG91 credentials as Cloudflare secrets:

```bash
# Development environment
npm run secret:put:auth
# When prompted, enter: 370406AINWfsxDGl69678664P1

npm run secret:put:template
# When prompted, enter: Your_Template_ID_From_Dashboard

# Production environment
npm run secret:put:auth:prod
# Enter: 370406AINWfsxDGl69678664P1

npm run secret:put:template:prod
# Enter: Your_Template_ID_From_Dashboard
```

Alternatively, use wrangler directly:

```bash
# Development
echo "370406AINWfsxDGl69678664P1" | wrangler secret put MSG91_AUTH_KEY
echo "Your_Template_ID" | wrangler secret put MSG91_TEMPLATE_ID

# Production
echo "370406AINWfsxDGl69678664P1" | wrangler secret put MSG91_AUTH_KEY --env production
echo "Your_Template_ID" | wrangler secret put MSG91_TEMPLATE_ID --env production
```

## Step 4: Configure DNS (Cloudflare Dashboard)

1. Go to Cloudflare Dashboard → Your Domain (handsfree.tech)
2. Navigate to **DNS** → **Records**
3. Add a DNS record:
   - **Type**: AAAA
   - **Name**: msg91-verify
   - **Content**: 100:: (IPv6 placeholder for Workers)
   - **Proxy status**: Proxied (orange cloud)
   - **TTL**: Auto

This will make the worker accessible at `https://msg91-verify.handsfree.tech`

## Step 5: Deploy the Worker

```bash
# Deploy to development
npm run deploy

# Deploy to production
npm run deploy:prod
```

Expected output:

```
✨ Successfully deployed to:
   https://msg91-verify.handsfree.tech/*
```

## Step 6: Test the Deployment

### Test Health Endpoint

```bash
curl https://msg91-verify.handsfree.tech/health
```

Expected response:

```json
{
  "success": true,
  "service": "handsfree-msg91-verify",
  "version": "1.0.0",
  "status": "operational",
  "provider": "MSG91",
  "timestamp": "2026-01-14T..."
}
```

### Test Send OTP

```bash
curl -X POST https://msg91-verify.handsfree.tech/verify/start \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "channel": "sms"
  }'
```

Expected response:

```json
{
  "success": true,
  "verificationSid": "34676b6d426b303131363537",
  "requestId": "34676b6d426b303131363537",
  "channel": "sms",
  "to": "+919876543210",
  "status": "pending",
  "message": "Verification code sent via sms"
}
```

### Test Verify OTP

After receiving the OTP on your phone:

```bash
curl -X POST https://msg91-verify.handsfree.tech/verify/check \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+919876543210",
    "code": "1234"
  }'
```

Expected response (if code is correct):

```json
{
  "success": true,
  "valid": true,
  "status": "approved",
  "to": "+919876543210",
  "channel": "sms",
  "message": "Verification successful"
}
```

## Step 7: Update Client Configuration

Update your client application to use MSG91:

### Option 1: Environment Variable

Add to your `.env` or `.env.local`:

```bash
NEXT_PUBLIC_VERIFY_PROVIDER=msg91
NEXT_PUBLIC_MSG91_VERIFY_URL=https://msg91-verify.handsfree.tech
```

### Option 2: Direct Code Update

The library already defaults to MSG91, so no changes needed if using default settings.

The phone verification library at `client/restaurant-client/lib/phone-verification.ts` now supports MSG91 by default.

## Step 8: Monitor and Maintain

### View Logs

Monitor the worker logs in real-time:

```bash
# Development
npm run tail

# Production
npm run tail:prod
```

### Check Metrics

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select `handsfree-msg91-verify-prod`
3. View metrics: Requests, Errors, CPU time, etc.

### Rate Limit Monitoring

Check current rate limits for a phone number:

```bash
curl "https://msg91-verify.handsfree.tech/verify/rate-limit?phone=%2B919876543210"
```

## Troubleshooting

### Error: "Auth Key missing" or "Invalid authkey"

- Verify the secret is set correctly:
  ```bash
  wrangler secret list
  wrangler secret list --env production
  ```
- Re-set the secret if needed:
  ```bash
  wrangler secret put MSG91_AUTH_KEY
  ```

### Error: "Template ID not found"

- Verify your template ID in MSG91 dashboard
- Ensure the template is active and approved
- Re-set the template ID secret:
  ```bash
  wrangler secret put MSG91_TEMPLATE_ID
  ```

### Error: "Invalid phone number format"

- Ensure phone numbers are in E.164 format
- Must start with `+` followed by country code
- Example: `+919876543210` (India), `+14155551234` (USA)

### OTP Not Received

- Check MSG91 dashboard for delivery status
- Verify phone number is valid and can receive SMS
- Check your MSG91 account balance
- Verify template is approved and active

### Rate Limit Issues

- Check current rate limits:
  ```bash
  curl "https://msg91-verify.handsfree.tech/verify/rate-limit?phone=<PHONE>"
  ```
- Clear rate limits (if needed) by deleting KV keys:
  ```bash
  wrangler kv:key delete "rate:<phone>:<timestamp>" --binding VERIFY_RATE_LIMIT
  ```

## Security Best Practices

1. **Never commit secrets**: Keep API keys in Cloudflare secrets
2. **Use rate limiting**: Already implemented (5/hour, 10/day)
3. **Monitor usage**: Set up alerts in MSG91 dashboard
4. **Rotate keys**: Periodically rotate your MSG91 API key
5. **Test in dev first**: Always test in development before production

## Cost Considerations

MSG91 OTP pricing (as of 2026):

- **India SMS**: ~₹0.15 per OTP
- **International SMS**: Varies by country
- **WhatsApp**: Lower cost than SMS

Monitor your usage in MSG91 dashboard to track costs.

## Next Steps

1. ✅ Worker deployed and tested
2. ✅ Client app configured to use MSG91
3. 📱 Test with real phone numbers
4. 🔍 Monitor logs and metrics
5. 📊 Set up alerts for errors/rate limits
6. 🔄 Consider adding WhatsApp channel support

## Support

- **MSG91 Documentation**: [docs.msg91.com/otp](https://docs.msg91.com/otp)
- **MSG91 Support**: support@msg91.com
- **Cloudflare Workers Docs**: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)

## Complete Setup Checklist

- [ ] KV namespaces created and configured
- [ ] MSG91 API key set as secret
- [ ] MSG91 template ID set as secret
- [ ] DNS record added for msg91-verify.handsfree.tech
- [ ] Worker deployed to production
- [ ] Health endpoint tested successfully
- [ ] Send OTP tested successfully
- [ ] Verify OTP tested successfully
- [ ] Client app configured with MSG91 provider
- [ ] Monitoring set up (logs, metrics, alerts)
- [ ] Documentation updated for team

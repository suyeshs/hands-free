# WhatsApp OTP Verification Worker

Direct Meta WhatsApp Business API integration for customer phone verification.
Bypasses Twilio for cost savings and no trial account limitations.

## Features

- **Copy Code Button**: Users receive OTP with one-tap copy functionality
- **Self-hosted OTP**: Codes generated and stored in Cloudflare KV (not Meta)
- **Rate Limiting**: 5 attempts/hour, 10 attempts/day
- **No Trial Limitations**: Works with any phone number (unlike Twilio trial)
- **Cost Effective**: ~1/3 the cost of Twilio per authentication

## Prerequisites

1. **Meta Business Account** - Verified business
2. **WhatsApp Business Account** - Connected to Meta Business
3. **Authentication Template** - Created and approved in Meta Business Manager

## Setup Steps

### 1. Create Authentication Template in Meta Business Manager

Go to: [Meta Business Manager > WhatsApp Manager > Message Templates](https://business.facebook.com/wa/manage/message-templates/)

Create a new template:
- **Category**: Authentication
- **Name**: `handsfreeauth` (or your preferred name)
- **Language**: English (US) - add others as needed
- **Body**: Use Meta's preset authentication body (auto-filled)
- **Button**: Copy Code

The template will look like:
```
{{1}} is your verification code.

For your security, do not share this code.

[Copy Code]
```

### 2. Get API Credentials

From [Meta for Developers](https://developers.facebook.com/apps/):

1. **Phone Number ID**: WhatsApp > API Setup > Phone Number ID
2. **Access Token**: Generate a permanent token with `whatsapp_business_messaging` permission
3. **WABA ID**: WhatsApp Business Account ID (optional)

### 3. Deploy Worker

```bash
cd platform/workers/whatsapp-verify

# Install dependencies
npm install

# Set secrets
npx wrangler secret put META_ACCESS_TOKEN --env production
# Paste your access token

npx wrangler secret put META_PHONE_NUMBER_ID --env production
# Paste your phone number ID

npx wrangler secret put AUTH_TEMPLATE_NAME --env production
# Enter: handsfreeauth (or your template name)

# Deploy
npm run deploy:prod
```

### 4. Test

```bash
# Health check
curl https://handsfree-whatsapp-verify-prod.suyesh.workers.dev/health

# Send OTP (replace with a real number)
curl -X POST https://handsfree-whatsapp-verify-prod.suyesh.workers.dev/verify/start \
  -H "Content-Type: application/json" \
  -d '{"to": "+919900024260"}'

# Verify OTP
curl -X POST https://handsfree-whatsapp-verify-prod.suyesh.workers.dev/verify/check \
  -H "Content-Type: application/json" \
  -d '{"to": "+919900024260", "code": "123456"}'
```

## API Endpoints

### POST /verify/start
Start verification - sends OTP via WhatsApp

**Request:**
```json
{
  "to": "+919900024260",
  "locale": "en"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "verificationId": "ver_1234567890_abc123",
  "to": "+919900024260",
  "status": "pending",
  "message": "Verification code sent via WhatsApp",
  "expiresAt": "2025-12-23T18:00:00.000Z"
}
```

### POST /verify/check
Verify the OTP code

**Request:**
```json
{
  "to": "+919900024260",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "status": "approved",
  "to": "+919900024260",
  "message": "Verification successful"
}
```

### GET /verify/rate-limit?phone={phone}
Check rate limit status for a phone number

## Cost Comparison

| Provider | Authentication Cost |
|----------|-------------------|
| Twilio SMS | ~$0.0075/message + Twilio fee |
| Twilio WhatsApp | ~$0.005/message + Twilio fee |
| **Meta Direct** | **~$0.002/message** |

Meta's authentication templates are priced at ~1/3 of other message categories.

## Troubleshooting

### Template Not Approved
- Ensure template category is "Authentication"
- Use Meta's preset body text (cannot be customized)
- Wait 24-48 hours for approval

### Message Not Delivered
- Check phone number format (E.164: +919900024260)
- Verify user has WhatsApp installed
- Check Meta Business Manager for delivery reports

### Rate Limited
- Default: 5/hour, 10/day per phone number
- 24-hour block after daily limit
- Check `/verify/rate-limit` endpoint

## Architecture

```
Client App
    ↓
WhatsApp Verify Worker (Cloudflare)
    ↓
├── Generate OTP (6 digits)
├── Store in KV (10 min expiry)
├── Send via Meta Graph API
    ↓
Meta WhatsApp Cloud API
    ↓
User's WhatsApp (Copy Code button)
    ↓
User enters code in Client App
    ↓
WhatsApp Verify Worker validates against KV
```

## Migration from Twilio

To switch from Twilio to WhatsApp verification:

1. Deploy this worker
2. Update client library to call new endpoint
3. Keep Twilio as SMS fallback (optional)
4. Update UI to show "WhatsApp" instead of "SMS"

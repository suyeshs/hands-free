# Handsfree Twilio Verify Worker

Cloudflare Worker for phone verification using Twilio Verify API with support for SMS and WhatsApp channels.

## Features

- ✅ **SMS Verification** - Send verification codes via SMS
- ✅ **WhatsApp Verification** - Send verification codes via WhatsApp
- ✅ **Rate Limiting** - Prevent abuse with automatic rate limiting
- ✅ **E.164 Format Validation** - Validate phone numbers automatically
- ✅ **Multi-locale Support** - Send verification messages in different languages
- ✅ **CORS Enabled** - Ready for cross-origin requests
- ✅ **API Key Auth** - Support for Twilio API Keys (recommended for production)

## Architecture

This worker integrates with Twilio Verify API v2 to provide phone verification services for the Handsfree Platform.

```
┌──────────────┐       ┌───────────────────┐       ┌──────────────┐
│ Client App   │──────▶│ Twilio Verify     │──────▶│ Twilio API   │
│              │◀──────│ Worker            │◀──────│              │
└──────────────┘       └───────────────────┘       └──────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ KV Namespace │
                       │ Rate Limits  │
                       └──────────────┘
```

## API Endpoints

### 1. Health Check

```
GET /health
```

Returns service health status.

**Response:**
```json
{
  "success": true,
  "service": "handsfree-twilio-verify",
  "version": "1.0.0",
  "status": "operational",
  "timestamp": "2025-12-05T13:00:00.000Z"
}
```

### 2. Start Verification

```
POST /verify/start
```

Initiates a verification by sending a code via SMS or WhatsApp.

**Request Body:**
```json
{
  "to": "+14155551234",
  "channel": "sms",
  "locale": "en"
}
```

**Parameters:**
- `to` (required): Phone number in E.164 format (e.g., +14155551234)
- `channel` (required): Verification channel - "sms" or "whatsapp"
- `locale` (optional): Language code for message (e.g., "en", "es", "fr")

**Response:**
```json
{
  "success": true,
  "verificationSid": "VExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "channel": "sms",
  "to": "+14155551234",
  "status": "pending",
  "message": "Verification code sent via sms"
}
```

**Rate Limits:**
- 5 attempts per hour per phone number
- 10 attempts per day per phone number
- Phone number blocked for 24 hours after exceeding daily limit

**Error Response (429 - Rate Limited):**
```json
{
  "success": false,
  "error": "Too many attempts. Maximum 5 per hour",
  "retryAfter": 3600
}
```

### 3. Check Verification

```
POST /verify/check
```

Verifies the code entered by the user.

**Request Body:**
```json
{
  "to": "+14155551234",
  "code": "123456"
}
```

**Parameters:**
- `to` (required): Phone number in E.164 format
- `code` (required): The verification code entered by the user

**Response (Success):**
```json
{
  "success": true,
  "status": "approved",
  "valid": true,
  "to": "+14155551234",
  "channel": "sms",
  "message": "Verification successful"
}
```

**Response (Invalid Code):**
```json
{
  "success": false,
  "status": "pending",
  "valid": false,
  "to": "+14155551234",
  "channel": "sms",
  "message": "Invalid or expired verification code"
}
```

### 4. Check Rate Limit

```
GET /verify/rate-limit?phone=+14155551234
```

Returns rate limit information for a phone number.

**Response:**
```json
{
  "success": true,
  "attempts": 2,
  "lastAttempt": 1733410800000,
  "blocked": false
}
```

## Setup & Deployment

### Prerequisites

1. **Twilio Account** - Sign up at [twilio.com](https://www.twilio.com)
2. **Twilio Verify Service** - Create a Verify service in Twilio Console
3. **Cloudflare Account** - With Workers enabled
4. **Wrangler CLI** - Install with `npm install -g wrangler`

### 1. Install Dependencies

```bash
npm install
```

### 2. Create KV Namespace

```bash
# Production
wrangler kv:namespace create "VERIFICATION_ATTEMPTS"

# Copy the ID and update wrangler.toml
```

### 3. Set Twilio Secrets

```bash
# Required secrets
wrangler secret put TWILIO_ACCOUNT_SID --env production
# Enter your Twilio Account SID

wrangler secret put TWILIO_AUTH_TOKEN --env production
# Enter your Twilio Auth Token

wrangler secret put TWILIO_VERIFY_SERVICE_SID --env production
# Enter your Twilio Verify Service SID

# Optional: API Key authentication (recommended for production)
wrangler secret put TWILIO_API_KEY_SID --env production
# Enter your Twilio API Key SID

wrangler secret put TWILIO_API_KEY_SECRET --env production
# Enter your Twilio API Key Secret
```

### 4. Deploy

```bash
# Deploy to production
npm run deploy:production

# Or deploy to development
npm run deploy
```

## Configuration

### Environment Variables

Set in `wrangler.toml`:

- `SERVICE_VERSION` - Service version (default: "1.0.0")
- `VERIFICATION_CODE_LENGTH` - Length of verification code (default: "6")
- `VERIFICATION_EXPIRY_SECONDS` - Code expiry time (default: "600" = 10 minutes)

### Rate Limiting

Configure in `src/rate-limiter.ts`:

- `MAX_ATTEMPTS_PER_HOUR` - Maximum attempts per hour (default: 5)
- `MAX_ATTEMPTS_PER_DAY` - Maximum attempts per day (default: 10)
- `BLOCK_DURATION_HOURS` - Block duration after exceeding daily limit (default: 24)

## Twilio Setup Guide

### 1. Create Twilio Account

1. Sign up at [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Verify your email and phone number
3. Navigate to the Twilio Console

### 2. Create Verify Service

1. Go to **Verify** > **Services** in the Twilio Console
2. Click **Create new Service**
3. Enter a friendly name (e.g., "Handsfree Verification")
4. Configure settings:
   - **Code Length**: 6 digits
   - **Code Expiration**: 10 minutes
   - **Max Attempts**: 5
5. Save the **Service SID** (starts with "VA")

### 3. Enable WhatsApp (Optional)

1. In your Verify Service, go to **Settings**
2. Enable **WhatsApp** channel
3. Follow Twilio's WhatsApp setup guide
4. Add your WhatsApp Business Profile

### 4. Create API Key (Recommended)

For production, use API Keys instead of Auth Token:

1. Go to **Account** > **API keys & tokens**
2. Click **Create API key**
3. Enter a friendly name
4. Select **Standard** key type
5. Save the **API Key SID** and **Secret** (shown once!)

## Usage Examples

### JavaScript/TypeScript

```typescript
// Start verification via SMS
const startResponse = await fetch('https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+14155551234',
    channel: 'sms',
  }),
});

const startData = await startResponse.json();
console.log(startData);

// Check verification code
const checkResponse = await fetch('https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+14155551234',
    code: '123456',
  }),
});

const checkData = await checkResponse.json();
console.log(checkData);
```

### cURL

```bash
# Start verification
curl -X POST https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/start \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155551234", "channel": "sms"}'

# Check verification
curl -X POST https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/check \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155551234", "code": "123456"}'
```

## Security

### Best Practices

1. **Use API Keys** - Use Twilio API Keys instead of Auth Token for production
2. **Rate Limiting** - Built-in rate limiting prevents abuse
3. **E.164 Validation** - Phone numbers are validated before processing
4. **HTTPS Only** - All communication over HTTPS
5. **Environment Variables** - Sensitive data stored as Cloudflare secrets

### Rate Limiting

The worker automatically implements rate limiting:
- **5 attempts per hour** per phone number
- **10 attempts per day** per phone number
- **24-hour block** after exceeding daily limit

Rate limit data is stored in Cloudflare KV with automatic expiration.

## Integration with Handsfree Platform

This worker is designed to integrate seamlessly with the Handsfree Platform:

```typescript
// In admin-app or restaurant-client
import { verifyPhone } from '@/lib/phone-verification';

async function onboardUser(phoneNumber: string) {
  // Start verification
  await verifyPhone.start(phoneNumber, 'sms');
  
  // Show verification input to user
  const code = await getUserInput();
  
  // Check verification
  const result = await verifyPhone.check(phoneNumber, code);
  
  if (result.valid) {
    // Proceed with onboarding
    await createUserAccount();
  }
}
```

## Monitoring

### Health Check

Monitor service health:
```bash
curl https://handsfree-twilio-verify-prod.suyesh.workers.dev/health
```

### Cloudflare Analytics

View metrics in Cloudflare Dashboard:
- Request count
- Error rate
- Response time
- Geographic distribution

### Wrangler Tail

View real-time logs:
```bash
wrangler tail handsfree-twilio-verify-prod
```

## Troubleshooting

### Common Issues

1. **"Invalid phone number format"**
   - Ensure phone number is in E.164 format (+14155551234)
   - Include country code with + prefix

2. **"Too many attempts"**
   - Rate limit exceeded
   - Wait for retry period or contact support

3. **"Twilio API error"**
   - Check Twilio credentials are correct
   - Verify Twilio service is active
   - Check account balance

4. **WhatsApp not working**
   - Verify WhatsApp is enabled in Twilio Verify Service
   - Ensure WhatsApp Business Profile is configured
   - Check WhatsApp sender is approved

## Cost Estimation

Twilio Verify pricing (as of 2025):
- **SMS**: $0.05 per verification
- **WhatsApp**: $0.005 per verification

Example monthly cost for 10,000 verifications:
- SMS: 10,000 × $0.05 = $500
- WhatsApp: 10,000 × $0.005 = $50

Cloudflare Workers:
- First 100,000 requests/day: Free
- Additional requests: $0.50 per million

## Documentation Links

- [Twilio Verify API Docs](https://www.twilio.com/docs/verify/api)
- [Twilio API Keys](https://www.twilio.com/docs/iam/api-keys)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [E.164 Phone Number Format](https://en.wikipedia.org/wiki/E.164)

## License

Proprietary - Handsfree Platform

---

**Version**: 1.0.0  
**Last Updated**: December 5, 2025

# MSG91 Verify Worker

Phone number verification service using MSG91 OTP API for the Handsfree restaurant platform.

## Features

- **SMS OTP Verification**: Send and verify OTP codes via SMS
- **WhatsApp Support**: MSG91 supports WhatsApp OTP (future enhancement)
- **Rate Limiting**: Prevents abuse with hourly and daily limits
- **E.164 Format**: Supports international phone numbers
- **4-digit OTP**: Fast and user-friendly verification codes
- **10-minute Expiry**: Secure OTP expiration window

## Setup

### 1. Create KV Namespace

Create a KV namespace for rate limiting:

```bash
# Development
npm run kv:create

# Production
npm run kv:create:prod
```

Update the KV namespace IDs in `wrangler.jsonc` with the IDs returned.

### 2. Set MSG91 Credentials

Set your MSG91 API credentials as secrets:

```bash
# Development
npm run secret:put:auth
# Enter: 370406AINWfsxDGl69678664P1

npm run secret:put:template
# Enter: Your MSG91 template ID from dashboard

# Production
npm run secret:put:auth:prod
npm run secret:put:template:prod
```

### 3. Get MSG91 Template ID

1. Login to [MSG91 Dashboard](https://control.msg91.com/)
2. Navigate to **OTP** section
3. Create or select an OTP template
4. Copy the Template ID

### 4. Deploy

```bash
# Development
npm run deploy

# Production
npm run deploy:prod
```

## API Endpoints

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "success": true,
  "service": "handsfree-msg91-verify",
  "version": "1.0.0",
  "status": "operational",
  "provider": "MSG91",
  "timestamp": "2026-01-14T12:00:00.000Z"
}
```

### Start Verification

Send an OTP code to a phone number.

```bash
POST /verify/start
Content-Type: application/json

{
  "to": "+919876543210",
  "channel": "sms",
  "locale": "en"
}
```

**Response:**
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

### Check Verification

Verify the OTP code entered by the user.

```bash
POST /verify/check
Content-Type: application/json

{
  "to": "+919876543210",
  "code": "1234"
}
```

**Response (Success):**
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

**Response (Failed):**
```json
{
  "success": false,
  "valid": false,
  "status": "canceled",
  "to": "+919876543210",
  "channel": "sms",
  "message": "Invalid or expired verification code"
}
```

### Rate Limit Check

Check the current rate limit status for a phone number.

```bash
GET /verify/rate-limit?phone=+919876543210
```

**Response:**
```json
{
  "success": true,
  "allowed": true,
  "attemptsRemaining": {
    "hourly": 4,
    "daily": 9
  }
}
```

## Rate Limits

- **Hourly Limit**: 5 attempts per phone number
- **Daily Limit**: 10 attempts per phone number
- **Block Duration**: 24 hours after exceeding daily limit

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_PHONE` | Phone number not provided |
| `MISSING_FIELDS` | Required fields missing |
| `INVALID_PHONE_FORMAT` | Phone number not in E.164 format |
| `RATE_LIMIT_EXCEEDED` | Too many verification attempts |
| `VERIFICATION_FAILED` | Failed to send OTP |
| `VERIFICATION_CHECK_FAILED` | Failed to verify OTP |

## MSG91 API Details

- **Send OTP**: `POST https://control.msg91.com/api/v5/otp`
- **Verify OTP**: `GET https://control.msg91.com/api/v5/otp/verify`
- **Documentation**: [docs.msg91.com/otp](https://docs.msg91.com/otp)

## Testing

```bash
# Send OTP
curl -X POST https://msg91-verify.handsfree.tech/verify/start \
  -H "Content-Type: application/json" \
  -d '{"to": "+919876543210", "channel": "sms"}'

# Verify OTP
curl -X POST https://msg91-verify.handsfree.tech/verify/check \
  -H "Content-Type: application/json" \
  -d '{"to": "+919876543210", "code": "1234"}'
```

## Monitoring

View logs in real-time:

```bash
# Development
npm run tail

# Production
npm run tail:prod
```

## Integration

Update your client application to use the MSG91 verify worker:

```typescript
const VERIFY_API_URL = 'https://msg91-verify.handsfree.tech';
```

See the main phone verification library at:
`client/restaurant-client/lib/phone-verification.ts`

## Sources

- [MSG91 SendOTP Documentation](https://docs.msg91.com/otp/sendotp)
- [MSG91 Verify OTP Documentation](https://docs.msg91.com/otp/verify-otp)
- [MSG91 Main OTP Docs](https://docs.msg91.com/otp)

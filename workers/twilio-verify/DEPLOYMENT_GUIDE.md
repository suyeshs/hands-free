# Twilio Verify Worker - Deployment Guide

## Quick Start Deployment

### Step 1: Create KV Namespace

```bash
# Create KV namespace for rate limiting
wrangler kv:namespace create "VERIFICATION_ATTEMPTS"

# Output will show:
# { binding = "VERIFICATION_ATTEMPTS", id = "your-kv-id" }

# Copy the ID and update wrangler.toml line 18
```

### Step 2: Set Secrets

You have the following Twilio credentials:

**API Key SID**: `SK________________________________`  
**API Key Secret**: `Zweh1NlH7OuuOfp72uFd2ouqlE2cdNAM`

You'll also need from your Twilio account:
- Account SID (starts with "AC")
- Verify Service SID (starts with "VA")

Set the secrets:

```bash
# Set Twilio Account SID
wrangler secret put TWILIO_ACCOUNT_SID
# Paste your Account SID (AC...)

# Set Twilio Auth Token (only if not using API Keys)
wrangler secret put TWILIO_AUTH_TOKEN
# Paste your Auth Token

# Set Twilio API Key SID (recommended)
wrangler secret put TWILIO_API_KEY_SID
# Paste: SK________________________________

# Set Twilio API Key Secret (recommended)
wrangler secret put TWILIO_API_KEY_SECRET
# Paste: Zweh1NlH7OuuOfp72uFd2ouqlE2cdNAM

# Set Twilio Verify Service SID
wrangler secret put TWILIO_VERIFY_SERVICE_SID
# Paste your Verify Service SID (VA...)
```

### Step 3: Deploy

```bash
# Deploy to production
npm run deploy:production
```

### Step 4: Test

```bash
# Test health endpoint
curl https://handsfree-twilio-verify-prod.suyesh.workers.dev/health

# Test verification (replace with your phone number)
curl -X POST https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/start \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "channel": "sms"}'
```

## Twilio Setup Checklist

### ✅ If you already have these:

- [ ] Twilio Account SID
- [ ] Twilio Auth Token
- [ ] Twilio Verify Service SID
- [ ] API Key (provided above)

### 🔧 If you need to set up:

1. **Create Verify Service** (if you don't have one):
   - Go to [Twilio Verify Console](https://www.twilio.com/console/verify/services)
   - Click "Create new Service"
   - Name: "Handsfree Verification"
   - Save the Service SID (starts with "VA")

2. **Get Account SID**:
   - Go to [Twilio Console](https://www.twilio.com/console)
   - Find "Account SID" on the dashboard
   - Starts with "AC"

3. **Get Auth Token**:
   - Same location as Account SID
   - Click to reveal the Auth Token

## Production Deployment

```bash
# 1. Install dependencies
npm install

# 2. Create KV namespace (if not done)
wrangler kv:namespace create "VERIFICATION_ATTEMPTS" --env production

# 3. Update wrangler.toml with KV ID

# 4. Set all secrets (see Step 2 above)

# 5. Deploy
wrangler deploy --env production
```

## Verify Deployment

```bash
# 1. Check health
curl https://handsfree-twilio-verify-prod.suyesh.workers.dev/health

# 2. Check rate limit for a phone number
curl "https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/rate-limit?phone=%2B14155551234"

# 3. Start verification (use your real phone number for testing)
curl -X POST https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/start \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155551234", "channel": "sms"}'

# 4. Check verification code (replace with code you received)
curl -X POST https://handsfree-twilio-verify-prod.suyesh.workers.dev/verify/check \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155551234", "code": "123456"}'
```

## Monitoring

```bash
# View live logs
wrangler tail handsfree-twilio-verify-prod
```

## Troubleshooting

### "Missing TWILIO_VERIFY_SERVICE_SID"

You need to create a Verify Service in Twilio:
1. Go to https://www.twilio.com/console/verify/services
2. Create new service
3. Copy the Service SID
4. Set it as a secret: `wrangler secret put TWILIO_VERIFY_SERVICE_SID`

### "Authentication failed"

Check that all secrets are set correctly:
```bash
wrangler secret list
```

Should show:
- TWILIO_ACCOUNT_SID
- TWILIO_API_KEY_SID
- TWILIO_API_KEY_SECRET
- TWILIO_VERIFY_SERVICE_SID

### "Rate limit exceeded"

This is normal behavior. Rate limits are:
- 5 attempts per hour
- 10 attempts per day
- 24-hour block after daily limit

---

**Worker URL**: https://handsfree-twilio-verify-prod.suyesh.workers.dev  
**Documentation**: See README.md

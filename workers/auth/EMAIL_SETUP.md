# Email Setup Guide - MailChannels with Cloudflare Workers

## ✅ What's Configured

Your authentication system now sends magic link emails using:
- **MailChannels** (Free email API for Cloudflare Workers)
- **Sender Domain**: `noreply@handsfree.tech`
- **From Name**: Stonepot Admin
- **Email Template**: Professional HTML with security best practices

## 📋 Required DNS Records

To ensure emails are **delivered** and not marked as spam, add these DNS records to `handsfree.tech`:

### 1. SPF Record (Sender Policy Framework)
Authorizes MailChannels to send emails on your behalf.

```
Type: TXT
Name: handsfree.tech (or @)
Value: v=spf1 include:relay.mailchannels.net ~all
TTL: 3600 (Auto is fine)
```

### 2. Domain Verification (MailChannels)
Proves you own the domain.

```
Type: TXT
Name: _mailchannels.handsfree.tech
Value: v=mc1 cfid=stonepot-oauth.suyesh.workers.dev
TTL: 3600
```

### 3. DMARC Policy (Email Authentication Reporting)
Tells email providers how to handle unauthorized emails.

```
Type: TXT
Name: _dmarc.handsfree.tech
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@handsfree.tech; pct=100; adkim=s; aspf=s
TTL: 3600
```

### 4. (Optional) DKIM Record
Adds cryptographic signature to emails.

MailChannels will provide this if you need it for enterprise use. For now, SPF + DMARC is sufficient.

## 🚀 How to Add DNS Records in Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select domain: `handsfree.tech`
3. Go to **DNS** → **Records**
4. Click **Add record** for each of the above
5. Wait 5-10 minutes for propagation

## 🧪 Test Email Delivery

After adding DNS records, test the magic link flow:

1. Visit: https://5656e366.stonepot-admin.pages.dev
2. Click "Sign in with Email Magic Link"
3. Enter your email
4. Check your inbox (and spam folder)
5. Click the magic link in the email

## 📧 Email Preview

Your users will receive:

**Subject**: Sign in to Stonepot Admin

**Content**:
- Clean, professional HTML design
- Blue CTA button: "Sign In to Admin Dashboard"
- Plain text fallback for email clients
- 15-minute expiration notice
- Security footer

## 🔒 Security Features

- ✅ **SPF Authentication** - Prevents email spoofing
- ✅ **DMARC Policy** - Protects your domain reputation
- ✅ **HTTPS Links** - All magic links use HTTPS
- ✅ **15-Minute Expiry** - Short-lived tokens
- ✅ **One-Time Use** - Links cannot be reused
- ✅ **Rate Limiting** - Prevents abuse (built into Workers)

## 🛠️ Troubleshooting

### Emails Not Arriving?

1. **Check DNS propagation**: Use [DNS Checker](https://dnschecker.org)
   - Search for: `handsfree.tech TXT`
   - Verify SPF record exists

2. **Check spam folder**: MailChannels has good reputation, but new domains may be filtered initially

3. **Check Worker logs**:
   ```bash
   cd stonepot-auth
   npx wrangler tail stonepot-oauth
   ```
   Look for `[Email] Magic link sent successfully`

4. **Fallback**: If emails fail, the magic link is logged to Worker console for development

### Improving Deliverability

1. **Add DKIM** (optional): Contact MailChannels support
2. **Warm up domain**: Send a few test emails first
3. **Monitor**: Check DMARC reports at configured email
4. **Use verified email for testing**: Gmail/Outlook usually works best

## 📊 Cost

- **MailChannels**: FREE (3,000 emails/day for Cloudflare Workers)
- **Cloudflare DNS**: FREE
- **Total**: $0/month 🎉

## 🎯 Next Steps

1. ✅ Add DNS records above
2. ✅ Wait 10 minutes
3. ✅ Test magic link flow
4. ✅ Monitor first few emails
5. ✅ Update `FROM_EMAIL` in `src/email.ts` if you want different sender (e.g., `admin@handsfree.tech`)

## 📞 Support

If emails still don't work after 24 hours:
- Check [MailChannels Status](https://status.mailchannels.com)
- Review [Cloudflare Workers Email Docs](https://developers.cloudflare.com/workers/examples/send-emails-with-mailchannels)
- Check SPF/DMARC records at [MXToolbox](https://mxtoolbox.com)


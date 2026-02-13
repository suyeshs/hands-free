# Consent Management - Quick Start Guide

## What is this?

A **production-ready consent management library** that makes your restaurant POS compliant with:
- 🇪🇺 **GDPR** (European Union)
- 🇮🇳 **DPDP Act** (India - Digital Personal Data Protection Act, 2023)
- 🇺🇸 **CCPA** (California)
- 🇧🇷 **LGPD** (Brazil)
- And more...

## Why do you need this?

**Legal requirement**: If you collect customer data (names, phone numbers, email addresses, location), you MUST:
1. Get explicit consent from users
2. Allow them to withdraw consent anytime
3. Let them export/delete their data
4. Keep audit trails of all consents

**Penalties for non-compliance**:
- GDPR: Up to €20 million or 4% of annual revenue
- DPDP: Up to ₹250 crores (INR)
- CCPA: Up to $7,500 per violation

## 5-Minute Setup

### Step 1: Initialize (Do this ONCE at app startup)

```typescript
// src/main.tsx or App.tsx
import { initializeConsentManager, PrivacyRegulation } from '@/lib/consent';

await initializeConsentManager({
  app_name: 'Guanix Restaurant POS',
  app_version: '1.0.0',
  organization: {
    name: 'Your Restaurant',
    legal_name: 'Your Restaurant Pvt Ltd',
    contact_email: 'privacy@yourrestaurant.com',
  },
  regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.DPDP],
  default_regulation: PrivacyRegulation.DPDP, // India
  default_language: 'en',
  supported_languages: ['en', 'hi'], // Hindi required for DPDP
  storage_backend: 'sqlite',
  encrypt_records: true,
}, 'sqlite:consent.db');
```

### Step 2: Show consent dialog to new users

```typescript
import { ConsentDialog, ConsentPurpose } from '@/lib/consent';

function App() {
  const [showConsent, setShowConsent] = useState(true);

  return (
    <ConsentDialog
      open={showConsent}
      onClose={() => setShowConsent(false)}
      request={{
        purposes: [
          ConsentPurpose.MARKETING_EMAIL,
          ConsentPurpose.ANALYTICS,
        ],
        regulation: PrivacyRegulation.DPDP,
        device_id: 'your-device-id',
        allow_granular: true,
      }}
      blocking={true} // User must respond
    />
  );
}
```

### Step 3: Check consent before using data

```typescript
import { getConsentManager, ConsentPurpose } from '@/lib/consent';

// Before sending marketing email
const manager = getConsentManager();
const canSendEmail = await manager.hasConsent(
  userId,
  deviceId,
  ConsentPurpose.MARKETING_EMAIL
);

if (canSendEmail) {
  await sendEmail(user);
} else {
  console.log('No consent - cannot send email');
}
```

### Step 4: Add Privacy Settings page

```typescript
import { PrivacySettings } from '@/lib/consent';

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <PrivacySettings userId={userId} deviceId={deviceId} />
    </div>
  );
}
```

## That's it!

You're now compliant with major privacy regulations.

## Common Use Cases

### 1. Check consent before tracking analytics

```typescript
const canTrack = await manager.hasConsent(userId, deviceId, ConsentPurpose.ANALYTICS);
if (canTrack) {
  analytics.track('page_view');
}
```

### 2. Check consent before using location

```typescript
const canUseLocation = await manager.hasConsent(userId, deviceId, ConsentPurpose.LOCATION_BASED);
if (canUseLocation) {
  const location = await getCurrentLocation();
}
```

### 3. Handle data export request (GDPR Article 15)

```typescript
const data = await manager.exportUserData(userId);
// Download as JSON file
```

### 4. Handle data deletion request (GDPR Article 17)

```typescript
await manager.eraseUserData(userId, 'User requested deletion');
```

## For Admins: Compliance Reports

```typescript
import { ComplianceReport } from '@/lib/consent';

function AdminDashboard() {
  return <ComplianceReport />;
}
```

Generates reports showing:
- Total consents collected
- Consent rates by purpose
- Compliance issues
- Audit trail summary

## Next Steps

1. Read the full documentation: [README.md](../../src/lib/consent/README.md)
2. See integration examples: [INTEGRATION_EXAMPLE.tsx](../../src/lib/consent/INTEGRATION_EXAMPLE.tsx)
3. Customize consent purposes for your needs
4. Train staff on privacy policies
5. Schedule quarterly compliance audits

## Need Help?

- 📖 Full docs: `/src/lib/consent/README.md`
- 💻 Code examples: `/src/lib/consent/INTEGRATION_EXAMPLE.tsx`
- 🗄️ Database schema: `/src/lib/consent/schema.sql`

## Legal Disclaimer

This library helps implement consent management but does NOT guarantee legal compliance.
You should:
- Consult with legal counsel
- Conduct privacy impact assessments
- Update privacy policies
- Train staff on GDPR/DPDP requirements

---

**Your data is private. Your customers will thank you.** 🔒

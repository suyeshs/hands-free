# Universal Consent Management Library

A comprehensive, regulation-compliant consent management system for **GDPR** (EU), **DPDP Act** (India), **CCPA** (California), **LGPD** (Brazil), and other privacy regulations.

## Features

✅ **Multi-regulation support** - GDPR, DPDP, CCPA, LGPD, PIPEDA, POPIA, APPI
✅ **Granular consent management** - 20+ consent purposes
✅ **End-to-end encryption ready** - Works with encrypted data storage
✅ **Audit trail** - Immutable logs of all consent changes
✅ **Data subject rights** - Access, erasure, portability (GDPR Art. 15-22)
✅ **Compliance reporting** - Generate regulatory reports
✅ **Expiration & renewal** - Auto-expire consents per regulation
✅ **React UI components** - Ready-to-use consent dialogs
✅ **TypeScript** - Fully typed for safety
✅ **Cross-platform** - Works on web, desktop (Tauri), mobile

## Installation

The library is already included in this project. If you want to use it in another project:

```bash
# Core dependencies
npm install @tauri-apps/plugin-sql uuid date-fns

# React UI dependencies (if using React components)
npm install lucide-react
```

## Quick Start

### 1. Initialize ConsentManager

```typescript
import { initializeConsentManager, PrivacyRegulation } from '@/lib/consent/ConsentManager';
import { ConsentPurpose } from '@/lib/consent/types';

// Initialize once at app startup
const manager = await initializeConsentManager({
  app_name: 'My Restaurant POS',
  app_version: '1.0.0',
  organization: {
    name: 'My Restaurant',
    legal_name: 'My Restaurant Pvt Ltd',
    contact_email: 'privacy@myrestaurant.com',
    dpo_email: 'dpo@myrestaurant.com', // Data Protection Officer
  },
  regulations: [PrivacyRegulation.GDPR, PrivacyRegulation.DPDP],
  default_regulation: PrivacyRegulation.GDPR,
  consent_configs: [], // Will use defaults from database
  default_language: 'en',
  supported_languages: ['en', 'hi', 'es', 'pt'],
  storage_backend: 'sqlite',
  encrypt_records: true,
  ui_theme: 'auto',
  ui_position: 'modal',
}, 'sqlite:consent.db');
```

### 2. Request Consent from User

```typescript
import { ConsentDialog } from '@/components/consent/ConsentDialog';
import { ConsentPurpose, PrivacyRegulation } from '@/lib/consent/types';

function MyApp() {
  const [showConsent, setShowConsent] = useState(true);

  return (
    <ConsentDialog
      open={showConsent}
      onClose={() => setShowConsent(false)}
      request={{
        purposes: [
          ConsentPurpose.MARKETING_EMAIL,
          ConsentPurpose.ANALYTICS,
          ConsentPurpose.PERSONALIZATION,
        ],
        regulation: PrivacyRegulation.GDPR,
        device_id: 'device-123',
        user_id: 'user-456',
        language: 'en',
        allow_granular: true,
      }}
      onResponse={async (response) => {
        console.log('User responded:', response);
        // Consent automatically recorded by ConsentManager
      }}
    />
  );
}
```

### 3. Check if User Has Consent

```typescript
import { getConsentManager } from '@/lib/consent/ConsentManager';
import { ConsentPurpose } from '@/lib/consent/types';

const manager = getConsentManager();

// Check specific consent
const canSendEmail = await manager.hasConsent(
  'user-456',
  'device-123',
  ConsentPurpose.MARKETING_EMAIL
);

if (canSendEmail) {
  await sendMarketingEmail(user);
}

// Get all active consents
const activeConsents = await manager.getActiveConsents('user-456', 'device-123');
console.log('Active consents:', activeConsents);
```

### 4. Withdraw Consent (GDPR Article 7(3))

```typescript
await manager.withdrawConsent(
  'user-456',
  'device-123',
  ConsentPurpose.MARKETING_EMAIL,
  'User requested via settings'
);
```

### 5. Export User Data (GDPR Article 15)

```typescript
const userData = await manager.exportUserData('user-456');

// Returns:
// {
//   consents: [...],      // All consent records
//   audit_logs: [...],    // All consent changes
//   requests: [...]       // All data subject requests
// }

// Download as JSON
const blob = new Blob([JSON.stringify(userData, null, 2)], {
  type: 'application/json',
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `user-data-${userId}.json`;
a.click();
```

### 6. Erase User Data (GDPR Article 17, DPDP Section 12)

```typescript
// Soft delete (keeps records for legal compliance)
await manager.eraseUserData('user-456', 'User requested via GDPR Article 17');

// Create formal data subject request
await manager.createDataSubjectRequest('erasure', 'user-456', {
  reason: 'GDPR Article 17 - Right to Erasure',
});
```

## React Components

### ConsentDialog

Main consent collection dialog:

```typescript
<ConsentDialog
  open={true}
  onClose={() => {}}
  request={{
    purposes: [ConsentPurpose.ANALYTICS, ConsentPurpose.MARKETING_EMAIL],
    regulation: PrivacyRegulation.DPDP, // India
    device_id: 'device-123',
    allow_granular: true, // Allow individual selection
  }}
  blocking={false} // Can close without responding
/>
```

### PrivacySettings

Privacy settings page with consent management:

```typescript
import { PrivacySettings } from '@/components/consent/PrivacySettings';

function SettingsPage() {
  return (
    <PrivacySettings
      userId="user-456"
      deviceId="device-123"
    />
  );
}
```

### ComplianceReport

Admin dashboard for compliance reporting:

```typescript
import { ComplianceReport } from '@/components/consent/ComplianceReport';

function AdminDashboard() {
  return <ComplianceReport />;
}
```

## Consent Purposes

The library supports 20+ granular consent purposes:

### Essential (No Consent Required)
- `ESSENTIAL_SERVICES` - Core app functionality
- `SECURITY` - Security and fraud prevention
- `LEGAL_COMPLIANCE` - Legal obligations

### Marketing & Communications
- `MARKETING_EMAIL` - Marketing emails
- `MARKETING_SMS` - Marketing SMS
- `MARKETING_PUSH` - Push notifications
- `MARKETING_WHATSAPP` - WhatsApp marketing
- `PROMOTIONAL_OFFERS` - Discounts, coupons

### Analytics & Performance
- `ANALYTICS` - Usage analytics
- `PERFORMANCE_MONITORING` - Performance tracking
- `AB_TESTING` - A/B testing

### Personalization
- `PERSONALIZATION` - Personalized content
- `RECOMMENDATIONS` - Product recommendations
- `LOCATION_BASED` - Location-based services

### Third-party
- `THIRD_PARTY_ADVERTISING` - Ad networks
- `THIRD_PARTY_ANALYTICS` - Third-party analytics
- `SOCIAL_MEDIA` - Social media integration

### Special Categories (Sensitive)
- `BIOMETRIC_DATA` - Fingerprint, face ID
- `HEALTH_DATA` - Health information
- `PAYMENT_DATA` - Payment processing

### AI & Machine Learning
- `AI_TRAINING` - Use data for AI training
- `AUTOMATED_DECISIONS` - Automated decision-making

## Privacy Regulations Supported

```typescript
enum PrivacyRegulation {
  GDPR = 'GDPR',      // EU - General Data Protection Regulation
  DPDP = 'DPDP',      // India - Digital Personal Data Protection Act
  CCPA = 'CCPA',      // California - Consumer Privacy Act
  CPRA = 'CPRA',      // California - Privacy Rights Act
  LGPD = 'LGPD',      // Brazil - Lei Geral de Proteção de Dados
  PIPEDA = 'PIPEDA',  // Canada - Personal Information Protection
  POPIA = 'POPIA',    // South Africa - Protection of Personal Information
  APPI = 'APPI',      // Japan - Act on Protection of Personal Information
}
```

## Database Schema

The library uses SQLite with the following tables:

- `consent_records` - All consent records (immutable)
- `consent_audit_log` - Audit trail (immutable)
- `consent_configs` - Consent purpose configurations
- `privacy_notices` - Versioned privacy notices
- `data_subject_requests` - GDPR/DPDP data subject requests
- `cookie_consents` - Web cookie management
- `consent_statistics` - Pre-computed statistics

## Compliance Features

### GDPR Compliance (EU)

✅ **Lawful basis** - Consent as lawful basis (Art. 6)
✅ **Consent requirements** - Clear, specific, informed (Art. 7)
✅ **Right to withdraw** - Easy withdrawal (Art. 7(3))
✅ **Right to access** - Data export (Art. 15)
✅ **Right to erasure** - "Right to be forgotten" (Art. 17)
✅ **Data portability** - Machine-readable format (Art. 20)
✅ **Audit trail** - Proof of consent (Art. 7(1))
✅ **Consent expiration** - Periodic renewal

### DPDP Act Compliance (India)

✅ **Consent** - Clear and specific (Section 6)
✅ **Notice** - Privacy notice in Indian languages (Section 5)
✅ **Data Principal Rights** - Access, correction, erasure (Section 11-12)
✅ **Parental consent** - For minors (Section 9)
✅ **Withdrawal** - Easy withdrawal mechanism (Section 6)
✅ **Audit trail** - Record of consents
✅ **Data Protection Officer** - Contact information

### CCPA Compliance (California)

✅ **Opt-out** - "Do Not Sell My Personal Information"
✅ **Right to know** - What data is collected (§1798.110)
✅ **Right to delete** - Delete personal information (§1798.105)
✅ **Right to opt-out** - Opt-out of sale (§1798.120)
✅ **Non-discrimination** - No discrimination for opt-out

## Advanced Usage

### Custom Consent Expiration

```typescript
import { ConsentConfig, ConsentPurpose } from '@/lib/consent/types';

// Configure consent to expire after 365 days
const config: ConsentConfig = {
  purpose: ConsentPurpose.MARKETING_EMAIL,
  required_by: [PrivacyRegulation.GDPR],
  essential: false,
  opt_in: true,
  expires_after_days: 365,
  requires_renewal: true,
  title: 'Marketing Emails',
  description: 'Receive promotional emails about special offers',
  learn_more_url: 'https://example.com/privacy',
};

// Check expiring consents (for renewal reminders)
const expiring = await manager.getExpiringConsents(30); // Next 30 days
for (const consent of expiring) {
  // Send renewal reminder
  await sendRenewalEmail(consent);
}
```

### Subscribe to Consent Changes

```typescript
const unsubscribe = manager.onChange((event) => {
  console.log('Consent changed:', event);

  if (event.purpose === ConsentPurpose.MARKETING_EMAIL) {
    if (event.new_status === 'granted') {
      // Add user to email list
      addToMailingList(event.user_id);
    } else if (event.new_status === 'withdrawn') {
      // Remove user from email list
      removeFromMailingList(event.user_id);
    }
  }
});

// Later: cleanup
unsubscribe();
```

### Generate Compliance Reports

```typescript
import { PrivacyRegulation } from '@/lib/consent/types';

const report = await manager.generateComplianceReport(
  PrivacyRegulation.GDPR,
  Date.now() - (90 * 24 * 60 * 60 * 1000), // 90 days ago
  Date.now()
);

console.log('Total users:', report.total_users);
console.log('Consent rate:', report.consent_rate);
console.log('Issues:', report.issues);
console.log('By purpose:', report.by_purpose);
```

### Handle Data Subject Requests

```typescript
// Create access request (GDPR Art. 15)
const requestId = await manager.createDataSubjectRequest(
  'access',
  'user-456',
  { reason: 'User requested data export' }
);

// Create erasure request (GDPR Art. 17)
await manager.createDataSubjectRequest(
  'erasure',
  'user-456',
  { reason: 'User requested account deletion' }
);

// Create portability request (GDPR Art. 20)
await manager.createDataSubjectRequest(
  'portability',
  'user-456',
  { format: 'json' }
);
```

## Integration with Existing Apps

### Web App (React)

```typescript
// App.tsx
import { useEffect, useState } from 'react';
import { initializeConsentManager } from '@/lib/consent/ConsentManager';
import { ConsentDialog } from '@/components/consent/ConsentDialog';

function App() {
  const [consentReady, setConsentReady] = useState(false);

  useEffect(() => {
    initializeConsentManager({
      // config...
    }).then(() => setConsentReady(true));
  }, []);

  if (!consentReady) return <LoadingScreen />;

  return <YourApp />;
}
```

### Desktop App (Tauri)

```typescript
// main.tsx
import { initializeConsentManager } from '@/lib/consent/ConsentManager';

// Initialize with local SQLite
await initializeConsentManager({
  // config...
}, 'sqlite:consent.db');
```

### Mobile App (React Native)

```typescript
// Similar to web, but use React Native SQLite storage
import { initializeConsentManager } from '@/lib/consent/ConsentManager';

await initializeConsentManager({
  storage_backend: 'sqlite',
  // config...
}, 'consent.db');
```

## Best Practices

1. **Initialize early** - Initialize ConsentManager at app startup
2. **Block until consent** - For new users, block app until essential consents granted
3. **Granular consents** - Allow users to select individual purposes
4. **Clear language** - Use simple, user-friendly descriptions
5. **Multilingual** - Support user's language (especially for DPDP - Hindi required)
6. **Easy withdrawal** - Make consent withdrawal easy (Settings → Privacy)
7. **Regular audits** - Generate compliance reports quarterly
8. **Respect withdrawals** - Stop processing immediately when consent withdrawn
9. **Audit everything** - Never delete audit logs (legal evidence)
10. **Encrypt records** - Enable encryption for sensitive consent data

## Legal Notice

This library helps you implement consent management, but **does not guarantee legal compliance**.
You should:

- ✅ Consult with legal counsel in your jurisdiction
- ✅ Appoint a Data Protection Officer (if required)
- ✅ Conduct privacy impact assessments
- ✅ Review and update privacy notices regularly
- ✅ Train staff on privacy regulations
- ✅ Implement data breach notification procedures

## License

MIT License - Use freely in commercial and open-source projects

## Support

For issues or questions:
- GitHub Issues: [Your repo]
- Email: privacy@yourcompany.com
- Documentation: [Your docs site]

---

**Made with ❤️ for privacy-conscious developers**

/**
 * Universal Consent Management Library
 *
 * Export all public APIs
 */

// Core Manager
export {
  ConsentManager,
  getConsentManager,
  initializeConsentManager,
} from './ConsentManager';

// Types
export type {
  // Core types
  ConsentRecord,
  ConsentConfig,
  ConsentRequest,
  ConsentResponse,
  ConsentChangeEvent,
  ConsentAuditLog,
  ConsentComplianceReport,
  DataSubjectRequest,
  CookieConsent,
  PrivacyNoticeVersion,
  ConsentManagerConfig,
} from './types';

// Enums
export {
  PrivacyRegulation,
  ConsentPurpose,
  ConsentStatus,
  ConsentMethod,
} from './types';

// React Components (re-export for convenience)
export { ConsentDialog } from '@/components/consent/ConsentDialog';
export { PrivacySettings } from '@/components/consent/PrivacySettings';
export { ComplianceReport } from '@/components/consent/ComplianceReport';

/**
 * Universal Consent Management Library - Type Definitions
 *
 * Supports: GDPR (EU), DPDP Act (India), CCPA (California), LGPD (Brazil)
 *
 * @module consent/types
 */

/**
 * Privacy regulations supported
 */
export enum PrivacyRegulation {
  GDPR = 'GDPR',           // EU General Data Protection Regulation
  DPDP = 'DPDP',           // India Digital Personal Data Protection Act
  CCPA = 'CCPA',           // California Consumer Privacy Act
  CPRA = 'CPRA',           // California Privacy Rights Act (CCPA update)
  LGPD = 'LGPD',           // Brazil Lei Geral de Proteção de Dados
  PIPEDA = 'PIPEDA',       // Canada Personal Information Protection
  POPIA = 'POPIA',         // South Africa Protection of Personal Information
  APPI = 'APPI',           // Japan Act on Protection of Personal Information
}

/**
 * Consent purposes (granular)
 */
export enum ConsentPurpose {
  // Essential (usually doesn't require consent)
  ESSENTIAL_SERVICES = 'essential_services',           // Core app functionality
  ACCOUNT_MANAGEMENT = 'account_management',           // User account operations
  SECURITY = 'security',                               // Security and fraud prevention
  LEGAL_COMPLIANCE = 'legal_compliance',               // Legal obligations

  // Marketing & Communications
  MARKETING_EMAIL = 'marketing_email',                 // Marketing emails
  MARKETING_SMS = 'marketing_sms',                     // Marketing SMS
  MARKETING_PUSH = 'marketing_push',                   // Push notifications
  MARKETING_WHATSAPP = 'marketing_whatsapp',           // WhatsApp marketing
  PROMOTIONAL_OFFERS = 'promotional_offers',           // Discounts, coupons

  // Analytics & Performance
  ANALYTICS = 'analytics',                             // Usage analytics
  PERFORMANCE_MONITORING = 'performance_monitoring',   // Performance tracking
  AB_TESTING = 'ab_testing',                           // A/B testing

  // Personalization
  PERSONALIZATION = 'personalization',                 // Personalized content
  RECOMMENDATIONS = 'recommendations',                 // Product recommendations
  LOCATION_BASED = 'location_based',                   // Location-based services

  // Third-party sharing
  THIRD_PARTY_ADVERTISING = 'third_party_advertising', // Ad networks
  THIRD_PARTY_ANALYTICS = 'third_party_analytics',     // Third-party analytics
  SOCIAL_MEDIA = 'social_media',                       // Social media integration

  // Special categories (sensitive data)
  BIOMETRIC_DATA = 'biometric_data',                   // Fingerprint, face ID
  HEALTH_DATA = 'health_data',                         // Health information
  PAYMENT_DATA = 'payment_data',                       // Payment processing

  // AI & Machine Learning
  AI_TRAINING = 'ai_training',                         // Use data for AI training
  AUTOMATED_DECISIONS = 'automated_decisions',         // Automated decision-making
}

/**
 * Consent status
 */
export enum ConsentStatus {
  GRANTED = 'granted',         // User explicitly consented
  DENIED = 'denied',           // User explicitly denied
  WITHDRAWN = 'withdrawn',     // User withdrew consent
  EXPIRED = 'expired',         // Consent expired (per regulation)
  PENDING = 'pending',         // Waiting for user response
  NOT_REQUIRED = 'not_required', // Not required (essential service)
}

/**
 * Consent collection method (for audit trail)
 */
export enum ConsentMethod {
  EXPLICIT_CHECKBOX = 'explicit_checkbox',     // User checked a box
  EXPLICIT_BUTTON = 'explicit_button',         // User clicked "Accept"
  IMPLICIT_BEHAVIOR = 'implicit_behavior',     // Implied by action (limited use)
  PRE_CHECKED = 'pre_checked',                 // Pre-checked box (INVALID for GDPR!)
  OPT_OUT = 'opt_out',                         // Opt-out model (CCPA allows)
  VERBAL = 'verbal',                           // Verbal consent (recorded)
  WRITTEN = 'written',                         // Written document signed
  DIGITAL_SIGNATURE = 'digital_signature',     // Digital signature
}

/**
 * Consent record (core data structure)
 */
export interface ConsentRecord {
  id: string;                          // Unique consent ID

  // Subject information
  user_id?: string;                    // User ID (if authenticated)
  device_id: string;                   // Device identifier
  session_id?: string;                 // Session identifier

  // Consent details
  purpose: ConsentPurpose;             // What consent is for
  status: ConsentStatus;               // Current status
  regulation: PrivacyRegulation;       // Applicable regulation

  // Collection metadata
  granted_at: number;                  // Timestamp when granted
  expires_at?: number;                 // Expiration timestamp (if applicable)
  withdrawn_at?: number;               // When withdrawn (if applicable)
  last_updated_at: number;             // Last modification

  // Audit trail
  method: ConsentMethod;               // How consent was collected
  consent_text: string;                // Exact text shown to user
  consent_version: string;             // Version of consent text (e.g., "1.0")
  language: string;                    // Language code (e.g., "en", "hi", "es")

  // Technical context
  ip_address?: string;                 // IP address at time of consent
  user_agent?: string;                 // Browser/device user agent
  geo_location?: {                     // Geographic location
    country: string;
    region?: string;
    city?: string;
  };

  // Evidence (for proof of consent)
  evidence?: {
    screenshot_url?: string;           // Screenshot of consent UI
    video_url?: string;                // Video recording (for verbal)
    document_url?: string;             // Signed document (for written)
    signature_data?: string;           // Digital signature
    checkbox_state?: boolean;          // Was checkbox checked?
    form_data?: Record<string, any>;   // Form submission data
  };

  // Parent/child consents (for minors)
  parent_consent_id?: string;          // Link to parent's consent (for minors)
  is_minor?: boolean;                  // User is a minor (requires parental consent)

  // Metadata
  metadata?: Record<string, any>;      // Custom metadata

  // Soft delete (NEVER hard delete consent records!)
  deleted_at?: number;                 // Marked as deleted (for GDPR erasure)
}

/**
 * Consent configuration per purpose
 */
export interface ConsentConfig {
  purpose: ConsentPurpose;

  // Regulatory requirements
  required_by: PrivacyRegulation[];    // Which regulations require this
  essential: boolean;                  // Is this essential service?
  opt_in: boolean;                     // True = opt-in, false = opt-out

  // Expiration
  expires_after_days?: number;         // Auto-expire after X days
  requires_renewal: boolean;           // Requires periodic renewal?

  // UI configuration
  title: string;                       // User-facing title
  description: string;                 // Detailed description
  learn_more_url?: string;             // Link to detailed policy
  icon?: string;                       // Icon name/URL

  // Dependencies
  depends_on?: ConsentPurpose[];       // Depends on other consents
  conflicts_with?: ConsentPurpose[];   // Cannot be granted with others

  // Validation
  age_restriction?: number;            // Minimum age required
  requires_parental_consent?: boolean; // Needs parent consent for minors
}

/**
 * Consent request (for UI)
 */
export interface ConsentRequest {
  purposes: ConsentPurpose[];          // What purposes to request
  regulation: PrivacyRegulation;       // Applicable regulation
  user_id?: string;                    // User identifier
  device_id: string;                   // Device identifier
  language?: string;                   // Language preference

  // UI options
  allow_granular?: boolean;            // Allow individual selection
  show_essential?: boolean;            // Show essential services
  modal?: boolean;                     // Show as modal vs inline
  blocking?: boolean;                  // Block app until consent given
}

/**
 * Consent response (from user)
 */
export interface ConsentResponse {
  request_id: string;                  // Original request ID
  consents: Map<ConsentPurpose, boolean>; // Purpose -> granted/denied
  timestamp: number;                   // When response was given
  method: ConsentMethod;               // How consent was collected
  ip_address?: string;
  user_agent?: string;
  geo_location?: {
    country: string;
    region?: string;
    city?: string;
  };
}

/**
 * Consent change event
 */
export interface ConsentChangeEvent {
  user_id?: string;
  device_id: string;
  purpose: ConsentPurpose;
  old_status: ConsentStatus;
  new_status: ConsentStatus;
  timestamp: number;
  reason?: string;                     // Why consent changed
}

/**
 * Consent audit log entry
 */
export interface ConsentAuditLog {
  id: string;
  consent_id: string;                  // Reference to consent record
  action: 'granted' | 'denied' | 'withdrawn' | 'renewed' | 'expired' | 'viewed';
  timestamp: number;
  actor_id?: string;                   // Who performed action (user/admin)
  actor_type: 'user' | 'admin' | 'system';
  ip_address?: string;
  user_agent?: string;
  changes?: Record<string, any>;       // What changed
  reason?: string;                     // Why action was taken
}

/**
 * Consent compliance report
 */
export interface ConsentComplianceReport {
  generated_at: number;
  regulation: PrivacyRegulation;
  period: {
    start: number;
    end: number;
  };

  // Statistics
  total_users: number;
  total_consents: number;
  consent_rate: number;                // Percentage who consented

  // Breakdown by purpose
  by_purpose: {
    purpose: ConsentPurpose;
    granted: number;
    denied: number;
    withdrawn: number;
    rate: number;
  }[];

  // Compliance issues
  issues: {
    severity: 'critical' | 'warning' | 'info';
    type: string;
    description: string;
    affected_users: number;
    recommendation: string;
  }[];

  // Audit trail summary
  audit_summary: {
    total_changes: number;
    admin_overrides: number;           // Should be 0 or very low!
    expired_consents: number;
    renewed_consents: number;
  };
}

/**
 * Data subject rights request (GDPR Article 15-22, DPDP Section 11)
 */
export interface DataSubjectRequest {
  id: string;
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection' | 'automated_decision';
  user_id: string;
  requested_at: number;
  completed_at?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  reason?: string;                     // Reason for rejection

  // Response data
  response_data?: {
    export_url?: string;               // Data export URL (for access/portability)
    deletion_proof?: string;           // Proof of deletion (for erasure)
    correction_applied?: boolean;      // Rectification applied
  };
}

/**
 * Cookie consent (specific for web)
 */
export interface CookieConsent {
  purpose: ConsentPurpose;
  cookie_names: string[];              // Cookie names affected
  cookie_domains: string[];            // Cookie domains
  cookie_duration_days: number;        // How long cookies last
  third_party: boolean;                // Third-party cookies?
}

/**
 * Privacy notice version
 */
export interface PrivacyNoticeVersion {
  version: string;                     // Version number (e.g., "2.0")
  effective_date: number;              // When this version became effective
  content: string;                     // Full privacy notice text
  changes_summary?: string;            // Summary of changes from previous
  language: string;                    // Language code
  regulation: PrivacyRegulation;       // Which regulation this complies with
  requires_re_consent: boolean;        // Requires users to re-consent?
}

/**
 * Consent manager configuration
 */
export interface ConsentManagerConfig {
  // Application info
  app_name: string;
  app_version: string;
  organization: {
    name: string;
    legal_name: string;
    contact_email: string;
    dpo_email?: string;                // Data Protection Officer email
    address?: string;
  };

  // Regulations to comply with
  regulations: PrivacyRegulation[];
  default_regulation: PrivacyRegulation;

  // Consent defaults
  consent_configs: ConsentConfig[];
  default_language: string;
  supported_languages: string[];

  // Expiration
  default_expiration_days?: number;
  renewal_reminder_days?: number;      // Remind user X days before expiry

  // Storage
  storage_backend: 'sqlite' | 'd1' | 'postgres' | 'custom';
  encrypt_records: boolean;            // Encrypt consent records?

  // UI defaults
  ui_theme: 'light' | 'dark' | 'auto';
  ui_position: 'modal' | 'banner' | 'inline';

  // Callbacks
  on_consent_change?: (event: ConsentChangeEvent) => void | Promise<void>;
  on_withdrawal?: (consent: ConsentRecord) => void | Promise<void>;
  on_expiry?: (consent: ConsentRecord) => void | Promise<void>;
}

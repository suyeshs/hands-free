-- ============================================================================
-- Universal Consent Management Database Schema
--
-- Compliant with: GDPR, DPDP Act, CCPA, LGPD, PIPEDA, POPIA, APPI
--
-- CRITICAL: NEVER hard delete consent records! They are legal evidence.
-- ============================================================================

-- Table: consent_records
-- Stores all consent records (immutable audit trail)
CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,

  -- Subject identification
  user_id TEXT,                        -- NULL for anonymous users
  device_id TEXT NOT NULL,
  session_id TEXT,

  -- Consent details
  purpose TEXT NOT NULL,               -- ConsentPurpose enum
  status TEXT NOT NULL,                -- ConsentStatus enum
  regulation TEXT NOT NULL,            -- PrivacyRegulation enum

  -- Timestamps (all in milliseconds since epoch)
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,                  -- NULL = no expiration
  withdrawn_at INTEGER,                -- NULL = not withdrawn
  last_updated_at INTEGER NOT NULL,

  -- Collection metadata
  method TEXT NOT NULL,                -- ConsentMethod enum
  consent_text TEXT NOT NULL,          -- Exact text shown to user
  consent_version TEXT NOT NULL,       -- Version of consent text
  language TEXT NOT NULL DEFAULT 'en',

  -- Technical context
  ip_address TEXT,
  user_agent TEXT,
  geo_country TEXT,
  geo_region TEXT,
  geo_city TEXT,

  -- Evidence (JSON stored as TEXT)
  evidence_json TEXT,                  -- JSON object with proof

  -- Parent/child (for minors)
  parent_consent_id TEXT,
  is_minor INTEGER DEFAULT 0,          -- Boolean (0/1)

  -- Metadata
  metadata_json TEXT,                  -- Custom metadata (JSON)

  -- Soft delete (NEVER hard delete!)
  deleted_at INTEGER,                  -- NULL = not deleted

  -- Indexes for common queries
  FOREIGN KEY (parent_consent_id) REFERENCES consent_records(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_consent_user_purpose
  ON consent_records(user_id, purpose, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consent_device_purpose
  ON consent_records(device_id, purpose, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consent_expires
  ON consent_records(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'granted' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consent_regulation
  ON consent_records(regulation, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consent_granted_at
  ON consent_records(granted_at DESC);

-- ============================================================================

-- Table: consent_audit_log
-- Immutable audit trail of all consent changes
CREATE TABLE IF NOT EXISTS consent_audit_log (
  id TEXT PRIMARY KEY,
  consent_id TEXT NOT NULL,

  -- Action details
  action TEXT NOT NULL,                -- 'granted', 'denied', 'withdrawn', etc.
  timestamp INTEGER NOT NULL,

  -- Actor
  actor_id TEXT,                       -- Who performed the action
  actor_type TEXT NOT NULL,            -- 'user', 'admin', 'system'

  -- Context
  ip_address TEXT,
  user_agent TEXT,

  -- Changes (JSON)
  changes_json TEXT,                   -- What changed (JSON)
  reason TEXT,                         -- Why action was taken

  FOREIGN KEY (consent_id) REFERENCES consent_records(id)
);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_consent
  ON consent_audit_log(consent_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON consent_audit_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON consent_audit_log(actor_id, actor_type, timestamp DESC);

-- Prevent modifications to audit log (immutable)
CREATE TRIGGER IF NOT EXISTS prevent_audit_update
BEFORE UPDATE ON consent_audit_log
BEGIN
  SELECT RAISE(ABORT, 'Audit log is immutable - updates not allowed');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
BEFORE DELETE ON consent_audit_log
BEGIN
  SELECT RAISE(ABORT, 'Audit log is immutable - deletions not allowed');
END;

-- ============================================================================

-- Table: consent_configs
-- Configuration for each consent purpose
CREATE TABLE IF NOT EXISTS consent_configs (
  purpose TEXT PRIMARY KEY,

  -- Regulatory requirements
  required_by_json TEXT NOT NULL,      -- JSON array of regulations
  essential INTEGER DEFAULT 0,         -- Boolean (0/1)
  opt_in INTEGER DEFAULT 1,            -- Boolean: 1=opt-in, 0=opt-out

  -- Expiration
  expires_after_days INTEGER,          -- NULL = no expiration
  requires_renewal INTEGER DEFAULT 0,  -- Boolean (0/1)

  -- UI configuration
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  learn_more_url TEXT,
  icon TEXT,

  -- Dependencies (JSON arrays)
  depends_on_json TEXT,                -- JSON array of purposes
  conflicts_with_json TEXT,            -- JSON array of purposes

  -- Validation
  age_restriction INTEGER,             -- Minimum age (NULL = no restriction)
  requires_parental_consent INTEGER DEFAULT 0, -- Boolean (0/1)

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================================

-- Table: privacy_notices
-- Versioned privacy notices
CREATE TABLE IF NOT EXISTS privacy_notices (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  effective_date INTEGER NOT NULL,
  content TEXT NOT NULL,
  changes_summary TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  regulation TEXT NOT NULL,
  requires_re_consent INTEGER DEFAULT 0, -- Boolean (0/1)

  created_at INTEGER NOT NULL,

  UNIQUE(version, language, regulation)
);

CREATE INDEX IF NOT EXISTS idx_privacy_effective
  ON privacy_notices(effective_date DESC, language, regulation);

-- ============================================================================

-- Table: data_subject_requests
-- GDPR Article 15-22, DPDP Section 11 requests
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id TEXT PRIMARY KEY,

  -- Request details
  type TEXT NOT NULL,                  -- 'access', 'erasure', 'portability', etc.
  user_id TEXT NOT NULL,
  device_id TEXT,

  -- Timestamps
  requested_at INTEGER NOT NULL,
  due_by INTEGER NOT NULL,             -- Must respond within 30 days (GDPR/DPDP)
  completed_at INTEGER,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'rejected'
  assigned_to TEXT,                    -- Admin handling the request

  -- Request details
  details_json TEXT,                   -- Additional request details (JSON)
  reason TEXT,                         -- Reason for rejection (if rejected)

  -- Response
  response_data_json TEXT,             -- Response data (JSON)
  response_message TEXT,

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dsr_user
  ON data_subject_requests(user_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_dsr_due
  ON data_subject_requests(due_by ASC)
  WHERE status IN ('pending', 'in_progress');

-- ============================================================================

-- Table: cookie_consents
-- Specific for web cookies
CREATE TABLE IF NOT EXISTS cookie_consents (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  cookie_names_json TEXT NOT NULL,     -- JSON array
  cookie_domains_json TEXT NOT NULL,   -- JSON array
  cookie_duration_days INTEGER NOT NULL,
  third_party INTEGER DEFAULT 0,       -- Boolean (0/1)

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (purpose) REFERENCES consent_configs(purpose)
);

-- ============================================================================

-- Table: consent_statistics
-- Pre-computed statistics for reporting (updated periodically)
CREATE TABLE IF NOT EXISTS consent_statistics (
  id TEXT PRIMARY KEY,

  -- Dimensions
  regulation TEXT NOT NULL,
  purpose TEXT NOT NULL,
  date TEXT NOT NULL,                  -- YYYY-MM-DD format

  -- Metrics
  total_requests INTEGER DEFAULT 0,
  total_granted INTEGER DEFAULT 0,
  total_denied INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,

  -- Calculated
  grant_rate REAL,                     -- Percentage

  -- Timestamps
  computed_at INTEGER NOT NULL,

  UNIQUE(regulation, purpose, date)
);

CREATE INDEX IF NOT EXISTS idx_stats_date
  ON consent_statistics(date DESC, regulation, purpose);

-- ============================================================================

-- View: active_consents
-- Current active consents (not withdrawn, not expired)
CREATE VIEW IF NOT EXISTS active_consents AS
SELECT
  id,
  user_id,
  device_id,
  purpose,
  status,
  regulation,
  granted_at,
  expires_at,
  consent_version,
  language
FROM consent_records
WHERE deleted_at IS NULL
  AND status = 'granted'
  AND (expires_at IS NULL OR expires_at > strftime('%s', 'now') * 1000)
  AND withdrawn_at IS NULL;

-- View: expiring_soon_consents
-- Consents expiring in next 30 days (for renewal reminders)
CREATE VIEW IF NOT EXISTS expiring_soon_consents AS
SELECT
  id,
  user_id,
  device_id,
  purpose,
  expires_at,
  (expires_at - strftime('%s', 'now') * 1000) / 86400000 as days_until_expiry
FROM consent_records
WHERE deleted_at IS NULL
  AND status = 'granted'
  AND withdrawn_at IS NULL
  AND expires_at IS NOT NULL
  AND expires_at > strftime('%s', 'now') * 1000
  AND expires_at <= strftime('%s', 'now', '+30 days') * 1000
ORDER BY expires_at ASC;

-- View: consent_compliance_summary
-- Summary for compliance reporting
CREATE VIEW IF NOT EXISTS consent_compliance_summary AS
SELECT
  regulation,
  purpose,
  COUNT(*) as total_consents,
  SUM(CASE WHEN status = 'granted' THEN 1 ELSE 0 END) as granted,
  SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
  SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn,
  SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
  ROUND(
    CAST(SUM(CASE WHEN status = 'granted' THEN 1 ELSE 0 END) AS REAL) /
    COUNT(*) * 100,
    2
  ) as grant_rate
FROM consent_records
WHERE deleted_at IS NULL
GROUP BY regulation, purpose;

-- ============================================================================

-- Triggers: Auto-update timestamps

CREATE TRIGGER IF NOT EXISTS consent_updated_at
AFTER UPDATE ON consent_records
FOR EACH ROW
BEGIN
  UPDATE consent_records
  SET last_updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS config_updated_at
AFTER UPDATE ON consent_configs
FOR EACH ROW
BEGIN
  UPDATE consent_configs
  SET updated_at = strftime('%s', 'now') * 1000
  WHERE purpose = NEW.purpose;
END;

CREATE TRIGGER IF NOT EXISTS dsr_updated_at
AFTER UPDATE ON data_subject_requests
FOR EACH ROW
BEGIN
  UPDATE data_subject_requests
  SET updated_at = strftime('%s', 'now') * 1000
  WHERE id = NEW.id;
END;

-- ============================================================================

-- Triggers: Auto-create audit log entries

CREATE TRIGGER IF NOT EXISTS audit_consent_granted
AFTER INSERT ON consent_records
WHEN NEW.status = 'granted'
BEGIN
  INSERT INTO consent_audit_log (
    id, consent_id, action, timestamp, actor_id, actor_type, ip_address, user_agent
  ) VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    'granted',
    NEW.granted_at,
    NEW.user_id,
    'user',
    NEW.ip_address,
    NEW.user_agent
  );
END;

CREATE TRIGGER IF NOT EXISTS audit_consent_status_change
AFTER UPDATE OF status ON consent_records
WHEN OLD.status != NEW.status
BEGIN
  INSERT INTO consent_audit_log (
    id, consent_id, action, timestamp, actor_id, actor_type, changes_json
  ) VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    NEW.status,
    strftime('%s', 'now') * 1000,
    NEW.user_id,
    'user',
    json_object('old_status', OLD.status, 'new_status', NEW.status)
  );
END;

CREATE TRIGGER IF NOT EXISTS audit_consent_withdrawn
AFTER UPDATE OF withdrawn_at ON consent_records
WHEN NEW.withdrawn_at IS NOT NULL AND OLD.withdrawn_at IS NULL
BEGIN
  INSERT INTO consent_audit_log (
    id, consent_id, action, timestamp, actor_id, actor_type
  ) VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    'withdrawn',
    NEW.withdrawn_at,
    NEW.user_id,
    'user'
  );
END;

-- ============================================================================

-- Sample data: Common consent purposes (insert default configs)

INSERT OR IGNORE INTO consent_configs (
  purpose, required_by_json, essential, opt_in, expires_after_days,
  title, description, created_at, updated_at
) VALUES
-- Essential (no consent required)
('essential_services', '["GDPR","DPDP","CCPA","LGPD"]', 1, 1, NULL,
 'Essential Services',
 'Core functionality required for the application to work. No consent required.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- Marketing
('marketing_email', '["GDPR","DPDP","CCPA","LGPD"]', 0, 1, 365,
 'Marketing Emails',
 'Receive promotional emails, offers, and updates about new features.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

('marketing_sms', '["GDPR","DPDP","CCPA","LGPD"]', 0, 1, 365,
 'Marketing SMS',
 'Receive promotional text messages with special offers and discounts.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

('marketing_push', '["GDPR","DPDP","CCPA","LGPD"]', 0, 1, 365,
 'Push Notifications',
 'Receive push notifications about orders, offers, and updates.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- Analytics
('analytics', '["GDPR","DPDP","CCPA"]', 0, 1, 730,
 'Analytics & Performance',
 'Help us understand how you use the app to improve your experience.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

('personalization', '["GDPR","DPDP"]', 0, 1, 730,
 'Personalization',
 'Personalize your experience with recommendations and customized content.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- Third-party
('third_party_advertising', '["GDPR","CCPA"]', 0, 1, 365,
 'Third-party Advertising',
 'Allow third-party advertising networks to show you relevant ads.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- Location
('location_based', '["GDPR","DPDP","CCPA"]', 0, 1, 365,
 'Location-based Services',
 'Use your location to show nearby restaurants and delivery estimates.',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 30000;

-- ============================================================================

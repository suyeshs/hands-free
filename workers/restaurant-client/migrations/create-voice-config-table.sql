-- Migration: Create Tenant Voice Configuration Table
-- Date: 2025-12-13
-- Purpose: Store voice assistant configuration for each tenant in D1

CREATE TABLE IF NOT EXISTS tenant_voice_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL UNIQUE,
  config_version TEXT DEFAULT '1.0.0',

  -- Voice Configuration (JSON)
  prompts TEXT NOT NULL, -- JSON: {systemPrompt, welcomeGreeting, returningCustomerGreeting, etc.}
  branding TEXT, -- JSON: {name, shortName, tagline}
  voice TEXT, -- JSON: {name, language, temperature}
  behavior TEXT, -- JSON: {tone, formality, personality, askNameImmediately, etc.}
  features TEXT, -- JSON: {multilingualSupport, collaborativeOrdering, autoSaveAddresses}

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,

  -- Audit
  version INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1
);

-- Index for fast tenant lookup
CREATE INDEX IF NOT EXISTS idx_tenant_voice_config_tenant_id
ON tenant_voice_config(tenant_id);

-- Index for active configs
CREATE INDEX IF NOT EXISTS idx_tenant_voice_config_active
ON tenant_voice_config(is_active, tenant_id);

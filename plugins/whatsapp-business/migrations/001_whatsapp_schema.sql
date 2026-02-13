-- WhatsApp Business Plugin - Database Schema
-- Migration 001: Initial schema for tenant-specific WhatsApp integration

-- Table: whatsapp_credentials
-- Stores encrypted WhatsApp Business API credentials per tenant
CREATE TABLE IF NOT EXISTS whatsapp_credentials (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    phone_number_id TEXT NOT NULL,
    business_account_id TEXT NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    verify_token TEXT NOT NULL,
    webhook_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, active, suspended, error
    display_phone_number TEXT,
    owner_phone TEXT,  -- Owner's phone number for analytics requests
    staff_phones TEXT,  -- JSON array of authorized staff phones
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_whatsapp_credentials_tenant ON whatsapp_credentials(tenant_id);
CREATE INDEX idx_whatsapp_credentials_status ON whatsapp_credentials(status);

-- Table: whatsapp_authorized_users
-- Tracks which phone numbers can request analytics vs customer service
CREATE TABLE IF NOT EXISTS whatsapp_authorized_users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    role TEXT NOT NULL,  -- owner, manager, staff, customer_service
    permissions TEXT,  -- JSON: {analytics: true, customer_service: false}
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, phone_number)
);

CREATE INDEX idx_whatsapp_authorized_users_tenant ON whatsapp_authorized_users(tenant_id);
CREATE INDEX idx_whatsapp_authorized_users_phone ON whatsapp_authorized_users(phone_number);

-- Table: whatsapp_conversations
-- Customer conversations per tenant
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_wa_id TEXT NOT NULL,  -- WhatsApp ID (phone number format: 1234567890)
    customer_name TEXT,
    last_message_at TEXT NOT NULL,
    unread_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',  -- active, archived, blocked
    assigned_to TEXT,  -- Staff user ID who's handling this conversation
    metadata TEXT,  -- JSON: {labels: [], notes: '', customer_info: {}}
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, customer_wa_id)
);

CREATE INDEX idx_whatsapp_conversations_tenant ON whatsapp_conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_whatsapp_conversations_status ON whatsapp_conversations(tenant_id, status);
CREATE INDEX idx_whatsapp_conversations_assigned ON whatsapp_conversations(assigned_to);

-- Table: whatsapp_messages
-- Message history per tenant
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,  -- WhatsApp message ID from Meta API
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    direction TEXT NOT NULL,  -- inbound, outbound
    message_type TEXT NOT NULL,  -- text, image, video, document, audio, location, contact, sticker
    content TEXT NOT NULL,  -- Message text or media caption
    media_url TEXT,  -- R2 URL for downloaded media
    media_mime_type TEXT,
    media_id TEXT,  -- Meta media ID for download
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, delivered, read, failed
    sent_by TEXT,  -- Staff user ID (for outbound messages)
    timestamp TEXT NOT NULL,
    metadata TEXT,  -- JSON: {ai_suggestion: '', context: {}, error: ''}
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id, timestamp DESC);
CREATE INDEX idx_whatsapp_messages_tenant ON whatsapp_messages(tenant_id, timestamp DESC);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages(tenant_id, direction, timestamp DESC);

-- Table: whatsapp_templates
-- Message templates per tenant
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,  -- marketing, utility, authentication, transactional
    language TEXT NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,  -- Template text with {{variables}}
    variables TEXT,  -- JSON array: ['customer_name', 'order_number']
    status TEXT NOT NULL DEFAULT 'draft',  -- draft, submitted, approved, rejected
    meta_template_id TEXT,  -- Meta template ID if approved
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_whatsapp_templates_tenant ON whatsapp_templates(tenant_id);
CREATE INDEX idx_whatsapp_templates_status ON whatsapp_templates(tenant_id, status);
CREATE INDEX idx_whatsapp_templates_category ON whatsapp_templates(tenant_id, category);

-- Table: whatsapp_webhooks_log
-- Debugging/audit log for webhook deliveries
CREATE TABLE IF NOT EXISTS whatsapp_webhooks_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    webhook_type TEXT NOT NULL,  -- message, status, error
    payload TEXT NOT NULL,  -- JSON webhook payload
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_whatsapp_webhooks_tenant ON whatsapp_webhooks_log(tenant_id, timestamp DESC);
CREATE INDEX idx_whatsapp_webhooks_processed ON whatsapp_webhooks_log(processed, timestamp DESC);
CREATE INDEX idx_whatsapp_webhooks_type ON whatsapp_webhooks_log(tenant_id, webhook_type, timestamp DESC);

-- Table: whatsapp_media
-- Tracks downloaded media files
CREATE TABLE IF NOT EXISTS whatsapp_media (
    id TEXT PRIMARY KEY,  -- Meta media ID
    tenant_id TEXT NOT NULL,
    message_id TEXT,  -- Reference to whatsapp_messages
    media_type TEXT NOT NULL,  -- image, video, document, audio
    mime_type TEXT NOT NULL,
    file_size INTEGER,  -- Bytes
    r2_url TEXT NOT NULL,  -- R2 storage URL
    r2_key TEXT NOT NULL,  -- R2 object key
    download_status TEXT NOT NULL DEFAULT 'pending',  -- pending, downloaded, failed
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES whatsapp_messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_whatsapp_media_tenant ON whatsapp_media(tenant_id);
CREATE INDEX idx_whatsapp_media_message ON whatsapp_media(message_id);
CREATE INDEX idx_whatsapp_media_status ON whatsapp_media(download_status);

-- Table: whatsapp_analytics
-- Track analytics requests from owners
CREATE TABLE IF NOT EXISTS whatsapp_analytics_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    requester_role TEXT NOT NULL,  -- owner, manager
    query TEXT NOT NULL,  -- Original question: "Show me today's sales"
    sql_generated TEXT,  -- SQL query generated by OpenClaw
    result_summary TEXT,  -- Formatted response sent to user
    openclaw_confidence REAL,  -- 0.0 - 1.0
    execution_time_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, success, failed
    error TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_whatsapp_analytics_tenant ON whatsapp_analytics_requests(tenant_id, timestamp DESC);
CREATE INDEX idx_whatsapp_analytics_requester ON whatsapp_analytics_requests(requester_phone, timestamp DESC);
CREATE INDEX idx_whatsapp_analytics_status ON whatsapp_analytics_requests(status);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_whatsapp_credentials_timestamp
AFTER UPDATE ON whatsapp_credentials
FOR EACH ROW
BEGIN
    UPDATE whatsapp_credentials SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_whatsapp_authorized_users_timestamp
AFTER UPDATE ON whatsapp_authorized_users
FOR EACH ROW
BEGIN
    UPDATE whatsapp_authorized_users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_whatsapp_conversations_timestamp
AFTER UPDATE ON whatsapp_conversations
FOR EACH ROW
BEGIN
    UPDATE whatsapp_conversations SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_whatsapp_templates_timestamp
AFTER UPDATE ON whatsapp_templates
FOR EACH ROW
BEGIN
    UPDATE whatsapp_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

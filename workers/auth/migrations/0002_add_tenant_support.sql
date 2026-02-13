-- Migration number: 0002 	 2025-10-25T07:16:00.000Z

-- Create tenants table for multitenant support
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    domain TEXT UNIQUE NOT NULL,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    theme_config TEXT, -- JSON string for theme customization
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add tenant_id column to user table
ALTER TABLE user ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

-- Create unique index on email and tenant_id to ensure user isolation per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_tenant ON user(email, tenant_id);

-- Create index on tenant domain for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenant_domain ON tenants(domain);

-- Create index on tenant client_id for OAuth flows
CREATE INDEX IF NOT EXISTS idx_tenant_client_id ON tenants(client_id);


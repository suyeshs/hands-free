-- Migration: 067_tunnel_config
-- Add Named Tunnel configuration to tenant_config
-- Each restaurant gets a persistent Cloudflare tunnel with permanent URL

-- Check if tenant_config table exists, create if not
CREATE TABLE IF NOT EXISTS tenant_config (
    tenant_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add tunnel configuration columns
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS tunnel_id TEXT;
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS tunnel_name TEXT;
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS tunnel_url TEXT;
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS tunnel_credentials TEXT; -- Encrypted JSON

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_config_tunnel_name ON tenant_config(tunnel_name);

-- Add comments (for documentation)
-- tunnel_id: Cloudflare tunnel UUID (e.g., "abc-def-ghi-jkl")
-- tunnel_name: Restaurant slug (e.g., "mahesh-dhaba")
-- tunnel_url: Full URL (e.g., "https://mahesh-dhaba.menu.handsfree.com")
-- tunnel_credentials: Base64-encoded JSON credentials for cloudflared

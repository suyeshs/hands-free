-- Migration number: 0003 	 2025-01-26T00:00:00.000Z
-- Add multi-level authentication: platform users and tenant users

-- ========================================
-- Step 1: Rename and Update User Table
-- ========================================

-- Rename existing user table to platform_user
ALTER TABLE user RENAME TO platform_user;

-- Add role column (super_admin | store_owner)
ALTER TABLE platform_user ADD COLUMN role TEXT NOT NULL DEFAULT 'store_owner';

-- Add tenant_ids column (JSON array of accessible tenants)
ALTER TABLE platform_user ADD COLUMN tenant_ids TEXT;

-- Add name column
ALTER TABLE platform_user ADD COLUMN name TEXT;

-- Add last_login timestamp
ALTER TABLE platform_user ADD COLUMN last_login TIMESTAMP;

-- Remove tenant_id column (no longer needed, using tenant_ids array)
-- Note: SQLite doesn't support DROP COLUMN directly, so we'll leave it
-- It will be NULL for platform users

-- ========================================
-- Step 2: Create Tenant User Table
-- ========================================

CREATE TABLE IF NOT EXISTS tenant_user (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    
    -- User profile
    name TEXT,
    metadata TEXT,
    
    -- Account status
    is_active INTEGER NOT NULL DEFAULT 1,
    is_verified INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    last_login TIMESTAMP,
    
    -- Email unique per tenant (not globally)
    UNIQUE(email, tenant_id)
);

-- ========================================
-- Step 3: Update Tenants Table
-- ========================================

-- Add company_name
ALTER TABLE tenants ADD COLUMN company_name TEXT;

-- Add owner_id (references platform_user.id)
ALTER TABLE tenants ADD COLUMN owner_id TEXT;

-- Add settings (JSON)
ALTER TABLE tenants ADD COLUMN settings TEXT;

-- ========================================
-- Step 4: Create Indexes
-- ========================================

-- Tenant user indexes
CREATE INDEX IF NOT EXISTS idx_tenant_user_email ON tenant_user(email);
CREATE INDEX IF NOT EXISTS idx_tenant_user_tenant ON tenant_user(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_lookup ON tenant_user(email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_active ON tenant_user(is_active);

-- Tenant indexes
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- Platform user indexes
CREATE INDEX IF NOT EXISTS idx_platform_user_role ON platform_user(role);

-- ========================================
-- Step 5: Drop Old Unique Constraint
-- ========================================

-- Remove old unique index on user.email (now platform_user.email can be unique globally)
DROP INDEX IF EXISTS idx_user_email_tenant;

-- Create new unique index on platform_user.email
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_user_email ON platform_user(email);


-- Migration: Add WebAuthn/Passkey Support
-- Description: Stores passkey credentials for passwordless authentication
-- Security: Follows FIDO2/WebAuthn standards

-- Table for storing WebAuthn credentials
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id TEXT PRIMARY KEY,                    -- Credential ID (base64url encoded)
    user_id TEXT NOT NULL,                  -- Reference to platform_user.id
    public_key TEXT NOT NULL,               -- Public key (base64url encoded)
    counter INTEGER NOT NULL DEFAULT 0,     -- Signature counter for replay protection
    transports TEXT,                        -- Comma-separated transports (usb,nfc,ble,internal)
    aaguid TEXT,                            -- Authenticator AAGUID
    device_name TEXT,                       -- User-friendly device name
    device_type TEXT,                       -- 'platform' (Touch ID) or 'cross-platform' (YubiKey)
    backup_eligible BOOLEAN DEFAULT FALSE,  -- Whether credential can be backed up
    backup_state BOOLEAN DEFAULT FALSE,     -- Whether credential is backed up
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,         -- For soft deletion
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES platform_user(id) ON DELETE CASCADE
);

-- Table for storing passkey challenges (for registration and authentication)
CREATE TABLE IF NOT EXISTS passkey_challenges (
    challenge TEXT PRIMARY KEY,             -- Challenge string (base64url encoded)
    user_id TEXT,                           -- User ID for registration, NULL for authentication discovery
    email TEXT,                             -- Email for user lookup
    operation TEXT NOT NULL,                -- 'registration' or 'authentication'
    expires_at TIMESTAMP NOT NULL,          -- Challenge expiry (5 minutes)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE              -- Prevent challenge reuse
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_passkey_user_id ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_active ON passkey_credentials(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_passkey_last_used ON passkey_credentials(last_used_at);
CREATE INDEX IF NOT EXISTS idx_challenge_expires ON passkey_challenges(expires_at, used);
CREATE INDEX IF NOT EXISTS idx_challenge_user ON passkey_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_email ON passkey_challenges(email);

-- Add passkey_enabled flag to platform_user table
ALTER TABLE platform_user ADD COLUMN passkey_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE platform_user ADD COLUMN passkey_setup_at TIMESTAMP;

-- Security note: Challenges should be cleaned up regularly
-- Recommended: Set up a Worker cron to delete expired challenges


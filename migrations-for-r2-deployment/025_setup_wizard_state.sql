-- Migration: Setup Wizard State
-- Stores the setup wizard progress and completion state in SQLite
-- This replaces localStorage to eliminate race conditions with page reloads

CREATE TABLE IF NOT EXISTS setup_wizard_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton table (only one row)

    -- Navigation state
    current_screen TEXT NOT NULL DEFAULT 'welcome',
    completed_screens TEXT NOT NULL DEFAULT '[]', -- JSON array of screen names
    skipped_screens TEXT NOT NULL DEFAULT '[]',   -- JSON array of screen names
    selected_optional_items TEXT NOT NULL DEFAULT '[]', -- JSON array of optional items

    -- Wizard data (temporary storage during setup)
    wizard_data TEXT NOT NULL DEFAULT '{}', -- JSON object with all wizard data

    -- Completion state
    is_complete BOOLEAN NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    awaiting_activation BOOLEAN NOT NULL DEFAULT 0,

    -- Checklist dismissal
    checklist_dismissed BOOLEAN NOT NULL DEFAULT 0,

    -- Provisioning data (stored in SQLite, replaces localStorage)
    activation_code TEXT,
    provisioning_web_socket_url TEXT,
    is_restaurant_owner BOOLEAN NOT NULL DEFAULT 0,

    -- Metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with default state (only if table is empty)
INSERT OR IGNORE INTO setup_wizard_state (id) VALUES (1);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS setup_wizard_state_updated_at
AFTER UPDATE ON setup_wizard_state
FOR EACH ROW
BEGIN
    UPDATE setup_wizard_state SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
END;

-- Index for faster lookups (though it's a singleton table)
CREATE INDEX IF NOT EXISTS idx_setup_wizard_state_updated
ON setup_wizard_state(updated_at);

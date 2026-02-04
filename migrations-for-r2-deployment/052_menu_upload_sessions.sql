-- Menu Upload Session Tables
-- Handles multi-page menu uploads with staging and review before commit

-- Upload sessions table (tracks entire upload workflows)
CREATE TABLE IF NOT EXISTS menu_upload_sessions (
    id TEXT PRIMARY KEY,
    menu_type TEXT NOT NULL CHECK(menu_type IN ('food', 'bar')),
    status TEXT NOT NULL CHECK(status IN ('in_progress', 'committed', 'cancelled')) DEFAULT 'in_progress',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    committed_at TEXT,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0
);

-- Upload pages table (tracks individual PDF/image uploads within a session)
CREATE TABLE IF NOT EXISTS menu_upload_pages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('uploading', 'parsed', 'error')) DEFAULT 'uploading',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE
);

-- Staging items table (temporary storage for parsed menu items before commit)
-- NOTE: Table name is menu_items_staging (not menu_staging_items) to match code expectations
CREATE TABLE IF NOT EXISTS menu_items_staging (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    preparation_time INTEGER DEFAULT 15,
    allergens TEXT DEFAULT '[]',
    dietary_tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_upload_pages_session
ON menu_upload_pages(session_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_staging_session
ON menu_items_staging(session_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_staging_category
ON menu_items_staging(category);

CREATE INDEX IF NOT EXISTS idx_menu_upload_sessions_status
ON menu_upload_sessions(status);

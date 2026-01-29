-- Menu Upload Sessions
-- Allows multi-page menu uploads with review before commit

-- Upload sessions table
CREATE TABLE IF NOT EXISTS menu_upload_sessions (
    id TEXT PRIMARY KEY,
    menu_type TEXT NOT NULL CHECK(menu_type IN ('food', 'bar')),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'committed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    committed_at TEXT,
    total_items INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0
);

CREATE INDEX idx_menu_upload_sessions_status ON menu_upload_sessions(status);
CREATE INDEX idx_menu_upload_sessions_created ON menu_upload_sessions(created_at);

-- Staging table for uploaded items
CREATE TABLE IF NOT EXISTS menu_items_staging (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,

    -- Menu item fields (same as menu_items)
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image TEXT,
    active INTEGER DEFAULT 1,
    preparation_time INTEGER DEFAULT 15,
    allergens TEXT DEFAULT '[]',
    dietary_tags TEXT DEFAULT '[]',

    -- Metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_menu_items_staging_session ON menu_items_staging(session_id);
CREATE INDEX idx_menu_items_staging_page ON menu_items_staging(session_id, page_number);

-- Upload pages tracking
CREATE TABLE IF NOT EXISTS menu_upload_pages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    item_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'uploading' CHECK(status IN ('uploading', 'parsed', 'error')),
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(session_id) REFERENCES menu_upload_sessions(id) ON DELETE CASCADE,
    UNIQUE(session_id, page_number)
);

CREATE INDEX idx_menu_upload_pages_session ON menu_upload_pages(session_id);

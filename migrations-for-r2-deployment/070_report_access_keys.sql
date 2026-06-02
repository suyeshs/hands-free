-- Report Access Keys
-- A single static, high-entropy key that remote devices present (X-Report-Key
-- header) to read sales reports from the POS over the cloudflared tunnel.
-- The row is created/rotated by the POS (Settings); the local web server
-- validates incoming requests against it. No row => report endpoints deny all.
CREATE TABLE IF NOT EXISTS report_access_keys (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- single row
    access_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rotated_at TEXT
);

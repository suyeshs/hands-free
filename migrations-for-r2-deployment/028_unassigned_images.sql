-- Unassigned Images Pool Table
-- Stores images uploaded via Cloudflare that haven't been assigned to menu items yet
-- Used for bulk upload workflows where images are uploaded first, then assigned later

CREATE TABLE IF NOT EXISTS unassigned_images (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT NOT NULL,
    cloudflare_image_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    image_url TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    uploaded_by TEXT,
    notes TEXT,
    assigned_to TEXT,
    assigned_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient tenant-based queries
CREATE INDEX IF NOT EXISTS idx_unassigned_images_tenant
    ON unassigned_images(tenant_id);

-- Index for finding unassigned images
CREATE INDEX IF NOT EXISTS idx_unassigned_images_unassigned
    ON unassigned_images(tenant_id, assigned_to)
    WHERE assigned_to IS NULL;

-- Index for Cloudflare ID lookups
CREATE INDEX IF NOT EXISTS idx_unassigned_images_cloudflare_id
    ON unassigned_images(cloudflare_image_id);

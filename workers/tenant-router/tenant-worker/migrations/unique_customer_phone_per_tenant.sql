-- Prevent duplicate customers for the same phone number within a tenant.
-- phone_hash is the canonical dedup key (HMAC of normalized 10-digit phone).
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_phone_hash
  ON customers (tenant_id, phone_hash);

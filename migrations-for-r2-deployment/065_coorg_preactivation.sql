-- Migration 065: Pre-activate coorg-food-company-1413
-- Seeds tenant_config so the app boots directly into the POS without the activation screen.
-- Safe to run on any device — uses INSERT OR IGNORE (won't overwrite a real activation).

INSERT OR IGNORE INTO tenant_config (
  id,
  tenant_id,
  company_name,
  subdomain,
  api_base_url,
  orders_endpoint,
  menu_endpoint,
  primary_color,
  secondary_color,
  logo_url,
  currency,
  timezone,
  activated_at,
  d1_database_id,
  is_company_level
) VALUES (
  1,
  'coorg-food-company-1413',
  'Coorg Food Company',
  'coorg-food-company-1413',
  'https://handsfree-restaurant-client.suyesh.workers.dev',
  'https://handsfree-orders.suyesh.workers.dev',
  'https://handsfree-restaurant-client.suyesh.workers.dev',
  '#F97316',
  NULL,
  NULL,
  'INR',
  'Asia/Kolkata',
  '2026-05-06T00:00:00.000Z',
  '92ca9abc-2dce-440b-9122-cd44338dd767',
  0
);

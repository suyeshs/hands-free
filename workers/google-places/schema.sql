-- Google Reviews Database Schema
-- Stores synced reviews from Google Places

CREATE TABLE IF NOT EXISTS google_reviews (
  -- Primary Key
  id TEXT PRIMARY KEY, -- Format: {place_id}_{timestamp}

  -- Tenant Association
  tenant_id TEXT NOT NULL,
  place_id TEXT NOT NULL,

  -- Review Author
  author_name TEXT NOT NULL,
  author_photo_url TEXT,

  -- Review Content
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  review_date TEXT NOT NULL, -- ISO 8601 timestamp
  relative_time TEXT, -- "2 days ago", etc.

  -- Source Tracking
  source TEXT NOT NULL DEFAULT 'google', -- Always 'google' for now
  google_review_time INTEGER NOT NULL, -- Original Unix timestamp from Google

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_place ON google_reviews(tenant_id, place_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON google_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON google_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_google_time ON google_reviews(google_review_time);

-- Review statistics view
CREATE VIEW IF NOT EXISTS review_stats AS
SELECT
  tenant_id,
  place_id,
  COUNT(*) as total_reviews,
  AVG(rating) as average_rating,
  SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
  SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
  SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
  SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
  SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star,
  MAX(review_date) as latest_review_date
FROM google_reviews
GROUP BY tenant_id, place_id;

-- ============================================================================
-- SOCIAL MEDIA CAMPAIGNS SCHEMA
-- Version: 1.0.0
-- Plugin: @guanix/plugin-social-campaigns
-- ============================================================================

-- Campaigns table
CREATE TABLE IF NOT EXISTS social_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, scheduled, paused, completed
  platform TEXT NOT NULL, -- whatsapp, instagram, tiktok

  -- Scheduling
  start_date TEXT,
  end_date TEXT,
  timezone TEXT DEFAULT 'UTC',

  -- Goals
  goal_type TEXT, -- awareness, engagement, conversions

  -- Metadata
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,

  -- Cloud sync
  synced_to_cloud BOOLEAN DEFAULT 0,
  last_cloud_sync TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON social_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON social_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON social_campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON social_campaigns(start_date, end_date);

-- Campaign Posts table
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  -- Content
  content_type TEXT NOT NULL, -- text, image, video, carousel
  message TEXT,
  caption TEXT,
  hashtags TEXT, -- JSON array
  mentions TEXT, -- JSON array

  -- Media (local file paths)
  media_paths TEXT, -- JSON array of local file paths
  thumbnail_path TEXT, -- For videos

  -- Scheduling
  scheduled_time TEXT,
  posted_time TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, posting, posted, failed
  platform_post_id TEXT, -- ID from external platform after posting
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Cloud sync
  synced_to_cloud BOOLEAN DEFAULT 0,

  FOREIGN KEY (campaign_id) REFERENCES social_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_campaign ON social_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON social_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posts_platform_id ON social_posts(platform_post_id);

-- OAuth Tokens (ENCRYPTED)
CREATE TABLE IF NOT EXISTS social_oauth_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- whatsapp, instagram, tiktok

  -- Encrypted tokens
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  expires_at TEXT,
  scope TEXT, -- JSON array

  -- Platform account info
  platform_account_id TEXT NOT NULL,
  platform_username TEXT,
  platform_display_name TEXT,

  -- Status
  is_active BOOLEAN DEFAULT 1,

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  connected_at TEXT,
  last_used_at TEXT,

  UNIQUE(tenant_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_tenant ON social_oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_platform ON social_oauth_tokens(platform);

-- API Credentials (ENCRYPTED) - Tenant-provided app secrets
-- Each tenant provides their own Instagram/TikTok/WhatsApp app credentials
CREATE TABLE IF NOT EXISTS social_api_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- whatsapp, instagram, tiktok

  -- Encrypted credentials
  encrypted_app_id TEXT NOT NULL, -- Instagram App ID, TikTok Client Key, WhatsApp Business ID
  encrypted_app_secret TEXT NOT NULL, -- For webhook signature verification
  encrypted_verify_token TEXT, -- For webhook verification (Instagram/WhatsApp)

  -- Status
  is_configured BOOLEAN DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_verified_at TEXT,

  UNIQUE(tenant_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_tenant ON social_api_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_platform ON social_api_credentials(platform);

-- Engagement Metrics table
CREATE TABLE IF NOT EXISTS social_engagement_metrics (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  -- Engagement counts
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,

  -- Platform-specific
  clicks INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,

  -- Snapshot timestamp
  recorded_at TEXT NOT NULL,

  -- Metadata
  created_at TEXT NOT NULL,

  -- Cloud sync
  synced_to_cloud BOOLEAN DEFAULT 0,

  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES social_campaigns(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_post ON social_engagement_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON social_engagement_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON social_engagement_metrics(recorded_at);

-- Customer Interactions table
CREATE TABLE IF NOT EXISTS social_customer_interactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT,
  campaign_id TEXT,

  -- Customer identification (linked to existing customer system)
  customer_id TEXT, -- Links to customers table
  social_platform_id TEXT NOT NULL, -- Platform-specific user ID
  social_username TEXT,
  social_handle TEXT,
  social_profile_url TEXT,

  -- Interaction details
  interaction_type TEXT NOT NULL, -- like, comment, share, mention, message
  interaction_content TEXT, -- Comment text, message content
  sentiment TEXT, -- positive, negative, neutral (AI-analyzed)

  -- Topics (AI-extracted)
  topics TEXT, -- JSON array: ["food", "pricing", "service"]
  keywords TEXT, -- JSON array

  -- Timestamps
  interaction_time TEXT NOT NULL,
  created_at TEXT NOT NULL,

  -- Cloud sync
  synced_to_cloud BOOLEAN DEFAULT 0,

  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE SET NULL,
  FOREIGN KEY (campaign_id) REFERENCES social_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON social_customer_interactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interactions_customer ON social_customer_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_interactions_post ON social_customer_interactions(post_id);
CREATE INDEX IF NOT EXISTS idx_interactions_platform_id ON social_customer_interactions(social_platform_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON social_customer_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interactions_time ON social_customer_interactions(interaction_time);

-- Webhook Events table (for audit and debugging)
CREATE TABLE IF NOT EXISTS social_webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Raw payload (for debugging)
  payload TEXT NOT NULL, -- JSON string

  -- Processing status
  processed BOOLEAN DEFAULT 0,
  processing_error TEXT,

  -- Related records
  post_id TEXT,
  campaign_id TEXT,
  customer_interaction_id TEXT,

  -- Timestamps
  received_at TEXT NOT NULL,
  processed_at TEXT,

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant ON social_webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_platform ON social_webhook_events(platform);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON social_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON social_webhook_events(received_at);

-- Scheduled Posts Queue
CREATE TABLE IF NOT EXISTS social_post_queue (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  last_attempt TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON social_post_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_queue_status ON social_post_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_post ON social_post_queue(post_id);

-- Tunnel Configuration (cloudflared)
CREATE TABLE IF NOT EXISTS social_tunnel_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tunnel_id TEXT NOT NULL,
  tunnel_name TEXT NOT NULL,
  tunnel_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  last_verified_at TEXT,
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tunnel_tenant ON social_tunnel_config(tenant_id);

-- ============================================================================
-- PRAGMAS
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 30000;

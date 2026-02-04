-- Vision AI Plugin - Initial Schema
-- Supports multiple camera types: webcam, IP/RTSP, reCamera, Airtel Xsafe

-- Camera Configurations
CREATE TABLE IF NOT EXISTS vision_cameras (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('webcam', 'ip_camera', 'recamera', 'airtel_xsafe', 'onvif')),
  location TEXT NOT NULL CHECK(location IN ('dining', 'kitchen', 'entrance', 'bar', 'parking', 'storage', 'custom')),
  enabled INTEGER DEFAULT 1,

  -- Connection details (JSON)
  connection_config TEXT NOT NULL, -- {deviceId, rtspUrl, ipAddress, username, password, etc}

  -- Feature flags
  features TEXT NOT NULL DEFAULT '{}', -- {peopleCounting, tableOccupancy, motionDetection, etc}

  -- Processing mode
  processing_mode TEXT DEFAULT 'edge' CHECK(processing_mode IN ('edge', 'cloud', 'hybrid')),

  -- Status
  status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'error', 'configuring')),
  last_seen_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_vision_cameras_tenant ON vision_cameras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vision_cameras_location ON vision_cameras(location);
CREATE INDEX IF NOT EXISTS idx_vision_cameras_status ON vision_cameras(status);

-- AI Detection Results (Edge or Cloud)
CREATE TABLE IF NOT EXISTS vision_detections (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  -- Detection data
  timestamp INTEGER NOT NULL,
  detections TEXT NOT NULL, -- JSON array of {class_name, confidence, bbox, tracking_id}

  -- Metrics
  people_count INTEGER DEFAULT 0,
  processing_source TEXT CHECK(processing_source IN ('edge', 'cloud_gemini', 'cloud_worker_ai')),
  inference_time_ms INTEGER,

  -- Optional snapshot reference
  snapshot_id TEXT,

  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (camera_id) REFERENCES vision_cameras(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vision_detections_camera ON vision_detections(camera_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_detections_tenant ON vision_detections(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_detections_timestamp ON vision_detections(timestamp DESC);

-- Vision Events (Alerts, Anomalies)
CREATE TABLE IF NOT EXISTS vision_events (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  event_type TEXT NOT NULL CHECK(event_type IN (
    'high_occupancy',
    'table_ready',
    'motion_detected',
    'safety_violation',
    'anomaly',
    'person_entered',
    'person_exited',
    'loitering',
    'custom'
  )),
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),

  title TEXT NOT NULL,
  description TEXT,

  -- Event data
  metadata TEXT, -- JSON with event-specific data
  snapshot_id TEXT,

  -- Status
  acknowledged INTEGER DEFAULT 0,
  acknowledged_by TEXT,
  acknowledged_at INTEGER,

  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (camera_id) REFERENCES vision_cameras(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vision_events_camera ON vision_events(camera_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_events_tenant ON vision_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_events_type ON vision_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vision_events_severity ON vision_events(severity);
CREATE INDEX IF NOT EXISTS idx_vision_events_acknowledged ON vision_events(acknowledged);

-- Snapshot Storage (References to R2)
CREATE TABLE IF NOT EXISTS vision_snapshots (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  -- R2 Storage
  r2_key TEXT NOT NULL, -- global/vision/{tenant_id}/{camera_id}/{timestamp}.jpg
  r2_url TEXT,

  -- Snapshot metadata
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,

  -- AI Analysis results (if cloud processed)
  ai_analysis TEXT, -- JSON from Gemini/Worker AI
  analyzed_at INTEGER,

  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (camera_id) REFERENCES vision_cameras(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vision_snapshots_camera ON vision_snapshots(camera_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_snapshots_tenant ON vision_snapshots(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_snapshots_r2_key ON vision_snapshots(r2_key);

-- Analytics - Hourly Aggregations
CREATE TABLE IF NOT EXISTS vision_analytics_hourly (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  location TEXT NOT NULL,

  -- Time bucket (hour)
  hour_timestamp INTEGER NOT NULL, -- Unix timestamp rounded to hour

  -- Metrics
  avg_people_count REAL DEFAULT 0,
  max_people_count INTEGER DEFAULT 0,
  min_people_count INTEGER DEFAULT 0,
  total_detections INTEGER DEFAULT 0,

  -- Events
  total_events INTEGER DEFAULT 0,
  high_severity_events INTEGER DEFAULT 0,

  -- Processing stats
  edge_inferences INTEGER DEFAULT 0,
  cloud_inferences INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

  FOREIGN KEY (camera_id) REFERENCES vision_cameras(id) ON DELETE CASCADE,

  UNIQUE(camera_id, hour_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_vision_analytics_camera ON vision_analytics_hourly(camera_id, hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_analytics_tenant ON vision_analytics_hourly(tenant_id, hour_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vision_analytics_location ON vision_analytics_hourly(location, hour_timestamp DESC);

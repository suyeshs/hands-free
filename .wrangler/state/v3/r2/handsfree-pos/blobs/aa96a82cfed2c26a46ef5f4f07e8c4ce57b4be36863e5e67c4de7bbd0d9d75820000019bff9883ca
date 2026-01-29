-- Attendance Records - Clock in/out, breaks, and shift tracking
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,

    -- Shift timing
    clock_in_at INTEGER NOT NULL,           -- Unix timestamp
    clock_out_at INTEGER,                    -- Unix timestamp, NULL if still clocked in
    scheduled_start INTEGER,                 -- Expected start time (for comparison)
    scheduled_end INTEGER,                   -- Expected end time (for comparison)

    -- Break tracking
    break_duration_minutes INTEGER DEFAULT 0, -- Total break time
    breaks_json TEXT,                         -- JSON array of break periods: [{id, type, startAt, endAt, durationMinutes}]

    -- Shift metadata
    shift_date TEXT NOT NULL,                 -- Date in YYYY-MM-DD format for querying
    shift_type TEXT DEFAULT 'regular',        -- regular, overtime, weekend, holiday
    roster_assignment_id TEXT,                -- Link to roster if shift was scheduled

    -- Hours calculation
    total_hours REAL,                         -- Total shift hours (clock_out - clock_in - breaks)
    regular_hours REAL,                       -- Regular hours (up to 8)
    overtime_hours REAL,                      -- Overtime hours (above 8)

    -- Status and validation
    status TEXT NOT NULL DEFAULT 'active',    -- active, completed, missed, excused
    late_by_minutes INTEGER DEFAULT 0,        -- Minutes late (if late)
    early_departure_minutes INTEGER DEFAULT 0, -- Minutes early departure

    -- Notes and metadata
    notes TEXT,                               -- Staff/manager notes
    device_id TEXT,                           -- Device used for clock in/out
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
    -- Note: roster_assignment_id is optional and validated in application code
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance_records(staff_id, shift_date);

-- Only one active (not clocked out) record per staff member
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active
ON attendance_records(staff_id, tenant_id)
WHERE clock_out_at IS NULL;

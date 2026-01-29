-- Weekly Rosters - Schedule templates
CREATE TABLE IF NOT EXISTS weekly_rosters (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Week identification
    week_start_date TEXT NOT NULL,           -- Monday of the week (YYYY-MM-DD)
    week_end_date TEXT NOT NULL,             -- Sunday of the week
    week_number INTEGER NOT NULL,            -- ISO week number
    year INTEGER NOT NULL,

    -- Roster metadata
    name TEXT,                                -- Optional name (e.g., "Holiday Week", "Summer Schedule")
    status TEXT NOT NULL DEFAULT 'draft',     -- draft, published, archived
    published_at INTEGER,
    published_by TEXT,                        -- Staff ID who published

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT,                          -- Manager who created

    FOREIGN KEY(created_by) REFERENCES staff_users(id),
    FOREIGN KEY(published_by) REFERENCES staff_users(id)
);

-- Roster Assignments - Individual shift assignments
CREATE TABLE IF NOT EXISTS roster_assignments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    roster_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,

    -- Shift details
    shift_date TEXT NOT NULL,                 -- YYYY-MM-DD
    day_of_week TEXT NOT NULL,                -- monday, tuesday, etc.
    shift_start INTEGER NOT NULL,             -- Unix timestamp
    shift_end INTEGER NOT NULL,               -- Unix timestamp
    shift_type TEXT DEFAULT 'regular',        -- regular, split, overnight, on-call

    -- Role and position
    role TEXT,                                -- Role for this shift (may differ from staff default)
    position TEXT,                            -- front, kitchen, bar, etc.
    section_id TEXT,                          -- Floor plan section assignment

    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, confirmed, swapped, cancelled
    confirmed_by_staff INTEGER,               -- Timestamp when staff confirmed

    -- Metadata
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(roster_id) REFERENCES weekly_rosters(id) ON DELETE CASCADE,
    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Indexes for rosters
CREATE INDEX IF NOT EXISTS idx_roster_tenant ON weekly_rosters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roster_week ON weekly_rosters(week_start_date);
CREATE INDEX IF NOT EXISTS idx_roster_status ON weekly_rosters(status);
CREATE INDEX IF NOT EXISTS idx_roster_year_week ON weekly_rosters(year, week_number);

-- Indexes for assignments
CREATE INDEX IF NOT EXISTS idx_assignment_roster ON roster_assignments(roster_id);
CREATE INDEX IF NOT EXISTS idx_assignment_staff ON roster_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_assignment_date ON roster_assignments(shift_date);
CREATE INDEX IF NOT EXISTS idx_assignment_staff_date ON roster_assignments(staff_id, shift_date);

-- One assignment per staff per date (prevent double booking)
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignment_unique
ON roster_assignments(staff_id, shift_date);

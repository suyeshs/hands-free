-- Leave Requests - Time off management
CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,

    -- Leave period
    start_date TEXT NOT NULL,                 -- YYYY-MM-DD
    end_date TEXT NOT NULL,                   -- YYYY-MM-DD
    leave_type TEXT NOT NULL,                 -- vacation, sick, personal, emergency, unpaid

    -- Duration
    total_days INTEGER NOT NULL,              -- Number of days requested
    is_half_day INTEGER DEFAULT 0,            -- Boolean: is this a half-day leave

    -- Request details
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',   -- pending, approved, rejected, cancelled

    -- Approval workflow
    requested_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by TEXT,                         -- Manager staff ID
    review_notes TEXT,

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES staff_users(id)
);

-- Leave Balances - Track available leave days per staff
CREATE TABLE IF NOT EXISTS leave_balances (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    year INTEGER NOT NULL,

    -- Leave allocations
    vacation_days_total INTEGER DEFAULT 0,
    vacation_days_used INTEGER DEFAULT 0,
    sick_days_total INTEGER DEFAULT 0,
    sick_days_used INTEGER DEFAULT 0,
    personal_days_total INTEGER DEFAULT 0,
    personal_days_used INTEGER DEFAULT 0,

    -- Tracking
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,

    -- One balance record per staff per year
    UNIQUE(staff_id, year)
);

-- Indexes for leave requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_dates ON leave_requests(staff_id, start_date);

-- Indexes for leave balances
CREATE INDEX IF NOT EXISTS idx_leave_balances_tenant ON leave_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_staff ON leave_balances(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);

# Staff Roles and Features Matrix

## Staff Role Definitions

### 1. Kitchen Staff
**Primary Responsibility**: Food preparation and order fulfillment

**Access**:
- ✅ Kitchen Display System (KDS)
- ✅ View incoming orders
- ✅ Mark items as prepared/completed
- ✅ Timer and priority indicators
- ✅ Personal salary and schedule (mobile app)
- ❌ Point of Sale
- ❌ Reports
- ❌ Settings

**Mobile App Features**:
- View salary and payslips
- View work schedule
- Clock in/out
- View attendance history
- Request leave
- View order queue (read-only)
- Recipe access (optional)

---

### 2. Service Staff
**Primary Responsibility**: Customer service and order taking

**Access**:
- ✅ Point of Sale (POS)
- ✅ Take orders and process payments
- ✅ Table management
- ✅ Service requests
- ✅ Customer management
- ✅ Personal salary and schedule (mobile app)
- ❌ Kitchen Display (view only)
- ❌ Full Reports
- ❌ Settings

**Mobile App Features**:
- View salary and payslips
- View work schedule
- Clock in/out
- View attendance history
- Request leave
- **Take orders on mobile device**
- View assigned tables
- View tips earned
- Customer order history

---

### 3. Captain (Senior Service Staff)
**Primary Responsibility**: Team leadership, supervision, and customer escalation

**Access**:
- ✅ All Service Staff features
- ✅ Team roster view
- ✅ Assign tasks to service staff
- ✅ View team performance
- ✅ Handle customer escalations
- ✅ Access to sales reports
- ✅ Limited settings access
- ✅ Personal salary and schedule (mobile app)
- ⚠️ Can override some operations (void items, discounts)

**Mobile App Features**:
- All Service Staff features
- **View team schedule**
- **Assign tasks to team members**
- View team attendance
- Performance metrics
- Sales summaries
- Customer feedback/complaints
- Approve certain actions

---

### 4. Cleaning Staff
**Primary Responsibility**: Maintaining cleanliness and table turnover

**Access**:
- ✅ Table status view (dirty/clean)
- ✅ Cleaning checklist
- ✅ Mark tables as cleaned
- ✅ Task assignments
- ✅ Personal salary and schedule (mobile app)
- ❌ Point of Sale
- ❌ Kitchen Display
- ❌ Customer orders
- ❌ Reports

**Mobile App Features**:
- View salary and payslips
- View work schedule
- Clock in/out
- View attendance history
- Request leave
- **Cleaning task checklist**
- **Mark tables as cleaned**
- View assigned areas
- Report maintenance issues

---

## Feature Access Matrix

| Feature | Kitchen | Service | Captain | Cleaning | Manager |
|---------|---------|---------|---------|----------|---------|
| **POS (Point of Sale)** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Kitchen Display** | ✅ | 👁️ | 👁️ | ❌ | ✅ |
| **Take Orders** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Process Payments** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Table Management** | ❌ | ✅ | ✅ | 👁️ | ✅ |
| **View Team Schedule** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Assign Tasks** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Approve Discounts** | ❌ | ❌ | ⚠️ | ❌ | ✅ |
| **Sales Reports** | ❌ | ❌ | 📊 | ❌ | ✅ |
| **Staff Management** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Settings** | ❌ | ❌ | ⚠️ | ❌ | ✅ |
| | | | | | |
| **View Own Salary** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Own Schedule** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Clock In/Out** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Request Leave** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Attendance** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Payslips** | ✅ | ✅ | ✅ | ✅ | ✅ |

**Legend**:
- ✅ Full access
- 👁️ View only (read-only)
- 📊 Summary view (limited reports)
- ⚠️ Limited access (some features)
- ❌ No access

---

## Mobile App - Role-Based UI

### Common Features (All Roles)
```
Bottom Navigation (All Staff):
┌─────────────────────────────────────────┐
│ [Home] [Salary] [Schedule] [Attendance] │
│                 [Leave]                  │
└─────────────────────────────────────────┘

Home Tab - Personalized Dashboard:
- Welcome message with name and role
- Current month salary projection
- Today's shift (if scheduled)
- Quick actions (Clock In, Request Leave)
- Notifications
```

### Kitchen Staff - Additional Tab
```
Bottom Navigation (Kitchen):
┌─────────────────────────────────────────┐
│ [Home] [Orders] [Salary] [Schedule]     │
│         [Attendance] [Leave]            │
└─────────────────────────────────────────┘

Orders Tab (Kitchen View):
- Active orders queue
- Order details and items
- Mark items as prepared
- View preparation time
- Priority indicators
- Filter by category
```

### Service Staff - Additional Tab
```
Bottom Navigation (Service):
┌─────────────────────────────────────────┐
│ [Home] [Tables] [Salary] [Schedule]     │
│         [Attendance] [Leave]            │
└─────────────────────────────────────────┘

Tables Tab (Service View):
- Floor plan view
- Table status (occupied/available)
- Assigned tables
- Quick order entry
- View orders by table
- Customer info
```

### Captain - Additional Tabs
```
Bottom Navigation (Captain):
┌─────────────────────────────────────────┐
│ [Home] [Tables] [Team] [Reports]        │
│   [Salary] [Schedule] [Attendance]      │
└─────────────────────────────────────────┘

Team Tab:
- Team roster for the day
- Staff availability
- Task assignments
- Performance overview
- Quick actions (assign tables, approve actions)

Reports Tab:
- Daily sales summary
- Table turnover
- Average order value
- Tips summary
- Top-selling items
```

### Cleaning Staff - Additional Tab
```
Bottom Navigation (Cleaning):
┌─────────────────────────────────────────┐
│ [Home] [Tasks] [Salary] [Schedule]      │
│         [Attendance] [Leave]            │
└─────────────────────────────────────────┘

Tasks Tab (Cleaning View):
- Table status (dirty/clean)
- Cleaning checklist
- Mark tables as cleaned
- Assigned areas
- Priority cleaning tasks
- Maintenance issues
```

---

## Salary & Attendance Features by Role

### Common Salary Features (All Roles)

**Salary Dashboard**:
```
Current Month Breakdown:
- Base Salary: ₹15,000
- Days Worked: 22/26
- Hours Worked: 176/208
- Overtime: 12 hours @ ₹125/hr = ₹1,500
- Bonuses: ₹1,000
- Advances Deducted: -₹2,000
- Other Deductions: -₹500
- Net Pay: ₹15,000
```

**Attendance Summary**:
```
This Month:
- Present: 22 days
- Absent: 0 days
- Leave: 2 days
- Late Arrivals: 1
- Total Hours: 176
- Overtime Hours: 12
```

### Role-Specific Additions

**Service Staff & Captain**:
```
Additional Salary Components:
- Tips Earned: ₹3,500
- Service Charge Share: ₹800
- Performance Bonus: ₹500

Tips Breakdown:
- Cash Tips: ₹1,200
- Card Tips: ₹2,300
- Average per Day: ₹130
```

**Kitchen Staff**:
```
Additional Salary Components:
- Night Shift Allowance: ₹500
- Kitchen Bonus: ₹300

Performance Metrics:
- Orders Completed: 450
- Average Prep Time: 8 mins
- Quality Rating: 4.5/5
```

**Cleaning Staff**:
```
Additional Salary Components:
- Cleanliness Bonus: ₹200

Performance Metrics:
- Tables Cleaned: 320
- Areas Maintained: 5
- Quality Score: 4.2/5
```

**Captain**:
```
Additional Salary Components:
- Leadership Allowance: ₹2,000
- Tips Earned: ₹4,500
- Team Performance Bonus: ₹1,000

Team Performance:
- Team Size: 6 staff
- Team Sales: ₹2,50,000
- Customer Satisfaction: 4.3/5
- Table Turnover: 3.2x
```

---

## Mobile App User Stories

### Kitchen Staff
```
As a Kitchen Staff member, I want to:
1. View my salary breakdown including night shift allowances
2. See my work schedule for the week
3. Clock in/out when I start/end my shift
4. View how many orders I've completed
5. Request leave for personal reasons
6. Download my payslip
7. See my overtime hours
8. View active orders in the queue (mobile backup)
```

### Service Staff
```
As a Service Staff member, I want to:
1. View my salary including tips and bonuses
2. See which tables I'm assigned to today
3. Clock in/out and track my hours
4. Take orders on my personal device
5. Request leave for emergencies
6. View my monthly tips earned
7. See my schedule and shift timings
8. Check my attendance record
```

### Captain
```
As a Captain, I want to:
1. View my salary including leadership allowance
2. See my team's schedule and availability
3. Assign tables to service staff
4. View team performance metrics
5. Handle customer escalations
6. Approve certain actions (discounts, voids)
7. See daily sales summary
8. Request leave and manage my schedule
9. View my overtime and bonus structure
```

### Cleaning Staff
```
As a Cleaning Staff member, I want to:
1. View my salary and cleanliness bonuses
2. See my cleaning task checklist
3. Mark tables as cleaned
4. Clock in/out when I start/end work
5. View my assigned areas
6. Request leave when needed
7. Report maintenance issues
8. See my monthly performance
```

---

## Implementation Priorities

### Phase 1: Core Features (All Roles)
1. ✅ Authentication (PIN + Biometric)
2. ✅ Salary Dashboard
3. ✅ Schedule View
4. ✅ Attendance History
5. ✅ Leave Management
6. ✅ Profile & Settings

### Phase 2: Service Staff Features
1. ✅ Mobile Order Taking
2. ✅ Table Management
3. ✅ Tips Tracking
4. ✅ Customer Management

### Phase 3: Captain Features
1. ✅ Team Roster View
2. ✅ Task Assignment
3. ✅ Performance Metrics
4. ✅ Sales Reports

### Phase 4: Kitchen Features
1. ✅ Order Queue View (Mobile)
2. ✅ Recipe Access
3. ✅ Prep Time Tracking

### Phase 5: Cleaning Features
1. ✅ Cleaning Checklist
2. ✅ Table Status Management
3. ✅ Maintenance Reporting

---

## Database Schema Updates

### Add Role-Specific Fields

```sql
-- Update staff_users table to support new roles
ALTER TABLE staff_users ADD COLUMN sub_role TEXT;
-- sub_role can be: 'captain' for senior service staff

-- Add tips tracking for service staff
CREATE TABLE IF NOT EXISTS staff_tips (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    tip_type TEXT NOT NULL CHECK(tip_type IN ('cash', 'card', 'digital')),
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

-- Add cleaning tasks tracking
CREATE TABLE IF NOT EXISTS cleaning_tasks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    staff_id TEXT,
    area TEXT NOT NULL,
    task_description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
    assigned_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL
);

-- Add team assignments for captains
CREATE TABLE IF NOT EXISTS team_assignments (
    id TEXT PRIMARY KEY,
    captain_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    shift_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(captain_id) REFERENCES staff_users(id),
    FOREIGN KEY(staff_id) REFERENCES staff_users(id)
);
```

---

## Conclusion

**Staff Roles Defined**:
1. ✅ **Kitchen Staff** - Food preparation, KDS access
2. ✅ **Service Staff** - Customer service, order taking
3. ✅ **Captain** - Team leadership, supervision
4. ✅ **Cleaning Staff** - Maintenance, table turnover

**Mobile App Provides**:
- Role-based navigation and features
- Personalized salary dashboards
- Schedule and attendance tracking
- Leave management
- Role-specific tools (orders, tasks, team management)

**Next Steps**:
1. Implement PWA with role-based routing
2. Create role-specific UI components
3. Add tips tracking for service staff
4. Add cleaning task management
5. Add team management for captains
6. Test with real staff members from each role

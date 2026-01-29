# Staff Mobile App - Implementation Plan

> **📱 UPDATE**: This project will be a **full native Android app**, not a PWA.
>
> **See the complete Android app plan here**: [STAFF_MOBILE_APP_ANDROID.md](STAFF_MOBILE_APP_ANDROID.md)

---

## Goal
Build a mobile app for staff to access on their personal devices (iOS & Android) to view:
- Personal salary information and payslips
- Work schedule/roster
- Attendance history
- Leave balance and requests
- Clock in/out (if at restaurant)
- Take orders (for service staff)

---

## ~~Recommended Approach: Progressive Web App (PWA)~~ DEPRECATED

**New Approach**: Native Android App (React Native or Kotlin)

### Why PWA First?

✅ **Fast to Market**
- Reuse existing React components
- No app store approval delays
- Deploy instantly via URL

✅ **Cross-Platform**
- Works on iOS and Android
- One codebase for all devices
- Can be installed on home screen

✅ **Cost-Effective**
- No separate mobile development
- Leverage existing tech stack
- Easy maintenance

✅ **Restaurant Network Access**
- Connects to local SQLite via API
- Can sync with cloud backend
- Real-time updates via WebSocket

### PWA Limitations to Consider:
- ⚠️ Limited offline capabilities compared to native
- ⚠️ No push notifications on iOS (only Android)
- ⚠️ Slightly less native feel than React Native
- ⚠️ No access to some device features (Bluetooth, NFC)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Staff Mobile Device                    │
│                   (iOS / Android)                       │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Progressive Web App (PWA)                 │ │
│  │  https://restaurant.app/staff-mobile              │ │
│  │                                                   │ │
│  │  📱 Mobile-Optimized UI:                         │ │
│  │  • Touch-friendly controls                       │ │
│  │  • Responsive layouts                            │ │
│  │  • Bottom navigation                             │ │
│  │  • Swipe gestures                                │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTPS API Calls
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Restaurant Backend / API                   │
│                                                         │
│  Option A: Local Network API (Tauri Backend)           │
│  • Staff connects to restaurant WiFi                   │
│  • API served from desktop app: http://192.168.1.x     │
│  • Direct SQLite access                                │
│                                                         │
│  Option B: Cloud Backend (Cloudflare Workers)          │
│  • Staff connects from anywhere                        │
│  • API: https://api.restaurant.com                     │
│  • Synced with D1 database                             │
│                                                         │
│  Option C: Hybrid (Recommended)                        │
│  • Local network when at restaurant                    │
│  • Cloud backend when remote                           │
│  • Auto-switch based on connectivity                   │
└─────────────────────────────────────────────────────────┘
```

---

## Feature Requirements

### 1. Authentication
- **Staff Login**
  - PIN-based (4-6 digits)
  - Biometric (fingerprint/face ID) after first login
  - Session management
  - Auto-logout after inactivity

### 2. Home Dashboard
- **Personal Overview**
  - Welcome message with name
  - Current month salary projection
  - Today's shift (if scheduled)
  - Quick actions: Clock In, Request Leave
  - Notifications badge

### 3. Salary & Payroll
- **My Salary Tab**
  - Current month breakdown:
    - Base salary
    - Days worked / Total days
    - Hours worked (regular + overtime)
    - Bonuses this month
    - Advances being deducted
    - Other deductions
    - **Net Pay (large, prominent)**
  - Historical payslips (last 12 months)
  - Download payslip as PDF
  - Advance request form

### 4. Schedule & Roster
- **My Schedule Tab**
  - Weekly calendar view
  - Monthly calendar view
  - Shift details:
    - Date, day of week
    - Start/end times
    - Role assignment
    - Location/section
  - Shift confirmation (tap to confirm)
  - Filter: Upcoming, Past, All

### 5. Attendance
- **My Attendance Tab**
  - Current month summary:
    - Days present: 22/26
    - Hours worked: 176h
    - Overtime: 12h
    - Late arrivals: 2
  - Attendance calendar (color-coded)
    - Green: Present
    - Yellow: Late
    - Red: Absent
    - Blue: Leave
  - Daily detail view
  - Clock In/Out button (if at restaurant)

### 6. Leave Management
- **Leave Tab**
  - Leave balance cards:
    - Vacation: 5 / 12 days remaining
    - Sick Leave: 7 / 10 days remaining
    - Personal: 2 / 3 days remaining
  - Request Leave form:
    - Leave type dropdown
    - Start date picker
    - End date picker
    - Half-day option
    - Reason text area
    - Submit button
  - Leave history:
    - Pending requests (yellow badge)
    - Approved (green)
    - Rejected (red with reason)

### 7. Profile & Settings
- **Profile Tab**
  - Personal info display:
    - Name, role, employee ID
    - Email, phone
    - Joining date
  - Settings:
    - Change PIN
    - Biometric toggle
    - Language selection
    - Dark mode toggle
    - Notifications preferences
  - Logout button

### 8. Role-Specific Features

**Service Staff & Captain**
- **Orders Tab**
  - Table view / list view
  - Quick order entry
  - Menu browsing
  - Order summary
  - Send to kitchen
  - View order status
  - Customer management

**Kitchen Staff**
- **Kitchen Orders Tab**
  - View incoming orders
  - Mark items as prepared
  - View order queue
  - Timer for each order
  - Filter by category

**Cleaning Staff**
- **Cleaning Tasks Tab**
  - Table status (dirty/clean)
  - Cleaning checklist
  - Mark tables as cleaned
  - Task assignments
  - Area management

**Captain (Additional)**
- All service staff features
- **Team Management**
  - View team roster
  - Assign tasks to service staff
  - View team performance
  - Handle escalations

---

## Technical Stack

### Frontend
```javascript
// Core
React 18
TypeScript
Vite

// UI Framework
Tailwind CSS
shadcn/ui (mobile-optimized)
Framer Motion (animations)

// Mobile-Specific
react-use-gesture (swipe, pinch)
react-spring (smooth animations)
workbox (PWA service worker)

// State Management
Zustand (existing)
React Query (API caching)

// Forms
React Hook Form
Zod (validation)
```

### PWA Configuration
```javascript
// manifest.json
{
  "name": "Staff Portal",
  "short_name": "Staff",
  "start_url": "/staff-mobile",
  "display": "standalone",
  "theme_color": "#f97316",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}

// Service Worker (Workbox)
- Cache-first for static assets
- Network-first for API calls
- Offline fallback page
```

### Backend API

**Option A: Extend Existing Tauri Backend**
```rust
// Add HTTP server to Tauri app
// src-tauri/src/api_server.rs

use actix_web::{web, App, HttpServer};

// Serve API on local network
// http://192.168.1.100:8080/api/staff

// Endpoints:
// GET  /api/staff/me - Get staff profile
// GET  /api/staff/salary - Get salary info
// GET  /api/staff/schedule - Get roster
// GET  /api/staff/attendance - Get attendance
// GET  /api/staff/leave - Get leave balance
// POST /api/staff/leave - Request leave
// POST /api/staff/clock-in - Clock in
// POST /api/staff/clock-out - Clock out
```

**Option B: Use Existing Cloudflare Workers**
```typescript
// Extend existing backend
// workers/restaurant-provisioning/src/index.ts

// Add staff endpoints to D1 database
// https://api.restaurant.com/staff

// Already has:
// - Authentication
// - D1 database sync
// - Tenant isolation
```

**Option C: Hybrid (Recommended)**
```typescript
// Mobile app detects environment
async function getApiBaseUrl(): Promise<string> {
  // Try local network first
  const localUrl = 'http://192.168.1.100:8080/api';
  try {
    const response = await fetch(`${localUrl}/health`, {
      timeout: 2000
    });
    if (response.ok) {
      return localUrl; // Use local
    }
  } catch (err) {
    console.log('Local API not available, using cloud');
  }

  // Fallback to cloud
  return 'https://api.restaurant.com';
}
```

---

## Mobile UI Design

### Navigation Structure
```
┌─────────────────────────────┐
│      Top App Bar            │
│  Staff Portal    [Profile]  │
├─────────────────────────────┤
│                             │
│    [Content Area]           │
│                             │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│   Bottom Navigation         │
│  [Home] [Salary] [Schedule] │
│  [Attendance] [Leave]       │
└─────────────────────────────┘
```

### Key UI Principles
1. **Large Touch Targets** - Min 44px buttons
2. **Bottom Navigation** - Thumb-friendly
3. **Swipe Gestures** - Back, refresh, delete
4. **Pull to Refresh** - Update data
5. **Loading States** - Skeleton screens
6. **Error States** - Clear messaging
7. **Offline Mode** - Cached data display
8. **Dark Mode** - OLED-friendly

### Example Salary Screen
```
┌─────────────────────────────────────────┐
│  ← My Salary              [Download]    │
├─────────────────────────────────────────┤
│                                         │
│  Current Month: January 2024            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │   Expected Net Pay              │   │
│  │   ₹ 18,500                     │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Days Worked: 22 / 26                  │
│  Hours Worked: 176 / 208               │
│                                         │
│  ┌─ Breakdown ────────────────────┐   │
│  │  Base Salary      ₹ 15,000    │   │
│  │  Overtime (12h)   ₹  2,500    │   │
│  │  Bonuses          ₹  1,000    │   │
│  │  ───────────────────────────   │   │
│  │  Gross            ₹ 18,500    │   │
│  │                                │   │
│  │  Advance Deduct   ₹ -2,000    │   │
│  │  Other Deductions ₹   -500    │   │
│  │  ───────────────────────────   │   │
│  │  Net Pay          ₹ 16,000    │   │
│  └────────────────────────────────┘   │
│                                         │
│  [Request Advance]                      │
│                                         │
│  Past Payslips ▼                        │
│  • December 2023 - ₹16,200  [View]     │
│  • November 2023 - ₹15,800  [View]     │
│  • October 2023  - ₹16,500  [View]     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core PWA Setup (Week 1)
**Goal**: Basic mobile-responsive site with PWA capabilities

Tasks:
- [ ] Create `/staff-mobile` route in existing React app
- [ ] Add PWA manifest.json
- [ ] Configure Workbox service worker
- [ ] Set up mobile-responsive layouts
- [ ] Add bottom navigation component
- [ ] Implement authentication (PIN login)
- [ ] Add biometric auth (Web Authentication API)

**Deliverable**: Installable PWA with login

### Phase 2: API Backend (Week 2)
**Goal**: Expose staff data via REST API

Tasks:
- [ ] Decide: Local API vs Cloud vs Hybrid
- [ ] Create staff API endpoints:
  - [ ] GET /api/staff/me
  - [ ] GET /api/staff/salary
  - [ ] GET /api/staff/schedule
  - [ ] GET /api/staff/attendance
  - [ ] GET /api/staff/leave
  - [ ] POST /api/staff/leave
- [ ] Add JWT authentication
- [ ] Test API security
- [ ] Add rate limiting

**Deliverable**: Working API with all endpoints

### Phase 3: Salary & Schedule Views (Week 3)
**Goal**: Staff can view salary and schedule

Tasks:
- [ ] Build Salary Dashboard component
- [ ] Build Payslip viewer
- [ ] Build Schedule calendar view
- [ ] Build Shift detail view
- [ ] Add pull-to-refresh
- [ ] Add offline caching
- [ ] Test with real data

**Deliverable**: Functional salary and schedule screens

### Phase 4: Attendance & Leave (Week 4)
**Goal**: Staff can view attendance and request leave

Tasks:
- [ ] Build Attendance calendar
- [ ] Build Attendance summary
- [ ] Build Leave request form
- [ ] Build Leave history view
- [ ] Add form validation
- [ ] Add optimistic UI updates
- [ ] Test approval workflow

**Deliverable**: Complete attendance and leave features

### Phase 5: Profile & Settings (Week 5)
**Goal**: Staff can manage profile and preferences

Tasks:
- [ ] Build Profile view
- [ ] Build Settings page
- [ ] Add PIN change form
- [ ] Add language selection
- [ ] Add dark mode toggle
- [ ] Add notification preferences
- [ ] Test on multiple devices

**Deliverable**: Complete user profile management

### Phase 6: Testing & Polish (Week 6)
**Goal**: Production-ready app

Tasks:
- [ ] Cross-browser testing (Safari, Chrome, Firefox)
- [ ] Cross-device testing (iOS, Android, tablets)
- [ ] Performance optimization
- [ ] Lighthouse PWA audit (score >90)
- [ ] Accessibility testing (WCAG 2.1 AA)
- [ ] User acceptance testing with staff
- [ ] Fix bugs and polish UI

**Deliverable**: Production-ready PWA

### Phase 7: Order Taking (Optional - Week 7-8)
**Goal**: Service staff can take orders on mobile

Tasks:
- [ ] Build table selection view
- [ ] Build menu browser (mobile-optimized)
- [ ] Build cart/order summary
- [ ] Add item customization
- [ ] Add order submission
- [ ] Test order flow end-to-end

**Deliverable**: Mobile order taking for service staff

---

## Alternative: React Native App

If PWA limitations are too restrictive, consider React Native:

### Pros:
- ✅ True native experience
- ✅ Better offline support
- ✅ Push notifications on iOS
- ✅ Access to native APIs
- ✅ Better performance

### Cons:
- ❌ Separate codebase to maintain
- ❌ App store approval process
- ❌ iOS and Android builds
- ❌ More development time
- ❌ Higher cost

### Tech Stack (React Native):
```
React Native CLI (not Expo)
TypeScript
React Navigation
React Native Paper (UI)
React Query
AsyncStorage (offline)
React Native Biometrics
CodePush (OTA updates)
```

---

## Deployment

### PWA Deployment

**Option 1: Host on Cloudflare Pages**
```bash
# Build PWA
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist
# URL: https://staff.restaurant.com
```

**Option 2: Serve from Tauri Backend**
```rust
// Serve PWA from local network
// Desktop app hosts PWA on :8080
// Staff access: http://192.168.1.100:8080/staff-mobile
```

**Option 3: Hybrid**
- Cloud version for remote access
- Local version when at restaurant
- Auto-detect and switch

### Installation Flow

1. **Staff receives link**
   - Manager sends URL via SMS/WhatsApp
   - https://staff.restaurant.com

2. **Staff opens in browser**
   - Mobile browser (Safari/Chrome)
   - Sees "Install App" prompt

3. **Install to home screen**
   - iOS: Share → Add to Home Screen
   - Android: "Add to Home Screen" banner

4. **App icon on home screen**
   - Opens in standalone mode
   - Looks like native app
   - No browser UI visible

---

## Security Considerations

### Authentication
- ✅ PIN + Biometric (2FA)
- ✅ JWT tokens with short expiry
- ✅ Secure token storage (localStorage encrypted)
- ✅ Auto-logout on inactivity (5 min)
- ✅ Device fingerprinting
- ✅ Rate limiting on login

### Data Privacy
- ✅ HTTPS only (no HTTP)
- ✅ Certificate pinning (for production)
- ✅ Salary data encrypted in transit
- ✅ No sensitive data in cache
- ✅ Clear data on logout
- ✅ Tenant isolation (staff can only see own data)

### Network Security
- ✅ VPN support for remote access
- ✅ IP whitelisting (optional)
- ✅ CORS properly configured
- ✅ XSS protection
- ✅ SQL injection prevention

---

## Cost Estimate

### PWA Development (6 weeks)
- **Development**: 6 weeks × 40 hours = 240 hours
- **Testing**: 1 week × 20 hours = 20 hours
- **Total**: 260 hours

### React Native (if needed later)
- **Development**: 8 weeks × 40 hours = 320 hours
- **Testing**: 2 weeks × 20 hours = 40 hours
- **Total**: 360 hours

### Infrastructure Costs
- **Cloudflare Pages**: Free (or $20/month for pro)
- **Cloudflare Workers**: $5/month (included in existing plan)
- **Push Notifications**: Free (Firebase Cloud Messaging)
- **SSL Certificate**: Free (Cloudflare)

---

## Success Metrics

### Adoption
- [ ] 80% of staff install PWA within 1 month
- [ ] 60% daily active users
- [ ] 90% weekly active users

### Usage
- [ ] Average session duration >5 minutes
- [ ] 3+ page views per session
- [ ] 70% check salary at least once per week

### Performance
- [ ] Page load time <2 seconds
- [ ] Lighthouse PWA score >90
- [ ] Time to Interactive <3 seconds

### Satisfaction
- [ ] User satisfaction score >4/5
- [ ] <5% support tickets related to app
- [ ] Positive feedback from staff

---

## Next Steps

### Immediate Actions:

1. **Decision: PWA vs React Native**
   - Recommend: Start with PWA
   - Upgrade to React Native only if PWA limitations are blocking

2. **Decision: Local vs Cloud API**
   - Recommend: Hybrid approach
   - Local when at restaurant, cloud when remote

3. **Create Mobile Route**
   - Add `/staff-mobile` route to App.tsx
   - Mobile-specific layout component

4. **API Endpoints**
   - Extend existing Tauri backend OR
   - Use Cloudflare Workers

5. **UI Components**
   - Build mobile-optimized components
   - Reuse existing stores (Zustand)

### Development Order:
1. ✅ Phase 1: PWA Setup + Auth (Week 1)
2. ✅ Phase 2: API Backend (Week 2)
3. ✅ Phase 3: Salary + Schedule (Week 3)
4. ✅ Phase 4: Attendance + Leave (Week 4)
5. ✅ Phase 5: Profile + Settings (Week 5)
6. ✅ Phase 6: Testing + Polish (Week 6)
7. 🔄 Phase 7: Order Taking (Optional)

---

## File Structure

```
src/
├── pages/
│   └── staff-mobile/
│       ├── StaffMobileLayout.tsx      # Main mobile layout
│       ├── HomePage.tsx               # Dashboard
│       ├── SalaryPage.tsx             # Salary & payslips
│       ├── SchedulePage.tsx           # Roster & shifts
│       ├── AttendancePage.tsx         # Attendance history
│       ├── LeavePage.tsx              # Leave management
│       ├── ProfilePage.tsx            # Profile & settings
│       └── OrdersPage.tsx             # Order taking (optional)
│
├── components/
│   └── staff-mobile/
│       ├── BottomNav.tsx              # Bottom navigation
│       ├── SalaryCard.tsx             # Salary breakdown
│       ├── PayslipViewer.tsx          # Payslip detail
│       ├── ShiftCard.tsx              # Shift details
│       ├── AttendanceCalendar.tsx     # Calendar view
│       ├── LeaveRequestForm.tsx       # Leave form
│       └── PINLogin.tsx               # Mobile PIN entry
│
├── hooks/
│   └── staff-mobile/
│       ├── useStaffAuth.ts            # Mobile auth
│       ├── useStaffSalary.ts          # Salary data
│       ├── useStaffSchedule.ts        # Schedule data
│       └── useStaffLeave.ts           # Leave data
│
├── api/
│   └── staff/
│       ├── auth.ts                    # Auth endpoints
│       ├── salary.ts                  # Salary endpoints
│       ├── schedule.ts                # Schedule endpoints
│       ├── attendance.ts              # Attendance endpoints
│       └── leave.ts                   # Leave endpoints
│
└── pwa/
    ├── manifest.json                  # PWA manifest
    ├── service-worker.ts              # Service worker
    └── offline.html                   # Offline fallback
```

---

## Conclusion

**Recommended Path**: Progressive Web App (PWA)

**Timeline**: 6-8 weeks for full implementation

**Key Benefits**:
- ✅ Staff can access salary, schedule, attendance, leave from personal devices
- ✅ Cross-platform (iOS + Android)
- ✅ No app store approval needed
- ✅ Reuses existing React codebase
- ✅ Quick to market

**Once built, staff will have**:
- 📱 Mobile app on their phone
- 💰 Real-time salary visibility
- 📅 Work schedule access
- 📊 Attendance tracking
- 🏖️ Leave request capability
- 🔐 Secure PIN + biometric login

This solves the critical gap where staff currently have no way to access their data from personal devices!

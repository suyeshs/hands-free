# Staff Android Mobile App - Implementation Plan

## Goal
Build a **native Android app** for staff to access on their personal devices to:
- View personal salary information and payslips
- View work schedule/roster
- Track attendance and clock in/out
- Manage leave requests
- Access role-specific features (orders, tasks, team management)

---

## Approach: Native Android App

### Why Native Android?

✅ **Best User Experience**
- True native performance
- Native Android UI/UX patterns
- Smooth animations and transitions
- Full offline support

✅ **Full Device Access**
- Push notifications (Firebase Cloud Messaging)
- Biometric authentication (fingerprint, face unlock)
- Camera for QR scanning
- Bluetooth for printers (optional)
- Background sync

✅ **Professional App**
- Available on Google Play Store
- Proper app icon and branding
- Update via Play Store
- Professional onboarding

✅ **Better for Restaurant Use**
- Works on any Android device (phones, tablets)
- Can run offline with local caching
- Better battery optimization
- More reliable for staff daily use

---

## Technical Stack

### Option A: React Native (Recommended)

**Why React Native?**
- Reuse existing React/TypeScript knowledge
- Share business logic with web app
- Hot reload for fast development
- Large ecosystem and community
- Cross-platform ready (can add iOS later)

**Tech Stack**:
```javascript
// Framework
React Native 0.73+
TypeScript
React Navigation 6+

// UI Components
React Native Paper (Material Design 3)
React Native Vector Icons
React Native Gesture Handler
React Native Reanimated 3

// State Management
Zustand (same as web app)
React Query (API caching)
AsyncStorage (local persistence)
SQLite (offline database - optional)

// Authentication
React Native Biometrics
Keychain/SecureStore

// Network
Axios or Fetch API
WebSocket support

// Push Notifications
Firebase Cloud Messaging (FCM)
React Native Notifications

// Additional
React Native MMKV (fast key-value storage)
React Native Image Picker (profile photos)
React Native PDF (payslip viewing)
React Native Share (share payslips)
```

### Option B: Native Android (Kotlin)

**Why Native Android?**
- Best performance
- Full platform features
- Google's recommended approach
- Better for complex apps

**Tech Stack**:
```kotlin
// Framework
Kotlin
Jetpack Compose (Modern Android UI)
Android SDK 24+ (Android 7.0+)

// Architecture
MVVM (Model-View-ViewModel)
Jetpack ViewModel
LiveData / StateFlow
Room Database (offline)

// UI
Material Design 3
Compose Navigation
Accompanist libraries

// Network
Retrofit + OkHttp
Gson / Moshi
Coroutines for async

// Authentication
BiometricPrompt API
Android Keystore

// Push Notifications
Firebase Cloud Messaging

// Additional
WorkManager (background sync)
DataStore (settings)
CameraX (camera features)
```

**Recommendation**: **React Native** for faster development and code reuse.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Staff Android Device                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Staff Mobile App (React Native)            │ │
│  │                                                    │ │
│  │  📱 Native Android UI:                            │ │
│  │  • Material Design 3                              │ │
│  │  • Bottom navigation                              │ │
│  │  • Native gestures                                │ │
│  │  • Biometric auth                                 │ │
│  │  • Push notifications                             │ │
│  │  • Offline support                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Local Storage:                                         │
│  • AsyncStorage (settings, tokens)                     │
│  • SQLite (cached data for offline)                    │
│  • MMKV (fast key-value store)                         │
└──────────────────────┬───────────────────────────────────┘
                       │
                       │ HTTPS API + WebSocket
                       ▼
┌──────────────────────────────────────────────────────────┐
│              Restaurant Backend API                      │
│                                                          │
│  Option 1: Cloudflare Workers + D1 (Recommended)        │
│  • https://api.restaurant.com/staff                     │
│  • JWT authentication                                   │
│  • D1 database (synced from desktop)                    │
│  • Real-time updates via WebSocket                      │
│  • Push notification service                            │
│                                                          │
│  Option 2: Tauri Backend (Local Network)                │
│  • http://192.168.1.x:8080/api/staff                   │
│  • Direct SQLite access                                 │
│  • Only works on restaurant WiFi                        │
│  • Good for testing                                     │
│                                                          │
│  Recommended: Hybrid                                     │
│  • Cloud for remote access                              │
│  • Local network when at restaurant (faster)            │
│  • Auto-detect and switch                               │
└──────────────────────────────────────────────────────────┘
```

---

## App Features

### 1. Authentication & Onboarding

**First Launch**:
```
Screen 1: Welcome
- App logo and branding
- "Welcome to [Restaurant Name] Staff App"
- [Get Started] button

Screen 2: Restaurant Selection
- Enter restaurant code OR
- Scan QR code
- Validates restaurant exists

Screen 3: Staff Login
- Select your name from list
- Enter 4-6 digit PIN
- [Login] button

Screen 4: Setup Biometrics
- "Enable fingerprint/face unlock?"
- [Enable] [Skip]

Screen 5: Permissions
- Notifications permission
- Location permission (for clock in/out)
- [Allow] [Not Now]

Screen 6: Home Dashboard
- Welcome message
- Start using the app
```

**Subsequent Launches**:
```
1. App opens
2. Biometric prompt (if enabled)
3. Auto-login to home screen
```

### 2. Home Dashboard

**Layout**:
```
┌─────────────────────────────────────────┐
│  Staff App         [Notifications] [☰]  │
├─────────────────────────────────────────┤
│                                         │
│  👋 Welcome back, John!                 │
│  Service Staff                          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Current Month Salary           │   │
│  │  ₹ 18,500                       │   │
│  │  22/26 days worked              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Today's Shift                          │
│  ┌─────────────────────────────────┐   │
│  │  🕐 10:00 AM - 6:00 PM          │   │
│  │  📍 Main Floor                  │   │
│  │  [Clock In]                     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Quick Actions                          │
│  [📅 View Schedule] [🏖️ Request Leave] │
│  [📊 Attendance]    [💰 Payslips]      │
│                                         │
│  🔔 Notifications (2)                   │
│  • Roster for next week published      │
│  • Payslip for Dec 2023 available      │
│                                         │
└─────────────────────────────────────────┘
│ [🏠] [💰] [📅] [👤] [⋯]              │
└─────────────────────────────────────────┘
```

### 3. Salary & Payroll Tab

**Features**:
- Current month salary breakdown
- Historical payslips (last 12 months)
- Download payslip as PDF
- Share payslip
- Request advance
- View advance repayment status
- Tips tracking (for service staff)

**UI**:
```
┌─────────────────────────────────────────┐
│  ← Salary              [Download PDF]   │
├─────────────────────────────────────────┤
│                                         │
│  Current Month: January 2024            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │   Expected Net Pay              │   │
│  │   ₹ 18,500                     │   │
│  │                                 │   │
│  │   Days: 22/26  Hours: 176/208  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Breakdown ▼                            │
│  ┌─────────────────────────────────┐   │
│  │  Base Salary        ₹ 15,000   │   │
│  │  Overtime (12h)     ₹  2,500   │   │
│  │  Bonuses            ₹  1,000   │   │
│  │  ─────────────────────────────  │   │
│  │  Gross Salary       ₹ 18,500   │   │
│  │                                 │   │
│  │  Advance Deduct     ₹ -2,000   │   │
│  │  Other Deductions   ₹   -500   │   │
│  │  ─────────────────────────────  │   │
│  │  Net Pay            ₹ 16,000   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Request Advance]                      │
│                                         │
│  Past Payslips ▼                        │
│  📄 December 2023 - ₹16,200  [View]    │
│  📄 November 2023 - ₹15,800  [View]    │
│  📄 October 2023  - ₹16,500  [View]    │
│                                         │
└─────────────────────────────────────────┘
```

### 4. Schedule/Roster Tab

**Features**:
- Weekly calendar view
- Monthly calendar view
- Shift details (time, location, role)
- Confirm shifts
- Filter: Upcoming, Past, All
- Export to calendar

**UI**:
```
┌─────────────────────────────────────────┐
│  ← Schedule        [Week] [Month]       │
├─────────────────────────────────────────┤
│                                         │
│  Week of Jan 22 - Jan 28, 2024         │
│  ◀ Previous          Today     Next ▶  │
│                                         │
│  Mon 22                                 │
│  ┌─────────────────────────────────┐   │
│  │ 🕐 10:00 AM - 6:00 PM          │   │
│  │ 📍 Main Floor                  │   │
│  │ 👔 Service Staff               │   │
│  │ Status: Confirmed ✓            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Tue 23                                 │
│  ┌─────────────────────────────────┐   │
│  │ 🕐 10:00 AM - 6:00 PM          │   │
│  │ 📍 Main Floor                  │   │
│  │ 👔 Service Staff               │   │
│  │ [Confirm]                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Wed 24                                 │
│  🏖️ Day Off                            │
│                                         │
│  Thu 25                                 │
│  ┌─────────────────────────────────┐   │
│  │ 🕐 10:00 AM - 6:00 PM          │   │
│  │ 📍 Main Floor                  │   │
│  │ 👔 Service Staff               │   │
│  │ Status: Confirmed ✓            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 5. Attendance Tab

**Features**:
- Clock in/out with location verification
- Current month attendance summary
- Attendance calendar (color-coded)
- Daily details (clock in/out times)
- Overtime hours
- Late arrivals tracking

**UI**:
```
┌─────────────────────────────────────────┐
│  ← Attendance      [Calendar] [List]    │
├─────────────────────────────────────────┤
│                                         │
│  Today: Monday, Jan 22, 2024            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ⏰ Not Clocked In              │   │
│  │                                 │   │
│  │  Scheduled: 10:00 AM - 6:00 PM │   │
│  │                                 │   │
│  │  [Clock In Now]                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  This Month Summary                     │
│  ┌─────────────────────────────────┐   │
│  │  Days Worked      22 / 26       │   │
│  │  Hours Worked     176 / 208     │   │
│  │  Overtime         12 hours      │   │
│  │  Late Arrivals    1             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Calendar View                          │
│  ┌─────────────────────────────────┐   │
│  │  Sun Mon Tue Wed Thu Fri Sat    │   │
│  │   1   2   3   4   5   6   7     │   │
│  │  🟢  🟢  🟢  🟢  🟢  🔵  🔵    │   │
│  │   8   9  10  11  12  13  14     │   │
│  │  🟢  🟢  🟢  🟢  🟢  🔵  🔵    │   │
│  │  15  16  17  18  19  20  21     │   │
│  │  🟢  🟢  🟢  🟢  🟢  🔵  🔵    │   │
│  │  22  23  24  25  26  27  28     │   │
│  │  ⚪  ⚪  ⚪  ⚪  ⚪  ⚪  ⚪    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🟢 Present  🟡 Late  🔴 Absent  🔵 Off│
│                                         │
└─────────────────────────────────────────┘
```

### 6. Leave Management Tab

**Features**:
- Leave balance cards
- Request leave form
- Leave history
- Pending/Approved/Rejected status
- Cancel pending requests

**UI**:
```
┌─────────────────────────────────────────┐
│  ← Leave           [+ Request Leave]    │
├─────────────────────────────────────────┤
│                                         │
│  Leave Balance                          │
│                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────┐│
│  │ Vacation  │ │ Sick Leave│ │Personal││
│  │  5 / 12   │ │  7 / 10   │ │ 2 / 3  ││
│  │   days    │ │   days    │ │  days  ││
│  └───────────┘ └───────────┘ └───────┘│
│                                         │
│  Pending Requests (1)                   │
│  ┌─────────────────────────────────┐   │
│  │  🏖️ Vacation Leave              │   │
│  │  Jan 25 - Jan 27 (3 days)      │   │
│  │  Status: Pending ⏳            │   │
│  │  Reason: Family function        │   │
│  │  [Cancel Request]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Approved Leaves                        │
│  ┌─────────────────────────────────┐   │
│  │  ✅ Sick Leave                  │   │
│  │  Dec 15 - Dec 16 (2 days)      │   │
│  │  Approved by Manager            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  ✅ Personal Leave              │   │
│  │  Nov 10 (1 day)                │   │
│  │  Approved by Manager            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 7. Profile & Settings Tab

**Features**:
- Personal information
- Change PIN
- Biometric settings
- Language selection
- Theme (light/dark)
- Notification preferences
- App version
- Logout

**UI**:
```
┌─────────────────────────────────────────┐
│  ← Profile                              │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         [Profile Photo]         │   │
│  │                                 │   │
│  │    John Doe                     │   │
│  │    Service Staff                │   │
│  │    ID: EMP-2024-001             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Personal Information                   │
│  📧 Email: john@example.com            │
│  📱 Phone: +91 98765 43210             │
│  📅 Joined: Jan 1, 2023                │
│                                         │
│  Settings                               │
│  🔒 Change PIN                    >     │
│  👆 Biometric Login              [✓]   │
│  🌐 Language                     EN >   │
│  🌙 Dark Mode                    [✓]   │
│  🔔 Notifications                [✓]   │
│                                         │
│  About                                  │
│  ℹ️ App Version: 1.0.0                 │
│  📄 Terms & Conditions           >     │
│  🔒 Privacy Policy               >     │
│                                         │
│  [Logout]                               │
│                                         │
└─────────────────────────────────────────┘
```

### 8. Role-Specific Tabs

**Service Staff & Captain**:
```
Additional Tab: Orders/Tables
- Floor plan view
- Table list view
- Quick order entry
- Menu browser
- Order summary
- Customer management
```

**Kitchen Staff**:
```
Additional Tab: Kitchen Orders
- Order queue
- Filter by category (appetizers, mains, etc.)
- Mark as preparing/ready
- Timer for each item
- Priority indicators
```

**Cleaning Staff**:
```
Additional Tab: Tasks
- Table status grid
- Cleaning checklist
- Mark as cleaned
- Assigned areas
- Maintenance reports
```

**Captain**:
```
Additional Tabs: Team + Reports
Team Tab:
- Today's team roster
- Staff availability
- Assign tasks
- Performance overview

Reports Tab:
- Daily sales
- Table turnover
- Tips summary
- Top items
```

---

## Backend API

### API Endpoints

**Base URL**: `https://api.restaurant.com` OR `http://192.168.1.x:8080/api`

**Authentication**:
```
POST /api/auth/staff/login
Body: { pin: "1234", staffId: "staff-001" }
Response: { token: "jwt-token", user: {...}, expiresIn: 3600 }

POST /api/auth/staff/refresh
Header: Authorization: Bearer <token>
Response: { token: "new-jwt-token" }

POST /api/auth/staff/logout
```

**Staff Data**:
```
GET /api/staff/me
Response: { id, name, role, email, phone, joinedAt, ... }

GET /api/staff/salary/current
Response: { month, baseSalary, overtime, bonuses, deductions, netPay, ... }

GET /api/staff/payslips
Response: [ { month, netPay, pdfUrl, ... }, ... ]

GET /api/staff/payslips/:month
Response: { detailed payslip data }

POST /api/staff/advance
Body: { amount, reason, installments }
```

**Schedule**:
```
GET /api/staff/schedule
Query: ?startDate=2024-01-01&endDate=2024-01-31
Response: [ { date, shiftStart, shiftEnd, role, location, ... }, ... ]

POST /api/staff/schedule/:id/confirm
```

**Attendance**:
```
GET /api/staff/attendance
Query: ?month=2024-01
Response: { summary: {...}, records: [...] }

POST /api/staff/attendance/clock-in
Body: { location: { lat, lng } }
Response: { recordId, clockInAt, ... }

POST /api/staff/attendance/clock-out
Body: { recordId, location: { lat, lng } }
Response: { recordId, clockOutAt, totalHours, ... }
```

**Leave**:
```
GET /api/staff/leave/balance
Response: { vacation: {...}, sick: {...}, personal: {...} }

GET /api/staff/leave/requests
Response: [ { id, type, startDate, endDate, status, ... }, ... ]

POST /api/staff/leave/request
Body: { type, startDate, endDate, reason, isHalfDay }
Response: { requestId, status: "pending" }

DELETE /api/staff/leave/request/:id
```

**Role-Specific**:
```
// Service Staff
GET /api/staff/orders/active
GET /api/staff/tables
POST /api/staff/orders/create

// Kitchen Staff
GET /api/staff/kitchen/orders
POST /api/staff/kitchen/orders/:id/update-status

// Cleaning Staff
GET /api/staff/cleaning/tasks
POST /api/staff/cleaning/tasks/:id/complete

// Captain
GET /api/staff/team/roster
POST /api/staff/team/assign-task
GET /api/staff/reports/daily
```

---

## Implementation Plan

### Phase 1: Setup & Core (Week 1-2)

**Tasks**:
- [ ] Initialize React Native project
- [ ] Set up folder structure
- [ ] Configure TypeScript
- [ ] Add React Native Paper (UI framework)
- [ ] Set up React Navigation
- [ ] Create bottom navigation
- [ ] Set up AsyncStorage
- [ ] Configure environment variables
- [ ] Set up API client (Axios)

**Deliverable**: Empty app with navigation structure

### Phase 2: Authentication (Week 3)

**Tasks**:
- [ ] Build onboarding screens
- [ ] Implement restaurant code entry
- [ ] Build staff login screen
- [ ] Implement PIN authentication
- [ ] Add biometric authentication
- [ ] Set up JWT token storage
- [ ] Handle token refresh
- [ ] Add logout functionality

**Deliverable**: Complete authentication flow

### Phase 3: API Integration (Week 4)

**Tasks**:
- [ ] Build API service layer
- [ ] Implement all API endpoints
- [ ] Add request/response interceptors
- [ ] Handle errors gracefully
- [ ] Add retry logic
- [ ] Test with mock data
- [ ] Implement offline detection

**Deliverable**: Working API integration

### Phase 4: Core Features (Week 5-7)

**Tasks**:
- [ ] Build Home Dashboard
- [ ] Build Salary Tab (breakdown, payslips)
- [ ] Build Schedule Tab (calendar views)
- [ ] Build Attendance Tab (clock in/out)
- [ ] Build Leave Tab (balance, requests)
- [ ] Build Profile Tab (settings)
- [ ] Add pull-to-refresh
- [ ] Add loading states
- [ ] Add error states

**Deliverable**: All core features working

### Phase 5: Role-Specific Features (Week 8-10)

**Tasks**:
- [ ] Service Staff: Orders tab
- [ ] Kitchen Staff: Kitchen orders tab
- [ ] Cleaning Staff: Tasks tab
- [ ] Captain: Team tab
- [ ] Captain: Reports tab
- [ ] Test each role separately

**Deliverable**: Role-based features complete

### Phase 6: Polish & Optimize (Week 11)

**Tasks**:
- [ ] Add animations
- [ ] Optimize performance
- [ ] Add offline caching
- [ ] Implement push notifications
- [ ] Add app icon and splash screen
- [ ] Test on multiple devices
- [ ] Fix bugs

**Deliverable**: Polished app ready for testing

### Phase 7: Testing (Week 12)

**Tasks**:
- [ ] Internal testing
- [ ] User acceptance testing (UAT)
- [ ] Fix critical bugs
- [ ] Performance testing
- [ ] Security testing
- [ ] Final polish

**Deliverable**: Production-ready app

### Phase 8: Deployment (Week 13)

**Tasks**:
- [ ] Set up Google Play Console account
- [ ] Create app listing
- [ ] Upload APK/AAB
- [ ] Set up internal testing track
- [ ] Invite beta testers
- [ ] Collect feedback
- [ ] Fix issues
- [ ] Submit for review
- [ ] Publish to Play Store

**Deliverable**: App live on Google Play Store

---

## Project Structure (React Native)

```
staff-mobile/
├── android/                      # Android native code
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/staffapp/
│   │   │   └── res/
│   │   └── build.gradle
│   └── build.gradle
│
├── src/
│   ├── screens/                 # Screen components
│   │   ├── auth/
│   │   │   ├── OnboardingScreen.tsx
│   │   │   ├── RestaurantCodeScreen.tsx
│   │   │   ├── StaffLoginScreen.tsx
│   │   │   └── BiometricSetupScreen.tsx
│   │   ├── home/
│   │   │   └── HomeScreen.tsx
│   │   ├── salary/
│   │   │   ├── SalaryScreen.tsx
│   │   │   └── PayslipDetailScreen.tsx
│   │   ├── schedule/
│   │   │   ├── ScheduleScreen.tsx
│   │   │   └── ShiftDetailScreen.tsx
│   │   ├── attendance/
│   │   │   ├── AttendanceScreen.tsx
│   │   │   └── ClockInScreen.tsx
│   │   ├── leave/
│   │   │   ├── LeaveScreen.tsx
│   │   │   └── LeaveRequestScreen.tsx
│   │   ├── profile/
│   │   │   ├── ProfileScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── role-specific/
│   │       ├── OrdersScreen.tsx         # Service
│   │       ├── KitchenOrdersScreen.tsx  # Kitchen
│   │       ├── TasksScreen.tsx          # Cleaning
│   │       ├── TeamScreen.tsx           # Captain
│   │       └── ReportsScreen.tsx        # Captain
│   │
│   ├── components/              # Reusable components
│   │   ├── SalaryCard.tsx
│   │   ├── ShiftCard.tsx
│   │   ├── AttendanceCalendar.tsx
│   │   ├── LeaveRequestCard.tsx
│   │   └── PINInput.tsx
│   │
│   ├── navigation/              # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── BottomTabNavigator.tsx
│   │
│   ├── services/                # API services
│   │   ├── api.ts
│   │   ├── auth.service.ts
│   │   ├── salary.service.ts
│   │   ├── schedule.service.ts
│   │   ├── attendance.service.ts
│   │   └── leave.service.ts
│   │
│   ├── store/                   # State management
│   │   ├── authStore.ts
│   │   ├── salaryStore.ts
│   │   ├── scheduleStore.ts
│   │   └── attendanceStore.ts
│   │
│   ├── hooks/                   # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useBiometric.ts
│   │   ├── useApi.ts
│   │   └── useNotifications.ts
│   │
│   ├── utils/                   # Utility functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── storage.ts
│   │   └── permissions.ts
│   │
│   ├── constants/               # Constants
│   │   ├── colors.ts
│   │   ├── routes.ts
│   │   └── config.ts
│   │
│   └── types/                   # TypeScript types
│       ├── auth.types.ts
│       ├── staff.types.ts
│       └── api.types.ts
│
├── App.tsx                      # Root component
├── package.json
└── tsconfig.json
```

---

## Security Features

### 1. Authentication Security
- PIN stored as Argon2 hash
- JWT tokens with short expiry (1 hour)
- Refresh token mechanism
- Automatic logout on inactivity (5 min)
- Biometric authentication (fingerprint/face)
- Device binding (one device per staff)

### 2. Data Security
- HTTPS only for all API calls
- Certificate pinning (production)
- Sensitive data encrypted at rest
- No sensitive data in logs
- Clear data on logout
- Secure storage for tokens (Android Keystore)

### 3. App Security
- Code obfuscation (ProGuard)
- Root detection
- SSL pinning
- API key rotation
- Rate limiting
- Input validation

---

## Push Notifications

### Use Cases:
1. **Roster Published**: "Your schedule for next week is ready"
2. **Leave Approved**: "Your leave request has been approved"
3. **Leave Rejected**: "Your leave request was not approved"
4. **Payslip Available**: "Your payslip for December is ready"
5. **Shift Reminder**: "Your shift starts in 30 minutes"
6. **Clock-in Reminder**: "Don't forget to clock in"
7. **New Order** (Service): "New order for Table 5"
8. **Task Assigned** (Cleaning): "New cleaning task assigned"
9. **Team Update** (Captain): "Staff member marked absent"

### Implementation:
```typescript
// Firebase Cloud Messaging (FCM)
import messaging from '@react-native-firebase/messaging';

// Request permission
async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Authorization status:', authStatus);
  }
}

// Get FCM token
async function getFCMToken() {
  const fcmToken = await messaging().getToken();
  console.log('FCM Token:', fcmToken);
  // Send to backend
  await api.post('/api/staff/fcm-token', { token: fcmToken });
}

// Handle foreground notifications
messaging().onMessage(async remoteMessage => {
  Alert.alert('Notification', remoteMessage.notification.body);
});

// Handle background notifications
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});
```

---

## Offline Support

### Strategy:
1. **Cache Critical Data**:
   - Current month salary
   - This week's schedule
   - Last 30 days attendance
   - Leave balance

2. **Sync When Online**:
   - Sync on app open
   - Sync every 15 minutes
   - Sync after user action
   - Background sync (WorkManager)

3. **Queue Offline Actions**:
   - Clock in/out requests
   - Leave requests
   - Shift confirmations
   - Upload when online

### Implementation:
```typescript
// AsyncStorage for offline cache
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save data offline
await AsyncStorage.setItem('salary_current', JSON.stringify(salaryData));

// Load offline data
const cached = await AsyncStorage.getItem('salary_current');
const salaryData = cached ? JSON.parse(cached) : null;

// Queue offline actions
const offlineQueue = await AsyncStorage.getItem('offline_queue') || '[]';
const queue = JSON.parse(offlineQueue);
queue.push({ type: 'CLOCK_IN', timestamp: Date.now(), data: {...} });
await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));

// Process queue when online
const processOfflineQueue = async () => {
  const queue = await getOfflineQueue();
  for (const action of queue) {
    try {
      await processAction(action);
      await removeFromQueue(action.id);
    } catch (err) {
      console.error('Failed to process:', err);
    }
  }
};
```

---

## Testing Strategy

### 1. Unit Tests
- API service functions
- Formatters and validators
- Store actions
- Utility functions

### 2. Integration Tests
- Authentication flow
- API integration
- Navigation flows
- Offline sync

### 3. E2E Tests (Detox)
- Complete user flows
- Login → Dashboard → Salary
- Clock in/out flow
- Leave request flow

### 4. Manual Testing
- Test on multiple devices (low-end, mid-range, flagship)
- Test on different Android versions (7.0+)
- Test offline scenarios
- Test with real staff members

---

## Cost Estimate

### Development (React Native)
- **Setup & Core**: 2 weeks
- **Authentication**: 1 week
- **API Integration**: 1 week
- **Core Features**: 3 weeks
- **Role-Specific**: 3 weeks
- **Polish**: 1 week
- **Testing**: 1 week
- **Deployment**: 1 week
- **Total**: 13 weeks (3 months)

### Infrastructure
- **Google Play Developer Account**: $25 (one-time)
- **Firebase**: Free tier (up to 10K users)
- **Cloudflare Workers**: $5/month (existing)
- **Push Notifications**: Free (FCM)

### Maintenance
- **Bug fixes**: Ongoing
- **Updates**: Quarterly
- **Play Store fees**: None (after initial $25)

---

## Deployment Checklist

### Pre-Launch
- [ ] Complete all features
- [ ] Fix critical bugs
- [ ] Test on 5+ devices
- [ ] User acceptance testing
- [ ] Optimize performance
- [ ] Security audit
- [ ] Prepare app store assets

### App Store Assets
- [ ] App icon (512x512px)
- [ ] Feature graphic (1024x500px)
- [ ] Screenshots (4-8 images)
- [ ] App description
- [ ] Privacy policy URL
- [ ] Terms & conditions URL

### Play Store Listing
- **App Name**: [Restaurant Name] Staff App
- **Short Description**: Access salary, schedule, attendance, and more
- **Full Description**: Detailed description with features
- **Category**: Business
- **Content Rating**: Everyone
- **Target Age**: 18+

### Launch
- [ ] Submit to internal testing
- [ ] Invite 10-20 beta testers
- [ ] Collect feedback (1 week)
- [ ] Fix issues
- [ ] Submit for production review
- [ ] Wait for approval (2-3 days)
- [ ] Publish to Play Store
- [ ] Announce to staff
- [ ] Monitor crash reports
- [ ] Collect feedback
- [ ] Plan updates

---

## Success Metrics

### Adoption
- [ ] 90% of staff install within 2 weeks
- [ ] 70% daily active users
- [ ] 95% weekly active users

### Usage
- [ ] 80% check salary at least weekly
- [ ] 90% check schedule at least weekly
- [ ] 95% clock in/out via app
- [ ] 60% submit leave requests via app

### Performance
- [ ] App load time <3 seconds
- [ ] API response time <500ms
- [ ] Crash-free rate >99%
- [ ] Rating on Play Store >4.0

### Satisfaction
- [ ] User satisfaction >4/5
- [ ] <10 support tickets per month
- [ ] Positive staff feedback

---

## Next Steps

1. **Decision**: React Native or Native Android (Kotlin)
   - Recommend: **React Native** for faster development

2. **Setup Development Environment**:
   - Install Node.js, React Native CLI
   - Install Android Studio
   - Set up emulator or physical device

3. **Initialize Project**:
   ```bash
   npx react-native init StaffMobileApp --template react-native-template-typescript
   cd StaffMobileApp
   npm install @react-navigation/native @react-navigation/bottom-tabs
   npm install react-native-paper react-native-vector-icons
   npm install @react-native-async-storage/async-storage
   npm install axios zustand
   npm install react-native-biometrics
   npm install @react-native-firebase/app @react-native-firebase/messaging
   ```

4. **Start Building**:
   - Phase 1: Setup (Week 1-2)
   - Phase 2: Auth (Week 3)
   - Phase 3: API (Week 4)
   - Continue with plan...

5. **Test & Deploy**:
   - Internal testing
   - Beta release
   - Production release

**Timeline**: 3 months to full production release

**Result**: Native Android app on Google Play Store for all staff to access their salary, schedule, attendance, and role-specific features from their personal devices!

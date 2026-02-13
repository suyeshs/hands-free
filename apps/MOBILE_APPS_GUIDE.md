# HandsFree Mobile Apps

This directory contains the standalone mobile applications for the HandsFree Restaurant POS system.

## Overview

The HandsFree system now consists of three separate applications:

1. **Desktop POS** (main project) - Full-featured point-of-sale system for desktop/tablet
2. **Owner Mobile App** (`apps/owner-mobile/`) - Restaurant analytics and management for owners
3. **Staff Mobile App** (`apps/staff-mobile/`) - Attendance, operations, and KDS for staff

## Architecture

All three apps share the same **Cloudflare infrastructure**:
- **D1 Database** - Centralized SQL database
- **KV Store** - Key-value cache
- **R2 Storage** - Object storage for media
- **Durable Objects** - Real-time state management (OrderCoordinator, KitchenSync, TenantSession)
- **Workers** - Backend API endpoints
- **Cloudflare Tunnel** - Secure local network routing

The mobile apps are **thin clients** that make direct API calls to Cloudflare Workers. They don't store business logic, only UI components and state management for the user interface.

## Owner Mobile App

### Features
- **Real-time Analytics Dashboard**
  - Sales overview with interactive Chart.js graphs
  - Period selection (Day/Week/Month/Year)
  - Overlay comparisons (Yesterday, Last Week, Last Month, Last Year)
  - Key metrics: Total Sales, Orders, Active Staff, Avg Wait Time

- **Multi-location Management**
  - Location switcher with bottom sheet
  - Aggregated view across all locations
  - Individual location statistics
  - Real-time sync across locations

- **Modern UI/UX**
  - Dark theme with glassmorphism effects
  - FAB (Floating Action Button) navigation
  - Smooth animations with Framer Motion
  - Touch-optimized interactions

### Tech Stack
- **Frontend**: React 19 + TypeScript
- **State Management**: Zustand
- **Charts**: Chart.js
- **Icons**: Lucide React
- **Build**: Vite
- **Mobile Framework**: Tauri v2
- **Platform**: Android (iOS support coming soon)

### Development

```bash
# Navigate to owner app
cd apps/owner-mobile

# Install dependencies
bun install

# Run dev server (web)
bun run dev

# Run Tauri dev (desktop)
bun run tauri:dev

# Build for Android
bun run android:build
```

### File Structure
```
owner-mobile/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx        # Main dashboard container
│   │   ├── Header.tsx          # App header with location selector
│   │   ├── MetricsGrid.tsx     # KPI metric cards
│   │   ├── SalesChart.tsx      # Interactive sales chart
│   │   ├── QuickActions.tsx    # Quick action buttons
│   │   ├── ActivityFeed.tsx    # Recent activity list
│   │   ├── FABMenu.tsx         # Floating action menu
│   │   └── LocationSheet.tsx   # Location selection sheet
│   ├── stores/
│   │   ├── locationStore.ts    # Location state management
│   │   └── dashboardStore.ts   # Dashboard state management
│   ├── styles/
│   │   └── index.css          # Global styles and variables
│   ├── App.tsx                # Root component
│   └── main.tsx               # Entry point
├── src-tauri/                 # Tauri configuration and Rust code
├── package.json
└── vite.config.ts
```

## Staff Mobile App

### Features
- **Dual Mode Operation**
  - **Staff Mode**: Personal attendance, stats, payroll
  - **Manager Mode**: Kitchen display, team management, operations

- **Staff Mode**
  - Clock in/out with live timer
  - Today's summary (hours worked, tips, tables served, rating)
  - Weekly summary
  - Quick actions (payroll, advance request, schedule)

- **Manager Mode**
  - Operations overview (active orders, staff online, sales, prep time)
  - Kitchen Display System (KDS) with live orders
  - Order urgency indicators
  - Team status monitoring
  - Real-time updates via WebSocket

### Tech Stack
- Same as Owner app (React 19, TypeScript, Zustand, Tauri v2)
- Green/blue gradient theme (vs purple for Owner app)

### Development

```bash
# Navigate to staff app
cd apps/staff-mobile

# Install dependencies
bun install

# Run dev server (web)
bun run dev

# Run Tauri dev (desktop)
bun run tauri:dev

# Build for Android
bun run android:build
```

### File Structure
```
staff-mobile/
├── src/
│   ├── components/
│   │   ├── ModeSelector.tsx    # Staff/Manager mode toggle
│   │   ├── StaffMode.tsx       # Staff mode UI
│   │   ├── ManagerMode.tsx     # Manager mode UI
│   │   └── FABMenu.tsx         # Floating action menu
│   ├── stores/
│   │   └── staffStore.ts       # Staff state management
│   ├── styles/
│   │   └── index.css          # Global styles and variables
│   ├── App.tsx                # Root component
│   └── main.tsx               # Entry point
├── src-tauri/                 # Tauri configuration and Rust code
├── package.json
└── vite.config.ts
```

## Building for Production

### Owner App
```bash
cd apps/owner-mobile

# Build Android APK
bun run android:build

# APK will be in: src-tauri/gen/android/app/build/outputs/apk/
```

### Staff App
```bash
cd apps/staff-mobile

# Build Android APK
bun run android:build

# APK will be in: src-tauri/gen/android/app/build/outputs/apk/
```

## API Integration

Both apps connect to Cloudflare Workers for all backend operations:

### Environment Variables
```env
VITE_API_URL=https://your-restaurant.workers.dev
VITE_TENANT_ID=your-tenant-id
```

### API Endpoints (to be implemented in Workers)

#### Owner App
- `GET /api/dashboard/stats` - Get dashboard metrics
- `GET /api/dashboard/sales-data` - Get sales chart data
- `GET /api/locations` - Get all locations for tenant
- `GET /api/locations/:id/stats` - Get location-specific stats
- `GET /api/activity` - Get recent activity feed

#### Staff App
- `POST /api/attendance/clock-in` - Clock in staff member
- `POST /api/attendance/clock-out` - Clock out staff member
- `GET /api/attendance/stats` - Get attendance stats
- `GET /api/kds/orders` - Get active kitchen orders
- `POST /api/kds/orders/:id/ready` - Mark order as ready
- `POST /api/kds/orders/:id/delay` - Report order delay
- `GET /api/team/status` - Get team member status

## Deployment

### App Store Distribution

#### Google Play Store (Owner App)
1. Build release APK with signing
2. Upload to Google Play Console
3. Package name: `com.stonepot-tech.handsfree.owner`
4. Version code increments automatically

#### Google Play Store (Staff App)
1. Build release APK with signing
2. Upload to Google Play Console
3. Package name: `com.stonepot-tech.handsfree.staff`
4. Version code increments automatically

### Direct Distribution
Both apps can be distributed directly as APK files for internal testing or enterprise deployment.

## Design System

### Color Palette

**Owner App** (Purple theme):
- Primary: `#6366f1` (Indigo)
- Secondary: `#667eea` (Blue-purple)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Danger: `#ef4444` (Red)

**Staff App** (Green theme):
- Primary: `#10b981` (Green)
- Secondary: `#059669` (Dark green)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Danger: `#ef4444` (Red)

### Common Styles
- Background: `#0a0a0a` (Dark)
- Surface: `rgba(20, 20, 20, 0.8)` (Glass)
- Text: `#ffffff` (White)
- Text Secondary: `#a0a0a0` (Gray)

## Testing

### Web Development
Both apps can be tested in a browser during development:
```bash
# Owner app
cd apps/owner-mobile && bun run dev
# Open http://localhost:1421

# Staff app
cd apps/staff-mobile && bun run dev
# Open http://localhost:1422
```

### Mobile Testing
Use Tauri's Android dev mode to test on a connected device:
```bash
bun run android:dev
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Owner app uses port 1421
   - Staff app uses port 1422
   - Kill existing processes: `lsof -ti:1421 | xargs kill -9`

2. **Dependencies not installed**
   - Run `bun install` in each app directory

3. **Tauri build fails**
   - Ensure Android SDK is installed
   - Check Java version (11 or higher required)
   - Verify NDK installation

4. **Chart not rendering**
   - Check Chart.js import in SalesChart.tsx
   - Verify canvas element is present

## Next Steps

1. **Implement Cloudflare Workers API**
   - Create worker endpoints for both apps
   - Implement authentication and authorization
   - Set up WebSocket connections for real-time updates

2. **Add Authentication**
   - Implement login flow
   - Store auth tokens securely
   - Handle token refresh

3. **Implement Data Sync**
   - Real-time updates via Durable Objects
   - Offline support with local caching
   - Conflict resolution

4. **iOS Support**
   - Configure Tauri for iOS
   - Test on iOS devices
   - Submit to App Store

5. **Push Notifications**
   - Implement push notification service
   - Handle notification permissions
   - Create notification templates

## License

Copyright © 2026 StonePot Tech. All rights reserved.

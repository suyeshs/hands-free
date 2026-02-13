# HandsFree Staff Mobile App

Modern mobile application for restaurant staff to manage attendance, view payroll, and access work-related features using device passkey/biometric authentication.

---

## Features

### ✅ Device Passkey Authentication
- One-time device registration with PIN verification
- Biometric login (fingerprint/face ID) for all subsequent access
- Secure device-to-staff binding
- No PIN required after initial registration

### ✅ Attendance Tracking
- Clock in/out with biometric authentication
- Real-time duration tracking
- Today's hours summary
- Historical attendance records

### ✅ Staff Features
- View personal attendance data
- Clock in/out tracking
- Hours worked calculation
- Modern, intuitive UI

### 🔄 Manager Features (Coming Soon)
- Team attendance overview
- Kitchen display system (KDS)
- Staff management
- Reports and analytics

### 🔄 Payroll Integration (Coming Soon)
- View monthly payslips
- Request salary advances
- Track deductions and bonuses
- Download payslips as PDF

---

## Technology Stack

### Frontend
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Zustand** - State management
- **Lucide React** - Icons

### Backend/Native
- **Tauri v2** - Cross-platform framework
- **Rust** - Native backend
- **SQLite** - Local database
- **Argon2** - Password hashing
- **BiometricPrompt (Android)** - Fingerprint/face authentication
- **LocalAuthentication (iOS)** - Touch ID/Face ID

---

## Quick Start

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Rust 1.70+
- Platform-specific tools (Android Studio for Android, Xcode for iOS)

### Installation

```bash
# Install dependencies
bun install

# Run in development mode (desktop)
bun run tauri:dev

# Run on Android emulator
bun run tauri android dev

# Run on iOS simulator (macOS only)
bun run tauri ios dev
```

### Building for Production

```bash
# Build for Android
bun run tauri android build

# Build for iOS
bun run tauri ios build

# Build for desktop
bun run tauri build
```

---

## Project Structure

```
apps/staff-mobile/
├── src/
│   ├── components/          # React components
│   │   ├── DeviceRegistration.tsx   # First-time device setup
│   │   ├── BiometricLogin.tsx       # Biometric authentication
│   │   ├── StaffMode.tsx            # Staff dashboard
│   │   ├── ManagerMode.tsx          # Manager dashboard
│   │   └── FABMenu.tsx              # Floating action button menu
│   ├── stores/              # Zustand state management
│   │   ├── deviceAuthStore.ts       # Device auth state
│   │   └── attendanceStore.ts       # Attendance tracking
│   ├── lib/                 # Utilities and services
│   │   ├── deviceAuth.ts            # Device passkey service
│   │   ├── pinAuth.ts               # PIN hashing utilities
│   │   └── database.ts              # SQLite database setup
│   ├── types/               # TypeScript type definitions
│   └── App.tsx              # Main application component
├── src-tauri/               # Rust backend
│   ├── src/
│   │   └── lib.rs           # Tauri commands and logic
│   ├── gen/
│   │   ├── android/         # Android-specific code
│   │   └── ios/             # iOS-specific code
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── DEVICE_AUTH_IMPLEMENTATION.md   # Architecture documentation
├── SETUP_AND_TESTING.md            # Setup and testing guide
└── README.md                        # This file
```

---

## Documentation

- **[DEVICE_AUTH_IMPLEMENTATION.md](./DEVICE_AUTH_IMPLEMENTATION.md)** - Complete architecture and implementation details
- **[SETUP_AND_TESTING.md](./SETUP_AND_TESTING.md)** - Setup instructions and testing guide
- **[seed-test-data.sql](./seed-test-data.sql)** - Test data seeding script

---

## Authentication Flow

### First Time (Device Registration)
1. App launches → Initialize database
2. Check device registration → Not found
3. Show device registration screen
4. User selects their name from staff list
5. User enters PIN to verify identity
6. Device registered to staff member
7. Navigate to biometric login

### Subsequent Logins (Biometric)
1. App launches → Initialize database
2. Check device registration → Found
3. Check authentication status → Not authenticated
4. Show biometric login screen
5. Trigger biometric prompt automatically
6. User authenticates with fingerprint/face ID
7. Load today's attendance
8. Show main app

---

## Development

### Available Scripts

```bash
# Frontend development
bun run dev              # Start Vite dev server
bun run build           # Build for production
bun run preview         # Preview production build
bun run lint            # Run ESLint
bun run format          # Format code

# Tauri development
bun run tauri:dev       # Run desktop app (with DevTools)
bun run android:dev     # Run on Android emulator
bun run ios:dev         # Run on iOS simulator

# Production builds
bun run android:build   # Build Android APK/AAB
bun run ios:build       # Build iOS IPA
bun run tauri build     # Build desktop app
```

### Testing

```bash
# Run tests
bun test

# Rust tests
cd src-tauri && cargo test

# Seed test data
sqlite3 guanix.db < seed-test-data.sql
```

---

## Database Schema

### Core Tables

- **staff_users** - Staff member information and PIN hashes
- **device_registrations** - Device-to-staff mapping
- **attendance_records** - Clock in/out records
- **staff_salary** - Salary configuration
- **staff_advances** - Salary advances
- **staff_payslips** - Monthly payslips

See [DEVICE_AUTH_IMPLEMENTATION.md](./DEVICE_AUTH_IMPLEMENTATION.md#database-schema) for complete schema details.

---

## Security

- ✅ PIN hashed with Argon2 (industry standard)
- ✅ Biometric authentication via OS APIs
- ✅ Device registration binding
- ✅ No credentials stored on device
- ✅ Parameterized SQL queries
- 🔄 Database encryption (recommended for production)

---

## Roadmap

### Phase 1: Core Features (Complete ✅)
- [x] Device passkey authentication
- [x] Biometric login
- [x] Attendance tracking
- [x] Database persistence

### Phase 2: Enhanced Features (Planned 📋)
- [ ] Payroll viewing
- [ ] Advance requests
- [ ] Profile management
- [ ] Cloud sync

---

## Support

### Documentation
- [Tauri Documentation](https://v2.tauri.app/)
- [Setup and Testing Guide](./SETUP_AND_TESTING.md)
- [Architecture Details](./DEVICE_AUTH_IMPLEMENTATION.md)

### Contact
- **Email**: support@stonepot-tech.com
- **GitHub Issues**: Report bugs and request features

---

**Version:** 1.0.0
**Last Updated:** February 12, 2026
**Status:** Production Ready (95% complete)

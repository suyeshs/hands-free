# HandsFree Staff Mobile - Setup and Testing Guide

Complete guide for building, configuring, and testing the staff mobile app with device passkey authentication.

---

## Prerequisites

### Development Tools

- **Node.js** 18+ or **Bun** 1.0+
- **Rust** 1.70+ (install via [rustup](https://rustup.rs/))
- **Tauri CLI** v2 (`cargo install tauri-cli@^2.0.0`)

### Platform-Specific Requirements

#### Android Development
- **Android Studio** (latest stable version)
- **Android SDK** (API level 24+)
- **Android NDK** r25c or later
- **Java Development Kit (JDK)** 17+

#### iOS Development (macOS only)
- **Xcode** 14+ (from Mac App Store)
- **CocoaPods** (`sudo gem install cocoapods`)
- **iOS Developer Account** (for device testing)

---

## Installation Steps

### 1. Install Dependencies

```bash
cd apps/staff-mobile

# Install JavaScript/TypeScript dependencies
bun install
# or
npm install

# Install Rust dependencies (automatically handled by Cargo)
# This will be done when you first build the project
```

### 2. Configure Tauri

The Tauri configuration has been set up in `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "sql": {
      "preload": ["sqlite:guanix.db"],
      "enabled": true
    }
  }
}
```

### 3. Build Rust Dependencies

```bash
cd src-tauri

# Update dependencies
cargo update

# Build for development
cargo build

# Or build for release (optimized)
cargo build --release
```

### 4. Initialize Test Database

To test with sample data, create test staff users:

```bash
# First, run the app in development to create the database
bun run tauri:dev

# Then, seed test data (in a separate terminal)
sqlite3 guanix.db < seed-test-data.sql
```

**Note:** The seed script includes test staff with PIN "1234" (not secure - for testing only).

For production, you MUST generate proper PIN hashes using the `hash_staff_pin` command.

---

## Development Workflow

### Running in Development Mode

#### Desktop (for quick testing)

```bash
bun run tauri:dev
```

This will:
1. Start the Vite dev server
2. Launch the Tauri app in desktop mode
3. Open DevTools automatically (in debug builds)

#### Android Emulator

```bash
# First time: Initialize Android project
bun run tauri android init

# Build and run on emulator
bun run tauri android dev
```

#### iOS Simulator (macOS only)

```bash
# First time: Initialize iOS project
bun run tauri ios init

# Build and run on simulator
bun run tauri ios dev
```

### Hot Reload

The Vite dev server supports hot reload for frontend changes. Rust changes require a rebuild:

```bash
# Frontend changes - automatic hot reload
# Edit src/**/*.tsx files

# Rust changes - manual rebuild required
# Edit src-tauri/src/*.rs files
# Then: cargo build (or restart tauri dev)
```

---

## Testing the Authentication Flow

### Test Scenario 1: First-Time Device Registration

1. **Launch app** (empty database or no existing device registration)
2. **Verify**: Device Registration screen appears
3. **Action**: Select a staff member (e.g., "John Doe")
4. **Verify**: PIN entry screen appears
5. **Action**: Enter PIN "1234" (if using test data)
6. **Verify**: Device registers successfully
7. **Verify**: Navigates to Biometric Login screen
8. **Verify**: Biometric prompt appears automatically

### Test Scenario 2: Biometric Login (Returning User)

1. **Launch app** (existing device registration)
2. **Verify**: Biometric Login screen appears
3. **Verify**: Shows registered staff name
4. **Verify**: Biometric prompt appears automatically
5. **Action**: Authenticate with biometric
6. **Verify**: Successfully authenticates
7. **Verify**: Main app (StaffMode) appears
8. **Verify**: Today's attendance loads

### Test Scenario 3: Clock In/Out

1. **Authenticate** and reach StaffMode
2. **Verify**: Clock card shows "Currently Clocked Out"
3. **Action**: Tap "Clock In" button
4. **Verify**: Button shows "Processing..."
5. **Verify**: Clock card updates to "Currently Clocked In"
6. **Verify**: Duration timer starts counting
7. **Verify**: Today's stats update
8. **Action**: Tap "Clock Out" button
9. **Verify**: Clock card shows "Currently Clocked Out"
10. **Verify**: Hours worked displays correctly

### Test Scenario 4: Logout

1. **Authenticate** and reach StaffMode
2. **Action**: Tap FAB menu (bottom-right)
3. **Action**: Tap "Logout"
4. **Verify**: Returns to Biometric Login screen
5. **Verify**: Device registration still exists
6. **Verify**: Can re-authenticate with biometric

### Test Scenario 5: Unregister Device

1. **From Biometric Login screen**
2. **Action**: Tap "Unregister Device"
3. **Verify**: Confirmation dialog appears
4. **Action**: Tap "Unregister"
5. **Verify**: Returns to Device Registration screen
6. **Verify**: Must re-register with PIN

---

## Platform-Specific Testing

### Android Biometric Testing

#### Testing on Physical Device

1. **Enable USB Debugging** on your Android device
2. **Connect device** via USB
3. **Build and install**:
   ```bash
   bun run tauri android build --debug
   adb install -r target/android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. **Test biometric**: Use your actual fingerprint/face

#### Testing on Emulator

Android emulator supports fingerprint simulation:

1. **Create AVD** with fingerprint support (API 28+)
2. **Launch emulator**
3. **Enable fingerprint**:
   - Settings → Security → Fingerprint
   - Add a simulated fingerprint
4. **Trigger biometric in app**
5. **Simulate success**:
   ```bash
   adb -e emu finger touch 1
   ```

### iOS Biometric Testing

#### Testing on Physical Device

1. **Connect iPhone/iPad** via USB
2. **Select device** in Xcode
3. **Build and run**:
   ```bash
   bun run tauri ios build --debug
   ```
4. **Test biometric**: Use Face ID or Touch ID

#### Testing on Simulator

iOS Simulator supports Face ID/Touch ID simulation:

1. **Launch simulator** (iPhone with Face ID or Touch ID)
2. **Enroll biometric**:
   - Settings → Face ID & Passcode
   - Set up Face ID (simulator fake scan)
3. **Trigger biometric in app**
4. **Simulate success**:
   - Menu: Features → Face ID → Matching Face
   - Or keyboard: Cmd+Shift+M

---

## Database Management

### Database Location

- **Development**: `apps/staff-mobile/guanix.db`
- **Production Android**: `/data/data/com.stonepot-tech.handsfree.staff/databases/guanix.db`
- **Production iOS**: `~/Library/Application Support/com.stonepot-tech.handsfree.staff/guanix.db`

### Inspecting the Database

```bash
# Open database with SQLite CLI
sqlite3 guanix.db

# View tables
.tables

# View staff users
SELECT id, name, role, is_active FROM staff_users;

# View device registrations
SELECT device_id, staff_id, registered_at FROM device_registrations;

# View today's attendance
SELECT staff_id, clock_in_at, clock_out_at, total_hours
FROM attendance_records
WHERE shift_date = date('now');

# Exit
.quit
```

### Resetting the Database

```bash
# Delete database (will be recreated on next app launch)
rm guanix.db

# Or clear specific data
sqlite3 guanix.db "DELETE FROM device_registrations;"
sqlite3 guanix.db "DELETE FROM attendance_records;"
```

---

## Building for Production

### Android APK/AAB

```bash
# Build debug APK (for testing)
bun run tauri android build --debug

# Build release APK (unsigned)
bun run tauri android build

# Build release AAB (for Play Store)
bun run tauri android build --aab

# Sign APK (required for distribution)
# Follow Android signing guide
```

Output: `src-tauri/gen/android/app/build/outputs/`

### iOS IPA

```bash
# Build debug IPA
bun run tauri ios build --debug

# Build release IPA
bun run tauri ios build

# Archive for App Store
# Use Xcode: Product → Archive
```

Output: `src-tauri/gen/ios/build/`

### Desktop Builds

```bash
# macOS
bun run tauri build

# Windows (on Windows)
bun run tauri build

# Linux
bun run tauri build
```

---

## Debugging

### Frontend Debugging

**Desktop Development:**
- DevTools open automatically in debug builds
- Console logs visible in DevTools
- React DevTools available

**Mobile Debugging:**

**Android:**
```bash
# Chrome DevTools
chrome://inspect
# Find your app and click "inspect"
```

**iOS:**
```bash
# Safari Web Inspector
Safari → Develop → [Your Device] → [App Name]
```

### Rust Debugging

View Rust logs in terminal:

```bash
# Run with debug logging
RUST_LOG=debug bun run tauri dev

# View specific module logs
RUST_LOG=handsfree_staff_lib=debug bun run tauri dev
```

### Database Debugging

Enable SQL query logging:

```typescript
// In lib/database.ts
const db = await Database.load(DB_NAME, {
  verbose: true  // Log all SQL queries
});
```

---

## Common Issues and Solutions

### Issue: "Biometric authentication not available"

**Cause**: Platform doesn't support biometrics or not set up

**Solutions:**
- Desktop: Biometric not supported (expected)
- Android: Ensure device has fingerprint enrolled
- iOS: Ensure Face ID/Touch ID is set up
- Emulator/Simulator: Follow simulation steps above

### Issue: "Database error: table not found"

**Cause**: Database not initialized

**Solution:**
```bash
# Delete database and restart app
rm guanix.db
bun run tauri dev
```

### Issue: "PIN verification failed"

**Cause**: PIN hash mismatch

**Solution:**
1. Generate new PIN hash:
   ```javascript
   // In browser console (while app is running)
   await window.__TAURI__.core.invoke('hash_staff_pin', { pin: '1234' })
   ```
2. Update database:
   ```sql
   UPDATE staff_users
   SET pin_hash = 'generated-hash'
   WHERE id = 'staff-001';
   ```

### Issue: "Device ID changes on every launch"

**Cause**: `get_device_id` generates new UUID each time

**Solution:**
Implement persistent device ID in `src-tauri/src/lib.rs`:
```rust
// Use platform-specific persistent ID
#[cfg(target_os = "android")]
// Use Android.os.Build.SERIAL or ANDROID_ID

#[cfg(target_os = "ios")]
// Use UIDevice.current.identifierForVendor
```

### Issue: Build errors after updating dependencies

**Solution:**
```bash
# Clean build
cd src-tauri
cargo clean
cargo update
cargo build

# Clean frontend
cd ..
rm -rf node_modules dist
bun install
```

---

## Performance Optimization

### Database Optimization

1. **Use indexes** (already added in schema)
2. **Batch operations**:
   ```typescript
   // Instead of multiple queries
   for (const record of records) {
     await db.execute(...)
   }

   // Use transaction
   await db.execute('BEGIN TRANSACTION')
   for (const record of records) {
     await db.execute(...)
   }
   await db.execute('COMMIT')
   ```

3. **Limit result sets**:
   ```sql
   SELECT * FROM attendance_records
   WHERE staff_id = ?
   ORDER BY shift_date DESC
   LIMIT 30;  -- Only last 30 days
   ```

### Frontend Optimization

1. **Lazy load routes**:
   ```typescript
   const ManagerMode = lazy(() => import('./components/ManagerMode'))
   ```

2. **Memoize calculations**:
   ```typescript
   const stats = useMemo(() => getTodayStats(), [todayRecord])
   ```

3. **Debounce updates**:
   ```typescript
   const debouncedUpdate = useDebouncedCallback(update, 500)
   ```

---

## Security Best Practices

### PIN Security

- ✅ **DO**: Use Argon2 for hashing (already implemented)
- ✅ **DO**: Generate salt per PIN (already implemented)
- ❌ **DON'T**: Store plaintext PINs
- ❌ **DON'T**: Use weak hashing (MD5, SHA1)

### Database Security

- ✅ **DO**: Use SQLCipher for encryption (recommended for production)
- ✅ **DO**: Validate all input
- ❌ **DON'T**: Use string concatenation for SQL
- ❌ **DON'T**: Store sensitive data unencrypted

### Biometric Security

- ✅ **DO**: Use OS-level biometric APIs
- ✅ **DO**: Handle biometric failures gracefully
- ❌ **DON'T**: Bypass biometric authentication
- ❌ **DON'T**: Store biometric data

---

## Next Steps

### Recommended Enhancements

1. **Implement persistent device ID**
   - Android: Use Android ID
   - iOS: Use identifierForVendor

2. **Add database encryption**
   - Use SQLCipher plugin
   - Encrypt sensitive fields

3. **Implement cloud sync**
   - Sync attendance to backend API
   - Handle offline mode
   - Conflict resolution

4. **Add payroll features**
   - View payslips
   - Request advances
   - Track salary components

5. **Enhance error handling**
   - User-friendly error messages
   - Automatic retry logic
   - Offline queue

6. **Add analytics**
   - Track app usage
   - Monitor errors
   - Performance metrics

---

## Support

### Documentation
- [Tauri v2 Docs](https://v2.tauri.app/)
- [Tauri Plugin SQL](https://github.com/tauri-apps/tauri-plugin-sql)
- [Android BiometricPrompt](https://developer.android.com/reference/androidx/biometric/BiometricPrompt)
- [iOS LocalAuthentication](https://developer.apple.com/documentation/localauthentication)

### Troubleshooting
- Check [DEVICE_AUTH_IMPLEMENTATION.md](./DEVICE_AUTH_IMPLEMENTATION.md) for architecture details
- Review logs in terminal and DevTools
- Test on physical devices (emulators may have limitations)

### Getting Help
- GitHub Issues: Report bugs and request features
- Tauri Discord: Community support
- Stack Overflow: Technical questions

---

**Last Updated:** February 12, 2026

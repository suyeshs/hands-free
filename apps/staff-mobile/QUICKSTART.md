# Quick Start Guide - HandsFree Staff Mobile

Get up and running in 5 minutes!

---

## Prerequisites

Before you begin, make sure you have:

- ✅ **Bun** or **Node.js** 18+ installed
- ✅ **Rust** 1.70+ installed ([rustup.rs](https://rustup.rs))
- ✅ **Git** installed

---

## 1️⃣ Setup (First Time Only)

Run the automated setup script:

```bash
cd apps/staff-mobile
./scripts/setup-dev.sh
```

This will:
- Install all dependencies
- Build Rust components
- Create the database
- Optionally seed test data

**When prompted "Seed test data?", type `y` for easy testing.**

---

## 2️⃣ Run the App

### Desktop (Recommended for Development)

```bash
bun run tauri:dev
```

This opens the app in a desktop window with DevTools.

### Android Emulator

```bash
# First time only
bun run tauri android init

# Then run
bun run tauri android dev
```

### iOS Simulator (macOS only)

```bash
# First time only
bun run tauri ios init

# Then run
bun run tauri ios dev
```

---

## 3️⃣ Test the App

If you seeded test data, you can log in with:

**Test Users:**
- John Doe (waiter) - PIN: `1234`
- Jane Smith (cashier) - PIN: `1234`
- Mike Johnson (kitchen) - PIN: `1234`
- Sarah Williams (manager) - PIN: `1234`

**Flow:**
1. Select a staff member
2. Enter PIN: `1234`
3. Device registration completes
4. Biometric prompt appears (auto-simulated on desktop)
5. Main app loads
6. Try clocking in/out

---

## 🧪 Verify Everything Works

Run the test script:

```bash
./scripts/test-app.sh
```

This checks:
- Database schema
- TypeScript compilation
- Rust compilation
- Test data presence

---

## 📱 Build for Production

### Android APK

```bash
# Debug build (for testing)
./scripts/build-android.sh debug

# Release build (for distribution)
./scripts/build-android.sh release
```

Output: `src-tauri/gen/android/app/build/outputs/apk/`

### iOS IPA

```bash
bun run tauri ios build
```

---

## 🔧 Common Commands

| Command | Description |
|---------|-------------|
| `bun run tauri:dev` | Run desktop app with hot reload |
| `bun run build` | Build frontend only |
| `bun run lint` | Check code quality |
| `bun test` | Run tests |
| `./scripts/test-app.sh` | Verify setup |

---

## 🐛 Troubleshooting

### Database not found
```bash
./scripts/setup-dev.sh
# Select 'y' when asked to seed data
```

### Build errors
```bash
# Clean and rebuild
rm -rf node_modules dist
bun install
cd src-tauri && cargo clean && cargo build
```

### PIN verification fails
```bash
# Re-seed test data
sqlite3 guanix.db < seed-test-data.sql
```

### Tauri commands not found
```bash
# Reinstall Rust dependencies
cd src-tauri
cargo update
cargo build
```

---

## 📚 Next Steps

- **[SETUP_AND_TESTING.md](./SETUP_AND_TESTING.md)** - Complete testing guide
- **[DEVICE_AUTH_IMPLEMENTATION.md](./DEVICE_AUTH_IMPLEMENTATION.md)** - Architecture details
- **[README.md](./README.md)** - Full documentation

---

## 🎯 Development Workflow

1. **Make changes** to TypeScript/React code
2. **Hot reload** updates automatically
3. **Test** in the running app
4. **Commit** your changes

For Rust changes:
1. **Edit** `src-tauri/src/*.rs` files
2. **Rebuild** with `cargo build`
3. **Restart** the dev server

---

## 🚀 You're Ready!

The app is now running with:
- ✅ Device passkey authentication
- ✅ Biometric login
- ✅ Attendance tracking
- ✅ Real-time clock in/out
- ✅ Beautiful UI with animations

**Have fun building!** 🎉

---

## Need Help?

- Check [SETUP_AND_TESTING.md](./SETUP_AND_TESTING.md) for detailed instructions
- Review [DEVICE_AUTH_IMPLEMENTATION.md](./DEVICE_AUTH_IMPLEMENTATION.md) for architecture
- Run `./scripts/test-app.sh` to diagnose issues

---

**Last Updated:** February 12, 2026

# Tauri Multi-Platform Build Guide

## Overview

With Tauri, you can build **multiple platform targets from a single codebase**:

- 🖥️ **Desktop**: Windows, macOS, Linux
- 📱 **Mobile**: Android (and iOS in future)
- 🌐 **Web**: Browser-based (optional)

All from the **same React + Rust codebase**!

---

## Build Commands

### Desktop Builds

```bash
# Development
bun tauri dev

# Production builds
bun tauri build                    # Current platform
bun tauri build --target x86_64-pc-windows-msvc    # Windows
bun tauri build --target x86_64-apple-darwin       # macOS Intel
bun tauri build --target aarch64-apple-darwin      # macOS Apple Silicon
bun tauri build --target x86_64-unknown-linux-gnu  # Linux
```

**Output**:
```
src-tauri/target/release/
├── handsfree-pos.exe        (Windows)
├── handsfree-pos.app        (macOS)
├── handsfree-pos            (Linux binary)
└── bundle/
    ├── dmg/                 (macOS installer)
    ├── msi/                 (Windows installer)
    └── deb/                 (Linux package)
```

### Android Builds

```bash
# Development
bun tauri android dev              # Run on emulator
bun tauri android dev --device     # Run on physical device

# Production builds
bun tauri android build            # Debug APK
bun tauri android build --release  # Release APK
bun tauri android build --bundle   # AAB for Play Store
```

**Output**:
```
src-tauri/gen/android/app/build/outputs/
├── apk/
│   └── release/
│       ├── app-arm64-v8a-release.apk      (64-bit ARM)
│       ├── app-armeabi-v7a-release.apk    (32-bit ARM)
│       └── app-x86_64-release.apk         (Intel 64-bit)
└── bundle/
    └── release/
        └── app-release.aab                 (Play Store)
```

---

## How It Works

### Same Codebase, Different Builds

```
Your Codebase:
├── src/                    (React frontend - SHARED)
│   ├── pages/
│   ├── components/
│   └── stores/
│
├── src-tauri/src/          (Rust backend - SHARED)
│   ├── commands/
│   ├── database/
│   └── lib.rs
│
└── Build Outputs:
    ├── Desktop Binary      (from: bun tauri build)
    └── Android APK         (from: bun tauri android build)
```

### Platform-Specific Code

Use Rust conditional compilation:

```rust
// src-tauri/src/commands/platform.rs

#[tauri::command]
pub fn get_platform() -> String {
    #[cfg(target_os = "android")]
    return "android".to_string();

    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "macos")]
    return "macos".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();

    "unknown".to_string()
}

#[tauri::command]
pub async fn open_file_picker() -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        // Android file picker
        use android_activity::AndroidApp;
        // ... Android-specific code
    }

    #[cfg(not(target_os = "android"))]
    {
        // Desktop file picker
        use rfd::FileDialog;
        let file = FileDialog::new().pick_file();
        // ... Desktop-specific code
    }
}
```

### Frontend Platform Detection

```typescript
// src/lib/platform.ts

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

export function isDesktop(): boolean {
  return isTauri() && !isAndroid();
}

export function isMobile(): boolean {
  return isTauri() && isAndroid();
}
```

Use in components:

```tsx
import { isDesktop, isMobile } from '../lib/platform';

export function App() {
  if (isMobile()) {
    return <MobileApp />;
  }

  if (isDesktop()) {
    return <DesktopApp />;
  }

  return <WebApp />; // Fallback for browser
}
```

---

## Configuration

### tauri.conf.json

Configure both platforms:

```json
{
  "productName": "HandsFree POS",
  "version": "1.0.0",
  "identifier": "com.stonepot.handsfree",

  "build": {
    "beforeDevCommand": "bun run dev",
    "beforeBuildCommand": "bun run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },

  "bundle": {
    "active": true,
    "targets": ["msi", "dmg", "deb", "appimage"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],

    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    },

    "android": {
      "minSdkVersion": 24,
      "versionCode": 1
    }
  }
}
```

### Cargo.toml

Add platform-specific dependencies:

```toml
[dependencies]
tauri = { version = "2", features = ["..." ] }
serde = { version = "1", features = ["derive"] }
rusqlite = { version = "0.31", features = ["bundled"] }

# Android-specific
[target.'cfg(target_os = "android")'.dependencies]
android_logger = "0.13"
jni = "0.21"

# Desktop-specific
[target.'cfg(not(target_os = "android"))'.dependencies]
rfd = "0.12"  # File dialogs
```

---

## Development Workflow

### Working on Desktop Features

```bash
# 1. Start dev server
bun run dev

# 2. Run Tauri in dev mode
bun tauri dev

# 3. Make changes, hot reload works
# 4. Test in desktop app
```

### Working on Mobile Features

```bash
# 1. Start Android emulator
emulator -avd Pixel_5_API_33

# 2. Run Tauri Android dev
bun tauri android dev

# 3. Make changes
# 4. Rebuild and test
```

### Testing Both Platforms

```bash
# Terminal 1: Dev server
bun run dev

# Terminal 2: Desktop
bun tauri dev

# Terminal 3: Android
bun tauri android dev
```

---

## Build Process

### CI/CD Pipeline Example

```yaml
# .github/workflows/build.yml

name: Build Multi-Platform

on:
  push:
    branches: [main]

jobs:
  build-desktop:
    strategy:
      matrix:
        platform: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Install dependencies
        run: bun install
      - name: Build Tauri
        run: bun tauri build

  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Set up Android
        uses: android-actions/setup-android@v2
      - name: Install dependencies
        run: bun install
      - name: Build Android
        run: bun tauri android build --release
```

---

## Distribution

### Desktop Distribution

**Windows**:
- `.exe` - Portable executable
- `.msi` - Windows installer
- Microsoft Store (optional)

**macOS**:
- `.app` - Application bundle
- `.dmg` - Disk image installer
- Mac App Store (optional)

**Linux**:
- `.deb` - Debian/Ubuntu package
- `.AppImage` - Universal Linux app
- `.rpm` - Red Hat/Fedora package

### Mobile Distribution

**Android**:
- `.apk` - Direct install (sideload)
- `.aab` - Google Play Store bundle

---

## Separate Builds - Different Users

### Scenario: Desktop for Managers, Mobile for Staff

**Option 1: Same App, Different UI**
- Single codebase
- Detect platform at runtime
- Show desktop UI on desktop
- Show mobile UI on Android
- Both have access to all features

**Option 2: Build Configurations**
- Desktop build: Full features (POS, Kitchen, Settings)
- Mobile build: Staff-only features (Salary, Schedule, Attendance)
- Use build flags to exclude unnecessary features

Example:
```rust
// src-tauri/src/lib.rs

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(not(target_os = "android"))]
    {
        // Desktop-only features
        builder = builder.invoke_handler(tauri::generate_handler![
            commands::pos::create_order,
            commands::admin::manage_menu,
            commands::reports::generate_report,
        ]);
    }

    #[cfg(target_os = "android")]
    {
        // Mobile-only features
        builder = builder.invoke_handler(tauri::generate_handler![
            commands::staff::view_salary,
            commands::staff::clock_in,
            commands::staff::request_leave,
        ]);
    }

    builder.run(tauri::generate_context!()).expect("error running app");
}
```

---

## Binary Size Optimization

### Desktop vs Mobile Size Comparison

**Desktop Build** (Full features):
- Windows: ~15-20 MB
- macOS: ~20-25 MB
- Linux: ~15-20 MB

**Android Build** (Staff features only):
- APK: ~8-12 MB per architecture
- AAB: ~10-15 MB (all architectures)

### Reduce Mobile App Size

1. **Strip Debug Symbols**:
```toml
# Cargo.toml
[profile.release]
strip = true
opt-level = "z"
lto = true
```

2. **Target Specific Architectures**:
```bash
# Only build for 64-bit ARM (most modern phones)
bun tauri android build --target aarch64
```

3. **Exclude Unused Features**:
```toml
# Only include needed Tauri features
tauri = { version = "2", default-features = false, features = [
  "mobile",
  "sqlite",
  "dialog-open",
] }
```

---

## Summary

### What You Get:

✅ **One Codebase**
- Single React frontend
- Single Rust backend
- Shared business logic

✅ **Multiple Builds**
- Desktop: `bun tauri build`
- Android: `bun tauri android build`
- Different binaries, same code

✅ **Platform-Specific Code**
- Use `#[cfg(target_os = "android")]` in Rust
- Use `isAndroid()` in TypeScript
- Optimize for each platform

✅ **Independent Distribution**
- Desktop: Direct download, installers, app stores
- Android: APK, Google Play Store
- Update independently

### Commands Quick Reference:

```bash
# Development
bun tauri dev                      # Desktop dev
bun tauri android dev              # Android dev

# Production Builds
bun tauri build                    # Desktop (current OS)
bun tauri android build            # Android APK
bun tauri android build --bundle   # Android AAB

# Output Locations
# Desktop: src-tauri/target/release/
# Android: src-tauri/gen/android/app/build/outputs/
```

**Yes, you can have separate builds from the same codebase!** 🎉

# Build Guide - Guanix Restaurant

## Build Overview

### Current Version: 3.1.2
**Product Name**: Guanix Restaurant
**Identifier**: com.gaunix.restaurant

---

## Platform Builds

### 🪟 Windows (GitHub Actions)
**Build Time**: ~60 minutes (1 hour)

**Platforms**:
- x64 (64-bit Intel/AMD)
- x86 (32-bit Intel/AMD)

**Outputs**:
- NSIS Installer (.exe)
- MSI Installer (.msi)

**Trigger**:
```bash
# Push tag to trigger build
git tag -a v3.1.2 -m "Release v3.1.2"
git push origin v3.1.2
```

**Monitor**:
```bash
# List recent runs
gh run list --workflow=build-windows.yml --limit 5

# Watch specific run
gh run watch <run-id>

# Download artifacts
gh run download <run-id>
```

---

### 🍎 macOS (Local Build)
**Build Time**: ~15-20 minutes

**Platform**: Universal Binary (Apple Silicon + Intel)
- aarch64-apple-darwin (M1/M2/M3)
- x86_64-apple-darwin (Intel)

**Outputs**:
- DMG (Disk Image)
- .app Bundle

**Build Command**:
```bash
# Ensure targets are installed
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin

# Build universal binary
cargo tauri build --target universal-apple-darwin
```

**Output Location**:
```
src-tauri/target/universal-apple-darwin/release/bundle/
├── dmg/
│   └── Guanix Restaurant_3.1.2_universal.dmg
└── macos/
    └── Guanix Restaurant.app
```

---

### 🤖 Android (Local Build)
**Build Time**: ~10-15 minutes

**Note**: Android builds run locally, not via GitHub Actions.

**Build Command**:
```bash
# Build APK
cargo tauri android build --apk
```

---

## Version Management

### Version Format
```
Major.Minor.Patch
Example: 3.1.2
```

**Semantic Versioning**:
- **Major** (x.0.0): Breaking changes, major rewrites
- **Minor** (3.x.0): New features, enhancements
- **Patch** (3.1.x): Bug fixes, minor improvements

### Incrementing Version

Update version in both files:

1. **package.json**:
```json
{
  "version": "3.1.2"
}
```

2. **src-tauri/tauri.conf.json**:
```json
{
  "version": "3.1.2"
}
```

### Creating a Release

```bash
# 1. Update version numbers (see above)
# 2. Commit changes
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: Bump version to 3.1.2"

# 3. Create and push tag
git tag -a v3.1.2 -m "Release v3.1.2 - Description"
git push origin main
git push origin v3.1.2
```

---

## Build Configuration

### Product Details
- **Name**: Guanix Restaurant
- **Bundle ID**: com.gaunix.restaurant
- **Window Title**: Guanix Restaurant
- **Default Size**: 1024x768 (maximized on launch)

### Build Targets
```json
{
  "bundle": {
    "targets": [
      "nsis",    // Windows NSIS installer
      "msi",     // Windows MSI installer
      "dmg",     // macOS disk image
      "app"      // macOS app bundle
    ]
  }
}
```

---

## Architecture

### Desktop POS (Main App)
- **Platform**: Windows, macOS
- **Purpose**: Foundation app that manages everything locally
- **Build**: `bun run build` (default)

### Owner App
- **Platform**: Web (Cloudflare)
- **Purpose**: Remote access for owners
- **Build**: `bun run build:owner`

### Staff App
- **Platform**: Web (Cloudflare)
- **Purpose**: Remote access for staff
- **Build**: `bun run build:staff`

---

## Build Times Summary

| Platform | Environment | Time |
|----------|-------------|------|
| Windows  | GitHub Actions | ~60 min |
| macOS    | Local | ~15-20 min |
| Android  | Local | ~10-15 min |

**Note**: Windows builds take longer due to:
- Installing Tauri CLI (~10-15 min)
- Rust compilation for 2 architectures (x64 + x86)
- Creating multiple installer formats (NSIS + MSI)

---

## Troubleshooting

### Long Build Times
- **Expected**: Windows builds take ~60 minutes
- **Cause**: Rust compilation + multiple installers
- **Solution**: This is normal, be patient

### TypeScript Errors in CI
- **Cause**: plugin-sdk not built before frontend
- **Solution**: Automatic via postinstall script in plugin-sdk

### Build Artifacts Not Found
- **Check**: Verify correct target architecture in path
- **Windows**: `src-tauri/target/<arch>/release/bundle/`
- **macOS**: `src-tauri/target/universal-apple-darwin/release/bundle/`

---

## CI/CD Workflows

### Enabled
- ✅ Windows (GitHub Actions) - via `.github/workflows/build-windows.yml`

### Disabled (Local Only)
- ❌ macOS - Build locally, do not use GitHub Actions
- ❌ Android - Build locally, do not use GitHub Actions

---

## Quick Reference

```bash
# Check current version
cat package.json | grep version

# Local macOS build
cargo tauri build --target universal-apple-darwin

# Check Windows build status
gh run list --workflow=build-windows.yml --limit 3

# Download latest Windows build
gh run download $(gh run list --workflow=build-windows.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

---

**Last Updated**: 2026-02-04
**Maintained By**: Development Team + Claude Sonnet 4.5

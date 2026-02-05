# CI/CD Build Guide - GitHub Actions

## Overview

The migration tool now has automated builds via GitHub Actions that create platform-specific executables for:
- ✅ **Windows x64** (NSIS + MSI installers)
- ✅ **macOS Universal** (Apple Silicon + Intel)
- ✅ **Linux x64** (AppImage + Deb)

---

## Workflow File

**Location**: [`.github/workflows/build-migration-tool.yml`](/.github/workflows/build-migration-tool.yml)

**Triggers**:
1. Push to `main` branch (when migration tool files change)
2. Pull request to `main` (for testing)
3. Manual dispatch (via GitHub Actions UI)

---

## How to Trigger a Build

### Automatic (Push to Main)

```bash
git add .
git commit -m "Update migration tool"
git push origin main
```

**Result**: Workflow runs automatically if files in `apps/coorg-migration-tool/**` changed.

### Manual (GitHub UI)

1. Go to repository on GitHub
2. Click "Actions" tab
3. Select "Build Migration Tool" workflow
4. Click "Run workflow" button
5. Select branch (usually `main`)
6. Click "Run workflow"

**Result**: Builds for all platforms start immediately.

---

## Build Process

### Windows x64 Build

**Runner**: `windows-latest` (Windows Server 2022)

**Steps**:
1. Checkout code
2. Setup Node.js 20
3. Setup Rust toolchain (x86_64-pc-windows-msvc)
4. Cache Rust dependencies (faster subsequent builds)
5. Install npm dependencies
6. Build Tauri app
7. Upload artifacts

**Output Files**:
- `Coorg Migration Tool_1.0.0_x64-setup.exe` (NSIS installer, ~18MB)
- `Coorg Migration Tool_1.0.0_x64_en-US.msi` (MSI installer, ~15MB)

**Build Time**: ~8-12 minutes (first build), ~4-6 minutes (cached)

### macOS Universal Build

**Runner**: `macos-latest` (macOS 14)

**Targets**:
- `aarch64-apple-darwin` (Apple Silicon)
- `x86_64-apple-darwin` (Intel)
- Combined into universal binary

**Output Files**:
- `Coorg Migration Tool_1.0.0_universal.dmg` (~25MB)

**Build Time**: ~10-15 minutes

### Linux x64 Build

**Runner**: `ubuntu-latest` (Ubuntu 22.04)

**System Dependencies**:
- libgtk-3-dev
- libwebkit2gtk-4.1-dev
- libayatana-appindicator3-dev
- librsvg2-dev
- patchelf

**Output Files**:
- `coorg-migration-tool_1.0.0_amd64.AppImage` (~20MB)
- `coorg-migration-tool_1.0.0_amd64.deb` (~18MB)

**Build Time**: ~8-10 minutes

---

## Downloading Build Artifacts

### Via GitHub UI

1. Go to repository → Actions
2. Click on the workflow run (green checkmark)
3. Scroll to "Artifacts" section at bottom
4. Download desired platform:
   - `coorg-migration-tool-windows-x64-nsis`
   - `coorg-migration-tool-windows-x64-msi`
   - `coorg-migration-tool-macos-universal`
   - `coorg-migration-tool-linux-x64`
   - `coorg-migration-tool-linux-x64-deb`

### Via GitHub CLI

```bash
# List artifacts for latest run
gh run list --workflow="Build Migration Tool"

# Download specific artifact
gh run download <run-id> -n coorg-migration-tool-windows-x64-nsis
```

---

## Secrets Configuration (Optional)

For code signing (optional but recommended for production):

### Tauri Updater Signing

Add these secrets to your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add `TAURI_PRIVATE_KEY`:
   - Generate with: `tauri signer generate`
   - Copy private key

3. Add `TAURI_KEY_PASSWORD`:
   - Password used during key generation

**Without these secrets**: Builds succeed but artifacts are unsigned.

### Windows Code Signing (Advanced)

For production, sign Windows executables:

```yaml
- name: Sign Windows exe
  uses: dlemstra/code-sign-action@v1
  with:
    certificate: ${{ secrets.WINDOWS_CERTIFICATE }}
    password: ${{ secrets.CERTIFICATE_PASSWORD }}
    folder: apps/coorg-migration-tool/src-tauri/target/release/bundle/nsis
```

**Requires**: Valid Windows code signing certificate (~$100-500/year)

### macOS Code Signing (Advanced)

For Mac App Store distribution:

```yaml
- name: Import certificate
  run: |
    echo $MACOS_CERTIFICATE | base64 --decode > certificate.p12
    security import certificate.p12 -P $MACOS_CERTIFICATE_PASSWORD
```

**Requires**: Apple Developer account ($99/year)

---

## Workflow Optimization

### Caching Strategy

The workflow caches:
1. **npm packages** - via `actions/setup-node@v4` with `cache: 'npm'`
2. **Rust dependencies** - via `Swatinem/rust-cache@v2`

**Result**:
- First build: 10-15 minutes
- Cached build: 4-6 minutes (60% faster)

### Parallel Execution

All three platforms build simultaneously:
```
Windows ─────────────────► 8 min
macOS  ─────────────────► 12 min  } Run in parallel
Linux  ─────────────────► 10 min
```

**Total time**: 12 minutes (not 30 minutes sequential)

---

## Troubleshooting

### Build Fails on Windows

**Error**: `cargo build failed`

**Solutions**:
1. Check Rust syntax errors locally first
2. Verify `Cargo.toml` dependencies are correct
3. Ensure no platform-specific code without `#[cfg]` guards

### Build Fails on macOS

**Error**: `failed to bundle project`

**Solutions**:
1. Verify icons exist in `src-tauri/icons/`
2. Check `tauri.conf.json` bundle settings
3. Ensure `Info.plist` is valid (if customized)

### Build Fails on Linux

**Error**: `Package libwebkit2gtk-4.1-dev is not available`

**Solution**: Update system dependencies in workflow:
```yaml
sudo apt-get install -y libwebkit2gtk-4.0-dev
```

### Artifacts Not Uploaded

**Error**: `No files were found with the provided path`

**Solutions**:
1. Check build actually completed (scroll up in logs)
2. Verify output path matches expected location
3. Check `if-no-files-found: warn` changed to `error` for debugging

---

## Local Testing Before Push

### Test on Windows

```bash
# PowerShell
cd apps/coorg-migration-tool
npm install
npm run tauri build
```

**Output**: `src-tauri/target/release/bundle/nsis/*.exe`

### Test on macOS

```bash
cd apps/coorg-migration-tool
npm install
npm run tauri build -- --target universal-apple-darwin
```

**Output**: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`

### Test on Linux

```bash
cd apps/coorg-migration-tool
npm install
npm run tauri build
```

**Output**: `src-tauri/target/release/bundle/appimage/*.AppImage`

---

## Customizing the Workflow

### Build Only on Release Tags

Change trigger to:

```yaml
on:
  push:
    tags:
      - 'v*'
```

**Usage**: `git tag v1.0.1 && git push --tags`

### Add Windows x86 (32-bit) Build

Add job:

```yaml
build-windows-x86:
  runs-on: windows-latest
  steps:
    # ... same as x64 but:
    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: i686-pc-windows-msvc

    - name: Build
      run: npm run tauri build -- --target i686-pc-windows-msvc
```

### Create GitHub Release with Assets

Add after build jobs:

```yaml
release:
  needs: [build-windows, build-macos, build-linux]
  runs-on: ubuntu-latest
  steps:
    - name: Download all artifacts
      uses: actions/download-artifact@v4

    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        files: |
          coorg-migration-tool-windows-x64-nsis/*.exe
          coorg-migration-tool-macos-universal/*.dmg
          coorg-migration-tool-linux-x64/*.AppImage
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] All builds succeed (Windows, macOS, Linux)
- [ ] Test artifacts on target platforms
- [ ] Verify database migration works end-to-end
- [ ] Code signing configured (optional but recommended)
- [ ] Version number updated in `tauri.conf.json`
- [ ] Release notes prepared
- [ ] Backup strategy tested
- [ ] Rollback procedure documented

---

## Monitoring Builds

### Email Notifications

GitHub automatically emails:
- ✅ When build succeeds (optional, can disable)
- ❌ When build fails (always sent)

### Slack Integration

Add to workflow:

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Migration tool build completed! ✅"
      }
```

### Discord Integration

```yaml
- name: Notify Discord
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
```

---

## Cost & Usage

### GitHub Actions Free Tier

**Public repositories**: Unlimited minutes
**Private repositories**: 2,000 minutes/month

### Current Workflow Cost

Per build (all platforms):
- Windows: ~10 minutes (x1 multiplier)
- macOS: ~12 minutes (x10 multiplier = 120 minute-equivalents)
- Linux: ~8 minutes (x1 multiplier)

**Total**: ~138 minute-equivalents per build

**Free tier**: ~14 builds/month before charges

---

## Summary

✅ **GitHub Actions workflow created**
✅ **Builds Windows x64 automatically**
✅ **Includes macOS and Linux builds**
✅ **Caching optimized for fast builds**
✅ **Artifacts uploaded for easy download**
✅ **Ready to use immediately**

**To trigger**: Push changes to `main` or use "Run workflow" button in GitHub Actions UI.

**Output**: Platform-specific installers uploaded as artifacts, ready to distribute.

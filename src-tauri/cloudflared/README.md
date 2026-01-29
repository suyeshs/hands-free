# Cloudflared Binaries

This directory contains cloudflared binaries for all supported platforms.

## Download Instructions

Run these commands to download the latest cloudflared binaries:

### macOS ARM64 (M1/M2/M3)
```bash
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz" -o cloudflared-darwin-arm64.tgz
tar -xzf cloudflared-darwin-arm64.tgz
mv cloudflared cloudflared-darwin-arm64
chmod +x cloudflared-darwin-arm64
rm cloudflared-darwin-arm64.tgz
```

### macOS Intel (x86_64)
```bash
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz" -o cloudflared-darwin-amd64.tgz
tar -xzf cloudflared-darwin-amd64.tgz
mv cloudflared cloudflared-darwin-amd64
chmod +x cloudflared-darwin-amd64
rm cloudflared-darwin-amd64.tgz
```

### Windows 64-bit
```bash
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o cloudflared-windows-amd64.exe
```

### Linux 64-bit
```bash
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
```

## Quick Download All (Run from this directory)

```bash
# Run this script to download all binaries at once
cd src-tauri/cloudflared

# macOS ARM64
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz" -o cloudflared-darwin-arm64.tgz
tar -xzf cloudflared-darwin-arm64.tgz && mv cloudflared cloudflared-darwin-arm64 && chmod +x cloudflared-darwin-arm64 && rm cloudflared-darwin-arm64.tgz

# macOS Intel
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz" -o cloudflared-darwin-amd64.tgz
tar -xzf cloudflared-darwin-amd64.tgz && mv cloudflared cloudflared-darwin-amd64 && chmod +x cloudflared-darwin-amd64 && rm cloudflared-darwin-amd64.tgz

# Windows
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o cloudflared-windows-amd64.exe

# Linux
curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64

echo "✅ All cloudflared binaries downloaded!"
```

## Verify Downloads

```bash
ls -lh
# Should show:
# cloudflared-darwin-arm64     (~50 MB)
# cloudflared-darwin-amd64     (~50 MB)
# cloudflared-windows-amd64.exe (~50 MB)
# cloudflared-linux-amd64      (~50 MB)
```

## Bundle Size Impact

Total: ~60 MB for all platforms (only the relevant platform binary is included in each installer)
- macOS DMG: +15 MB
- Windows MSI: +15 MB
- Linux: +15 MB

## Notes

- Binaries are automatically selected at build time based on target platform
- Files are marked executable during app startup
- No Cloudflare account needed for Quick Tunnels
- Named tunnels require one-time authentication

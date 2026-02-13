# WiFi Detection Cross-Platform Testing Guide

This document provides instructions for testing WiFi detection functionality across different operating systems.

## Overview

The WiFi detection feature identifies the current WiFi network SSID and connection status. This is used for:
- **WiFi Access Control**: Restrict sensitive features to restaurant WiFi (Staff builds only)
- **Auto-Attendance**: Automatically clock in staff when connected to restaurant WiFi
- **Network Status Display**: Show current WiFi network in settings

## Testing Instructions

### macOS

**Prerequisites:**
- Connected to WiFi network
- No special permissions required

**Manual Command Test:**
```bash
# Find WiFi interface (usually en0 or en1)
networksetup -listallhardwareports

# Get current WiFi network (replace en1 with your WiFi interface)
networksetup -getairportnetwork en1
```

**Expected Output:**
```
Current Wi-Fi Network: YourNetworkName
```

**In-App Test:**
1. Run: `npm run tauri dev`
2. Navigate to Settings → WiFi & Auto-Attendance
3. **Expected:** "Current Network: YourNetworkName" should display
4. Check browser console for logs: `[WiFi] Found WiFi interface: en1`

---

### Linux

**Prerequisites:**
- Connected to WiFi network
- NetworkManager installed (Ubuntu, Fedora, Debian) OR wireless-tools package

**Manual Command Test:**

**Option 1: nmcli (modern distributions)**
```bash
# Check if nmcli is available
which nmcli

# Get active WiFi connections
nmcli -t -f active,ssid dev wifi
```

**Expected Output:**
```
yes:YourNetworkName
no:OtherNetwork
```

**Option 2: iwgetid (fallback for minimal systems)**
```bash
# Check if iwgetid is available
which iwgetid

# Get current SSID
iwgetid -r
```

**Expected Output:**
```
YourNetworkName
```

**In-App Test:**
1. Run: `npm run tauri dev`
2. Navigate to Settings → WiFi & Auto-Attendance
3. **Expected:** "Current Network: YourNetworkName" should display
4. Check terminal output for logs:
   - `[WiFi] Linux: Attempting WiFi detection...`
   - `[WiFi] Found active WiFi via nmcli: YourNetworkName`

**Installation (if commands not found):**
```bash
# Ubuntu/Debian
sudo apt-get install network-manager wireless-tools

# Fedora/RHEL
sudo dnf install NetworkManager wireless-tools

# Arch
sudo pacman -S networkmanager wireless_tools
```

---

### Windows

**Prerequisites:**
- Connected to WiFi network
- No special permissions required (built-in netsh command)

**Manual Command Test:**
```cmd
REM Command Prompt or PowerShell
netsh wlan show interfaces
```

**Expected Output:**
```
    Name                   : Wi-Fi
    Description            : Intel(R) Wi-Fi 6 AX201 160MHz
    GUID                   : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    Physical address       : xx:xx:xx:xx:xx:xx
    State                  : connected
    SSID                   : YourNetworkName
    BSSID                  : xx:xx:xx:xx:xx:xx
    Network type           : Infrastructure
    Radio type             : 802.11ax
    Authentication         : WPA2-Personal
    Cipher                 : CCMP
    Connection mode        : Auto Connect
    ...
```

**In-App Test:**
1. Run: `npm run tauri dev`
2. Navigate to Settings → WiFi & Auto-Attendance
3. **Expected:** "Current Network: YourNetworkName" should display
4. Check terminal output for logs:
   - `[WiFi] Windows: Attempting WiFi detection...`
   - `[WiFi] Found SSID: YourNetworkName`

---

## Troubleshooting

### Issue: "Not connected" shown but WiFi is connected

**Diagnostic Steps:**

1. **Check Tauri Logs (All Platforms)**
   - Open DevTools console (Ctrl+Shift+I / Cmd+Option+I)
   - Look for `[NetworkContext]` logs
   - Check for `[WiFi]` logs in terminal/console

2. **Run Manual Commands** (see platform-specific sections above)
   - If manual commands work but app doesn't, it's a Tauri permissions issue
   - If manual commands fail, it's a system configuration issue

3. **Common Issues:**

   **macOS:**
   - WiFi interface not found: Check `networksetup -listallhardwareports`
   - Permission denied: No permissions needed, check system preferences

   **Linux:**
   - `nmcli` not found: Install NetworkManager
   - `iwgetid` not found: Install wireless-tools
   - Command works but app doesn't: Check Tauri sandbox permissions

   **Windows:**
   - WiFi adapter disabled: Enable in Network Settings
   - No output from netsh: WLAN service not running
   - Run as administrator if needed

4. **Enable Debug Logging**
   - Backend logs: Check terminal/console for `[WiFi]` prefix
   - Frontend logs: Check browser DevTools for `[NetworkContext]` prefix

### Issue: Wrong network name shown

- Wait 30 seconds for auto-refresh
- Click refresh/reconnect to force update
- Check manual commands for correct SSID

### Issue: WiFi check not working in Staff build

- Verify `VITE_STAFF_BUILD=true` in environment
- Check build configuration in browser console: `[BuildConfig]`
- Owner builds always show "Allowed" regardless of WiFi

## Feature Behavior

### Owner Build
- ✅ Detects and displays WiFi SSID
- ✅ Always allows access (no restrictions)
- ✅ Can configure WiFi access control (for Staff builds)

### Staff Build
- ✅ Detects and displays WiFi SSID
- ✅ Enforces WiFi access control (if enabled)
- ❌ Restricted features blocked when not on restaurant WiFi

### Web Mode
- ❌ WiFi detection not available (browser security)
- ✅ Always allows access

## Testing Checklist

- [ ] macOS: WiFi SSID displays correctly
- [ ] Linux: WiFi SSID displays correctly (nmcli)
- [ ] Linux: WiFi SSID displays correctly (iwgetid fallback)
- [ ] Windows: WiFi SSID displays correctly
- [ ] Owner build: Access always allowed
- [ ] Staff build: Access controlled by WiFi
- [ ] Add current WiFi button works
- [ ] Manual SSID entry works
- [ ] Remove SSID works
- [ ] Auto-refresh every 30 seconds
- [ ] WiFi connection event triggers auto-attendance
- [ ] Console logs show detailed debug info

## Platform Support Status

| Platform | Status | Primary Method | Fallback | Notes |
|----------|--------|----------------|----------|-------|
| macOS    | ✅ Tested | `networksetup` | None | Works on all macOS versions |
| Linux    | ⚠️ Needs testing | `nmcli` | `iwgetid` | Requires NetworkManager or wireless-tools |
| Windows  | ⚠️ Needs testing | `netsh` | None | Works on Windows 7+ |
| Android  | ❌ Not implemented | JNI WiFiManager | None | Requires location permission |

## Contributing

If you test WiFi detection on your platform, please update this document with:
1. Your OS version
2. Test results (✅ or ❌)
3. Any issues encountered
4. Logs from `[WiFi]` and `[NetworkContext]`

Example:
```
✅ Windows 11 Pro (Build 22631) - Working
- netsh command output correct
- SSID displayed in UI
- Auto-attendance triggered on WiFi connect
```

# Windows Installer Customization Guide

## Current Setup

Your HandsFree Restaurant POS app uses **NSIS** (Nullsoft Scriptable Install System) for Windows installations, which provides extensive UI customization capabilities.

## What's Configurable

### 1. Basic NSIS Configuration (Built-in)

**Current configuration in `tauri.conf.json`:**
```json
"nsis": {
  "installerIcon": "icons/icon.ico",
  "installMode": "currentUser",
  "languages": ["English"],
  "displayLanguageSelector": false
}
```

**Supported fields in Tauri:**
- `installerIcon` - Icon for the installer executable (ICO format)
- `installMode` - "currentUser" (default) or "perMachine"
- `languages` - Array of language codes
- `displayLanguageSelector` - Show language selection dialog

**Note:** Advanced features like custom images, license files, and shortcuts require a **custom NSIS template** (see below).

### 2. Installer Pages & Flow

The standard NSIS installer includes these pages:
1. **Welcome Page** - Introduction
2. **License Agreement** - Shows your LICENSE file
3. **Installation Directory** - Let user choose install location
4. **Installation Progress** - Shows files being installed
5. **Finish Page** - Completion with "Launch App" option

### 2. Advanced Customization with NSIS Template

For features beyond the basic configuration (custom images, license, shortcuts, custom pages), you must create a **custom NSIS template**.

**To enable custom template:**

Add `template` field to tauri.conf.json:
```json
"nsis": {
  "template": "installer.nsi",
  "installerIcon": "icons/icon.ico",
  "installMode": "currentUser"
}
```

Then create the custom NSIS script:

#### **File: `/src-tauri/installer.nsi`**

```nsis
!include "MUI2.nsh"
!include "FileFunc.nsh"

; Branding
Name "HandsFree Restaurant POS"
OutFile "HandsFree-Setup.exe"
InstallDir "$LOCALAPPDATA\HandsFree"

; Modern UI Settings
!define MUI_ICON "icons\icon.ico"
!define MUI_UNICON "icons\icon.ico"

; Custom images
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "icons\installer-header.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "icons\installer-sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "icons\installer-sidebar.bmp"

; Welcome page customization
!define MUI_WELCOMEPAGE_TITLE "Welcome to HandsFree Restaurant OS"
!define MUI_WELCOMEPAGE_TEXT "This wizard will install HandsFree Restaurant POS on your computer.$\r$\n$\r$\nHandsFree is an AI-powered restaurant management system with:$\r$\n  • Point of Sale$\r$\n  • Kitchen Display System$\r$\n  • Staff Management$\r$\n  • Inventory Tracking$\r$\n$\r$\nClick Next to continue."

; Finish page customization
!define MUI_FINISHPAGE_TITLE "Installation Complete!"
!define MUI_FINISHPAGE_TEXT "HandsFree Restaurant POS has been successfully installed.$\r$\n$\r$\nClick Finish to launch the setup wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\HandsFree.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch HandsFree Restaurant POS"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Create desktop shortcut"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateDesktopShortcut

; Language
!insertmacro MUI_LANGUAGE "English"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"

; Custom options page
Page custom InstallTypePage InstallTypePageLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Custom Installation Type Page
Var Dialog
Var StandardRadio
Var CustomRadio
Var SinglePOSRadio
Var MultiDeviceRadio
Var InstallType

Function InstallTypePage
  !insertmacro MUI_HEADER_TEXT "Choose Installation Type" "Select how you want to set up HandsFree"

  nsDialogs::Create 1018
  Pop $Dialog

  ${If} $Dialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "HandsFree can be installed in different configurations depending on your restaurant setup:"
  Pop $0

  ${NSD_CreateRadioButton} 10u 30u 100% 12u "Single POS Device (Recommended for small restaurants)"
  Pop $SinglePOSRadio
  ${NSD_Check} $SinglePOSRadio

  ${NSD_CreateRadioButton} 10u 50u 100% 12u "Multi-Device Setup (Kitchen + Server tablets)"
  Pop $MultiDeviceRadio

  ${NSD_CreateLabel} 20u 70u 95% 36u "Single POS: All-in-one system for taking orders, kitchen display, and management.$\r$\nMulti-Device: Networked setup with separate devices for different roles (requires server device)."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function InstallTypePageLeave
  ${NSD_GetState} $SinglePOSRadio $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallType "single"
  ${Else}
    StrCpy $InstallType "multi"
  ${EndIf}
FunctionEnd

; Installation section
Section "HandsFree Restaurant POS" SecMain
  SetOutPath "$INSTDIR"

  ; Write installation type to registry for first-run detection
  WriteRegStr HKCU "Software\StonePotTech\HandsFree" "InstallType" $InstallType
  WriteRegStr HKCU "Software\StonePotTech\HandsFree" "" "$INSTDIR"

  ; Copy application files (Tauri will inject these)
  File /r "${TAURI_DIST_DIR}\*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Start menu shortcuts
  CreateDirectory "$SMPROGRAMS\HandsFree Restaurant"
  CreateShortcut "$SMPROGRAMS\HandsFree Restaurant\HandsFree POS.lnk" "$INSTDIR\HandsFree.exe"
  CreateShortcut "$SMPROGRAMS\HandsFree Restaurant\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; Registry entries for Add/Remove Programs
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HandsFree" "DisplayName" "HandsFree Restaurant POS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HandsFree" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HandsFree" "DisplayIcon" "$INSTDIR\HandsFree.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HandsFree" "Publisher" "StonePot Tech"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HandsFree" "DisplayVersion" "${VERSION}"
SectionEnd

Function CreateDesktopShortcut
  CreateShortcut "$DESKTOP\HandsFree POS.lnk" "$INSTDIR\HandsFree.exe"
FunctionEnd

; Uninstaller section
Section "Uninstall"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\*.*"
  RMDir /r "$INSTDIR"

  Delete "$SMPROGRAMS\HandsFree Restaurant\*.lnk"
  RMDir "$SMPROGRAMS\HandsFree Restaurant"

  Delete "$DESKTOP\HandsFree POS.lnk"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\HandsFree"
  DeleteRegKey HKCU "Software\StonePotTech\HandsFree"
SectionEnd
```

**Required image specifications for custom template:**
- **Header Image**: 150x57 pixels, BMP format (top banner)
- **Sidebar Image**: 164x314 pixels, BMP format (left panel with branding)
- **Installer Icon**: 256x256 pixels, ICO format (already configured)

## Creating Custom Installer Graphics

**Note:** Custom images only work with a custom NSIS template (see above).

### Design Guidelines

**Brand consistency:**
- Use your HandsFree color palette (saffron, paprika, warm gradients)
- Include your restaurant OS branding
- Match the style of your in-app setup wizard

**Header Image (150x57px):**
- Top banner visible on all installer pages
- Typically: Logo on left, tagline on right
- Light background with subtle gradient
- Example content: "HandsFree Restaurant OS" with small logo

**Sidebar Image (164x314px):**
- Vertical panel on welcome/finish pages
- Showcase your app with:
  - Product logo/icon at top
  - Restaurant scene or UI screenshot
  - Warm gradient background matching your app theme
  - Tagline at bottom: "AI-Powered Restaurant Management"

### Tools for Creating Images

1. **Figma/Adobe Illustrator** - Design at exact dimensions
2. **Export as PNG**, then convert to BMP:
   ```bash
   # Using ImageMagick
   convert installer-header.png BMP3:installer-header.bmp
   convert installer-sidebar.png BMP3:installer-sidebar.bmp
   ```

3. **Place in** `/src-tauri/icons/`

## Testing Your Installer

```bash
# Build Windows installer with custom UI
npm run tauri build

# Installer will be in:
# src-tauri/target/release/bundle/nsis/HandsFree-Restaurant_3.1.0_x64-setup.exe
```

## Advanced: Detecting Installation Type in App

The custom installer writes installation type to registry. Your app can read it on first launch:

```typescript
// In App.tsx or setup wizard
import { invoke } from '@tauri-apps/api/core';

async function getInstallationType(): Promise<'single' | 'multi' | null> {
  try {
    // Read from Windows registry via Rust command
    const installType = await invoke<string>('get_install_type');
    return installType === 'multi' ? 'multi' : 'single';
  } catch {
    return null; // Not installed via installer or registry not available
  }
}

// Use in setup wizard to pre-select device role
const installType = await getInstallationType();
if (installType === 'single') {
  // Pre-configure for all-in-one mode
} else if (installType === 'multi') {
  // Show device role selection (Server/Client)
}
```

## Summary

### What's Available Out-of-the-Box

**Current configuration (no custom template needed):**
- ✅ Custom installer icon
- ✅ Installation mode (current user vs all users)
- ✅ Language selection
- ✅ Standard NSIS wizard UI
- ✅ Installation directory selection
- ✅ Progress indicators

### What Requires Custom NSIS Template

**Advanced features (need to create `installer.nsi`):**
- ⚠️ Custom branding images (header, sidebar)
- ⚠️ Custom welcome/finish text
- ⚠️ License agreement display
- ⚠️ Desktop/Start Menu shortcuts
- ⚠️ Custom installation pages
- ⚠️ Pre-configure app based on install choices

**Limitations (even with custom template):**
- Windows visual style is controlled by OS (can't change button styles)
- Must follow Windows Installer standards for uninstall/registry

### Next Steps

**Option 1: Use default installer (no changes needed)**
- Current setup works out-of-the-box
- Basic branding with your app icon
- Standard Windows installer experience

**Option 2: Create custom installer template**
1. Create custom NSIS script at `/src-tauri/installer.nsi`
2. Add `"template": "installer.nsi"` to tauri.conf.json
3. Create custom images (150x57 header, 164x314 sidebar BMP)
4. Place images in `/src-tauri/icons/`
5. Test build with `npm run tauri build`

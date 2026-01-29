# Device Mode Configuration using SQLite

## Overview

Store device mode and configuration in SQLite instead of localStorage for:
- ✅ Better persistence
- ✅ Rust backend access
- ✅ Type safety
- ✅ Atomic updates
- ✅ No browser dependency

---

## Database Schema

### Migration: Add Device Settings Table

```sql
-- src-tauri/migrations/036_device_settings.sql

CREATE TABLE IF NOT EXISTS device_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Only one row allowed
    tenant_id TEXT NOT NULL,

    -- Device Configuration
    device_mode TEXT NOT NULL DEFAULT 'pos' CHECK(device_mode IN ('pos', 'kds', 'bds', 'server', 'mobile')),
    device_name TEXT NOT NULL DEFAULT 'Device 1',
    device_id TEXT NOT NULL UNIQUE,

    -- Feature Flags
    features_json TEXT NOT NULL DEFAULT '{}',  -- JSON object of enabled features

    -- Mode Lock Settings
    locked_mode INTEGER NOT NULL DEFAULT 0,   -- Boolean: Can't change mode
    kiosk_mode INTEGER NOT NULL DEFAULT 0,    -- Boolean: Full screen, no exit

    -- Auto-Login Settings
    auto_login_enabled INTEGER NOT NULL DEFAULT 0,
    auto_login_role TEXT,
    auto_login_staff_id TEXT,

    -- Network Settings
    lan_server_enabled INTEGER NOT NULL DEFAULT 0,
    lan_server_port INTEGER DEFAULT 8080,

    -- Metadata
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_device_settings_tenant ON device_settings(tenant_id);

-- Default row
INSERT OR IGNORE INTO device_settings (
    id, tenant_id, device_mode, device_name, device_id,
    features_json, created_at, updated_at
) VALUES (
    1,
    (SELECT id FROM tenants LIMIT 1),
    'pos',
    'POS Terminal 1',
    lower(hex(randomblob(16))),
    '{"pos": true, "kitchen": true, "bar": true, "reports": true, "settings": true}',
    unixepoch(),
    unixepoch()
);
```

---

## Rust Backend Implementation

### Commands for Device Settings

```rust
// src-tauri/src/commands/device_settings.rs

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceSettings {
    pub device_mode: String,
    pub device_name: String,
    pub device_id: String,
    pub features: HashMap<String, bool>,
    pub locked_mode: bool,
    pub kiosk_mode: bool,
    pub auto_login_enabled: bool,
    pub auto_login_role: Option<String>,
    pub auto_login_staff_id: Option<String>,
    pub lan_server_enabled: bool,
    pub lan_server_port: u16,
}

#[tauri::command]
pub async fn get_device_settings() -> Result<DeviceSettings, String> {
    let db = get_database().map_err(|e| e.to_string())?;

    let settings = db
        .query_row(
            "SELECT device_mode, device_name, device_id, features_json,
                    locked_mode, kiosk_mode, auto_login_enabled,
                    auto_login_role, auto_login_staff_id,
                    lan_server_enabled, lan_server_port
             FROM device_settings WHERE id = 1",
            [],
            |row| {
                let features_json: String = row.get(3)?;
                let features: HashMap<String, bool> =
                    serde_json::from_str(&features_json).unwrap_or_default();

                Ok(DeviceSettings {
                    device_mode: row.get(0)?,
                    device_name: row.get(1)?,
                    device_id: row.get(2)?,
                    features,
                    locked_mode: row.get::<_, i64>(4)? == 1,
                    kiosk_mode: row.get::<_, i64>(5)? == 1,
                    auto_login_enabled: row.get::<_, i64>(6)? == 1,
                    auto_login_role: row.get(7)?,
                    auto_login_staff_id: row.get(8)?,
                    lan_server_enabled: row.get::<_, i64>(9)? == 1,
                    lan_server_port: row.get::<_, u16>(10)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(settings)
}

#[tauri::command]
pub async fn set_device_mode(mode: String) -> Result<(), String> {
    // Validate mode
    if !matches!(mode.as_str(), "pos" | "kds" | "bds" | "server" | "mobile") {
        return Err("Invalid device mode".to_string());
    }

    let db = get_database().map_err(|e| e.to_string())?;

    // Check if locked
    let is_locked: bool = db
        .query_row(
            "SELECT locked_mode FROM device_settings WHERE id = 1",
            [],
            |row| Ok(row.get::<_, i64>(0)? == 1),
        )
        .map_err(|e| e.to_string())?;

    if is_locked {
        return Err("Device mode is locked. Unlock first or contact administrator.".to_string());
    }

    // Update mode
    db.execute(
        "UPDATE device_settings SET device_mode = ?, updated_at = unixepoch() WHERE id = 1",
        params![mode],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_device_settings(
    device_name: Option<String>,
    features: Option<HashMap<String, bool>>,
    locked_mode: Option<bool>,
    kiosk_mode: Option<bool>,
) -> Result<(), String> {
    let db = get_database().map_err(|e| e.to_string())?;

    // Build dynamic update query
    let mut updates = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(name) = device_name {
        updates.push("device_name = ?");
        params.push(Box::new(name));
    }

    if let Some(feat) = features {
        updates.push("features_json = ?");
        let json = serde_json::to_string(&feat).unwrap();
        params.push(Box::new(json));
    }

    if let Some(locked) = locked_mode {
        updates.push("locked_mode = ?");
        params.push(Box::new(if locked { 1 } else { 0 }));
    }

    if let Some(kiosk) = kiosk_mode {
        updates.push("kiosk_mode = ?");
        params.push(Box::new(if kiosk { 1 } else { 0 }));
    }

    if updates.is_empty() {
        return Ok(());
    }

    updates.push("updated_at = unixepoch()");

    let query = format!(
        "UPDATE device_settings SET {} WHERE id = 1",
        updates.join(", ")
    );

    db.execute(
        &query,
        params_from_iter(params.iter().map(|p| p.as_ref())),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_auto_login(
    enabled: bool,
    role: Option<String>,
    staff_id: Option<String>,
) -> Result<(), String> {
    let db = get_database().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE device_settings
         SET auto_login_enabled = ?,
             auto_login_role = ?,
             auto_login_staff_id = ?,
             updated_at = unixepoch()
         WHERE id = 1",
        params![
            if enabled { 1 } else { 0 },
            role,
            staff_id
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_mode_lock(locked: bool, admin_password: String) -> Result<(), String> {
    // Verify admin password
    if !verify_admin_password(&admin_password).await? {
        return Err("Invalid admin password".to_string());
    }

    let db = get_database().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE device_settings SET locked_mode = ?, updated_at = unixepoch() WHERE id = 1",
        params![if locked { 1 } else { 0 }],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_device_mode() -> Result<String, String> {
    let db = get_database().map_err(|e| e.to_string())?;

    let mode = db
        .query_row(
            "SELECT device_mode FROM device_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(mode)
}

// Helper to get database connection
fn get_database() -> Result<Connection> {
    Connection::open("pos.db")
}

// Helper to verify admin password
async fn verify_admin_password(password: &str) -> Result<bool, String> {
    // Implement your password verification logic
    // For now, simple check (replace with actual auth)
    Ok(password == "admin123") // CHANGE THIS!
}
```

### Register Commands

```rust
// src-tauri/src/lib.rs

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Device settings commands
            commands::device_settings::get_device_settings,
            commands::device_settings::get_device_mode,
            commands::device_settings::set_device_mode,
            commands::device_settings::update_device_settings,
            commands::device_settings::set_auto_login,
            commands::device_settings::toggle_mode_lock,

            // ... other commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Frontend Implementation

### Feature Service (Updated for SQLite)

```typescript
// src/services/featureFlags.ts

import { invoke } from '@tauri-apps/api/core';

export enum DeviceMode {
  POS = 'pos',
  KDS = 'kds',
  BDS = 'bds',
  SERVER = 'server',
  MOBILE = 'mobile',
}

export interface DeviceSettings {
  deviceMode: DeviceMode;
  deviceName: string;
  deviceId: string;
  features: Record<string, boolean>;
  lockedMode: boolean;
  kioskMode: boolean;
  autoLoginEnabled: boolean;
  autoLoginRole?: string;
  autoLoginStaffId?: string;
  lanServerEnabled: boolean;
  lanServerPort: number;
}

class FeatureService {
  private settings: DeviceSettings | null = null;
  private loaded = false;

  async initialize(): Promise<void> {
    if (this.loaded) return;

    try {
      // Load from SQLite via Rust
      this.settings = await invoke<DeviceSettings>('get_device_settings');
      this.loaded = true;
      console.log('[FeatureService] Loaded device settings from SQLite:', this.settings);
    } catch (err) {
      console.error('[FeatureService] Failed to load device settings:', err);

      // Fallback to defaults
      this.settings = {
        deviceMode: DeviceMode.POS,
        deviceName: 'Device 1',
        deviceId: crypto.randomUUID(),
        features: {
          pos: true,
          kitchen: true,
          bar: true,
          reports: true,
          settings: true,
        },
        lockedMode: false,
        kioskMode: false,
        autoLoginEnabled: false,
        lanServerEnabled: false,
        lanServerPort: 8080,
      };
      this.loaded = true;
    }
  }

  async getSettings(): Promise<DeviceSettings> {
    if (!this.loaded) {
      await this.initialize();
    }
    return this.settings!;
  }

  async getDeviceMode(): Promise<DeviceMode> {
    if (!this.loaded) {
      await this.initialize();
    }
    return this.settings!.deviceMode as DeviceMode;
  }

  async setDeviceMode(mode: DeviceMode): Promise<void> {
    try {
      await invoke('set_device_mode', { mode });

      // Update local cache
      if (this.settings) {
        this.settings.deviceMode = mode;
      }

      console.log('[FeatureService] Device mode updated to:', mode);
    } catch (err) {
      console.error('[FeatureService] Failed to set device mode:', err);
      throw err;
    }
  }

  async updateSettings(updates: Partial<DeviceSettings>): Promise<void> {
    try {
      await invoke('update_device_settings', {
        deviceName: updates.deviceName,
        features: updates.features,
        lockedMode: updates.lockedMode,
        kioskMode: updates.kioskMode,
      });

      // Update local cache
      if (this.settings) {
        Object.assign(this.settings, updates);
      }

      console.log('[FeatureService] Settings updated');
    } catch (err) {
      console.error('[FeatureService] Failed to update settings:', err);
      throw err;
    }
  }

  async isFeatureEnabled(feature: string): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.features[feature] === true;
  }

  async isModeLocked(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.lockedMode;
  }

  async setAutoLogin(
    enabled: boolean,
    role?: string,
    staffId?: string
  ): Promise<void> {
    try {
      await invoke('set_auto_login', { enabled, role, staffId });

      if (this.settings) {
        this.settings.autoLoginEnabled = enabled;
        this.settings.autoLoginRole = role;
        this.settings.autoLoginStaffId = staffId;
      }
    } catch (err) {
      console.error('[FeatureService] Failed to set auto-login:', err);
      throw err;
    }
  }

  async lockMode(locked: boolean, adminPassword: string): Promise<void> {
    try {
      await invoke('toggle_mode_lock', { locked, adminPassword });

      if (this.settings) {
        this.settings.lockedMode = locked;
      }

      console.log('[FeatureService] Mode lock:', locked ? 'enabled' : 'disabled');
    } catch (err) {
      console.error('[FeatureService] Failed to toggle mode lock:', err);
      throw err;
    }
  }
}

// Singleton instance
export const featureService = new FeatureService();
```

### React Hooks

```typescript
// src/hooks/useDeviceSettings.ts

import { useEffect, useState } from 'react';
import { featureService, DeviceSettings, DeviceMode } from '../services/featureFlags';

export function useDeviceSettings() {
  const [settings, setSettings] = useState<DeviceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const deviceSettings = await featureService.getSettings();
        setSettings(deviceSettings);
      } catch (err) {
        console.error('Failed to load device settings:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const updateMode = async (mode: DeviceMode) => {
    try {
      await featureService.setDeviceMode(mode);
      setSettings(await featureService.getSettings());
    } catch (err) {
      throw err;
    }
  };

  const updateSettings = async (updates: Partial<DeviceSettings>) => {
    try {
      await featureService.updateSettings(updates);
      setSettings(await featureService.getSettings());
    } catch (err) {
      throw err;
    }
  };

  const lockMode = async (locked: boolean, password: string) => {
    try {
      await featureService.lockMode(locked, password);
      setSettings(await featureService.getSettings());
    } catch (err) {
      throw err;
    }
  };

  return {
    settings,
    loading,
    updateMode,
    updateSettings,
    lockMode,
  };
}

export function useDeviceMode() {
  const [mode, setMode] = useState<DeviceMode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const deviceMode = await featureService.getDeviceMode();
        setMode(deviceMode);
      } catch (err) {
        console.error('Failed to load device mode:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { mode, loading };
}
```

### App.tsx (Using SQLite Device Mode)

```tsx
// src/App.tsx

import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { featureService, DeviceMode } from './services/featureFlags';

function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize feature service (loads from SQLite)
        await featureService.initialize();

        // Get device mode
        const mode = await featureService.getDeviceMode();
        setDeviceMode(mode);

        console.log('[App] Device mode loaded:', mode);
      } catch (err) {
        console.error('[App] Failed to initialize:', err);
        // Default to POS mode
        setDeviceMode(DeviceMode.POS);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  // KDS-only mode: Show only kitchen
  if (deviceMode === DeviceMode.KDS) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<KitchenDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  // BDS-only mode: Show only bar
  if (deviceMode === DeviceMode.BDS) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<BarDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  // Mobile mode: Show only mobile routes
  if (deviceMode === DeviceMode.MOBILE) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/" element={<MobileLayout />}>
            <Route index element={<Navigate to="/home" />} />
            <Route path="home" element={<StaffMobileHome />} />
            <Route path="salary" element={<StaffMobileSalary />} />
            <Route path="schedule" element={<StaffMobileSchedule />} />
          </Route>
        </Routes>
      </HashRouter>
    );
  }

  // Full POS mode: Show all routes
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/hub" element={<HubPage />} />
        <Route path="/pos" element={<POSDashboard />} />
        <Route path="/kitchen" element={<KitchenDashboard />} />
        <Route path="/bar" element={<BarDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/hub" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
```

---

## Settings UI Component

```tsx
// src/components/admin/DeviceModeSettings.tsx

import { useState } from 'react';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { DeviceMode } from '../../services/featureFlags';
import { Monitor, ChefHat, Wine, Smartphone, Server } from 'lucide-react';

export function DeviceModeSettings() {
  const { settings, loading, updateMode, lockMode } = useDeviceSettings();
  const [adminPassword, setAdminPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingMode, setPendingMode] = useState<DeviceMode | null>(null);

  if (loading || !settings) {
    return <div>Loading...</div>;
  }

  const handleModeChange = async (newMode: DeviceMode) => {
    if (settings.lockedMode) {
      alert('Device mode is locked. Unlock first to change mode.');
      return;
    }

    if (!confirm(`Switch to ${newMode} mode? App will restart.`)) {
      return;
    }

    try {
      await updateMode(newMode);

      // Reload app to apply new mode
      window.location.reload();
    } catch (err: any) {
      alert(`Failed to change mode: ${err.message || err}`);
    }
  };

  const handleToggleLock = async () => {
    if (settings.lockedMode) {
      // Unlocking - need password
      setPendingMode(null);
      setShowPasswordDialog(true);
    } else {
      // Locking - need password
      setPendingMode(null);
      setShowPasswordDialog(true);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!adminPassword) {
      alert('Please enter admin password');
      return;
    }

    try {
      await lockMode(!settings.lockedMode, adminPassword);
      setShowPasswordDialog(false);
      setAdminPassword('');
      alert(`Mode ${settings.lockedMode ? 'unlocked' : 'locked'} successfully`);
    } catch (err: any) {
      alert(`Failed: ${err.message || err}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Device Mode Settings</h2>
        <p className="text-gray-600 mt-1">
          Configure this device's operational mode
        </p>
      </div>

      {/* Current Mode */}
      <div className="bg-white rounded-lg p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Current Mode</p>
            <p className="text-2xl font-bold capitalize">{settings.deviceMode}</p>
          </div>
          <div className="flex items-center gap-2">
            {settings.lockedMode && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                🔒 Locked
              </span>
            )}
            <button
              onClick={handleToggleLock}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {settings.lockedMode ? 'Unlock Mode' : 'Lock Mode'}
            </button>
          </div>
        </div>
      </div>

      {/* Mode Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModeCard
          mode={DeviceMode.POS}
          title="Full POS Terminal"
          description="Complete restaurant management system"
          icon={Monitor}
          active={settings.deviceMode === DeviceMode.POS}
          locked={settings.lockedMode}
          onClick={() => handleModeChange(DeviceMode.POS)}
        />

        <ModeCard
          mode={DeviceMode.KDS}
          title="Kitchen Display"
          description="Kitchen orders only (full screen)"
          icon={ChefHat}
          active={settings.deviceMode === DeviceMode.KDS}
          locked={settings.lockedMode}
          onClick={() => handleModeChange(DeviceMode.KDS)}
        />

        <ModeCard
          mode={DeviceMode.BDS}
          title="Bar Display"
          description="Bar orders only (full screen)"
          icon={Wine}
          active={settings.deviceMode === DeviceMode.BDS}
          locked={settings.lockedMode}
          onClick={() => handleModeChange(DeviceMode.BDS)}
        />

        <ModeCard
          mode={DeviceMode.MOBILE}
          title="Staff Mobile"
          description="Personal staff features"
          icon={Smartphone}
          active={settings.deviceMode === DeviceMode.MOBILE}
          locked={settings.lockedMode}
          onClick={() => handleModeChange(DeviceMode.MOBILE)}
        />
      </div>

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              Enter Admin Password
            </h3>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              placeholder="Admin password"
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setAdminPassword('');
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeCard({
  mode,
  title,
  description,
  icon: Icon,
  active,
  locked,
  onClick,
}: {
  mode: DeviceMode;
  title: string;
  description: string;
  icon: any;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`p-6 rounded-lg border-2 text-left transition-all ${
        active
          ? 'border-teal-600 bg-teal-50'
          : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
      } ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Icon
        className={active ? 'text-teal-600' : 'text-gray-400'}
        size={32}
      />
      <h3 className="text-lg font-bold mt-3">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
      {active && (
        <span className="inline-block mt-3 px-3 py-1 bg-teal-600 text-white text-xs rounded-full">
          Active
        </span>
      )}
    </button>
  );
}
```

---

## Migration from localStorage to SQLite

If you already have devices using localStorage, migrate the data:

```typescript
// src/services/migrateDeviceSettings.ts

import { invoke } from '@tauri-apps/api/core';

export async function migrateFromLocalStorage(): Promise<void> {
  try {
    // Check if already migrated
    const migrated = localStorage.getItem('device-settings-migrated');
    if (migrated === 'true') {
      console.log('[Migration] Already migrated');
      return;
    }

    // Get old settings from localStorage
    const oldMode = localStorage.getItem('deviceMode');
    const oldName = localStorage.getItem('deviceName');
    const oldLocked = localStorage.getItem('lockedMode') === 'true';

    if (!oldMode) {
      // No old settings to migrate
      localStorage.setItem('device-settings-migrated', 'true');
      return;
    }

    console.log('[Migration] Migrating device settings to SQLite...');

    // Migrate to SQLite
    await invoke('set_device_mode', { mode: oldMode });

    if (oldName) {
      await invoke('update_device_settings', {
        deviceName: oldName,
        lockedMode: oldLocked,
      });
    }

    // Mark as migrated
    localStorage.setItem('device-settings-migrated', 'true');

    // Clean up old localStorage keys
    localStorage.removeItem('deviceMode');
    localStorage.removeItem('deviceName');
    localStorage.removeItem('lockedMode');

    console.log('[Migration] Migration complete');
  } catch (err) {
    console.error('[Migration] Failed to migrate:', err);
  }
}
```

Call migration on app startup:

```tsx
// In App.tsx
useEffect(() => {
  const init = async () => {
    // Run migration first
    await migrateFromLocalStorage();

    // Then load settings
    await featureService.initialize();
    const mode = await featureService.getDeviceMode();
    setDeviceMode(mode);
  };

  init();
}, []);
```

---

## Summary

**SQLite-Based Device Configuration**:

✅ **Persistent** - Survives app restarts
✅ **Secure** - Backend validation, admin password
✅ **Type-safe** - Rust structs, TypeScript interfaces
✅ **Atomic** - SQLite transactions
✅ **Cross-platform** - Works on desktop and Android
✅ **No browser dependency** - Pure Tauri/Rust

**Key Files**:
- Migration: `src-tauri/migrations/036_device_settings.sql`
- Rust: `src-tauri/src/commands/device_settings.rs`
- Service: `src/services/featureFlags.ts`
- UI: `src/components/admin/DeviceModeSettings.tsx`

**Commands**:
```bash
# Get device mode
featureService.getDeviceMode()

# Set device mode
featureService.setDeviceMode('kds')

# Lock/unlock mode
featureService.lockMode(true, 'admin-password')
```

All device configuration now stored in **SQLite** instead of localStorage! 🎉

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../../stores/authStore';
import { useUserDevicePreference } from '../../hooks/useUserDevicePreference';

interface DeviceSettings {
  deviceMode: string;
  deviceName: string;
  deviceId: string;
  autoAdaptMode: boolean;
  lockedMode: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}

export function AutoAdaptSettings() {
  const user = useAuthStore((state) => state.user);
  const { preference, setPreferredMode, reload } = useUserDevicePreference(user?.id || null);

  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeviceSettings();
  }, []);

  const loadDeviceSettings = async () => {
    try {
      setLoading(true);
      const settings = await invoke<any>('get_device_settings');
      setDeviceSettings({
        deviceMode: settings.deviceMode,
        deviceName: settings.deviceName,
        deviceId: settings.deviceId,
        autoAdaptMode: settings.autoAdaptMode || false,
        lockedMode: settings.lockedMode || false,
        currentUserId: settings.currentUserId,
        currentUserRole: settings.currentUserRole,
      });
    } catch (error) {
      console.error('Failed to load device settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoAdapt = async (enabled: boolean) => {
    try {
      await invoke('set_auto_adapt_mode', { enabled });
      await loadDeviceSettings();
    } catch (error) {
      console.error('Failed to toggle auto-adapt:', error);
    }
  };

  const handleSetPreference = async (mode: string) => {
    try {
      await setPreferredMode(mode);
      await reload();
    } catch (error) {
      console.error('Failed to set preference:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-gray-600">Loading device settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Auto-Adapt Device Mode
        </h3>

        <div className="flex items-center justify-between p-4 bg-gray-50 mb-4">
          <div>
            <p className="font-medium">Automatically adapt to user</p>
            <p className="text-sm text-gray-600">
              Device mode changes based on who logs in
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={deviceSettings?.autoAdaptMode || false}
              onChange={(e) => handleToggleAutoAdapt(e.target.checked)}
              disabled={deviceSettings?.lockedMode}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {deviceSettings?.lockedMode && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Device mode is locked by administrator. Auto-adapt is disabled.
            </p>
          </div>
        )}
      </div>

      {user && preference && (
        <div>
          <h3 className="text-lg font-semibold mb-4">
            Your Preferred Device Mode
          </h3>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              When you log in, the device will switch to this mode:
            </p>

            <select
              value={preference.preferredDeviceMode}
              onChange={(e) => handleSetPreference(e.target.value)}
              disabled={deviceSettings?.lockedMode}
              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pos">Point of Sale (POS)</option>
              <option value="kds">Kitchen Display System (KDS)</option>
              <option value="bds">Bar Display System (BDS)</option>
              <option value="mobile">Mobile (Staff Features)</option>
              <option value="server">Server Mode</option>
            </select>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
              <span>Logged in {preference.loginCount} times</span>
              {preference.lastLoginAt && (
                <span>
                  Last login: {new Date(preference.lastLoginAt * 1000).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {deviceSettings && (
        <div className="pt-4 border-t">
          <h3 className="text-lg font-semibold mb-3">Current Device Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Device Name:</span>
              <span className="font-medium">{deviceSettings.deviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Mode:</span>
              <span className="font-medium uppercase">{deviceSettings.deviceMode}</span>
            </div>
            {deviceSettings.currentUserId && (
              <div className="flex justify-between">
                <span className="text-gray-600">Current User:</span>
                <span className="font-medium">{deviceSettings.currentUserRole}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

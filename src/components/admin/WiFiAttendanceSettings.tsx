/**
 * WiFi & Auto-Attendance Settings
 * Configure WiFi access control and automatic attendance marking
 */

import { useState, useEffect } from 'react';
import { Wifi, Clock, CheckCircle, XCircle, AlertCircle, Plus, X } from 'lucide-react';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useStaffStore } from '../../stores/staffStore';
import { useNetwork } from '../../contexts/NetworkContext';
import { cn } from '../../lib/utils';

export function WiFiAttendanceSettings() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { assignedStaffId, setAssignedStaff } = useDeviceStore();
  const { staff } = useStaffStore();
  const { currentSSID, isOnRestaurantWiFi, refreshNetworkStatus } = useNetwork();

  // Local state for form
  const [wifiSSIDs, setWifiSSIDs] = useState(settings?.restaurant_wifi_ssid || '');
  const [wifiCheckOn, setWifiCheckOn] = useState(settings?.wifi_check_enabled === 1);
  const [autoAttendanceOn, setAutoAttendanceOn] = useState(settings?.auto_attendance_enabled === 1);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(assignedStaffId || '');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualSSID, setManualSSID] = useState(''); // For manual entry

  // Update local state when settings change
  useEffect(() => {
    if (settings) {
      setWifiSSIDs(settings.restaurant_wifi_ssid || '');
      setWifiCheckOn(settings.wifi_check_enabled === 1);
      setAutoAttendanceOn(settings.auto_attendance_enabled === 1);
    }
  }, [settings]);

  useEffect(() => {
    setSelectedStaffId(assignedStaffId || '');
  }, [assignedStaffId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      // Update restaurant settings (WiFi and auto-attendance)
      await updateSettings({
        restaurant_wifi_ssid: wifiSSIDs.trim(),
        wifi_check_enabled: wifiCheckOn ? 1 : 0,
        auto_attendance_enabled: autoAttendanceOn ? 1 : 0,
      });

      // Update device staff assignment
      await setAssignedStaff(selectedStaffId || null);

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);

      // Refresh network status to apply new settings
      await refreshNetworkStatus();
    } catch (error: any) {
      console.error('[WiFiAttendanceSettings] Save failed:', error);
      setSaveStatus('error');
      setErrorMessage(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setWifiSSIDs(settings?.restaurant_wifi_ssid || '');
    setWifiCheckOn(settings?.wifi_check_enabled === 1);
    setAutoAttendanceOn(settings?.auto_attendance_enabled === 1);
    setSelectedStaffId(assignedStaffId || '');
    setSaveStatus('idle');
    setErrorMessage('');
    setManualSSID('');
  };

  // Get list of SSIDs as array
  const getSSIDList = (): string[] => {
    return wifiSSIDs
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  // Add current WiFi to allowed list
  const handleAddCurrentWiFi = () => {
    if (!currentSSID) return;

    const ssidList = getSSIDList();
    if (!ssidList.includes(currentSSID)) {
      const newList = [...ssidList, currentSSID];
      setWifiSSIDs(newList.join(', '));
    }
  };

  // Add manually entered SSID
  const handleAddManualSSID = () => {
    const trimmed = manualSSID.trim();
    if (!trimmed) return;

    const ssidList = getSSIDList();
    if (!ssidList.includes(trimmed)) {
      const newList = [...ssidList, trimmed];
      setWifiSSIDs(newList.join(', '));
    }
    setManualSSID('');
  };

  // Remove SSID from list
  const handleRemoveSSID = (ssidToRemove: string) => {
    const ssidList = getSSIDList().filter(s => s !== ssidToRemove);
    setWifiSSIDs(ssidList.join(', '));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">WiFi & Auto-Attendance</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure WiFi access control and automatic attendance marking for staff
        </p>
      </div>

      {/* Current WiFi Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Wifi className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Current WiFi Status</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Current Network:</span>
            <p className="font-medium text-gray-900 dark:text-white mt-1">
              {currentSSID || 'Not connected'}
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Access Status:</span>
            <div className="flex items-center gap-2 mt-1">
              {isOnRestaurantWiFi ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-600">Allowed</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-600">Restricted</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WiFi Access Control Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">WiFi Access Control (Staff Build Only)</h3>

        {/* Enable WiFi Check */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={wifiCheckOn}
              onChange={(e) => setWifiCheckOn(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Enable WiFi Access Control</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Restrict sensitive features (attendance, payroll) to restaurant WiFi only
              </p>
            </div>
          </label>
        </div>

        {/* WiFi SSIDs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Allowed WiFi Networks (SSIDs)
          </label>

          {/* Current WiFi Quick Add */}
          {currentSSID && !getSSIDList().includes(currentSSID) && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    Current WiFi: <span className="font-semibold">{currentSSID}</span>
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    Click to add this network to allowed list
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCurrentWiFi}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Current WiFi
                </button>
              </div>
            </div>
          )}

          {/* Display allowed SSIDs as chips */}
          {getSSIDList().length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {getSSIDList().map((ssid) => (
                <div
                  key={ssid}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                    ssid === currentSSID
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                  )}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>{ssid}</span>
                  {ssid === currentSSID && (
                    <span className="text-xs text-green-600 dark:text-green-400">(Current)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveSSID(ssid)}
                    className="ml-1 hover:bg-white/50 dark:hover:bg-black/20 rounded-full p-0.5 transition-colors"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manual SSID entry */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualSSID}
              onChange={(e) => setManualSSID(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualSSID();
                }
              }}
              placeholder="Add another WiFi network manually..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleAddManualSSID}
              disabled={!manualSSID.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Add WiFi networks to allow access to restricted features
          </p>
        </div>

        {/* Info Box */}
        {wifiCheckOn && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-300">
                <p className="font-medium mb-1">Staff Build Feature</p>
                <p>WiFi access control only works in Staff APK builds. Owner builds always have full access.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auto-Attendance Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Attendance on WiFi</h3>
        </div>

        {/* Enable Auto-Attendance */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAttendanceOn}
              onChange={(e) => setAutoAttendanceOn(e.target.checked)}
              className="w-5 h-5 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
            />
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Enable Auto Clock-In on WiFi Connection</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically clock in staff when they connect to restaurant WiFi
              </p>
            </div>
          </label>
        </div>

        {/* Device Staff Assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Assign This Device To (Optional)
          </label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">No staff assigned (session-based only)</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} - {s.role}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            For shared devices: assign to a specific staff member. For personal devices: leave unassigned (uses logged-in staff).
          </p>
        </div>

        {/* How It Works */}
        {autoAttendanceOn && (
          <div className="mt-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
            <p className="text-sm font-medium text-teal-900 dark:text-teal-300 mb-2">How Auto-Attendance Works:</p>
            <ul className="text-sm text-teal-800 dark:text-teal-400 space-y-1 list-disc list-inside">
              <li>Staff connects to configured restaurant WiFi</li>
              <li>System identifies staff (logged-in user OR device assignment)</li>
              <li>Checks if staff has approved leave for today (skips if on leave)</li>
              <li>Checks if staff is already clocked in (skips if active shift)</li>
              <li>Automatically clocks in staff and shows notification</li>
              <li>5-minute cooldown prevents duplicate clock-ins</li>
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex-1">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Settings saved successfully</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{errorMessage || 'Failed to save settings'}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-6 py-2 text-sm font-medium text-white rounded-lg transition-all',
              'bg-blue-600 hover:bg-blue-700 active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

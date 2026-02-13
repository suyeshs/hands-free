import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  checkDeviceRegistration,
  registerDevice,
  clearDeviceRegistration,
  type DeviceStatus
} from '../../services/tauriAuth';
import { Smartphone, AlertTriangle, CheckCircle2, XCircle, RefreshCw, QrCode } from 'lucide-react';

export function DeviceRegistrationManager() {
  const navigate = useNavigate();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [deviceName, setDeviceName] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  useEffect(() => {
    loadDeviceStatus();
  }, []);

  const loadDeviceStatus = async () => {
    try {
      setLoading(true);
      const status = await checkDeviceRegistration();
      setDeviceStatus(status);

      // Pre-fill device name if not registered
      if (!status.isRegistered && !deviceName) {
        const defaultName = `POS Terminal - ${new Date().toLocaleDateString()}`;
        setDeviceName(defaultName);
      }
    } catch (err) {
      console.error('Failed to load device status:', err);
      setError('Failed to load device status');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    try {
      setRegistering(true);
      setError(null);

      // Get tenant info from local config (assumes tenant is already provisioned)
      // In production, this would come from the actual tenant config
      const tenantId = import.meta.env.VITE_DEFAULT_TENANT_ID || 'default-tenant';
      const tenantName = tenantId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const result = await registerDevice(deviceName, tenantId, tenantName);

      if (result.success) {
        await loadDeviceStatus();
        setShowRegisterForm(false);
        setError(null);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Failed to register device:', err);
      setError(String(err));
    } finally {
      setRegistering(false);
    }
  };

  const handleClearRegistration = async () => {
    if (!confirm('Are you sure you want to clear this device registration? Multi-device features will be disabled until you register again.')) {
      return;
    }

    try {
      setLoading(true);
      await clearDeviceRegistration();
      await loadDeviceStatus();
      setShowRegisterForm(true);
    } catch (err) {
      console.error('Failed to clear registration:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !deviceStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Device Registration</h2>
        <p className="text-gray-600 mt-1">
          Register this device to enable multi-device features like LAN sync and remote printing
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Device Status Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              deviceStatus?.isRegistered ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Smartphone className={`w-6 h-6 ${
                deviceStatus?.isRegistered ? 'text-green-600' : 'text-gray-400'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Device Status</h3>
                {deviceStatus?.isRegistered ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Registered
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    <XCircle className="w-3 h-3" />
                    Not Registered
                  </span>
                )}
              </div>

              {deviceStatus?.isRegistered ? (
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="font-medium">Device Name:</span>
                    <span>{deviceStatus.deviceName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="font-medium">Device ID:</span>
                    <span className="font-mono text-xs">{deviceStatus.deviceId?.slice(0, 16)}...</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="font-medium">Tenant:</span>
                    <span>{deviceStatus.tenantName}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  This device is not registered. Register it to enable LAN sync, remote printing, and multi-device coordination.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadDeviceStatus}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          {deviceStatus?.isRegistered ? (
            <>
              <button
                onClick={handleClearRegistration}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Clear Registration
              </button>
              <button
                onClick={() => setShowRegisterForm(true)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
              >
                Re-register Device
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowRegisterForm(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              Register Device
            </button>
          )}
        </div>
      </div>

      {/* Registration Form */}
      {showRegisterForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Register This Device</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Device Name
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., POS Terminal 1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                disabled={registering}
              />
              <p className="text-xs text-gray-500 mt-1">
                Choose a descriptive name to identify this device (e.g., "Main Counter POS", "Kitchen Display 1")
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegister}
                disabled={registering || !deviceName.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registering ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Registering...
                  </span>
                ) : (
                  'Register Device'
                )}
              </button>
              <button
                onClick={() => setShowRegisterForm(false)}
                disabled={registering}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Card - Features Enabled by Device Registration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <QrCode className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Multi-Device Features</h3>
            <p className="text-sm text-blue-700 mb-3">
              Device registration enables the following features:
            </p>
            <ul className="space-y-1.5 text-sm text-blue-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span><strong>LAN Sync:</strong> Synchronize orders and data across devices on the same network</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span><strong>Remote Printing:</strong> Print receipts and KOTs from any device to any printer</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span><strong>Multi-Device Coordination:</strong> Share device modes (POS, KDS, BDS) across terminals</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span><strong>Device Management:</strong> Track and manage all connected devices from one place</span>
              </li>
            </ul>
            <p className="text-xs text-blue-600 mt-3">
              Note: Single-device operation works without registration. These features are only needed for multi-device setups.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile App QR Scanning Note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Mobile App Registration</h3>
        <p className="text-sm text-gray-600">
          Mobile apps (Owner & Staff apps) have their own QR-based registration flow during onboarding.
          This desktop device registration is separate and used for POS terminal management.
        </p>
      </div>
    </div>
  );
}

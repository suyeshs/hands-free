import { useState, useEffect } from 'react';
import { ManagerLoginForm } from '../components/auth/ManagerLoginForm';
import { StaffPinLogin } from '../components/auth/StaffPinLogin';
import { checkDeviceRegistration, registerDevice, type DeviceStatus } from '../services/tauriAuth';

interface LoginProps {
  onSuccess: () => void;
}

type LoginMode = 'manager' | 'staff';

export function Login({ onSuccess }: LoginProps) {
  const [mode, setMode] = useState<LoginMode>('staff');
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeviceStatus();
  }, []);

  const loadDeviceStatus = async () => {
    try {
      let status = await checkDeviceRegistration();
      console.log('[Login] Device status:', status);
      console.log('[Login] Is registered?', status.isRegistered);

      // Auto-register in testing mode if not registered
      if (!status.isRegistered) {
        console.log('[Login] Device not registered - auto-registering in testing mode...');
        try {
          const result = await registerDevice(
            'POS Terminal 1',
            'khao-piyo-7766',
            'Khao Piyo Restaurant'
          );
          console.log('[Login] Auto-registration successful:', result);
          // Reload status after registration
          status = await checkDeviceRegistration();
          console.log('[Login] Device now registered:', status);
        } catch (regErr) {
          console.error('[Login] Auto-registration failed:', regErr);
          // Continue anyway - will show registration UI
        }
      }

      setDeviceStatus(status);
    } catch (err) {
      console.error('[Login] Failed to check device status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRegister = async () => {
    alert('Button clicked!'); // Test if click is working
    console.log('[Login] Quick Register button clicked');
    try {
      setLoading(true);
      console.log('[Login] Calling registerDevice...');
      const result = await registerDevice(
        'POS Terminal 1',
        'khao-piyo-7766',
        'Khao Piyo Restaurant'
      );
      console.log('[Login] Device registered:', result);

      // Reload device status
      console.log('[Login] Reloading device status...');
      await loadDeviceStatus();
      console.log('[Login] Device status reloaded');
    } catch (err) {
      console.error('[Login] Failed to register device:', err);
      alert('Failed to register device: ' + err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!deviceStatus?.isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Not Registered</h2>
            <p className="text-gray-600 mb-6">
              This device needs to be registered before you can log in.
            </p>

            {/* Temporary Quick Register Button - For Development */}
            <button
              onClick={handleQuickRegister}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Quick Register (Dev Mode)'}
            </button>

            <p className="text-xs text-gray-500 mt-4">
              This will register as "POS Terminal 1" for tenant "khao-piyo-7766"
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-1">POS Login</h1>
            {deviceStatus && (
              <p className="text-orange-100 text-sm">
                {deviceStatus.tenantName || 'Restaurant'} • {deviceStatus.deviceName || 'Terminal'}
              </p>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMode('staff')}
            className={`flex-1 py-4 font-medium transition-colors ${
              mode === 'staff'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Staff Login</span>
            </div>
          </button>

          <button
            onClick={() => setMode('manager')}
            className={`flex-1 py-4 font-medium transition-colors ${
              mode === 'manager'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Manager Login</span>
            </div>
          </button>
        </div>

        {/* Login Form */}
        <div className="p-8">
          {mode === 'staff' ? (
            <StaffPinLogin onSuccess={onSuccess} />
          ) : (
            <>
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Manager Access</h2>
                <p className="text-sm text-gray-600">
                  Authenticate with your phone number
                </p>
              </div>
              <ManagerLoginForm onSuccess={onSuccess} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Device: {deviceStatus?.deviceId?.slice(0, 8)}...</span>
            <span>Tenant: {deviceStatus?.tenantId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

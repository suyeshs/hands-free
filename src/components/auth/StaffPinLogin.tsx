import { useState, useEffect } from 'react';
import Database from '@tauri-apps/plugin-sql';
import {
  getCurrentTenantId,
  checkStaffLoginRateLimit,
  verifyStaffPin,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  setStaffSession,
  type StaffUser,
} from '../../services/tauriAuth';

interface StaffPinLoginProps {
  onSuccess: () => void;
}

export function StaffPinLogin({ onSuccess }: StaffPinLoginProps) {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(true);

  // Load staff list on mount
  useEffect(() => {
    loadStaffList();
  }, []);

  const loadStaffList = async () => {
    try {
      setLoadingStaff(true);
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        setError('Device not registered');
        return;
      }

      const db = await Database.load('sqlite:pos.db');
      const query = `
        SELECT id, tenant_id, name, role, is_active, permissions, created_at, last_login_at
        FROM staff_users
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY name
      `;

      const results = await db.select<StaffUser[]>(query, [tenantId]);

      // Parse permissions from JSON string
      const staff = results.map((s: any) => ({
        ...s,
        isActive: s.is_active === 1,
        permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions || [],
        createdAt: s.created_at,
        lastLoginAt: s.last_login_at,
      }));

      setStaffList(staff);
    } catch (err) {
      console.error('[Staff Login] Failed to load staff list:', err);
      setError('Failed to load staff list');
    } finally {
      setLoadingStaff(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleLogin = async () => {
    if (!selectedStaff || pin.length < 4) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const staff = staffList.find((s) => s.name === selectedStaff);
      if (!staff) {
        setError('Staff not found');
        setLoading(false);
        return;
      }

      // Check rate limiting
      try {
        await checkStaffLoginRateLimit(selectedStaff);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Too many failed attempts');
        setLoading(false);
        setPin('');
        return;
      }

      // Get PIN hash from database
      const tenantId = await getCurrentTenantId();
      const db = await Database.load('sqlite:pos.db');
      const query = 'SELECT pin_hash FROM staff_users WHERE id = ? AND tenant_id = ?';
      const result = await db.select<Array<{ pin_hash: string }>>(query, [staff.id, tenantId]);

      if (result.length === 0) {
        setError('Staff not found');
        setLoading(false);
        setPin('');
        return;
      }

      const pinHash = result[0].pin_hash;

      // Verify PIN (constant-time comparison via Argon2)
      const isValid = await verifyStaffPin(pin, pinHash);

      if (isValid) {
        // Success - clear failed attempts and set session
        await clearFailedLoginAttempts(selectedStaff);
        await setStaffSession(staff);

        // Update last_login_at
        const now = Math.floor(Date.now() / 1000);
        await db.execute('UPDATE staff_users SET last_login_at = ? WHERE id = ?', [now, staff.id]);

        console.log('[Staff Login] Login successful');
        onSuccess();
      } else {
        // Failed - record attempt and show error
        await recordFailedLoginAttempt(selectedStaff);
        setError('Invalid PIN');
        setPin('');
      }
    } catch (err) {
      console.error('[Staff Login] Error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when PIN reaches 6 digits
  useEffect(() => {
    if (pin.length === 6 && selectedStaff) {
      handleLogin();
    }
  }, [pin, selectedStaff]);

  if (loadingStaff) {
    return (
      <div className="w-full max-w-md text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading staff...</p>
      </div>
    );
  }

  if (staffList.length === 0) {
    return (
      <div className="w-full max-w-md text-center py-8">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <p className="font-medium">No staff accounts found</p>
          <p className="text-sm mt-1">Contact your manager to create a staff account</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* Staff Selection */}
      <div className="mb-6">
        <label htmlFor="staff" className="block text-sm font-medium text-gray-700 mb-2">
          Select Staff
        </label>
        <select
          id="staff"
          value={selectedStaff}
          onChange={(e) => {
            setSelectedStaff(e.target.value);
            setPin('');
            setError('');
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
          disabled={loading}
        >
          <option value="">Choose your name...</option>
          {staffList.map((staff) => (
            <option key={staff.id} value={staff.name}>
              {staff.name} ({staff.role})
            </option>
          ))}
        </select>
      </div>

      {/* PIN Display */}
      {selectedStaff && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter PIN</label>
            <div className="flex justify-center gap-2 mb-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className="w-12 h-14 flex items-center justify-center border-2 border-gray-300 rounded-lg bg-white"
                >
                  {pin[index] && (
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-gray-500">
              Enter your 4-6 digit PIN
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                onClick={() => handlePinInput(digit.toString())}
                disabled={loading || pin.length >= 6}
                className="h-16 text-2xl font-semibold bg-white hover:bg-gray-50 disabled:bg-gray-100 border-2 border-gray-300 rounded-lg transition-colors"
              >
                {digit}
              </button>
            ))}

            <button
              onClick={handleClear}
              disabled={loading || pin.length === 0}
              className="h-16 text-sm font-medium bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors"
            >
              Clear
            </button>

            <button
              onClick={() => handlePinInput('0')}
              disabled={loading || pin.length >= 6}
              className="h-16 text-2xl font-semibold bg-white hover:bg-gray-50 disabled:bg-gray-100 border-2 border-gray-300 rounded-lg transition-colors"
            >
              0
            </button>

            <button
              onClick={handleBackspace}
              disabled={loading || pin.length === 0}
              className="h-16 text-sm font-medium bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 rounded-lg transition-colors"
            >
              ⌫
            </button>
          </div>

          {/* Submit button for 4-5 digit PINs */}
          {pin.length >= 4 && pin.length < 6 && (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full mt-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Verifying...' : 'Login'}
            </button>
          )}

          {loading && (
            <div className="text-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

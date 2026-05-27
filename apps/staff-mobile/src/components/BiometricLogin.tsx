/**
 * Biometric Login Screen
 * PIN is always shown. Biometric is an explicit opt-in button when available.
 * Never auto-triggers so logout works reliably.
 */

import { useState } from 'react';
import { Fingerprint, AlertCircle, UserCircle } from 'lucide-react';
import { useDeviceAuthStore } from '../stores/deviceAuthStore';
import './BiometricLogin.css';

export default function BiometricLogin() {
  const {
    deviceRegistration,
    biometricAvailable,
    authenticateWithDevice,
    loginWithPin,
    unregisterDevice,
    isLoading,
    error,
  } = useDeviceAuthStore();

  const [pin, setPin] = useState('');
  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

  const handleBackspace = () => setPin((p) => p.slice(0, -1));

  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    try {
      await loginWithPin(pin);
    } catch {
      setPin('');
    }
  };

  const handleBiometric = async () => {
    try {
      await authenticateWithDevice();
    } catch {
      // error shown from store
    }
  };

  const handleUnregister = async () => {
    try {
      await unregisterDevice();
    } catch (err) {
      console.error('[BiometricLogin] Unregister failed:', err);
    }
  };

  return (
    <div className="biometric-login">
      <div className="biometric-container">
        <div className="biometric-header">
          <div className="user-avatar">
            <UserCircle size={64} />
          </div>
          <h1>Welcome back</h1>
          <p className="user-name">{deviceRegistration?.staffName}</p>
        </div>

        {/* PIN display */}
        <div className="pin-display">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`}>
              {i < pin.length && '●'}
            </div>
          ))}
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Numpad */}
        <div className="numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              className="numpad-button"
              onClick={() => handlePinInput(digit.toString())}
              disabled={isLoading}
            >
              {digit}
            </button>
          ))}
          <button className="numpad-button empty" disabled />
          <button className="numpad-button" onClick={() => handlePinInput('0')} disabled={isLoading}>0</button>
          <button className="numpad-button backspace" onClick={handleBackspace} disabled={isLoading || pin.length === 0}>←</button>
        </div>

        <div className="biometric-actions">
          <button
            className="retry-button"
            onClick={handlePinSubmit}
            disabled={isLoading || pin.length < 4}
          >
            {isLoading ? 'Verifying…' : 'Unlock'}
          </button>

          {biometricAvailable && (
            <button className="retry-button" onClick={handleBiometric} disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Fingerprint size={18} /> Use Fingerprint
            </button>
          )}

          <button
            className="unregister-button"
            onClick={() => setShowUnregisterConfirm(true)}
            disabled={isLoading}
          >
            Unregister Device
          </button>
        </div>

        {showUnregisterConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <div className="confirm-icon"><AlertCircle size={48} /></div>
              <h2>Unregister Device?</h2>
              <p>
                This device will no longer be linked to {deviceRegistration?.staffName}.
                You'll need to register again with your PIN.
              </p>
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => setShowUnregisterConfirm(false)}>Cancel</button>
                <button className="confirm-unregister" onClick={handleUnregister}>Unregister</button>
              </div>
            </div>
          </div>
        )}

        <div className="biometric-footer">
          <p>Enter your PIN to unlock.</p>
        </div>
      </div>
    </div>
  );
}

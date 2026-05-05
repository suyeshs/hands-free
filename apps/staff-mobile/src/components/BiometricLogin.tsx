/**
 * Biometric Login Screen
 * Authenticates registered device using fingerprint/face ID
 */

import { useState, useEffect } from 'react';
import { Fingerprint, AlertCircle, UserCircle } from 'lucide-react';
import { useDeviceAuthStore } from '../stores/deviceAuthStore';
import './BiometricLogin.css';

export default function BiometricLogin() {
  const {
    registeredStaffName,
    authenticateWithDevice,
    unregisterDevice,
    isLoading,
    error
  } = useDeviceAuthStore();

  const [showUnregisterConfirm, setShowUnregisterConfirm] = useState(false);

  // Auto-trigger biometric auth on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleBiometricAuth();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleBiometricAuth = async () => {
    try {
      await authenticateWithDevice();
      // Success - store will update state and App.tsx will show main content
    } catch (err) {
      // Error shown by store
      console.error('[BiometricLogin] Auth failed:', err);
    }
  };

  const handleUnregister = async () => {
    try {
      await unregisterDevice();
      // Will navigate back to registration screen
    } catch (err) {
      console.error('[BiometricLogin] Unregister failed:', err);
    }
  };

  return (
    <div className="biometric-login">
      <div className="biometric-container">
        {/* Header */}
        <div className="biometric-header">
          <div className="user-avatar">
            <UserCircle size={64} />
          </div>
          <h1>Welcome back</h1>
          <p className="user-name">{registeredStaffName}</p>
        </div>

        {/* Biometric Icon */}
        <div className="biometric-icon-container">
          <div className={`biometric-icon ${isLoading ? 'pulse' : ''}`}>
            <Fingerprint size={80} />
          </div>
          <p className="biometric-prompt">
            {isLoading
              ? 'Authenticating...'
              : 'Touch fingerprint sensor or use face ID'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="biometric-actions">
          <button
            className="retry-button"
            onClick={handleBiometricAuth}
            disabled={isLoading}
          >
            Try Again
          </button>

          <button
            className="unregister-button"
            onClick={() => setShowUnregisterConfirm(true)}
            disabled={isLoading}
          >
            Unregister Device
          </button>
        </div>

        {/* Unregister Confirmation */}
        {showUnregisterConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <div className="confirm-icon">
                <AlertCircle size={48} />
              </div>
              <h2>Unregister Device?</h2>
              <p>
                This device will no longer be linked to {registeredStaffName}.
                You'll need to register again with your PIN.
              </p>
              <div className="confirm-actions">
                <button
                  className="confirm-cancel"
                  onClick={() => setShowUnregisterConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-unregister"
                  onClick={handleUnregister}
                >
                  Unregister
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="biometric-footer">
          <p>
            Your device is registered to {registeredStaffName}.
            Use biometric authentication to access the app.
          </p>
        </div>
      </div>
    </div>
  );
}

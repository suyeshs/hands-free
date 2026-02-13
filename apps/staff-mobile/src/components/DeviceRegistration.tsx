/**
 * Device Registration Screen
 * First-time setup: register device to a staff member
 */

import { useState } from 'react';
import { Smartphone, AlertCircle, CheckCircle } from 'lucide-react';
import { useDeviceAuthStore } from '../stores/deviceAuthStore';
import { getDatabase } from '../lib/database';
import './DeviceRegistration.css';

export default function DeviceRegistration() {
  const { registerDevice, isLoading, error: authError } = useDeviceAuthStore();

  const [step, setStep] = useState<'select' | 'pin'>('select');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load staff list on mount
  useState(() => {
    async function loadStaff() {
      setLoading(true);
      try {
        const db = await getDatabase();
        const result = await db.select<Array<{
          id: string;
          name: string;
          role: string;
        }>>(`
          SELECT id, name, role
          FROM staff_users
          WHERE is_active = 1
          ORDER BY name
        `);

        setStaffList(result);
      } catch (err) {
        setError('Failed to load staff list');
        console.error('[DeviceRegistration] Load staff error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStaff();
  });

  const handleStaffSelect = (staffId: string) => {
    setSelectedStaff(staffId);
    setStep('pin');
    setError(null);
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    try {
      await registerDevice(selectedStaff, pin);
      // Success - store will handle navigation
    } catch (err) {
      setPin('');
      // Error shown by auth store
    }
  };

  const handleBack = () => {
    setStep('select');
    setPin('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="device-registration">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="device-registration">
      <div className="registration-container">
        {/* Header */}
        <div className="registration-header">
          <div className="registration-icon">
            <Smartphone size={48} />
          </div>
          <h1>Device Registration</h1>
          <p>
            {step === 'select'
              ? 'Select your name to register this device'
              : 'Enter your PIN to confirm'}
          </p>
        </div>

        {/* Step 1: Select Staff */}
        {step === 'select' && (
          <div className="staff-list">
            {staffList.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={48} />
                <p>No staff members found</p>
                <p className="help-text">
                  Please ask your manager to add staff members in the main app
                </p>
              </div>
            ) : (
              staffList.map((staff) => (
                <button
                  key={staff.id}
                  className="staff-item"
                  onClick={() => handleStaffSelect(staff.id)}
                >
                  <div className="staff-avatar">
                    {staff.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="staff-info">
                    <div className="staff-name">{staff.name}</div>
                    <div className="staff-role">{staff.role}</div>
                  </div>
                  <div className="staff-arrow">→</div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2: Enter PIN */}
        {step === 'pin' && (
          <>
            {/* Selected Staff Display */}
            <div className="selected-staff">
              <CheckCircle size={20} className="check-icon" />
              <span>
                {staffList.find((s) => s.id === selectedStaff)?.name}
              </span>
            </div>

            {/* PIN Display */}
            <div className="pin-display">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                >
                  {i < pin.length && '●'}
                </div>
              ))}
            </div>

            {/* Error Message */}
            {(error || authError) && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{error || authError}</span>
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
              <button
                className="numpad-button"
                onClick={() => handlePinInput('0')}
                disabled={isLoading}
              >
                0
              </button>
              <button
                className="numpad-button backspace"
                onClick={handleBackspace}
                disabled={isLoading || pin.length === 0}
              >
                ←
              </button>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="back-button"
                onClick={handleBack}
                disabled={isLoading}
              >
                Back
              </button>
              <button
                className="register-button"
                onClick={handleSubmit}
                disabled={isLoading || pin.length < 4}
              >
                {isLoading ? 'Registering...' : 'Register Device'}
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="registration-footer">
          <p>
            This device will be registered to the selected staff member.
            You'll use biometric authentication (fingerprint/face ID) for future logins.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Staff PIN Entry Modal for POS
 * Allows staff to authenticate before using POS when setting is enabled
 */

import { useState, useEffect, useCallback } from 'react';
import Database from '@tauri-apps/plugin-sql';
import {
  getCurrentTenantId,
  checkStaffLoginRateLimit,
  verifyStaffPin,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  type StaffUser,
} from '../../services/tauriAuth';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import { usePOSSessionStore } from '../../stores/posSessionStore';
import { usePOSStore } from '../../stores/posStore';
import { UserRole } from '../../types/auth';
import { cn } from '../../lib/utils';

interface StaffPinEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StaffPinEntryModal({ isOpen, onClose, onSuccess }: StaffPinEntryModalProps) {
  const { assignments, loadFloorPlan, isLoaded: floorPlanLoaded } = useFloorPlanStore();
  const { setActiveStaff, clearSession } = usePOSSessionStore();
  const { clearCart } = usePOSStore();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(true);

  // Load staff list on mount
  useEffect(() => {
    if (isOpen) {
      loadStaffList();
    }
  }, [isOpen]);

  // Load floor plan for assignments
  useEffect(() => {
    const loadFloor = async () => {
      if (isOpen && !floorPlanLoaded) {
        const tenantId = await getCurrentTenantId();
        if (tenantId) {
          loadFloorPlan(tenantId);
        }
      }
    };
    loadFloor();
  }, [isOpen, floorPlanLoaded, loadFloorPlan]);

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
        WHERE tenant_id = ? AND is_active = 1 AND (role = ? OR role = ?)
        ORDER BY name
      `;

      // Only show SERVER and MANAGER roles for POS
      const results = await db.select<StaffUser[]>(query, [tenantId, UserRole.SERVER, UserRole.MANAGER]);

      const staff = results.map((s: any) => ({
        ...s,
        isActive: s.is_active === 1,
        permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions || [],
        createdAt: s.created_at,
        lastLoginAt: s.last_login_at,
      }));

      setStaffList(staff);
    } catch (err) {
      console.error('[StaffPinEntry] Failed to load staff list:', err);
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

  const handleLogin = useCallback(async () => {
    if (!selectedStaff || pin.length < 4) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Check rate limiting
      try {
        await checkStaffLoginRateLimit(selectedStaff.name);
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
      const result = await db.select<Array<{ pin_hash: string }>>(query, [selectedStaff.id, tenantId]);

      if (result.length === 0) {
        setError('Staff not found');
        setLoading(false);
        setPin('');
        return;
      }

      const pinHash = result[0].pin_hash;

      // Verify PIN
      const isValid = await verifyStaffPin(pin, pinHash);

      if (isValid) {
        // Success - clear failed attempts
        await clearFailedLoginAttempts(selectedStaff.name);

        // Update last_login_at
        const now = Math.floor(Date.now() / 1000);
        await db.execute('UPDATE staff_users SET last_login_at = ? WHERE id = ?', [now, selectedStaff.id]);

        // Clear previous session and cart
        clearSession();
        clearCart();

        // Get staff's assigned sections
        const staffAssignment = assignments.find(a => a.userId === selectedStaff.id);
        const sectionIds = staffAssignment?.sectionIds || [];

        // Set new session
        setActiveStaff(
          {
            id: selectedStaff.id,
            name: selectedStaff.name,
            role: selectedStaff.role,
          },
          sectionIds
        );

        console.log('[StaffPinEntry] Login successful for:', selectedStaff.name);
        onSuccess();
      } else {
        // Failed - record attempt
        await recordFailedLoginAttempt(selectedStaff.name);
        setError('Invalid PIN');
        setPin('');
      }
    } catch (err) {
      console.error('[StaffPinEntry] Error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, pin, assignments, clearSession, clearCart, setActiveStaff, onSuccess]);

  // Auto-submit when PIN reaches 6 digits
  useEffect(() => {
    if (pin.length === 6 && selectedStaff) {
      handleLogin();
    }
  }, [pin, selectedStaff, handleLogin]);

  const handleSelectStaff = (staff: StaffUser) => {
    setSelectedStaff(staff);
    setPin('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-accent/10">
          <h2 className="text-xl font-black uppercase tracking-widest text-center">Staff Login</h2>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Enter your PIN to access POS
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loadingStaff ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading staff...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">👤</div>
              <p className="font-semibold">No Staff Accounts</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact your manager to create a staff account
              </p>
            </div>
          ) : !selectedStaff ? (
            // Staff Selection Grid
            <div className="space-y-3">
              <p className="text-sm font-bold text-muted-foreground mb-4">Select your name:</p>
              <div className="grid grid-cols-2 gap-3">
                {staffList.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleSelectStaff(staff)}
                    className="p-4 border-2 border-border rounded-xl hover:border-accent hover:bg-accent/10 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mb-2">
                      <span className="text-lg font-black text-accent">
                        {staff.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="font-bold truncate">{staff.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{staff.role}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // PIN Entry
            <div className="space-y-4">
              {/* Selected Staff */}
              <button
                onClick={() => setSelectedStaff(null)}
                className="w-full flex items-center gap-3 p-3 bg-accent/10 rounded-xl border border-accent/30 hover:bg-accent/20 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center">
                  <span className="text-lg font-black text-accent">
                    {selectedStaff.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold">{selectedStaff.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{selectedStaff.role}</div>
                </div>
                <span className="text-xs text-muted-foreground">Change</span>
              </button>

              {/* PIN Display */}
              <div>
                <div className="flex justify-center gap-2 mb-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <div
                      key={index}
                      className={cn(
                        "w-10 h-12 flex items-center justify-center border-2 rounded-lg",
                        pin[index] ? "border-accent bg-accent/10" : "border-border"
                      )}
                    >
                      {pin[index] && (
                        <div className="w-3 h-3 bg-accent rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Enter your 4-6 digit PIN
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handlePinInput(digit.toString())}
                    disabled={loading || pin.length >= 6}
                    className="h-14 text-xl font-bold bg-background hover:bg-accent/10 disabled:opacity-50 border-2 border-border rounded-xl transition-colors touch-target"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  onClick={handleClear}
                  disabled={loading || pin.length === 0}
                  className="h-14 text-xs font-bold uppercase bg-muted hover:bg-muted/80 disabled:opacity-50 rounded-xl transition-colors touch-target"
                >
                  Clear
                </button>

                <button
                  onClick={() => handlePinInput('0')}
                  disabled={loading || pin.length >= 6}
                  className="h-14 text-xl font-bold bg-background hover:bg-accent/10 disabled:opacity-50 border-2 border-border rounded-xl transition-colors touch-target"
                >
                  0
                </button>

                <button
                  onClick={handleBackspace}
                  disabled={loading || pin.length === 0}
                  className="h-14 text-lg font-bold bg-muted hover:bg-muted/80 disabled:opacity-50 rounded-xl transition-colors touch-target"
                >
                  ⌫
                </button>
              </div>

              {/* Submit for 4-5 digit PINs */}
              {pin.length >= 4 && pin.length < 6 && (
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors touch-target"
                >
                  {loading ? 'Verifying...' : 'Login'}
                </button>
              )}

              {loading && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3 text-muted-foreground font-bold text-sm uppercase tracking-widest hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Device Authentication Store
 * Manages device registration and biometric authentication
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StaffUser } from '../types/auth';
import { getDatabase } from '../lib/database';
import {
  getDeviceId,
  getDeviceInfo,
  isBiometricAvailable,
  authenticateWithBiometric,
  storeDeviceRegistration,
  getStoredDeviceRegistration,
  clearDeviceRegistration,
} from '../lib/deviceAuth';

interface DeviceRegistration {
  deviceId: string;
  staffId: string;
  staffName: string;
  registeredAt: string;
}

interface DeviceAuthStore {
  // State
  currentUser: StaffUser | null;
  deviceRegistration: DeviceRegistration | null;
  isAuthenticated: boolean;
  isDeviceRegistered: boolean;
  biometricAvailable: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions - Device Registration
  checkDeviceRegistration: () => Promise<void>;
  registerDevice: (staffId: string, pin: string) => Promise<void>;
  unregisterDevice: () => Promise<void>;

  // Actions - Authentication
  authenticateWithDevice: () => Promise<void>;
  logout: () => void;
  setError: (error: string | null) => void;

  // Computed
  needsRegistration: () => boolean;
}

export const useDeviceAuthStore = create<DeviceAuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUser: null,
      deviceRegistration: null,
      isAuthenticated: false,
      isDeviceRegistered: false,
      biometricAvailable: false,
      isLoading: false,
      error: null,

      // Check if device is registered
      checkDeviceRegistration: async () => {
        set({ isLoading: true, error: null });

        try {
          console.log('[DeviceAuth] Checking device registration...');

          // Get device info
          const deviceInfo = await getDeviceInfo();
          const deviceId = deviceInfo.deviceId;

          console.log('[DeviceAuth] Device ID:', deviceId);

          // Check if biometric is available
          const bioAvailable = await isBiometricAvailable();
          console.log('[DeviceAuth] Biometric available:', bioAvailable);

          // Check local storage for registration
          const storedReg = getStoredDeviceRegistration();

          if (storedReg && storedReg.deviceId === deviceId) {
            console.log('[DeviceAuth] Device registered to:', storedReg.staffName);

            // Verify in database
            const db = await getDatabase();
            const result = await db.select<Array<{
              device_id: string;
              staff_id: string;
              registered_at: string;
            }>>(`
              SELECT device_id, staff_id, registered_at
              FROM device_registrations
              WHERE device_id = ? AND staff_id = ?
            `, [deviceId, storedReg.staffId]);

            if (result.length > 0) {
              set({
                deviceRegistration: storedReg,
                isDeviceRegistered: true,
                biometricAvailable: bioAvailable,
                isLoading: false,
              });
              return;
            } else {
              console.log('[DeviceAuth] Registration not found in DB, clearing local storage');
              clearDeviceRegistration();
            }
          }

          set({
            isDeviceRegistered: false,
            biometricAvailable: bioAvailable,
            isLoading: false,
          });

          console.log('[DeviceAuth] Device not registered');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to check registration';
          console.error('[DeviceAuth] Check registration error:', message);
          set({
            error: message,
            isLoading: false,
          });
        }
      },

      // Register device to a staff member
      registerDevice: async (staffId: string, pin: string) => {
        set({ isLoading: true, error: null });

        try {
          console.log('[DeviceAuth] Registering device for staff:', staffId);

          const db = await getDatabase();

          // Verify staff member exists and PIN is correct
          const staffResult = await db.select<Array<{
            id: string;
            tenant_id: string;
            name: string;
            role: string;
            pin_hash: string;
            email: string | null;
            phone: string | null;
            is_active: number;
            photo_url: string | null;
          }>>(`
            SELECT id, tenant_id, name, role, pin_hash, email, phone, is_active, photo_url
            FROM staff_users
            WHERE id = ? AND is_active = 1
          `, [staffId]);

          if (staffResult.length === 0) {
            throw new Error('Staff member not found or inactive');
          }

          const staff = staffResult[0];

          // Verify PIN (import from pinAuth)
          const { verifyPin } = await import('../lib/pinAuth');
          const isValidPin = await verifyPin(pin, staff.pin_hash);

          if (!isValidPin) {
            throw new Error('Invalid PIN');
          }

          // Get device ID
          const deviceId = await getDeviceId();

          // Check if device is already registered
          const existingReg = await db.select<Array<{ device_id: string }>>(`
            SELECT device_id
            FROM device_registrations
            WHERE device_id = ?
          `, [deviceId]);

          if (existingReg.length > 0) {
            throw new Error('Device already registered. Unregister first.');
          }

          // Register device in database
          const registrationId = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const now = Date.now();

          await db.execute(`
            INSERT INTO device_registrations (
              id, device_id, staff_id, tenant_id, registered_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [registrationId, deviceId, staff.id, staff.tenant_id, now, now]);

          // Create user object
          const user: StaffUser = {
            id: staff.id,
            name: staff.name,
            role: staff.role as StaffUser['role'],
            tenantId: staff.tenant_id,
            email: staff.email || undefined,
            phone: staff.phone || undefined,
            isActive: staff.is_active === 1,
            photoUrl: staff.photo_url || undefined,
          };

          // Store in local storage
          storeDeviceRegistration(deviceId, staff.id, staff.name);

          const registration: DeviceRegistration = {
            deviceId,
            staffId: staff.id,
            staffName: staff.name,
            registeredAt: new Date(now).toISOString(),
          };

          set({
            deviceRegistration: registration,
            isDeviceRegistered: true,
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[DeviceAuth] Device registered successfully');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          console.error('[DeviceAuth] Registration error:', message);
          set({
            error: message,
            isLoading: false,
          });
          throw error;
        }
      },

      // Unregister device
      unregisterDevice: async () => {
        try {
          const deviceId = await getDeviceId();
          const db = await getDatabase();

          // Remove from database
          await db.execute(`
            DELETE FROM device_registrations
            WHERE device_id = ?
          `, [deviceId]);

          // Clear local storage
          clearDeviceRegistration();

          set({
            currentUser: null,
            deviceRegistration: null,
            isAuthenticated: false,
            isDeviceRegistered: false,
          });

          console.log('[DeviceAuth] Device unregistered');
        } catch (error) {
          console.error('[DeviceAuth] Unregister error:', error);
          throw error;
        }
      },

      // Authenticate with biometric
      authenticateWithDevice: async () => {
        set({ isLoading: true, error: null });

        try {
          const registration = get().deviceRegistration;
          if (!registration) {
            throw new Error('Device not registered');
          }

          console.log('[DeviceAuth] Authenticating with biometric...');

          // Check if biometric is available
          const bioAvailable = get().biometricAvailable;

          if (bioAvailable) {
            // Authenticate with biometric
            const authenticated = await authenticateWithBiometric();

            if (!authenticated) {
              throw new Error('Biometric authentication failed');
            }

            console.log('[DeviceAuth] Biometric authentication successful');
          } else {
            console.log('[DeviceAuth] Biometric not available, using device registration');
          }

          // Load staff info from database
          const db = await getDatabase();
          const staffResult = await db.select<Array<{
            id: string;
            tenant_id: string;
            name: string;
            role: string;
            email: string | null;
            phone: string | null;
            is_active: number;
            photo_url: string | null;
          }>>(`
            SELECT id, tenant_id, name, role, email, phone, is_active, photo_url
            FROM staff_users
            WHERE id = ? AND is_active = 1
          `, [registration.staffId]);

          if (staffResult.length === 0) {
            throw new Error('Staff member not found or inactive');
          }

          const staff = staffResult[0];

          // Create user object
          const user: StaffUser = {
            id: staff.id,
            name: staff.name,
            role: staff.role as StaffUser['role'],
            tenantId: staff.tenant_id,
            email: staff.email || undefined,
            phone: staff.phone || undefined,
            isActive: staff.is_active === 1,
            photoUrl: staff.photo_url || undefined,
          };

          // Update last login
          await db.execute(`
            UPDATE staff_users
            SET last_login_at = ?
            WHERE id = ?
          `, [Date.now(), user.id]);

          set({
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          console.log('[DeviceAuth] Authentication successful:', user.name);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Authentication failed';
          console.error('[DeviceAuth] Authentication error:', message);
          set({
            error: message,
            isLoading: false,
            isAuthenticated: false,
            currentUser: null,
          });
          throw error;
        }
      },

      // Logout
      logout: () => {
        console.log('[DeviceAuth] Logging out');
        set({
          currentUser: null,
          isAuthenticated: false,
          error: null,
        });
        // Note: Device registration remains
      },

      // Set error
      setError: (error) => {
        set({ error });
      },

      // Check if device needs registration
      needsRegistration: () => {
        return !get().isDeviceRegistered;
      },
    }),
    {
      name: 'device-auth-storage',
      partialize: (state) => ({
        deviceRegistration: state.deviceRegistration,
        isDeviceRegistered: state.isDeviceRegistered,
        // Don't persist auth state, require biometric on each app open
      }),
    }
  )
);

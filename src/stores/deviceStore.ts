import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { LanServerStatus, LanClientStatus } from '../lib/lanSyncService';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

export type DeviceMode = 'owner' | 'pos' | 'kds' | 'bds' | 'aggregator' | 'customer' | 'manager';

interface DeviceState {
    deviceMode: DeviceMode;
    isLocked: boolean;

    // Training Mode (from provisioning)
    isTrainingMode: boolean;

    // LAN Server Role (separate from device mode)
    lanServerEnabled: boolean;

    // Staff Assignment (for auto-attendance)
    assignedStaffId: string | null;

    // LAN Sync Status
    lanServerStatus: LanServerStatus | null;
    lanClientStatus: LanClientStatus | null;
    isLanConnected: boolean;

    // Actions
    setDeviceMode: (mode: DeviceMode) => void;
    setLocked: (locked: boolean) => void;
    setTrainingMode: (enabled: boolean) => void;
    setLanServerEnabled: (enabled: boolean) => Promise<void>;
    setAssignedStaff: (staffId: string | null) => Promise<void>;
    loadDeviceSettings: () => Promise<void>;
    setLanServerStatus: (status: LanServerStatus | null) => void;
    setLanClientStatus: (status: LanClientStatus | null) => void;
    setIsLanConnected: (connected: boolean) => void;

    // Helper methods
    isPOS: () => boolean;
    isKDS: () => boolean;
    isBDS: () => boolean;
    shouldRunLanServer: () => boolean;
    shouldConnectToLanServer: () => boolean;
    canRunLanServer: () => boolean;
    shouldReceiveRealtimeSales: () => boolean;
}

export const useDeviceStore = create<DeviceState>()(
    persist(
        (set, get) => ({
            deviceMode: 'owner',
            isLocked: false,

            // Training Mode
            isTrainingMode: true, // Default to training mode

            // LAN Server Role
            lanServerEnabled: false,

            // Staff Assignment
            assignedStaffId: null,

            // LAN Sync
            lanServerStatus: null,
            lanClientStatus: null,
            isLanConnected: false,

            // Actions
            setDeviceMode: (mode) => set({ deviceMode: mode }),
            setLocked: (locked) => set({ isLocked: locked }),
            setTrainingMode: (enabled) => set({ isTrainingMode: enabled }),
            setLanServerEnabled: async (enabled: boolean) => {
                set({ lanServerEnabled: enabled });

                // Persist to SQLite if in Tauri environment
                try {
                    await invoke('update_lan_server_settings', { enabled });
                } catch (error) {
                    // Silently fail if not in Tauri environment
                    console.debug('[deviceStore] LAN server setting not persisted (not in Tauri):', error);
                }
            },
            setAssignedStaff: async (staffId: string | null) => {
                set({ assignedStaffId: staffId });

                // Persist to database
                try {
                    const Database = (await import('@tauri-apps/plugin-sql')).default;
                    const db = await Database.load(DB_NAME);

                    // Update or insert device settings
                    await db.execute(`
                        INSERT INTO device_settings (id, tenant_id, assigned_staff_id, created_at, updated_at)
                        VALUES ('default', 'default', ?, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
                        ON CONFLICT(id) DO UPDATE SET
                            assigned_staff_id = ?,
                            updated_at = strftime('%s', 'now') * 1000
                    `, [staffId, staffId]);

                    console.log('[deviceStore] Assigned staff updated:', staffId);
                } catch (error) {
                    console.error('[deviceStore] Failed to persist assigned staff:', error);
                }
            },
            loadDeviceSettings: async () => {
                try {
                    const Database = (await import('@tauri-apps/plugin-sql')).default;
                    const db = await Database.load(DB_NAME);

                    const result = await db.select<Array<{
                        assigned_staff_id: string | null;
                        lan_server_enabled: number;
                    }>>('SELECT assigned_staff_id, lan_server_enabled FROM device_settings WHERE id = ?', ['default']);

                    if (result && result.length > 0) {
                        const settings = result[0];
                        set({
                            assignedStaffId: settings.assigned_staff_id || null,
                            lanServerEnabled: settings.lan_server_enabled === 1,
                        });
                        console.log('[deviceStore] Device settings loaded from database');
                    }
                } catch (error) {
                    console.debug('[deviceStore] Failed to load device settings (may not exist yet):', error);
                }
            },
            setLanServerStatus: (status) => set({ lanServerStatus: status }),
            setLanClientStatus: (status) => set({ lanClientStatus: status }),
            setIsLanConnected: (connected) => set({ isLanConnected: connected }),

            // Helper methods
            isPOS: () => get().deviceMode === 'pos',
            isKDS: () => get().deviceMode === 'kds',
            isBDS: () => get().deviceMode === 'bds',

            // LAN server runs when explicitly enabled (not tied to device mode)
            shouldRunLanServer: () => get().lanServerEnabled,

            // KDS/BDS/Manager connect as clients
            shouldConnectToLanServer: () => {
                const mode = get().deviceMode;
                return mode === 'kds' || mode === 'bds' || mode === 'manager';
            },

            // Owner, POS, and Manager devices can run the LAN server
            canRunLanServer: () => {
                const mode = get().deviceMode;
                return mode === 'owner' || mode === 'pos' || mode === 'manager';
            },

            // Check if device should receive real-time sales broadcasts
            shouldReceiveRealtimeSales: () => {
                const mode = get().deviceMode;
                const buildVariant = import.meta.env.VITE_APP_VARIANT;

                // Get user role from auth store
                let userRole: string | undefined;
                try {
                    const { useAuthStore } = require('./authStore');
                    const user = useAuthStore.getState().user;
                    userRole = user?.role;
                } catch (error) {
                    console.debug('[deviceStore] Could not access authStore:', error);
                }

                // Owner build OR Owner/Manager role OR Owner mode
                return (
                    buildVariant === 'owner' ||
                    userRole === 'owner' ||
                    userRole === 'manager' ||
                    mode === 'owner'
                );
            },
        }),
        {
            name: 'device-operational-storage',
            partialize: (state) => ({
                deviceMode: state.deviceMode,
                isLocked: state.isLocked,
                isTrainingMode: state.isTrainingMode,
                lanServerEnabled: state.lanServerEnabled,
                assignedStaffId: state.assignedStaffId,
            }),
        }
    )
);

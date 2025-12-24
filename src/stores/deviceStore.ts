import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LanServerStatus, LanClientStatus } from '../lib/lanSyncService';

export type DeviceMode = 'generic' | 'pos' | 'kds' | 'bds' | 'aggregator' | 'customer' | 'manager';

interface DeviceState {
    deviceMode: DeviceMode;
    isLocked: boolean;

    // LAN Sync Status
    lanServerStatus: LanServerStatus | null;
    lanClientStatus: LanClientStatus | null;
    isLanConnected: boolean;

    // Actions
    setDeviceMode: (mode: DeviceMode) => void;
    setLocked: (locked: boolean) => void;
    setLanServerStatus: (status: LanServerStatus | null) => void;
    setLanClientStatus: (status: LanClientStatus | null) => void;
    setIsLanConnected: (connected: boolean) => void;

    // Helper methods
    isPOS: () => boolean;
    isKDS: () => boolean;
    isBDS: () => boolean;
    shouldRunLanServer: () => boolean;
    shouldConnectToLanServer: () => boolean;
}

export const useDeviceStore = create<DeviceState>()(
    persist(
        (set, get) => ({
            deviceMode: 'generic',
            isLocked: false,

            // LAN Sync
            lanServerStatus: null,
            lanClientStatus: null,
            isLanConnected: false,

            // Actions
            setDeviceMode: (mode) => set({ deviceMode: mode }),
            setLocked: (locked) => set({ isLocked: locked }),
            setLanServerStatus: (status) => set({ lanServerStatus: status }),
            setLanClientStatus: (status) => set({ lanClientStatus: status }),
            setIsLanConnected: (connected) => set({ isLanConnected: connected }),

            // Helper methods
            isPOS: () => get().deviceMode === 'pos',
            isKDS: () => get().deviceMode === 'kds',
            isBDS: () => get().deviceMode === 'bds',

            // POS runs the LAN server
            shouldRunLanServer: () => get().deviceMode === 'pos',

            // KDS/BDS/Manager connect as clients
            shouldConnectToLanServer: () => {
                const mode = get().deviceMode;
                return mode === 'kds' || mode === 'bds' || mode === 'manager';
            },
        }),
        {
            name: 'device-operational-storage',
            partialize: (state) => ({
                deviceMode: state.deviceMode,
                isLocked: state.isLocked,
            }),
        }
    )
);

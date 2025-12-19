import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DeviceMode = 'generic' | 'pos' | 'kds' | 'aggregator' | 'customer';

interface DeviceState {
    deviceMode: DeviceMode;
    isLocked: boolean;

    // Actions
    setDeviceMode: (mode: DeviceMode) => void;
    setLocked: (locked: boolean) => void;
}

export const useDeviceStore = create<DeviceState>()(
    persist(
        (set) => ({
            deviceMode: 'generic',
            isLocked: false,

            setDeviceMode: (mode) => set({ deviceMode: mode }),
            setLocked: (locked) => set({ isLocked: locked }),
        }),
        {
            name: 'device-operational-storage',
        }
    )
);

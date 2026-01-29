/**
 * POS Device Management Store
 * Manages POS device tracking, heartbeats, and status for admin panel
 */

import { create } from 'zustand';
import backendApi from '../lib/backendApi';
import { useTenantStore } from './tenantStore';

export interface POSDevice {
  id: string;
  deviceId: string;
  deviceName: string | null;
  tenantId: string;
  hardwareInfo: Record<string, any> | null;
  ipAddress: string | null;
  status: 'active' | 'suspended' | 'revoked';
  registeredAt: string;
  lastSeenAt: string | null;
  activationCode: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
}

interface POSDeviceState {
  devices: POSDevice[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;

  // Actions
  fetchDevices: (tenantId: string) => Promise<void>;
  sendHeartbeat: (tenantId: string, deviceId: string, metadata?: any) => Promise<void>;
  suspendDevice: (tenantId: string, deviceId: string, reason: string, suspendedBy: string) => Promise<void>;
  revokeDevice: (tenantId: string, deviceId: string, reason: string, revokedBy: string) => Promise<void>;
  reactivateDevice: (tenantId: string, deviceId: string, reactivatedBy: string) => Promise<void>;
  updateDeviceName: (tenantId: string, deviceId: string, newName: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  devices: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,
};

export const usePOSDeviceStore = create<POSDeviceState>((set, get) => ({
  ...initialState,

  fetchDevices: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const devices = await backendApi.listDevices(tenantId);
      set({ devices, isLoading: false, lastFetchedAt: new Date() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch devices';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  sendHeartbeat: async (tenantId: string, deviceId: string, metadata?: any) => {
    try {
      await backendApi.sendDeviceHeartbeat(tenantId, deviceId, metadata);

      // Update last seen timestamp locally
      set((state) => ({
        devices: state.devices.map((device) =>
          device.deviceId === deviceId
            ? { ...device, lastSeenAt: new Date().toISOString() }
            : device
        ),
      }));
    } catch (error) {
      console.error('[POSDeviceStore] Failed to send heartbeat:', error);
      // Don't throw - heartbeat failures should be silent
    }
  },

  suspendDevice: async (tenantId: string, deviceId: string, reason: string, suspendedBy: string) => {
    try {
      await backendApi.suspendDevice(tenantId, deviceId, reason, suspendedBy);

      // Update device status locally
      set((state) => ({
        devices: state.devices.map((device) =>
          device.deviceId === deviceId
            ? {
              ...device,
              status: 'suspended',
              suspendedAt: new Date().toISOString(),
              suspendedBy,
              suspensionReason: reason,
            }
            : device
        ),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to suspend device';
      set({ error: errorMessage });
      throw error;
    }
  },

  revokeDevice: async (tenantId: string, deviceId: string, reason: string, revokedBy: string) => {
    try {
      await backendApi.revokeDevice(tenantId, deviceId, reason, revokedBy);

      // Update device status locally
      set((state) => ({
        devices: state.devices.map((device) =>
          device.deviceId === deviceId
            ? {
              ...device,
              status: 'revoked',
              revokedAt: new Date().toISOString(),
              revokedBy,
              revocationReason: reason,
            }
            : device
        ),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke device';
      set({ error: errorMessage });
      throw error;
    }
  },

  reactivateDevice: async (tenantId: string, deviceId: string, reactivatedBy: string) => {
    try {
      await backendApi.reactivateDevice(tenantId, deviceId, reactivatedBy);

      // Update device status locally
      set((state) => ({
        devices: state.devices.map((device) =>
          device.deviceId === deviceId
            ? {
              ...device,
              status: 'active',
              suspendedAt: null,
              suspendedBy: null,
              suspensionReason: null,
            }
            : device
        ),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reactivate device';
      set({ error: errorMessage });
      throw error;
    }
  },

  updateDeviceName: async (tenantId: string, deviceId: string, newName: string) => {
    try {
      await backendApi.updateDeviceName(tenantId, deviceId, newName);

      // Update device name locally
      set((state) => ({
        devices: state.devices.map((device) =>
          device.deviceId === deviceId
            ? { ...device, deviceName: newName }
            : device
        ),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update device name';
      set({ error: errorMessage });
      throw error;
    }
  },

  refreshDevices: async () => {
    const tenantId = useTenantStore.getState().tenant?.tenantId;
    if (!tenantId) {
      throw new Error('No tenant ID available');
    }
    await get().fetchDevices(tenantId);
  },

  reset: () => set(initialState),
}));

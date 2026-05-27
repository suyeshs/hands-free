import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface NetworkStore {
  localIp: string | null;
  isOnLan: boolean;
  suggestedSubnet: string | null; // e.g. "192.168.1."
  isLoading: boolean;
  refresh: () => Promise<void>;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function subnetPrefix(ip: string): string {
  // Returns "192.168.1." from "192.168.1.42"
  return ip.split('.').slice(0, 3).join('.') + '.';
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  localIp: null,
  isOnLan: false,
  suggestedSubnet: null,
  isLoading: false,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const ip = await invoke<string | null>('get_local_ip');
      if (ip && isPrivateIp(ip)) {
        set({
          localIp: ip,
          isOnLan: true,
          suggestedSubnet: subnetPrefix(ip),
          isLoading: false,
        });
      } else {
        set({ localIp: ip, isOnLan: false, suggestedSubnet: null, isLoading: false });
      }
    } catch {
      set({ localIp: null, isOnLan: false, suggestedSubnet: null, isLoading: false });
    }
  },
}));

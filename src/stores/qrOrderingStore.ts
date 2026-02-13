/**
 * QR Ordering Store
 * Manages cloudflared tunnel state for QR code-based customer ordering
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TunnelStatus = 'offline' | 'starting' | 'online' | 'error';

interface QROrderingStore {
  // Tunnel state
  tunnelUrl: string | null;
  tunnelStatus: TunnelStatus;
  lastTunnelUrl: string | null; // Store last URL for comparison
  tunnelStartedAt: number | null;

  // Actions
  setTunnelUrl: (url: string | null) => void;
  setTunnelStatus: (status: TunnelStatus) => void;
  clearTunnel: () => void;

  // Helpers
  isTunnelActive: () => boolean;
  getTunnelUptime: () => number | null;
}

export const useQROrderingStore = create<QROrderingStore>()((set, get) => ({
      tunnelUrl: null,
      tunnelStatus: 'offline',
      lastTunnelUrl: null,
      tunnelStartedAt: null,

      setTunnelUrl: (url) => {
        const now = Date.now();
        const currentUrl = get().tunnelUrl;

        console.log('[QROrderingStore] Setting tunnel URL:', url);

        set({
          tunnelUrl: url,
          lastTunnelUrl: currentUrl || url, // Save previous URL
          tunnelStatus: url ? 'online' : 'offline',
          tunnelStartedAt: url ? now : null,
        });
      },

      setTunnelStatus: (status) => {
        console.log('[QROrderingStore] Setting tunnel status:', status);
        set({ tunnelStatus: status });
      },

      clearTunnel: () => {
        console.log('[QROrderingStore] Clearing tunnel');
        set({
          tunnelUrl: null,
          tunnelStatus: 'offline',
          tunnelStartedAt: null,
        });
      },

      isTunnelActive: () => {
        const { tunnelUrl, tunnelStatus } = get();
        return tunnelUrl !== null && tunnelStatus === 'online';
      },

      getTunnelUptime: () => {
        const { tunnelStartedAt } = get();
        if (!tunnelStartedAt) return null;
        return Date.now() - tunnelStartedAt;
      },
    }));

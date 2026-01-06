/**
 * Remote Print Store
 * Stores configuration for client devices to print via POS
 * Used by tablets/KDS that don't have direct printer access
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mdnsPrintService, DiscoveredPrintService, PrintResponse } from '../lib/mdnsPrintService';

interface RemotePrintConfig {
  enabled: boolean;
  // Selected POS print service
  posHost: string;
  posPort: number;
  posName: string;
  // Auto-discovered services cache
  discoveredServices: DiscoveredPrintService[];
  lastDiscoveryTime: string | null;
}

interface RemotePrintStore {
  config: RemotePrintConfig;
  isDiscovering: boolean;
  isPrinting: boolean;
  lastPrintResult: PrintResponse | null;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setPosService: (host: string, port: number, name: string) => void;
  clearPosService: () => void;
  discoverServices: () => Promise<DiscoveredPrintService[]>;
  sendBillPrint: (orderId: string) => Promise<PrintResponse>;
  sendKotPrint: (orderId: string) => Promise<PrintResponse>;
}

export const useRemotePrintStore = create<RemotePrintStore>()(
  persist(
    (set, get) => ({
      config: {
        enabled: false,
        posHost: '',
        posPort: 0,
        posName: '',
        discoveredServices: [],
        lastDiscoveryTime: null,
      },
      isDiscovering: false,
      isPrinting: false,
      lastPrintResult: null,

      setEnabled: (enabled) => {
        set((state) => ({
          config: { ...state.config, enabled },
        }));
      },

      setPosService: (host, port, name) => {
        set((state) => ({
          config: {
            ...state.config,
            posHost: host,
            posPort: port,
            posName: name,
          },
        }));
      },

      clearPosService: () => {
        set((state) => ({
          config: {
            ...state.config,
            posHost: '',
            posPort: 0,
            posName: '',
          },
        }));
      },

      discoverServices: async () => {
        set({ isDiscovering: true });
        try {
          const services = await mdnsPrintService.discoverServices(5);
          set((state) => ({
            config: {
              ...state.config,
              discoveredServices: services,
              lastDiscoveryTime: new Date().toISOString(),
            },
            isDiscovering: false,
          }));
          return services;
        } catch (error) {
          console.error('[RemotePrintStore] Discovery failed:', error);
          set({ isDiscovering: false });
          return [];
        }
      },

      sendBillPrint: async (orderId) => {
        const { config } = get();
        if (!config.enabled || !config.posHost || !config.posPort) {
          return {
            success: false,
            message: 'Remote print not configured',
          };
        }

        set({ isPrinting: true });
        try {
          const result = await mdnsPrintService.sendBillPrint(
            config.posHost,
            config.posPort,
            orderId,
            config.posName || 'Client Device'
          );
          set({ isPrinting: false, lastPrintResult: result });
          return result;
        } catch (error) {
          const result = {
            success: false,
            message: error instanceof Error ? error.message : 'Print failed',
          };
          set({ isPrinting: false, lastPrintResult: result });
          return result;
        }
      },

      sendKotPrint: async (orderId) => {
        const { config } = get();
        if (!config.enabled || !config.posHost || !config.posPort) {
          return {
            success: false,
            message: 'Remote print not configured',
          };
        }

        set({ isPrinting: true });
        try {
          const result = await mdnsPrintService.sendKOTPrint(
            config.posHost,
            config.posPort,
            orderId,
            config.posName || 'Client Device'
          );
          set({ isPrinting: false, lastPrintResult: result });
          return result;
        } catch (error) {
          const result = {
            success: false,
            message: error instanceof Error ? error.message : 'Print failed',
          };
          set({ isPrinting: false, lastPrintResult: result });
          return result;
        }
      },
    }),
    {
      name: 'remote-print-config',
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);

/**
 * Helper hook to check if remote print is available
 */
export function useRemotePrintAvailable() {
  const { config } = useRemotePrintStore();
  return config.enabled && config.posHost && config.posPort > 0;
}

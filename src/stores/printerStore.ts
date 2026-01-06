/**
 * Printer Settings Store
 * Manages KOT printer configuration and preferences
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { printerService, PrinterConfig, PrintMode } from '../lib/printerService';

interface PrinterStore {
  // State
  config: PrinterConfig;
  isPrinting: boolean;
  lastPrintedOrderId: string | null;
  printHistory: Array<{
    orderId: string;
    orderNumber: string;
    timestamp: string;
    success: boolean;
  }>;

  // Actions
  updateConfig: (config: Partial<PrinterConfig>) => void;
  setRestaurantName: (name: string) => void;
  setAutoPrint: (enabled: boolean) => void;
  setPrintByStation: (enabled: boolean) => void;
  setPrintMode: (mode: PrintMode) => void;
  setPrinterType: (type: PrinterConfig['printerType']) => void;
  setNetworkPrinterUrl: (url: string) => void;
  setSystemPrinterName: (name: string) => void;
  addPrintHistory: (orderId: string, orderNumber: string, success: boolean) => void;
  clearPrintHistory: () => void;
  setIsPrinting: (printing: boolean) => void;
}

export const usePrinterStore = create<PrinterStore>()(
  persist(
    (set, get) => ({
      // Initial state
      config: {
        restaurantName: 'Restaurant',
        autoPrintOnAccept: true,
        printByStation: false,
        printMode: 'modal', // Default to in-app modal
        printerType: 'browser',
        kotPrinterEnabled: false,
      },
      isPrinting: false,
      lastPrintedOrderId: null,
      printHistory: [],

      // Update entire config
      updateConfig: (config) => {
        set((state) => {
          const newConfig = { ...state.config, ...config };
          // Sync with printer service
          printerService.setConfig(newConfig);
          return { config: newConfig };
        });
      },

      // Set restaurant name
      setRestaurantName: (name) => {
        get().updateConfig({ restaurantName: name });
      },

      // Set auto-print
      setAutoPrint: (enabled) => {
        get().updateConfig({ autoPrintOnAccept: enabled });
      },

      // Set print by station
      setPrintByStation: (enabled) => {
        get().updateConfig({ printByStation: enabled });
      },

      // Set print mode
      setPrintMode: (mode) => {
        get().updateConfig({ printMode: mode });
      },

      // Set printer type
      setPrinterType: (type) => {
        get().updateConfig({ printerType: type });
      },

      // Set network printer URL
      setNetworkPrinterUrl: (url) => {
        get().updateConfig({ networkPrinterUrl: url });
      },

      // Set system printer name
      setSystemPrinterName: (name) => {
        get().updateConfig({ systemPrinterName: name });
      },

      // Add to print history
      addPrintHistory: (orderId, orderNumber, success) => {
        set((state) => ({
          printHistory: [
            {
              orderId,
              orderNumber,
              timestamp: new Date().toISOString(),
              success,
            },
            ...state.printHistory,
          ].slice(0, 50), // Keep last 50
          lastPrintedOrderId: orderId,
        }));
      },

      // Clear print history
      clearPrintHistory: () => {
        set({ printHistory: [], lastPrintedOrderId: null });
      },

      // Set printing state
      setIsPrinting: (printing) => {
        set({ isPrinting: printing });
      },
    }),
    {
      name: 'printer-settings',
      // Only persist config and history, not runtime state
      partialize: (state) => ({
        config: state.config,
        printHistory: state.printHistory,
        lastPrintedOrderId: state.lastPrintedOrderId,
      }),
    }
  )
);

// Initialize printer service with persisted config on app start
const initialConfig = usePrinterStore.getState().config;
printerService.setConfig(initialConfig);

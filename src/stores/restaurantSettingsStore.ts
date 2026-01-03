/**
 * Restaurant Settings Store
 * Manages restaurant details for billing, invoices, and receipts
 *
 * Storage Strategy:
 * - Primary: localStorage (via Zustand persist) for offline access
 * - Sync: D1 cloud storage for multi-device sync
 * - On save: Update local first, then push to cloud
 * - On load: Fetch from cloud, merge with local (cloud wins for shared settings)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { backendApi } from '../lib/backendApi';

export interface RestaurantDetails {
  // Basic Info
  name: string;
  tagline?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  phone: string;
  email?: string;
  website?: string;

  // Legal/Tax Info
  gstNumber?: string;
  fssaiNumber?: string;
  panNumber?: string;
  cinNumber?: string;

  // Invoice Settings
  invoicePrefix: string;
  invoiceStartNumber: number;
  currentInvoiceNumber: number;
  invoiceTerms?: string;
  footerNote?: string;

  // Tax Settings
  taxEnabled: boolean; // When false, no tax is applied (menu price = billing price)
  cgstRate: number; // Central GST rate (e.g., 2.5)
  sgstRate: number; // State GST rate (e.g., 2.5)
  serviceChargeRate: number; // Service charge percentage (e.g., 5)
  serviceChargeEnabled: boolean;
  roundOffEnabled: boolean;
  taxIncludedInPrice: boolean; // When true, menu prices already include tax

  // Print Settings
  printLogo: boolean;
  logoUrl?: string;
  printQRCode: boolean;
  qrCodeUrl?: string;
  paperWidth: '58mm' | '80mm';
  showItemwiseTax: boolean;

  // POS Workflow Settings
  posSettings: {
    requireStaffPinForPOS: boolean;       // Require staff PIN before using POS
    filterTablesByStaffAssignment: boolean; // Only show tables assigned to staff
    pinSessionTimeoutMinutes: number;      // Minutes before PIN re-entry required (0 = no timeout)
  };

  // Device Role - determines if this device can push settings to cloud
  // 'server' = can push settings to cloud (main/admin device)
  // 'client' = read-only, pulls settings from cloud only
  deviceRole: 'server' | 'client';

  // Packing Charges (for pickup/takeout orders)
  packingCharges: {
    enabled: boolean;                     // Enable packing charges for takeout
    chargesByCategory: Record<string, number>; // Category ID/name -> charge per item (₹)
    defaultCharge: number;                // Default charge if category not specified
  };
}

interface PackingChargeItem {
  name: string;
  category: string;
  quantity: number;
  chargePerItem: number;
  totalCharge: number;
}

interface PackingChargesResult {
  items: PackingChargeItem[];
  totalCharge: number;
}

interface RestaurantSettingsStore {
  settings: RestaurantDetails;
  isConfigured: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // Actions
  updateSettings: (settings: Partial<RestaurantDetails>) => void;
  resetSettings: () => void;
  getNextInvoiceNumber: () => string;
  incrementInvoiceNumber: () => void;
  calculateTaxes: (subtotal: number) => {
    cgst: number;
    sgst: number;
    serviceCharge: number;
    total: number;
    roundOff: number;
    grandTotal: number;
    taxIncluded: boolean;
    baseAmount: number;
  };
  // Packing charges calculation
  calculatePackingCharges: (items: Array<{ name: string; category: string; quantity: number }>, orderType: string) => PackingChargesResult;
  // Cloud Sync
  syncFromCloud: (tenantId: string) => Promise<void>;
  syncToCloud: (tenantId: string) => Promise<void>;
}

const defaultSettings: RestaurantDetails = {
  name: 'Restaurant Name',
  tagline: '',
  address: {
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  },
  phone: '',
  email: '',
  website: '',

  gstNumber: '',
  fssaiNumber: '',
  panNumber: '',
  cinNumber: '',

  invoicePrefix: 'INV',
  invoiceStartNumber: 1,
  currentInvoiceNumber: 1,
  invoiceTerms: 'Thank you for dining with us!',
  footerNote: 'This is a computer generated invoice.',

  taxEnabled: true, // Tax enabled by default
  cgstRate: 2.5,
  sgstRate: 2.5,
  serviceChargeRate: 0,
  serviceChargeEnabled: false,
  roundOffEnabled: true,
  taxIncludedInPrice: false,

  printLogo: false,
  logoUrl: '',
  printQRCode: false,
  qrCodeUrl: '',
  paperWidth: '80mm',
  showItemwiseTax: false,

  posSettings: {
    requireStaffPinForPOS: false,
    filterTablesByStaffAssignment: false,
    pinSessionTimeoutMinutes: 0,
  },

  // Default to client - only admin explicitly sets server role
  deviceRole: 'client',

  packingCharges: {
    enabled: false,
    chargesByCategory: {},
    defaultCharge: 5, // ₹5 default per item
  },
};

export const useRestaurantSettingsStore = create<RestaurantSettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isConfigured: false,
      isSyncing: false,
      lastSyncedAt: null,

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
          isConfigured: true,
        }));
      },

      resetSettings: () => {
        set({
          settings: defaultSettings,
          isConfigured: false,
        });
      },

      getNextInvoiceNumber: () => {
        const { settings } = get();
        const paddedNumber = settings.currentInvoiceNumber.toString().padStart(6, '0');
        const today = new Date();
        const dateStr = `${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        return `${settings.invoicePrefix}-${dateStr}-${paddedNumber}`;
      },

      incrementInvoiceNumber: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            currentInvoiceNumber: state.settings.currentInvoiceNumber + 1,
          },
        }));
      },

      calculateTaxes: (subtotal) => {
        const { settings } = get();

        // If tax is disabled, menu price = billing price (no tax applied)
        if (!settings.taxEnabled) {
          // Only service charge applies when tax is disabled
          const serviceCharge = settings.serviceChargeEnabled
            ? (subtotal * settings.serviceChargeRate) / 100
            : 0;

          const total = subtotal + serviceCharge;

          let roundOff = 0;
          let grandTotal = total;
          if (settings.roundOffEnabled) {
            grandTotal = Math.round(total);
            roundOff = grandTotal - total;
          }

          return {
            cgst: 0,
            sgst: 0,
            serviceCharge: Math.round(serviceCharge * 100) / 100,
            total: Math.round(total * 100) / 100,
            roundOff: Math.round(roundOff * 100) / 100,
            grandTotal,
            taxIncluded: false,
            baseAmount: subtotal,
          };
        }

        const totalTaxRate = settings.cgstRate + settings.sgstRate;

        if (settings.taxIncludedInPrice) {
          // Tax is already included in the menu price
          // Back-calculate the base amount and tax components
          const taxMultiplier = 1 + totalTaxRate / 100;
          const baseAmount = subtotal / taxMultiplier;

          // Service charge is calculated on base amount (before tax)
          const serviceCharge = settings.serviceChargeEnabled
            ? (baseAmount * settings.serviceChargeRate) / 100
            : 0;

          // Tax components from the included tax
          const includedTax = subtotal - baseAmount;
          const cgst = includedTax / 2; // Split evenly between CGST and SGST
          const sgst = includedTax / 2;

          // Total is subtotal (which already includes tax) + service charge
          const total = subtotal + serviceCharge;

          // Round off
          let roundOff = 0;
          let grandTotal = total;
          if (settings.roundOffEnabled) {
            grandTotal = Math.round(total);
            roundOff = grandTotal - total;
          }

          return {
            cgst: Math.round(cgst * 100) / 100,
            sgst: Math.round(sgst * 100) / 100,
            serviceCharge: Math.round(serviceCharge * 100) / 100,
            total: Math.round(total * 100) / 100,
            roundOff: Math.round(roundOff * 100) / 100,
            grandTotal,
            taxIncluded: true,
            baseAmount: Math.round(baseAmount * 100) / 100,
          };
        }

        // Tax is NOT included in price (add tax to subtotal)
        // Calculate service charge if enabled
        const serviceCharge = settings.serviceChargeEnabled
          ? (subtotal * settings.serviceChargeRate) / 100
          : 0;

        // Calculate GST on subtotal + service charge
        const taxableAmount = subtotal + serviceCharge;
        const cgst = (taxableAmount * settings.cgstRate) / 100;
        const sgst = (taxableAmount * settings.sgstRate) / 100;

        const total = subtotal + serviceCharge + cgst + sgst;

        // Round off
        let roundOff = 0;
        let grandTotal = total;
        if (settings.roundOffEnabled) {
          grandTotal = Math.round(total);
          roundOff = grandTotal - total;
        }

        return {
          cgst: Math.round(cgst * 100) / 100,
          sgst: Math.round(sgst * 100) / 100,
          serviceCharge: Math.round(serviceCharge * 100) / 100,
          total: Math.round(total * 100) / 100,
          roundOff: Math.round(roundOff * 100) / 100,
          grandTotal,
          taxIncluded: false,
          baseAmount: subtotal,
        };
      },

      // Calculate packing charges for pickup/takeout orders
      calculatePackingCharges: (items, orderType) => {
        const { settings } = get();
        const packingConfig = settings.packingCharges;

        // Only apply for takeout orders when enabled
        if (!packingConfig?.enabled || orderType !== 'takeout') {
          return { items: [], totalCharge: 0 };
        }

        const chargeItems: PackingChargeItem[] = [];
        let totalCharge = 0;

        for (const item of items) {
          // Look up charge by category (case-insensitive match)
          const categoryLower = (item.category || '').toLowerCase();
          let chargePerItem = packingConfig.defaultCharge || 0;

          // Check if there's a specific charge for this category
          for (const [cat, charge] of Object.entries(packingConfig.chargesByCategory || {})) {
            if (cat.toLowerCase() === categoryLower) {
              chargePerItem = charge;
              break;
            }
          }

          if (chargePerItem > 0) {
            const itemTotal = chargePerItem * item.quantity;
            chargeItems.push({
              name: item.name,
              category: item.category,
              quantity: item.quantity,
              chargePerItem,
              totalCharge: itemTotal,
            });
            totalCharge += itemTotal;
          }
        }

        return {
          items: chargeItems,
          totalCharge: Math.round(totalCharge * 100) / 100,
        };
      },

      // Cloud Sync: Fetch settings from cloud and merge
      syncFromCloud: async (tenantId: string) => {
        if (!tenantId) {
          console.warn('[RestaurantSettings] No tenantId provided for cloud sync');
          return;
        }

        set({ isSyncing: true });

        try {
          console.log('[RestaurantSettings] Fetching settings from cloud...');
          const cloudSettings = await backendApi.getRestaurantSettings(tenantId);

          if (cloudSettings) {
            console.log('[RestaurantSettings] Cloud settings found, merging...');
            // Cloud settings take precedence for shared settings
            // But preserve local-only settings like currentInvoiceNumber if higher
            const localSettings = get().settings;
            const mergedSettings = {
              ...localSettings,
              ...cloudSettings,
              // Keep the higher invoice number to avoid duplicates
              currentInvoiceNumber: Math.max(
                localSettings.currentInvoiceNumber || 1,
                cloudSettings.currentInvoiceNumber || 1
              ),
            };

            set({
              settings: mergedSettings,
              isConfigured: true,
              lastSyncedAt: new Date().toISOString(),
            });
            console.log('[RestaurantSettings] Merged cloud settings successfully');
          } else {
            console.log('[RestaurantSettings] No cloud settings found');
          }
        } catch (error) {
          console.error('[RestaurantSettings] Failed to sync from cloud:', error);
        } finally {
          set({ isSyncing: false });
        }
      },

      // Cloud Sync: Push settings to cloud
      syncToCloud: async (tenantId: string) => {
        if (!tenantId) {
          console.warn('[RestaurantSettings] No tenantId provided for cloud sync');
          return;
        }

        set({ isSyncing: true });

        try {
          const settings = get().settings;
          console.log('[RestaurantSettings] Pushing settings to cloud...');
          await backendApi.saveRestaurantSettings(tenantId, settings);
          set({ lastSyncedAt: new Date().toISOString() });
          console.log('[RestaurantSettings] Settings synced to cloud successfully');
        } catch (error) {
          console.error('[RestaurantSettings] Failed to sync to cloud:', error);
          // Don't throw - local save already succeeded
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'restaurant-settings',
      partialize: (state) => ({
        settings: state.settings,
        isConfigured: state.isConfigured,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);

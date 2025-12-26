/**
 * Restaurant Settings Store
 * Manages restaurant details for billing, invoices, and receipts
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  cgstRate: number; // Central GST rate (e.g., 2.5)
  sgstRate: number; // State GST rate (e.g., 2.5)
  serviceChargeRate: number; // Service charge percentage (e.g., 5)
  serviceChargeEnabled: boolean;
  roundOffEnabled: boolean;

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
}

interface RestaurantSettingsStore {
  settings: RestaurantDetails;
  isConfigured: boolean;

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
  };
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

  cgstRate: 2.5,
  sgstRate: 2.5,
  serviceChargeRate: 0,
  serviceChargeEnabled: false,
  roundOffEnabled: true,

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
};

export const useRestaurantSettingsStore = create<RestaurantSettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isConfigured: false,

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
        };
      },
    }),
    {
      name: 'restaurant-settings',
      partialize: (state) => ({
        settings: state.settings,
        isConfigured: state.isConfigured,
      }),
    }
  )
);

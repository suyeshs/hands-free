/**
 * Restaurant Settings Store
 * Manages restaurant details for billing, invoices, and receipts
 *
 * Storage Strategy:
 * - Primary: SQLite (via Tauri) for reliable persistent storage
 * - Cache: Zustand in-memory for fast reads
 * - Sync: D1 cloud storage for multi-device sync
 * - On save: Update SQLite first, then push to cloud
 * - On load: Fetch from SQLite, then sync from cloud
 */

import { create } from 'zustand';
import { backendApi } from '../lib/backendApi';
import { getRestaurantSettings, saveRestaurantSettings } from '../services/tauriSettings';
import { isTauri } from '../lib/platform';
import { RestaurantType, RestaurantFeatures, OperationalScale, getFeaturePreset, getRestaurantTypeConfig } from '../types/restaurantTypes';

// GUARDS: Prevent infinite loops
let isUpdatingSettings = false; // Guard for save operations
let isLoadingSettings = false;  // Guard for load operations

export interface RestaurantDetails {
  // Restaurant Type & Scale
  restaurantType: RestaurantType;
  operationalScale: OperationalScale;

  // Basic Info
  name: string;
  ownerName?: string;
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

  // Legal/Tax Info (Dynamic - based on country)
  countryCode: string; // ISO 3166-1 alpha-2 country code (e.g., 'IN', 'US', 'GB', 'FR')
  taxSystemName?: string; // e.g., 'GST', 'VAT', 'Sales Tax', 'TVA'
  taxIdFields?: Record<string, string>; // Dynamic tax ID fields (e.g., { gst_number: '...', siren: '...', vat_number: '...' })

  // Invoice Settings
  invoicePrefix: string;
  invoiceStartNumber: number;
  currentInvoiceNumber: number;
  invoiceTerms?: string;
  footerNote?: string;

  // Tax Settings (Dynamic - based on country)
  taxEnabled: boolean; // When false, no tax is applied (menu price = billing price)
  taxRate?: number; // Standard tax rate from tax nomenclature (e.g., 20 for FR VAT, 10 for AU GST)

  // India-specific tax rates (for backward compatibility and India's split GST system)
  cgstRate?: number; // Central GST rate (India only)
  sgstRate?: number; // State GST rate (India only)

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
    theme: 'dark' | 'light';              // POS Dashboard color theme
    brightness: number;                   // Brightness level 0-100 (0=light, 100=dark, auto-adjusts for ambience)
    borderStyle: 'rounded' | 'sharp' | 'auto'; // Border radius style ('auto' follows brightness)
    activateOnline: boolean;              // MASTER TOGGLE: Enable all online features and cloud sync (default: false)
    enableInventorySync: boolean;         // Enable automatic inventory sync with cloud (requires activateOnline)
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

  // Feature Flags (based on restaurant type)
  features: RestaurantFeatures;

  // Online Presence Configuration
  onlinePresence: {
    themePreset: string;           // Selected theme ID
    themeFamily: string;           // Theme family
    customDomain?: string | null;  // Custom domain (optional, for future use)
    subdomain: string;             // Tenant subdomain (READ-ONLY, set during provisioning)
    themeConfig: {                 // Custom theme overrides
      // Colors
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      textPrimaryColor?: string;
      textSecondaryColor?: string;

      // Background
      backgroundType?: 'solid' | 'gradient' | 'image';
      backgroundGradientStart?: string;
      backgroundGradientEnd?: string;
      backgroundGradientDirection?: 'vertical' | 'horizontal' | 'diagonal';
      backgroundImageUrl?: string;
      backgroundImageOverlay?: number; // 0-100 opacity
      backgroundPattern?: 'none' | 'texture' | 'geometric';

      // Card Styles
      cardBorderRadius?: number;     // 0-24px
      cardShadow?: 'none' | 'subtle' | 'medium' | 'strong';
      cardBorder?: 'none' | 'thin' | 'medium' | 'thick';
      cardOpacity?: number;          // 0-100
      cardHoverEffect?: 'none' | 'lift' | 'glow' | 'scale';

      // Logo
      logoUrl?: string;
      logoSize?: 'small' | 'medium' | 'large';
      logoPosition?: 'left' | 'center' | 'right';

      // Banner
      bannerImage?: string;
      bannerOverlayColor?: string;
      bannerOverlayOpacity?: number; // 0-100
      bannerTextColor?: string;

      // Typography
      headingFont?: string;
      bodyFont?: string;
      fontScale?: 'compact' | 'normal' | 'large';
    };
    enabled: boolean;              // Master toggle for online presence
    lastUpdated: string;
  };

  // WiFi & Attendance Settings
  restaurant_wifi_ssid?: string;    // Comma-separated list of allowed WiFi SSIDs
  wifi_check_enabled?: number;      // 0 = disabled, 1 = enabled (SQLite boolean)
  auto_attendance_enabled?: number; // 0 = disabled, 1 = enabled (auto clock-in on WiFi connect)
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
  isLoading: boolean;
  lastSyncedAt: string | null;

  // Actions
  loadFromSQLite: () => Promise<void>;
  updateSettings: (settings: Partial<RestaurantDetails>) => Promise<void>;
  setRestaurantType: (type: RestaurantType) => Promise<void>;
  resetSettings: () => void;
  getNextInvoiceNumber: () => string;
  incrementInvoiceNumber: () => Promise<void>;
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
  // Online Presence
  updateOnlinePresence: (config: Partial<RestaurantDetails['onlinePresence']>) => Promise<void>;
}

const defaultSettings: RestaurantDetails = {
  // Restaurant Type & Scale - defaults to full-service single location
  restaurantType: RestaurantType.FULL_SERVICE,
  operationalScale: OperationalScale.SINGLE_LOCATION,

  name: 'Restaurant Name',
  ownerName: '',
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
    theme: 'dark',
    brightness: 0, // 0 = light mode, 100 = full dark mode
    borderStyle: 'auto', // Auto-adjust based on brightness/theme
    activateOnline: false, // MASTER TOGGLE: Disabled by default - POS works fully offline
    enableInventorySync: false, // Sub-toggle for inventory sync (requires activateOnline)
  },

  // Default to client - only admin explicitly sets server role
  deviceRole: 'client',

  packingCharges: {
    enabled: false,
    chargesByCategory: {},
    defaultCharge: 5, // ₹5 default per item
  },

  // Default features for full-service restaurant
  features: {
    tableService: true,
    takeawayOrders: true,
    dineIn: true,
    delivery: true,
    onlineOrders: true,
    aggregatorIntegration: true,
    qrOrdering: true,
    barManagement: false,
    chainManagement: false,
    kitchenDisplay: true,
    inventoryManagement: true,
    staffManagement: true,
    customerManagement: true,
    advancedReports: true,
    multiCurrencySupport: false,
  },

  // Default online presence configuration
  onlinePresence: {
    themePreset: 'universal-restaurant',
    themeFamily: 'multimodal-restaurant',
    customDomain: null,
    subdomain: '', // Will be populated from tenantStore
    themeConfig: {
      primaryColor: '#2563EB',
      secondaryColor: '#64748B',
      accentColor: '#3B82F6',
      backgroundColor: '#FFFFFF',
      textPrimaryColor: '#1F2937',
      textSecondaryColor: '#6B7280',
      backgroundType: 'solid',
      cardBorderRadius: 12,
      cardShadow: 'subtle',
      cardBorder: 'none',
      cardOpacity: 100,
      cardHoverEffect: 'lift',
      logoSize: 'medium',
      logoPosition: 'left',
      headingFont: 'inter',
      bodyFont: 'inter',
      fontScale: 'normal',
    },
    enabled: false,
    lastUpdated: new Date().toISOString(),
  },
};

export const useRestaurantSettingsStore = create<RestaurantSettingsStore>()((set, get) => ({
  settings: defaultSettings,
  isConfigured: false,
  isSyncing: false,
  isLoading: false,
  lastSyncedAt: null,

  // Load settings from SQLite on app startup
  loadFromSQLite: async () => {
    if (!isTauri()) {
      return;
    }

    // GUARD: Prevent infinite loop
    if (isLoadingSettings) {
      console.debug('[RestaurantSettings] Already loading, ignoring duplicate call');
      return;
    }

    isLoadingSettings = true;

    try {
      set({ isLoading: true });
      const settings = await getRestaurantSettings();

      // REMOVED: Tenant initialization logic
      // Restaurant settings are now completely independent from tenant settings
      // Tenant name should be set ONLY during initial tenant provisioning, not on every load

      // CRITICAL: Ensure all required fields have valid values
      // Fix for invoice generation - currentInvoiceNumber must be a number
      const validatedSettings = {
        ...settings,
        currentInvoiceNumber: settings.currentInvoiceNumber ?? 1,
        invoiceStartNumber: settings.invoiceStartNumber ?? 1,
        invoicePrefix: settings.invoicePrefix || 'INV',
      };

      console.debug(`[RestaurantSettings] Validated settings ownerName:`, validatedSettings.ownerName);
      console.debug(`[RestaurantSettings] 🏠 ADDRESS IN VALIDATED SETTINGS:`, validatedSettings.address);

      set({
        settings: validatedSettings,
        isConfigured: true,
        isLoading: false,
      });

      console.debug(`[RestaurantSettings] Settings loaded from SQLite successfully`);
      console.debug(`[RestaurantSettings] 📦 ADDRESS IN STORE AFTER SET:`, get().settings.address);
    } catch (error) {
      // On fresh install, table might not exist yet - this is expected
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('no such table')) {
        console.debug(`[RestaurantSettings] Settings table not found (expected on fresh install)`);
      } else {
        console.error(`[RestaurantSettings] Load failed:`, error);
      }
      set({ isLoading: false });
    } finally {
      // ALWAYS release the guard, even if there's an error
      isLoadingSettings = false;
    }
  },

  // Update settings (saves to SQLite)
  updateSettings: async (newSettings) => {
    const updateId = `update-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    // Reduced verbosity - only log important events, not every call
    console.debug(`[RestaurantSettings] updateSettings called (${updateId})`);

    // GUARD: Prevent infinite loop
    if (isUpdatingSettings) {
      console.warn(`[RestaurantSettings] Already updating, ignoring duplicate call`);
      return;
    }

    isUpdatingSettings = true;

    try {
      const currentSettings = get().settings;
      // Deep merge for nested objects like address and posSettings
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
        // Ensure address object is properly merged
        address: newSettings.address
          ? { ...currentSettings.address, ...newSettings.address }
          : currentSettings.address,
        // Ensure posSettings object is properly merged
        posSettings: newSettings.posSettings
          ? { ...currentSettings.posSettings, ...newSettings.posSettings }
          : currentSettings.posSettings,
        // Ensure packingCharges object is properly merged
        packingCharges: newSettings.packingCharges
          ? { ...currentSettings.packingCharges, ...newSettings.packingCharges }
          : currentSettings.packingCharges,
        // Ensure features object is properly merged
        features: newSettings.features
          ? { ...currentSettings.features, ...newSettings.features }
          : currentSettings.features,
        // Ensure onlinePresence object is properly merged
        onlinePresence: newSettings.onlinePresence
          ? {
              ...currentSettings.onlinePresence,
              ...newSettings.onlinePresence,
              // Deep merge themeConfig
              themeConfig: newSettings.onlinePresence.themeConfig
                ? { ...currentSettings.onlinePresence.themeConfig, ...newSettings.onlinePresence.themeConfig }
                : currentSettings.onlinePresence.themeConfig,
            }
          : currentSettings.onlinePresence,
      };

      // CRITICAL: Prevent infinite loop by checking if incoming settings are truly empty/meaningless
      // Check the INCOMING settings, not the merged result
      const incomingHasData = Object.keys(newSettings).length > 0 && (
        (newSettings.name && newSettings.name !== 'Restaurant Name') ||
        newSettings.phone ||
        newSettings.address?.line1 ||
        newSettings.address?.city ||
        newSettings.taxEnabled !== undefined ||
        newSettings.invoicePrefix ||
        newSettings.gstNumber ||
        newSettings.fssaiNumber
      );

      // Only block if incoming settings are completely empty OR if it would result in clearing valid data
      if (!incomingHasData && (!currentSettings.name || currentSettings.name === 'Restaurant Name')) {
        console.warn(`[RestaurantSettings] Blocked empty data save to prevent infinite loop`);
        isUpdatingSettings = false; // Release guard immediately
        return;
      }

      // Update in-memory cache first (optimistic update)
      set({
        settings: updatedSettings,
        isConfigured: true,
      });

      // Save to SQLite if in Tauri
      if (isTauri()) {
        try {
          await saveRestaurantSettings(updatedSettings);
          console.debug(`[RestaurantSettings] Settings saved to SQLite`);
        } catch (error) {
          console.error(`[RestaurantSettings] Save failed:`, error);
          // Rollback optimistic update on error
          set({ settings: get().settings });
        }
      }
    } finally {
      // ALWAYS release the guard, even if there's an error
      isUpdatingSettings = false;
    }
  },

  // Set restaurant type and apply feature preset
  setRestaurantType: async (type: RestaurantType) => {
    console.log(`[RestaurantSettings] Setting restaurant type to: ${type}`);

    const config = getRestaurantTypeConfig(type);
    const featurePreset = getFeaturePreset(type);

    const currentSettings = get().settings;
    const updatedSettings: RestaurantDetails = {
      ...currentSettings,
      restaurantType: type,
      operationalScale: config.defaultScale,
      features: featurePreset,
    };

    // Update using the main updateSettings method to ensure proper saving
    await get().updateSettings(updatedSettings);

    console.log(`[RestaurantSettings] Restaurant type set successfully with preset features`);
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

  incrementInvoiceNumber: async () => {
    const updatedSettings = {
      ...get().settings,
      currentInvoiceNumber: get().settings.currentInvoiceNumber + 1,
    };

    // Update in-memory cache
    set({ settings: updatedSettings });

    // Save to SQLite if in Tauri
    if (isTauri()) {
      try {
        await saveRestaurantSettings(updatedSettings);
        console.log('[RestaurantSettings] Invoice number incremented in SQLite');
      } catch (error) {
        console.error('[RestaurantSettings] Failed to increment invoice number in SQLite:', error);
      }
    }
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

    // GUARD: MASTER TOGGLE - Don't sync if online features are disabled
    const { settings } = get();
    const onlineEnabled = settings.posSettings?.activateOnline ?? false;
    if (!onlineEnabled) {
      console.log('[RestaurantSettings] Online features disabled, skipping cloud sync from cloud');
      return;
    }

    set({ isSyncing: true });

    try {
      console.log('[RestaurantSettings] Fetching settings from cloud...');
      const cloudSettings = await backendApi.getRestaurantSettings(tenantId);

      // SAFEGUARD: Check if cloud has actual settings data
      const hasCloudData = cloudSettings && Object.keys(cloudSettings).length > 0 && cloudSettings.name;

      if (!hasCloudData) {
        console.warn('[RestaurantSettings] ⚠️ Cloud has no settings, keeping local settings');
        const localSettings = get().settings;
        const hasLocalData = localSettings.name && localSettings.name !== 'Restaurant Name';

        if (hasLocalData) {
          console.warn('[RestaurantSettings] Pushing local settings to cloud instead...');
          await get().syncToCloud(tenantId);
        }

        set({ lastSyncedAt: new Date().toISOString(), isSyncing: false });
        return;
      }

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

    // GUARD: MASTER TOGGLE - Don't sync if online features are disabled
    const settings = get().settings;
    const onlineEnabled = settings.posSettings?.activateOnline ?? false;
    if (!onlineEnabled) {
      console.log('[RestaurantSettings] Online features disabled, skipping cloud sync to cloud');
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

  // Update online presence configuration
  updateOnlinePresence: async (config) => {
    const currentSettings = get().settings;
    const updatedOnlinePresence = {
      ...currentSettings.onlinePresence,
      ...config,
      // Deep merge themeConfig if provided
      themeConfig: config.themeConfig
        ? { ...currentSettings.onlinePresence.themeConfig, ...config.themeConfig }
        : currentSettings.onlinePresence.themeConfig,
      lastUpdated: new Date().toISOString(),
    };

    // Update settings with new online presence config
    await get().updateSettings({ onlinePresence: updatedOnlinePresence });
  },
}));

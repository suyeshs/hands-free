/**
 * Tauri Restaurant Settings Service
 * Calls Rust commands to save/load restaurant settings from SQLite
 */

import { invoke } from '@tauri-apps/api/core';
import type { RestaurantDetails } from '../stores/restaurantSettingsStore';

/**
 * Get restaurant settings from SQLite (Tauri backend)
 */
export async function getRestaurantSettings(): Promise<RestaurantDetails> {
  try {
    const settings = await invoke<any>('get_restaurant_settings');

    console.log('[TauriSettings] Raw settings from Rust:', settings);
    console.log('[TauriSettings] ownerName from Rust:', settings.ownerName);
    console.log('[TauriSettings] 🏠 ADDRESS DATA FROM RUST:');
    console.log('[TauriSettings]   addressLine1:', settings.addressLine1);
    console.log('[TauriSettings]   addressLine2:', settings.addressLine2);
    console.log('[TauriSettings]   city:', settings.city);
    console.log('[TauriSettings]   state:', settings.state);
    console.log('[TauriSettings]   pincode:', settings.pincode);

    // Rust sends camelCase (due to #[serde(rename_all = "camelCase")])
    const mappedSettings = {
      restaurantType: settings.restaurantType || 'full-service',
      operationalScale: settings.operationalScale || 'single-location',
      name: settings.name,
      tagline: settings.tagline || undefined,
      ownerName: settings.ownerName || undefined,
      address: {
        line1: settings.addressLine1,
        line2: settings.addressLine2 || undefined,
        city: settings.city,
        state: settings.state,
        pincode: settings.pincode,
      },
      phone: settings.phone,
      email: settings.email || undefined,
      website: settings.website || undefined,

      gstNumber: settings.gstNumber || undefined,
      fssaiNumber: settings.fssaiNumber || undefined,
      panNumber: settings.panNumber || undefined,
      cinNumber: settings.cinNumber || undefined,

      invoicePrefix: settings.invoicePrefix,
      invoiceStartNumber: settings.invoiceStartNumber,
      currentInvoiceNumber: settings.currentInvoiceNumber,
      invoiceTerms: settings.invoiceTerms || undefined,
      footerNote: settings.footerNote || undefined,

      taxEnabled: settings.taxEnabled,
      cgstRate: settings.cgstRate,
      sgstRate: settings.sgstRate,
      serviceChargeRate: settings.serviceChargeRate,
      serviceChargeEnabled: settings.serviceChargeEnabled,
      roundOffEnabled: settings.roundOffEnabled,
      taxIncludedInPrice: settings.taxIncludedInPrice,

      printLogo: settings.printLogo,
      logoUrl: settings.logoUrl || undefined,
      printQRCode: settings.printQrCode,
      qrCodeUrl: settings.qrCodeUrl || undefined,
      paperWidth: settings.paperWidth as '58mm' | '80mm',
      showItemwiseTax: settings.showItemwiseTax,

      posSettings: {
        requireStaffPinForPOS: settings.requireStaffPinForPos,
        filterTablesByStaffAssignment: settings.filterTablesByStaffAssignment,
        pinSessionTimeoutMinutes: settings.pinSessionTimeoutMinutes,
        theme: settings.theme as 'dark' | 'light',
        brightness: 0, // Not persisted, defaults to 0
        borderStyle: (settings as any).borderStyle as 'rounded' | 'sharp' | 'auto' || 'auto',
        activateOnline: settings.activateOnline ?? false,
        enableInventorySync: settings.enableInventorySync ?? false,
      },

      deviceRole: settings.deviceRole as 'server' | 'client',

      packingCharges: {
        enabled: settings.packingChargesEnabled,
        chargesByCategory: settings.packingChargesByCategory
          ? JSON.parse(settings.packingChargesByCategory)
          : {},
        defaultCharge: settings.packingChargesDefault,
      },

      features: {
        tableService: true,
        takeawayOrders: true,
        dineIn: true,
        delivery: false,
        onlineOrders: false,
        aggregatorIntegration: false,
        qrOrdering: false,
        barManagement: false,
        chainManagement: false,
        kitchenDisplay: false,
        inventoryManagement: false,
        staffManagement: false,
        customerManagement: false,
        advancedReports: false,
        multiCurrencySupport: false,
      },

      onlinePresence: settings.onlinePresenceJson
        ? JSON.parse(settings.onlinePresenceJson)
        : {
            themePreset: 'universal-restaurant',
            themeFamily: 'multimodal-restaurant',
            subdomain: '',
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

    console.log('[TauriSettings] 📦 MAPPED ADDRESS OBJECT:', mappedSettings.address);
    console.log('[TauriSettings] ✅ Returning mapped settings to store');

    return mappedSettings;
  } catch (error) {
    console.error('[TauriSettings] Failed to get settings from SQLite:', error);
    throw error;
  }
}

/**
 * Save restaurant settings to SQLite (Tauri backend)
 */
export async function saveRestaurantSettings(settings: RestaurantDetails): Promise<void> {
  try {
    console.log('[TauriSettings] ===== SAVING SETTINGS TO SQLITE =====');
    console.log('[TauriSettings] Settings to save:', settings);
    console.log('[TauriSettings] Address object:', settings.address);
    console.log('[TauriSettings] Phone:', settings.phone);

    // Convert to camelCase for Rust (Rust struct uses #[serde(rename_all = "camelCase")])
    // Also ensure all required fields have defaults
    const rustSettings = {
      restaurantType: settings.restaurantType || 'full-service',
      operationalScale: settings.operationalScale || 'single-location',
      name: settings.name || 'Restaurant Name',
      ownerName: settings.ownerName || '',
      tagline: settings.tagline || '',
      addressLine1: settings.address?.line1 || '',
      addressLine2: settings.address?.line2 || '',
      city: settings.address?.city || '',
      state: settings.address?.state || '',
      pincode: settings.address?.pincode || '',
      phone: settings.phone || '',
      email: settings.email || '',
      website: settings.website || '',

      gstNumber: settings.gstNumber || '',
      fssaiNumber: settings.fssaiNumber || '',
      panNumber: settings.panNumber || '',
      cinNumber: settings.cinNumber || '',

      invoicePrefix: settings.invoicePrefix || 'INV',
      invoiceStartNumber: settings.invoiceStartNumber || 1,
      currentInvoiceNumber: settings.currentInvoiceNumber || 1,
      invoiceTerms: settings.invoiceTerms || '',
      footerNote: settings.footerNote || '',

      taxEnabled: settings.taxEnabled ?? true,
      cgstRate: settings.cgstRate ?? 2.5,
      sgstRate: settings.sgstRate ?? 2.5,
      serviceChargeRate: settings.serviceChargeRate ?? 0,
      serviceChargeEnabled: settings.serviceChargeEnabled ?? false,
      roundOffEnabled: settings.roundOffEnabled ?? true,
      taxIncludedInPrice: settings.taxIncludedInPrice ?? false,

      printLogo: settings.printLogo ?? false,
      logoUrl: settings.logoUrl || '',
      printQrCode: settings.printQRCode ?? false,
      qrCodeUrl: settings.qrCodeUrl || '',
      paperWidth: settings.paperWidth || '80mm',
      showItemwiseTax: settings.showItemwiseTax ?? false,

      requireStaffPinForPos: settings.posSettings?.requireStaffPinForPOS ?? false,
      filterTablesByStaffAssignment: settings.posSettings?.filterTablesByStaffAssignment ?? false,
      pinSessionTimeoutMinutes: settings.posSettings?.pinSessionTimeoutMinutes ?? 0,
      theme: settings.posSettings?.theme || 'dark',
      activateOnline: settings.posSettings?.activateOnline ?? false,
      enableInventorySync: settings.posSettings?.enableInventorySync ?? false,

      deviceRole: settings.deviceRole || 'client',

      packingChargesEnabled: settings.packingCharges?.enabled ?? false,
      packingChargesByCategory: JSON.stringify(settings.packingCharges?.chargesByCategory || {}),
      packingChargesDefault: settings.packingCharges?.defaultCharge ?? 5,
      onlinePresenceJson: JSON.stringify(settings.onlinePresence),
    };

    console.log('[TauriSettings] Calling Rust command save_restaurant_settings...');
    console.log('[TauriSettings] Rust settings:', rustSettings);

    await invoke('save_restaurant_settings', { settings: rustSettings });
    console.log('[TauriSettings] ✅ Settings saved to SQLite successfully');
  } catch (error: any) {
    console.error('[TauriSettings] ❌ Failed to save settings to SQLite:', error);
    console.error('[TauriSettings] Error message:', error?.message || 'Unknown error');
    console.error('[TauriSettings] Error details:', error);
    throw error;
  }
}

/**
 * Setup Wizard Store
 * Manages the OS-style first-time setup wizard flow
 */

import { create } from 'zustand';
import { useRestaurantSettingsStore, RestaurantDetails } from './restaurantSettingsStore';
import { useMenuStore } from './menuStore';
import { useFloorPlanStore } from './floorPlanStore';
import { useStaffStore } from './staffStore';
import { useProvisioningStore } from './provisioningStore';
import { useTenantStore } from './tenantStore';
import { isTauri } from '../lib/platform';
import {
  getSetupWizardState,
  saveSetupWizardState as saveTauriWizardState,
  resetSetupWizardState as resetTauriWizardState,
} from '../services/tauriSetupWizard';

// NOTE: invokeWithTimeout removed - using SQLite service functions instead

// Setup screens in the wizard
export type SetupScreen =
  | 'welcome'
  | 'restaurant_basics'
  | 'legal_info'
  | 'tax_config'
  | 'optional_selector'
  | 'menu_setup'
  | 'floor_plan'
  | 'staff_setup'
  | 'printer_setup'
  | 'invoice_config'
  | 'training_mode'
  | 'system_check'
  | 'completion';

// Required screens that must be completed
export const REQUIRED_SCREENS: SetupScreen[] = [
  'welcome',
  'restaurant_basics',
  'tax_config',
  'training_mode',
  'system_check',
  'completion',
];

// Screen order for navigation
export const SCREEN_ORDER: SetupScreen[] = [
  'welcome',
  'restaurant_basics',
  'legal_info',
  'tax_config',
  'optional_selector',
  'menu_setup',
  'floor_plan',
  'staff_setup',
  'printer_setup',
  'invoice_config',
  'training_mode',
  'system_check',
  'completion',
];

// Screen labels for UI display
export const SCREEN_LABELS: Record<SetupScreen, string> = {
  welcome: 'Welcome',
  restaurant_basics: 'Restaurant Info',
  legal_info: 'Legal & Tax IDs',
  tax_config: 'Tax Settings',
  optional_selector: 'Optional Setup',
  menu_setup: 'Menu',
  floor_plan: 'Floor Plan',
  staff_setup: 'Staff',
  printer_setup: 'Printers',
  invoice_config: 'Invoices',
  training_mode: 'Mode Selection',
  system_check: 'System Check',
  completion: 'Complete',
};

// Optional setup items users can choose
export type OptionalSetupItem =
  | 'menu_setup'
  | 'floor_plan'
  | 'staff_setup'
  | 'printer_setup'
  | 'invoice_config';

export const OPTIONAL_SETUP_ITEMS: OptionalSetupItem[] = [
  'menu_setup',
  'floor_plan',
  'staff_setup',
  'printer_setup',
  'invoice_config',
];

export const OPTIONAL_SETUP_LABELS: Record<
  OptionalSetupItem,
  { title: string; description: string; icon: string }
> = {
  menu_setup: {
    title: 'Menu',
    description: 'Upload your menu or add items manually',
    icon: '📋',
  },
  floor_plan: {
    title: 'Floor Plan',
    description: 'Set up sections and tables for dine-in',
    icon: '🗺️',
  },
  staff_setup: {
    title: 'Staff Members',
    description: 'Add team members and assign roles',
    icon: '👥',
  },
  printer_setup: {
    title: 'Printers',
    description: 'Configure receipt and KOT printers',
    icon: '🖨️',
  },
  invoice_config: {
    title: 'Invoice Settings',
    description: 'Customize invoice numbers and terms',
    icon: '🧾',
  },
};

// Tax mode options
export type TaxMode = 'simple' | 'gst';

interface TaxSettings {
  mode: TaxMode;
  cgstRate: number;
  sgstRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  taxIncludedInPrice: boolean;
}

interface RestaurantBasicInfo {
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
}

interface LegalInfo {
  gstNumber?: string;
  fssaiNumber?: string;
  panNumber?: string;
  cinNumber?: string;
}

interface SetupWizardState {
  // Navigation state
  currentScreen: SetupScreen;
  completedScreens: Set<SetupScreen>;
  skippedScreens: Set<SetupScreen>;
  selectedOptionalItems: OptionalSetupItem[];

  // Wizard data (temporary storage during setup)
  wizardData: {
    restaurantInfo?: RestaurantBasicInfo;
    legalInfo?: LegalInfo;
    taxSettings?: TaxSettings;
    trainingMode?: boolean;
    menuSetup?: {
      usedDemoData: boolean;
      restaurantType?: string;
    };
    staffSetup?: {
      usedDemoData: boolean;
      restaurantType?: string;
    };
    floorPlanSetup?: {
      usedDemoData: boolean;
      restaurantType?: string;
    };
    // New: Company-first workflow data
    companyInfo?: {
      companyName: string;
      ownerName: string;
      ownerEmail: string;
      ownerPhone: string;
      companyRegistrationNumber?: string;
      operationalScale: 'single-location' | 'multi-location' | 'chain';
    };
    firstLocationInfo?: {
      locationName: string;
      address: {
        line1: string;
        line2?: string;
        city: string;
        state: string;
        pincode: string;
      };
      phone?: string;
      email?: string;
    };
    activationChoice?: 'hybrid' | 'management-only';
  };

  // Completion state
  isComplete: boolean;
  startedAt: string | null;
  completedAt: string | null;
  awaitingActivation: boolean; // Setup complete, provisioned, waiting for activation code entry

  // Provisioning data (stored in SQLite)
  activationCode: string | null; // POS activation code from provisioning
  provisioningWebSocketUrl: string | null; // WebSocket URL for real-time provisioning updates
  isRestaurantOwner: boolean; // True if user created the restaurant (vs activating existing)

  // Checklist dismissal
  checklistDismissed: boolean;

  // SQLite persistence (NEW)
  isLoading: boolean;
  loadFromSQLite: () => Promise<void>;
  saveToSQLite: () => Promise<void>;

  // Actions (now auto-save to SQLite)
  setCurrentScreen: (screen: SetupScreen) => Promise<void>;
  markScreenComplete: (screen: SetupScreen) => Promise<void>;
  skipScreen: (screen: SetupScreen, reason?: string) => Promise<void>;
  setSelectedOptionalItems: (items: OptionalSetupItem[]) => Promise<void>;
  updateWizardData: (data: Partial<SetupWizardState['wizardData']>) => Promise<void>;
  completeSetup: () => Promise<void>;
  markAsComplete: () => Promise<void>; // Simple completion without data transfer
  resetWizard: () => Promise<void>;
  setAwaitingActivation: (awaiting: boolean) => Promise<void>;
  setActivationCode: (code: string | null) => Promise<void>;
  setProvisioningWebSocketUrl: (url: string | null) => Promise<void>;
  setIsRestaurantOwner: (isOwner: boolean) => Promise<void>;
  dismissChecklist: () => Promise<void>;
  undismissChecklist: () => Promise<void>;

  // Navigation helpers
  goToNextScreen: () => Promise<void>;
  goToPreviousScreen: () => Promise<void>;
  getNextScreen: () => SetupScreen | null;
  getPreviousScreen: () => SetupScreen | null;

  // Computed helpers
  getProgress: () => number;
  canProceed: () => boolean;
  getIncompleteRequiredScreens: () => SetupScreen[];
  getIncompleteOptionalItems: () => OptionalSetupItem[];
  hasIncompleteSetup: () => boolean;
  getCurrentScreenIndex: () => number;
  getTotalScreens: () => number;
}

export const useSetupWizardStore = create<SetupWizardState>()((set, get) => ({
  // Initial state
  currentScreen: 'welcome',
  completedScreens: new Set<SetupScreen>(),
  skippedScreens: new Set<SetupScreen>(),
  selectedOptionalItems: [],
  wizardData: {},
  isComplete: false,
  startedAt: null,
  completedAt: null,
  awaitingActivation: false,
  activationCode: null,
  provisioningWebSocketUrl: null,
  isRestaurantOwner: false,
  checklistDismissed: false,
  isLoading: false,

  // Load wizard state from SQLite on app startup
  loadFromSQLite: async () => {
    if (!isTauri()) {
      console.log('[SetupWizard] Not in Tauri, using defaults');
      return;
    }

    try {
      set({ isLoading: true });
      console.log('[SetupWizard] Loading wizard state from SQLite...');

      const state = await getSetupWizardState();

      set({
        currentScreen: state.currentScreen,
        completedScreens: state.completedScreens,
        skippedScreens: state.skippedScreens,
        selectedOptionalItems: state.selectedOptionalItems,
        wizardData: state.wizardData,
        isComplete: state.isComplete,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        awaitingActivation: state.awaitingActivation,
        activationCode: state.activationCode || null,
        provisioningWebSocketUrl: state.provisioningWebSocketUrl || null,
        checklistDismissed: state.checklistDismissed,
        isLoading: false,
      });

      console.log('[SetupWizard] ✅ Wizard state loaded from SQLite');
      console.log('[SetupWizard] isComplete:', state.isComplete);
      console.log('[SetupWizard] currentScreen:', state.currentScreen);
    } catch (error) {
      // Suppress "no such table" errors - expected during migration
      const errorMsg = String(error);
      if (!errorMsg.includes('no such table')) {
        console.error('[SetupWizard] Failed to load from SQLite:', error);
      }
      set({ isLoading: false });
    }
  },

  // Save wizard state to SQLite (called after every state change)
  saveToSQLite: async () => {
    if (!isTauri()) {
      return;
    }

    try {
      const state = get();
      console.log('[SetupWizard] Saving wizard state to SQLite...');

      await saveTauriWizardState({
        currentScreen: state.currentScreen,
        completedScreens: state.completedScreens,
        skippedScreens: state.skippedScreens,
        selectedOptionalItems: state.selectedOptionalItems,
        wizardData: state.wizardData,
        isComplete: state.isComplete,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        awaitingActivation: state.awaitingActivation,
        activationCode: state.activationCode,
        provisioningWebSocketUrl: state.provisioningWebSocketUrl,
        isRestaurantOwner: state.isRestaurantOwner,
        checklistDismissed: state.checklistDismissed,
      });

      console.log('[SetupWizard] ✅ Wizard state saved to SQLite');
    } catch (error) {
      console.error('[SetupWizard] Failed to save to SQLite:', error);
      throw error; // Re-throw so callers know save failed
    }
  },

      // Set current screen (async - saves to SQLite)
      setCurrentScreen: async (screen: SetupScreen) => {
        console.log('[SetupWizard] Setting screen to:', screen);
        set({ currentScreen: screen });

        // Start timer on first real screen
        if (screen === 'restaurant_basics' && !get().startedAt) {
          set({ startedAt: new Date().toISOString() });
        }

        await get().saveToSQLite();
      },

      // Mark screen as complete (async - saves to SQLite)
      markScreenComplete: async (screen: SetupScreen) => {
        console.log('[SetupWizard] Marking screen complete:', screen);
        set((state) => {
          const newCompleted = new Set(state.completedScreens);
          newCompleted.add(screen);

          // Remove from skipped if it was skipped before
          const newSkipped = new Set(state.skippedScreens);
          newSkipped.delete(screen);

          return {
            completedScreens: newCompleted,
            skippedScreens: newSkipped,
          };
        });

        await get().saveToSQLite();
      },

      // Skip a screen (async - saves to SQLite)
      skipScreen: async (screen: SetupScreen, reason?: string) => {
        console.log('[SetupWizard] Skipping screen:', screen, reason ? `(${reason})` : '');
        set((state) => {
          const newSkipped = new Set(state.skippedScreens);
          newSkipped.add(screen);
          return { skippedScreens: newSkipped };
        });

        await get().saveToSQLite();
      },

      // Set selected optional items (async - saves to SQLite)
      setSelectedOptionalItems: async (items: OptionalSetupItem[]) => {
        console.log('[SetupWizard] Selected optional items:', items);
        set({ selectedOptionalItems: items });
        await get().saveToSQLite();
      },

      // Update wizard data (async - saves to SQLite)
      updateWizardData: async (data: Partial<SetupWizardState['wizardData']>) => {
        console.log('[SetupWizard] Updating wizard data:', Object.keys(data));
        // Force trainingMode to always be false (Live Mode only)
        if ('trainingMode' in data) {
          data = { ...data, trainingMode: false };
        }
        set((state) => ({
          wizardData: {
            ...state.wizardData,
            ...data,
          },
        }));
        await get().saveToSQLite();
      },

      // Mark wizard as complete without data transfer (for auto-complete scenarios)
      markAsComplete: async () => {
        console.log('[SetupWizard] Marking wizard as complete (no data transfer)');
        set({
          isComplete: true,
          completedAt: new Date().toISOString(),
          currentScreen: 'completion',
        });
        await get().saveToSQLite();
      },

      // Complete the entire setup
      completeSetup: async () => {
        console.log('[SetupWizard] ===== STARTING SETUP COMPLETION =====');

        const state = get();
        const { wizardData } = state;

        console.log('[SetupWizard] Wizard data:', JSON.stringify(wizardData, null, 2));

        // Transfer data to restaurant settings store
        const restaurantSettingsStore = useRestaurantSettingsStore.getState();

        // Build the settings object
        const settings: Partial<RestaurantDetails> = {};

        // Transfer restaurant info
        if (wizardData.restaurantInfo) {
          console.log('[SetupWizard] Transferring restaurant info...');
          settings.name = wizardData.restaurantInfo.name;
          settings.tagline = wizardData.restaurantInfo.tagline;
          settings.address = wizardData.restaurantInfo.address;
          settings.phone = wizardData.restaurantInfo.phone;
          settings.email = wizardData.restaurantInfo.email;
          settings.website = wizardData.restaurantInfo.website;
        }

        // Transfer legal info
        if (wizardData.legalInfo) {
          console.log('[SetupWizard] Transferring legal info...');
          settings.gstNumber = wizardData.legalInfo.gstNumber;
          settings.fssaiNumber = wizardData.legalInfo.fssaiNumber;
          settings.panNumber = wizardData.legalInfo.panNumber;
          settings.cinNumber = wizardData.legalInfo.cinNumber;
        }

        // Transfer tax settings
        if (wizardData.taxSettings) {
          console.log('[SetupWizard] Transferring tax settings...');
          const { mode, cgstRate, sgstRate, serviceChargeEnabled, serviceChargeRate, taxIncludedInPrice } = wizardData.taxSettings;

          settings.taxEnabled = mode === 'gst';
          settings.cgstRate = cgstRate;
          settings.sgstRate = sgstRate;
          settings.serviceChargeEnabled = serviceChargeEnabled;
          settings.serviceChargeRate = serviceChargeRate;
          settings.taxIncludedInPrice = taxIncludedInPrice;
        }

        console.log('[SetupWizard] Final settings object:', JSON.stringify(settings, null, 2));

        // Update restaurant settings (saves to SQLite)
        console.log('[SetupWizard] 📋 Step 1/3: Saving settings to SQLite...');
        console.log('[SetupWizard] Restaurant name:', settings.name);
        console.log('[SetupWizard] Tax enabled:', settings.taxEnabled);
        console.log('[SetupWizard] Training mode:', wizardData.trainingMode);

        try {
          await restaurantSettingsStore.updateSettings(settings);
          console.log('[SetupWizard] ✅ Settings save command completed');
        } catch (error) {
          console.error('[SetupWizard] ❌ Failed to save settings:', error);
          throw error; // Re-throw to be caught by CompletionScreen
        }

        // Validate save succeeded by reading back
        console.log('[SetupWizard] 📋 Step 2/3: Validating save...');
        try {
          await restaurantSettingsStore.loadFromSQLite();
          const savedSettings = restaurantSettingsStore.settings;

          // Check if required fields were actually saved
          if (!savedSettings.name || savedSettings.name === 'Restaurant Name') {
            console.error('[SetupWizard] ❌ Validation failed: Settings not found or default values returned');
            throw new Error('Validation failed: Settings not found or default values returned');
          }

          // Only validate name match if wizardData.restaurantInfo is available
          if (wizardData.restaurantInfo?.name && savedSettings.name !== wizardData.restaurantInfo.name) {
            console.warn('[SetupWizard] ⚠️ Warning: Name mismatch (non-critical)');
            console.warn(`Expected: '${wizardData.restaurantInfo.name}', Got: '${savedSettings.name}'`);
            // Don't throw - this is just a warning, settings were saved successfully
          } else if (!wizardData.restaurantInfo?.name) {
            console.log('[SetupWizard] ℹ️ Skipping name validation - wizard data not available (settings already saved)');
          }

          console.log('[SetupWizard] ✅ Settings saved and validated successfully');
        } catch (validationError: any) {
          console.error('[SetupWizard] ❌ Validation failed:', validationError);
          throw new Error(`Save validation failed: ${validationError.message}. Data may not have persisted.`);
        }

        // Sync to cloud D1 database (if not in training mode)
        console.log('[SetupWizard] 📋 Step 3/3: Syncing to cloud (if not training mode)...');
        try {
          // Get tenant ID from store or environment
          const { useTenantStore } = await import('./tenantStore');
          const tenantStore = useTenantStore.getState();
          const tenantId = tenantStore.tenant?.tenantId || import.meta.env.VITE_DEFAULT_TENANT_ID;

          if (tenantId && wizardData.trainingMode === false) {
            console.log('[SetupWizard] Syncing settings to cloud for tenant:', tenantId);
            await restaurantSettingsStore.syncToCloud(tenantId);
            console.log('[SetupWizard] ✅ Settings synced to cloud successfully');
          } else if (wizardData.trainingMode === true) {
            console.log('[SetupWizard] ⏭️  Training mode - skipping cloud sync');
          }
        } catch (error) {
          console.error('[SetupWizard] ⚠️  Failed to sync to cloud:', error);
          // Don't block setup completion - SQLite save already succeeded
        }

        // Update provisioning store
        const provisioningStore = useProvisioningStore.getState();

        // Always use Live Mode (training mode is disabled)
        provisioningStore.setTrainingMode(false);

        // Always go live (training mode is disabled)
        provisioningStore.goLive();

        // Mark wizard as complete
        set({
          isComplete: true,
          completedAt: new Date().toISOString(),
          currentScreen: 'completion',
        });

        console.log('[SetupWizard] Setup complete! Settings transferred to stores and synced to cloud.');
      },

      // Reset wizard (for testing or re-setup) - async, saves to SQLite
      resetWizard: async () => {
        console.log('[SetupWizard] Resetting wizard');

        if (isTauri()) {
          try {
            // Reset in SQLite
            await resetTauriWizardState();
            console.log('[SetupWizard] ✅ Wizard state reset in SQLite');
          } catch (error) {
            console.error('[SetupWizard] Failed to reset in SQLite:', error);
          }
        }

        // Reset in-memory state
        set({
          currentScreen: 'welcome',
          completedScreens: new Set<SetupScreen>(),
          skippedScreens: new Set<SetupScreen>(),
          selectedOptionalItems: [],
          wizardData: {},
          isComplete: false,
          startedAt: null,
          completedAt: null,
          awaitingActivation: false,
          checklistDismissed: false,
        });
      },

      // Set awaiting activation flag (async - saves to SQLite)
      setAwaitingActivation: async (awaiting: boolean) => {
        console.log('[SetupWizard] Setting awaitingActivation to:', awaiting);
        set({ awaitingActivation: awaiting });
        await get().saveToSQLite();
      },

      // Set activation code (async - saves to SQLite)
      setActivationCode: async (code: string | null) => {
        console.log('[SetupWizard] Setting activationCode to:', code);
        set({ activationCode: code });
        await get().saveToSQLite();
      },

      // Set provisioning WebSocket URL (async - saves to SQLite)
      setProvisioningWebSocketUrl: async (url: string | null) => {
        console.log('[SetupWizard] Setting provisioningWebSocketUrl to:', url);
        set({ provisioningWebSocketUrl: url });
        await get().saveToSQLite();
      },

      setIsRestaurantOwner: async (isOwner: boolean) => {
        console.log('[SetupWizard] Setting isRestaurantOwner to:', isOwner);
        set({ isRestaurantOwner: isOwner });
        await get().saveToSQLite();
      },

      // Dismiss post-setup checklist (async - saves to SQLite)
      dismissChecklist: async () => {
        console.log('[SetupWizard] Dismissing checklist');
        set({ checklistDismissed: true });
        await get().saveToSQLite();
      },

      // Undismiss checklist (async - saves to SQLite)
      undismissChecklist: async () => {
        set({ checklistDismissed: false });
        await get().saveToSQLite();
      },

      // Navigate to next screen (async - saves to SQLite)
      goToNextScreen: async () => {
        const nextScreen = get().getNextScreen();
        if (nextScreen) {
          await get().setCurrentScreen(nextScreen);
        }
      },

      // Navigate to previous screen (async - saves to SQLite)
      goToPreviousScreen: async () => {
        const prevScreen = get().getPreviousScreen();
        if (prevScreen) {
          await get().setCurrentScreen(prevScreen);
        }
      },

      // Get next screen in the flow
      getNextScreen: (): SetupScreen | null => {
        const { currentScreen, selectedOptionalItems } = get();
        const currentIndex = SCREEN_ORDER.indexOf(currentScreen);

        if (currentIndex === -1 || currentIndex >= SCREEN_ORDER.length - 1) {
          return null;
        }

        // Find the next screen that should be shown
        for (let i = currentIndex + 1; i < SCREEN_ORDER.length; i++) {
          const screen = SCREEN_ORDER[i];

          // Always show required screens
          if (REQUIRED_SCREENS.includes(screen)) {
            return screen;
          }

          // Show optional_selector if we haven't passed it yet
          if (screen === 'optional_selector') {
            return screen;
          }

          // Show optional screens only if selected
          if (OPTIONAL_SETUP_ITEMS.includes(screen as OptionalSetupItem)) {
            if (selectedOptionalItems.includes(screen as OptionalSetupItem)) {
              return screen;
            }
            // Skip if not selected, continue to next
            continue;
          }

          // Legal info is recommended but not required - always show
          if (screen === 'legal_info') {
            return screen;
          }
        }

        return null;
      },

      // Get previous screen in the flow
      getPreviousScreen: (): SetupScreen | null => {
        const { currentScreen, selectedOptionalItems } = get();
        const currentIndex = SCREEN_ORDER.indexOf(currentScreen);

        if (currentIndex <= 0) {
          return null;
        }

        // Find the previous screen that should be shown
        for (let i = currentIndex - 1; i >= 0; i--) {
          const screen = SCREEN_ORDER[i];

          // Always show required screens
          if (REQUIRED_SCREENS.includes(screen)) {
            return screen;
          }

          // Show optional_selector
          if (screen === 'optional_selector') {
            return screen;
          }

          // Show optional screens only if selected
          if (OPTIONAL_SETUP_ITEMS.includes(screen as OptionalSetupItem)) {
            if (selectedOptionalItems.includes(screen as OptionalSetupItem)) {
              return screen;
            }
            continue;
          }

          // Legal info is recommended - always show
          if (screen === 'legal_info') {
            return screen;
          }
        }

        return null;
      },

      // Get progress percentage (0-100)
      getProgress: (): number => {
        const { completedScreens, selectedOptionalItems } = get();

        // Count required screens + selected optional screens
        const requiredCount = REQUIRED_SCREENS.length;
        const selectedOptionalCount = selectedOptionalItems.length;
        const totalScreens = requiredCount + selectedOptionalCount + 1; // +1 for legal_info (recommended)

        // Count completed
        let completedCount = 0;
        REQUIRED_SCREENS.forEach(screen => {
          if (completedScreens.has(screen)) completedCount++;
        });
        selectedOptionalItems.forEach(item => {
          if (completedScreens.has(item as SetupScreen)) completedCount++;
        });
        if (completedScreens.has('legal_info')) completedCount++;

        return Math.round((completedCount / totalScreens) * 100);
      },

      // Check if can proceed from current screen
      canProceed: (): boolean => {
        const { currentScreen, wizardData } = get();

        switch (currentScreen) {
          case 'welcome':
            return true; // Always can proceed from welcome

          case 'restaurant_basics':
            // Must have name, address, and phone
            const info = wizardData.restaurantInfo;
            return !!(
              info?.name?.trim() &&
              info?.address?.line1?.trim() &&
              info?.address?.city?.trim() &&
              info?.address?.state?.trim() &&
              info?.address?.pincode?.trim() &&
              info?.phone?.trim()
            );

          case 'legal_info':
            return true; // Can skip legal info

          case 'tax_config':
            // Must have tax settings configured
            return !!wizardData.taxSettings;

          case 'optional_selector':
            return true; // Can proceed with or without selections

          case 'menu_setup':
          case 'floor_plan':
          case 'staff_setup':
          case 'printer_setup':
          case 'invoice_config':
            return true; // Optional screens can always be skipped

          case 'training_mode':
            // Must select a mode
            return wizardData.trainingMode !== undefined;

          case 'system_check':
            return true; // Auto-advances

          case 'completion':
            return true;

          default:
            return false;
        }
      },

      // Get incomplete required screens
      getIncompleteRequiredScreens: (): SetupScreen[] => {
        const { completedScreens, skippedScreens } = get();
        return REQUIRED_SCREENS.filter(
          (screen) => !completedScreens.has(screen) && !skippedScreens.has(screen) && screen !== 'completion'
        );
      },

      // Get incomplete optional items
      getIncompleteOptionalItems: (): OptionalSetupItem[] => {
        const { selectedOptionalItems, completedScreens, skippedScreens } = get();
        return selectedOptionalItems.filter(
          (item) => !completedScreens.has(item as SetupScreen) && !skippedScreens.has(item as SetupScreen)
        );
      },

      // Check if there's incomplete setup
      hasIncompleteSetup: (): boolean => {
        const { isComplete, skippedScreens } = get();

        if (!isComplete) return false;

        // Check if legal_info was skipped
        const hasSkippedLegal = skippedScreens.has('legal_info');

        // Check if any selected optional items are incomplete
        const incompleteOptional = get().getIncompleteOptionalItems();

        return hasSkippedLegal || incompleteOptional.length > 0;
      },

      // Get current screen index (for progress display)
      getCurrentScreenIndex: (): number => {
        const { currentScreen, selectedOptionalItems } = get();

        // Build the actual list of screens in this wizard run
        const actualScreens: SetupScreen[] = [
          'welcome',
          'restaurant_basics',
          'legal_info',
          'tax_config',
          'optional_selector',
          ...selectedOptionalItems,  // Add selected optional screens
          'training_mode',
          'system_check',
          'completion',
        ];

        return actualScreens.indexOf(currentScreen);
      },

      // Get total screens in this wizard run
      getTotalScreens: (): number => {
        const { selectedOptionalItems } = get();
        // welcome, restaurant_basics, legal_info, tax_config, optional_selector = 5
        // + selectedOptionalItems (variable)
        // + training_mode, system_check, completion = 3
        // Total = 8 + selectedOptionalItems.length
        return 8 + selectedOptionalItems.length;
      },
}));

/**
 * Hook to check if app needs initial setup
 */
export function useNeedsSetup(): boolean {
  const { isComplete } = useSetupWizardStore();
  const { settings } = useRestaurantSettingsStore();
  const { tenant } = useTenantStore();

  // CRITICAL: Check if minimum required data exists for POS operation
  // Required fields: name, phone, invoice settings
  const hasRequiredData = Boolean(
    settings.name?.trim() &&
    settings.name !== 'Restaurant Name' && // Not the default placeholder
    settings.phone?.trim() &&
    settings.currentInvoiceNumber !== undefined &&
    settings.currentInvoiceNumber !== null &&
    settings.invoicePrefix?.trim()
  );

  // CRITICAL: If tenant exists BUT required settings are incomplete, still need setup
  // Tenant provisioning creates the tenant_config, but user must complete basic details
  if (tenant?.tenantId && !hasRequiredData) {
    return true;
  }

  // If tenant exists AND has required data, skip wizard
  if (tenant?.tenantId && hasRequiredData) {
    return false;
  }

  // Check if activation just completed - skip validation
  const justActivated =
    sessionStorage.getItem('activation-just-completed') ||
    sessionStorage.getItem('setup-just-completed');

  if (justActivated) {
    return !isComplete;
  }

  // If setup is marked complete but no actual data exists, needs setup
  const settingsStore = useRestaurantSettingsStore.getState();
  const settingsAreLoading = settingsStore.isLoading;

  if (isComplete && !hasRequiredData && !settingsAreLoading) {
    return true; // Need setup - stale wizard state
  }

  // If settings are still loading, trust the isComplete flag temporarily
  if (settingsAreLoading && isComplete) {
    return false;
  }

  // Setup is complete if wizard is marked complete AND data exists
  if (isComplete && hasRequiredData) {
    return false;
  }

  // If required data exists but wizard not complete, don't need setup (legacy path)
  if (hasRequiredData && !isComplete) {
    return false;
  }

  return !hasRequiredData;
}

/**
 * Hook to get setup progress info
 */
export function useSetupProgress() {
  const store = useSetupWizardStore();
  return {
    currentScreen: store.currentScreen,
    currentScreenLabel: SCREEN_LABELS[store.currentScreen],
    progress: store.getProgress(),
    screenIndex: store.getCurrentScreenIndex(),
    totalScreens: store.getTotalScreens(),
    isComplete: store.isComplete,
    canProceed: store.canProceed(),
  };
}

/**
 * Validation Hooks for Card-Based Onboarding
 * These hooks check real-time data from stores to determine completion
 */

// Check if restaurant basics are complete
// FIXED: Now reactive - subscribes to store changes
// Supports international phone numbers (minimum 7 digits)
export function useHasRestaurantBasics(): boolean {
  const { settings } = useRestaurantSettingsStore();

  // Extract digits from phone number
  const phoneDigits = settings.phone?.replace(/[^\d]/g, '') || '';

  // International phone validation: minimum 7 digits (e.g., Singapore), maximum 15 (ITU standard)
  const isPhoneValid = phoneDigits.length >= 7 && phoneDigits.length <= 15;

  // Individual field checks for debugging
  const checks = {
    hasName: Boolean(settings.name?.trim()),
    isNotDefaultName: settings.name !== 'Restaurant Name',
    hasPhone: Boolean(settings.phone?.trim()),
    isPhoneValid,
    phoneDigits: phoneDigits.length,
    hasAddressLine1: Boolean(settings.address?.line1?.trim()),
    hasCity: Boolean(settings.address?.city?.trim()),
    hasState: Boolean(settings.address?.state?.trim()),
    hasPincode: Boolean(settings.address?.pincode?.trim()),
  };

  const isComplete = checks.hasName && checks.isNotDefaultName && checks.hasPhone &&
    checks.isPhoneValid && checks.hasAddressLine1 && checks.hasCity &&
    checks.hasState && checks.hasPincode;

  // Debug logging when validation fails
  if (!isComplete) {
    console.group('🔍 [Restaurant Basics Validation]');
    console.log('Name:', settings.name, '✓', checks.hasName && checks.isNotDefaultName);
    console.log('Phone:', settings.phone, '→', phoneDigits.length, 'digits', '✓', checks.isPhoneValid);
    console.log('Address Line 1:', settings.address?.line1, '✓', checks.hasAddressLine1);
    console.log('City:', settings.address?.city, '✓', checks.hasCity);
    console.log('State:', settings.address?.state, '✓', checks.hasState);
    console.log('Pincode:', settings.address?.pincode, '✓', checks.hasPincode);
    console.log('---');
    console.log('Failed fields:', Object.entries(checks).filter(([, value]) => !value).map(([key]) => key));
    console.groupEnd();
  }

  return isComplete;
}

// Check if tax/billing is complete
// FIXED: Now reactive - subscribes to store changes
export function useHasTaxBillingSetup(): boolean {
  const { settings } = useRestaurantSettingsStore();

  // Tax configuration validated
  const hasTaxConfig = Boolean(
    settings.taxEnabled !== undefined &&
    (settings.taxEnabled === false || (settings.cgstRate !== undefined && settings.sgstRate !== undefined))
  );

  // Invoice configuration validated
  const hasInvoiceConfig = Boolean(
    settings.invoicePrefix?.trim() &&
    settings.invoicePrefix.length >= 2 &&
    settings.currentInvoiceNumber !== undefined &&
    settings.currentInvoiceNumber !== null &&
    settings.invoiceStartNumber !== undefined
  );

  // GST number is optional - many small restaurants don't have GST registration
  // (GST registration required only for businesses with turnover > ₹40 lakh)
  // They can still use GST calculations for accounting without having a GST number
  const hasGSTIfRequired = true; // GST number is now optional

  return hasTaxConfig && hasInvoiceConfig && hasGSTIfRequired;
}

// Check if minimum menu exists
// FIXED: Now reactive - subscribes to store changes
export function useHasMinimumMenu(): boolean {
  const { items } = useMenuStore();
  return items.length >= 3;
}

// Check if floor plan is configured
// FIXED: Now reactive - subscribes to store changes
export function useHasFloorPlan(): boolean {
  const { sections, tables } = useFloorPlanStore();
  // Require at least 1 section and 2 tables
  return sections.length >= 1 && tables.length >= 2;
}

// Check if staff is configured
// FIXED: Now reactive - subscribes to store changes
export function useHasStaff(): boolean {
  const { staff } = useStaffStore();
  // Require at least 2 active staff members
  const activeStaff = staff.filter(s => s.isActive);
  return activeStaff.length >= 2;
}

// Master validation - all required setup complete
export function useIsReadyForPOS(): boolean {
  const hasBasics = useHasRestaurantBasics();
  const hasTaxBilling = useHasTaxBillingSetup();
  const hasMenu = useHasMinimumMenu();
  const hasFloorPlan = useHasFloorPlan();
  const hasStaff = useHasStaff();

  return hasBasics && hasTaxBilling && hasMenu && hasFloorPlan && hasStaff;
}

// Get detailed incomplete setup info for display
export function useGetIncompleteSetup(): {
  missingBasics: boolean;
  missingTaxBilling: boolean;
  missingMenu: boolean;
  missingFloorPlan: boolean;
  missingStaff: boolean;
  missingDetails: string[];
  completedCount: number;
  requiredCount: number;
} {
  const hasBasics = useHasRestaurantBasics();
  const hasTaxBilling = useHasTaxBillingSetup();
  const hasMenu = useHasMinimumMenu();
  const hasFloorPlan = useHasFloorPlan();
  const hasStaff = useHasStaff();

  const missingDetails: string[] = [];
  if (!hasBasics) missingDetails.push('Restaurant information');
  if (!hasTaxBilling) missingDetails.push('Tax & billing setup');
  if (!hasMenu) missingDetails.push('Menu items (at least 3)');
  if (!hasFloorPlan) missingDetails.push('Floor plan (sections & tables)');
  if (!hasStaff) missingDetails.push('Staff members (at least 2)');

  const requiredCount = 5; // Updated from 3 to 5
  const completedCount = requiredCount - missingDetails.length;

  return {
    missingBasics: !hasBasics,
    missingTaxBilling: !hasTaxBilling,
    missingMenu: !hasMenu,
    missingFloorPlan: !hasFloorPlan,
    missingStaff: !hasStaff,
    missingDetails,
    completedCount,
    requiredCount,
  };
}

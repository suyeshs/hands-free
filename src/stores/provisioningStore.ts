/**
 * Provisioning Store
 * Manages the Restaurant OS installation/provisioning state machine
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Provisioning steps in order
export type ProvisioningStep =
  | 'phone_verification'
  | 'business_basic'
  | 'business_legal'
  | 'business_invoice'
  | 'business_tax'
  | 'menu_upload'
  | 'optional_config'
  | 'diagnostics'
  | 'training_mode'
  | 'complete';

// Required steps that must be completed
export const REQUIRED_STEPS: ProvisioningStep[] = [
  'phone_verification',
  'business_basic',
  'business_legal',
  'business_invoice',
  'business_tax',
  'menu_upload',
  'diagnostics',
  'training_mode',
];

// Step order for progress calculation
export const STEP_ORDER: ProvisioningStep[] = [
  'phone_verification',
  'business_basic',
  'business_legal',
  'business_invoice',
  'business_tax',
  'menu_upload',
  'optional_config',
  'diagnostics',
  'training_mode',
  'complete',
];

// Step labels for UI display
export const STEP_LABELS: Record<ProvisioningStep, string> = {
  phone_verification: 'Verification',
  business_basic: 'Basic Info',
  business_legal: 'Legal & Tax IDs',
  business_invoice: 'Invoice Settings',
  business_tax: 'Tax Configuration',
  menu_upload: 'Menu Setup',
  optional_config: 'Configuration',
  diagnostics: 'System Check',
  training_mode: 'Training Mode',
  complete: 'Complete',
};

// Optional configuration items
export type OptionalConfig =
  | 'floor_plan'
  | 'staff'
  | 'printer_settings'
  | 'pos_workflow'
  | 'aggregator_settings';

export const OPTIONAL_CONFIG_ITEMS: OptionalConfig[] = [
  'floor_plan',
  'staff',
  'printer_settings',
  'pos_workflow',
  'aggregator_settings',
];

export const OPTIONAL_CONFIG_LABELS: Record<OptionalConfig, { title: string; description: string; icon: string }> = {
  floor_plan: {
    title: 'Floor Plan',
    description: 'Set up sections and tables for dine-in service',
    icon: '🗺️',
  },
  staff: {
    title: 'Staff Members',
    description: 'Add staff and assign roles and permissions',
    icon: '👥',
  },
  printer_settings: {
    title: 'Printer Settings',
    description: 'Configure receipt and KOT printers',
    icon: '🖨️',
  },
  pos_workflow: {
    title: 'POS Workflow',
    description: 'Customize order flow and checkout process',
    icon: '⚙️',
  },
  aggregator_settings: {
    title: 'Aggregator Integration',
    description: 'Connect Zomato, Swiggy, and other platforms',
    icon: '🔗',
  },
};

interface ProvisioningState {
  // Current step in the flow
  currentStep: ProvisioningStep;

  // Completion tracking for required steps
  stepsCompleted: Record<ProvisioningStep, boolean>;

  // Completion tracking for optional config
  optionalConfigCompleted: Record<OptionalConfig, boolean>;

  // Mode states
  isTrainingMode: boolean;
  isProvisioned: boolean;
  provisionedAt: string | null;

  // Phone verification data
  verifiedPhone: string | null;
  verificationSid: string | null;

  // Super admin mode (hidden, for cleanup actions)
  isSuperAdminMode: boolean;
  superAdminPin: string;

  // Actions
  setCurrentStep: (step: ProvisioningStep) => void;
  markStepComplete: (step: ProvisioningStep) => void;
  markStepIncomplete: (step: ProvisioningStep) => void;
  markOptionalComplete: (config: OptionalConfig) => void;
  markOptionalIncomplete: (config: OptionalConfig) => void;
  setVerifiedPhone: (phone: string, sid: string) => void;
  setTrainingMode: (enabled: boolean) => void;
  goLive: () => void;
  completeProvisioning: () => void;
  resetProvisioning: () => void;
  enterSuperAdminMode: (pin: string) => boolean;
  exitSuperAdminMode: () => void;
  nextStep: () => void;
  previousStep: () => void;

  // Computed helpers
  getProgress: () => number;
  canProceedToNextStep: () => boolean;
  isRequiredComplete: () => boolean;
  getCurrentStepIndex: () => number;
  getStepStatus: (step: ProvisioningStep) => 'pending' | 'current' | 'complete';
}

// Default super admin PIN
const DEFAULT_SUPER_ADMIN_PIN = '6163';

export const useProvisioningStore = create<ProvisioningState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 'phone_verification',
      stepsCompleted: {
        phone_verification: false,
        business_basic: false,
        business_legal: false,
        business_invoice: false,
        business_tax: false,
        menu_upload: false,
        optional_config: false,
        diagnostics: false,
        training_mode: false,
        complete: false,
      },
      optionalConfigCompleted: {
        floor_plan: false,
        staff: false,
        printer_settings: false,
        pos_workflow: false,
        aggregator_settings: false,
      },
      isTrainingMode: true, // Default to training mode
      isProvisioned: false,
      provisionedAt: null,
      verifiedPhone: null,
      verificationSid: null,
      isSuperAdminMode: false,
      superAdminPin: DEFAULT_SUPER_ADMIN_PIN,

      // Set current step
      setCurrentStep: (step: ProvisioningStep) => {
        console.log('[ProvisioningStore] Setting step to:', step);
        set({ currentStep: step });
      },

      // Mark a step as complete
      markStepComplete: (step: ProvisioningStep) => {
        console.log('[ProvisioningStore] Marking step complete:', step);
        set((state) => ({
          stepsCompleted: {
            ...state.stepsCompleted,
            [step]: true,
          },
        }));
      },

      // Mark a step as incomplete
      markStepIncomplete: (step: ProvisioningStep) => {
        console.log('[ProvisioningStore] Marking step incomplete:', step);
        set((state) => ({
          stepsCompleted: {
            ...state.stepsCompleted,
            [step]: false,
          },
        }));
      },

      // Mark optional config as complete
      markOptionalComplete: (config: OptionalConfig) => {
        console.log('[ProvisioningStore] Marking optional config complete:', config);
        set((state) => ({
          optionalConfigCompleted: {
            ...state.optionalConfigCompleted,
            [config]: true,
          },
        }));
      },

      // Mark optional config as incomplete
      markOptionalIncomplete: (config: OptionalConfig) => {
        console.log('[ProvisioningStore] Marking optional config incomplete:', config);
        set((state) => ({
          optionalConfigCompleted: {
            ...state.optionalConfigCompleted,
            [config]: false,
          },
        }));
      },

      // Set verified phone
      setVerifiedPhone: (phone: string, sid: string) => {
        console.log('[ProvisioningStore] Setting verified phone:', phone.slice(0, 4) + '****');
        set({
          verifiedPhone: phone,
          verificationSid: sid,
        });
      },

      // Set training mode
      setTrainingMode: (enabled: boolean) => {
        console.log('[ProvisioningStore] Setting training mode:', enabled);
        set({ isTrainingMode: enabled });
      },

      // Go live (exit training mode and complete provisioning)
      goLive: () => {
        console.log('[ProvisioningStore] Going live!');
        set({
          isTrainingMode: false,
          isProvisioned: true,
          provisionedAt: new Date().toISOString(),
          stepsCompleted: {
            ...get().stepsCompleted,
            training_mode: true,
            complete: true,
          },
          currentStep: 'complete',
        });
      },

      // Complete provisioning (stay in training mode)
      completeProvisioning: () => {
        console.log('[ProvisioningStore] Completing provisioning (training mode)');
        set({
          isProvisioned: true,
          provisionedAt: new Date().toISOString(),
          stepsCompleted: {
            ...get().stepsCompleted,
            training_mode: true,
            complete: true,
          },
          currentStep: 'complete',
        });
      },

      // Reset all provisioning state
      resetProvisioning: () => {
        console.log('[ProvisioningStore] Resetting provisioning');
        set({
          currentStep: 'phone_verification',
          stepsCompleted: {
            phone_verification: false,
            business_basic: false,
            business_legal: false,
            business_invoice: false,
            business_tax: false,
            menu_upload: false,
            optional_config: false,
            diagnostics: false,
            training_mode: false,
            complete: false,
          },
          optionalConfigCompleted: {
            floor_plan: false,
            staff: false,
            printer_settings: false,
            pos_workflow: false,
            aggregator_settings: false,
          },
          isTrainingMode: true,
          isProvisioned: false,
          provisionedAt: null,
          verifiedPhone: null,
          verificationSid: null,
          isSuperAdminMode: false,
        });
      },

      // Enter super admin mode
      enterSuperAdminMode: (pin: string): boolean => {
        if (pin === get().superAdminPin) {
          console.log('[ProvisioningStore] Entering super admin mode');
          set({ isSuperAdminMode: true });
          return true;
        }
        console.log('[ProvisioningStore] Invalid super admin PIN');
        return false;
      },

      // Exit super admin mode
      exitSuperAdminMode: () => {
        console.log('[ProvisioningStore] Exiting super admin mode');
        set({ isSuperAdminMode: false });
      },

      // Move to next step
      nextStep: () => {
        const { currentStep, stepsCompleted } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);

        // Don't proceed if current step is not complete (except optional_config which can be skipped)
        if (!stepsCompleted[currentStep] && currentStep !== 'optional_config') {
          console.log('[ProvisioningStore] Cannot proceed - current step not complete');
          return;
        }

        if (currentIndex < STEP_ORDER.length - 1) {
          const nextStep = STEP_ORDER[currentIndex + 1];
          console.log('[ProvisioningStore] Moving to next step:', nextStep);
          set({ currentStep: nextStep });
        }
      },

      // Move to previous step
      previousStep: () => {
        const { currentStep } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);

        if (currentIndex > 0) {
          const prevStep = STEP_ORDER[currentIndex - 1];
          console.log('[ProvisioningStore] Moving to previous step:', prevStep);
          set({ currentStep: prevStep });
        }
      },

      // Get progress percentage (0-100)
      getProgress: (): number => {
        const { stepsCompleted } = get();
        const completedCount = REQUIRED_STEPS.filter((step) => stepsCompleted[step]).length;
        return Math.round((completedCount / REQUIRED_STEPS.length) * 100);
      },

      // Check if can proceed to next step
      canProceedToNextStep: (): boolean => {
        const { currentStep, stepsCompleted } = get();
        // Optional config can always be skipped
        if (currentStep === 'optional_config') return true;
        return stepsCompleted[currentStep];
      },

      // Check if all required steps are complete
      isRequiredComplete: (): boolean => {
        const { stepsCompleted } = get();
        return REQUIRED_STEPS.every((step) => stepsCompleted[step]);
      },

      // Get current step index (0-based)
      getCurrentStepIndex: (): number => {
        const { currentStep } = get();
        return STEP_ORDER.indexOf(currentStep);
      },

      // Get step status for UI
      getStepStatus: (step: ProvisioningStep): 'pending' | 'current' | 'complete' => {
        const { currentStep, stepsCompleted } = get();
        if (stepsCompleted[step]) return 'complete';
        if (step === currentStep) return 'current';
        return 'pending';
      },
    }),
    {
      name: 'provisioning-storage',
      partialize: (state) => ({
        // Persist these fields
        currentStep: state.currentStep,
        stepsCompleted: state.stepsCompleted,
        optionalConfigCompleted: state.optionalConfigCompleted,
        isTrainingMode: state.isTrainingMode,
        isProvisioned: state.isProvisioned,
        provisionedAt: state.provisionedAt,
        verifiedPhone: state.verifiedPhone,
      }),
    }
  )
);

/**
 * Hook to check if app needs provisioning
 */
export function useNeedsProvisioning(): boolean {
  const { isProvisioned } = useProvisioningStore();
  // Skip provisioning if in dev mode with skip auth
  const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
  if (skipAuth) return false;
  return !isProvisioned;
}

/**
 * Hook to get provisioning progress info
 */
export function useProvisioningProgress() {
  const store = useProvisioningStore();
  return {
    currentStep: store.currentStep,
    currentStepLabel: STEP_LABELS[store.currentStep],
    progress: store.getProgress(),
    stepIndex: store.getCurrentStepIndex(),
    totalSteps: STEP_ORDER.length - 1, // Exclude 'complete'
    isComplete: store.isProvisioned,
    isTrainingMode: store.isTrainingMode,
  };
}

/**
 * Training Store
 * Manages voice AI training walkthrough state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Training modules available in the walkthrough
 */
export type TrainingModule =
  | 'pos_basics'
  | 'payment_processing'
  | 'table_management'
  | 'kitchen_display'
  | 'aggregator_orders'
  | 'end_of_day';

/**
 * Module metadata
 */
export interface ModuleInfo {
  id: TrainingModule;
  title: string;
  description: string;
  estimatedMinutes: number;
  icon: string;
}

/**
 * All available training modules
 */
export const TRAINING_MODULES: ModuleInfo[] = [
  {
    id: 'pos_basics',
    title: 'POS Basics',
    description: 'Navigate menus, add items to cart, apply modifiers, complete orders',
    estimatedMinutes: 5,
    icon: '🛒',
  },
  {
    id: 'payment_processing',
    title: 'Payment Processing',
    description: 'Cash, card, UPI payments, split bills, apply discounts',
    estimatedMinutes: 5,
    icon: '💳',
  },
  {
    id: 'table_management',
    title: 'Table Management',
    description: 'Assign orders to tables, transfer, merge/split checks',
    estimatedMinutes: 4,
    icon: '🪑',
  },
  {
    id: 'kitchen_display',
    title: 'Kitchen Display (KDS)',
    description: 'View orders, mark items ready, bump completed orders',
    estimatedMinutes: 4,
    icon: '👨‍🍳',
  },
  {
    id: 'aggregator_orders',
    title: 'Aggregator Orders',
    description: 'Accept Swiggy/Zomato orders, mark preparing/ready, handle pickup',
    estimatedMinutes: 4,
    icon: '📦',
  },
  {
    id: 'end_of_day',
    title: 'End of Day',
    description: 'Sales reports, cash drawer reconciliation, Z-report',
    estimatedMinutes: 5,
    icon: '📊',
  },
];

/**
 * Voice presets matching the client app
 */
export type VoicePreset =
  | 'aoede' // Warm & Welcoming (default)
  | 'kore' // Professional & Clear
  | 'charon' // Deep & Calm
  | 'fenrir' // Energetic & Friendly
  | 'puck' // Playful & Light
  | 'orbit' // Neutral & Modern
  | 'leda' // Soft & Soothing
  | 'orus'; // Bold & Confident

export interface VoicePresetInfo {
  id: VoicePreset;
  name: string;
  description: string;
}

export const VOICE_PRESETS: VoicePresetInfo[] = [
  { id: 'aoede', name: 'Aoede', description: 'Warm & Welcoming' },
  { id: 'kore', name: 'Kore', description: 'Professional & Clear' },
  { id: 'charon', name: 'Charon', description: 'Deep & Calm' },
  { id: 'fenrir', name: 'Fenrir', description: 'Energetic & Friendly' },
  { id: 'puck', name: 'Puck', description: 'Playful & Light' },
  { id: 'orbit', name: 'Orbit', description: 'Neutral & Modern' },
  { id: 'leda', name: 'Leda', description: 'Soft & Soothing' },
  { id: 'orus', name: 'Orus', description: 'Bold & Confident' },
];

/**
 * Training session state
 */
export interface TrainingSession {
  sessionId: string;
  startedAt: string;
  currentModule: TrainingModule;
  currentStep: number;
  totalSteps: number;
}

/**
 * UI Highlight for guided tours
 */
export interface UIHighlight {
  selector: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Training assistant state
 */
export type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

/**
 * Training store state
 */
interface TrainingState {
  // Session state
  isActive: boolean;
  session: TrainingSession | null;

  // Progress tracking
  completedModules: TrainingModule[];
  moduleProgress: Record<TrainingModule, number>; // 0-100 per module
  totalProgress: number; // 0-100 overall

  // Voice settings
  voicePreset: VoicePreset;
  voiceEnabled: boolean;

  // Assistant state
  assistantState: AssistantState;
  currentInstruction: string | null;
  lastResponse: string | null;

  // UI state
  activeHighlights: UIHighlight[];
  showOverlay: boolean;
  isPanelMinimized: boolean;

  // Actions
  startTraining: (module?: TrainingModule) => void;
  stopTraining: () => void;
  pauseTraining: () => void;
  resumeTraining: () => void;

  setCurrentModule: (module: TrainingModule) => void;
  setModuleProgress: (module: TrainingModule, progress: number) => void;
  markModuleComplete: (module: TrainingModule) => void;

  setAssistantState: (state: AssistantState) => void;
  setInstruction: (instruction: string | null) => void;
  setLastResponse: (response: string | null) => void;

  setVoicePreset: (preset: VoicePreset) => void;
  setVoiceEnabled: (enabled: boolean) => void;

  addHighlight: (highlight: UIHighlight) => void;
  clearHighlights: () => void;
  setShowOverlay: (show: boolean) => void;
  togglePanel: () => void;

  resetProgress: () => void;
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `training-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate overall progress from module progress
 */
function calculateTotalProgress(
  completedModules: TrainingModule[],
  moduleProgress: Record<TrainingModule, number>
): number {
  const totalModules = TRAINING_MODULES.length;
  const completedWeight = completedModules.length * 100;
  const inProgressWeight = Object.values(moduleProgress).reduce((sum, p) => sum + p, 0);
  return Math.round((completedWeight + inProgressWeight) / (totalModules * 100) * 100);
}

/**
 * Training store
 */
export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      // Initial state
      isActive: false,
      session: null,
      completedModules: [],
      moduleProgress: {
        pos_basics: 0,
        payment_processing: 0,
        table_management: 0,
        kitchen_display: 0,
        aggregator_orders: 0,
        end_of_day: 0,
      },
      totalProgress: 0,
      voicePreset: 'aoede',
      voiceEnabled: true,
      assistantState: 'idle',
      currentInstruction: null,
      lastResponse: null,
      activeHighlights: [],
      showOverlay: false,
      isPanelMinimized: false,

      // Actions
      startTraining: (module = 'pos_basics') => {
        const sessionId = generateSessionId();
        set({
          isActive: true,
          showOverlay: true,
          isPanelMinimized: false,
          session: {
            sessionId,
            startedAt: new Date().toISOString(),
            currentModule: module,
            currentStep: 1,
            totalSteps: 10, // Will be updated by AI
          },
          assistantState: 'idle',
          currentInstruction: 'Starting training session...',
        });
        console.log('[TrainingStore] Started training session:', sessionId);
      },

      stopTraining: () => {
        const { session } = get();
        if (session) {
          console.log('[TrainingStore] Stopped training session:', session.sessionId);
        }
        set({
          isActive: false,
          session: null,
          showOverlay: false,
          assistantState: 'idle',
          currentInstruction: null,
          activeHighlights: [],
        });
      },

      pauseTraining: () => {
        set({
          showOverlay: false,
          assistantState: 'idle',
        });
        console.log('[TrainingStore] Training paused');
      },

      resumeTraining: () => {
        set({
          showOverlay: true,
        });
        console.log('[TrainingStore] Training resumed');
      },

      setCurrentModule: (module) => {
        const { session } = get();
        if (session) {
          set({
            session: {
              ...session,
              currentModule: module,
              currentStep: 1,
            },
          });
          console.log('[TrainingStore] Changed module to:', module);
        }
      },

      setModuleProgress: (module, progress) => {
        const { completedModules, moduleProgress } = get();
        const newModuleProgress = { ...moduleProgress, [module]: progress };
        const totalProgress = calculateTotalProgress(completedModules, newModuleProgress);
        set({
          moduleProgress: newModuleProgress,
          totalProgress,
        });
      },

      markModuleComplete: (module) => {
        const { completedModules, moduleProgress } = get();
        if (!completedModules.includes(module)) {
          const newCompleted = [...completedModules, module];
          const newModuleProgress = { ...moduleProgress, [module]: 100 };
          const totalProgress = calculateTotalProgress(newCompleted, newModuleProgress);
          set({
            completedModules: newCompleted,
            moduleProgress: newModuleProgress,
            totalProgress,
          });
          console.log('[TrainingStore] Module completed:', module);
        }
      },

      setAssistantState: (state) => {
        set({ assistantState: state });
      },

      setInstruction: (instruction) => {
        set({ currentInstruction: instruction });
      },

      setLastResponse: (response) => {
        set({ lastResponse: response });
      },

      setVoicePreset: (preset) => {
        set({ voicePreset: preset });
        console.log('[TrainingStore] Voice preset changed to:', preset);
      },

      setVoiceEnabled: (enabled) => {
        set({ voiceEnabled: enabled });
        console.log('[TrainingStore] Voice enabled:', enabled);
      },

      addHighlight: (highlight) => {
        const { activeHighlights } = get();
        set({
          activeHighlights: [...activeHighlights, highlight],
        });
      },

      clearHighlights: () => {
        set({ activeHighlights: [] });
      },

      setShowOverlay: (show) => {
        set({ showOverlay: show });
      },

      togglePanel: () => {
        const { isPanelMinimized } = get();
        set({ isPanelMinimized: !isPanelMinimized });
      },

      resetProgress: () => {
        set({
          completedModules: [],
          moduleProgress: {
            pos_basics: 0,
            payment_processing: 0,
            table_management: 0,
            kitchen_display: 0,
            aggregator_orders: 0,
            end_of_day: 0,
          },
          totalProgress: 0,
        });
        console.log('[TrainingStore] Progress reset');
      },
    }),
    {
      name: 'training-storage',
      partialize: (state) => ({
        completedModules: state.completedModules,
        moduleProgress: state.moduleProgress,
        totalProgress: state.totalProgress,
        voicePreset: state.voicePreset,
        voiceEnabled: state.voiceEnabled,
      }),
    }
  )
);

/**
 * Helper to get module info by ID
 */
export function getModuleInfo(moduleId: TrainingModule): ModuleInfo | undefined {
  return TRAINING_MODULES.find((m) => m.id === moduleId);
}

/**
 * Helper to get voice preset info by ID
 */
export function getVoicePresetInfo(presetId: VoicePreset): VoicePresetInfo | undefined {
  return VOICE_PRESETS.find((p) => p.id === presetId);
}

/**
 * Check if all modules are completed
 */
export function isTrainingComplete(completedModules: TrainingModule[]): boolean {
  return TRAINING_MODULES.every((m) => completedModules.includes(m.id));
}

/**
 * Handsfree Setup Store
 * Manages state for the voice-based setup assistant
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getHandsfreeSetupAgent,
  disposeHandsfreeSetupAgent,
  type AgentStatus,
  type TranscriptEntry,
  type UIAction,
} from '../services/HandsfreeSetupAgent';

// ============================================================================
// Store Interface
// ============================================================================

export interface HandsfreeSetupSettings {
  language: string;
  voiceName: string;
  autoListen: boolean;
  confirmCriticalActions: boolean;
  showTranscript: boolean;
}

export interface HandsfreeSetupState {
  // Session state
  isInitialized: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  sessionId: string | null;
  status: AgentStatus;

  // Audio state
  audioLevel: number;

  // Conversation state
  transcript: TranscriptEntry[];
  currentIntent: string | null;

  // UI state
  activeForm: string | null;
  highlightedField: string | null;
  pendingUIActions: UIAction[];

  // Settings (persisted)
  settings: HandsfreeSetupSettings;

  // Error state
  error: string | null;

  // Consent
  hasConsented: boolean;

  // Actions
  initialize: (tenantId: string, language?: string) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  shutdown: () => Promise<void>;
  setConsent: (consented: boolean) => void;
  updateSettings: (settings: Partial<HandsfreeSetupSettings>) => void;
  clearError: () => void;
  clearTranscript: () => void;
  executeUIAction: (action: UIAction) => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: HandsfreeSetupSettings = {
  language: 'en-IN',
  voiceName: 'Aoede',
  autoListen: false,
  confirmCriticalActions: true,
  showTranscript: true,
};

// ============================================================================
// Store Creation
// ============================================================================

export const useHandsfreeSetupStore = create<HandsfreeSetupState>()(
  persist(
    (set, get) => ({
      // Initial state
      isInitialized: false,
      isListening: false,
      isSpeaking: false,
      sessionId: null,
      status: 'idle',
      audioLevel: 0,
      transcript: [],
      currentIntent: null,
      activeForm: null,
      highlightedField: null,
      pendingUIActions: [],
      settings: DEFAULT_SETTINGS,
      error: null,
      hasConsented: false,

      // Actions

      /**
       * Initialize the handsfree agent
       */
      initialize: async (tenantId: string, language?: string) => {
        const agent = getHandsfreeSetupAgent();
        const state = get();

        try {
          set({ error: null, status: 'initializing' });

          const lang = language || state.settings.language;

          // Set up event listeners
          agent.onStatus((status) => {
            set({ status });
          });

          agent.onTranscript((transcript) => {
            set({ transcript });
          });

          agent.onLevel((level) => {
            set({ audioLevel: level });
          });

          agent.onAction((action) => {
            get().executeUIAction(action);
          });

          // Initialize the agent
          await agent.initialize(tenantId, lang);

          set({
            isInitialized: true,
            sessionId: 'active', // TODO: Get actual session ID if needed
            status: agent.getStatus(),
          });

          console.log('[HandsfreeStore] Initialized successfully');
        } catch (error) {
          console.error('[HandsfreeStore] Initialization failed:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize',
            status: 'error',
          });
          throw error;
        }
      },

      /**
       * Start listening to user's voice
       */
      startListening: async () => {
        const agent = getHandsfreeSetupAgent();
        const state = get();

        if (!state.isInitialized) {
          throw new Error('Agent not initialized');
        }

        if (state.isListening) {
          console.warn('[HandsfreeStore] Already listening');
          return;
        }

        try {
          await agent.startListening();
          set({ isListening: true, error: null });
        } catch (error) {
          console.error('[HandsfreeStore] Failed to start listening:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to start listening',
          });
          throw error;
        }
      },

      /**
       * Stop listening to user's voice
       */
      stopListening: () => {
        const agent = getHandsfreeSetupAgent();
        const state = get();

        if (!state.isListening) {
          return;
        }

        agent.stopListening();
        set({ isListening: false, audioLevel: 0 });
      },

      /**
       * Shutdown the agent
       */
      shutdown: async () => {
        const agent = getHandsfreeSetupAgent();

        try {
          await agent.shutdown();
          set({
            isInitialized: false,
            isListening: false,
            isSpeaking: false,
            sessionId: null,
            status: 'idle',
            audioLevel: 0,
            transcript: [],
            currentIntent: null,
            activeForm: null,
            highlightedField: null,
            error: null,
          });

          await disposeHandsfreeSetupAgent();
          console.log('[HandsfreeStore] Shutdown complete');
        } catch (error) {
          console.error('[HandsfreeStore] Shutdown error:', error);
        }
      },

      /**
       * Set user consent for using voice features
       */
      setConsent: (consented: boolean) => {
        set({ hasConsented: consented });
      },

      /**
       * Update agent settings
       */
      updateSettings: (newSettings: Partial<HandsfreeSetupSettings>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }));
      },

      /**
       * Clear error message
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Clear conversation transcript
       */
      clearTranscript: () => {
        set({ transcript: [] });
      },

      /**
       * Execute UI action from function call
       */
      executeUIAction: (action: UIAction) => {
        console.log('[HandsfreeStore] Executing UI action:', action);

        switch (action.type) {
          case 'ShowForm':
            set({
              activeForm: action.category || null,
              highlightedField: action.field || null,
            });

            // Add to pending actions for navigation
            set((state) => ({
              pendingUIActions: [...state.pendingUIActions, action],
            }));
            break;

          case 'Navigate':
            // Add to pending actions for navigation
            set((state) => ({
              pendingUIActions: [...state.pendingUIActions, action],
            }));
            break;

          case 'HighlightField':
            set({
              highlightedField: action.field || null,
            });
            break;

          case 'UpdateValue':
            // This would typically trigger a form update
            // The actual update happens via the function call on Rust side
            console.log('[HandsfreeStore] Value update:', action.field, action.value);
            break;

          default:
            console.warn('[HandsfreeStore] Unknown UI action type:', action);
        }
      },
    }),
    {
      name: 'handsfree-setup-storage',
      partialize: (state) => ({
        // Only persist settings and consent
        settings: state.settings,
        hasConsented: state.hasConsented,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks (for performance optimization)
// ============================================================================

export const useHandsfreeStatus = () =>
  useHandsfreeSetupStore((state) => state.status);

export const useHandsfreeListening = () =>
  useHandsfreeSetupStore((state) => state.isListening);

export const useHandsfreeSpeaking = () =>
  useHandsfreeSetupStore((state) => state.isSpeaking);

export const useHandsfreeTranscript = () =>
  useHandsfreeSetupStore((state) => state.transcript);

export const useHandsfreeAudioLevel = () =>
  useHandsfreeSetupStore((state) => state.audioLevel);

export const useHandsfreeSettings = () =>
  useHandsfreeSetupStore((state) => state.settings);

export const useHandsfreeError = () =>
  useHandsfreeSetupStore((state) => state.error);

export const useHandsfreeConsent = () =>
  useHandsfreeSetupStore((state) => state.hasConsented);

export const useHandsfreeActions = () =>
  useHandsfreeSetupStore((state) => ({
    initialize: state.initialize,
    startListening: state.startListening,
    stopListening: state.stopListening,
    shutdown: state.shutdown,
    setConsent: state.setConsent,
    updateSettings: state.updateSettings,
    clearError: state.clearError,
    clearTranscript: state.clearTranscript,
  }));

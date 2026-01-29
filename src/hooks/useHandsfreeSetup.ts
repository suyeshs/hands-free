/**
 * useHandsfreeSetup Hook
 * React hook for easy integration with the Handsfree Setup Agent
 *
 * Usage:
 * ```tsx
 * const { status, isListening, startListening, stopListening } = useHandsfreeSetup();
 * ```
 */

import { useEffect, useCallback, useState } from 'react';
import {
  useHandsfreeSetupStore,
  useHandsfreeStatus,
  useHandsfreeListening,
  useHandsfreeSpeaking,
  useHandsfreeTranscript,
  useHandsfreeAudioLevel,
  useHandsfreeSettings,
  useHandsfreeError,
  useHandsfreeConsent,
  useHandsfreeActions,
} from '../stores/handsfreeSetupStore';
import { useTenantStore } from '../stores/tenantStore';

// ============================================================================
// Main Hook
// ============================================================================

export interface UseHandsfreeSetupReturn {
  // State
  status: ReturnType<typeof useHandsfreeStatus>;
  isInitialized: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  transcript: ReturnType<typeof useHandsfreeTranscript>;
  settings: ReturnType<typeof useHandsfreeSettings>;
  error: string | null;
  hasConsented: boolean;

  // Actions
  initialize: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => Promise<void>;
  shutdown: () => Promise<void>;
  setConsent: (consented: boolean) => void;
  updateSettings: (settings: any) => void;
  clearError: () => void;
  clearTranscript: () => void;

  // Helper flags
  canListen: boolean;
  isActive: boolean;
}

/**
 * Main hook for using the Handsfree Setup Agent
 */
export function useHandsfreeSetup(): UseHandsfreeSetupReturn {
  // const navigate = useNavigate();

  // Store state
  const status = useHandsfreeStatus();
  const isInitialized = useHandsfreeSetupStore((state) => state.isInitialized);
  const isListening = useHandsfreeListening();
  const isSpeaking = useHandsfreeSpeaking();
  const audioLevel = useHandsfreeAudioLevel();
  const transcript = useHandsfreeTranscript();
  const settings = useHandsfreeSettings();
  const error = useHandsfreeError();
  const hasConsented = useHandsfreeConsent();

  // Store actions
  const actions = useHandsfreeActions();

  // Tenant context
  const tenantId = useTenantStore((state) => state.getTenantId());

  // Pending UI actions - DISABLED temporarily to fix infinite loop
  // TODO: Implement proper queue mechanism with ref tracking
  // const firstPendingAction = useHandsfreeSetupStore(
  //   (state) => state.pendingUIActions.length > 0 ? state.pendingUIActions[0] : null
  // );
  // const hasPendingActions = useHandsfreeSetupStore((state) => state.pendingUIActions.length > 0);

  // Initialize agent with tenant context
  const initialize = useCallback(async () => {
    if (!tenantId) {
      throw new Error('No active tenant');
    }

    if (!hasConsented) {
      throw new Error('User consent required');
    }

    await actions.initialize(tenantId, settings.language);
  }, [tenantId, hasConsented, settings.language, actions]);

  // Toggle listening on/off
  const toggleListening = useCallback(async () => {
    if (isListening) {
      actions.stopListening();
    } else {
      // Auto-initialize if not initialized
      if (!isInitialized) {
        await initialize();
      }
      await actions.startListening();
    }
  }, [isListening, isInitialized, initialize, actions]);

  // UI action executor (memoized to prevent infinite loops)
  // DISABLED: This entire function block is commented out
  // const executePendingUIAction = useCallback((action: UIAction) => {
  //   switch (action.type) {
  //     case 'ShowForm':
  //       if (action.category) {
  //         navigate(`/settings?category=${action.category}`);
  //         if (action.field) {
  //           setTimeout(() => {
  //             const element = document.getElementById(`field-${action.field}`);
  //             if (element) {
  //               element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  //               element.classList.add('highlight-field');
  //               setTimeout(() => {
  //                 element.classList.remove('highlight-field');
  //               }, 3000);
  //             }
  //           }, 300);
  //         }
  //       }
  //       break;
  //     case 'Navigate':
  //       if (action.page) {
  //         navigate(action.page);
  //       }
  //       break;
  //     case 'HighlightField':
  //       if (action.field) {
  //         const element = document.getElementById(`field-${action.field}`);
  //         if (element) {
  //           element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  //           element.classList.add('highlight-field');
  //           setTimeout(() => {
  //             element.classList.remove('highlight-field');
  //           }, 3000);
  //         }
  //       }
  //       break;
  //     default:
  //       break;
  //   }
  // }, [navigate]);

  // Execute pending UI actions - DISABLED temporarily to fix infinite loop
  // TODO: Re-implement with proper queue mechanism
  // useEffect(() => {
  //   if (!hasPendingActions || !firstPendingAction) {
  //     return;
  //   }
  //
  //   executePendingUIAction(firstPendingAction);
  //
  //   // Remove executed action (use setTimeout to avoid infinite loop)
  //   setTimeout(() => {
  //     useHandsfreeSetupStore.setState((state) => ({
  //       pendingUIActions: state.pendingUIActions.slice(1),
  //     }));
  //   }, 0);
  // }, [firstPendingAction, hasPendingActions, executePendingUIAction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't automatically shutdown - let user control this
      // If you want auto-shutdown on unmount, uncomment:
      // actions.shutdown();
    };
  }, []);

  return {
    // State
    status,
    isInitialized,
    isListening,
    isSpeaking,
    audioLevel,
    transcript,
    settings,
    error,
    hasConsented,

    // Actions
    initialize,
    startListening: actions.startListening,
    stopListening: actions.stopListening,
    toggleListening,
    shutdown: actions.shutdown,
    setConsent: actions.setConsent,
    updateSettings: actions.updateSettings,
    clearError: actions.clearError,
    clearTranscript: actions.clearTranscript,

    // Helper flags
    canListen: isInitialized && !isListening && !isSpeaking,
    isActive: isInitialized || isListening,
  };
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook for audio visualization
 */
export function useHandsfreeAudio() {
  const audioLevel = useHandsfreeAudioLevel();
  const isSpeaking = useHandsfreeSpeaking();
  const isListening = useHandsfreeListening();

  return {
    audioLevel,
    isSpeaking,
    isListening,
    isActive: isListening || isSpeaking,
  };
}

/**
 * Hook for transcript display with additional helpers
 */
export function useHandsfreeTranscriptHelpers() {
  const transcript = useHandsfreeSetupStore((state) => state.transcript);
  const clearTranscript = useHandsfreeSetupStore((state) => state.clearTranscript);

  return {
    transcript,
    clearTranscript,
    isEmpty: transcript.length === 0,
    lastEntry: transcript[transcript.length - 1] || null,
  };
}

/**
 * Hook for settings management
 */
export function useHandsfreeSettingsManagement() {
  const settings = useHandsfreeSettings();
  const updateSettings = useHandsfreeSetupStore((state) => state.updateSettings);

  return {
    settings,
    updateSettings,
    availableLanguages: [
      { code: 'en-IN', name: 'English (India)' },
      { code: 'hi-IN', name: 'Hindi (India)' },
      { code: 'en-US', name: 'English (US)' },
    ],
  };
}

/**
 * Hook for consent management with helpers
 */
export function useHandsfreeConsentHelpers() {
  const hasConsented = useHandsfreeSetupStore((state) => state.hasConsented);
  const setConsent = useHandsfreeSetupStore((state) => state.setConsent);

  return {
    hasConsented,
    grantConsent: () => setConsent(true),
    revokeConsent: () => setConsent(false),
  };
}

/**
 * Hook for error handling
 */
export function useHandsfreeErrors() {
  const error = useHandsfreeError();
  const clearError = useHandsfreeSetupStore((state) => state.clearError);

  return {
    error,
    hasError: error !== null,
    clearError,
  };
}

/**
 * Hook that automatically initializes on mount if consented
 */
export function useAutoHandsfreeSetup(autoStart: boolean = false) {
  const [isReady, setIsReady] = useState(false);
  const {
    isInitialized,
    hasConsented,
    initialize,
    startListening,
    status,
    error,
  } = useHandsfreeSetup();

  useEffect(() => {
    let mounted = true;

    const initAgent = async () => {
      if (!hasConsented || isInitialized || status === 'initializing') {
        return;
      }

      try {
        await initialize();
        if (mounted && autoStart) {
          await startListening();
        }
        if (mounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('[useAutoHandsfreeSetup] Initialization failed:', err);
      }
    };

    initAgent();

    return () => {
      mounted = false;
    };
  }, [hasConsented, isInitialized, initialize, startListening, autoStart, status]);

  return {
    isReady,
    error,
  };
}

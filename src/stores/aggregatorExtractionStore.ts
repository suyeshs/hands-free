/**
 * Aggregator Extraction Store
 * Manages the state of continuous DOM extraction from aggregator dashboards
 *
 * This store controls whether the extraction service is active, stores
 * extracted order states (including buttons, customer details), and
 * allows executing actions on the aggregator dashboard.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '../lib/platform';

// Types for extracted data
export interface ExtractedButton {
  type: string;
  selector: string;
  index: number;
  visible: boolean;
  enabled: boolean;
  text: string;
  matchesPattern: boolean;
  orderId: string;
  rect: { x: number; y: number; width: number; height: number } | null;
  tagName: string;
  className: string;
  dataAttributes?: Record<string, string> | null;
}

export interface ExtractedCustomer {
  name: string | null;
  phone: string | null;
  address: string | null;
  landmark?: string | null;
  flatNumber?: string | null;
  building?: string | null;
  orderCount?: number | null;
}

export interface ExtractedDeliveryPartner {
  name: string | null;
  phone: string | null;
  vehicleNumber?: string | null;
  eta?: string | null;
  status?: string | null;
}

export interface ExtractedOrderState {
  platform: 'swiggy' | 'zomato';
  orderId: string;
  orderNumber: string;
  dashboardStatus: string;
  buttons: ExtractedButton[];
  customer: ExtractedCustomer;
  deliveryPartner: ExtractedDeliveryPartner | null;
  prepTimeRemaining: number | null;
  total: number;
  isSelected: boolean;
  isExpanded: boolean;
  extractedAt: number;
}

export interface ActionResult {
  success: boolean;
  actionType: string;
  orderId: string;
  platform: string;
  message: string;
  timestamp: number;
  newState?: ExtractedOrderState;
}

interface ExtractionServiceStatus {
  swiggy: {
    active: boolean;
    lastExtraction: number | null;
    orderCount: number;
  };
  zomato: {
    active: boolean;
    lastExtraction: number | null;
    orderCount: number;
  };
}

interface AggregatorExtractionState {
  // Settings (persisted)
  extractionEnabled: boolean;
  extractionInterval: number; // milliseconds

  // Runtime state (not persisted)
  serviceStatus: ExtractionServiceStatus;
  orderStates: Map<string, ExtractedOrderState>;
  actionResults: ActionResult[];
  lastError: string | null;
  isLoading: boolean;

  // Listener cleanup
  _unlistenStates: UnlistenFn | null;
  _unlistenActions: UnlistenFn | null;
}

interface AggregatorExtractionActions {
  // Settings
  setExtractionEnabled: (enabled: boolean) => void;
  setExtractionInterval: (interval: number) => void;

  // Service control
  startExtractionService: (platform: 'swiggy' | 'zomato') => Promise<void>;
  stopExtractionService: (platform: 'swiggy' | 'zomato') => Promise<void>;
  startAllServices: () => Promise<void>;
  stopAllServices: () => Promise<void>;

  // Data operations
  refreshOrderStates: (platform: 'swiggy' | 'zomato') => Promise<void>;
  executeAction: (platform: 'swiggy' | 'zomato', orderId: string, actionType: string) => Promise<void>;

  // State updates (called from event listeners)
  updateOrderStates: (platform: string, states: ExtractedOrderState[]) => void;
  addActionResult: (result: ActionResult) => void;
  setError: (error: string | null) => void;

  // Getters
  getOrderState: (orderId: string) => ExtractedOrderState | undefined;
  getOrdersByPlatform: (platform: 'swiggy' | 'zomato') => ExtractedOrderState[];
  getAvailableActions: (orderId: string) => ExtractedButton[];

  // Lifecycle
  initializeListeners: () => Promise<void>;
  cleanupListeners: () => void;
}

type AggregatorExtractionStore = AggregatorExtractionState & AggregatorExtractionActions;

export const useAggregatorExtractionStore = create<AggregatorExtractionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      extractionEnabled: false,
      extractionInterval: 3000,
      serviceStatus: {
        swiggy: { active: false, lastExtraction: null, orderCount: 0 },
        zomato: { active: false, lastExtraction: null, orderCount: 0 },
      },
      orderStates: new Map(),
      actionResults: [],
      lastError: null,
      isLoading: false,
      _unlistenStates: null,
      _unlistenActions: null,

      // Settings
      setExtractionEnabled: (enabled) => {
        set({ extractionEnabled: enabled });

        // Auto-start/stop services based on setting
        if (enabled) {
          get().startAllServices();
        } else {
          get().stopAllServices();
        }
      },

      setExtractionInterval: (interval) => {
        set({ extractionInterval: interval });
      },

      // Service control
      startExtractionService: async (platform) => {
        if (!isTauri()) {
          console.warn('[ExtractionStore] Not in Tauri, cannot start extraction');
          return;
        }

        const { extractionInterval, extractionEnabled } = get();

        if (!extractionEnabled) {
          console.log('[ExtractionStore] Extraction disabled, not starting service');
          return;
        }

        try {
          set({ isLoading: true, lastError: null });

          await invoke('start_extraction_service', {
            platform,
            intervalMs: extractionInterval,
          });

          set((state) => ({
            serviceStatus: {
              ...state.serviceStatus,
              [platform]: {
                ...state.serviceStatus[platform],
                active: true,
              },
            },
            isLoading: false,
          }));

          console.log(`[ExtractionStore] Started extraction service for ${platform}`);
        } catch (error) {
          set({ lastError: String(error), isLoading: false });
          console.error(`[ExtractionStore] Failed to start extraction for ${platform}:`, error);
        }
      },

      stopExtractionService: async (platform) => {
        if (!isTauri()) return;

        try {
          await invoke('stop_extraction_service', { platform });

          set((state) => ({
            serviceStatus: {
              ...state.serviceStatus,
              [platform]: {
                ...state.serviceStatus[platform],
                active: false,
              },
            },
          }));

          console.log(`[ExtractionStore] Stopped extraction service for ${platform}`);
        } catch (error) {
          console.error(`[ExtractionStore] Failed to stop extraction for ${platform}:`, error);
        }
      },

      startAllServices: async () => {
        const { extractionEnabled } = get();
        if (!extractionEnabled) return;

        await Promise.all([
          get().startExtractionService('swiggy'),
          get().startExtractionService('zomato'),
        ]);
      },

      stopAllServices: async () => {
        await Promise.all([
          get().stopExtractionService('swiggy'),
          get().stopExtractionService('zomato'),
        ]);
      },

      // Data operations
      refreshOrderStates: async (platform) => {
        if (!isTauri()) return;

        try {
          await invoke('get_all_order_states', { platform });
        } catch (error) {
          console.error(`[ExtractionStore] Failed to refresh states for ${platform}:`, error);
        }
      },

      executeAction: async (platform, orderId, actionType) => {
        if (!isTauri()) {
          console.warn('[ExtractionStore] Not in Tauri, cannot execute action');
          return;
        }

        try {
          set({ isLoading: true, lastError: null });

          await invoke('execute_aggregator_action', {
            platform,
            orderId,
            actionType,
          });

          console.log(`[ExtractionStore] Executed ${actionType} for ${orderId} on ${platform}`);
        } catch (error) {
          set({ lastError: String(error), isLoading: false });
          console.error('[ExtractionStore] Failed to execute action:', error);
        }
      },

      // State updates
      updateOrderStates: (platform, states) => {
        set((state) => {
          const newMap = new Map(state.orderStates);

          states.forEach((orderState) => {
            newMap.set(orderState.orderId, orderState);
          });

          return {
            orderStates: newMap,
            serviceStatus: {
              ...state.serviceStatus,
              [platform]: {
                ...state.serviceStatus[platform as 'swiggy' | 'zomato'],
                lastExtraction: Date.now(),
                orderCount: states.length,
              },
            },
          };
        });
      },

      addActionResult: (result) => {
        set((state) => ({
          actionResults: [...state.actionResults.slice(-20), result],
          isLoading: false,
        }));
      },

      setError: (error) => {
        set({ lastError: error });
      },

      // Getters
      getOrderState: (orderId) => {
        return get().orderStates.get(orderId);
      },

      getOrdersByPlatform: (platform) => {
        const states = Array.from(get().orderStates.values());
        return states.filter((s) => s.platform === platform);
      },

      getAvailableActions: (orderId) => {
        const state = get().orderStates.get(orderId);
        if (!state) return [];

        return state.buttons.filter((b) => b.visible && b.enabled);
      },

      // Lifecycle
      initializeListeners: async () => {
        if (!isTauri()) return;

        // Clean up existing listeners first
        get().cleanupListeners();

        try {
          // Listen for extracted states
          const unlistenStates = await listen<{
            platform: string;
            states: ExtractedOrderState[];
            timestamp: number;
            count: number;
          }>('aggregator-states-extracted', (event) => {
            console.log(`[ExtractionStore] Received ${event.payload.count} states from ${event.payload.platform}`);
            get().updateOrderStates(event.payload.platform, event.payload.states);
          });

          // Listen for action results
          const unlistenActions = await listen<ActionResult>('aggregator-action-result', (event) => {
            console.log('[ExtractionStore] Received action result:', event.payload);
            get().addActionResult(event.payload);
          });

          set({
            _unlistenStates: unlistenStates,
            _unlistenActions: unlistenActions,
          });

          console.log('[ExtractionStore] Event listeners initialized');
        } catch (error) {
          console.error('[ExtractionStore] Failed to initialize listeners:', error);
        }
      },

      cleanupListeners: () => {
        const { _unlistenStates, _unlistenActions } = get();

        if (_unlistenStates) {
          _unlistenStates();
        }
        if (_unlistenActions) {
          _unlistenActions();
        }

        set({
          _unlistenStates: null,
          _unlistenActions: null,
        });
      },
    }),
    {
      name: 'aggregator-extraction-settings',
      // Only persist settings, not runtime state
      partialize: (state) => ({
        extractionEnabled: state.extractionEnabled,
        extractionInterval: state.extractionInterval,
      }),
    }
  )
);

// Helper hook for initialization
export function useInitializeExtractionService() {
  const { initializeListeners, extractionEnabled, startAllServices } = useAggregatorExtractionStore();

  // Initialize on mount
  const initialize = async () => {
    await initializeListeners();

    // Auto-start services if enabled
    if (extractionEnabled) {
      // Small delay to ensure dashboards are ready
      setTimeout(() => {
        startAllServices();
      }, 2000);
    }
  };

  return { initialize };
}

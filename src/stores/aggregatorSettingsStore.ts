/**
 * Aggregator Settings Store
 * Manages auto-accept rules and settings for aggregator orders
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AggregatorSettings,
  AggregatorSettingsState,
  AutoAcceptRule,
  RuleMatchResult,
  DEFAULT_AGGREGATOR_SETTINGS,
  createAutoAcceptRule,
} from '../types/aggregatorSettings';
import { AggregatorOrder } from '../types/aggregator';
import { MenuCategory } from '../types/pos';
import { mapItemNameToCategory } from '../lib/categoryMapper';

interface AggregatorSettingsStore extends AggregatorSettingsState {
  // Actions - Settings
  updateSettings: (settings: Partial<AggregatorSettings>) => void;
  setAutoAcceptEnabled: (enabled: boolean) => void;
  setShowAcceptNotification: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDefaultPrepTime: (minutes: number) => void;
  setCategoryMapping: (itemName: string, category: MenuCategory) => void;
  removeCategoryMapping: (itemName: string) => void;

  // Actions - Rules
  addRule: (rule: Partial<AutoAcceptRule>) => void;
  updateRule: (ruleId: string, updates: Partial<AutoAcceptRule>) => void;
  deleteRule: (ruleId: string) => void;
  toggleRule: (ruleId: string) => void;
  reorderRules: (ruleIds: string[]) => void; // For priority management

  // Evaluation
  shouldAutoAccept: (order: AggregatorOrder) => RuleMatchResult;
  evaluateRule: (rule: AutoAcceptRule, order: AggregatorOrder) => boolean;

  // Utilities
  getRuleById: (ruleId: string) => AutoAcceptRule | undefined;
  getActiveRules: () => AutoAcceptRule[];
}

export const useAggregatorSettingsStore = create<AggregatorSettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_AGGREGATOR_SETTINGS,
      rules: [],

      // Settings actions
      updateSettings: (settings) => {
        set({
          ...settings,
          updatedAt: new Date().toISOString(),
        });
      },

      setAutoAcceptEnabled: (enabled) => {
        set({
          autoAcceptEnabled: enabled,
          updatedAt: new Date().toISOString(),
        });
        console.log('[AggregatorSettings] Auto-accept', enabled ? 'enabled' : 'disabled');
      },

      setShowAcceptNotification: (enabled) => {
        set({
          showAcceptNotification: enabled,
          updatedAt: new Date().toISOString(),
        });
      },

      setSoundEnabled: (enabled) => {
        set({
          soundEnabled: enabled,
          updatedAt: new Date().toISOString(),
        });
      },

      setDefaultPrepTime: (minutes) => {
        set({
          defaultPrepTime: minutes,
          updatedAt: new Date().toISOString(),
        });
      },

      setCategoryMapping: (itemName, category) => {
        set((state) => ({
          categoryMapping: {
            ...state.categoryMapping,
            [itemName]: category,
          },
          updatedAt: new Date().toISOString(),
        }));
      },

      removeCategoryMapping: (itemName) => {
        set((state) => {
          const newMapping = { ...state.categoryMapping };
          delete newMapping[itemName];
          return {
            categoryMapping: newMapping,
            updatedAt: new Date().toISOString(),
          };
        });
      },

      // Rules actions
      addRule: (rulePartial) => {
        const newRule = createAutoAcceptRule(rulePartial);
        set((state) => ({
          rules: [...state.rules, newRule],
          updatedAt: new Date().toISOString(),
        }));
        console.log('[AggregatorSettings] Rule added:', newRule.name);
      },

      updateRule: (ruleId, updates) => {
        set((state) => ({
          rules: state.rules.map((rule) =>
            rule.id === ruleId
              ? { ...rule, ...updates, updatedAt: new Date().toISOString() }
              : rule
          ),
          updatedAt: new Date().toISOString(),
        }));
        console.log('[AggregatorSettings] Rule updated:', ruleId);
      },

      deleteRule: (ruleId) => {
        set((state) => ({
          rules: state.rules.filter((rule) => rule.id !== ruleId),
          updatedAt: new Date().toISOString(),
        }));
        console.log('[AggregatorSettings] Rule deleted:', ruleId);
      },

      toggleRule: (ruleId) => {
        set((state) => ({
          rules: state.rules.map((rule) =>
            rule.id === ruleId
              ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
              : rule
          ),
          updatedAt: new Date().toISOString(),
        }));
      },

      reorderRules: (ruleIds) => {
        const { rules } = get();
        const reorderedRules = ruleIds
          .map((id) => rules.find((r) => r.id === id))
          .filter((r): r is AutoAcceptRule => r !== undefined);

        set({
          rules: reorderedRules,
          updatedAt: new Date().toISOString(),
        });
      },

      // Evaluation function - CRITICAL LOGIC
      shouldAutoAccept: (order) => {
        const { autoAcceptEnabled } = get();

        // Master toggle check
        if (!autoAcceptEnabled) {
          return {
            matched: false,
            reason: 'Auto-accept is disabled',
          };
        }

        // Get active rules sorted by priority (highest first)
        const activeRules = get()
          .getActiveRules()
          .sort((a, b) => b.priority - a.priority);

        if (activeRules.length === 0) {
          return {
            matched: false,
            reason: 'No active rules configured',
          };
        }

        // Evaluate each rule
        for (const rule of activeRules) {
          if (get().evaluateRule(rule, order)) {
            console.log('[AggregatorSettings] Order matched rule:', rule.name);
            return {
              matched: true,
              rule,
              prepTime: rule.prepTime,
              reason: `Matched rule: ${rule.name}`,
            };
          }
        }

        return {
          matched: false,
          reason: 'No matching rules found',
        };
      },

      // Evaluate a single rule against an order
      evaluateRule: (rule, order) => {
        // Check aggregator match
        if (rule.aggregator !== 'all' && rule.aggregator !== order.aggregator) {
          return false;
        }

        // Check order value limits
        if (rule.minOrderValue && order.cart.total < rule.minOrderValue) {
          return false;
        }
        if (rule.maxOrderValue && order.cart.total > rule.maxOrderValue) {
          return false;
        }

        // Check time window (if specified)
        if (rule.timeWindow && rule.timeWindow.enabled) {
          const now = new Date();
          const currentDay = now.getDay(); // 0-6
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          // Check if current day is allowed
          if (!rule.timeWindow.days.includes(currentDay)) {
            return false;
          }

          // Check if current time is within window
          if (
            currentTime < rule.timeWindow.startTime ||
            currentTime > rule.timeWindow.endTime
          ) {
            return false;
          }
        }

        // Check category match
        if (rule.category !== 'all') {
          // Need to check if ALL items in order match the category
          const { categoryMapping } = get();
          let allItemsMatchCategory = true;

          for (const item of order.cart.items) {
            // Get category for this item
            let itemCategory: MenuCategory;

            // First check manual mapping
            if (categoryMapping[item.name]) {
              itemCategory = categoryMapping[item.name];
            } else {
              // Fall back to fuzzy matching
              itemCategory = mapItemNameToCategory(item.name);
            }

            // If any item doesn't match the rule's category, rule fails
            if (itemCategory !== rule.category) {
              allItemsMatchCategory = false;
              break;
            }
          }

          if (!allItemsMatchCategory) {
            return false;
          }
        }

        // All checks passed
        return true;
      },

      // Utilities
      getRuleById: (ruleId) => {
        return get().rules.find((rule) => rule.id === ruleId);
      },

      getActiveRules: () => {
        return get().rules.filter((rule) => rule.enabled);
      },
    }),
    {
      name: 'aggregator-settings',
      // Persist everything
      partialize: (state) => ({
        autoAcceptEnabled: state.autoAcceptEnabled,
        showAcceptNotification: state.showAcceptNotification,
        soundEnabled: state.soundEnabled,
        categoryMapping: state.categoryMapping,
        defaultPrepTime: state.defaultPrepTime,
        rules: state.rules,
        updatedAt: state.updatedAt,
      }),
    }
  )
);

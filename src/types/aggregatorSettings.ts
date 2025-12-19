/**
 * Aggregator Auto-Accept Settings Types
 * Defines rules for automatically accepting aggregator orders
 */

import { MenuCategory } from './pos';
import { AggregatorSource } from './aggregator';

/**
 * Time window for auto-accept rules
 * Defines specific hours when auto-accept should be active
 */
export interface AutoAcceptTimeWindow {
  enabled: boolean;
  startTime: string; // Format: "HH:mm" (24-hour)
  endTime: string; // Format: "HH:mm" (24-hour)
  days: number[]; // 0-6 (Sunday-Saturday)
}

/**
 * Auto-accept rule definition
 * Each rule can match specific criteria for automatic order acceptance
 */
export interface AutoAcceptRule {
  id: string;
  name: string; // User-friendly name for the rule
  enabled: boolean;

  // Matching criteria
  aggregator: 'all' | AggregatorSource; // Which aggregator(s) to apply to
  category: 'all' | MenuCategory; // Which menu category to apply to
  maxOrderValue?: number; // Maximum order value (optional)
  minOrderValue?: number; // Minimum order value (optional)

  // Order preparation
  prepTime: number; // Estimated prep time in minutes

  // Time restrictions
  timeWindow?: AutoAcceptTimeWindow; // Optional time window restrictions

  // Priority
  priority: number; // Higher priority rules are evaluated first (1-10)

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Global aggregator settings
 */
export interface AggregatorSettings {
  // Master control
  autoAcceptEnabled: boolean; // Master on/off toggle

  // Notification preferences
  showAcceptNotification: boolean; // Show notification when order is auto-accepted
  soundEnabled: boolean; // Play sound on auto-accept

  // Manual category mapping (for accurate auto-accept)
  // Maps menu item names to categories for aggregator orders
  categoryMapping: Record<string, MenuCategory>;

  // Default prep time for auto-accepted orders
  defaultPrepTime: number; // In minutes

  // Metadata
  updatedAt: string;
}

/**
 * Combined settings and rules
 */
export interface AggregatorSettingsState extends AggregatorSettings {
  rules: AutoAcceptRule[];
}

/**
 * Rule evaluation result
 */
export interface RuleMatchResult {
  matched: boolean;
  rule?: AutoAcceptRule;
  reason?: string; // Why the rule matched or didn't match
  prepTime?: number;
}

/**
 * Default settings
 */
export const DEFAULT_AGGREGATOR_SETTINGS: AggregatorSettings = {
  autoAcceptEnabled: false,
  showAcceptNotification: true,
  soundEnabled: false,
  categoryMapping: {},
  defaultPrepTime: 20,
  updatedAt: new Date().toISOString(),
};

/**
 * Helper: Create a new auto-accept rule with defaults
 */
export function createAutoAcceptRule(
  partial: Partial<AutoAcceptRule>
): AutoAcceptRule {
  const now = new Date().toISOString();
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: partial.name || 'New Rule',
    enabled: partial.enabled ?? true,
    aggregator: partial.aggregator || 'all',
    category: partial.category || 'all',
    maxOrderValue: partial.maxOrderValue,
    minOrderValue: partial.minOrderValue,
    prepTime: partial.prepTime || 20,
    timeWindow: partial.timeWindow,
    priority: partial.priority || 5,
    createdAt: now,
    updatedAt: now,
  };
}

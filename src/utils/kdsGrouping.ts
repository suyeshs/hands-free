/**
 * KDS Station Grouping Utility
 * Groups order items by kitchen station/prep category for efficient display
 */

import type { KitchenOrderItem, KitchenItemStatus } from '../types/kds';

/**
 * Station group configuration
 * Color scheme uses Tailwind color names for consistency
 */
export interface StationGroup {
  id: string;
  label: string;
  color: 'red' | 'blue' | 'amber' | 'cyan' | 'pink' | 'green' | 'slate';
  stations: string[]; // Lowercase station names that map to this group
  priority: number; // Display order (lower = first)
}

/**
 * Default station groups for Indian restaurant
 * Can be customized per tenant in the future
 */
export const DEFAULT_STATION_GROUPS: StationGroup[] = [
  {
    id: 'hot',
    label: 'HOT',
    color: 'red',
    stations: ['grill', 'wok', 'fryer', 'tandoor', 'hot', 'curry', 'main'],
    priority: 1,
  },
  {
    id: 'breads',
    label: 'BREADS',
    color: 'amber',
    stations: ['bread', 'roti', 'naan', 'paratha'],
    priority: 2,
  },
  {
    id: 'cold',
    label: 'COLD',
    color: 'blue',
    stations: ['cold', 'salad', 'raita', 'chutney', 'appetizer'],
    priority: 3,
  },
  {
    id: 'drinks',
    label: 'DRINKS',
    color: 'cyan',
    stations: ['beverage', 'bar', 'drink', 'juice', 'lassi', 'chai'],
    priority: 4,
  },
  {
    id: 'dessert',
    label: 'DESSERT',
    color: 'pink',
    stations: ['dessert', 'sweet', 'mithai', 'ice cream'],
    priority: 5,
  },
];

/**
 * Item name patterns for inferring station when not explicitly set
 * Maps regex patterns to station IDs
 */
const ITEM_NAME_PATTERNS: Array<{ pattern: RegExp; station: string }> = [
  // Breads
  { pattern: /\b(naan|roti|paratha|kulcha|bhatura|puri|chapati|bread)\b/i, station: 'breads' },

  // Drinks
  { pattern: /\b(lassi|chai|tea|coffee|juice|soda|water|nimbu|jal jeera|buttermilk|chaas)\b/i, station: 'drinks' },

  // Cold/Appetizers
  { pattern: /\b(raita|salad|papad|chutney|pickle|achar)\b/i, station: 'cold' },

  // Desserts
  { pattern: /\b(gulab jamun|kheer|halwa|jalebi|rasmalai|kulfi|ice cream|dessert|sweet|mithai|barfi|ladoo)\b/i, station: 'dessert' },

  // Rice dishes
  { pattern: /\b(biryani|pulao|rice|jeera rice|fried rice)\b/i, station: 'hot' },

  // Curries and main dishes (default to hot)
  { pattern: /\b(curry|masala|tikka|tandoori|kebab|paneer|chicken|mutton|lamb|fish|prawn|dal|sabzi|bhaji)\b/i, station: 'hot' },
];

/**
 * Infer station from item name using pattern matching
 * Returns the station ID or 'hot' as default
 */
export function inferStationFromName(itemName: string): string {
  for (const { pattern, station } of ITEM_NAME_PATTERNS) {
    if (pattern.test(itemName)) {
      return station;
    }
  }
  // Default to 'hot' for unknown items (most common in Indian cuisine)
  return 'hot';
}

/**
 * Get the station group for an item
 * Uses explicit station if set, otherwise infers from name
 */
export function getStationGroupForItem(
  item: KitchenOrderItem,
  groups: StationGroup[] = DEFAULT_STATION_GROUPS
): StationGroup {
  const itemStation = (item.station || inferStationFromName(item.name)).toLowerCase();

  // Find matching group
  const matchedGroup = groups.find(group =>
    group.stations.some(s => itemStation.includes(s) || s.includes(itemStation))
  );

  // Return matched group or default to first group (hot)
  return matchedGroup || groups[0];
}

/**
 * Grouped items result
 */
export interface GroupedItems {
  group: StationGroup;
  items: KitchenOrderItem[];
  pendingCount: number;
  inProgressCount: number;
  readyCount: number;
}

/**
 * Group order items by station
 * Returns only groups that have items, sorted by priority
 */
export function groupItemsByStation(
  items: KitchenOrderItem[],
  groups: StationGroup[] = DEFAULT_STATION_GROUPS
): GroupedItems[] {
  // Initialize map for grouping
  const groupMap = new Map<string, KitchenOrderItem[]>();

  // Group items
  for (const item of items) {
    const group = getStationGroupForItem(item, groups);
    const existing = groupMap.get(group.id) || [];
    existing.push(item);
    groupMap.set(group.id, existing);
  }

  // Convert to result array with stats
  const result: GroupedItems[] = [];

  for (const group of groups) {
    const groupItems = groupMap.get(group.id);
    if (groupItems && groupItems.length > 0) {
      result.push({
        group,
        items: groupItems,
        pendingCount: groupItems.filter(i => i.status === 'pending').length,
        inProgressCount: groupItems.filter(i => i.status === 'in_progress').length,
        readyCount: groupItems.filter(i => i.status === 'ready' || i.status === 'served').length,
      });
    }
  }

  // Sort by group priority
  result.sort((a, b) => a.group.priority - b.group.priority);

  return result;
}

/**
 * Get color classes for a station group
 * Returns Tailwind classes for background, border, and text
 */
export function getStationColorClasses(color: StationGroup['color']): {
  bg: string;
  border: string;
  text: string;
  bgSolid: string;
} {
  const colorMap: Record<StationGroup['color'], { bg: string; border: string; text: string; bgSolid: string }> = {
    red: {
      bg: 'bg-red-900/30',
      border: 'border-red-500',
      text: 'text-red-400',
      bgSolid: 'bg-red-600',
    },
    blue: {
      bg: 'bg-blue-900/30',
      border: 'border-blue-500',
      text: 'text-blue-400',
      bgSolid: 'bg-blue-600',
    },
    amber: {
      bg: 'bg-amber-900/30',
      border: 'border-amber-500',
      text: 'text-amber-400',
      bgSolid: 'bg-amber-600',
    },
    cyan: {
      bg: 'bg-cyan-900/30',
      border: 'border-cyan-500',
      text: 'text-cyan-400',
      bgSolid: 'bg-cyan-600',
    },
    pink: {
      bg: 'bg-pink-900/30',
      border: 'border-pink-500',
      text: 'text-pink-400',
      bgSolid: 'bg-pink-600',
    },
    green: {
      bg: 'bg-green-900/30',
      border: 'border-green-500',
      text: 'text-green-400',
      bgSolid: 'bg-green-600',
    },
    slate: {
      bg: 'bg-slate-900/30',
      border: 'border-slate-500',
      text: 'text-slate-400',
      bgSolid: 'bg-slate-600',
    },
  };

  return colorMap[color] || colorMap.slate;
}

/**
 * Get status color for an item
 */
export function getItemStatusColor(status: KitchenItemStatus): string {
  switch (status) {
    case 'pending':
      return 'text-slate-400';
    case 'in_progress':
      return 'text-blue-400';
    case 'ready':
    case 'served':
      return 'text-green-400';
    default:
      return 'text-slate-400';
  }
}

/**
 * Get status indicator symbol
 */
export function getItemStatusIndicator(status: KitchenItemStatus): string {
  switch (status) {
    case 'pending':
      return '○';
    case 'in_progress':
      return '◐';
    case 'ready':
    case 'served':
      return '●';
    default:
      return '○';
  }
}

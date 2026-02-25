/**
 * Subscription Menu Manager
 * CRUD interface for managing weekly subscription menus
 * Separate from a la carte menu - handles weekly rotating menus
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  Upload,
  Download,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '../../lib/utils';
import { cardVariants } from '../../lib/motion/variants';
import type { WeeklyMenu, SubscriptionMenuItem, MenuItem } from '../../types/subscription';

interface SubscriptionMenuManagerProps {
  tenantId: string;
}

export function SubscriptionMenuManager({ tenantId }: SubscriptionMenuManagerProps) {
  // State
  const [weeks, setWeeks] = useState<WeeklyMenu[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyMenu | null>(null);
  const [weekItems, setWeekItems] = useState<(SubscriptionMenuItem & { menuItem: MenuItem })[]>([]);
  const [availableItems, setAvailableItems] = useState<MenuItem[]>([]);
  const [selectedCuisine, setSelectedCuisine] = useState<string>('North Indian');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Modals
  const [showCreateWeekModal, setShowCreateWeekModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Create Week Form State
  const [weekFormData, setWeekFormData] = useState({
    weekNumber: 1,
    year: new Date().getFullYear(),
    cuisineType: 'North Indian',
    startDate: '',
    endDate: '',
  });

  // Load weeks on mount
  useEffect(() => {
    loadWeeks();
    loadAvailableItems();
  }, [tenantId]);

  // Load items when week changes
  useEffect(() => {
    if (selectedWeek) {
      loadWeekItems(selectedWeek.id);
    }
  }, [selectedWeek]);

  /**
   * Load all weekly menus
   */
  async function loadWeeks() {
    setIsLoading(true);
    setError(null);

    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      const result = await invoke('query_sqlite', {
        dbPath: await dbPath,
        query: `
          SELECT * FROM subscription_menu_weeks
          WHERE tenant_id = ?
          ORDER BY year DESC, week_number DESC
          LIMIT 20
        `,
        params: [tenantId],
      });

      // query_sqlite returns an array directly, no JSON parsing needed
      setWeeks(result as any[]);

      // Auto-select current week or most recent
      if (weeks.length > 0 && !selectedWeek) {
        setSelectedWeek(weeks[0]);
      }
    } catch (err) {
      setError(`Failed to load weekly menus: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Load items for a specific week
   */
  async function loadWeekItems(weekId: string) {
    setIsLoading(true);
    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      const result = await invoke('query_sqlite', {
        dbPath: await dbPath,
        query: `
          SELECT
            smi.id,
            smi.menu_week_id,
            smi.menu_item_id,
            smi.available,
            smi.max_orders_per_week,
            smi.sort_order,
            smi.created_at,
            mi.id as item_id,
            mi.name,
            mi.category_id as category,
            mi.price,
            mi.dietary_tags,
            mi.description,
            mi.active
          FROM subscription_menu_items smi
          JOIN menu_items mi ON smi.menu_item_id = mi.id
          WHERE smi.menu_week_id = ?
          ORDER BY smi.sort_order ASC
        `,
        params: [weekId],
      });

      // Transform flat result into nested structure expected by the component
      const items = (result as any[]).map((row: any) => ({
        id: row.id,
        menu_week_id: row.menu_week_id,
        menu_item_id: row.menu_item_id,
        available: row.available,
        max_orders_per_week: row.max_orders_per_week,
        sort_order: row.sort_order,
        created_at: row.created_at,
        menuItem: {
          id: row.item_id,
          name: row.name,
          category_id: row.category,
          price: row.price,
          dietary_tags: row.dietary_tags,
          description: row.description,
          active: row.active,
        },
      }));

      setWeekItems(items);
    } catch (err) {
      setError(`Failed to load menu items: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Load all available menu items (a la carte menu)
   */
  async function loadAvailableItems() {
    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      const result = await invoke('query_sqlite', {
        dbPath: await dbPath,
        query: `
          SELECT id, name, category_id as category, price, dietary_tags, description, active
          FROM menu_items
          WHERE active = 1
          ORDER BY category_id, name
        `,
        params: [], // Empty params array required even when query has no parameters
      });

      // query_sqlite returns an array directly, no JSON parsing needed
      setAvailableItems(result as any[]);
    } catch (err) {
      console.error('Failed to load available items:', err);
    }
  }

  /**
   * Create a new weekly menu
   */
  async function createWeeklyMenu(data: {
    weekNumber: number;
    year: number;
    cuisineType: string;
    startDate: string;
    endDate: string;
  }) {
    setIsLoading(true);
    setError(null);

    try {
      const id = generateId();
      const timestamp = new Date().toISOString();

      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `
          INSERT INTO subscription_menu_weeks
          (id, tenant_id, week_number, year, cuisine_type, start_date, end_date,
           active, published, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          String(id),
          String(tenantId),
          String(data.weekNumber),
          String(data.year),
          String(data.cuisineType),
          String(data.startDate),
          String(data.endDate),
          '1', // active
          '0', // not published yet
          String(timestamp),
          String(timestamp),
        ],
      });

      setSuccessMessage(`Created weekly menu for Week ${data.weekNumber}, ${data.year}`);
      loadWeeks();
      setShowCreateWeekModal(false);
    } catch (err) {
      setError(`Failed to create weekly menu: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Add item to weekly menu
   */
  async function addItemToWeek(menuItemId: string) {
    if (!selectedWeek) return;

    setIsLoading(true);
    setError(null);

    try {
      const id = generateId();
      const timestamp = new Date().toISOString();
      const sortOrder = weekItems.length + 1;

      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `
          INSERT INTO subscription_menu_items
          (id, menu_week_id, menu_item_id, available, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        params: [String(id), String(selectedWeek.id), String(menuItemId), '1', String(sortOrder), String(timestamp)],
      });

      setSuccessMessage('Item added to weekly menu');
      loadWeekItems(selectedWeek.id);
      setShowItemModal(false);
    } catch (err) {
      setError(`Failed to add item: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Remove item from weekly menu
   */
  async function removeItemFromWeek(subscriptionMenuItemId: string) {
    if (!selectedWeek) return;

    setIsLoading(true);
    setError(null);

    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `DELETE FROM subscription_menu_items WHERE id = ?`,
        params: [String(subscriptionMenuItemId)],
      });

      setSuccessMessage('Item removed from weekly menu');
      loadWeekItems(selectedWeek.id);
    } catch (err) {
      setError(`Failed to remove item: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Toggle item availability
   */
  async function toggleItemAvailability(item: SubscriptionMenuItem & { menuItem: MenuItem }) {
    setIsLoading(true);
    setError(null);

    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `UPDATE subscription_menu_items SET available = ? WHERE id = ?`,
        params: [item.available ? '0' : '1', String(item.id)],
      });

      setSuccessMessage(`Item ${item.available ? 'disabled' : 'enabled'}`);
      loadWeekItems(selectedWeek!.id);
    } catch (err) {
      setError(`Failed to update item: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Publish weekly menu (make visible to customers)
   */
  async function publishWeek(weekId: string) {
    console.log('publishWeek called', { weekId });
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      console.log('Publishing to database', { dbPath, weekId });

      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `UPDATE subscription_menu_weeks SET published = 1, updated_at = ? WHERE id = ?`,
        params: [String(new Date().toISOString()), String(weekId)],
      });

      console.log('Publish successful');
      setSuccessMessage('Weekly menu published to customers');
      await loadWeeks();

      // Update selected week to show published status
      if (selectedWeek && selectedWeek.id === weekId) {
        setSelectedWeek({ ...selectedWeek, published: true });
        await loadWeekItems(weekId);
      }
    } catch (err) {
      console.error('Failed to publish menu:', err);
      setError(`Failed to publish menu: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Delete weekly menu
   */
  async function deleteWeek(weekId: string) {
    if (!confirm('Are you sure you want to delete this weekly menu? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());

      // Delete items first (cascades)
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `DELETE FROM subscription_menu_items WHERE menu_week_id = ?`,
        params: [String(weekId)],
      });

      // Delete week
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `DELETE FROM subscription_menu_weeks WHERE id = ?`,
        params: [String(weekId)],
      });

      setSuccessMessage('Weekly menu deleted');
      setSelectedWeek(null);
      loadWeeks();
    } catch (err) {
      setError(`Failed to delete weekly menu: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Helper function to generate ID
  function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Get unique categories
  const categories = Array.from(new Set(availableItems.map(item => item.category)));

  // Filter available items based on search and filters
  const filteredAvailableItems = availableItems.filter((item) => {
    // Search filter
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    // Dietary filter
    const matchesDietary =
      dietaryFilter === 'all' ||
      (dietaryFilter === 'veg' && item.is_vegetarian) ||
      (dietaryFilter === 'non-veg' && !item.is_vegetarian);

    // Don't show items already in the week
    const alreadyAdded = weekItems.some((wi) => wi.menu_item_id === item.id);

    return matchesSearch && matchesCategory && matchesDietary && !alreadyAdded;
  });

  return (
    <div className="h-screen flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            🍱 Subscription Menu Manager
          </h1>
          <p className="text-muted-foreground">
            Manage weekly rotating menus for subscription service (separate from a la carte)
          </p>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateWeekModal(true)}
            className={cn(
              'px-4 py-2 rounded-lg flex items-center gap-2',
              'bg-gradient-to-br from-primary to-primary',
              'text-white font-medium text-sm',
              'shadow-lg shadow-primary/30 hover:shadow-primary/50'
            )}
          >
            <Plus className="w-4 h-4" />
            New Week
          </motion.button>
        </div>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel p-4 rounded-lg border border-red-500/30"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-medium mb-1">Error</p>
                <p className="text-sm text-foreground">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel p-4 rounded-lg border border-green-500/30"
          >
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-700 font-medium">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Week Selector - Grid View */}
      <div className="glass-panel p-4 rounded-lg">
        <div className="flex items-center gap-4 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-muted-foreground uppercase">Select Week</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {weeks.slice(0, 4).map((week) => (
            <motion.button
              key={week.id}
              onClick={() => setSelectedWeek(week)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'p-3 rounded-lg text-left transition-all',
                selectedWeek?.id === week.id
                  ? 'glass-panel border-2 border-primary shadow-lg shadow-primary/20'
                  : 'glass-panel border border-border hover:border-primary/50'
              )}
            >
              <p className="text-sm font-semibold text-foreground mb-1">
                Week {week.week_number}, {week.year}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                {week.start_date} to {week.end_date}
              </p>
              {week.published ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-500/20 px-2 py-0.5 rounded">
                  ✓ Published
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-500/20 px-2 py-0.5 rounded">
                  ⚠ Draft
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {selectedWeek && (
          <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
            {!selectedWeek.published && (
              <button
                onClick={() => {
                  console.log('Publish button clicked', { weekId: selectedWeek.id, itemCount: weekItems.length });
                  publishWeek(selectedWeek.id);
                }}
                disabled={weekItems.length === 0 || isLoading}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  weekItems.length === 0 || isLoading
                    ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 cursor-pointer'
                )}
                title={weekItems.length === 0 ? 'Add at least one item to publish' : 'Publish menu to customers'}
              >
                {isLoading ? 'Publishing...' : `Publish${weekItems.length === 0 ? ' (Add items first)' : ''}`}
              </button>
            )}
            <button
              onClick={() => deleteWeek(selectedWeek.id)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {selectedWeek ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Available Items (Left Panel - 40%) */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-lg flex flex-col min-h-0">
            <div className="flex-shrink-0 mb-4">
              <h3 className="text-lg font-bold text-foreground mb-2">Available Items</h3>
              <p className="text-sm text-muted-foreground mb-3">From a la carte menu</p>

              {/* Filters */}
              <div className="space-y-2 mb-3">
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'glass-panel text-foreground',
                    'border border-border',
                    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
                    'cursor-pointer'
                  )}
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                {/* Dietary Filter */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setDietaryFilter('all')}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      dietaryFilter === 'all'
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDietaryFilter('veg')}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      dietaryFilter === 'veg'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    🥗 Veg
                  </button>
                  <button
                    onClick={() => setDietaryFilter('non-veg')}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      dietaryFilter === 'non-veg'
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    🍗 Non-Veg
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2 rounded-lg',
                    'glass-panel text-foreground text-sm',
                    'border border-border',
                    'focus:outline-none focus:border-primary'
                  )}
                />
              </div>

              {/* Active Filters Badge */}
              {(selectedCategory !== 'all' || dietaryFilter !== 'all' || searchQuery) && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {filteredAvailableItems.length} items
                  </span>
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setDietaryFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-primary hover:text-primary/80"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* Item List - Scrollable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
              {filteredAvailableItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'p-2.5 rounded-lg glass-panel group',
                    'hover:bg-muted transition-colors relative'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate flex-1">
                          {item.name}
                        </p>
                        <p className="text-sm font-semibold text-primary flex-shrink-0">
                          ₹{item.price}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground truncate">{item.category}</p>
                        {item.is_vegetarian && <span className="text-xs">🥗</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => addItemToWeek(item.id)}
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                        'bg-primary/20 text-primary',
                        'hover:bg-primary hover:text-white',
                        'transition-all duration-200',
                        'group-hover:scale-110'
                      )}
                      title="Add to week menu"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {filteredAvailableItems.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No items found</p>
                </div>
              )}
            </div>
          </div>

          {/* Week Menu Items (Right Panel - 60%) */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-lg flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground mb-1">
                Week {selectedWeek.week_number} Menu - {selectedWeek.cuisine_type}
              </h3>
              <p className="text-sm text-muted-foreground">{weekItems.length} items</p>
            </div>

            {/* Item Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weekItems.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    whileHover="hover"
                    className={cn(
                      'p-4 rounded-lg glass-panel',
                      !item.available && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground mb-1">
                          {item.menuItem.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.menuItem.category}</p>
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        ₹{item.menuItem.price}
                      </p>
                    </div>

                    {item.max_orders_per_week && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Max: {item.max_orders_per_week}/week
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleItemAvailability(item)}
                        className={cn(
                          'flex-1 py-1.5 rounded text-xs font-medium',
                          item.available
                            ? 'bg-green-500/20 text-green-700 hover:bg-green-500/30'
                            : 'bg-gray-500/20 text-muted-foreground hover:bg-gray-500/30'
                        )}
                      >
                        {item.available ? '✓ Available' : '× Unavailable'}
                      </button>
                      <button
                        onClick={() => removeItemFromWeek(item.id)}
                        className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {weekItems.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-2">No items in this week's menu yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add items from the available items panel on the left
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No weekly menu selected</p>
            <button
              onClick={() => setShowCreateWeekModal(true)}
              className="text-primary hover:text-primary text-sm"
            >
              Create your first weekly menu →
            </button>
          </div>
        </div>
      )}

      {/* Create Week Modal */}
      {showCreateWeekModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-foreground mb-4">Create Weekly Menu</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create a new weekly menu for the subscription service. This is separate from your a la carte menu.
            </p>
            <div className="space-y-4">
              {/* Week Number and Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Week Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="53"
                    value={weekFormData.weekNumber}
                    onChange={(e) =>
                      setWeekFormData({ ...weekFormData, weekNumber: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 rounded-lg glass-panel border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Year</label>
                  <input
                    type="number"
                    min="2024"
                    max="2030"
                    value={weekFormData.year}
                    onChange={(e) =>
                      setWeekFormData({ ...weekFormData, year: parseInt(e.target.value) || new Date().getFullYear() })
                    }
                    className="w-full px-3 py-2 rounded-lg glass-panel border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Cuisine Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Cuisine Type
                </label>
                <select
                  value={weekFormData.cuisineType}
                  onChange={(e) => setWeekFormData({ ...weekFormData, cuisineType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg glass-panel border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="North Indian">North Indian</option>
                  <option value="South Indian">South Indian</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Continental">Continental</option>
                  <option value="Children's Menu">Children's Menu</option>
                  <option value="Mixed">Mixed Cuisine</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={weekFormData.startDate}
                  onChange={(e) => setWeekFormData({ ...weekFormData, startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg glass-panel border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={weekFormData.endDate}
                  onChange={(e) => setWeekFormData({ ...weekFormData, endDate: e.target.value })}
                  min={weekFormData.startDate}
                  className="w-full px-3 py-2 rounded-lg glass-panel border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateWeekModal(false);
                  // Reset form
                  setWeekFormData({
                    weekNumber: 1,
                    year: new Date().getFullYear(),
                    cuisineType: 'North Indian',
                    startDate: '',
                    endDate: '',
                  });
                }}
                className="flex-1 px-4 py-2 rounded-lg glass-panel hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!weekFormData.startDate || !weekFormData.endDate) {
                    setError('Please fill in all date fields');
                    return;
                  }
                  await createWeeklyMenu(weekFormData);
                  // Reset form on success
                  setWeekFormData({
                    weekNumber: 1,
                    year: new Date().getFullYear(),
                    cuisineType: 'North Indian',
                    startDate: '',
                    endDate: '',
                  });
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    setIsLoading(true);
    setError(null);

    try {
      const dbPath = await import('../../lib/database').then(m => m.getDatabaseFilePath());
      await invoke('execute_sqlite', {
        dbPath: await dbPath,
        query: `UPDATE subscription_menu_weeks SET published = 1, updated_at = ? WHERE id = ?`,
        params: [String(new Date().toISOString()), String(weekId)],
      });

      setSuccessMessage('Weekly menu published to customers');
      loadWeeks();
    } catch (err) {
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

  // Filter available items
  const filteredAvailableItems = availableItems.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    // Don't show items already in the week
    const alreadyAdded = weekItems.some((wi) => wi.menu_item_id === item.id);

    return matchesSearch && !alreadyAdded;
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
              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-400 font-medium">{successMessage}</p>
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

      {/* Week Selector */}
      <div className="glass-panel p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-muted-foreground uppercase">Select Week</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const currentIndex = weeks.findIndex((w) => w.id === selectedWeek?.id);
                if (currentIndex > 0) {
                  setSelectedWeek(weeks[currentIndex - 1]);
                }
              }}
              disabled={!selectedWeek || weeks.findIndex((w) => w.id === selectedWeek.id) === 0}
              className="p-2 rounded-lg glass-panel hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>

            {selectedWeek && (
              <div className="px-4 py-2 rounded-lg glass-panel min-w-[200px] text-center">
                <p className="text-sm font-semibold text-foreground">
                  Week {selectedWeek.week_number}, {selectedWeek.year}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedWeek.start_date} to {selectedWeek.end_date}
                </p>
                {selectedWeek.published ? (
                  <span className="text-xs text-green-400">✓ Published</span>
                ) : (
                  <span className="text-xs text-yellow-400">⚠ Draft</span>
                )}
              </div>
            )}

            <button
              onClick={() => {
                const currentIndex = weeks.findIndex((w) => w.id === selectedWeek?.id);
                if (currentIndex < weeks.length - 1) {
                  setSelectedWeek(weeks[currentIndex + 1]);
                }
              }}
              disabled={
                !selectedWeek || weeks.findIndex((w) => w.id === selectedWeek.id) === weeks.length - 1
              }
              className="p-2 rounded-lg glass-panel hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>

          {selectedWeek && (
            <div className="flex items-center gap-2">
              {!selectedWeek.published && (
                <button
                  onClick={() => publishWeek(selectedWeek.id)}
                  className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30"
                >
                  Publish
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
      </div>

      {/* Main Content */}
      {selectedWeek ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
          {/* Available Items (Left Panel - 40%) */}
          <div className="lg:col-span-1 glass-panel p-6 rounded-lg flex flex-col">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground mb-2">Available Items</h3>
              <p className="text-sm text-muted-foreground mb-4">From a la carte menu</p>

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
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredAvailableItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'p-3 rounded-lg glass-panel cursor-pointer',
                    'hover:bg-muted transition-colors'
                  )}
                  onClick={() => addItemToWeek(item.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">₹{item.price}</p>
                      {item.is_vegetarian && <span className="text-xs text-green-400">🥗 Veg</span>}
                    </div>
                  </div>
                  <button className="mt-2 w-full py-1 rounded bg-primary/20 text-primary text-xs hover:bg-primary/30">
                    + Add to Week
                  </button>
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
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
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

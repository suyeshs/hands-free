/**
 * Dine-In Pricing Manager
 * Allows managers to set custom dine-in prices and availability for menu items
 * Overrides persist locally and are independent of cloud menu sync
 */

import { useState, useEffect, useMemo } from 'react';
import { useMenuStore } from '../../stores/menuStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';
import { backendApi } from '../../lib/backendApi';

export function DineInPricingManager() {
  const {
    items,
    categories,
    dineInOverrides,
    dineInOverridesLoaded,
    loadDineInOverrides,
    saveDineInOverride,
    deleteDineInOverride,
    resetAllDineInOverrides,
    loadMenuFromDatabase,
  } = useMenuStore();

  const { user } = useAuthStore();
  const tenantId = user?.tenantId || '';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'success' | 'error' | null>(null);

  // Load overrides and menu on mount
  useEffect(() => {
    if (tenantId) {
      loadMenuFromDatabase();
      if (!dineInOverridesLoaded) {
        loadDineInOverrides(tenantId);
      }
    }
  }, [tenantId, dineInOverridesLoaded]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items.filter(item => item.active);

    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category_id === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [items, selectedCategory, searchQuery]);

  // Handle price save
  const handleSavePrice = async (itemId: string) => {
    if (!tenantId) return;
    setIsSaving(itemId);
    try {
      const price = editPrice.trim() === '' ? null : parseFloat(editPrice);
      const currentOverride = dineInOverrides.get(itemId);
      await saveDineInOverride(
        tenantId,
        itemId,
        price,
        currentOverride?.dineInAvailable ?? true
      );
      setEditingItem(null);
      setEditPrice('');
    } catch (error) {
      console.error('Failed to save dine-in price:', error);
      alert('Failed to save price');
    } finally {
      setIsSaving(null);
    }
  };

  // Handle availability toggle
  const handleToggleAvailability = async (itemId: string) => {
    if (!tenantId) return;
    setIsSaving(itemId);
    try {
      const currentOverride = dineInOverrides.get(itemId);
      const currentAvailable = currentOverride?.dineInAvailable ?? true;
      await saveDineInOverride(
        tenantId,
        itemId,
        currentOverride?.dineInPrice ?? null,
        !currentAvailable
      );
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    } finally {
      setIsSaving(null);
    }
  };

  // Handle reset to cloud price
  const handleResetToCloud = async (itemId: string) => {
    if (!tenantId) return;
    setIsSaving(itemId);
    try {
      await deleteDineInOverride(tenantId, itemId);
    } catch (error) {
      console.error('Failed to reset price:', error);
    } finally {
      setIsSaving(null);
    }
  };

  // Handle bulk reset
  const handleBulkReset = async () => {
    if (!tenantId) return;
    setIsResetting(true);
    try {
      const count = await resetAllDineInOverrides(tenantId);
      alert(`Reset ${count} pricing override${count !== 1 ? 's' : ''} to cloud prices.`);
    } catch (error) {
      console.error('Failed to bulk reset:', error);
      alert('Failed to reset prices');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle sync to cloud D1
  const handleSyncToCloud = async () => {
    if (!tenantId || dineInOverrides.size === 0) return;
    setIsSyncing(true);
    setLastSyncStatus(null);
    try {
      // Convert Map to array of overrides
      const overridesToSync = Array.from(dineInOverrides.values()).map(override => ({
        menuItemId: override.menuItemId,
        dineInPrice: override.dineInPrice,
        dineInAvailable: override.dineInAvailable,
      }));

      const syncedCount = await backendApi.bulkSaveDineInPricingOverrides(tenantId, overridesToSync);
      setLastSyncStatus('success');
      console.log(`[DineInPricing] Synced ${syncedCount} overrides to cloud`);

      // Clear status after 3 seconds
      setTimeout(() => setLastSyncStatus(null), 3000);
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
      setLastSyncStatus('error');
      alert(`Failed to sync to cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Stats
  const overrideCount = dineInOverrides.size;
  const hiddenCount = Array.from(dineInOverrides.values()).filter(o => !o.dineInAvailable).length;
  const priceOverrideCount = Array.from(dineInOverrides.values()).filter(o => o.dineInPrice !== null).length;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Please log in to manage dine-in pricing.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Dine-In Pricing
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Set custom prices for dine-in orders. Changes persist across menu syncs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncToCloud}
            disabled={overrideCount === 0 || isSyncing}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              overrideCount === 0 || isSyncing
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : lastSyncStatus === 'success'
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : lastSyncStatus === 'error'
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
            )}
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </>
            ) : lastSyncStatus === 'success' ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Synced!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Sync to Cloud
              </>
            )}
          </button>
          <button
            onClick={handleBulkReset}
            disabled={overrideCount === 0 || isResetting}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              overrideCount === 0 || isResetting
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            )}
          >
            {isResetting ? 'Resetting...' : `Reset All (${overrideCount})`}
          </button>
        </div>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-border">
          <div className="text-2xl font-bold">{items.filter(i => i.active).length}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Items</div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-border">
          <div className="text-2xl font-bold text-accent">{priceOverrideCount}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Custom Prices</div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-border">
          <div className="text-2xl font-bold text-amber-500">{hiddenCount}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Hidden Items</div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-border">
          <div className="text-2xl font-bold text-green-500">{items.filter(i => i.active).length - hiddenCount}</div>
          <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Available</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="neo-input px-3 py-2 rounded-lg min-w-[200px] bg-surface border border-border"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items..."
          className="neo-input px-3 py-2 rounded-lg flex-1 min-w-[200px] bg-surface border border-border"
        />
      </div>

      {/* Items Table */}
      <div className="glass-panel overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left p-4 font-bold text-xs uppercase tracking-wider">Item</th>
                <th className="text-left p-4 font-bold text-xs uppercase tracking-wider">Category</th>
                <th className="text-right p-4 font-bold text-xs uppercase tracking-wider">Cloud Price</th>
                <th className="text-right p-4 font-bold text-xs uppercase tracking-wider">Dine-In Price</th>
                <th className="text-center p-4 font-bold text-xs uppercase tracking-wider">Available</th>
                <th className="text-center p-4 font-bold text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const override = dineInOverrides.get(item.id);
                const hasOverride = override?.dineInPrice !== null && override?.dineInPrice !== undefined;
                const isAvailable = override?.dineInAvailable ?? true;
                const isEditing = editingItem === item.id;
                const isSavingThis = isSaving === item.id;

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      !isAvailable && "opacity-50 bg-muted/30"
                    )}
                  >
                    {/* Item Name */}
                    <td className="p-4">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                          {item.description}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="p-4 text-sm text-muted-foreground">
                      {categories.find(c => c.id === item.category_id)?.name || item.category_id}
                    </td>

                    {/* Cloud Price (readonly) */}
                    <td className="p-4 text-right font-mono text-muted-foreground">
                      Rs. {item.price.toFixed(2)}
                    </td>

                    {/* Dine-In Price (editable) */}
                    <td className="p-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            placeholder={item.price.toString()}
                            className="w-24 px-2 py-1 rounded text-right font-mono bg-surface border border-border"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSavePrice(item.id);
                              if (e.key === 'Escape') { setEditingItem(null); setEditPrice(''); }
                            }}
                          />
                          <button
                            onClick={() => handleSavePrice(item.id)}
                            disabled={isSavingThis}
                            className="px-2 py-1 rounded bg-green-500 text-white text-xs font-medium"
                          >
                            {isSavingThis ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingItem(null); setEditPrice(''); }}
                            className="px-2 py-1 rounded bg-muted text-xs font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingItem(item.id);
                            setEditPrice(override?.dineInPrice?.toString() || '');
                          }}
                          className={cn(
                            "font-mono px-2 py-1 rounded transition-colors",
                            hasOverride
                              ? "bg-accent/20 text-accent font-bold"
                              : "hover:bg-muted"
                          )}
                        >
                          Rs. {(override?.dineInPrice ?? item.price).toFixed(2)}
                          {hasOverride && <span className="ml-1 text-xs">*</span>}
                        </button>
                      )}
                    </td>

                    {/* Availability Toggle */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleToggleAvailability(item.id)}
                        disabled={isSavingThis}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          isAvailable ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                            isAvailable ? "translate-x-6" : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      {(hasOverride || !isAvailable) && (
                        <button
                          onClick={() => handleResetToCloud(item.id)}
                          disabled={isSavingThis}
                          className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 font-medium"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            No menu items found matching your filters.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="glass-panel p-4 rounded-xl border border-accent/20 bg-accent/5">
        <h4 className="font-semibold flex items-center gap-2 mb-2">
          How Dine-In Pricing Works
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- <span className="text-accent font-bold">Highlighted prices</span> indicate custom dine-in pricing (marked with *)</li>
          <li>- Toggle availability to hide items from the dine-in menu</li>
          <li>- Cloud prices remain unchanged - overrides only affect dine-in orders</li>
          <li>- Pricing overrides persist across menu syncs from the cloud</li>
          <li>- Click "Reset" to revert an item to its cloud price</li>
          <li>- <span className="text-blue-500 font-bold">Sync to Cloud</span> pushes all overrides to the cloud database for multi-device sync</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Inventory List Component
 * Displays inventory items with filtering, searching, and quick actions
 */

import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  InventoryItem,
  InventoryCategory,
  InventoryUnit,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
} from '../../types/inventory';

interface InventoryListProps {
  items: InventoryItem[];
  onAdjustStock: (itemId: string, change: number, reason: string) => Promise<void>;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => Promise<void>;
  isLoading?: boolean;
}

export function InventoryList({
  items,
  onAdjustStock,
  onEditItem,
  onDeleteItem,
  isLoading,
}: InventoryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'all'>('all');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'category' | 'updated'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Quick adjust modal state
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Delete confirmation state
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query) ||
          item.storageLocation?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // Low stock filter
    if (showLowStock) {
      result = result.filter((item) => item.currentStock <= item.reorderLevel);
    }

    // Expiring soon filter (within 7 days)
    if (showExpiringSoon) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      result = result.filter((item) => {
        if (!item.expiryDate) return false;
        return new Date(item.expiryDate) <= sevenDaysFromNow;
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stock':
          comparison = a.currentStock - b.currentStock;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'updated':
          comparison = new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
          break;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, searchQuery, categoryFilter, showLowStock, showExpiringSoon, sortBy, sortDir]);

  // Handle stock adjustment
  const handleAdjustStock = async () => {
    if (!adjustingItem || adjustAmount === 0) return;

    setIsAdjusting(true);
    try {
      await onAdjustStock(adjustingItem.id, adjustAmount, adjustReason || 'Manual adjustment');
      setAdjustingItem(null);
      setAdjustAmount(0);
      setAdjustReason('');
    } finally {
      setIsAdjusting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      await onDeleteItem(deletingItem.id);
      setDeletingItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Get stock status
  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= 0) return 'out';
    if (item.currentStock <= item.reorderLevel) return 'low';
    return 'ok';
  };

  // Get expiry status
  const getExpiryStatus = (item: InventoryItem) => {
    if (!item.expiryDate) return null;
    const daysUntil = Math.ceil(
      (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil < 0) return 'expired';
    if (daysUntil <= 3) return 'critical';
    if (daysUntil <= 7) return 'warning';
    return null;
  };

  // Toggle sort
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full neo-inset rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as InventoryCategory | 'all')}
          className="neo-inset rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Categories</option>
          {Object.entries(INVENTORY_CATEGORIES).map(([key, { label, icon }]) => (
            <option key={key} value={key}>
              {icon} {label}
            </option>
          ))}
        </select>

        {/* Quick Filters */}
        <button
          onClick={() => setShowLowStock(!showLowStock)}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-all',
            showLowStock
              ? 'neo-raised bg-destructive/20 text-destructive'
              : 'neo-raised-sm text-foreground hover:neo-hover'
          )}
        >
          Low Stock
        </button>

        <button
          onClick={() => setShowExpiringSoon(!showExpiringSoon)}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-all',
            showExpiringSoon
              ? 'neo-raised bg-warning/20 text-warning'
              : 'neo-raised-sm text-foreground hover:neo-hover'
          )}
        >
          Expiring Soon
        </button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredItems.length} of {items.length} items
      </div>

      {/* Items Table */}
      <div className="neo-inset rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-2">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  Item {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('category')}
                >
                  Category {sortBy === 'category' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-right text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('stock')}
                >
                  Stock {sortBy === 'stock' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Expiry</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => {
                const stockStatus = getStockStatus(item);
                const expiryStatus = getExpiryStatus(item);
                const unit = INVENTORY_UNITS[item.unit as InventoryUnit] || { label: item.unit, abbreviation: item.unit };

                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* Item Name */}
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{item.name}</div>
                        {item.sku && (
                          <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-foreground">
                        <span>{INVENTORY_CATEGORIES[item.category].icon}</span>
                        <span>{INVENTORY_CATEGORIES[item.category].label}</span>
                      </span>
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={cn(
                            'font-medium',
                            stockStatus === 'out' && 'text-destructive',
                            stockStatus === 'low' && 'text-warning',
                            stockStatus === 'ok' && 'text-success'
                          )}
                        >
                          {item.currentStock} {unit?.abbreviation}
                        </span>
                        {stockStatus !== 'ok' && (
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              stockStatus === 'out' && 'bg-destructive-light text-destructive',
                              stockStatus === 'low' && 'bg-warning-light text-warning'
                            )}
                          >
                            {stockStatus === 'out' ? 'OUT' : 'LOW'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Reorder at {item.reorderLevel} {unit?.abbreviation}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right">
                      {item.pricePerUnit ? (
                        <span className="text-sm text-foreground">
                          Rs. {item.pricePerUnit.toFixed(2)}/{unit?.abbreviation}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">
                        {item.storageLocation || '-'}
                      </span>
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3">
                      {item.expiryDate ? (
                        <span
                          className={cn(
                            'text-sm',
                            expiryStatus === 'expired' && 'text-destructive font-medium',
                            expiryStatus === 'critical' && 'text-destructive',
                            expiryStatus === 'warning' && 'text-warning',
                            !expiryStatus && 'text-muted-foreground'
                          )}
                        >
                          {new Date(item.expiryDate).toLocaleDateString()}
                          {expiryStatus === 'expired' && ' (Expired)'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Quick adjust buttons */}
                        <button
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustAmount(-1);
                            setAdjustReason('Used');
                          }}
                          className="p-2 neo-raised-sm hover:bg-destructive/20 rounded transition-all text-destructive"
                          title="Decrease stock"
                        >
                          -
                        </button>
                        <button
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustAmount(1);
                            setAdjustReason('Received');
                          }}
                          className="p-2 neo-raised-sm hover:bg-success/20 rounded transition-all text-success"
                          title="Increase stock"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onEditItem(item)}
                          className="p-2 neo-raised-sm hover:bg-muted rounded transition-all"
                          title="Edit item"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="p-2 neo-raised-sm hover:bg-destructive/20 rounded transition-all text-destructive"
                          title="Delete item"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <div className="text-4xl mb-3">📦</div>
            <p>No items found</p>
            {(searchQuery || categoryFilter !== 'all' || showLowStock || showExpiringSoon) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setShowLowStock(false);
                  setShowExpiringSoon(false);
                }}
                className="mt-2 text-primary hover:text-primary/80 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-foreground">Adjust Stock</h3>
            <p className="text-muted-foreground mb-4">
              Adjusting: <span className="text-foreground font-medium">{adjustingItem.name}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Current stock: {adjustingItem.currentStock} {INVENTORY_UNITS[adjustingItem.unit as InventoryUnit]?.abbreviation || adjustingItem.unit}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Adjustment Amount</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                  className="w-full neo-inset rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter amount (negative to decrease)"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  New stock will be:{' '}
                  <span
                    className={cn(
                      'font-medium',
                      adjustingItem.currentStock + adjustAmount < 0 && 'text-destructive'
                    )}
                  >
                    {Math.max(0, adjustingItem.currentStock + adjustAmount)}{' '}
                    {INVENTORY_UNITS[adjustingItem.unit as InventoryUnit]?.abbreviation || adjustingItem.unit}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full neo-inset rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Received delivery, Used in kitchen"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setAdjustingItem(null);
                  setAdjustAmount(0);
                  setAdjustReason('');
                }}
                disabled={isAdjusting}
                className="flex-1 py-3 neo-raised-sm hover:neo-hover disabled:opacity-50 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustStock}
                disabled={isAdjusting || adjustAmount === 0}
                className="flex-1 py-3 neo-raised-sm bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-50 rounded-xl font-bold transition-all"
              >
                {isAdjusting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-destructive">Delete Item</h3>
            <p className="text-foreground mb-4">
              Are you sure you want to delete{' '}
              <span className="font-medium">{deletingItem.name}</span>?
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              This action cannot be undone. All transaction history for this item will be preserved.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="flex-1 py-3 neo-raised-sm hover:neo-hover disabled:opacity-50 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 neo-raised-sm bg-destructive/20 hover:bg-destructive/30 text-destructive disabled:opacity-50 rounded-xl font-bold transition-all"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Menu Override Manager Component
 * Manage menu price and availability overrides per location
 */

import { useState, useEffect } from 'react';
import {
  DollarSign,
  Eye,
  EyeOff,
  RotateCcw,
  Edit3,
  Check,
  X,
  AlertCircle,
  Search,
} from 'lucide-react';
import { useChainStore } from '../../stores/chainStore';
import { useMenuStore } from '../../stores/menuStore';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface MenuOverrideManagerProps {
  tenantId: string;
  chainId: string;
}

export function MenuOverrideManager({ tenantId }: MenuOverrideManagerProps) {
  const {
    menuOverrides,
    isLoading: chainLoading,
    error: chainError,
    loadMenuOverrides,
    setMenuOverride,
    removeMenuOverride,
  } = useChainStore();

  const {
    items: menuItems,
    categories,
    loadMenuFromDatabase,
    isLoading: menuLoading,
  } = useMenuStore();

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [savingOverride, setSavingOverride] = useState<string | null>(null);

  // Load menu and overrides on mount
  useEffect(() => {
    loadMenuFromDatabase();
    if (tenantId) {
      loadMenuOverrides(tenantId);
    }
  }, [tenantId, loadMenuFromDatabase, loadMenuOverrides]);

  // Get override for a menu item
  const getOverride = (itemId: string) => {
    return menuOverrides.find(o => o.menuItemId === itemId);
  };

  // Start editing an item
  const handleStartEdit = (itemId: string, currentPrice: number) => {
    const override = getOverride(itemId);
    setEditingItem(itemId);
    setEditPrice((override?.priceOverride || currentPrice).toString());
    setEditReason(override?.overrideReason || '');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditPrice('');
    setEditReason('');
  };

  // Save price override
  const handleSavePriceOverride = async (itemId: string, itemName: string) => {
    const price = parseFloat(editPrice);

    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    if (!editReason.trim()) {
      toast.error('Please provide a reason for the override');
      return;
    }

    setSavingOverride(itemId);
    try {
      const override = getOverride(itemId);
      await setMenuOverride(tenantId, itemId, {
        priceOverride: price,
        availabilityOverride: override?.availabilityOverride ?? null,
        overrideReason: editReason.trim(),
      });

      toast.success(`Price override saved for ${itemName}`);
      handleCancelEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save override');
    } finally {
      setSavingOverride(null);
    }
  };

  // Toggle availability override
  const handleToggleAvailability = async (itemId: string, itemName: string, currentAvailability: boolean) => {
    const override = getOverride(itemId);
    const newAvailability = (override && override.availabilityOverride !== null)
      ? !override.availabilityOverride
      : !currentAvailability;

    const reason = newAvailability
      ? 'Location-specific availability enabled'
      : 'Location-specific availability disabled';

    setSavingOverride(itemId);
    try {
      await setMenuOverride(tenantId, itemId, {
        priceOverride: override?.priceOverride ?? null,
        availabilityOverride: newAvailability,
        overrideReason: override?.overrideReason || reason,
      });

      toast.success(`Availability updated for ${itemName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update availability');
    } finally {
      setSavingOverride(null);
    }
  };

  // Remove override
  const handleRemoveOverride = async (itemId: string, itemName: string) => {
    if (!confirm(`Remove all overrides for ${itemName}?`)) {
      return;
    }

    try {
      await removeMenuOverride(tenantId, itemId);
      toast.success(`Overrides removed for ${itemName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove override');
    }
  };

  // Reset all overrides
  const handleResetAll = async () => {
    if (!confirm('Remove ALL menu overrides for this location? This cannot be undone.')) {
      return;
    }

    try {
      for (const override of menuOverrides) {
        await removeMenuOverride(tenantId, override.menuItemId);
      }
      toast.success('All overrides reset');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset overrides');
    }
  };

  // Filter menu items
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const itemCategory = categories.find(c => c.id === item.category_id)?.name || 'Unknown';
    const matchesCategory = selectedCategory === 'all' || itemCategory === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const isLoading = chainLoading || menuLoading;

  if (chainError) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-border">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>{chainError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Menu Overrides</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {menuOverrides.length} Active Override{menuOverrides.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAll}
            disabled={menuOverrides.length === 0 || isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-xs font-bold uppercase disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu items..."
              className="w-full bg-white/5 border border-white/10 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white/5 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Menu Items Table */}
      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-border text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading menu...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-border text-center">
          <p className="text-muted-foreground">No menu items found</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-white/5">
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Item
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Category
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Master Price
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Override Price
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Available
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Reason
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const override = getOverride(item.id!);
                  const isEditing = editingItem === item.id;
                  const isSaving = savingOverride === item.id;
                  const hasOverride = !!override;
                  // const effectivePrice = override?.priceOverride ?? item.price; (Unused)
                  // Removing unused effectivePrice variable if it is truly unused. The user log says it is unused.
                  // But wait, checking the code, it is indeed defined but not used in the render?
                  // Line 318 uses item.price. Line 323 uses override?.priceOverride.
                  // I will remove the line.
                  const isAvailable = override?.availabilityOverride ?? true;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-border hover:bg-white/5 transition-colors",
                        hasOverride && "bg-blue-500/5"
                      )}
                    >
                      {/* Item Name */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {categories.find(c => c.id === item.category_id)?.name || 'Unknown'}
                      </td>

                      {/* Master Price */}
                      <td className="px-4 py-3 text-right text-sm font-mono">
                        ₹{item.price.toFixed(2)}
                      </td>

                      {/* Override Price */}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            step="0.01"
                            min="0"
                            className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        ) : override?.priceOverride !== null && override?.priceOverride !== undefined ? (
                          <span className="text-sm font-mono text-blue-400">
                            ₹{override.priceOverride.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleAvailability(item.id!, item.name, isAvailable)}
                          disabled={isSaving}
                          className={cn(
                            "w-8 h-8  flex items-center justify-center transition-colors disabled:opacity-50",
                            isAvailable
                              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          )}
                        >
                          {isAvailable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="Reason for override"
                            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        ) : override?.overrideReason ? (
                          <span className="text-xs text-muted-foreground">{override.overrideReason}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSavePriceOverride(item.id!, item.name)}
                                disabled={isSaving}
                                className="w-8 h-8 bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="w-8 h-8 bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(item.id!, item.price)}
                                disabled={isSaving}
                                className="w-8 h-8 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="Edit price"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {hasOverride && (
                                <button
                                  onClick={() => handleRemoveOverride(item.id!, item.name)}
                                  disabled={isSaving}
                                  className="w-8 h-8 bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
                                  title="Remove override"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="glass-panel p-4 border border-blue-500/30 bg-blue-500/5">
        <p className="text-xs text-blue-300">
          <strong>Tip:</strong> Menu overrides allow you to set location-specific pricing and availability without affecting the master menu.
        </p>
      </div>
    </div>
  );
}

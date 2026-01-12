/**
 * ComboEditor Component
 * Modal for creating and editing combo meal configurations
 * Enhanced with menu item selection for rice, roti, and other items
 */

import { useState, useEffect, useMemo } from 'react';
import { MenuItem, ComboGroup, ComboGroupItem } from '../../types';
import { saveComboConfiguration, getComboGroups } from '../../lib/comboService';
import { useMenuStore } from '../../stores/menuStore';
import { cn } from '../../lib/utils';

interface ComboEditorProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: MenuItem | null;
  onSaved: () => void;
}

interface EditingItem {
  groupIndex: number;
  itemIndex: number | null; // null means adding new
  item: Partial<ComboGroupItem>;
}

// Keywords for filtering menu items by type
const ITEM_FILTER_KEYWORDS = {
  rice: ['rice', 'biryani', 'pulao', 'fried rice', 'jeera rice', 'steamed rice', 'veg rice', 'chicken rice', 'mutton rice'],
  'puttu-otti': ['puttu', 'otti', 'appam', 'idiyappam', 'pathiri', 'kadala', 'steamed cake'],
  roti: ['roti', 'naan', 'paratha', 'chapati', 'kulcha', 'bread', 'tandoori roti', 'butter naan', 'garlic naan', 'laccha paratha', 'rumali roti'],
  dal: ['dal', 'daal', 'lentil'],
  curry: ['curry', 'gravy', 'masala', 'sabzi', 'kadhi'],
  sides: ['raita', 'papad', 'papadum', 'papadam', 'pappadam', 'papputtu', 'pickle', 'chutney', 'salad', 'achar', 'yogurt', 'curd'],
};

export function ComboEditor({ isOpen, onClose, menuItem, onSaved }: ComboEditorProps) {
  const [isCombo, setIsCombo] = useState(false);
  const [comboGroups, setComboGroups] = useState<ComboGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<{ index: number; name: string } | null>(null);

  // Menu item selection state
  const [showMenuItemPicker, setShowMenuItemPicker] = useState<{ groupIndex: number } | null>(null);
  const [menuItemFilter, setMenuItemFilter] = useState<keyof typeof ITEM_FILTER_KEYWORDS | 'all'>('all');
  const [menuItemSearch, setMenuItemSearch] = useState('');

  // Get menu items from store
  const menuItems = useMenuStore((state) => state.items);

  // Filter menu items based on selected filter and search
  const filteredMenuItems = useMemo(() => {
    let items = menuItems.filter(item => item.id !== menuItem?.id); // Exclude current item

    // Apply keyword filter
    if (menuItemFilter !== 'all') {
      const keywords = ITEM_FILTER_KEYWORDS[menuItemFilter];
      items = items.filter(item =>
        keywords.some(keyword =>
          item.name.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    // Apply search filter
    if (menuItemSearch.trim()) {
      const search = menuItemSearch.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.category_id?.toLowerCase().includes(search)
      );
    }

    return items;
  }, [menuItems, menuItem?.id, menuItemFilter, menuItemSearch]);

  // Load existing combo configuration when menu item changes
  useEffect(() => {
    if (isOpen && menuItem) {
      loadComboConfiguration();
    }
  }, [isOpen, menuItem?.id]);

  const loadComboConfiguration = async () => {
    if (!menuItem) return;

    setIsLoading(true);
    try {
      const groups = await getComboGroups(menuItem.id);
      setComboGroups(groups);
      setIsCombo(menuItem.is_combo || groups.length > 0);
    } catch (error) {
      console.error('[ComboEditor] Failed to load combo configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!menuItem) return;

    setIsSaving(true);
    try {
      await saveComboConfiguration(menuItem.id, isCombo, comboGroups);
      onSaved();
      onClose();
    } catch (error) {
      console.error('[ComboEditor] Failed to save combo configuration:', error);
      alert('Failed to save combo configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGroup = () => {
    const newGroup: ComboGroup = {
      id: `new-group-${Date.now()}`,
      name: `Choice ${comboGroups.length + 1}`,
      required: true,
      min_selections: 1,
      max_selections: 1,
      items: [],
    };
    setComboGroups([...comboGroups, newGroup]);
  };

  const handleDeleteGroup = (index: number) => {
    if (confirm('Are you sure you want to delete this group?')) {
      setComboGroups(comboGroups.filter((_, i) => i !== index));
    }
  };

  const handleUpdateGroup = (index: number, updates: Partial<ComboGroup>) => {
    setComboGroups(comboGroups.map((group, i) =>
      i === index ? { ...group, ...updates } : group
    ));
  };

  const handleAddItem = (groupIndex: number) => {
    setEditingItem({
      groupIndex,
      itemIndex: null,
      item: {
        name: '',
        description: '',
        price_adjustment: 0,
        available: true,
        tags: [],
      },
    });
  };

  const handleEditItem = (groupIndex: number, itemIndex: number) => {
    const item = comboGroups[groupIndex].items[itemIndex];
    setEditingItem({
      groupIndex,
      itemIndex,
      item: { ...item },
    });
  };

  const handleDeleteItem = (groupIndex: number, itemIndex: number) => {
    setComboGroups(comboGroups.map((group, gi) =>
      gi === groupIndex
        ? { ...group, items: group.items.filter((_, ii) => ii !== itemIndex) }
        : group
    ));
  };

  const handleSaveItem = () => {
    if (!editingItem) return;

    const { groupIndex, itemIndex, item } = editingItem;

    if (!item.name?.trim()) {
      alert('Please enter an item name');
      return;
    }

    const newItem: ComboGroupItem = {
      id: itemIndex !== null ? comboGroups[groupIndex].items[itemIndex].id : `new-item-${Date.now()}`,
      name: item.name.trim(),
      description: item.description?.trim() || undefined,
      price_adjustment: item.price_adjustment || 0,
      available: item.available !== false,
      tags: item.tags || [],
    };

    setComboGroups(comboGroups.map((group, gi) => {
      if (gi !== groupIndex) return group;

      if (itemIndex !== null) {
        // Update existing item
        return {
          ...group,
          items: group.items.map((existingItem, ii) =>
            ii === itemIndex ? newItem : existingItem
          ),
        };
      } else {
        // Add new item
        return {
          ...group,
          items: [...group.items, newItem],
        };
      }
    }));

    setEditingItem(null);
  };

  // Add a menu item to a combo group
  const handleAddMenuItemToGroup = (groupIndex: number, menuItemToAdd: MenuItem) => {
    const newItem: ComboGroupItem = {
      id: `menu-item-${menuItemToAdd.id}-${Date.now()}`,
      name: menuItemToAdd.name,
      description: menuItemToAdd.description || undefined,
      price_adjustment: 0, // Default to included in combo price
      available: menuItemToAdd.active !== false,
      tags: menuItemToAdd.is_veg ? ['veg'] : (menuItemToAdd.is_vegan ? ['veg'] : []),
    };

    setComboGroups(comboGroups.map((group, gi) => {
      if (gi !== groupIndex) return group;
      // Check if item already exists in group
      if (group.items.some(item => item.name === menuItemToAdd.name)) {
        return group;
      }
      return {
        ...group,
        items: [...group.items, newItem],
      };
    }));
  };

  // Add multiple menu items at once (batch add)
  const handleAddMultipleMenuItems = (groupIndex: number, itemsToAdd: MenuItem[]) => {
    setComboGroups(comboGroups.map((group, gi) => {
      if (gi !== groupIndex) return group;

      const existingNames = new Set(group.items.map(item => item.name));
      const newItems: ComboGroupItem[] = itemsToAdd
        .filter(item => !existingNames.has(item.name))
        .map(item => ({
          id: `menu-item-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: item.name,
          description: item.description || undefined,
          price_adjustment: 0,
          available: item.active !== false,
          tags: item.is_veg ? ['veg'] : (item.is_vegan ? ['veg'] : []),
        }));

      return {
        ...group,
        items: [...group.items, ...newItems],
      };
    }));
    setShowMenuItemPicker(null);
    setMenuItemFilter('all');
    setMenuItemSearch('');
  };

  if (!isOpen || !menuItem) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Configure Combo</h2>
            <p className="text-sm text-muted-foreground mt-1">{menuItem.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Is Combo Toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-border">
                <div>
                  <h3 className="font-bold">This is a combo meal</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customers must select items from groups when ordering
                  </p>
                </div>
                <button
                  onClick={() => setIsCombo(!isCombo)}
                  className={cn(
                    'relative w-14 h-7 rounded-full transition-colors',
                    isCombo ? 'bg-accent' : 'bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                      isCombo ? 'translate-x-8' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {/* Combo Groups */}
              {isCombo && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                      Combo Groups
                    </h3>
                    <button
                      onClick={handleAddGroup}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors"
                    >
                      + Add Group
                    </button>
                  </div>

                  {comboGroups.length === 0 ? (
                    <div className="text-center py-8 bg-white/5 rounded-xl border border-dashed border-white/20">
                      <p className="text-muted-foreground">No groups yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add a group to define item choices for this combo
                      </p>
                    </div>
                  ) : (
                    comboGroups.map((group, groupIndex) => (
                      <div
                        key={group.id}
                        className="bg-white/5 rounded-xl border border-border overflow-hidden"
                      >
                        {/* Group Header */}
                        <div className="p-4 border-b border-border bg-white/5 flex items-center justify-between">
                          {editingGroupName?.index === groupIndex ? (
                            <input
                              type="text"
                              value={editingGroupName.name}
                              onChange={(e) => setEditingGroupName({ ...editingGroupName, name: e.target.value })}
                              onBlur={() => {
                                handleUpdateGroup(groupIndex, { name: editingGroupName.name });
                                setEditingGroupName(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateGroup(groupIndex, { name: editingGroupName.name });
                                  setEditingGroupName(null);
                                }
                              }}
                              className="flex-1 bg-transparent border-b border-accent text-lg font-bold focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setEditingGroupName({ index: groupIndex, name: group.name })}
                              className="text-lg font-bold hover:text-accent transition-colors text-left"
                            >
                              {group.name}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteGroup(groupIndex)}
                            className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>

                        {/* Group Settings */}
                        <div className="p-4 border-b border-border flex flex-wrap gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={group.required}
                              onChange={(e) => handleUpdateGroup(groupIndex, { required: e.target.checked })}
                              className="w-4 h-4 rounded border-border bg-background"
                            />
                            <span className="text-sm">Required</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Min:</span>
                            <input
                              type="number"
                              value={group.min_selections}
                              onChange={(e) => handleUpdateGroup(groupIndex, { min_selections: parseInt(e.target.value) || 1 })}
                              min={0}
                              max={10}
                              className="w-14 px-2 py-1 rounded-lg bg-background border border-border text-sm text-center"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Max:</span>
                            <input
                              type="number"
                              value={group.max_selections}
                              onChange={(e) => handleUpdateGroup(groupIndex, { max_selections: parseInt(e.target.value) || 1 })}
                              min={1}
                              max={10}
                              className="w-14 px-2 py-1 rounded-lg bg-background border border-border text-sm text-center"
                            />
                          </div>
                        </div>

                        {/* Group Items */}
                        <div className="p-4 space-y-2">
                          {group.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              No items in this group
                            </p>
                          ) : (
                            group.items.map((item, itemIndex) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                              >
                                <div className="flex items-center gap-3">
                                  {item.tags?.includes('veg') && (
                                    <span className="w-4 h-4 rounded border-2 border-green-600 flex items-center justify-center">
                                      <span className="w-2 h-2 rounded-full bg-green-600" />
                                    </span>
                                  )}
                                  {item.tags?.includes('non-veg') && (
                                    <span className="w-4 h-4 rounded border-2 border-red-600 flex items-center justify-center">
                                      <span className="w-2 h-2 rounded-full bg-red-600" />
                                    </span>
                                  )}
                                  <div>
                                    <span className="font-medium">{item.name}</span>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground">{item.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span
                                    className={cn(
                                      'text-sm font-bold',
                                      item.price_adjustment > 0 ? 'text-amber-500' :
                                      item.price_adjustment < 0 ? 'text-green-500' :
                                      'text-muted-foreground'
                                    )}
                                  >
                                    {item.price_adjustment > 0 ? '+' : ''}₹{item.price_adjustment}
                                  </span>
                                  <button
                                    onClick={() => handleEditItem(groupIndex, itemIndex)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(groupIndex, itemIndex)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddItem(groupIndex)}
                              className="flex-1 py-2 rounded-lg border-2 border-dashed border-white/20 text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                            >
                              + Add Custom Item
                            </button>
                            <button
                              onClick={() => {
                                setShowMenuItemPicker({ groupIndex });
                                setMenuItemFilter('all');
                                setMenuItemSearch('');
                              }}
                              className="flex-1 py-2 rounded-lg bg-accent/20 border-2 border-accent/50 text-sm text-accent font-medium hover:bg-accent/30 transition-colors"
                            >
                              📋 Select from Menu
                            </button>
                          </div>

                          {/* Quick add buttons for common categories */}
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Quick Add All:</span>
                              <span className="text-[10px] text-muted-foreground/60">(Opens picker with "Add All" button)</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  setShowMenuItemPicker({ groupIndex });
                                  setMenuItemFilter('rice');
                                  setMenuItemSearch('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-xs text-amber-400 hover:bg-amber-500/30 transition-colors font-semibold"
                              >
                                🍚 All Rice Items
                              </button>
                              <button
                                onClick={() => {
                                  setShowMenuItemPicker({ groupIndex });
                                  setMenuItemFilter('puttu-otti');
                                  setMenuItemSearch('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/50 text-xs text-purple-400 hover:bg-purple-500/30 transition-colors font-semibold"
                              >
                                🥞 All Puttu/Otti
                              </button>
                              <button
                                onClick={() => {
                                  setShowMenuItemPicker({ groupIndex });
                                  setMenuItemFilter('sides');
                                  setMenuItemSearch('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/50 text-xs text-green-400 hover:bg-green-500/30 transition-colors font-semibold"
                              >
                                🥗 All Papad/Sides
                              </button>
                              <button
                                onClick={() => {
                                  setShowMenuItemPicker({ groupIndex });
                                  setMenuItemFilter('roti');
                                  setMenuItemSearch('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/50 text-xs text-orange-400 hover:bg-orange-500/30 transition-colors font-semibold"
                              >
                                🫓 All Roti/Naan
                              </button>
                              <button
                                onClick={() => {
                                  setShowMenuItemPicker({ groupIndex });
                                  setMenuItemFilter('dal');
                                  setMenuItemSearch('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-xs text-yellow-400 hover:bg-yellow-500/30 transition-colors font-semibold"
                              >
                                🥣 All Dal
                              </button>
                              <button
                                onClick={() => {
                                  setShowMenuItemPicker({ groupIndex });
                                  setMenuItemFilter('curry');
                                  setMenuItemSearch('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 text-xs text-red-400 hover:bg-red-500/30 transition-colors font-semibold"
                              >
                                🍛 All Curry
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/5 text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-bold uppercase tracking-widest shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Saving...' : 'Save Combo'}
          </button>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setEditingItem(null)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-4">
              {editingItem.itemIndex !== null ? 'Edit Item' : 'Add Item'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={editingItem.item.name || ''}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, name: e.target.value }
                  })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="e.g., Regular Burger"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={editingItem.item.description || ''}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, description: e.target.value }
                  })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price Adjustment (₹)</label>
                <input
                  type="number"
                  value={editingItem.item.price_adjustment || 0}
                  onChange={(e) => setEditingItem({
                    ...editingItem,
                    item: { ...editingItem.item, price_adjustment: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="0 for included, positive for upgrade cost"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use 0 for included items, positive for upgrades, negative for discounts
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingItem.item.tags?.includes('veg') || false}
                      onChange={(e) => {
                        const tags = editingItem.item.tags || [];
                        const newTags = e.target.checked
                          ? [...tags.filter(t => t !== 'non-veg'), 'veg']
                          : tags.filter(t => t !== 'veg');
                        setEditingItem({
                          ...editingItem,
                          item: { ...editingItem.item, tags: newTags }
                        });
                      }}
                      className="w-4 h-4 rounded border-green-600 text-green-600"
                    />
                    <span className="text-sm flex items-center gap-1">
                      <span className="w-3 h-3 rounded border border-green-600 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                      </span>
                      Veg
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingItem.item.tags?.includes('non-veg') || false}
                      onChange={(e) => {
                        const tags = editingItem.item.tags || [];
                        const newTags = e.target.checked
                          ? [...tags.filter(t => t !== 'veg'), 'non-veg']
                          : tags.filter(t => t !== 'non-veg');
                        setEditingItem({
                          ...editingItem,
                          item: { ...editingItem.item, tags: newTags }
                        });
                      }}
                      className="w-4 h-4 rounded border-red-600 text-red-600"
                    />
                    <span className="text-sm flex items-center gap-1">
                      <span className="w-3 h-3 rounded border border-red-600 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                      </span>
                      Non-Veg
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-lg bg-white/5 text-sm font-bold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors"
              >
                {editingItem.itemIndex !== null ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Picker Modal */}
      {showMenuItemPicker && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowMenuItemPicker(null);
              setMenuItemFilter('all');
              setMenuItemSearch('');
            }}
          />
          <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border bg-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Select Items from Menu</h3>
                <button
                  onClick={() => {
                    setShowMenuItemPicker(null);
                    setMenuItemFilter('all');
                    setMenuItemSearch('');
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setMenuItemFilter('all')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'all'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  )}
                >
                  All Items
                </button>
                <button
                  onClick={() => setMenuItemFilter('rice')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'rice'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  )}
                >
                  🍚 Rice
                </button>
                <button
                  onClick={() => setMenuItemFilter('puttu-otti')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'puttu-otti'
                      ? 'bg-purple-500 text-white'
                      : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  )}
                >
                  🥞 Puttu/Otti
                </button>
                <button
                  onClick={() => setMenuItemFilter('roti')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'roti'
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                  )}
                >
                  🫓 Roti/Naan
                </button>
                <button
                  onClick={() => setMenuItemFilter('dal')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'dal'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  )}
                >
                  🥣 Dal
                </button>
                <button
                  onClick={() => setMenuItemFilter('curry')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'curry'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  )}
                >
                  🍛 Curry
                </button>
                <button
                  onClick={() => setMenuItemFilter('sides')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'sides'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  )}
                >
                  🥗 Sides
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                value={menuItemSearch}
                onChange={(e) => setMenuItemSearch(e.target.value)}
                placeholder="Search menu items..."
                className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Items Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">No items found</p>
                  <p className="text-sm mt-1">Try a different filter or search term</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      {filteredMenuItems.length} items found
                    </p>
                    <button
                      onClick={() => handleAddMultipleMenuItems(showMenuItemPicker.groupIndex, filteredMenuItems)}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors"
                    >
                      Add All {filteredMenuItems.length} Items
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredMenuItems.map((item) => {
                      const isAlreadyAdded = comboGroups[showMenuItemPicker.groupIndex]?.items.some(
                        existing => existing.name === item.name
                      );

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (!isAlreadyAdded) {
                              handleAddMenuItemToGroup(showMenuItemPicker.groupIndex, item);
                            }
                          }}
                          disabled={isAlreadyAdded}
                          className={cn(
                            'p-3 rounded-xl text-left transition-all border-2',
                            isAlreadyAdded
                              ? 'bg-emerald-500/20 border-emerald-500/50 opacity-60 cursor-not-allowed'
                              : 'bg-white/5 border-border hover:border-accent hover:bg-accent/10'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {item.is_veg && (
                              <span className="w-4 h-4 rounded border-2 border-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-green-600" />
                              </span>
                            )}
                            {!item.is_veg && !item.is_vegan && (
                              <span className="w-4 h-4 rounded border-2 border-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-red-600" />
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              {item.category_id && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.category_id}
                                </p>
                              )}
                              <p className="text-xs font-bold text-accent mt-1">₹{item.price}</p>
                            </div>
                            {isAlreadyAdded && (
                              <span className="text-emerald-400 text-xs font-bold">✓ Added</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-white/5">
              <button
                onClick={() => {
                  setShowMenuItemPicker(null);
                  setMenuItemFilter('all');
                  setMenuItemSearch('');
                }}
                className="w-full py-3 rounded-lg bg-accent text-white text-sm font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ComboEditor;

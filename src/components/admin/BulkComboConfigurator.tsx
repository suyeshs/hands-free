/**
 * Bulk Combo Configurator
 * Apply the same combo configuration to all items in a category
 */

import { useState, useMemo, useEffect } from 'react';
import { MenuItem, ComboGroup, ComboGroupItem } from '../../types';
import { saveComboConfiguration } from '../../lib/comboService';
import { useMenuStore } from '../../stores/menuStore';
import { cn } from '../../lib/utils';
import { getComboFilterKeywords, ComboFilterKeyword, convertToFilterMap } from '../../lib/comboFilters';

interface BulkComboConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface EditingItem {
  groupIndex: number;
  itemIndex: number | null;
  item: Partial<ComboGroupItem>;
}

// Fallback keywords (used only if database fetch fails)
const FALLBACK_ITEM_FILTER_KEYWORDS = {
  rice: ['rice', 'biryani', 'pulao', 'fried rice', 'jeera rice', 'steamed rice', 'veg rice', 'chicken rice', 'mutton rice'],
  'puttu-otti': ['puttu', 'otti', 'appam', 'idiyappam', 'pathiri', 'kadala', 'steamed cake'],
  roti: ['roti', 'naan', 'paratha', 'chapati', 'kulcha', 'bread', 'tandoori roti', 'butter naan', 'garlic naan', 'laccha paratha', 'rumali roti'],
  dal: ['dal', 'daal', 'lentil'],
  curry: ['curry', 'gravy', 'masala', 'sabzi', 'kadhi'],
  sides: ['raita', 'papad', 'papadum', 'papadam', 'pappadam', 'papputtu', 'pickle', 'chutney', 'salad', 'achar', 'yogurt', 'curd'],
};

export function BulkComboConfigurator({ isOpen, onClose, onSaved }: BulkComboConfiguratorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [comboGroups, setComboGroups] = useState<ComboGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<{ index: number; name: string } | null>(null);
  const [showMenuItemPicker, setShowMenuItemPicker] = useState<{ groupIndex: number } | null>(null);
  const [menuItemFilter, setMenuItemFilter] = useState<string>('all');
  const [menuItemSearch, setMenuItemSearch] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Database-driven filter keywords
  const [filterKeywords, setFilterKeywords] = useState<ComboFilterKeyword[]>([]);
  const [itemFilterKeywords, setItemFilterKeywords] = useState<Record<string, string[]>>(FALLBACK_ITEM_FILTER_KEYWORDS);

  const { categories, items: menuItems } = useMenuStore();

  // Load filter keywords from database
  useEffect(() => {
    if (isOpen) {
      loadFilterKeywords();
    }
  }, [isOpen]);

  const loadFilterKeywords = async () => {
    try {
      const keywords = await getComboFilterKeywords();
      setFilterKeywords(keywords);
      setItemFilterKeywords(convertToFilterMap(keywords));
    } catch (error) {
      console.error('[BulkComboConfigurator] Failed to load filter keywords, using fallback:', error);
      setItemFilterKeywords(FALLBACK_ITEM_FILTER_KEYWORDS);
    }
  };

  // Get items in selected category
  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return menuItems.filter(item => item.category_id === selectedCategory && item.active);
  }, [selectedCategory, menuItems]);

  // Filter menu items for picker
  const filteredMenuItems = useMemo(() => {
    let items = menuItems.filter(item => item.active);

    if (menuItemFilter !== 'all') {
      const keywords = itemFilterKeywords[menuItemFilter];
      if (keywords) {
        items = items.filter(item =>
          keywords.some(keyword =>
            item.name.toLowerCase().includes(keyword.toLowerCase())
          )
        );
      }
    }

    if (menuItemSearch.trim()) {
      const search = menuItemSearch.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.category_id?.toLowerCase().includes(search)
      );
    }

    return items;
  }, [menuItems, menuItemFilter, menuItemSearch, itemFilterKeywords]);

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
        return {
          ...group,
          items: group.items.map((existingItem, ii) =>
            ii === itemIndex ? newItem : existingItem
          ),
        };
      } else {
        return {
          ...group,
          items: [...group.items, newItem],
        };
      }
    }));

    setEditingItem(null);
  };

  const handleAddMenuItemToGroup = (groupIndex: number, menuItemToAdd: MenuItem) => {
    const newItem: ComboGroupItem = {
      id: `menu-item-${menuItemToAdd.id}-${Date.now()}`,
      name: menuItemToAdd.name,
      description: menuItemToAdd.description || undefined,
      price_adjustment: 0,
      available: menuItemToAdd.active !== false,
      tags: menuItemToAdd.is_veg ? ['veg'] : [],
    };

    setComboGroups(comboGroups.map((group, gi) => {
      if (gi !== groupIndex) return group;
      if (group.items.some(item => item.name === menuItemToAdd.name)) {
        return group;
      }
      return {
        ...group,
        items: [...group.items, newItem],
      };
    }));
  };

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
          tags: item.is_veg ? ['veg'] : [],
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

  const handleApplyClick = () => {
    console.log('[BulkComboConfigurator] Apply button clicked!');
    console.log('[BulkComboConfigurator] Selected category:', selectedCategory);
    console.log('[BulkComboConfigurator] Combo groups:', comboGroups);
    console.log('[BulkComboConfigurator] Category items:', categoryItems);

    if (!selectedCategory) {
      alert('Please select a category');
      return;
    }

    if (comboGroups.length === 0) {
      alert('Please add at least one combo group');
      return;
    }

    if (categoryItems.length === 0) {
      alert('No items found in selected category');
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmApply = async () => {
    console.log('[BulkComboConfigurator] User confirmed, starting bulk apply...');
    setShowConfirmDialog(false);
    setIsSaving(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const item of categoryItems) {
        try {
          console.log(`[BulkComboConfigurator] Saving combo for: ${item.name}`);
          await saveComboConfiguration(item.id, true, comboGroups);
          successCount++;
        } catch (error) {
          console.error(`[BulkComboConfigurator] Failed to save combo for ${item.name}:`, error);
          failCount++;
        }
      }

      console.log(`[BulkComboConfigurator] Completed: ${successCount} success, ${failCount} failed`);
      alert(`Successfully configured ${successCount} items${failCount > 0 ? `, ${failCount} failed` : ''}`);
      onSaved();
      onClose();
    } catch (error) {
      console.error('[BulkComboConfigurator] Failed to apply bulk combo configuration:', error);
      alert('Failed to apply combo configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Bulk Combo Configuration</h2>
            <p className="text-sm text-muted-foreground mt-1">Apply same combo groups to all items in a category</p>
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
          {/* Category Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-black uppercase tracking-widest text-muted-foreground">
              Select Category
            </label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="w-full px-4 py-3 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50 text-white"
            >
              <option value="">Choose a category...</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({menuItems.filter(i => i.category_id === category.id && i.active).length} items)
                </option>
              ))}
            </select>

            {selectedCategory && categoryItems.length > 0 && (
              <div className="p-4 bg-accent/10 border border-accent/30">
                <p className="text-sm font-bold text-white">
                  {categoryItems.length} items will be configured:
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {categoryItems.slice(0, 5).map(i => i.name).join(', ')}
                  {categoryItems.length > 5 && ` + ${categoryItems.length - 5} more...`}
                </p>
              </div>
            )}
          </div>

          {/* Combo Groups Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Combo Groups Configuration
              </h3>
              <button
                onClick={handleAddGroup}
                className="px-3 py-1.5 bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors"
              >
                + Add Group
              </button>
            </div>

            {comboGroups.length === 0 ? (
              <div className="text-center py-8 bg-white/5 border border-dashed border-white/20">
                <p className="text-muted-foreground">No groups configured</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add groups like "Choose Rice" or "Choose Papad"
                </p>
              </div>
            ) : (
              comboGroups.map((group, groupIndex) => (
                <div
                  key={group.id}
                  className="bg-white/5 border border-border overflow-hidden"
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
                      className="ml-2 w-8 h-8 flex items-center justify-center hover:bg-red-500/20 text-red-400 transition-colors"
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
                        className="w-14 px-2 py-1 bg-background border border-border text-sm text-center"
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
                        className="w-14 px-2 py-1 bg-background border border-border text-sm text-center"
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
                          className="flex items-center justify-between p-3 bg-background border border-border"
                        >
                          <div className="flex items-center gap-3">
                            {item.tags?.includes('veg') && (
                              <span className="w-4 h-4 rounded border-2 border-green-600 flex items-center justify-center">
                                <span className="w-2 h-2 rounded-full bg-green-600" />
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
                              className="w-7 h-7 flex items-center justify-center hover:bg-white/10 transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteItem(groupIndex, itemIndex)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-red-500/20 text-red-400 transition-colors"
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
                        className="flex-1 py-2 border-2 border-dashed border-white/20 text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                      >
                        + Add Custom Item
                      </button>
                      <button
                        onClick={() => {
                          setShowMenuItemPicker({ groupIndex });
                          setMenuItemFilter('all');
                          setMenuItemSearch('');
                        }}
                        className="flex-1 py-2 bg-accent/20 border-2 border-accent/50 text-sm text-accent font-medium hover:bg-accent/30 transition-colors"
                      >
                        📋 Select from Menu
                      </button>
                    </div>

                    {/* Quick add buttons */}
                    {filterKeywords.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Quick Add All:</span>
                          <span className="text-[10px] text-muted-foreground/60">(Opens picker with "Add All" button)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {filterKeywords.map((filter) => (
                            <button
                              key={filter.id}
                              onClick={() => {
                                setShowMenuItemPicker({ groupIndex });
                                setMenuItemFilter(filter.filter_key);
                                setMenuItemSearch('');
                              }}
                              className={`px-3 py-1.5  bg-${filter.color_class || 'blue'}-500/20 border border-${filter.color_class || 'blue'}-500/50 text-xs text-${filter.color_class || 'blue'}-400 hover:bg-${filter.color_class || 'blue'}-500/30 transition-colors font-semibold`}
                            >
                              {filter.emoji} All {filter.display_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-white/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/5 text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyClick}
            disabled={isSaving || !selectedCategory || comboGroups.length === 0}
            className="px-6 py-2.5 bg-accent text-white text-sm font-bold uppercase tracking-widest shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Applying...' : `Apply to ${categoryItems.length} Items`}
          </button>
        </div>
      </div>

      {/* Edit Item Modal - same as ComboEditor */}
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
                  className="w-full px-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="e.g., Steamed Rice"
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
                  className="w-full px-3 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="0 for included"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
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
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Vegetarian</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-white/5 text-sm font-bold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors"
              >
                {editingItem.itemIndex !== null ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Picker Modal - same as ComboEditor */}
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
            <div className="p-4 border-b border-border bg-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Select Items from Menu</h3>
                <button
                  onClick={() => {
                    setShowMenuItemPicker(null);
                    setMenuItemFilter('all');
                    setMenuItemSearch('');
                  }}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setMenuItemFilter('all')}
                  className={cn(
                    'px-3 py-1.5  text-xs font-bold uppercase transition-colors',
                    menuItemFilter === 'all'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  )}
                >
                  All Items
                </button>
                {filterKeywords.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setMenuItemFilter(filter.filter_key)}
                    className={cn(
                      'px-3 py-1.5  text-xs font-bold uppercase transition-colors',
                      menuItemFilter === filter.filter_key
                        ? 'bg-accent text-white'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    )}
                  >
                    {filter.emoji} {filter.display_name}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={menuItemSearch}
                onChange={(e) => setMenuItemSearch(e.target.value)}
                placeholder="Search menu items..."
                className="w-full px-4 py-2 bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">No items found</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      {filteredMenuItems.length} items found
                    </p>
                    <button
                      onClick={() => handleAddMultipleMenuItems(showMenuItemPicker.groupIndex, filteredMenuItems)}
                      className="px-4 py-2 bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors"
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
                            'p-3  text-left transition-all border-2',
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
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              <p className="text-xs font-bold text-accent mt-1">₹{item.price}</p>
                            </div>
                            {isAlreadyAdded && (
                              <span className="text-emerald-400 text-xs font-bold">✓</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-border bg-white/5">
              <button
                onClick={() => {
                  setShowMenuItemPicker(null);
                  setMenuItemFilter('all');
                  setMenuItemSearch('');
                }}
                className="w-full py-3 bg-accent text-white text-sm font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmDialog(false)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Bulk Configuration</h3>

            <div className="space-y-4">
              <p className="text-muted-foreground">
                You are about to apply this combo configuration to{' '}
                <span className="font-bold text-white">{categoryItems.length} items</span> in{' '}
                <span className="font-bold text-accent">
                  "{categories.find(c => c.id === selectedCategory)?.name}"
                </span>
              </p>

              <div className="p-4 bg-white/5 border border-border">
                <p className="text-sm font-bold mb-2">Configuration Summary:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {comboGroups.length} combo group{comboGroups.length !== 1 ? 's' : ''}</li>
                  {comboGroups.map((group, idx) => (
                    <li key={idx} className="ml-4">
                      - {group.name}: {group.items.length} option{group.items.length !== 1 ? 's' : ''}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-400">
                  ⚠️ This will overwrite any existing combo configurations for these items
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-6 py-2.5 bg-white/5 text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApply}
                className="px-6 py-2.5 bg-accent text-white text-sm font-bold uppercase tracking-widest shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all"
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkComboConfigurator;

/**
 * ComboEditor Component
 * Modal for creating and editing combo meal configurations
 */

import { useState, useEffect } from 'react';
import { MenuItem, ComboGroup, ComboGroupItem } from '../../types';
import { saveComboConfiguration, getComboGroups } from '../../lib/comboService';
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

export function ComboEditor({ isOpen, onClose, menuItem, onSaved }: ComboEditorProps) {
  const [isCombo, setIsCombo] = useState(false);
  const [comboGroups, setComboGroups] = useState<ComboGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<{ index: number; name: string } | null>(null);

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

                          <button
                            onClick={() => handleAddItem(groupIndex)}
                            className="w-full py-2 rounded-lg border-2 border-dashed border-white/20 text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                          >
                            + Add Item
                          </button>
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
    </div>
  );
}

export default ComboEditor;

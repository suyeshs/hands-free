/**
 * Menu Editor Component
 * Comprehensive menu and category management with full CRUD operations
 */

import { useState, useEffect } from 'react';
import { useMenuStore } from '../../stores/menuStore';
import { MenuItem, MenuCategory } from '../../types';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Search,
  FolderPlus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { saveMenuItem, deleteMenuItem, saveMenuCategory, deleteMenuCategory } from '../../lib/database';

interface MenuEditorProps {
  tenantId: string;
}

type EditMode = 'item' | 'category' | null;

interface ItemFormData {
  id?: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  active: boolean;
  preparation_time: number;
  dietary_tags: string[];
  allergens: string[];
  is_veg: boolean;
  is_vegan: boolean;
  image?: string;
}

interface CategoryFormData {
  id?: string;
  name: string;
  icon: string;
  active: boolean;
  sort_order: number;
}

export function MenuEditor({ tenantId: _tenantId }: MenuEditorProps) {
  const { categories, items, loadMenuFromDatabase } = useMenuStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form states
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [editingItem, setEditingItem] = useState<ItemFormData | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Available dietary tags
  const availableDietaryTags = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
    'nut-free', 'halal', 'kosher', 'popular', 'chef-special', 'spicy'
  ];

  useEffect(() => {
    loadMenuFromDatabase();
  }, []);

  // Filter items by search
  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    if (!acc[item.category_id]) {
      acc[item.category_id] = [];
    }
    acc[item.category_id].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle edit item
  const handleEditItem = (item: MenuItem) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category_id: item.category_id,
      active: item.active,
      preparation_time: item.preparation_time,
      dietary_tags: item.dietary_tags || [],
      allergens: item.allergens || [],
      is_veg: item.is_veg || false,
      is_vegan: item.is_vegan || false,
      image: item.image,
    });
    setEditMode('item');
  };

  // Handle add new item
  const handleAddItem = (categoryId?: string) => {
    setEditingItem({
      name: '',
      description: '',
      price: 0,
      category_id: categoryId || categories[0]?.id || '',
      active: true,
      preparation_time: 15,
      dietary_tags: [],
      allergens: [],
      is_veg: false,
      is_vegan: false,
    });
    setEditMode('item');
  };

  // Handle edit category
  const handleEditCategory = (category: MenuCategory) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      icon: category.icon || 'utensils',
      active: category.active,
      sort_order: category.sort_order,
    });
    setEditMode('category');
  };

  // Handle add new category
  const handleAddCategory = () => {
    setEditingCategory({
      name: '',
      icon: 'utensils',
      active: true,
      sort_order: categories.length,
    });
    setEditMode('category');
  };

  // Save item - saves to D1 first, then syncs to local
  const handleSaveItem = async () => {
    if (!editingItem) return;

    setIsSaving(true);
    try {
      // Save to local SQLite (sync engine will update D1)
      await saveMenuItem({
        id: editingItem.id,
        name: editingItem.name,
        description: editingItem.description,
        price: editingItem.price,
        category_id: editingItem.category_id,
        allergens: editingItem.allergens,
        dietary_tags: editingItem.dietary_tags,
        preparation_time: editingItem.preparation_time,
        image: editingItem.image,
        active: editingItem.active,
      });

      // Reload menu from local database
      await loadMenuFromDatabase();

      setEditMode(null);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to save item:', error);
      alert(`Failed to save menu item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save category - saves to D1 first, then syncs to local
  const handleSaveCategory = async () => {
    if (!editingCategory) return;

    setIsSaving(true);
    try {
      // Save to local SQLite (sync engine will update D1)
      await saveMenuCategory({
        id: editingCategory.id,
        name: editingCategory.name,
        description: editingCategory.icon, // Store icon in description field for now
        sort_order: editingCategory.sort_order,
        active: editingCategory.active,
      });

      // Reload menu from local database
      await loadMenuFromDatabase();

      setEditMode(null);
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to save category:', error);
      alert(`Failed to save category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete item - deletes from local SQLite (sync engine will update D1)
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      // Delete from local SQLite (sync engine will update D1)
      await deleteMenuItem(itemId);

      // Reload menu from local database
      await loadMenuFromDatabase();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert(`Failed to delete menu item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Delete category - deletes from local SQLite (sync engine will update D1)
  const handleDeleteCategory = async (categoryId: string) => {
    const itemsInCategory = items.filter(item => item.category_id === categoryId);
    if (itemsInCategory.length > 0) {
      if (!confirm(`This category contains ${itemsInCategory.length} menu items. Items will be moved to "uncategorized". Continue?`)) {
        return;
      }
    } else {
      if (!confirm('Are you sure you want to delete this category?')) return;
    }

    try {
      // Delete from local SQLite (sync engine will update D1)
      await deleteMenuCategory(categoryId);

      // Reload menu from local database
      await loadMenuFromDatabase();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert(`Failed to delete category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Toggle dietary tag
  const toggleDietaryTag = (tag: string) => {
    if (!editingItem) return;
    const tags = editingItem.dietary_tags.includes(tag)
      ? editingItem.dietary_tags.filter(t => t !== tag)
      : [...editingItem.dietary_tags, tag];
    setEditingItem({ ...editingItem, dietary_tags: tags });
  };

  // Render item form
  const renderItemForm = () => {
    if (!editingItem) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="glass-panel rounded-2xl border border-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 glass-panel z-10">
            <h2 className="text-xl font-bold">
              {editingItem.id ? 'Edit Menu Item' : 'Add Menu Item'}
            </h2>
            <button
              onClick={() => {
                setEditMode(null);
                setEditingItem(null);
              }}
              className="p-2 hover:bg-surface-2 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Item Name *
              </label>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="e.g., Butter Chicken"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Description
              </label>
              <textarea
                value={editingItem.description}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                placeholder="Brief description of the item"
              />
            </div>

            {/* Price and Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  Price (Rs.) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingItem.price}
                  onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  Category *
                </label>
                <select
                  value={editingItem.category_id}
                  onChange={(e) => setEditingItem({ ...editingItem, category_id: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preparation Time and Active */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  Prep Time (mins)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingItem.preparation_time}
                  onChange={(e) => setEditingItem({ ...editingItem, preparation_time: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  Status
                </label>
                <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={editingItem.active}
                    onChange={(e) => setEditingItem({ ...editingItem, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>

            {/* Dietary Tags */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Dietary Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableDietaryTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleDietaryTag(tag)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                      editingItem.dietary_tags.includes(tag)
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Image URL (optional) */}
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Image URL (optional)
              </label>
              <input
                type="text"
                value={editingItem.image || ''}
                onChange={(e) => setEditingItem({ ...editingItem, image: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-border sticky bottom-0 glass-panel">
            <button
              onClick={() => {
                setEditMode(null);
                setEditingItem(null);
              }}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveItem}
              disabled={isSaving || !editingItem.name || !editingItem.category_id}
              className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white text-sm font-bold transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render category form
  const renderCategoryForm = () => {
    if (!editingCategory) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="glass-panel rounded-2xl border border-border shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold">
              {editingCategory.id ? 'Edit Category' : 'Add Category'}
            </h2>
            <button
              onClick={() => {
                setEditMode(null);
                setEditingCategory(null);
              }}
              className="p-2 hover:bg-surface-2 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Category Name *
              </label>
              <input
                type="text"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="e.g., Main Courses"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Icon Emoji
              </label>
              <input
                type="text"
                value={editingCategory.icon}
                onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="🍽️"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={editingCategory.active}
                  onChange={(e) => setEditingCategory({ ...editingCategory, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 border-t border-border">
            <button
              onClick={() => {
                setEditMode(null);
                setEditingCategory(null);
              }}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={isSaving || !editingCategory.name}
              className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white text-sm font-bold transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="glass-panel p-4 border border-border">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">
              Menu Editor
            </h3>
            <p className="text-xs text-muted-foreground">
              {items.length} items across {categories.length} categories
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddCategory}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors text-sm font-bold"
            >
              <FolderPlus size={18} />
              Add Category
            </button>
            <button
              onClick={() => handleAddItem()}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-bold shadow-lg shadow-accent/20"
            >
              <Plus size={18} />
              Add Item
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>
      </div>

      {/* Categories and Items */}
      <div className="space-y-3">
        {categories.map(category => {
          const categoryItems = itemsByCategory[category.id] || [];
          const isExpanded = expandedCategories.has(category.id);

          return (
            <div key={category.id} className="glass-panel border border-border overflow-hidden">
              {/* Category Header */}
              <div className="flex items-center justify-between p-4 bg-white/5">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-3 flex-1"
                >
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span className="text-2xl">{category.icon}</span>
                  <div className="text-left">
                    <h4 className="font-bold text-foreground">{category.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {categoryItems.length} items
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddItem(category.id)}
                    className="p-2 hover:bg-accent/20 transition-colors text-accent"
                    title="Add item to this category"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-2 hover:bg-blue-500/20 transition-colors text-blue-400"
                    title="Edit category"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-2 hover:bg-destructive/20 transition-colors text-destructive"
                    title="Delete category"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Items List */}
              {isExpanded && categoryItems.length > 0 && (
                <div className="divide-y divide-border">
                  {categoryItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 object-cover border border-border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-white/5 border border-border flex items-center justify-center">
                            <ImageIcon size={20} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-foreground">{item.name}</h5>
                            {!item.active && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-accent">Rs. {item.price.toFixed(2)}</span>
                            {item.dietary_tags && item.dietary_tags.length > 0 && (
                              <div className="flex gap-1">
                                {item.dietary_tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-green-500/20 text-green-400">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="p-2 hover:bg-blue-500/20 transition-colors text-blue-400"
                          title="Edit item"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 hover:bg-destructive/20 transition-colors text-destructive"
                          title="Delete item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isExpanded && categoryItems.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No items in this category</p>
                  <button
                    onClick={() => handleAddItem(category.id)}
                    className="mt-2 text-sm text-accent hover:underline font-medium"
                  >
                    Add your first item
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="glass-panel p-12 border border-border text-center">
            <p className="text-muted-foreground mb-4">No categories found</p>
            <button
              onClick={handleAddCategory}
              className="px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-bold"
            >
              Create Your First Category
            </button>
          </div>
        )}
      </div>

      {/* Render Forms */}
      {editMode === 'item' && renderItemForm()}
      {editMode === 'category' && renderCategoryForm()}
    </div>
  );
}

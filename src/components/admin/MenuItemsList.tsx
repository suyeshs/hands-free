/**
 * Menu Items List Component
 * Displays all menu items in a table format with category filters
 */

import { useState, useEffect } from 'react';
import { useMenuStore } from '../../stores/menuStore';
import { cn } from '../../lib/utils';
import { MenuItem } from '../../types';
import { ComboEditor } from './ComboEditor';
import { PasscodeDialog } from './PasscodeDialog';
import { X, Save, Upload, FolderTree, LayoutGrid, Plus } from 'lucide-react';
import { backendApi } from '../../lib/backendApi';
import { syncMenuFromBackend } from '../../lib/menuSync';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';

interface MenuItemsListProps {
  onRefresh?: () => void;
  onCategoriesClick?: () => void;
  onPhotosClick?: () => void;
  onAllImagesClick?: () => void;
}

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

type PendingAction = { type: 'edit'; item: MenuItem } | { type: 'delete'; item: MenuItem } | null;

export function MenuItemsList({ onRefresh, onCategoriesClick, onPhotosClick, onAllImagesClick }: MenuItemsListProps) {
  const { items, categories, loadMenuFromDatabase, isLoading } = useMenuStore();
  const { tenant } = useTenantStore();
  const { user } = useAuthStore();
  const tenantId = tenant?.tenantId || user?.tenantId || '';

  // Get theme colors from tenant store
  const primaryColor = tenant?.theme?.primaryColor || '#ff6b35'; // default accent color

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showComboEditor, setShowComboEditor] = useState(false);

  // Passcode protection
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // Edit form
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState<ItemFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Available dietary tags
  const availableDietaryTags = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
    'nut-free', 'halal', 'kosher', 'popular', 'chef-special', 'spicy'
  ];

  useEffect(() => {
    // Load menu from database on mount
    loadMenuFromDatabase();
  }, []);

  // Filter items
  const filteredItems = items.filter((item) => {
    // Filter by category
    if (selectedCategory && item.category_id !== selectedCategory) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category_id.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const handleRefresh = async () => {
    await loadMenuFromDatabase();
    onRefresh?.();
  };

  const handleEditCombo = (item: MenuItem) => {
    setEditingItem(item);
    setShowComboEditor(true);
  };

  const handleComboEditorClose = () => {
    setShowComboEditor(false);
    setEditingItem(null);
  };

  const handleComboSaved = async () => {
    // Refresh the menu to get updated combo data
    await loadMenuFromDatabase();
    handleComboEditorClose();
  };

  // Handle edit button click - show passcode dialog
  const handleEditClick = (item: MenuItem) => {
    setPendingAction({ type: 'edit', item });
    setShowPasscodeDialog(true);
  };

  // Handle delete button click - show passcode dialog
  const handleDeleteClick = (item: MenuItem) => {
    setPendingAction({ type: 'delete', item });
    setShowPasscodeDialog(true);
  };

  // Handle passcode success
  const handlePasscodeSuccess = () => {
    if (pendingAction?.type === 'edit') {
      const item = pendingAction.item;
      setEditFormData({
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
      setShowEditForm(true);
    } else if (pendingAction?.type === 'delete') {
      handleDeleteItem(pendingAction.item.id);
    }
    setShowPasscodeDialog(false);
    setPendingAction(null);
  };

  // Handle passcode dialog close
  const handlePasscodeClose = () => {
    setShowPasscodeDialog(false);
    setPendingAction(null);
  };

  // Save edited item - saves to D1 first, then syncs to local
  const handleSaveItem = async () => {
    if (!editFormData || !tenantId) return;

    setIsSaving(true);
    try {
      // Prepare item data for API
      const itemData = {
        name: editFormData.name,
        description: editFormData.description,
        price: editFormData.price,
        category: editFormData.category_id,
        preparationTime: editFormData.preparation_time.toString(),
        dietaryTags: editFormData.dietary_tags,
        allergens: editFormData.allergens,
        isVeg: editFormData.is_veg,
        isVegan: editFormData.is_vegan,
        available: editFormData.active,
        imageUrl: editFormData.image || null,
        currency: 'INR',
        spiceLevel: 0,
        servingSize: '1 serving',
      };

      if (editFormData.id) {
        // Update existing item in D1
        await backendApi.updateMenuItem(tenantId, editFormData.id, itemData);
      }

      // Sync from D1 to local SQLite
      await syncMenuFromBackend(tenantId);
      await loadMenuFromDatabase();

      setShowEditForm(false);
      setEditFormData(null);
    } catch (error) {
      console.error('Failed to save item:', error);
      alert(`Failed to save menu item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete item - deletes from D1 first, then syncs to local
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    if (!tenantId) return;

    try {
      // Delete from D1
      await backendApi.deleteMenuItem(tenantId, itemId);

      // Sync from D1 to local SQLite
      await syncMenuFromBackend(tenantId);
      await loadMenuFromDatabase();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert(`Failed to delete menu item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Toggle dietary tag in edit form
  const toggleDietaryTag = (tag: string) => {
    if (!editFormData) return;
    const tags = editFormData.dietary_tags.includes(tag)
      ? editFormData.dietary_tags.filter(t => t !== tag)
      : [...editFormData.dietary_tags, tag];
    setEditFormData({ ...editFormData, dietary_tags: tags });
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editFormData || !tenantId) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, WebP, or HEIC)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    try {
      // Create a FileList-like object for the API
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;

      // Upload photo and get the result
      const result = await backendApi.uploadPhotos(tenantId, fileList);

      // Get the uploaded image URL
      if (result.results.uploaded && result.results.uploaded.length > 0) {
        const uploadedImage = result.results.uploaded[0];
        setEditFormData({ ...editFormData, image: uploadedImage.imageUrl });
        alert('Image uploaded successfully!');
      } else if (result.results.matched && result.results.matched.length > 0) {
        const matchedImage = result.results.matched[0];
        setEditFormData({ ...editFormData, image: matchedImage.imageUrl });
        alert('Image uploaded and matched successfully!');
      } else {
        alert('Image upload completed but no URL was returned');
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
      // Reset the input
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center p-12">
        <p className="text-muted-foreground">No menu items found. Please sync your menu first.</p>
      </div>
    );
  }

  // Apply availability filter
  const displayItems = selectedAvailability === 'available'
    ? filteredItems.filter(item => item.active)
    : selectedAvailability === 'unavailable'
    ? filteredItems.filter(item => !item.active)
    : filteredItems;

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="neo-raised p-6 rounded-2xl">
        {/* Title and Item Count */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-foreground">Menu Management</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Showing {displayItems.length} of {items.length} items
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onCategoriesClick}
              className="neo-raised px-4 py-2 rounded-xl hover:neo-hover active:neo-inset transition-all text-sm font-semibold flex items-center gap-2"
            >
              <FolderTree size={16} />
              Categories
            </button>
            <button
              onClick={onPhotosClick}
              className="neo-raised px-4 py-2 rounded-xl hover:neo-hover active:neo-inset transition-all text-sm font-semibold flex items-center gap-2"
            >
              <Upload size={16} />
              Upload Photos
            </button>
            <button
              onClick={onAllImagesClick}
              className="neo-raised px-4 py-2 rounded-xl hover:neo-hover active:neo-inset transition-all text-sm font-semibold flex items-center gap-2"
            >
              <LayoutGrid size={16} />
              All Images
            </button>
            <button
              onClick={() => {/* TODO: Add new item */}}
              className="neo-raised px-4 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 active:neo-inset transition-all text-sm font-bold flex items-center gap-2 text-green-600"
            >
              <Plus size={16} />
              Add Item
            </button>
            <button
              onClick={handleRefresh}
              className="neo-raised px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 active:neo-inset transition-all text-sm font-bold flex items-center gap-2 text-blue-600"
            >
              <Upload size={16} />
              Bulk Upload
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 neo-inset rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Category</label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="w-full px-4 py-2 neo-inset rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Filter */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Availability</label>
            <select
              value={selectedAvailability || ''}
              onChange={(e) => setSelectedAvailability(e.target.value || null)}
              className="w-full px-4 py-2 neo-inset rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All Items</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="neo-raised rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Price</th>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</th>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-white/5">
              {displayItems.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  {/* Item Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden neo-inset flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/10 to-purple-500/10">
                            <span className="text-2xl">🍽️</span>
                          </div>
                        )}
                      </div>
                      {/* Name and Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.is_combo ? (
                            <button
                              onClick={() => handleEditCombo(item)}
                              className="font-bold text-foreground truncate hover:text-purple-400 transition-colors text-left"
                            >
                              {item.name}
                            </button>
                          ) : (
                            <h4 className="font-bold text-foreground truncate">{item.name}</h4>
                          )}
                          {item.is_combo && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0">
                              COMBO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      </div>
                    </div>
                  </td>

                  {/* Category Column */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {categories.find(c => c.id === item.category_id)?.name || item.category_id}
                    </span>
                  </td>

                  {/* Price Column */}
                  <td className="px-6 py-4">
                    <span className="font-bold text-lg" style={{ color: primaryColor }}>
                      ₹{item.price.toFixed(0)}
                    </span>
                  </td>

                  {/* Tags Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {/* Veg/Non-veg */}
                      {item.is_veg && (
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                          Veg
                        </span>
                      )}
                      {/* Dietary Tags */}
                      {item.dietary_tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border",
                            tag === 'spicy' || tag.includes('hot')
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : tag === 'mild'
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Status Column */}
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold",
                        item.active
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      )}
                    >
                      {item.active ? 'Available' : 'Unavailable'}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(item)}
                        className="px-3 py-1.5 rounded-lg neo-raised hover:neo-hover active:neo-inset transition-all text-xs font-semibold text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(item)}
                        className="px-3 py-1.5 rounded-lg neo-raised hover:neo-hover active:neo-inset transition-all text-xs font-semibold text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="glass-panel p-12 rounded-2xl border border-border text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-foreground mb-2">No items found</h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? `No menu items match "${searchQuery}"`
              : 'Try selecting a different category or clearing your search'}
          </p>
        </div>
      )}

      {/* Combo Editor Modal */}
      <ComboEditor
        isOpen={showComboEditor}
        menuItem={editingItem}
        onClose={handleComboEditorClose}
        onSaved={handleComboSaved}
      />

      {/* Passcode Dialog */}
      <PasscodeDialog
        isOpen={showPasscodeDialog}
        onClose={handlePasscodeClose}
        onSuccess={handlePasscodeSuccess}
        title="Protected Action"
        description={`Enter passcode to ${pendingAction?.type === 'edit' ? 'edit' : 'delete'} menu item`}
        passcode="6163"
      />

      {/* Edit Form Modal */}
      {showEditForm && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel rounded-2xl border border-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 glass-panel z-10">
              <h2 className="text-xl font-bold">Edit Menu Item</h2>
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditFormData(null);
                }}
                className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
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
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="e.g., Butter Chicken"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
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
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    Category *
                  </label>
                  <select
                    value={editFormData.category_id}
                    onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                    value={editFormData.preparation_time}
                    onChange={(e) => setEditFormData({ ...editFormData, preparation_time: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    Status
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={editFormData.active}
                      onChange={(e) => setEditFormData({ ...editFormData, active: e.target.checked })}
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
                        editFormData.dietary_tags.includes(tag)
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">
                  Item Image
                </label>

                {/* Image Preview */}
                {editFormData.image && (
                  <div className="mb-3 relative group">
                    <img
                      src={editFormData.image}
                      alt="Menu item"
                      className="w-full h-48 object-cover rounded-xl border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, image: '' })}
                      className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Upload Options */}
                <div className="flex gap-2">
                  {/* File Upload Button */}
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <div className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all",
                      uploadingImage
                        ? "bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed"
                        : "bg-accent/10 border-accent/30 text-accent hover:bg-accent/20"
                    )}>
                      {uploadingImage ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload Image
                        </>
                      )}
                    </div>
                  </label>

                  {/* URL Input Toggle */}
                  {!editFormData.image && (
                    <input
                      type="text"
                      value={editFormData.image || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, image: e.target.value })}
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Or paste image URL"
                    />
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Upload: JPEG, PNG, WebP, HEIC (max 10MB)
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-border sticky bottom-0 glass-panel">
              <button
                onClick={() => {
                  setShowEditForm(false);
                  setEditFormData(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={isSaving || !editFormData.name || !editFormData.category_id}
                className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: primaryColor,
                  boxShadow: `0 10px 15px -3px ${primaryColor}20`
                }}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuItemsList;

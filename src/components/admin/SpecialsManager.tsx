/**
 * Today's Specials Manager
 * Allows managers to create and manage daily specials from the POS
 */

import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

// Visibility options for specials
type SpecialVisibility = 'both' | 'web' | 'dine-in';

interface SpecialItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tags?: string[];
  menuItemId?: string;
  isActive: boolean;
  visibility: SpecialVisibility;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

interface SpecialsManagerProps {
  tenantId: string;
}

const AVAILABLE_TAGS = [
  { id: 'veg', label: 'Vegetarian', color: 'bg-green-500' },
  { id: 'non-veg', label: 'Non-Veg', color: 'bg-red-500' },
  { id: 'spicy', label: 'Spicy', color: 'bg-orange-500' },
];

const VISIBILITY_OPTIONS: { value: SpecialVisibility; label: string; description: string }[] = [
  { value: 'both', label: 'Both', description: 'Show on web menu & POS' },
  { value: 'web', label: 'Web Only', description: 'Show only on online menu' },
  { value: 'dine-in', label: 'Dine-in Only', description: 'Show only in POS' },
];

// Get API base URL - use admin-panel for specials management
const getApiBaseUrl = () => {
  return import.meta.env.VITE_ADMIN_PANEL_URL || 'https://handsfree-admin-panel.pages.dev';
};

export function SpecialsManager({ tenantId }: SpecialsManagerProps) {
  const [specials, setSpecials] = useState<SpecialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<SpecialItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    tags: [] as string[],
    visibility: 'both' as SpecialVisibility,
    isActive: true,
  });

  // Fetch specials on mount
  useEffect(() => {
    loadSpecials();
  }, [tenantId]);

  const loadSpecials = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/tenants/${tenantId}/specials?channel=all&includeInactive=true`);

      if (!response.ok) {
        throw new Error(`Failed to fetch specials: ${response.status}`);
      }

      const data = await response.json();
      setSpecials(data.specials || []);
    } catch (err) {
      console.error('Error loading specials:', err);
      setError(err instanceof Error ? err.message : 'Failed to load specials');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      image: '',
      tags: [],
      visibility: 'both',
      isActive: true,
    });
    setEditingSpecial(null);
    setShowForm(false);
  };

  const handleEdit = (special: SpecialItem) => {
    setFormData({
      name: special.name,
      description: special.description || '',
      price: special.price.toString(),
      image: special.image || '',
      tags: special.tags || [],
      visibility: special.visibility || 'both',
      isActive: special.isActive,
    });
    setEditingSpecial(special);
    setShowForm(true);
  };

  const handleTagToggle = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(t => t !== tagId)
        : [...prev.tags, tagId],
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      alert('Valid price is required');
      return;
    }

    setIsSaving(true);

    try {
      const baseUrl = getApiBaseUrl();
      const payload = {
        ...(editingSpecial ? { id: editingSpecial.id } : {}),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price,
        image: formData.image.trim() || undefined,
        tags: formData.tags,
        visibility: formData.visibility,
        isActive: formData.isActive,
        sortOrder: editingSpecial?.sortOrder ?? specials.length,
      };

      const response = await fetch(`${baseUrl}/api/tenants/${tenantId}/specials`, {
        method: editingSpecial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save special');
      }

      await loadSpecials();
      resetForm();
    } catch (err) {
      console.error('Error saving special:', err);
      alert(err instanceof Error ? err.message : 'Failed to save special');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (specialId: string) => {
    if (!confirm('Are you sure you want to delete this special?')) {
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/tenants/${tenantId}/specials?id=${specialId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete special');
      }

      await loadSpecials();
    } catch (err) {
      console.error('Error deleting special:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete special');
    }
  };

  const handleToggleActive = async (special: SpecialItem) => {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/tenants/${tenantId}/specials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: special.id,
          isActive: !special.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update special');
      }

      await loadSpecials();
    } catch (err) {
      console.error('Error toggling special:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-muted-foreground">Loading specials...</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            Today's Specials
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Create off-menu items or highlight dishes for quick billing
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="neo-button-primary px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Add Special
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
          {error}
          <button onClick={loadSpecials} className="ml-4 underline">
            Retry
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="neo-card p-6 space-y-4 border-2 border-amber-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editingSpecial ? 'Edit Special' : 'Add New Special'}
            </h3>
            <button
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Chef's Special Thali"
                className="w-full neo-input px-3 py-2 rounded-lg"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Price *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="e.g., 299"
                min="0"
                step="0.01"
                className="w-full neo-input px-3 py-2 rounded-lg"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the special..."
              rows={2}
              className="w-full neo-input px-3 py-2 rounded-lg resize-none"
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Image URL (optional)</label>
            <input
              type="text"
              value={formData.image}
              onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
              placeholder="https://example.com/image.jpg"
              className="w-full neo-input px-3 py-2 rounded-lg"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    formData.tags.includes(tag.id)
                      ? `${tag.color} text-white`
                      : 'neo-button'
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Visibility</label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, visibility: option.value }))}
                  className={cn(
                    'p-3 rounded-lg text-center transition-all',
                    formData.visibility === option.value
                      ? 'neo-pressed bg-primary/10 border-2 border-primary'
                      : 'neo-button'
                  )}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative',
                formData.isActive ? 'bg-green-500' : 'bg-gray-300'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  formData.isActive ? 'translate-x-6' : 'translate-x-0.5'
                )}
              />
            </button>
            <span className="text-sm font-medium">Show in menu</span>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={resetForm}
              className="neo-button px-4 py-2 rounded-lg"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="neo-button-primary px-4 py-2 rounded-lg flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Saving...
                </>
              ) : (
                <>
                  <span>💾</span>
                  {editingSpecial ? 'Update' : 'Add'} Special
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Specials List */}
      {specials.length === 0 ? (
        <div className="neo-card p-12 text-center">
          <div className="text-4xl mb-4">⭐</div>
          <h3 className="text-lg font-semibold mb-2">No Specials Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your first special to highlight it in the menu
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="neo-button-primary px-4 py-2 rounded-lg"
          >
            Add Your First Special
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {specials.map((special) => (
            <div
              key={special.id}
              className={cn(
                'neo-card overflow-hidden transition-all',
                !special.isActive && 'opacity-50'
              )}
            >
              {/* Image */}
              {special.image ? (
                <div className="h-32 overflow-hidden bg-muted">
                  <img
                    src={special.image}
                    alt={special.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center">
                  <span className="text-4xl">⭐</span>
                </div>
              )}

              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-bold">{special.name}</h4>
                    {!special.isActive && (
                      <span className="text-xs px-2 py-0.5 bg-muted rounded">Hidden</span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-amber-600">₹{special.price}</span>
                </div>

                {/* Description */}
                {special.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {special.description}
                  </p>
                )}

                {/* Tags & Visibility */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {special.tags?.map(tagId => {
                    const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                    return tag ? (
                      <span
                        key={tagId}
                        className={cn('text-xs px-2 py-0.5 rounded-full text-white', tag.color)}
                      >
                        {tag.label}
                      </span>
                    ) : null;
                  })}
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                    {special.visibility === 'both' ? 'Web + POS' :
                     special.visibility === 'web' ? 'Web Only' : 'POS Only'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(special)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      special.isActive
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                    )}
                  >
                    {special.isActive ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => handleEdit(special)}
                    className="neo-button px-3 py-2 rounded-lg text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(special.id)}
                    className="px-3 py-2 rounded-lg text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="neo-card p-4 bg-amber-500/5 border border-amber-500/20">
        <h4 className="font-semibold flex items-center gap-2 mb-2">
          <span>💡</span>
          How Today's Specials Work
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Specials appear in a dedicated "TODAY'S" category in the POS</li>
          <li>• You can add off-menu items that aren't in your regular menu</li>
          <li>• Control visibility: show on web menu, POS, or both</li>
          <li>• Toggle items on/off without deleting them</li>
        </ul>
      </div>
    </div>
  );
}

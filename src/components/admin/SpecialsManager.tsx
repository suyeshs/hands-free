/**
 * Today's Specials Manager
 * Allows managers to create and manage daily specials from the POS
 */

import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useIsLocationTenant } from '../../hooks/useIsLocationTenant';
import { LocationTenantBanner } from '../locations/LocationTenantBanner';
import { ADMIN_PANEL_URL } from '../../lib/appConfig';

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

const INPUT_CLS = 'w-full h-10 px-3 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/60 transition-colors';
const TEXTAREA_CLS = 'w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/60 resize-none transition-colors';
const BTN_PRIMARY = 'h-9 px-4 rounded-xl bg-accent text-white text-xs font-black hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2';
const BTN_SECONDARY = 'h-9 px-3 rounded-xl border border-border text-xs font-bold hover:bg-surface-2 transition-colors';
const LABEL_CLS = 'block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5';

export function SpecialsManager({ tenantId }: SpecialsManagerProps) {
  const { isLocation, locationMetadata } = useIsLocationTenant();
  const [specials, setSpecials] = useState<SpecialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSpecial, setEditingSpecial] = useState<SpecialItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    tags: [] as string[],
    visibility: 'both' as SpecialVisibility,
    isActive: true,
  });

  useEffect(() => {
    loadSpecials();
  }, [tenantId]);

  const loadSpecials = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = import.meta.env.VITE_ADMIN_PANEL_URL || ADMIN_PANEL_URL;
      const response = await fetch(`${baseUrl}/api/specials/${tenantId}?channel=all&includeInactive=true`);
      if (!response.ok) throw new Error(`Failed to fetch specials: ${response.status}`);
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
    setFormData({ name: '', description: '', price: '', image: '', tags: [], visibility: 'both', isActive: true });
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
      tags: prev.tags.includes(tagId) ? prev.tags.filter(t => t !== tagId) : [...prev.tags, tagId],
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { alert('Name is required'); return; }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) { alert('Valid price is required'); return; }

    setIsSaving(true);
    try {
      const baseUrl = import.meta.env.VITE_ADMIN_PANEL_URL || ADMIN_PANEL_URL;
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
      const response = await fetch(`${baseUrl}/api/specials/${tenantId}`, {
        method: editingSpecial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try { const e = await response.json(); msg = e.error || msg; } catch {}
        throw new Error(msg);
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
    if (!confirm('Are you sure you want to delete this special?')) return;
    try {
      const baseUrl = import.meta.env.VITE_ADMIN_PANEL_URL || ADMIN_PANEL_URL;
      const response = await fetch(`${baseUrl}/api/specials/${tenantId}?id=${specialId}`, { method: 'DELETE' });
      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try { const e = await response.json(); msg = e.error || msg; } catch {}
        throw new Error(msg);
      }
      await loadSpecials();
    } catch (err) {
      console.error('Error deleting special:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete special');
    }
  };

  const handleToggleActive = async (special: SpecialItem) => {
    try {
      const baseUrl = import.meta.env.VITE_ADMIN_PANEL_URL || ADMIN_PANEL_URL;
      const response = await fetch(`${baseUrl}/api/specials/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: special.id, isActive: !special.isActive }),
      });
      if (!response.ok) throw new Error('Failed to update special');
      await loadSpecials();
    } catch (err) {
      console.error('Error toggling special:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full"></div>
        <span className="ml-3 text-muted-foreground">Loading specials...</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {isLocation && (
        <LocationTenantBanner
          locationName={locationMetadata?.currentLocationName}
          masterTenantId={locationMetadata?.masterTenantId}
          variant="info"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl">⭐</span>
            Today's Specials
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Create location-specific off-menu items or highlight dishes for quick billing
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className={BTN_PRIMARY}>
            <span className="text-lg leading-none">+</span>
            Add Special
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
          <button onClick={loadSpecials} className="ml-4 underline">Retry</button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {editingSpecial ? 'Edit Special' : 'Add New Special'}
            </h3>
            <button onClick={resetForm} className="p-2 hover:bg-surface-2 transition-colors text-muted-foreground hover:text-foreground">
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS}>Item Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Chef's Special Thali"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Price *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="e.g., 299"
                min="0"
                step="0.01"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the special..."
              rows={2}
              className={TEXTAREA_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Image URL (optional)</label>
            <input
              type="text"
              value={formData.image}
              onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
              placeholder="https://example.com/image.jpg"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Tags</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  className={cn(
                    'h-8 px-3 rounded-lg text-xs font-bold border transition-all',
                    formData.tags.includes(tag.id)
                      ? `${tag.color} text-white border-transparent`
                      : 'bg-surface-2 border-border hover:border-accent/40 text-muted-foreground'
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Visibility</label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, visibility: option.value }))}
                  className={cn(
                    'p-3 rounded-xl text-center transition-all border text-xs',
                    formData.visibility === option.value
                      ? 'bg-accent/15 border-accent/50 text-accent font-black'
                      : 'bg-surface-2 border-border hover:border-accent/30 text-muted-foreground'
                  )}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={cn(
                'w-12 h-6 rounded-full transition-colors relative flex-shrink-0',
                formData.isActive ? 'bg-green-500' : 'bg-white/20'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  formData.isActive ? 'translate-x-6' : 'translate-x-0.5'
                )}
              />
            </button>
            <span className="text-sm font-medium text-foreground">Show in menu</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button onClick={resetForm} className={BTN_SECONDARY} disabled={isSaving}>
              Cancel
            </button>
            <button onClick={handleSave} className={BTN_PRIMARY} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Saving...
                </>
              ) : (
                <>💾 {editingSpecial ? 'Update' : 'Add'} Special</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Specials List */}
      {specials.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">⭐</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Specials Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your first special to highlight it in the menu
          </p>
          <button onClick={() => setShowForm(true)} className={BTN_PRIMARY}>
            Add Your First Special
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {specials.map((special) => (
            <div
              key={special.id}
              className={cn(
                'bg-card border border-border rounded-2xl overflow-hidden transition-all',
                !special.isActive && 'opacity-40'
              )}
            >
              {special.image ? (
                <div className="h-32 overflow-hidden">
                  <img src={special.image} alt={special.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-32 bg-surface-2 flex items-center justify-center">
                  <span className="text-4xl opacity-40">⭐</span>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-bold text-foreground">{special.name}</h4>
                    {!special.isActive && (
                      <span className="text-[10px] px-2 py-0.5 bg-surface-2 border border-border text-muted-foreground rounded-full">Hidden</span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-amber-500">₹{special.price}</span>
                </div>

                {special.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{special.description}</p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {special.tags?.map(tagId => {
                    const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                    return tag ? (
                      <span key={tagId} className={cn('text-xs px-2 py-0.5 rounded-full text-white', tag.color)}>
                        {tag.label}
                      </span>
                    ) : null;
                  })}
                  <span className="text-[10px] px-2 py-0.5 bg-sky-400/15 border border-sky-400/30 text-sky-400 rounded-full">
                    {special.visibility === 'both' ? 'Web + POS' : special.visibility === 'web' ? 'Web Only' : 'POS Only'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(special)}
                    className={cn(
                      'flex-1 h-8 rounded-lg text-[11px] font-bold border transition-colors',
                      special.isActive
                        ? 'bg-amber-400/10 text-amber-400 border-amber-400/25 hover:bg-amber-400/20'
                        : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25 hover:bg-emerald-400/20'
                    )}
                  >
                    {special.isActive ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => handleEdit(special)} className={BTN_SECONDARY}>Edit</button>
                  <button
                    onClick={() => handleDelete(special.id)}
                    className="h-9 px-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
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
      <div className="bg-surface-2 border border-border rounded-2xl p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
          <span>💡</span>
          How Specials Work
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li>• Specials appear in a dedicated "TODAY'S" category in the POS</li>
          <li>• Add off-menu items that aren't in your regular menu</li>
          <li>• Control visibility: web menu, POS, or both</li>
          <li>• Toggle on/off without deleting</li>
        </ul>
      </div>
    </div>
  );
}

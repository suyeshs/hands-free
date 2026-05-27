/**
 * Popular Items Manager
 * Pin menu items as "Popular" from the POS.
 * Pinned items appear in the 🔥 Popular tab on the customer ordering screen.
 */

import { useState, useEffect } from 'react';
import { useMenuStore } from '../../stores/menuStore';
import { MenuItem } from '../../types';
import { cn } from '../../lib/utils';
import { useIsLocationTenant } from '../../hooks/useIsLocationTenant';
import { LocationTenantBanner } from '../locations/LocationTenantBanner';
import { ADMIN_PANEL_URL } from '../../lib/appConfig';

interface PopularItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tags?: string[];
  menuItemId?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

interface PopularManagerProps {
  tenantId: string;
}

export function PopularManager({ tenantId }: PopularManagerProps) {
  const { isLocation, locationMetadata } = useIsLocationTenant();
  const { items: menuItems, categories, loadMenuFromDatabase, isLoading: menuLoading } = useMenuStore();

  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const baseUrl = () => import.meta.env.VITE_ADMIN_PANEL_URL || ADMIN_PANEL_URL;

  useEffect(() => {
    loadMenuFromDatabase();
    loadPopular();
  }, [tenantId]);

  const loadPopular = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl()}/api/tenants/${tenantId}/popular?includeInactive=true`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setPopularItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load popular items');
    } finally {
      setIsLoading(false);
    }
  };

  const getPinnedEntry = (menuItemId: string) =>
    popularItems.find(p => p.menuItemId === menuItemId);

  const handleTogglePin = async (item: MenuItem) => {
    const pinned = getPinnedEntry(item.id);
    setTogglingId(item.id);
    try {
      if (pinned) {
        const res = await fetch(`${baseUrl()}/api/tenants/${tenantId}/popular?id=${pinned.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to unpin item');
      } else {
        const payload = {
          name: item.name,
          description: item.description?.trim() || undefined,
          price: item.price,
          image: item.image || undefined,
          tags: item.dietary_tags || [],
          menuItemId: item.id,
          isActive: true,
          sortOrder: popularItems.length,
        };
        const res = await fetch(`${baseUrl()}/api/tenants/${tenantId}/popular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to pin item');
      }
      await loadPopular();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleActive = async (item: PopularItem) => {
    try {
      const res = await fetch(`${baseUrl()}/api/tenants/${tenantId}/popular`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadPopular();
    } catch (err) {
      console.error('Error toggling popular item:', err);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this item from Popular?')) return;
    try {
      const res = await fetch(`${baseUrl()}/api/tenants/${tenantId}/popular?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove');
      await loadPopular();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (selectedCategory && item.category_id !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const activeCount = popularItems.filter(p => p.isActive).length;

  if (isLoading || menuLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
        <span className="ml-3 text-muted-foreground">Loading...</span>
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
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span>🔥</span> Popular Items
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {activeCount > 0
            ? `${activeCount} item${activeCount !== 1 ? 's' : ''} showing in the Popular tab`
            : 'Tap 🔥 Pin next to any menu item to feature it in the Popular tab'}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
          <button onClick={loadPopular} className="ml-4 underline">Retry</button>
        </div>
      )}

      {/* Pinned Items */}
      {popularItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Pinned ({popularItems.length})
          </h3>
          <div className="space-y-2">
            {popularItems.map(item => (
              <div
                key={item.id}
                className={cn(
                  'glass-panel border border-border p-3 flex items-center gap-3',
                  !item.isActive && 'opacity-50'
                )}
              >
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center rounded flex-shrink-0 text-xl">
                    🔥
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{item.name}</p>
                  <p className="text-sm text-amber-500 font-bold">₹{item.price}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!item.isActive && (
                    <span className="text-xs px-2 py-0.5 bg-white/10 text-muted-foreground rounded">
                      Hidden
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={cn(
                      'text-xs px-3 py-1.5 border transition-colors',
                      item.isActive
                        ? 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10'
                        : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                    )}
                  >
                    {item.isActive ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menu Picker */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {popularItems.length > 0 ? 'Add More from Menu' : 'Pin from Menu'}
        </h3>

        {/* Search + Category */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
          />
          <select
            value={selectedCategory || ''}
            onChange={e => setSelectedCategory(e.target.value || null)}
            className="px-4 py-2 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Menu Items */}
        {menuItems.length === 0 ? (
          <div className="glass-panel border border-border p-8 text-center">
            <p className="text-muted-foreground">No menu items found. Sync your menu first.</p>
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="glass-panel border border-border p-8 text-center">
            <p className="text-muted-foreground">No items match your search.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMenuItems.map(item => {
              const pinned = getPinnedEntry(item.id);
              const toggling = togglingId === item.id;
              const catName = categories.find(c => c.id === item.category_id)?.name;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'glass-panel border border-border p-3 flex items-center gap-3 transition-all',
                    pinned && 'border-orange-500/30 bg-orange-500/5'
                  )}
                >
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{item.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-amber-500 font-bold">₹{item.price}</span>
                      {catName && (
                        <span className="text-xs text-muted-foreground">{catName}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTogglePin(item)}
                    disabled={toggling}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 text-sm font-bold border transition-all flex-shrink-0',
                      pinned
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                        : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/20',
                      toggling && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {toggling ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : pinned ? (
                      '🔥 Pinned'
                    ) : (
                      '🔥 Pin'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="glass-panel border border-red-500/20 p-4 bg-red-500/5">
        <h4 className="font-semibold text-foreground flex items-center gap-2 mb-2">
          <span>💡</span> How Popular Items Work
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Pinned items appear in the 🔥 Popular tab on the customer ordering screen</li>
          <li>• Use Hide to temporarily remove an item without unpinning it</li>
          <li>• Items appear in the order you pin them</li>
        </ul>
      </div>
    </div>
  );
}

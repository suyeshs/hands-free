/**
 * Menu Items List Component
 * Displays all menu items in a table format with category filters
 */

import { useState, useEffect } from 'react';
import { useMenuStore } from '../../stores/menuStore';
import { cn } from '../../lib/utils';

interface MenuItemsListProps {
  onRefresh?: () => void;
}

export function MenuItemsList({ onRefresh }: MenuItemsListProps) {
  const { items, categories, loadMenuFromDatabase, isLoading } = useMenuStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="glass-panel p-4 rounded-xl border border-border">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">
              Menu Items <span className="text-accent">({filteredItems.length})</span>
            </h3>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
              {categories.length} categories
            </p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Search */}
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 sm:w-64 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted-foreground/50"
            />

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Category filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all border",
              selectedCategory === null
                ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1",
                selectedCategory === category.id
                  ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
              )}
            >
              <span>{category.icon}</span>
              <span className="uppercase tracking-wider">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Menu items table */}
      <div className="glass-panel rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border bg-white/5">
                <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Item
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Tags
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-10 w-10 rounded-lg object-cover mr-3 border border-border"
                        />
                      )}
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {item.name}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-muted-foreground">{item.category_id}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-accent">
                      Rs. {item.price.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {item.dietary_tags?.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/20 text-green-400 border border-green-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.dietary_tags && item.dietary_tags.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-muted-foreground">
                          +{item.dietary_tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                        item.active
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        item.active ? "bg-green-400" : "bg-red-400"
                      )} />
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MenuItemsList;

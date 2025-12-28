/**
 * Guest Menu Browser
 * Displays menu categories and items for guest ordering
 */

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { GuestMenuItemCard } from './GuestMenuItemCard';

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category_id: string;
  is_veg?: boolean;
  is_vegan?: boolean;
  dietary_tags?: string[];
  active?: boolean;
  modifiers?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

interface GuestMenuBrowserProps {
  categories: Category[];
  items: MenuItem[];
}

export function GuestMenuBrowser({ categories, items }: GuestMenuBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryTabsRef = useRef<HTMLDivElement>(null);

  // Filter active items only
  const activeItems = items.filter((item) => item.active !== false);

  // Filter items by search query
  const filteredItems = activeItems.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  });

  // Group items by category
  const itemsByCategory = categories
    .map((category) => ({
      category,
      items: filteredItems.filter((item) => item.category_id === category.id),
    }))
    .filter(({ items }) => items.length > 0);

  // Scroll to category when tab is clicked
  const scrollToCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const element = categoryRefs.current[categoryId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Update selected category based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150; // Account for header

      for (const { category } of itemsByCategory) {
        const element = categoryRefs.current[category.id];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setSelectedCategory(category.id);

            // Scroll category tab into view
            if (categoryTabsRef.current) {
              const tabButton = categoryTabsRef.current.querySelector(
                `[data-category="${category.id}"]`
              );
              if (tabButton) {
                tabButton.scrollIntoView({ behavior: 'smooth', inline: 'center' });
              }
            }
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [itemsByCategory]);

  return (
    <div className="flex-1 bg-gray-50">
      {/* Search bar */}
      <div className="sticky top-[60px] z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs - horizontal scroll */}
      {!searchQuery && (
        <div
          ref={categoryTabsRef}
          className="sticky top-[124px] z-40 bg-white border-b border-gray-200 overflow-x-auto scrollbar-hide"
        >
          <div className="flex gap-2 px-4 py-2">
            {itemsByCategory.map(({ category }) => (
              <button
                key={category.id}
                data-category={category.id}
                onClick={() => scrollToCategory(category.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu items grouped by category */}
      <div className="px-4 py-4 space-y-6">
        {searchQuery ? (
          // Search results - flat list
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No items found for "{searchQuery}"</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
                </p>
                {filteredItems.map((item) => (
                  <GuestMenuItemCard key={item.id} item={item} />
                ))}
              </>
            )}
          </div>
        ) : (
          // Grouped by category
          itemsByCategory.map(({ category, items: categoryItems }) => (
            <div
              key={category.id}
              ref={(el) => { categoryRefs.current[category.id] = el; }}
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {category.name}
              </h2>
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <GuestMenuItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Bottom padding for cart button */}
        <div className="h-24" />
      </div>
    </div>
  );
}

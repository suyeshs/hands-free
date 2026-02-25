'use client';

import { useState, useRef, useEffect } from 'react';
import MenuItemCard from './MenuItemCard';
import ComboCard from './ComboCard';
import { observer } from 'mobx-react-lite';
import { useMenu } from '../contexts/MenuContext';
import { menuStore } from '../stores/menuStore';
import { getTenantId } from '../lib/restaurant-config-loader';
import { cartStore } from '../stores/cartStore';

// Today's Special Item type
interface SpecialItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  tags?: string[];
  isActive: boolean;
  visibility: 'both' | 'web' | 'dine-in';
  sortOrder: number;
}

// Specials cache for instant load
const SPECIALS_CACHE_KEY = 'specials_cache';
const SPECIALS_CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CachedSpecialsData {
  specials: SpecialItem[];
  timestamp: number;
  tenantId: string;
}

function getCachedSpecials(tenantId: string): SpecialItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(SPECIALS_CACHE_KEY);
    if (!cached) return null;
    const data: CachedSpecialsData = JSON.parse(cached);
    if (data.tenantId === tenantId && Date.now() - data.timestamp < SPECIALS_CACHE_DURATION_MS) {
      return data.specials;
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedSpecials(tenantId: string, specials: SpecialItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SPECIALS_CACHE_KEY, JSON.stringify({
      specials,
      timestamp: Date.now(),
      tenantId,
    }));
  } catch {
    // Ignore storage errors
  }
}

const Menu: React.FC = observer(() => {
  const { items: menuItems, categories, isLoading, error } = useMenu();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showVegOnly, setShowVegOnly] = useState<boolean>(false);
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [maxScroll, setMaxScroll] = useState<number>(0);

  // Today's Specials state
  const [specials, setSpecials] = useState<SpecialItem[]>([]);
  const [specialsLoading, setSpecialsLoading] = useState(true);

  // Use menuStore for activeCategory (controlled by voice commands)
  const activeCategory = menuStore.activeCategory;
  const setActiveCategory = (category: string) => menuStore.setActiveCategory(category);

  const filteredItems = menuItems.filter(item =>
    (activeCategory === 'all' || item.category === activeCategory) &&
    (!showVegOnly || item.type === 'veg')
  );

  // Fetch Today's Specials with caching
  useEffect(() => {
    const tenantId = getTenantId();

    // Check cache first
    const cached = getCachedSpecials(tenantId);
    if (cached) {
      setSpecials(cached);
      setSpecialsLoading(false);
      // Still refresh in background
    }

    const fetchSpecials = async () => {
      try {
        const response = await fetch(`/api/specials/${tenantId}?channel=web`);
        if (response.ok) {
          const data = await response.json() as { specials?: SpecialItem[] };
          const fetchedSpecials = data.specials || [];
          setSpecials(fetchedSpecials);
          setCachedSpecials(tenantId, fetchedSpecials);
        }
      } catch (err) {
        console.error('Failed to fetch specials:', err);
      } finally {
        setSpecialsLoading(false);
      }
    };
    fetchSpecials();
  }, []);

  // Handle adding special to cart
  const handleAddSpecialToCart = (special: SpecialItem) => {
    // Convert special to menu item format and add to cart
    const menuItem = {
      name: special.name,
      description: special.description || '',
      price: special.price,
      imageUrl: special.image,
      type: special.tags?.includes('veg') ? 'veg' : 'non-veg',
      category: 'specials',
    };
    cartStore.addMenuItem(menuItem as any);
  };

  // Calculate max scroll width when categories load
  useEffect(() => {
    if (tabsRef.current) {
      const maxScrollWidth = tabsRef.current.scrollWidth - tabsRef.current.clientWidth;
      setMaxScroll(maxScrollWidth);
    }
  }, [categories]);

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setSliderValue(value);
    if (tabsRef.current) {
      tabsRef.current.scrollLeft = value;
    }
  };

  // Update slider when categories are scrolled manually
  const handleCategoryScroll = () => {
    if (tabsRef.current) {
      setSliderValue(tabsRef.current.scrollLeft);
    }
  };

  useEffect(() => {
    if (tabsRef.current) {
      const activeTab = tabsRef.current.querySelector(`[data-category="${activeCategory}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeCategory]);

  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4"></div>
          <p className="text-lg neu-text-secondary">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <div className="text-center text-red-500">
          <p className="text-lg">Failed to load menu: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Today's Specials Section */}
      {!specialsLoading && specials.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⭐</span>
            <h3 className="text-xl font-bold neu-text">Today's Specials</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {specials.map((special) => (
              <div
                key={special.id}
                className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {/* Special Badge */}
                <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  Special
                </div>

                {/* Image */}
                {special.image && (
                  <div className="h-40 overflow-hidden">
                    <img
                      src={special.image}
                      alt={special.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-gray-900">{special.name}</h4>
                      {special.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{special.description}</p>
                      )}
                      {/* Tags */}
                      {special.tags && special.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {special.tags.includes('veg') && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Veg</span>
                          )}
                          {special.tags.includes('non-veg') && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Non-Veg</span>
                          )}
                          {special.tags.includes('spicy') && (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Spicy</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-amber-600">₹{special.price}</span>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => handleAddSpecialToCart(special)}
                    className="w-full mt-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="relative mb-6 overflow-hidden">
        <div
          ref={tabsRef}
          className="flex overflow-x-auto pb-2 gap-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={handleCategoryScroll}
        >
          {categories.filter(cat => cat).map((category) => (
            <button
              key={category}
              data-category={category}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeCategory === category
                  ? 'neu-button-accent'
                  : 'neu-button'
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category?.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Uncategorized'}
            </button>
          ))}
        </div>

        {/* Material Design Slider for Category Navigation */}
        {maxScroll > 0 && (
          <div className="mt-2 px-2">
            <input
              type="range"
              min="0"
              max={maxScroll}
              value={sliderValue}
              onChange={handleSliderChange}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${(sliderValue / maxScroll) * 100}%, #e5e7eb ${(sliderValue / maxScroll) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>
        )}
      </div>

      {/* Veg/Non-Veg Toggle */}
      <div className="flex justify-center items-center mb-6">
        <span className="mr-3 text-sm font-medium neu-text">All</span>
        <button
          className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${
            showVegOnly ? 'bg-green-400' : 'bg-gray-300'
          }`}
          onClick={() => setShowVegOnly(!showVegOnly)}
        >
          <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
            showVegOnly ? 'translate-x-7' : 'translate-x-0'
          }`}></div>
        </button>
        <span className="ml-3 text-sm font-medium neu-text">Veg Only</span>
      </div>

      {/* Menu Grid - Responsive columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item, index) => {
          // Check if item is a combo meal - check by category (COMBO MEALS)
          const isCombo = item.category === 'COMBO MEALS' || (item.tags?.isCombo && item.tags?.choices?.length > 0);

          if (isCombo) {
            // Render ComboCard for combo meals
            return (
              <ComboCard
                key={`${item.name}-${index}`}
                item={{
                  ...item,
                  category: 'combos',
                  choices: item.tags?.choices || []
                } as any}
              />
            );
          }

          // Render regular MenuItemCard
          return (
            <MenuItemCard
              key={`${item.name}-${index}`}
              item={item as any}
            />
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg neu-text-secondary">No items found in this category</p>
        </div>
      )}
    </div>
  );
});

export default Menu;

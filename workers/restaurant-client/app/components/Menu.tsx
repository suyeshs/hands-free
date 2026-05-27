'use client';

import { useState, useRef, useEffect } from 'react';
import MenuItemCard from './MenuItemCard';
import ComboCard from './ComboCard';
import { observer } from 'mobx-react-lite';
import { useMenu } from '../contexts/MenuContext';
import { menuStore } from '../stores/menuStore';


const MEAT_TYPES = ['Pork', 'Chicken', 'Lamb', 'Fish'] as const;
type MeatType = typeof MEAT_TYPES[number];

const MEAT_KEYWORDS: Record<MeatType, string[]> = {
  Pork:    ['pork', 'pandi', 'pandhi', 'pig', 'bacon'],
  Chicken: ['chicken', 'murgh', 'poultry'],
  Lamb:    ['lamb', 'mutton', 'goat', 'kheema', 'keema'],
  Fish:    ['fish', 'prawn', 'shrimp', 'crab', 'seafood', 'meen'],
};

function getItemMeatTypes(item: any): MeatType[] {
  const text = `${item.name ?? ''} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase();
  return MEAT_TYPES.filter(meat =>
    MEAT_KEYWORDS[meat].some(kw => text.includes(kw))
  );
}

const Menu: React.FC = observer(() => {
  const { items: menuItems, categories, isLoading, error } = useMenu();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [showVegOnly, setShowVegOnly] = useState<boolean>(false);
  const [selectedMeats, setSelectedMeats] = useState<Set<MeatType>>(new Set());
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [maxScroll, setMaxScroll] = useState<number>(0);

  const toggleMeat = (meat: MeatType) => {
    setSelectedMeats(prev => {
      const next = new Set(prev);
      if (next.has(meat)) next.delete(meat); else next.add(meat);
      return next;
    });
  };

  // Use menuStore for activeCategory (controlled by voice commands)
  const activeCategory = menuStore.activeCategory;
  const setActiveCategory = (category: string) => menuStore.setActiveCategory(category);

  const filteredItems = menuItems.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (showVegOnly) return item.type === 'veg';
    if (selectedMeats.size > 0) {
      const itemMeats = getItemMeatTypes(item);
      return itemMeats.some(m => selectedMeats.has(m));
    }
    return true;
  });

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
      {/* Sticky Category + Filter Bar — locks below the header on scroll */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-4 md:-mx-6 px-4 md:px-6 pt-2 pb-3 mb-2 border-b border-gray-100/60 shadow-sm">
        {/* Category Tabs */}
        <div className="relative mb-2">
          <div
            ref={tabsRef}
            className="flex overflow-x-auto gap-2 pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onScroll={handleCategoryScroll}
          >
            {categories.filter(cat => cat).map((category) => (
              <button
                key={category}
                data-category={category}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
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

          {/* Thin scroll-progress indicator */}
          {maxScroll > 0 && (
            <div className="mt-1.5 h-0.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-150"
                style={{ width: `${Math.max(10, (1 - sliderValue / maxScroll) * 100 + (sliderValue / maxScroll) * 10)}%`, marginLeft: `${(sliderValue / maxScroll) * 80}%` }}
              />
            </div>
          )}
        </div>

        {/* Veg toggle + meat checkboxes — single scrollable row */}
        <div
          className="flex items-center gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Toggle switch — visually distinct from category pills */}
          <button
            className={`w-9 h-5 rounded-full p-0.5 flex-shrink-0 transition-all duration-300 ${showVegOnly ? 'bg-green-500' : 'bg-gray-300'}`}
            onClick={() => {
              setShowVegOnly(v => !v);
              setSelectedMeats(new Set());
            }}
            aria-label="Toggle veg only"
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${showVegOnly ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-semibold flex-shrink-0 ${showVegOnly ? 'text-green-600' : 'text-gray-500'}`}>
            🟢 Veg only
          </span>

          {/* Meat pills — shown when veg filter is off */}
          {!showVegOnly && (
            <>
              <div className="h-3 w-px bg-gray-200 flex-shrink-0 mx-0.5" />
              {MEAT_TYPES.map(meat => (
                <label
                  key={meat}
                  className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold cursor-pointer select-none border transition-all ${
                    selectedMeats.has(meat)
                      ? 'bg-orange-100 border-orange-400 text-orange-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedMeats.has(meat)}
                    onChange={() => toggleMeat(meat)}
                  />
                  {meat}
                </label>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Menu list - single column, full width on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
        {filteredItems.map((item, index) => {
          // Check if item is a combo meal - check by category or presence of combo_choices
          const comboChoices: string[] = (item as any).combo_choices || item.tags?.choices || [];
          const isCombo = (item.category || '').toUpperCase() === 'COMBO MEALS' || comboChoices.length > 0;

          if (isCombo) {
            // Render ComboCard for combo meals
            return (
              <ComboCard
                key={`${item.name}-${index}`}
                item={{
                  ...item,
                  category: 'combos',
                  choices: comboChoices
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

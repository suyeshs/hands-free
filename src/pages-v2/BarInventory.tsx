// @ts-nocheck - Work in progress, TypeScript errors temporarily suppressed
/**
 * Bar Inventory Management
 * Visual interface for managing bar stock, restocking, waste tracking
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wine,
  Beer,
  GlassWater,
  Leaf,
  Plus,
  Minus,
  Package,
  AlertTriangle,

  RotateCcw,
  Search,


  DollarSign,

} from 'lucide-react';
import { useBarInventoryStore } from '../stores/barInventoryStore';
import { barInventoryService } from '../lib/barInventoryService';
import { useTenantStore } from '../stores/tenantStore';
import type { BarInventoryItem, BarInventoryCategory } from '../types/bar';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'lowStock' | 'outOfStock';

export default function BarInventory() {
  const { tenant: currentTenant } = useTenantStore();
  const {
    items,
    settings,
    setItems,
    addBottle,
    removeBottle,


    getLowStockItems,
    calculateTotalMl,
    calculateItemCost,
  } = useBarInventoryStore();

  const [_viewMode, _setViewMode] = useState<ViewMode>('grid');
  const [selectedCategory, setSelectedCategory] = useState<BarInventoryCategory | 'all'>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [_selectedItem, setSelectedItem] = useState<BarInventoryItem | null>(null);
  const [_showRestockModal, _setShowRestockModal] = useState(false);
  const [_showWasteModal, _setShowWasteModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load inventory on mount
  useEffect(() => {
    loadInventory();
  }, [currentTenant]);

  const loadInventory = async () => {
    if (!currentTenant?.id) return;

    try {
      setLoading(true);
      const inventoryItems = await barInventoryService.getInventoryItems(currentTenant.id);
      setItems(inventoryItems);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    // Category filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }

    // Search filter
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Stock filter
    if (filterType === 'lowStock') {
      const totalMl = calculateTotalMl(item);
      const parMl = item.parLevel * item.containerSizeMl;
      const threshold = parMl * (settings.lowStockThreshold / 100);
      return totalMl < threshold && totalMl > 0;
    }

    if (filterType === 'outOfStock') {
      return item.fullContainers === 0 && item.partialContainerMl === 0;
    }

    return true;
  });

  // Category stats
  const categoryStats = {
    spirits: items.filter((i) => i.category === 'spirits').length,
    wine: items.filter((i) => i.category === 'wine').length,
    beer: items.filter((i) => i.category === 'beer').length,
    mixers: items.filter((i) => i.category === 'mixers').length,
    garnishes: items.filter((i) => i.category === 'garnishes').length,
    glassware: items.filter((i) => i.category === 'glassware').length,
  };

  const lowStockCount = getLowStockItems().length;
  const outOfStockCount = items.filter((i) => i.fullContainers === 0 && i.partialContainerMl === 0).length;
  const totalValue = items.reduce((sum, item) => sum + calculateItemCost(item), 0);

  // Get category icon
  const getCategoryIcon = (category: BarInventoryCategory) => {
    switch (category) {
      case 'spirits':
        return <Wine className="w-5 h-5" />;
      case 'beer':
        return <Beer className="w-5 h-5" />;
      case 'wine':
        return <Wine className="w-5 h-5" />;
      case 'mixers':
        return <GlassWater className="w-5 h-5" />;
      case 'garnishes':
        return <Leaf className="w-5 h-5" />;
      case 'glassware':
        return <Package className="w-5 h-5" />;
    }
  };

  // Get stock status color
  const getStockStatus = (item: BarInventoryItem) => {
    const totalMl = calculateTotalMl(item);
    const parMl = item.parLevel * item.containerSizeMl;
    const threshold = parMl * (settings.lowStockThreshold / 100);

    if (totalMl === 0) return { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Out of Stock' };
    if (totalMl < threshold) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Low Stock' };
    return { color: 'text-green-500', bg: 'bg-green-500/10', label: 'In Stock' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Wine className="w-8 h-8 text-purple-400" />
              Bar Inventory
            </h1>
            <p className="text-gray-300 mt-1">Manage stock levels, track usage, and prevent shortages</p>
          </div>

          <button
            onClick={loadInventory}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-300 text-sm">Total Items</div>
                <div className="text-2xl font-bold text-white">{items.length}</div>
              </div>
              <Package className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-300 text-sm">Low Stock</div>
                <div className="text-2xl font-bold text-yellow-400">{lowStockCount}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-300 text-sm">Out of Stock</div>
                <div className="text-2xl font-bold text-red-400">{outOfStockCount}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-300 text-sm">Total Value</div>
                <div className="text-2xl font-bold text-green-400">₹{totalValue.toLocaleString()}</div>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white/10 backdrop-blur-sm p-4 border border-white/20 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2  whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setSelectedCategory('spirits')}
              className={`px-4 py-2  whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedCategory === 'spirits'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <Wine className="w-4 h-4" />
              Spirits ({categoryStats.spirits})
            </button>
            <button
              onClick={() => setSelectedCategory('wine')}
              className={`px-4 py-2  whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedCategory === 'wine'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <Wine className="w-4 h-4" />
              Wine ({categoryStats.wine})
            </button>
            <button
              onClick={() => setSelectedCategory('beer')}
              className={`px-4 py-2  whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedCategory === 'beer'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <Beer className="w-4 h-4" />
              Beer ({categoryStats.beer})
            </button>
            <button
              onClick={() => setSelectedCategory('mixers')}
              className={`px-4 py-2  whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedCategory === 'mixers'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <GlassWater className="w-4 h-4" />
              Mixers ({categoryStats.mixers})
            </button>
          </div>

          {/* Stock Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2  whitespace-nowrap transition-colors ${
                filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('lowStock')}
              className={`px-4 py-2  whitespace-nowrap transition-colors ${
                filterType === 'lowStock'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setFilterType('outOfStock')}
              className={`px-4 py-2  whitespace-nowrap transition-colors ${
                filterType === 'outOfStock'
                  ? 'bg-red-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="text-gray-300 mt-4">Loading inventory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-sm p-12 border border-white/20 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No items found</h3>
          <p className="text-gray-300 mb-4">
            {searchQuery
              ? `No items match "${searchQuery}"`
              : 'Start by adding inventory items to track your bar stock'}
          </p>
          <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white transition-colors">
            Add First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredItems.map((item) => {
              const status = getStockStatus(item);
              const totalMl = calculateTotalMl(item);
              const totalBottles = item.fullContainers + item.partialContainerMl / item.containerSizeMl;
              const fillPercentage = (totalMl / (item.parLevel * item.containerSizeMl)) * 100;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white/10 backdrop-blur-sm p-4 border border-white/20 hover:border-purple-500/50 transition-all cursor-pointer group"
                  onClick={() => setSelectedItem(item)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2  ${status.bg}`}>{getCategoryIcon(item.category)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{item.name}</h3>
                        <p className="text-xs text-gray-400 capitalize">{item.subcategory || item.category}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1  text-xs font-bold ${status.bg} ${status.color}`}>
                      {status.label}
                    </div>
                  </div>

                  {/* Stock Level */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-300">Stock Level</span>
                      <span className="text-white font-bold">
                        {totalBottles.toFixed(1)} bottles
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          fillPercentage > 50
                            ? 'bg-green-500'
                            : fillPercentage > 25
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, fillPercentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                      <span>{totalMl.toLocaleString()} ml</span>
                      <span>Par: {item.parLevel} bottles</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-white/5 p-2">
                      <div className="text-gray-400">Full Bottles</div>
                      <div className="text-white font-bold">{item.fullContainers}</div>
                    </div>
                    <div className="bg-white/5 p-2">
                      <div className="text-gray-400">Partial</div>
                      <div className="text-white font-bold">{item.partialContainerMl.toFixed(0)} ml</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addBottle(item.id, 1);
                        barInventoryService.updateStock(
                          item.id,
                          item.fullContainers + 1,
                          item.partialContainerMl
                        );
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBottle(item.id, 1);
                        barInventoryService.updateStock(
                          item.id,
                          Math.max(0, item.fullContainers - 1),
                          item.partialContainerMl
                        );
                      }}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1 transition-colors text-sm"
                      disabled={item.fullContainers === 0}
                    >
                      <Minus className="w-4 h-4" />
                      Remove
                    </button>
                  </div>

                  {/* Cost */}
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
                    <div className="flex items-center justify-between">
                      <span>Value</span>
                      <span className="text-white font-bold">₹{calculateItemCost(item).toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

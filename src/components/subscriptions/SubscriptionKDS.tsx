/**
 * Subscription Kitchen Display System (KDS)
 *
 * Consolidated view for subscription meal preparation
 * Shows aggregated orders by Friday for the upcoming week
 *
 * Features:
 * - Consolidated item counts
 * - Category-wise breakdown
 * - Preparation checklist
 * - Real-time status updates
 * - Mark items as prepared/ready
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat,
  CheckCircle,
  Clock,
  AlertCircle,
  Package,
  TrendingUp,
  Filter,
  Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SubscriptionKDSProps {
  tenantId: string;
  weekStartDate: string;
}

interface ConsolidatedItem {
  id: string;
  menuItemId: string;
  itemName: string;
  category: string;
  totalQuantity: number;
  preparedQuantity: number;
  isVeg: boolean;
  preparationTime: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'preparing' | 'ready';
  deliveryDate: string;
}

interface CategoryProgress {
  category: string;
  totalItems: number;
  preparedItems: number;
  percentage: number;
}

export function SubscriptionKDS({ tenantId, weekStartDate }: SubscriptionKDSProps) {
  const [items, setItems] = useState<ConsolidatedItem[]>([]);
  const [categories, setCategories] = useState<CategoryProgress[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load consolidated data
  useEffect(() => {
    loadConsolidatedOrders();
    // Refresh every 30 seconds
    const interval = setInterval(loadConsolidatedOrders, 30000);
    return () => clearInterval(interval);
  }, [tenantId, weekStartDate]);

  const loadConsolidatedOrders = async () => {
    try {
      const response = await fetch(
        `/api/subscriptions/kds/consolidated?tenantId=${tenantId}&weekStart=${weekStartDate}`
      );
      const data = await response.json();
      setItems(data.items || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to load consolidated orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update item status
  const updateItemStatus = async (itemId: string, status: ConsolidatedItem['status']) => {
    try {
      await fetch(`/api/subscriptions/kds/items/${itemId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      setItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, status } : item
        )
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Update prepared quantity
  const updatePreparedQuantity = async (itemId: string, quantity: number) => {
    try {
      await fetch(`/api/subscriptions/kds/items/${itemId}/quantity`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preparedQuantity: quantity }),
      });

      setItems(prev =>
        prev.map(item =>
          item.id === itemId
            ? {
                ...item,
                preparedQuantity: quantity,
                status: quantity >= item.totalQuantity ? 'ready' : 'preparing',
              }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to update quantity:', error);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (searchQuery && !item.itemName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate overall progress
  const totalItems = items.reduce((sum, item) => sum + item.totalQuantity, 0);
  const preparedItems = items.reduce((sum, item) => sum + item.preparedQuantity, 0);
  const overallProgress = totalItems > 0 ? Math.round((preparedItems / totalItems) * 100) : 0;

  // Get unique categories
  const uniqueCategories = Array.from(new Set(items.map(item => item.category)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-lg">Loading kitchen orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-orange-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Subscription KDS</h1>
                <p className="text-sm text-muted-foreground">
                  Week of {new Date(weekStartDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Overall Progress</p>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600"
                  />
                </div>
                <span className="text-lg font-bold text-orange-400">{overallProgress}%</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-muted-foreground">Items Prepared</p>
              <p className="text-2xl font-bold text-white">
                {preparedItems} / {totalItems}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mt-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
          </select>
        </div>
      </div>

      {/* Category Progress Bar */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.map(cat => (
            <div key={cat.category} className="bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{cat.category}</span>
                <span className="text-xs font-bold text-orange-400">{cat.percentage}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-600 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${cat.percentage}%` }}
                  className="h-full bg-orange-500"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {cat.preparedItems}/{cat.totalItems}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  'bg-gray-800 rounded-xl p-4 border-2 transition-all',
                  item.status === 'pending' && 'border-gray-600',
                  item.status === 'preparing' && 'border-yellow-500',
                  item.status === 'ready' && 'border-green-500'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white text-lg">{item.itemName}</h3>
                      {item.isVeg && (
                        <span className="w-5 h-5 border-2 border-green-500 rounded flex items-center justify-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>

                  {/* Priority Badge */}
                  <div
                    className={cn(
                      'px-2 py-1 rounded text-xs font-semibold',
                      item.priority === 'high' && 'bg-red-500/20 text-red-400',
                      item.priority === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                      item.priority === 'low' && 'bg-blue-500/20 text-blue-400'
                    )}
                  >
                    {item.priority.toUpperCase()}
                  </div>
                </div>

                {/* Quantity */}
                <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Quantity</span>
                    <span className="text-2xl font-bold text-white">
                      {item.totalQuantity}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.preparedQuantity / item.totalQuantity) * 100}%` }}
                      className={cn(
                        'h-full',
                        item.status === 'ready' ? 'bg-green-500' : 'bg-orange-500'
                      )}
                    />
                  </div>

                  {/* Prepared Counter */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updatePreparedQuantity(item.id, Math.max(0, item.preparedQuantity - 1))}
                      disabled={item.preparedQuantity === 0}
                      className="w-8 h-8 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-lg font-bold text-orange-400">{item.preparedQuantity}</span>
                      <span className="text-sm text-muted-foreground"> prepared</span>
                    </div>
                    <button
                      onClick={() => updatePreparedQuantity(item.id, Math.min(item.totalQuantity, item.preparedQuantity + 1))}
                      disabled={item.preparedQuantity >= item.totalQuantity}
                      className="w-8 h-8 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.preparationTime} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>{new Date(item.deliveryDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>

                {/* Status Buttons */}
                <div className="flex gap-2">
                  {item.status === 'pending' && (
                    <button
                      onClick={() => updateItemStatus(item.id, 'preparing')}
                      className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      Start Preparing
                    </button>
                  )}

                  {item.status === 'preparing' && (
                    <button
                      onClick={() => updateItemStatus(item.id, 'ready')}
                      disabled={item.preparedQuantity < item.totalQuantity}
                      className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Ready
                    </button>
                  )}

                  {item.status === 'ready' && (
                    <div className="flex-1 px-3 py-2 bg-green-500/20 border border-green-500 text-green-400 rounded-lg font-medium text-sm text-center flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Ready
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Items Found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No subscription orders for this week yet'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

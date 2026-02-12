/**
 * Weekly Menu Manager Component
 * Manage rotating weekly subscription menus
 *
 * Features:
 * - Week selector (next 8 weeks)
 * - Cuisine type tabs
 * - Browse and add items from main menu
 * - Excel upload for bulk import
 * - Drag-and-drop interface
 * - Set item constraints (max orders, availability)
 * - Preview customer view
 * - Publish menu
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChefHat,
  Upload,
  Plus,
  Trash2,
  Eye,
  Save,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { getMenuItems } from '../../lib/database';
import { MenuItem } from '../../types';

interface WeeklyMenuManagerProps {
  tenantId: string;
}

const CUISINE_TABS = [
  { id: 'north_indian', name: 'North Indian', icon: '🍛' },
  { id: 'south_indian', name: 'South Indian', icon: '🥘' },
  { id: 'chinese', name: 'Chinese', icon: '🥢' },
  { id: 'continental', name: 'Continental', icon: '🍝' },
  { id: 'children_menu', name: "Children's Menu", icon: '🍕' },
];

export function WeeklyMenuManager({ tenantId }: WeeklyMenuManagerProps) {
  const {
    weeklyMenus,
    availableWeeks,
    currentWeekMenu,
    selectedWeekId,
    selectedCuisineType,
    loadWeeklyMenu,
    loadAvailableWeeks,
    createWeeklyMenu,
    addItemsToWeeklyMenu,
    removeItemFromWeeklyMenu,
    publishWeeklyMenu,
    uploadMenuExcel,
    setSelectedWeek,
    setSelectedCuisineType,
    isLoading,
    error,
  } = useSubscriptionStore();

  // Local state
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load menu items from main menu
  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const items = await getMenuItems();
        setAllMenuItems(items);
      } catch (err) {
        console.error('Failed to load menu items:', err);
      }
    };
    loadMenuItems();
  }, []);

  // Load available weeks for selected cuisine
  useEffect(() => {
    if (selectedCuisineType) {
      loadAvailableWeeks(tenantId, selectedCuisineType);
    }
  }, [tenantId, selectedCuisineType]);

  // Load menu when week is selected
  useEffect(() => {
    if (selectedWeekId) {
      loadWeeklyMenu(selectedWeekId);
    }
  }, [selectedWeekId]);

  // Initialize with first cuisine type
  useEffect(() => {
    if (!selectedCuisineType) {
      setSelectedCuisineType(CUISINE_TABS[0].id);
    }
  }, []);

  // Get current week number
  const getCurrentWeekNumber = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  // Generate next 8 weeks
  const generateWeekOptions = () => {
    const weeks = [];
    const currentWeek = getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 8; i++) {
      let week = currentWeek + i;
      let year = currentYear;

      if (week > 52) {
        week = week - 52;
        year = year + 1;
      }

      // Calculate start date (Monday of the week)
      const startDate = getDateOfISOWeek(week, year);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      weeks.push({
        week,
        year,
        label: `Week ${week}, ${year} (${formatDate(startDate)} - ${formatDate(endDate)})`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
    }

    return weeks;
  };

  const getDateOfISOWeek = (week: number, year: number) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const weekOptions = generateWeekOptions();

  // Filter available menu items (not in subscription menu)
  const selectedMenuItemIds = currentWeekMenu?.items.map(item => item.menuItemId) || [];
  const availableMenuItems = allMenuItems.filter(
    item => !selectedMenuItemIds.includes(item.id) &&
           item.active &&
           (searchQuery === '' ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle create new menu
  const handleCreateMenu = async () => {
    if (!selectedCuisineType) return;

    const week = weekOptions[0];
    try {
      const menu = await createWeeklyMenu(tenantId, week.week, week.year, selectedCuisineType);
      setSelectedWeek(menu.id);
    } catch (err) {
      console.error('Failed to create menu:', err);
    }
  };

  // Handle add item
  const handleAddItem = async (menuItemId: string) => {
    if (!selectedWeekId) {
      // Create menu first if it doesn't exist
      await handleCreateMenu();
    }
    if (selectedWeekId) {
      await addItemsToWeeklyMenu(selectedWeekId, [menuItemId]);
    }
  };

  // Handle remove item
  const handleRemoveItem = async (menuItemId: string) => {
    if (selectedWeekId) {
      await removeItemFromWeeklyMenu(selectedWeekId, menuItemId);
    }
  };

  // Handle Excel upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedWeekId) return;

    setIsUploading(true);
    try {
      const result = await uploadMenuExcel(selectedWeekId, selectedFile);
      setUploadResult(result);
      setSelectedFile(null);

      if (result.success > 0) {
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setUploadResult(null);
        }, 2000);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (selectedWeekId && confirm('Publish this menu? Customers will be able to see and order from it.')) {
      await publishWeeklyMenu(selectedWeekId);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            📅 Weekly Menu Manager
          </h1>
          <p className="text-muted-foreground">
            Create and manage rotating subscription menus
          </p>
        </div>

        <div className="flex gap-2">
          {currentWeekMenu && !currentWeekMenu.published && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePublish}
              className={cn(
                'px-4 py-2 rounded-lg flex items-center gap-2',
                'bg-gradient-to-br from-green-500 to-green-600',
                'text-white font-medium text-sm',
                'shadow-lg shadow-green-500/30',
                'hover:shadow-green-500/50 transition-all'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              Publish Menu
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsUploadModalOpen(true)}
            className={cn(
              'px-4 py-2 rounded-lg flex items-center gap-2',
              'glass-panel',
              'text-foreground font-medium text-sm',
              'hover:bg-muted transition-all'
            )}
          >
            <Upload className="w-4 h-4" />
            Upload Excel
          </motion.button>
        </div>
      </div>

      {/* Week and Cuisine Selection */}
      <div className="glass-panel p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Week Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select Week
            </label>
            <select
              value={selectedWeekId || ''}
              onChange={(e) => setSelectedWeek(e.target.value || null)}
              className={cn(
                'w-full px-4 py-2 rounded-lg',
                'glass-panel text-foreground',
                'border border-border',
                'focus:outline-none focus:border-primary'
              )}
            >
              <option value="">Select a week...</option>
              {weekOptions.map((week) => (
                <option key={`${week.year}-${week.week}`} value={`${week.year}-${week.week}-${selectedCuisineType}`}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          {/* Cuisine Tabs */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Cuisine Type
            </label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_TABS.map((cuisine) => (
                <button
                  key={cuisine.id}
                  onClick={() => setSelectedCuisineType(cuisine.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    selectedCuisineType === cuisine.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/30'
                      : 'glass-panel text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span>{cuisine.icon}</span>
                  <span>{cuisine.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Status */}
        {currentWeekMenu && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold',
                    currentWeekMenu.published
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  )}
                >
                  {currentWeekMenu.published ? '✓ Published' : '⏳ Draft'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {currentWeekMenu.items.length} items in menu
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      {!selectedWeekId ? (
        <div className="glass-panel p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Select a week to get started
          </h3>
          <p className="text-muted-foreground mb-4">
            Choose a week and cuisine type above to create or edit the menu
          </p>
          <button
            onClick={handleCreateMenu}
            disabled={!selectedCuisineType}
            className={cn(
              'px-6 py-3 rounded-lg font-medium',
              'bg-primary text-white',
              'hover:bg-primary/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Create Menu for This Week
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Available Items (Left Panel) */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                Available Menu Items
              </h3>
              <span className="text-sm text-muted-foreground">
                {availableMenuItems.length} items
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className={cn(
                  'w-full pl-10 pr-4 py-2 rounded-lg',
                  'glass-panel text-foreground text-sm',
                  'border border-border',
                  'focus:outline-none focus:border-primary',
                  'placeholder:text-gray-600'
                )}
              />
            </div>

            {/* Items List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableMenuItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">
                    {searchQuery ? 'No items match your search' : 'All items are in the menu'}
                  </p>
                </div>
              ) : (
                availableMenuItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-panel p-3 rounded-lg group hover:bg-muted transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {item.name}
                          </h4>
                          {item.is_veg && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                              🥗 Veg
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description || 'No description'}
                        </p>
                        <p className="text-sm font-semibold text-primary mt-1">
                          ₹{item.price}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddItem(item.id)}
                        className={cn(
                          'p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100',
                          'bg-primary text-white',
                          'hover:bg-primary/90'
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Selected Items (Right Panel) */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                📋 Subscription Menu
              </h3>
              <span className="text-sm text-muted-foreground">
                {currentWeekMenu?.items.length || 0} items
              </span>
            </div>

            {/* Selected Items List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {!currentWeekMenu || currentWeekMenu.items.length === 0 ? (
                <div className="text-center py-12">
                  <Upload className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm mb-2">No items added yet</p>
                  <p className="text-gray-600 text-xs">
                    Add items from the left panel or upload Excel
                  </p>
                </div>
              ) : (
                currentWeekMenu.items.map((item) => (
                  <motion.div
                    key={item.menuItemId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="glass-panel p-3 rounded-lg group hover:bg-muted transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {item.menuItem.name}
                          </h4>
                          {item.menuItem.is_veg && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                              🥗
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.menuItem.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-sm font-semibold text-primary">
                            ₹{item.menuItem.price}
                          </p>
                          {item.maxOrdersPerWeek && (
                            <span className="text-xs text-muted-foreground">
                              Max: {item.maxOrdersPerWeek}/week
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.menuItemId)}
                        className={cn(
                          'p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100',
                          'bg-red-500/20 text-red-400',
                          'hover:bg-red-500/30'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isUploading && setIsUploadModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel p-6 rounded-xl max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">Upload Menu Excel</h2>
                <button
                  onClick={() => !isUploading && setIsUploadModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  disabled={isUploading}
                >
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {uploadResult ? (
                <div className="space-y-4">
                  <div className={cn(
                    'p-4 rounded-lg border',
                    uploadResult.failed === 0
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="font-semibold text-foreground">
                        {uploadResult.success} items imported successfully
                      </span>
                    </div>
                    {uploadResult.failed > 0 && (
                      <p className="text-sm text-yellow-400">
                        {uploadResult.failed} items failed to import
                      </p>
                    )}
                  </div>

                  {uploadResult.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto">
                      <p className="text-xs text-muted-foreground mb-2">Errors:</p>
                      {uploadResult.errors.map((error, i) => (
                        <p key={i} className="text-xs text-red-400 mb-1">
                          • {error}
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setUploadResult(null);
                    }}
                    className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center',
                    selectedFile ? 'border-primary/50' : 'border-white/20'
                  )}>
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                      id="excel-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="excel-upload"
                      className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {selectedFile ? (
                        <span className="text-primary font-medium">
                          {selectedFile.name}
                        </span>
                      ) : (
                        'Click to select Excel file (.xlsx, .xls)'
                      )}
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => !isUploading && setIsUploadModalOpen(false)}
                      className="flex-1 px-4 py-2 glass-panel text-foreground rounded-lg hover:bg-muted transition-colors"
                      disabled={isUploading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || isUploading}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-lg font-medium transition-all',
                        'bg-primary text-white',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        !isUploading && 'hover:bg-primary/90'
                      )}
                    >
                      {isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * RecipeManager Component
 *
 * Main UI for AI-powered recipe generation and management.
 * Features:
 * - Split-panel design (menu items list + recipe editor)
 * - Bulk AI recipe generation
 * - Inline ingredient editing
 * - Smart inventory matching
 */

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Search, Check, Plus, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { useMenuStore } from '../../stores/menuStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useTenantStore } from '../../stores/tenantStore';
import { RecipeGenerationAPI, prepareRecipesForUI, getRecipeStats } from '../../services/recipeGenerationApi';
import RecipeIngredientRow from './RecipeIngredientRow';
import type { MenuItem } from '../../types';
import type {
  RecipeSuggestion,
  AIIngredientMatch,
  RecipeGenerationMenuItem,
  RecipeIngredient,
} from '../../types/inventory';
import { invoke } from '@tauri-apps/api/core';

interface MenuItemWithRecipe extends MenuItem {
  recipeCount: number;
  hasRecipe: boolean;
}

export default function RecipeManager() {
  const getTenantId = useTenantStore((state) => state.getTenantId);
  const { items: menuItems, categories, loadMenuFromDatabase } = useMenuStore();
  const { items: inventoryItems, loadFromSQLite } = useInventoryStore();

  // State
  const [selectedMenuItems, setSelectedMenuItems] = useState<Set<string>>(new Set());
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyWithoutRecipe, setShowOnlyWithoutRecipe] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Recipe state
  const [currentRecipe, setCurrentRecipe] = useState<RecipeSuggestion | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuItemRecipes, setMenuItemRecipes] = useState<Map<string, RecipeIngredient[]>>(
    new Map()
  );

  // Toast/notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    const tenantId = getTenantId();
    if (tenantId) {
      loadMenuFromDatabase();
      loadFromSQLite(tenantId);
      loadAllRecipes();
    }
  }, [getTenantId]);

  // Load all recipes for menu items
  const loadAllRecipes = async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;

    const recipeMap = new Map<string, RecipeIngredient[]>();

    for (const item of menuItems) {
      try {
        const ingredients = await invoke<RecipeIngredient[]>('get_recipe_ingredients', {
          menuItemId: item.id,
          tenantId: tenantId,
        });
        if (ingredients && ingredients.length > 0) {
          recipeMap.set(item.id, ingredients);
        }
      } catch (error) {
        // Silently fail - item has no recipe
      }
    }

    setMenuItemRecipes(recipeMap);
  };

  // Enrich menu items with recipe counts
  const enrichedMenuItems = useMemo<MenuItemWithRecipe[]>(() => {
    return menuItems.map((item) => {
      const recipe = menuItemRecipes.get(item.id) || [];
      return {
        ...item,
        recipeCount: recipe.length,
        hasRecipe: recipe.length > 0,
      };
    });
  }, [menuItems, menuItemRecipes]);

  // Filter menu items
  const filteredMenuItems = useMemo(() => {
    return enrichedMenuItems.filter((item) => {
      // Search filter
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) {
        return false;
      }

      // Recipe filter
      if (showOnlyWithoutRecipe && item.hasRecipe) {
        return false;
      }

      return true;
    });
  }, [enrichedMenuItems, searchQuery, selectedCategory, showOnlyWithoutRecipe]);

  // Handle menu item selection
  const handleMenuItemClick = async (item: MenuItem) => {
    setSelectedMenuItem(item);
    setIsLoadingRecipe(true);
    setCurrentRecipe(null);

    try {
      const tenantId = getTenantId();
      if (!tenantId) throw new Error('No tenant ID');

      // Load existing recipe
      const ingredients = await invoke<RecipeIngredient[]>('get_recipe_ingredients', {
        menuItemId: item.id,
        tenantId: tenantId,
      });

      if (ingredients && ingredients.length > 0) {
        // Convert existing recipe to AIIngredientMatch format
        const aiIngredients: AIIngredientMatch[] = ingredients.map((ing) => ({
          name: ing.inventoryItem?.name || 'Unknown',
          quantity: ing.quantityRequired || ing.quantity,
          unit: ing.unit,
          matchedInventoryItemId: ing.inventoryItemId,
          isNewItem: false,
          confidence: 1.0, // Existing recipes are 100% confident
        }));

        setCurrentRecipe({
          menuItemId: item.id,
          menuItemName: item.name,
          confidence: 1.0,
          ingredients: aiIngredients,
          isApproved: true,
        });
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  // Handle checkbox selection
  const handleCheckboxChange = (itemId: string, checked: boolean) => {
    const newSelection = new Set(selectedMenuItems);
    if (checked) {
      newSelection.add(itemId);
    } else {
      newSelection.delete(itemId);
    }
    setSelectedMenuItems(newSelection);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredMenuItems.map((item) => item.id);
      setSelectedMenuItems(new Set(allIds));
    } else {
      setSelectedMenuItems(new Set());
    }
  };

  // Generate recipes with AI
  const handleGenerateRecipes = async (itemsToGenerate: MenuItem[]) => {
    const tenantId = getTenantId();
    if (!tenantId) {
      showNotification('Tenant ID not found', 'error');
      return;
    }

    if (itemsToGenerate.length === 0) {
      showNotification('No menu items selected', 'error');
      return;
    }

    setIsGenerating(true);
    showNotification(`Processing ${itemsToGenerate.length} items...`, 'info');

    try {
      const api = new RecipeGenerationAPI(tenantId);

      const menuItemsForAI: RecipeGenerationMenuItem[] = itemsToGenerate.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: categories.find((cat) => cat.id === item.category_id)?.name,
      }));

      const result = await api.generateRecipesWithRetry(menuItemsForAI, {
        cuisineType: 'Indian', // TODO: Get from restaurant settings
        minConfidence: 0.7,
      });

      if (!result.success) {
        showNotification(result.error || 'Failed to generate recipes', 'error');
        return;
      }

      const enrichedRecipes = prepareRecipesForUI(result.recipes);
      const stats = getRecipeStats(enrichedRecipes);

      showNotification(
        `Generated ${stats.totalRecipes} recipes with ${stats.totalIngredients} ingredients (${Math.round(stats.matchRate * 100)}% matched)`,
        'success'
      );

      // If only one item, load it immediately
      if (enrichedRecipes.length === 1) {
        setCurrentRecipe(enrichedRecipes[0]);
        setSelectedMenuItem(itemsToGenerate[0]);
      }
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : 'Failed to generate recipes',
        'error'
      );
    } finally {
      setIsGenerating(false);
      setShowBulkActions(false);
    }
  };

  // Save recipe
  const handleSaveRecipe = async () => {
    const tenantId = getTenantId();
    if (!currentRecipe || !selectedMenuItem || !tenantId) return;

    setIsSaving(true);

    try {
      // Remove existing recipe ingredients first
      const existingIngredients = menuItemRecipes.get(selectedMenuItem.id) || [];
      for (const ing of existingIngredients) {
        await invoke('remove_recipe_ingredient', {
          ingredientId: ing.id,
          tenantId: tenantId,
        });
      }

      // Add new recipe ingredients
      for (const ingredient of currentRecipe.ingredients) {
        if (!ingredient.matchedInventoryItemId) {
          // Skip ingredients without inventory match
          continue;
        }

        await invoke('add_recipe_ingredient', {
          menuItemId: selectedMenuItem.id,
          inventoryItemId: ingredient.matchedInventoryItemId,
          quantityRequired: ingredient.quantity,
          unit: ingredient.unit,
          tenantId: tenantId,
        });
      }

      // Reload recipes
      await loadAllRecipes();

      showNotification('Recipe saved successfully', 'success');
      setCurrentRecipe({ ...currentRecipe, isApproved: true });
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : 'Failed to save recipe',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Update ingredient
  const handleIngredientUpdate = (index: number, updated: AIIngredientMatch) => {
    if (!currentRecipe) return;

    const newIngredients = [...currentRecipe.ingredients];
    newIngredients[index] = updated;

    setCurrentRecipe({
      ...currentRecipe,
      ingredients: newIngredients,
    });
  };

  // Remove ingredient
  const handleIngredientRemove = (index: number) => {
    if (!currentRecipe) return;

    const newIngredients = currentRecipe.ingredients.filter((_, i) => i !== index);

    setCurrentRecipe({
      ...currentRecipe,
      ingredients: newIngredients,
    });
  };

  // Add ingredient
  const handleAddIngredient = () => {
    if (!currentRecipe) return;

    const newIngredient: AIIngredientMatch = {
      name: 'New Ingredient',
      quantity: 100,
      unit: 'g',
      matchedInventoryItemId: null,
      isNewItem: true,
      confidence: 1.0,
      isEditing: true,
    };

    setCurrentRecipe({
      ...currentRecipe,
      ingredients: [...currentRecipe.ingredients, newIngredient],
    });
  };

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Calculate selection stats
  const itemsWithoutRecipe = filteredMenuItems.filter((item) => !item.hasRecipe).length;
  const selectedCount = selectedMenuItems.size;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Recipe Manager</h2>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate AI Recipes</span>
                  <ChevronDown size={16} />
                </>
              )}
            </button>

            {/* Dropdown Menu */}
            {showBulkActions && !isGenerating && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    const selected = filteredMenuItems.filter((item) =>
                      selectedMenuItems.has(item.id)
                    );
                    handleGenerateRecipes(selected);
                  }}
                  disabled={selectedCount === 0}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border-b"
                >
                  <div className="font-medium">Selected items ({selectedCount})</div>
                  <div className="text-xs text-gray-500">Generate for checked items</div>
                </button>

                <button
                  onClick={() => {
                    const itemsWithoutRecipes = filteredMenuItems.filter(
                      (item) => !item.hasRecipe
                    );
                    handleGenerateRecipes(itemsWithoutRecipes);
                  }}
                  disabled={itemsWithoutRecipe === 0}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="font-medium">
                    All items without recipes ({itemsWithoutRecipe})
                  </div>
                  <div className="text-xs text-gray-500">Generate for all missing</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`absolute top-20 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-300'
              : notification.type === 'error'
              ? 'bg-red-100 text-red-800 border border-red-300'
              : 'bg-blue-100 text-blue-800 border border-blue-300'
          }`}
        >
          {notification.type === 'success' && <Check size={18} />}
          {notification.type === 'error' && <AlertCircle size={18} />}
          {notification.type === 'info' && <Loader2 size={18} className="animate-spin" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Content - Split Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Menu Items List */}
        <div className="w-[35%] border-r border-gray-200 flex flex-col">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyWithoutRecipe}
                onChange={(e) => setShowOnlyWithoutRecipe(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Show only items without recipe</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t">
              <input
                type="checkbox"
                checked={selectedMenuItems.size === filteredMenuItems.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Select All ({filteredMenuItems.length} items)
              </span>
            </label>
          </div>

          {/* Menu Items List */}
          <div className="flex-1 overflow-y-auto">
            {filteredMenuItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No menu items found</p>
              </div>
            ) : (
              filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedMenuItem?.id === item.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                  onClick={() => handleMenuItemClick(item)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedMenuItems.has(item.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCheckboxChange(item.id, e.target.checked);
                      }}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">
                        {categories.find((cat) => cat.id === item.category_id)?.name}
                      </div>
                      <div className="mt-1 text-xs">
                        {item.hasRecipe ? (
                          <span className="text-green-600 font-medium">
                            {item.recipeCount} ingredients
                          </span>
                        ) : (
                          <span className="text-gray-400">No recipe</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Recipe Editor */}
        <div className="flex-1 flex flex-col">
          {!selectedMenuItem ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Sparkles size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Select a menu item to view or edit its recipe</p>
                <p className="text-sm mt-2">Or generate recipes using AI</p>
              </div>
            </div>
          ) : (
            <>
              {/* Recipe Header */}
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{selectedMenuItem.name}</h3>
                <p className="text-sm text-gray-500">
                  {categories.find((cat) => cat.id === selectedMenuItem.category_id)?.name}
                </p>

                {currentRecipe && (
                  <div className="mt-3 flex items-center gap-2">
                    {currentRecipe.isApproved ? (
                      <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        <Check size={14} />
                        <span>Saved</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <Sparkles size={14} />
                        <span>AI Suggestion (Confidence: {Math.round(currentRecipe.confidence * 100)}%)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recipe Content */}
              {isLoadingRecipe ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
                </div>
              ) : !currentRecipe ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p>No recipe found for this item</p>
                    <button
                      onClick={() => handleGenerateRecipes([selectedMenuItem])}
                      disabled={isGenerating}
                      className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
                    >
                      <Sparkles size={18} />
                      <span>Generate with AI</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Ingredients List */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          Ingredients ({currentRecipe.ingredients.length})
                        </h4>
                        <button
                          onClick={handleAddIngredient}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Plus size={16} />
                          <span>Add Ingredient</span>
                        </button>
                      </div>

                      {currentRecipe.ingredients.map((ingredient, index) => (
                        <RecipeIngredientRow
                          key={index}
                          ingredient={ingredient}
                          inventoryItems={inventoryItems}
                          onUpdate={(updated) => handleIngredientUpdate(index, updated)}
                          onRemove={() => handleIngredientRemove(index)}
                        />
                      ))}

                      {currentRecipe.ingredients.length === 0 && (
                        <div className="py-8 text-center text-gray-500">
                          <p>No ingredients yet</p>
                          <button
                            onClick={handleAddIngredient}
                            className="mt-2 text-blue-600 hover:text-blue-700"
                          >
                            Add your first ingredient
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setCurrentRecipe(null)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRecipe}
                      disabled={isSaving || currentRecipe.ingredients.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check size={18} />
                          <span>Save Recipe</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

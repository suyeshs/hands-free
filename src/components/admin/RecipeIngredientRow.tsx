/**
 * RecipeIngredientRow Component
 *
 * Displays a single recipe ingredient with inline editing capabilities.
 * Supports matching to existing inventory items or creating new ones.
 */

import { useState } from 'react';
import { X, AlertCircle, Check, Edit2 } from 'lucide-react';
import type { AIIngredientMatch, InventoryItem, InventoryUnit } from '../../types/inventory';

interface RecipeIngredientRowProps {
  ingredient: AIIngredientMatch;
  inventoryItems: InventoryItem[];
  onUpdate: (updated: AIIngredientMatch) => void;
  onRemove: () => void;
  isReadOnly?: boolean;
}

const VALID_UNITS: InventoryUnit[] = [
  'kg',
  'g',
  'l',
  'ml',
  'pcs',
  'box',
  'dozen',
  'pack',
  'bottle',
  'can',
  'bag',
  'bunch',
  'unit',
];

export default function RecipeIngredientRow({
  ingredient,
  inventoryItems,
  onUpdate,
  onRemove,
  isReadOnly = false,
}: RecipeIngredientRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [localName, setLocalName] = useState(ingredient.name);
  const [localQuantity, setLocalQuantity] = useState(ingredient.quantity.toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [showInventorySearch, setShowInventorySearch] = useState(false);

  // Filter inventory items based on search query
  const filteredInventoryItems = searchQuery.trim()
    ? inventoryItems.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : inventoryItems.slice(0, 10); // Show top 10 by default

  // Handle name save
  const handleNameSave = () => {
    if (localName.trim()) {
      onUpdate({ ...ingredient, name: localName.trim() });
      setIsEditingName(false);
    }
  };

  // Handle quantity save
  const handleQuantitySave = () => {
    const quantity = parseFloat(localQuantity);
    if (!isNaN(quantity) && quantity > 0) {
      onUpdate({ ...ingredient, quantity });
      setIsEditingQuantity(false);
    }
  };

  // Handle unit change
  const handleUnitChange = (unit: string) => {
    onUpdate({ ...ingredient, unit });
  };

  // Handle inventory item selection
  const handleInventorySelect = (item: InventoryItem) => {
    onUpdate({
      ...ingredient,
      matchedInventoryItemId: item.id,
      isNewItem: false,
      unit: item.unit, // Update unit to match inventory
    });
    setShowInventorySearch(false);
    setSearchQuery('');
  };

  // Handle creating as new item
  const handleCreateNew = () => {
    onUpdate({
      ...ingredient,
      matchedInventoryItemId: null,
      isNewItem: true,
    });
    setShowInventorySearch(false);
  };

  // Get matched inventory item details
  const matchedItem = ingredient.matchedInventoryItemId
    ? inventoryItems.find((item) => item.id === ingredient.matchedInventoryItemId)
    : null;

  // Determine confidence color

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800';
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="border-b border-gray-200 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Ingredient Name */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave();
                  if (e.key === 'Escape') {
                    setLocalName(ingredient.name);
                    setIsEditingName(false);
                  }
                }}
                className="flex-1 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={isReadOnly}
              />
              <button
                onClick={handleNameSave}
                className="p-1 text-green-600 hover:text-green-700"
                disabled={isReadOnly}
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => !isReadOnly && setIsEditingName(true)}
            >
              <span className="font-medium text-gray-900">{ingredient.name}</span>
              {!isReadOnly && (
                <Edit2
                  size={14}
                  className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </div>
          )}

          {/* Matched Inventory Item */}
          {matchedItem ? (
            <div className="flex items-center gap-2 mt-1 text-sm">
              <Check size={14} className="text-green-600" />
              <span className="text-gray-600">
                Matched: <span className="font-medium">{matchedItem.name}</span>
                <span className="text-gray-400 ml-1">({matchedItem.category})</span>
              </span>
              {!isReadOnly && (
                <button
                  onClick={() => setShowInventorySearch(true)}
                  className="text-blue-600 hover:text-blue-700 text-xs"
                >
                  Change
                </button>
              )}
            </div>
          ) : ingredient.isNewItem ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                <AlertCircle size={12} />
                <span>NEW ITEM</span>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setShowInventorySearch(true)}
                  className="text-blue-600 hover:text-blue-700 text-xs"
                >
                  Select existing item
                </button>
              )}
            </div>
          ) : null}

          {/* Inventory Search Dropdown */}
          {showInventorySearch && !isReadOnly && (
            <div className="mt-2 border border-gray-300 rounded-lg shadow-lg bg-white z-10 max-h-64 overflow-y-auto">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search inventory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredInventoryItems.length > 0 ? (
                  filteredInventoryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleInventorySelect(item)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors text-sm"
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.category} • {item.unit}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No matching items</div>
                )}
              </div>
              <div className="p-2 border-t bg-gray-50">
                <button
                  onClick={handleCreateNew}
                  className="w-full px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark as new inventory item
                </button>
                <button
                  onClick={() => setShowInventorySearch(false)}
                  className="w-full px-3 py-1 text-sm text-gray-600 hover:text-gray-700 mt-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-2">
          {isEditingQuantity ? (
            <>
              <input
                type="number"
                value={localQuantity}
                onChange={(e) => setLocalQuantity(e.target.value)}
                onBlur={handleQuantitySave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuantitySave();
                  if (e.key === 'Escape') {
                    setLocalQuantity(ingredient.quantity.toString());
                    setIsEditingQuantity(false);
                  }
                }}
                className="w-20 px-2 py-1 border border-blue-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={isReadOnly}
                min="0"
                step="0.1"
              />
              <button
                onClick={handleQuantitySave}
                className="p-1 text-green-600 hover:text-green-700"
                disabled={isReadOnly}
              >
                <Check size={16} />
              </button>
            </>
          ) : (
            <div
              className="cursor-pointer group flex items-center gap-1"
              onClick={() => !isReadOnly && setIsEditingQuantity(true)}
            >
              <span className="font-medium text-gray-900 text-right w-16">
                {ingredient.quantity}
              </span>
              {!isReadOnly && (
                <Edit2
                  size={14}
                  className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}
            </div>
          )}

          {/* Unit Dropdown */}
          <select
            value={ingredient.unit}
            onChange={(e) => handleUnitChange(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={isReadOnly}
          >
            {VALID_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        {/* Confidence Badge */}
        <div
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceBadge(
            ingredient.confidence
          )}`}
        >
          {Math.round(ingredient.confidence * 100)}%
        </div>

        {/* Remove Button */}
        {!isReadOnly && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Remove ingredient"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Notes */}
      {ingredient.notes && (
        <div className="mt-1 text-xs text-gray-500 italic">{ingredient.notes}</div>
      )}

      {/* Validation Error */}
      {ingredient.validationError && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={12} />
          <span>{ingredient.validationError}</span>
        </div>
      )}
    </div>
  );
}

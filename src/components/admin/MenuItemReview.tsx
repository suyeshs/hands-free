/**
 * Menu Item Review Component
 * Interactive review and classification step before D1 save
 * Handles: Regular items, Combos, Specials, Variants, and edge cases
 */

import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import {
  CheckCircle2,
  AlertCircle,
  Package,
  Star,
  Flame,
  Settings2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Plus,
  Search,
} from 'lucide-react';

// Item types that can be identified
export type MenuItemType = 'regular' | 'combo' | 'special' | 'variant' | 'addon';

export interface ParsedMenuItem {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  dietary?: string[];
  type?: string;
  spiceLevel?: string;
  imageUrl?: string;
  available?: boolean;
  preparationTime?: number;
  tags?: string[];
  allergens?: string[];

  // AI analysis fields
  aiConfidence?: number;
  suggestedType?: MenuItemType;
  suggestedComboItems?: string[];
  suggestedValidityPeriod?: string;
  warnings?: string[];
}

export interface ReviewedMenuItem extends ParsedMenuItem {
  reviewedType: MenuItemType;
  isConfirmed: boolean;

  // Combo-specific
  comboItems?: string[];
  comboSavings?: number;

  // Special-specific
  validFrom?: string;
  validUntil?: string;
  daysAvailable?: string[];

  // Variant-specific
  parentItemId?: string;
  variantName?: string;

  // Addon-specific
  addonCategory?: string;
  defaultSelected?: boolean;
}

interface MenuItemReviewProps {
  items: ParsedMenuItem[];
  onConfirm: (reviewedItems: ReviewedMenuItem[]) => void;
  onCancel: () => void;
}

export function MenuItemReview({ items, onConfirm, onCancel }: MenuItemReviewProps) {
  const [reviewedItems, setReviewedItems] = useState<ReviewedMenuItem[]>(
    items.map(item => ({
      ...item,
      reviewedType: item.suggestedType || classifyItem(item),
      isConfirmed: false,
    }))
  );
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MenuItemType | 'all'>('all');
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);

  // Classify item based on heuristics
  function classifyItem(item: ParsedMenuItem): MenuItemType {
    const nameLower = item.name.toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const combined = `${nameLower} ${descLower}`;

    // Combo detection
    const comboKeywords = ['combo', 'meal', 'bundle', 'set', 'platter', 'thali', 'family pack'];
    if (comboKeywords.some(kw => combined.includes(kw))) {
      return 'combo';
    }

    // Special detection
    const specialKeywords = ['special', 'today', 'daily', 'chef', 'seasonal', 'limited'];
    if (specialKeywords.some(kw => combined.includes(kw))) {
      return 'special';
    }

    // Addon detection
    const addonKeywords = ['extra', 'add-on', 'addon', 'side', 'topping'];
    if (addonKeywords.some(kw => combined.includes(kw)) && item.price < 100) {
      return 'addon';
    }

    // Variant detection (size variations)
    const variantKeywords = ['small', 'medium', 'large', 'regular', 'mini', 'jumbo', 'half', 'full'];
    if (variantKeywords.some(kw => nameLower.includes(kw))) {
      return 'variant';
    }

    return 'regular';
  }

  // Generate warnings for items
  function generateWarnings(item: ParsedMenuItem): string[] {
    const warnings: string[] = [];

    if (!item.category || item.category === 'Uncategorized') {
      warnings.push('No category assigned');
    }

    if (!item.description || item.description.length < 10) {
      warnings.push('Description is missing or too short');
    }

    if (item.price === 0) {
      warnings.push('Price is zero - please verify');
    }

    if (!item.dietary || item.dietary.length === 0) {
      warnings.push('No dietary tags - consider adding vegetarian/vegan/etc.');
    }

    if (item.aiConfidence && item.aiConfidence < 0.7) {
      warnings.push(`Low AI confidence (${Math.round(item.aiConfidence * 100)}%)`);
    }

    return warnings;
  }

  const filteredItems = useMemo(() => {
    let filtered = reviewedItems;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.reviewedType === filterType);
    }

    // Filter by warnings
    if (showWarningsOnly) {
      filtered = filtered.filter(item => generateWarnings(item).length > 0);
    }

    return filtered;
  }, [reviewedItems, searchQuery, filterType, showWarningsOnly]);

  const stats = useMemo(() => {
    const total = reviewedItems.length;
    const confirmed = reviewedItems.filter(i => i.isConfirmed).length;
    const withWarnings = reviewedItems.filter(i => generateWarnings(i).length > 0).length;
    const byType = {
      regular: reviewedItems.filter(i => i.reviewedType === 'regular').length,
      combo: reviewedItems.filter(i => i.reviewedType === 'combo').length,
      special: reviewedItems.filter(i => i.reviewedType === 'special').length,
      variant: reviewedItems.filter(i => i.reviewedType === 'variant').length,
      addon: reviewedItems.filter(i => i.reviewedType === 'addon').length,
    };

    return { total, confirmed, withWarnings, byType };
  }, [reviewedItems]);

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateItem = (index: number, updates: Partial<ReviewedMenuItem>) => {
    setReviewedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const confirmItem = (index: number) => {
    updateItem(index, { isConfirmed: true });
  };

  const deleteItem = (index: number) => {
    setReviewedItems(prev => prev.filter((_, i) => i !== index));
  };

  const confirmAll = () => {
    setReviewedItems(prev => prev.map(item => ({ ...item, isConfirmed: true })));
  };

  const handleConfirm = () => {
    // Only save confirmed items
    const confirmedItems = reviewedItems.filter(item => item.isConfirmed);
    onConfirm(confirmedItems);
  };

  const getTypeIcon = (type: MenuItemType) => {
    switch (type) {
      case 'combo': return <Package className="w-4 h-4 text-purple-600" />;
      case 'special': return <Star className="w-4 h-4 text-yellow-600" />;
      case 'variant': return <Settings2 className="w-4 h-4 text-blue-600" />;
      case 'addon': return <Plus className="w-4 h-4 text-green-600" />;
      default: return <Flame className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeBadgeColor = (type: MenuItemType) => {
    switch (type) {
      case 'combo': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'special': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'variant': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'addon': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-surface-3 text-foreground border';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Review Menu Items</h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI extracted {stats.total} items. Review and confirm before saving to database.
              </p>
            </div>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-6 gap-4 mt-4">
            <div className="bg-blue-50 p-3">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-blue-700">Total Items</div>
            </div>
            <div className="bg-green-50 p-3">
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
              <div className="text-xs text-green-700">Confirmed</div>
            </div>
            <div className="bg-orange-50 p-3">
              <div className="text-2xl font-bold text-orange-600">{stats.withWarnings}</div>
              <div className="text-xs text-orange-700">Warnings</div>
            </div>
            <div className="bg-purple-50 p-3">
              <div className="text-2xl font-bold text-purple-600">{stats.byType.combo}</div>
              <div className="text-xs text-purple-700">Combos</div>
            </div>
            <div className="bg-yellow-50 p-3">
              <div className="text-2xl font-bold text-yellow-600">{stats.byType.special}</div>
              <div className="text-xs text-yellow-700">Specials</div>
            </div>
            <div className="bg-surface-2 p-3">
              <div className="text-2xl font-bold text-muted-foreground">{stats.byType.regular}</div>
              <div className="text-xs text-foreground">Regular</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border text-sm"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as MenuItemType | 'all')}
              className="px-4 py-2 border text-sm"
            >
              <option value="all">All Types</option>
              <option value="regular">Regular</option>
              <option value="combo">Combos</option>
              <option value="special">Specials</option>
              <option value="variant">Variants</option>
              <option value="addon">Add-ons</option>
            </select>
            <label className="flex items-center gap-2 px-4 py-2 border text-sm cursor-pointer hover:bg-surface-2">
              <input
                type="checkbox"
                checked={showWarningsOnly}
                onChange={(e) => setShowWarningsOnly(e.target.checked)}
              />
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Warnings Only
            </label>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p>No items match your filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const actualIndex = reviewedItems.indexOf(item);
                const isExpanded = expandedItems.has(actualIndex);
                const warnings = generateWarnings(item);

                return (
                  <MenuItemCard
                    key={actualIndex}
                    item={item}
                    index={actualIndex}
                    isExpanded={isExpanded}
                    warnings={warnings}
                    onToggleExpand={() => toggleExpand(actualIndex)}
                    onUpdate={(updates) => updateItem(actualIndex, updates)}
                    onConfirm={() => confirmItem(actualIndex)}
                    onDelete={() => deleteItem(actualIndex)}
                    getTypeIcon={getTypeIcon}
                    getTypeBadgeColor={getTypeBadgeColor}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-surface-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={confirmAll}
                disabled={stats.confirmed === stats.total}
              >
                Confirm All ({stats.total - stats.confirmed} remaining)
              </Button>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={stats.confirmed === 0}
              >
                Save {stats.confirmed} Item{stats.confirmed !== 1 ? 's' : ''} to Database
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MenuItemCardProps {
  item: ReviewedMenuItem;
  index: number;
  isExpanded: boolean;
  warnings: string[];
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ReviewedMenuItem>) => void;
  onConfirm: () => void;
  onDelete: () => void;
  getTypeIcon: (type: MenuItemType) => React.ReactElement;
  getTypeBadgeColor: (type: MenuItemType) => string;
}

function MenuItemCard({
  item,
  index: _index,
  isExpanded,
  warnings,
  onToggleExpand,
  onUpdate,
  onConfirm,
  onDelete,
  getTypeIcon,
  getTypeBadgeColor,
}: MenuItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);
  const [editedPrice, setEditedPrice] = useState(item.price);
  const [editedDescription, setEditedDescription] = useState(item.description || '');

  const saveEdits = () => {
    onUpdate({
      name: editedName,
      price: editedPrice,
      description: editedDescription,
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`border  transition-all ${
        item.isConfirmed
          ? 'bg-green-50 border-green-200'
          : warnings.length > 0
          ? 'bg-orange-50 border-orange-200'
          : 'bg-card border'
      }`}
    >
      {/* Collapsed View */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Confirm Checkbox */}
          <div className="pt-1">
            <input
              type="checkbox"
              checked={item.isConfirmed}
              onChange={(e) => onUpdate({ isConfirmed: e.target.checked })}
              className="w-5 h-5 rounded border"
            />
          </div>

          {/* Item Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{item.name}</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1 ${getTypeBadgeColor(item.reviewedType)}`}>
                {getTypeIcon(item.reviewedType)}
                {item.reviewedType}
              </span>
              {item.aiConfidence && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(item.aiConfidence * 100)}% confidence
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="font-medium text-foreground">₹{item.price}</span>
              {item.category && (
                <span className="text-muted-foreground">{item.category}</span>
              )}
              {item.dietary && item.dietary.length > 0 && (
                <span className="text-muted-foreground">{item.dietary.join(', ')}</span>
              )}
            </div>
            {warnings.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-orange-700">{warnings.join(' • ')}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!item.isConfirmed && (
              <Button
                size="sm"
                variant="outline"
                onClick={onConfirm}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleExpand}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t p-4 bg-white/50">
          {isEditing ? (
            <EditForm
              name={editedName}
              price={editedPrice}
              description={editedDescription}
              onNameChange={setEditedName}
              onPriceChange={setEditedPrice}
              onDescriptionChange={setEditedDescription}
              onSave={saveEdits}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <DetailedView
              item={item}
              onUpdate={onUpdate}
              getTypeBadgeColor={getTypeBadgeColor}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EditForm({ name, price, description, onNameChange, onPriceChange, onDescriptionChange, onSave, onCancel }: any) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full mt-1 px-3 py-2 border"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Price</label>
        <input
          type="number"
          value={price}
          onChange={(e) => onPriceChange(parseFloat(e.target.value))}
          className="w-full mt-1 px-3 py-2 border"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Description</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          className="w-full mt-1 px-3 py-2 border"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-700">
          Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DetailedView({ item, onUpdate, getTypeBadgeColor }: any) {
  return (
    <div className="space-y-4">
      {/* Type Selection */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Item Type</label>
        <div className="flex gap-2 flex-wrap">
          {(['regular', 'combo', 'special', 'variant', 'addon'] as MenuItemType[]).map(type => (
            <button
              key={type}
              onClick={() => onUpdate({ reviewedType: type })}
              className={`px-3 py-1.5 text-sm font-medium  border transition-colors ${
                item.reviewedType === type
                  ? getTypeBadgeColor(type)
                  : 'bg-card border text-muted-foreground hover:bg-surface-2'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Combo Configuration */}
      {item.reviewedType === 'combo' && (
        <ComboConfiguration item={item} onUpdate={onUpdate} />
      )}

      {/* Special Configuration */}
      {item.reviewedType === 'special' && (
        <SpecialConfiguration item={item} onUpdate={onUpdate} />
      )}

      {/* Variant Configuration */}
      {item.reviewedType === 'variant' && (
        <VariantConfiguration item={item} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function ComboConfiguration({ item, onUpdate }: any) {
  return (
    <div className="bg-purple-50 p-4 border border-purple-200">
      <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
        <Package className="w-4 h-4" />
        Combo Configuration
      </h4>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Items included in combo</label>
          <p className="text-xs text-muted-foreground mb-2">AI detected: {item.suggestedComboItems?.join(', ') || 'None'}</p>
          <textarea
            placeholder="Enter items separated by commas (e.g., Burger, Fries, Drink)"
            value={item.comboItems?.join(', ') || ''}
            onChange={(e) => onUpdate({ comboItems: e.target.value.split(',').map(s => s.trim()) })}
            className="w-full px-3 py-2 border text-sm"
            rows={2}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Combo Savings (₹)</label>
          <input
            type="number"
            placeholder="e.g., 50"
            value={item.comboSavings || ''}
            onChange={(e) => onUpdate({ comboSavings: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function SpecialConfiguration({ item, onUpdate }: any) {
  return (
    <div className="bg-yellow-50 p-4 border border-yellow-200">
      <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
        <Star className="w-4 h-4" />
        Special Configuration
      </h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground">Valid From</label>
            <input
              type="date"
              value={item.validFrom || ''}
              onChange={(e) => onUpdate({ validFrom: e.target.value })}
              className="w-full px-3 py-2 border text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Valid Until</label>
            <input
              type="date"
              value={item.validUntil || ''}
              onChange={(e) => onUpdate({ validUntil: e.target.value })}
              className="w-full px-3 py-2 border text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Days Available</label>
          <div className="flex gap-2 mt-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <button
                key={day}
                onClick={() => {
                  const days = item.daysAvailable || [];
                  const updated = days.includes(day)
                    ? days.filter((d: string) => d !== day)
                    : [...days, day];
                  onUpdate({ daysAvailable: updated });
                }}
                className={`px-3 py-1 text-sm font-medium rounded border ${
                  (item.daysAvailable || []).includes(day)
                    ? 'bg-yellow-200 border-yellow-400 text-yellow-900'
                    : 'bg-card border text-muted-foreground'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantConfiguration({ item, onUpdate }: any) {
  return (
    <div className="bg-blue-50 p-4 border border-blue-200">
      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
        <Settings2 className="w-4 h-4" />
        Variant Configuration
      </h4>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-foreground">Variant Name (e.g., Size, Spice Level)</label>
          <input
            type="text"
            placeholder="e.g., Large, Extra Spicy"
            value={item.variantName || ''}
            onChange={(e) => onUpdate({ variantName: e.target.value })}
            className="w-full px-3 py-2 border text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Parent Item ID</label>
          <input
            type="text"
            placeholder="ID of the base item"
            value={item.parentItemId || ''}
            onChange={(e) => onUpdate({ parentItemId: e.target.value })}
            className="w-full px-3 py-2 border text-sm"
          />
        </div>
      </div>
    </div>
  );
}

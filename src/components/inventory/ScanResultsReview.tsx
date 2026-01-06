/**
 * Scan Results Review Component
 * Displays extracted items from bill scanning with editing capabilities
 */

import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  ExtractedItem,
  ExtractedDocumentData,
  InventoryItem,
  Supplier,
  InventoryCategory,
  InventoryUnit,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
} from '../../types/inventory';

interface EditableItem extends ExtractedItem {
  id: string;
  category: InventoryCategory;
  selectedUnit: InventoryUnit | string;
  isEditing: boolean;
  matchedItem?: InventoryItem;
}

interface ScanResultsReviewProps {
  extractedData: ExtractedDocumentData;
  existingItems: InventoryItem[];
  suppliers: Supplier[];
  onConfirm: (
    items: EditableItem[],
    supplierId?: string,
    createNewSupplier?: { name: string; phone?: string; address?: string },
    invoiceDetails?: { invoiceNumber?: string; invoiceDate?: string }
  ) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ScanResultsReview({
  extractedData,
  existingItems,
  suppliers,
  onConfirm,
  onCancel,
  isSubmitting,
}: ScanResultsReviewProps) {
  // Initialize editable items from extracted data
  const [items, setItems] = useState<EditableItem[]>(() =>
    extractedData.items.map((item, index) => {
      // Try to find a matching existing item
      const matchedItem = existingItems.find(
        (existing) =>
          existing.name.toLowerCase() === item.name.toLowerCase() ||
          (item.matchedInventoryItemId && existing.id === item.matchedInventoryItemId)
      );

      return {
        ...item,
        id: `item-${index}`,
        category: matchedItem?.category || guessCategory(item.name),
        selectedUnit: (item.unit as InventoryUnit) || matchedItem?.unit || 'pcs',
        isEditing: false,
        matchedItem,
      };
    })
  );

  // Invoice details state (editable)
  const [invoiceNumber, setInvoiceNumber] = useState(extractedData.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    // Try to parse the extracted date into YYYY-MM-DD format for the date input
    if (extractedData.invoiceDate) {
      const parsed = new Date(extractedData.invoiceDate);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      // If parsing fails, return empty and let user enter manually
      return '';
    }
    // Default to today's date if no date extracted
    return new Date().toISOString().split('T')[0];
  });

  // Supplier state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: extractedData.supplier?.name || '',
    phone: extractedData.supplier?.phone || '',
    address: extractedData.supplier?.address || '',
  });

  // Calculate totals
  const totals = useMemo(() => {
    const itemTotal = items.reduce((sum, item) => sum + (item.totalPrice || item.quantity * (item.unitPrice || 0)), 0);
    return {
      items: itemTotal,
      extracted: extractedData.total || itemTotal,
      tax: extractedData.tax || 0,
    };
  }, [items, extractedData]);

  // Update item
  const updateItem = (id: string, updates: Partial<EditableItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Remove item
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Add new item
  const addNewItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        totalPrice: 0,
        confidence: 1,
        isNewItem: true,
        category: 'other',
        selectedUnit: 'pcs',
        isEditing: true,
      },
    ]);
  };

  // Handle confirm
  const handleConfirm = async () => {
    // Validate required fields
    if (!invoiceDate) {
      return; // Don't submit without date
    }

    const supplierData = showNewSupplier && newSupplier.name
      ? { name: newSupplier.name, phone: newSupplier.phone, address: newSupplier.address }
      : undefined;

    const invoiceDetails = {
      invoiceNumber: invoiceNumber || undefined,
      invoiceDate: invoiceDate,
    };

    await onConfirm(items, selectedSupplierId || undefined, supplierData, invoiceDetails);
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-500/20';
    if (confidence >= 0.7) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Header with document info - editable fields */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-lg font-bold mb-3">Bill Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Invoice Number - Editable */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Invoice #</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Enter invoice number"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Invoice Date - Editable */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={cn(
                "w-full bg-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                !invoiceDate && "border border-red-500/50"
              )}
              required
            />
            {!invoiceDate && (
              <p className="text-xs text-red-400 mt-1">Date is required</p>
            )}
          </div>

          {/* Items count - Read only */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Items</label>
            <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-sm font-medium">
              {items.length}
            </div>
          </div>

          {/* Total - Read only */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Total</label>
            <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-sm font-medium">
              Rs. {totals.extracted.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Show original extracted date if different from parsed */}
        {extractedData.invoiceDate && invoiceDate && (
          <p className="text-xs text-slate-500 mt-2">
            Extracted date: "{extractedData.invoiceDate}"
          </p>
        )}
      </div>

      {/* Supplier Selection */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h4 className="font-bold mb-3">Supplier</h4>

        {!showNewSupplier ? (
          <div className="space-y-3">
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select existing supplier...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            {extractedData.supplier?.name && (
              <button
                onClick={() => setShowNewSupplier(true)}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                + Create new supplier from bill: "{extractedData.supplier.name}"
              </button>
            )}

            {!extractedData.supplier?.name && (
              <button
                onClick={() => setShowNewSupplier(true)}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                + Create new supplier
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={newSupplier.name}
              onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
              placeholder="Supplier name *"
              className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                placeholder="Phone"
                className="bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                placeholder="Address"
                className="bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => {
                setShowNewSupplier(false);
                setNewSupplier({ name: '', phone: '', address: '' });
              }}
              className="text-slate-400 hover:text-slate-300 text-sm"
            >
              Cancel - Use existing supplier
            </button>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h4 className="font-bold">Extracted Items ({items.length})</h4>
          <button
            onClick={addNewItem}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Item Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Category</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Qty</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Unit</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Unit Price</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Total</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">Confidence</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">Match</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-700/30">
                  {/* Item Name */}
                  <td className="px-4 py-3">
                    {item.isEditing ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        className="w-full bg-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Item name"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm">{item.name}</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(item.id, { category: e.target.value as InventoryCategory })}
                      className="bg-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(INVENTORY_CATEGORIES).map(([key, { label, icon }]) => (
                        <option key={key} value={key}>
                          {icon} {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, {
                        quantity: parseFloat(e.target.value) || 0,
                        totalPrice: (parseFloat(e.target.value) || 0) * (item.unitPrice || 0)
                      })}
                      className="w-20 bg-slate-600 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      step="0.01"
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-3">
                    <select
                      value={item.selectedUnit}
                      onChange={(e) => updateItem(item.id, { selectedUnit: e.target.value as InventoryUnit })}
                      className="bg-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(INVENTORY_UNITS).map(([key, { abbreviation }]) => (
                        <option key={key} value={key}>
                          {abbreviation}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Unit Price */}
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(item.id, {
                        unitPrice: parseFloat(e.target.value) || 0,
                        totalPrice: item.quantity * (parseFloat(e.target.value) || 0)
                      })}
                      className="w-24 bg-slate-600 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">
                      Rs. {(item.totalPrice || item.quantity * (item.unitPrice || 0)).toFixed(2)}
                    </span>
                  </td>

                  {/* Confidence */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                        getConfidenceBg(item.confidence),
                        getConfidenceColor(item.confidence)
                      )}
                    >
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </td>

                  {/* Match Status */}
                  <td className="px-4 py-3 text-center">
                    {item.matchedItem ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">
                        Matched
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                        New
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => updateItem(item.id, { isEditing: !item.isEditing })}
                        className="p-1 hover:bg-slate-600 rounded transition-colors"
                        title={item.isEditing ? 'Done editing' : 'Edit'}
                      >
                        {item.isEditing ? '✓' : '✏️'}
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-red-600/30 rounded transition-colors text-red-400"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-4 bg-slate-700/50 border-t border-slate-700">
          <div className="flex justify-end gap-8 text-sm">
            <div>
              <span className="text-slate-400">Subtotal:</span>
              <span className="ml-2 font-medium">Rs. {totals.items.toFixed(2)}</span>
            </div>
            {totals.tax > 0 && (
              <div>
                <span className="text-slate-400">Tax:</span>
                <span className="ml-2 font-medium">Rs. {totals.tax.toFixed(2)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Bill Total:</span>
              <span className="ml-2 font-bold text-lg">Rs. {totals.extracted.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Match existing items suggestion */}
      {existingItems.length > 0 && items.some((i) => !i.matchedItem) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <h4 className="font-bold text-yellow-400 mb-2">Matching Suggestions</h4>
          <p className="text-sm text-slate-400 mb-3">
            Some items might match existing inventory. Click to link them:
          </p>
          <div className="space-y-2">
            {items
              .filter((item) => !item.matchedItem)
              .slice(0, 5)
              .map((item) => {
                const suggestions = findSimilarItems(item.name, existingItems);
                if (suggestions.length === 0) return null;

                return (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-300">{item.name}</span>
                    <span className="text-slate-500">→</span>
                    <div className="flex gap-2">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() =>
                            updateItem(item.id, {
                              matchedItem: suggestion,
                              matchedInventoryItemId: suggestion.id,
                              category: suggestion.category,
                              selectedUnit: suggestion.unit,
                            })
                          }
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
                        >
                          {suggestion.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl font-bold transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || items.length === 0 || !invoiceDate}
          className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : !invoiceDate ? (
            <>
              Enter Invoice Date to Continue
            </>
          ) : (
            <>
              Confirm & Update Inventory
              <span className="text-sm opacity-75">({items.length} items)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Helper function to guess category from item name
function guessCategory(name: string): InventoryCategory {
  const lowered = name.toLowerCase();

  // Produce
  if (/tomato|onion|potato|carrot|lettuce|spinach|garlic|ginger|vegetable|fruit|apple|banana|lemon|lime|orange|mango|chili|pepper|cabbage|cauliflower|broccoli|cucumber|beans|peas/.test(lowered)) {
    return 'produce';
  }

  // Meat
  if (/chicken|mutton|lamb|beef|pork|meat|goat|keema|mince/.test(lowered)) {
    return 'meat';
  }

  // Seafood
  if (/fish|prawn|shrimp|crab|lobster|squid|salmon|tuna|seafood/.test(lowered)) {
    return 'seafood';
  }

  // Dairy
  if (/milk|cheese|paneer|curd|yogurt|butter|cream|ghee/.test(lowered)) {
    return 'dairy';
  }

  // Beverages
  if (/cola|soda|juice|water|tea|coffee|drink|beverage|sprite|fanta|pepsi|coke/.test(lowered)) {
    return 'beverages';
  }

  // Dry goods
  if (/rice|flour|atta|maida|dal|lentil|sugar|salt|oil|spice|masala|cumin|turmeric|coriander|pasta|noodle|bread/.test(lowered)) {
    return 'dry_goods';
  }

  // Supplies
  if (/napkin|tissue|foil|wrap|container|box|bag|disposable|packaging|glove|apron/.test(lowered)) {
    return 'supplies';
  }

  return 'other';
}

// Helper function to find similar items
function findSimilarItems(name: string, existingItems: InventoryItem[]): InventoryItem[] {
  const lowered = name.toLowerCase();
  const words = lowered.split(/\s+/);

  return existingItems
    .filter((item) => {
      const itemLowered = item.name.toLowerCase();
      // Check if any word matches
      return words.some(
        (word) => word.length > 2 && itemLowered.includes(word)
      );
    })
    .slice(0, 3);
}

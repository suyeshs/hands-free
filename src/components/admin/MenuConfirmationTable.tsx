import { useState } from 'react';
import { Trash2, ChevronDown, ChevronRight, Save, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import backendApi, { MenuItem } from '../../lib/backendApi';

interface MenuConfirmationTableProps {
  tenantId: string;
  items: MenuItem[];
  onConfirmed: (items: MenuItem[]) => void;
  onBack: () => void;
}

export function MenuConfirmationTable({ tenantId, items, onConfirmed, onBack }: MenuConfirmationTableProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const handleFieldChange = (index: number, field: keyof MenuItem, value: any) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: value };
    setMenuItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    setMenuItems(updated);
  };

  const toggleRowExpand = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleConfirm = async () => {
    try {
      setSaving(true);
      setError(null);

      console.log('Confirming menu items:', menuItems.length);
      const result = await backendApi.confirmMenu(tenantId, menuItems);

      console.log('Menu confirmed successfully:', result);
      onConfirmed(result.items);
    } catch (err) {
      console.error('Confirmation error:', err);
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Confirm Menu Items</h2>
          <p className="text-gray-600">
            Review and edit {menuItems.length} items before saving to database
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || menuItems.length === 0}
            className="bg-green-500 hover:bg-green-600"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Confirm & Save ({menuItems.length} items)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Confirmation Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Currency</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dietary</th>
                <th className="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {menuItems.map((item, index) => (
                <>
                  {/* Main Row */}
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRowExpand(index)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {expandedRows.has(index) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={item.name}
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        className="font-medium"
                      />
                      {item.nameLocal && (
                        <div className="text-xs text-gray-500 mt-1">{item.nameLocal}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleFieldChange(index, 'price', parseFloat(e.target.value))}
                        className="w-24"
                        step="0.01"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={item.currency}
                        onChange={(e) => handleFieldChange(index, 'currency', e.target.value)}
                        className="w-20"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={item.category}
                        onChange={(e) => handleFieldChange(index, 'category', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.isVeg && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Veg</span>}
                        {item.isVegan && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Vegan</span>}
                        {item.isHalal && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Halal</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 hover:bg-red-50 rounded text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedRows.has(index) && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <Input
                              value={item.description}
                              onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Spice Level (0-5)</label>
                            <Input
                              type="number"
                              value={item.spiceLevel}
                              onChange={(e) => handleFieldChange(index, 'spiceLevel', parseInt(e.target.value))}
                              min="0"
                              max="5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Preparation Time</label>
                            <Input
                              value={item.preparationTime}
                              onChange={(e) => handleFieldChange(index, 'preparationTime', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Portion Size</label>
                            <Input
                              value={item.servingSize}
                              onChange={(e) => handleFieldChange(index, 'servingSize', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Allergens (comma separated)</label>
                            <Input
                              value={item.allergens.join(', ')}
                              onChange={(e) => handleFieldChange(index, 'allergens', e.target.value.split(',').map(s => s.trim()))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Calories</label>
                            <Input
                              type="number"
                              value={item.calories || ''}
                              onChange={(e) => handleFieldChange(index, 'calories', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-span-2">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.isPopular}
                                  onChange={(e) => handleFieldChange(index, 'isPopular', e.target.checked)}
                                  className="rounded"
                                />
                                <span className="text-xs">Popular Item</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.isChefSpecial}
                                  onChange={(e) => handleFieldChange(index, 'isChefSpecial', e.target.checked)}
                                  className="rounded"
                                />
                                <span className="text-xs">Chef's Special</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click the arrow next to each item to see and edit advanced fields like allergens, spice level, and dietary flags.
        </p>
      </div>
    </div>
  );
}

export default MenuConfirmationTable;

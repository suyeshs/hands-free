'use client';

import { useState } from 'react';
import { Loader2, Upload, FileText, Image as ImageIcon, X } from 'lucide-react';

interface MenuItem {
  name: string;
  description?: string;
  price: number;
  category: string;
  type?: string;
  imageUrl?: string;
  available?: boolean;
}

interface StepMenuProps {
  tenantId: string;
  onLaunch: (data: { menuItems: MenuItem[] }) => void;
  onBack: () => void;
}

const RESTAURANT_BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://handsfree-domain-service-prod.suyesh.workers.dev';

export function StepMenu({ tenantId, onLaunch, onBack }: StepMenuProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [uploadMethod, setUploadMethod] = useState<'excel' | 'manual' | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Excel/PDF upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantId', tenantId);

      const response = await fetch(
        `${RESTAURANT_BACKEND_URL}/api/admin/menu/upload-smart`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to parse menu file');
      }

      const data = await response.json() as { items?: any[] };
      setMenuItems(data.items || []);
      setUploadMethod('excel');
    } catch (err) {
      console.error('File upload error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to upload menu file'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 50) {
      alert('Maximum 50 photos allowed at once');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('tenantId', tenantId);

      Array.from(files).forEach((file) => {
        formData.append('photos', file);
      });

      const response = await fetch(
        `${RESTAURANT_BACKEND_URL}/api/admin/menu/upload-photos`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to upload photos');
      }

      const data = await response.json() as { results: { matched: any[], unmatched: any[] } };

      // Update menu items with matched images
      setMenuItems((prev) =>
        prev.map((item) => {
          const match = data.results.matched.find(
            (m: any) => m.matchedItem?.name === item.name
          );
          return match ? { ...item, imageUrl: match.imageUrl } : item;
        })
      );

      alert(
        `Uploaded ${data.results.matched.length} photos with matches, ${data.results.unmatched.length} unmatched`
      );
    } catch (err) {
      console.error('Photo upload error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to upload photos'
      );
    } finally {
      setUploading(false);
    }
  };

  // Handle manual entry
  const handleManualAdd = () => {
    const name = prompt('Dish name:');
    if (!name) return;

    const description = prompt('Description (optional):');
    const priceStr = prompt('Price:');
    const category = prompt('Category (e.g., Appetizers, Main Course):');

    const price = parseFloat(priceStr || '0');
    if (isNaN(price) || price <= 0) {
      alert('Invalid price');
      return;
    }

    setMenuItems((prev) => [
      ...prev,
      {
        name,
        description: description || '',
        price,
        category: category || 'Uncategorized',
        type: 'veg',
        available: true,
      },
    ]);
    setUploadMethod('manual');
  };

  const removeItem = (index: number) => {
    setMenuItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLaunch = () => {
    onLaunch({ menuItems });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Your Menu
        </h2>
        <p className="text-gray-600">
          Add menu items using Excel/PDF or manual entry
        </p>
      </div>

      {/* Upload Options */}
      {menuItems.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <label className="relative p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 cursor-pointer transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={loading}
            />
            <div className="flex flex-col items-center">
              <FileText className="h-12 w-12 text-gray-400 mb-2" />
              <span className="font-semibold text-gray-700">
                Upload Excel/PDF
              </span>
              <span className="text-sm text-gray-500 mt-1">
                AI will parse your menu
              </span>
            </div>
          </label>

          <button
            onClick={handleManualAdd}
            className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 transition-colors"
            disabled={loading}
          >
            <div className="flex flex-col items-center">
              <Upload className="h-12 w-12 text-gray-400 mb-2" />
              <span className="font-semibold text-gray-700">Manual Entry</span>
              <span className="text-sm text-gray-500 mt-1">
                Add items one by one
              </span>
            </div>
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-purple-700 mb-4" />
          <p className="text-gray-600">Parsing menu file...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Menu Items Display */}
      {menuItems.length > 0 && (
        <>
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Menu Items ({menuItems.length})
            </h3>

            <div className="flex gap-2">
              <button
                onClick={handleManualAdd}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Add Item
              </button>

              <label className="relative px-4 py-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Photos'}
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {menuItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}

                <div className="flex-1">
                  <h4 className="font-semibold">{item.name}</h4>
                  {item.description && (
                    <p className="text-sm text-gray-600">{item.description}</p>
                  )}
                  <div className="flex gap-4 mt-1 text-sm">
                    <span className="text-purple-700 font-semibold">
                      ₹{item.price}
                    </span>
                    <span className="text-gray-500">{item.category}</span>
                  </div>
                </div>

                <button
                  onClick={() => removeItem(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={loading || uploading}
        >
          Back
        </button>

        <button
          onClick={handleLaunch}
          disabled={menuItems.length === 0 || loading || uploading}
          className={`px-6 py-2 rounded-lg ${menuItems.length > 0 && !loading && !uploading
              ? 'bg-purple-700 text-white hover:bg-purple-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          {menuItems.length === 0 ? 'Skip for Now' : 'Launch Restaurant'}
        </button>
      </div>
    </div>
  );
}

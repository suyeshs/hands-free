'use client';

import React, { useState, useEffect } from 'react';
import { getTenantId } from '../../../utils/tenant';
import Link from 'next/link';

interface AssignedImage {
  menuItemId: string;
  menuItemName: string;
  category: string;
  cloudflareImageId: string;
  imageUrl: string;
  isVegetarian: boolean;
}

interface UnassignedImage {
  id: string;
  cloudflare_image_id: string;
  filename: string;
  image_url: string;
  uploaded_at: string;
  notes?: string;
}

export default function ImageManagementPage() {
  const [tenantId, setTenantId] = useState('demo');
  const [assignedImages, setAssignedImages] = useState<AssignedImage[]>([]);
  const [unassignedImages, setUnassignedImages] = useState<UnassignedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'unassigned'>('all');

  useEffect(() => {
    const tid = getTenantId();
    setTenantId(tid);
  }, []);

  useEffect(() => {
    if (tenantId && tenantId !== 'demo') {
      loadAllImages();
    }
  }, [tenantId]);

  const loadAllImages = async () => {
    setIsLoading(true);
    try {
      // Load assigned images from menu items
      // Tenant ID is extracted from hostname, not URL path
      const menuResponse = await fetch(`/api/menu?limit=1000`);
      if (menuResponse.ok) {
        const menuData = await menuResponse.json() as { items?: any[] };
        console.log('[ImageManagement] Menu response:', {
          totalItems: menuData.items?.length || 0,
          firstItem: menuData.items?.[0]
        });

        const assigned = (menuData.items || [])
          .map((item: any) => {
            // Handle multiple possible field name variations
            const imageUrl = item.imageUrl || item.image_url || item.photo_url || item.photoUrl;
            let cloudflareImageId = item.imageId || item.cloudflare_image_id || item.cloudflareImageId;

            // Extract cloudflare image ID from URL if not directly provided
            if (!cloudflareImageId && imageUrl && imageUrl.includes('imagedelivery.net')) {
              const match = imageUrl.match(/imagedelivery\.net\/[^/]+\/([^/]+)\//);
              if (match) {
                cloudflareImageId = match[1];
              }
            }

            // Only include items that have images
            if (!cloudflareImageId || !imageUrl) return null;

            return {
              menuItemId: item.id,
              menuItemName: item.name,
              category: item.category,
              cloudflareImageId,
              imageUrl,
              isVegetarian: item.is_vegetarian || item.isVegetarian || false,
            };
          })
          .filter((item): item is AssignedImage => item !== null);

        console.log('[ImageManagement] Assigned images found:', assigned.length);
        setAssignedImages(assigned);
      } else {
        console.error('[ImageManagement] Menu response not ok:', menuResponse.status);
      }

      // Load unassigned images
      const unassignedResponse = await fetch(`/api/admin/menu/unassigned-images?tenantId=${tenantId}`);
      if (unassignedResponse.ok) {
        const unassignedData = await unassignedResponse.json() as { images?: UnassignedImage[] };
        console.log('[ImageManagement] Unassigned images found:', unassignedData.images?.length || 0);
        setUnassignedImages(unassignedData.images || []);
      } else {
        console.error('[ImageManagement] Unassigned images response not ok:', unassignedResponse.status);
      }
    } catch (error) {
      console.error('[ImageManagement] Failed to load images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassignImage = async (menuItemId: string, cloudflareImageId: string) => {
    if (!confirm('Remove this image from the menu item? The image will be moved to unassigned images.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/menu/items/${menuItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudflareImageId: null,
          photoUrl: null,
        }),
      });

      if (response.ok) {
        // Find the image that was unassigned
        const unassignedImage = assignedImages.find(img => img.menuItemId === menuItemId);

        if (unassignedImage) {
          // Create entry in unassigned_images
          const createResponse = await fetch('/api/admin/menu/unassigned-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              tenantId,
              cloudflareImageId: unassignedImage.cloudflareImageId,
              filename: `unassigned-${unassignedImage.menuItemName.toLowerCase().replace(/\s+/g, '-')}.jpg`,
              imageUrl: unassignedImage.imageUrl,
            }),
          });
        }

        alert('Image unassigned successfully!');
        loadAllImages();
      } else {
        alert('Failed to unassign image');
      }
    } catch (error) {
      console.error('Error unassigning image:', error);
      alert('Error unassigning image');
    }
  };

  const handleDeleteImage = async (imageId: string, isAssigned: boolean, menuItemId?: string) => {
    if (!confirm('Permanently delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      if (isAssigned && menuItemId) {
        // Remove from menu item first
        await fetch(`/api/admin/menu/items/${menuItemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cloudflareImageId: null,
            photoUrl: null,
          }),
        });
      } else {
        // Delete unassigned image
        await fetch('/api/admin/menu/unassigned-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            tenantId,
            imageId,
          }),
        });
      }

      alert('Image deleted successfully!');
      loadAllImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image');
    }
  };

  const filteredAssignedImages = assignedImages.filter(img =>
    img.menuItemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    img.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUnassignedImages = unassignedImages.filter(img =>
    img.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedAssigned = filterType === 'unassigned' ? [] : filteredAssignedImages;
  const displayedUnassigned = filterType === 'assigned' ? [] : filteredUnassignedImages;

  const totalImages = assignedImages.length + unassignedImages.length;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Image Management</h1>
              <p className="text-gray-600">
                View and manage all menu images for <span className="font-bold text-blue-600">{tenantId}</span>
              </p>
            </div>
            <Link
              href="/admin/menu/photos"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Upload Photos
            </Link>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700 font-medium">Total Images</p>
              <p className="text-3xl font-bold text-green-900">{totalImages}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 font-medium">Assigned</p>
              <p className="text-3xl font-bold text-blue-900">{assignedImages.length}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-700 font-medium">Unassigned</p>
              <p className="text-3xl font-bold text-orange-900">{unassignedImages.length}</p>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 mt-6">
            <input
              type="text"
              placeholder="Search by item name, filename, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Images</option>
              <option value="assigned">Assigned Only</option>
              <option value="unassigned">Unassigned Only</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading images...</p>
          </div>
        ) : (
          <>
            {/* Assigned Images Section */}
            {displayedAssigned.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">
                  Assigned Images ({displayedAssigned.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedAssigned.map((image) => (
                    <div
                      key={image.menuItemId}
                      className="border border-gray-200 rounded-lg p-3 hover:shadow-lg transition-shadow"
                    >
                      <div className="relative mb-3">
                        <img
                          src={image.imageUrl}
                          alt={image.menuItemName}
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        <div className="absolute top-2 left-2">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-bold ${
                              image.isVegetarian
                                ? 'bg-green-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                          >
                            {image.isVegetarian ? '🌱 VEG' : '🍖 NON-VEG'}
                          </span>
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 truncate" title={image.menuItemName}>
                        {image.menuItemName}
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">{image.category}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUnassignImage(image.menuItemId, image.cloudflareImageId)}
                          className="flex-1 px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-md hover:bg-orange-200 transition-colors"
                        >
                          Unassign
                        </button>
                        <button
                          onClick={() => handleDeleteImage(image.cloudflareImageId, true, image.menuItemId)}
                          className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unassigned Images Section */}
            {displayedUnassigned.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">
                    Unassigned Images ({displayedUnassigned.length})
                  </h2>
                  <Link
                    href="/admin/menu/photos"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Assign Images →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedUnassigned.map((image) => {
                    const isDuplicate = image.notes?.includes('POTENTIAL DUPLICATE');
                    return (
                      <div
                        key={image.id}
                        className={`border rounded-lg p-3 hover:shadow-lg transition-shadow ${
                          isDuplicate ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="relative mb-3">
                          <img
                            src={image.image_url}
                            alt={image.filename}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          {isDuplicate && (
                            <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                              ⚠️ DUPLICATE
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1 truncate" title={image.filename}>
                          {image.filename}
                        </p>
                        {isDuplicate && (
                          <p className="text-xs text-orange-700 mb-2 font-medium">
                            {image.notes?.replace('POTENTIAL DUPLICATE: ', '')}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mb-3">
                          {new Date(image.uploaded_at).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2">
                          <Link
                            href="/admin/menu/photos"
                            className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md hover:bg-blue-200 transition-colors text-center"
                          >
                            Assign
                          </Link>
                          <button
                            onClick={() => handleDeleteImage(image.id, false)}
                            className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {displayedAssigned.length === 0 && displayedUnassigned.length === 0 && (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery ? 'Try adjusting your search query' : 'Upload photos to get started'}
                </p>
                <Link
                  href="/admin/menu/photos"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Upload Photos
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Unassigned Images Manager
 * View and assign images from the unassigned pool to menu items
 */

import React, { useState, useEffect } from 'react';
import { ImageUploader } from './ImageUploader';

interface UnassignedImage {
  id: string;
  tenant_id: string;
  cloudflare_image_id: string;
  filename: string;
  image_url: string;
  uploaded_at: string;
}

interface MenuItem {
  id: string;
  name: string;
  category_id: string;
  image?: string;
}

interface UnassignedImagesManagerProps {
  tenantId: string;
  onImageAssigned?: () => void;
}

export const UnassignedImagesManager: React.FC<UnassignedImagesManagerProps> = ({
  tenantId,
  onImageAssigned,
}) => {
  const [images, setImages] = useState<UnassignedImage[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<UnassignedImage | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUnassignedImages();
    loadMenuItems();
  }, [tenantId]);

  const loadUnassignedImages = async () => {
    try {
      const { initDatabase } = await import('../../lib/database');
      const db = await initDatabase();

      // Query unassigned images from local SQLite
      const result = await db.select<UnassignedImage[]>(
        `SELECT id, tenant_id, cloudflare_image_id, filename, image_url, uploaded_at
         FROM unassigned_images
         WHERE tenant_id = $1 AND (assigned_to IS NULL OR assigned_to = '')
         ORDER BY uploaded_at DESC`,
        [tenantId]
      );

      console.log(`[UnassignedImagesManager] Loaded ${result.length} unassigned images from local database`);
      setImages(result);
    } catch (err) {
      console.error('[UnassignedImagesManager] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const { getMenuItems } = await import('../../lib/database');
      const items = await getMenuItems();
      setMenuItems(items);
    } catch (err) {
      console.error('[UnassignedImagesManager] Failed to load menu items:', err);
    }
  };

  const handleAssignClick = (image: UnassignedImage) => {
    setSelectedImage(image);
    setShowAssignModal(true);
  };

  const handleDeleteClick = async (image: UnassignedImage) => {
    if (!confirm(`Delete image "${image.filename}"? This will remove it from your local library.`)) {
      return;
    }

    try {
      const { initDatabase } = await import('../../lib/database');
      const db = await initDatabase();

      // Delete from local SQLite database
      await db.execute(
        `DELETE FROM unassigned_images WHERE id = $1`,
        [image.id]
      );

      console.log(`[UnassignedImagesManager] Deleted image: ${image.filename}`);
      await loadUnassignedImages();
    } catch (err) {
      console.error('[UnassignedImagesManager] Delete error:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const handleAssignToMenuItem = async (menuItemId: string) => {
    if (!selectedImage) return;

    try {
      const { initDatabase } = await import('../../lib/database');
      const db = await initDatabase();

      // Update menu item with the image URL
      await db.execute(
        `UPDATE menu_items SET image = $1 WHERE id = $2`,
        [selectedImage.image_url, menuItemId]
      );

      // Mark image as assigned in unassigned_images table
      const now = new Date().toISOString();
      await db.execute(
        `UPDATE unassigned_images
         SET assigned_to = $1, assigned_at = $2, updated_at = $3
         WHERE id = $4`,
        [menuItemId, now, now, selectedImage.id]
      );

      console.log(`[UnassignedImagesManager] Assigned image to menu item: ${menuItemId}`);

      setShowAssignModal(false);
      setSelectedImage(null);
      await loadUnassignedImages();
      await loadMenuItems();

      if (onImageAssigned) {
        onImageAssigned();
      }
    } catch (err) {
      console.error('[UnassignedImagesManager] Assign error:', err);
      alert(err instanceof Error ? err.message : 'Failed to assign image');
    }
  };

  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="unassigned-images-manager">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Image Library</h2>
        <ImageUploader
          tenantId={tenantId}
          mode="bulk"
          onUploadComplete={() => loadUnassignedImages()}
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">{images.length}</div>
            <div className="text-sm text-muted-foreground">Unassigned Images</div>
          </div>
          <div className="text-muted-foreground/50">|</div>
          <div>
            <div className="text-2xl font-bold text-green-600">{menuItems.filter(m => m.image).length}</div>
            <div className="text-sm text-muted-foreground">Items with Images</div>
          </div>
        </div>
      </div>

      {/* Image Grid */}
      {images.length === 0 ? (
        <div className="text-center py-12 bg-surface-2">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-muted-foreground">No unassigned images</p>
          <p className="text-xs text-muted-foreground">Upload images using the button above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative group bg-card shadow-sm border border overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square relative">
                <img
                  src={image.image_url}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-2">
                <p className="text-xs text-muted-foreground truncate" title={image.filename}>
                  {image.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(image.uploaded_at).toLocaleDateString()}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => handleAssignClick(image)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  Assign
                </button>
                <button
                  onClick={() => handleDeleteClick(image)}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border flex items-center justify-between">
              <h3 className="text-lg font-semibold">Assign Image to Menu Item</h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedImage(null);
                }}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image Preview */}
            <div className="p-4 border-b border">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.filename}
                className="w-full h-48 object-contain bg-surface-3 rounded"
              />
              <p className="mt-2 text-sm text-muted-foreground">{selectedImage.filename}</p>
            </div>

            {/* Search */}
            <div className="p-4 border-b border">
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredMenuItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No menu items found</p>
              ) : (
                <div className="space-y-2">
                  {filteredMenuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAssignToMenuItem(item.id)}
                      className="w-full text-left p-3 bg-surface-2 hover:bg-blue-50 transition-colors border border hover:border-blue-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-xs text-muted-foreground">ID: {item.id}</div>
                        </div>
                        {item.image && (
                          <div className="ml-4">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

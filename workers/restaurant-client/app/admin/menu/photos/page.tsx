'use client';

import React, { useState, useEffect } from 'react';
import { uploadToCloudflare } from '../../../../imageUpload';
import { getTenantId } from '../../../utils/tenant';
import { API_URL } from '../../../config/api';

interface UploadedPhoto {
  cloudflareId: string;
  filename: string;
  previewUrl: string;
}

interface MatchResult {
  filename: string;
  imageUrl: string;
  imageId: string;
  matched: boolean;
  matchedItem?: {
    id: string;
    name: string;
    category: string;
  };
  error?: string;
}

interface UnassignedImage {
  id: string;
  tenant_id: string;
  cloudflare_image_id: string;
  filename: string;
  image_url: string;
  uploaded_at: string;
  uploaded_by?: string;
  notes?: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  cloudflare_image_id?: string;
}

export default function PhotoUploadPage() {
  const [tenantId, setTenantId] = useState('demo');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [unassignedImages, setUnassignedImages] = useState<UnassignedImage[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedMenuItems, setSelectedMenuItems] = useState<Record<string, string>>({});

  // Extract tenant ID from hostname on mount
  useEffect(() => {
    const tid = getTenantId();
    setTenantId(tid);
  }, []);

  // Load unassigned images and menu items
  useEffect(() => {
    if (tenantId && tenantId !== 'demo') {
      loadUnassignedImages();
      loadMenuItems();
    }
  }, [tenantId]);

  const loadUnassignedImages = async () => {
    try {
      const response = await fetch(`/api/admin/menu/unassigned-images?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json() as { images?: UnassignedImage[] };
        setUnassignedImages(data.images || []);
      }
    } catch (err) {
      console.error('Failed to load unassigned images:', err);
    }
  };

  const loadMenuItems = async () => {
    try {
      // Fetch menu items via Restaurant Worker API
      const response = await fetch(`/api/menu`);
      if (response.ok) {
        const data = await response.json() as { items?: any[] };
        const items = (data.items || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          cloudflare_image_id: item.imageId || item.cloudflare_image_id,
        })) as MenuItem[];
        setMenuItems(items);
      }
    } catch (err) {
      console.error('Failed to load menu items:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setError('');
    setMatchResults([]);
  };

  const handleUploadToCloudflare = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select photos to upload');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    const uploaded: UploadedPhoto[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        try {
          console.log(`Uploading ${file.name} to Cloudflare...`);

          // Upload to Cloudflare Images
          const result = await uploadToCloudflare(file, getTenantId());

          if (!result.success || !result.cloudflareId) {
            throw new Error(result.error || 'Upload failed');
          }

          const cloudflareId = result.cloudflareId;
          const previewUrl = result.imageUrl || `https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A/${cloudflareId}/public`;

          uploaded.push({
            cloudflareId,
            filename: file.name,
            previewUrl
          });

          setUploadProgress(((i + 1) / selectedFiles.length) * 100);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      setUploadedPhotos(uploaded);
      console.log(`Successfully uploaded ${uploaded.length} photos to Cloudflare`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMatchPhotos = async () => {
    if (uploadedPhotos.length === 0) {
      setError('Please upload photos to Cloudflare first');
      return;
    }

    setIsMatching(true);
    setError('');

    try {
      // Send to backend API for fuzzy matching
      const response = await fetch(`${API_URL}/api/admin/menu/upload-photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId,
          photos: uploadedPhotos.map(p => ({
            cloudflareId: p.cloudflareId,
            filename: p.filename
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to match photos');
      }

      const result = await response.json() as { results: { matched: any[], unmatched: any[] }, total: number, matched: number, unmatched: number };
      setMatchResults(result.results.matched.concat(result.results.unmatched));

      // Reload unassigned images after matching
      await loadUnassignedImages();

      console.log('Photo matching complete:', {
        total: result.total,
        matched: result.matched,
        unmatched: result.unmatched
      });
    } catch (err) {
      console.error('Photo matching failed:', err);
      setError(err instanceof Error ? err.message : 'Photo matching failed');
    } finally {
      setIsMatching(false);
    }
  };

  const handleAssignImage = async (imageId: string) => {
    const menuItemId = selectedMenuItems[imageId];
    if (!menuItemId) {
      alert('Please select a menu item first');
      return;
    }

    try {
      const response = await fetch('/api/admin/menu/unassigned-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'assign',
          tenantId,
          imageId,
          menuItemId
        })
      });

      if (response.ok) {
        // Remove from unassigned list
        setUnassignedImages(prev => prev.filter(img => img.id !== imageId));
        // Clear selection
        setSelectedMenuItems(prev => {
          const newState = { ...prev };
          delete newState[imageId];
          return newState;
        });
        alert('Image assigned successfully!');
      } else {
        const errorData = await response.json() as { error?: string };
        alert(`Failed to assign image: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to assign image:', err);
      alert('Error assigning image');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/menu/unassigned-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          tenantId,
          imageId
        })
      });

      if (response.ok) {
        setUnassignedImages(prev => prev.filter(img => img.id !== imageId));
        alert('Image deleted successfully!');
      } else {
        const errorData = await response.json() as { error?: string };
        alert(`Failed to delete image: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete image:', err);
      alert('Error deleting image');
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setUploadedPhotos([]);
    setMatchResults([]);
    setError('');
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">Menu Photo Management</h1>
          <p className="text-gray-600 mb-6">
            Upload photos and automatically match them to menu items using fuzzy logic (70% threshold)
          </p>

          {/* Tenant Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tenant ID: <span className="font-bold text-blue-600">{tenantId}</span>
            </label>
          </div>

          {/* Step 1: File Selection */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Step 1: Select Photos</h2>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            {selectedFiles.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {selectedFiles.length} file(s) selected
              </p>
            )}
          </div>

          {/* Step 2: Upload to Cloudflare */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Step 2: Upload to Cloudflare</h2>
            <button
              onClick={handleUploadToCloudflare}
              disabled={isUploading || selectedFiles.length === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold
                hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-colors"
            >
              {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload to Cloudflare'}
            </button>

            {uploadedPhotos.length > 0 && (
              <div className="mt-4">
                <p className="text-green-600 font-medium mb-2">
                  Successfully uploaded {uploadedPhotos.length} photos to Cloudflare
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {uploadedPhotos.map((photo, idx) => (
                    <div key={idx} className="border rounded-lg p-2">
                      <img
                        src={photo.previewUrl}
                        alt={photo.filename}
                        className="w-full h-32 object-cover rounded"
                      />
                      <p className="text-xs text-gray-600 mt-2 truncate">
                        {photo.filename}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Match to Menu Items */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Step 3: Match to Menu Items</h2>
            <button
              onClick={handleMatchPhotos}
              disabled={isMatching || uploadedPhotos.length === 0}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold
                hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                transition-colors"
            >
              {isMatching ? 'Matching...' : 'Match Photos to Menu'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Match Results */}
          {matchResults.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3">Match Results</h2>

              {/* Matched Photos */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-green-700 mb-2">
                  Matched Photos ({matchResults.filter(r => r.matched).length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchResults.filter(r => r.matched).map((result, idx) => (
                    <div key={idx} className="border border-green-200 rounded-lg p-4 bg-green-50">
                      <div className="flex gap-4">
                        <img
                          src={result.imageUrl}
                          alt={result.filename}
                          className="w-24 h-24 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {result.matchedItem?.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Category: {result.matchedItem?.category}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            File: {result.filename}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unmatched Photos - Temporary Results */}
              {matchResults.filter(r => !r.matched).length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-orange-700 mb-2">
                    Unmatched Photos from Last Upload ({matchResults.filter(r => !r.matched).length})
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    These photos were saved to unassigned images. Scroll down to manually assign them.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {matchResults.filter(r => !r.matched).map((result, idx) => {
                      const isDuplicate = result.error?.includes('DUPLICATE');
                      return (
                        <div
                          key={idx}
                          className={`border rounded-lg p-2 ${isDuplicate
                            ? 'border-orange-400 bg-orange-100'
                            : 'border-orange-200 bg-orange-50'
                            }`}
                        >
                          <div className="relative">
                            <img
                              src={result.imageUrl}
                              alt={result.filename}
                              className="w-full h-32 object-cover rounded"
                            />
                            {isDuplicate && (
                              <div className="absolute top-1 right-1 bg-orange-500 text-white px-1 py-0.5 rounded text-xs font-bold">
                                ⚠️
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-2 truncate">
                            {result.filename}
                          </p>
                          {result.error && (
                            <p
                              className={`text-xs mt-1 font-medium ${isDuplicate ? 'text-orange-700' : 'text-red-600'
                                }`}
                            >
                              {result.error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reset Button */}
          {(uploadedPhotos.length > 0 || matchResults.length > 0) && (
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold
                hover:bg-gray-700 transition-colors"
            >
              Upload More Photos
            </button>
          )}
        </div>

        {/* Unassigned Images Section */}
        {unassignedImages.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">
              Unassigned Images ({unassignedImages.length})
            </h2>
            <p className="text-gray-600 mb-6">
              These images are uploaded but not yet assigned to any menu item. Select a menu item and click "Assign" to link them.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unassignedImages.map((image) => {
                const isDuplicate = image.notes?.includes('POTENTIAL DUPLICATE');
                return (
                  <div
                    key={image.id}
                    className={`border rounded-lg p-4 hover:shadow-lg transition-shadow ${isDuplicate ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
                      }`}
                  >
                    <div className="relative">
                      <img
                        src={image.image_url}
                        alt={image.filename}
                        className="w-full h-48 object-cover rounded-lg mb-3"
                      />
                      {isDuplicate && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                          ⚠️ DUPLICATE
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-2 truncate" title={image.filename}>
                      {image.filename}
                    </p>
                    {isDuplicate && (
                      <p className="text-xs text-orange-700 mb-2 font-medium">
                        {image.notes?.replace('POTENTIAL DUPLICATE: ', '')}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mb-4">
                      Uploaded: {new Date(image.uploaded_at).toLocaleDateString()}
                    </p>

                    {/* Menu Item Selection */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Select Menu Item:
                      </label>
                      <select
                        value={selectedMenuItems[image.id] || ''}
                        onChange={(e) => setSelectedMenuItems(prev => ({
                          ...prev,
                          [image.id]: e.target.value
                        }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Select Item --</option>
                        {menuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAssignImage(image.id)}
                        disabled={!selectedMenuItems[image.id]}
                        className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => handleDeleteImage(image.id)}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition-colors"
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

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How it works</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Select one or more photos from your computer</li>
            <li>Upload them to Cloudflare Images to get permanent URLs</li>
            <li>Click "Match Photos to Menu" to automatically match photos to menu items</li>
            <li>Photos are matched using fuzzy logic (70% character similarity threshold)</li>
            <li>Matched photos are assigned to menu items automatically</li>
            <li>Unmatched photos appear in the "Unassigned Images" section below</li>
            <li><strong>Duplicate Detection:</strong> Images with 80%+ similarity to existing images are flagged with ⚠️ DUPLICATE warning</li>
            <li>Manually assign unmatched images by selecting a menu item and clicking "Assign"</li>
            <li><strong>Delete:</strong> Removes image from both Cloudflare Images storage and database</li>
          </ol>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-blue-700">
              <strong>Tip:</strong> Name your photo files similar to dish names for better matching
              (e.g., "pandhi-curry.jpg" will match "Pandhi Curry")
            </p>
            <p className="text-sm text-blue-700">
              <strong>Duplicate Detection Examples:</strong> "balekai-fry.jpg" and "bale-kary.jpeg" will be flagged as duplicates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

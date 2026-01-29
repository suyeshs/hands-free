/**
 * Menu Item Image Uploader
 * Single image upload component for menu item editing
 */

import React, { useState } from 'react';

interface MenuItemImageUploaderProps {
  currentImageUrl?: string;
  onImageUpload: (imageUrl: string) => void;
  itemName: string;
}

export const MenuItemImageUploader: React.FC<MenuItemImageUploaderProps> = ({
  currentImageUrl,
  onImageUpload,
  itemName,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);

  const uploadToCloudflare = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://handsfree-restaurant.suyesh.workers.dev/api/cfupload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${error}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    return result.url;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      console.log(`[MenuItemImageUploader] Uploading image for: ${itemName}`);

      const imageUrl = await uploadToCloudflare(file);

      console.log(`[MenuItemImageUploader] Upload successful:`, imageUrl);

      setPreviewUrl(imageUrl);
      onImageUpload(imageUrl);
    } catch (err) {
      console.error('[MenuItemImageUploader] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(undefined);
    onImageUpload('');
  };

  return (
    <div className="menu-item-image-uploader">
      <label className="block text-sm font-medium text-foreground mb-2">
        Item Image
      </label>

      {previewUrl ? (
        <div className="relative group">
          <img
            src={previewUrl}
            alt={itemName}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center gap-2">
            <label
              htmlFor="image-upload-replace"
              className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-blue-600 text-white text-sm rounded cursor-pointer hover:bg-blue-700 transition-all"
            >
              Replace
            </label>
            <button
              onClick={handleRemoveImage}
              className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-all"
            >
              Remove
            </button>
          </div>
          <input
            id="image-upload-replace"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </div>
      ) : (
        <label
          htmlFor="image-upload-input"
          className={`
            flex flex-col items-center justify-center w-full h-48 border-2 border-dashed  cursor-pointer
            transition-colors
            ${uploading
              ? 'border bg-surface-2 cursor-not-allowed'
              : 'border bg-surface-2 hover:bg-surface-3 hover:border-blue-500'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center py-6">
            {uploading ? (
              <>
                <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
              </>
            )}
          </div>
          <input
            id="image-upload-input"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      {previewUrl && (
        <div className="mt-2 text-xs text-muted-foreground">
          <p className="font-mono truncate">
            {previewUrl}
          </p>
        </div>
      )}
    </div>
  );
};

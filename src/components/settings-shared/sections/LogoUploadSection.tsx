/**
 * Logo Upload Section
 * Handles restaurant logo upload with Cloudflare integration
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard } from '../shared';

export function LogoUploadSection() {
  const { formData, updateField } = useRestaurantSettings();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    setLogoUploadError(null);

    try {
      // Import ImageUploader's upload logic
      const { invoke } = await import('@tauri-apps/api/core');
      const { tempDir } = await import('@tauri-apps/api/path');
      const { writeFile } = await import('@tauri-apps/plugin-fs');

      // Convert File to ArrayBuffer, then to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Get temp directory and create temp file path
      const tempDirPath = await tempDir();
      const tempFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const fullPath = `${tempDirPath}${tempFilename}`;

      // Write the file data to temp directory
      await writeFile(fullPath, uint8Array);

      // Upload to Cloudflare Images
      const result = await invoke<{ success: boolean; cloudflare_id?: string; image_url?: string; error?: string }>('upload_image_to_cloudflare', {
        filePath: fullPath,
        filename: file.name,
      });

      if (!result.success || !result.image_url) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update logo URL in form data
      updateField('logoUrl', result.image_url);
      console.log('[RestaurantSettings] Logo uploaded successfully:', result.image_url);
    } catch (error) {
      console.error('[RestaurantSettings] Logo upload failed:', error);
      setLogoUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = () => {
    updateField('logoUrl', '');
  };

  return (
    <SectionCard
      title="Restaurant Logo"
      description="Upload your restaurant logo. This will appear in the header across all pages and on printed receipts (when enabled)"
    >
      <div className="space-y-4">
        {formData.logoUrl ? (
          /* Logo Preview */
          <div className="neo-raised-lg p-4 flex items-center gap-4 border border-accent/20 rounded-lg">
            <img
              src={formData.logoUrl}
              alt="Restaurant Logo"
              className="w-20 h-20 object-contain bg-surface-2 p-2 rounded"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Current Logo</p>
              <p className="text-xs text-muted-foreground mt-1">This logo is active and will be displayed</p>
            </div>
            <button
              type="button"
              onClick={handleLogoRemove}
              className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition-colors flex items-center gap-2 rounded"
              title="Remove logo"
            >
              <X size={16} />
              Remove
            </button>
          </div>
        ) : (
          /* Upload Button */
          <label className="card-interactive p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-muted hover:border-accent cursor-pointer transition-colors rounded-lg">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              disabled={uploadingLogo}
            />
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
              <Upload className="w-6 h-6 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {uploadingLogo ? 'Uploading...' : 'Click to upload logo'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, or SVG (max 5MB)
              </p>
            </div>
          </label>
        )}

        {logoUploadError && (
          <div className="neo-raised bg-destructive/10 border border-destructive/30 p-3 rounded-lg">
            <p className="text-sm text-destructive">{logoUploadError}</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

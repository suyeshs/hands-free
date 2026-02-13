/**
 * Image Uploader Component
 * Handles both single and bulk image uploads to Cloudflare Images
 * Uses Tauri commands for local-first image upload
 * Automatically matches photos to menu items using fuzzy logic
 */

import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { tempDir } from '@tauri-apps/api/path';
import { writeFile } from '@tauri-apps/plugin-fs';

interface UploadedImage {
  id: string;
  cloudflareImageId: string;
  filename: string;
  imageUrl: string;
  uploadedAt: string;
}

interface ImageUploaderProps {
  tenantId: string;
  mode: 'single' | 'bulk';
  onUploadComplete?: (images: UploadedImage[]) => void;
  onSingleUpload?: (imageUrl: string) => void;
  enableFuzzyMatching?: boolean; // Enable automatic fuzzy matching
}

interface CloudflareUploadResponse {
  success: boolean;
  cloudflare_id?: string;
  image_url?: string;
  error?: string;
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
  similarityScore?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  tenantId,
  mode,
  onUploadComplete,
  onSingleUpload,
  enableFuzzyMatching = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToCloudflare = async (file: File): Promise<{ url: string; id: string }> => {
    // Convert File to ArrayBuffer, then to Uint8Array for Tauri
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Get temp directory and create temp file path
    const tempDirPath = await tempDir();
    const tempFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fullPath = `${tempDirPath}${tempFilename}`;

    console.log('[ImageUploader] Writing temp file:', fullPath);

    // Write the file data to temp directory
    await writeFile(fullPath, uint8Array);

    // Call Tauri command to upload to Cloudflare
    const result = await invoke<CloudflareUploadResponse>('upload_image_to_cloudflare', {
      filePath: fullPath,
      filename: file.name,
    });

    if (!result.success || !result.cloudflare_id || !result.image_url) {
      throw new Error(result.error || 'Upload failed');
    }

    return {
      url: result.image_url,
      id: result.cloudflare_id,
    };
  };

  const storeInLocalDatabase = async (cloudflareImageId: string, imageUrl: string, filename: string) => {
    // Store in local SQLite database instead of backend API
    const { initDatabase } = await import('../../lib/database');
    const db = await initDatabase();

    const id = `unassigned-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO unassigned_images (id, tenant_id, cloudflare_image_id, filename, image_url, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, cloudflareImageId, filename, imageUrl, now]
    );

    return id;
  };

  const matchPhotosToMenu = async (photos: Array<{ cloudflareId: string; filename: string }>) => {
    setMatching(true);
    setError(null);

    try {
      console.log(`[ImageUploader] Starting fuzzy matching for ${photos.length} photos...`);

      // Call tenant worker fuzzy matching endpoint
      const response = await fetch(`https://${tenantId}.handsfree-tenants.workers.dev/menu/upload-photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({ photos }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Photo matching failed');
      }

      const result = await response.json();
      const { matched, unmatched } = result.results;

      setMatchResults([...matched, ...unmatched]);

      console.log(`[ImageUploader] Matching complete: ${matched.length} matched, ${unmatched.length} unmatched`);

      // Update local database for unmatched images
      if (unmatched.length > 0) {
        for (const unmatchedPhoto of unmatched) {
          await storeInLocalDatabase(
            unmatchedPhoto.imageId,
            unmatchedPhoto.imageUrl,
            unmatchedPhoto.filename
          );
        }
      }

      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(uploadedImages);
      }

    } catch (err) {
      console.error('[ImageUploader] Matching error:', err);
      setError(err instanceof Error ? err.message : 'Photo matching failed');

      // If matching fails, store all in local database as unassigned
      for (const photo of photos) {
        const existing = uploadedImages.find(img => img.cloudflareImageId === photo.cloudflareId);
        if (existing) {
          await storeInLocalDatabase(
            existing.cloudflareImageId,
            existing.imageUrl,
            existing.filename
          );
        }
      }
    } finally {
      setMatching(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    setMatchResults([]);

    const uploaded: UploadedImage[] = [];

    try {
      const fileArray = Array.from(files);

      // Step 1: Upload to Cloudflare
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        console.log(`[ImageUploader] Uploading ${i + 1}/${fileArray.length}: ${file.name}`);

        // Upload to Cloudflare Images via Tauri
        const { url, id } = await uploadToCloudflare(file);

        uploaded.push({
          id: `temp-${id}`,
          cloudflareImageId: id,
          filename: file.name,
          imageUrl: url,
          uploadedAt: new Date().toISOString(),
        });

        setUploadProgress(Math.round(((i + 1) / fileArray.length) * 100));
      }

      setUploadedImages(uploaded);
      console.log(`[ImageUploader] Uploaded ${fileArray.length} images successfully`);

      // Step 2: Automatic fuzzy matching (bulk mode only)
      if (mode === 'bulk' && enableFuzzyMatching && uploaded.length > 0) {
        const photos = uploaded.map(img => ({
          cloudflareId: img.cloudflareImageId,
          filename: img.filename,
        }));

        await matchPhotosToMenu(photos);
      } else if (mode === 'single' && onSingleUpload) {
        // Single mode - return URL directly
        onSingleUpload(uploaded[0].imageUrl);
      } else {
        // No fuzzy matching - store all in local database
        for (const img of uploaded) {
          await storeInLocalDatabase(img.cloudflareImageId, img.imageUrl, img.filename);
        }
        if (onUploadComplete) {
          onUploadComplete(uploaded);
        }
      }

    } catch (err) {
      console.error('[ImageUploader] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="image-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={mode === 'bulk'}
        onChange={handleFileSelect}
        disabled={uploading || matching}
        className="hidden"
        id="image-upload-input"
      />

      <label
        htmlFor="image-upload-input"
        className={`
          inline-flex items-center justify-center px-4 py-2
          font-medium cursor-pointer transition-colors
          ${uploading || matching
            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }
        `}
      >
        {uploading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading... {uploadProgress}%
          </>
        ) : matching ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Matching photos...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {mode === 'bulk' ? 'Upload & Match Images' : 'Upload Image'}
          </>
        )}
      </label>

      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Match Results */}
      {mode === 'bulk' && matchResults.length > 0 && (
        <div className="mt-4 space-y-4">
          {/* Matched Photos */}
          {matchResults.filter(r => r.matched).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-2">
                ✓ Auto-Assigned ({matchResults.filter(r => r.matched).length})
              </h3>
              <div className="space-y-2">
                {matchResults.filter(r => r.matched).map((result, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded">
                    <img
                      src={result.imageUrl}
                      alt={result.filename}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {result.filename}
                      </p>
                      <p className="text-xs text-green-700">
                        → {result.matchedItem?.name} ({(result.similarityScore! * 100).toFixed(0)}% match)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched Photos */}
          {matchResults.filter(r => !r.matched).length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded p-4">
              <h3 className="text-sm font-semibold text-orange-900 mb-2">
                ⚠ Needs Manual Assignment ({matchResults.filter(r => !r.matched).length})
              </h3>
              <div className="space-y-2">
                {matchResults.filter(r => !r.matched).map((result, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded">
                    <img
                      src={result.imageUrl}
                      alt={result.filename}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {result.filename}
                      </p>
                      <p className="text-xs text-orange-700">
                        {result.error}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-orange-700">
                These images were saved to "Unassigned Images" for manual assignment.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Legacy upload display (when fuzzy matching disabled) */}
      {mode === 'bulk' && uploadedImages.length > 0 && matchResults.length === 0 && !matching && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">
            Uploaded {uploadedImages.length} images to pool
          </p>
          <div className="grid grid-cols-4 gap-2">
            {uploadedImages.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={img.imageUrl}
                  alt={img.filename}
                  className="w-full h-24 object-cover rounded"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                  {img.filename}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

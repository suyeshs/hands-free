'use client';

import { useState, useRef, useEffect } from 'react';

interface LogoUploadProps {
  currentLogo?: string | null;
  onLogoChange?: (logoUrl: string | null) => void;
}

export function LogoUpload({ currentLogo, onLogoChange }: LogoUploadProps) {
  const [logo, setLogo] = useState<string | null>(currentLogo || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current logo on mount
  useEffect(() => {
    if (!currentLogo) {
      fetchCurrentLogo();
    }
  }, []);

  const fetchCurrentLogo = async () => {
    try {
      const response = await fetch('/api/admin/logo');
      if (response.ok) {
        const data = await response.json() as { logoUrl?: string };
        if (data.logoUrl) {
          setLogo(data.logoUrl);
        }
      }
    } catch (err) {
      console.error('Failed to fetch logo:', err);
    }
  };

  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please upload a JPEG, PNG, WebP, or SVG image.';
    }

    if (file.size > maxSize) {
      return 'File too large. Maximum size is 5MB.';
    }

    return null;
  };

  const handleUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json() as { success: boolean; logoUrl?: string; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setLogo(data.logoUrl || null);
      setSuccess(true);
      onLogoChange?.(data.logoUrl || null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Logo upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/logo', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove logo');
      }

      setLogo(null);
      onLogoChange?.(null);
    } catch (err) {
      console.error('Logo removal failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Logo Preview */}
      {logo && (
        <div className="relative inline-block">
          <div className="w-32 h-32 neu-convex rounded-xl overflow-hidden flex items-center justify-center bg-white">
            <img
              src={logo}
              alt="Restaurant logo"
              className="w-full h-full object-contain p-2"
            />
          </div>
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
            title="Remove logo"
          >
            <span className="text-sm font-bold">X</span>
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative neu-convex rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200 hover:shadow-lg
          ${dragActive ? 'ring-4 ring-neu-accent shadow-xl' : ''}
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center py-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-neu-accent border-t-transparent mb-3"></div>
            <p className="text-sm font-medium text-neu-text">
              Uploading logo...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <span className="text-4xl mb-3">{logo ? '🔄' : '📤'}</span>
            <p className="text-sm font-medium text-neu-text mb-1">
              {logo ? 'Click to upload a new logo' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-neu-text-secondary">
              JPEG, PNG, WebP, or SVG (max 5MB)
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          <span>!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
          <span>✓</span>
          <span>Logo uploaded successfully!</span>
        </div>
      )}

      {/* Tips */}
      <div className="text-xs text-neu-text-secondary space-y-1">
        <p className="font-medium">Tips for best results:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Use a square or circular logo for best display</li>
          <li>PNG with transparent background works best</li>
          <li>Minimum recommended size: 200x200 pixels</li>
        </ul>
      </div>
    </div>
  );
}

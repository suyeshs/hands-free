'use client';

import React, { useState } from 'react';
import { useSetup } from '@/app/contexts/SetupContext';

/**
 * Step 4: Menu (Optional)
 * Allows optional menu file upload or skip
 */
export function Step4Menu() {
  const { setupState, updateSetupState } = useSetup();
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!validTypes.includes(file.type)) {
      setUploadStatus('error');
      alert('Please upload a PDF, Excel, or CSV file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadStatus('error');
      alert('File size must be less than 10MB');
      return;
    }

    // Store file in state
    updateSetupState({ menuFile: file });
    setUploadStatus('success');
  };

  const handleRemoveFile = () => {
    updateSetupState({ menuFile: null, menuItems: [] });
    setUploadStatus('idle');
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Upload Menu File
        </label>
        <p className="text-xs text-neu-text-secondary mb-4">
          Optional: Upload your menu as a PDF, Excel, or CSV file. You can also add menu items manually later from the admin dashboard.
        </p>

        {!setupState.menuFile ? (
          <div className="neu-convex rounded-xl p-8 text-center">
            <span className="text-6xl mb-4 block">📄</span>
            <label
              htmlFor="menu-upload"
              className="neu-button neu-button-accent inline-block cursor-pointer px-6 py-3 rounded-xl font-semibold"
            >
              Choose File
            </label>
            <input
              id="menu-upload"
              type="file"
              accept=".pdf,.xls,.xlsx,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-neu-text-secondary mt-3">
              Supported formats: PDF, Excel, CSV (Max 10MB)
            </p>
          </div>
        ) : (
          <div className="neu-flat rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">📄</span>
                <div>
                  <p className="text-sm font-semibold text-neu-text">
                    {setupState.menuFile.name}
                  </p>
                  <p className="text-xs text-neu-text-secondary">
                    {(setupState.menuFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="neu-button px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100"
              >
                Remove
              </button>
            </div>

            {uploadStatus === 'success' && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  ✓ File ready to upload. Menu will be processed after activation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Skip Option */}
      <div className="neu-flat rounded-xl p-6 text-center">
        <span className="text-4xl mb-3 block">⏭️</span>
        <h4 className="font-bold text-lg text-neu-text mb-2">
          Skip for Now
        </h4>
        <p className="text-sm text-neu-text-secondary mb-4">
          You can add menu items later from the admin dashboard. You'll have full control over:
        </p>
        <ul className="text-xs text-neu-text-secondary text-left space-y-2 max-w-md mx-auto">
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Manual menu entry with descriptions and prices</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Photo uploads for menu items</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Category organization</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span>Dietary tags (veg, non-veg, vegan, gluten-free)</span>
          </li>
        </ul>
      </div>

      {/* Info Box */}
      <div className="p-4 neu-convex rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h5 className="font-semibold text-sm text-neu-text mb-1">
              Note
            </h5>
            <p className="text-xs text-neu-text-secondary">
              This step is completely optional. You can activate your restaurant without a menu and add items later. The voice AI will inform customers that you're still setting up your menu.
            </p>
          </div>
        </div>
      </div>

      {/* No validation needed - this step is optional */}
      <div className="flex items-center gap-2 px-4 py-3 neu-flat rounded-xl">
        <span className="text-2xl">ℹ️</span>
        <span className="text-sm font-semibold text-neu-text">
          Step 4 is Optional
        </span>
      </div>
    </div>
  );
}

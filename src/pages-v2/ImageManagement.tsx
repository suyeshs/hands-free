/**
 * Image Management Page
 * Manage image library and assign images to menu items
 */

import React from 'react';
import { UnassignedImagesManager } from '../components/admin/UnassignedImagesManager';
import { useTenantStore } from '../stores/tenantStore';
import { useAuthStore } from '../stores/authStore';

export const ImageManagement: React.FC = () => {
  const { tenant } = useTenantStore();
  const { user } = useAuthStore();
  const tenantId = tenant?.tenantId || user?.tenantId;

  // Debug logging
  console.log('[ImageManagement] Tenant from store:', tenant);
  console.log('[ImageManagement] User from auth:', user);
  console.log('[ImageManagement] Using tenantId:', tenantId);

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Setup Required</h2>
          <p className="text-gray-600">
            Please complete restaurant setup first to access image management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Image Management</h1>
              <p className="text-sm text-white/70">Upload and assign images to menu items</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg p-6">
          <UnassignedImagesManager
            tenantId={tenantId}
            onImageAssigned={() => {
              console.log('[ImageManagement] Image assigned successfully');
            }}
          />
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">How it works</h3>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">1.</span>
              <span>Click "Upload Images (Bulk)" to upload multiple images at once to Cloudflare Images</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">2.</span>
              <span>Images are stored in your "Unassigned Images" pool with CDN delivery</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">3.</span>
              <span>Click "Assign" on any image to link it to a menu item</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">4.</span>
              <span>Once assigned, the image is automatically displayed in your menu</span>
            </li>
          </ol>

          <div className="mt-4 p-3 bg-white border border-blue-300">
            <p className="text-xs text-blue-700">
              <strong>Pro Tip:</strong> Upload all your menu photos at once, then assign them to items as needed. Images are stored permanently on Cloudflare's CDN for fast delivery worldwide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageManagement;

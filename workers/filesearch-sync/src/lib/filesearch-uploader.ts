/**
 * File Search Uploader - Handles uploads to Google File Search
 */

import type { Env, FileSearchUploadResponse } from '../types';

/**
 * Upload menu document to Google File Search via backend API
 */
export async function uploadToFileSearch(
  env: Env,
  tenantId: string,
  menuDocument: string
): Promise<FileSearchUploadResponse> {
  const backendUrl = env.BACKEND_URL || 'https://stonepot-restaurant-334610188311.us-central1.run.app';

  try {
    console.log(`[FileSearchUploader] Uploading menu for tenant: ${tenantId}`);
    console.log(`[FileSearchUploader] Document size: ${menuDocument.length} bytes`);

    // Create form data
    const formData = new FormData();
    const blob = new Blob([menuDocument], { type: 'text/plain' });
    formData.append('file', blob, `menu-${tenantId}.txt`);
    formData.append('tenantId', tenantId);

    // Upload to backend File Search endpoint
    const uploadUrl = `${backendUrl}/api/admin/menu/upload-to-file-search`;
    console.log(`[FileSearchUploader] Uploading to: ${uploadUrl}`);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.json() as FileSearchUploadResponse;

    console.log(`[FileSearchUploader] Upload successful:`, {
      storeName: result.storeName,
      filename: result.filename
    });

    return result;

  } catch (error) {
    console.error('[FileSearchUploader] Upload failed:', error);
    throw new Error(
      `File Search upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Verify File Search is accessible (health check)
 */
export async function healthCheckFileSearch(env: Env): Promise<boolean> {
  const backendUrl = env.BACKEND_URL || 'https://stonepot-restaurant-334610188311.us-central1.run.app';

  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    return response.ok;
  } catch (error) {
    console.error('[FileSearchUploader] Health check failed:', error);
    return false;
  }
}

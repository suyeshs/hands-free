/**
 * R2 Uploader - Multipart Upload to Cloudflare R2
 * Matches web client implementation for large file uploads
 */

import { tauriFetch as rustTauriFetch } from './tauriFetch';
import { getCurrentPlatform } from './platform';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_RETRIES = 3;

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  uploadedChunks?: number;
  totalChunks?: number;
}

interface InitiateUploadResponse {
  success: boolean;
  uploadId: string;
  r2Key: string;
  bucketName: string;
  isShared: boolean;
  filename: string;
  expiresIn: number;
  error?: string;
}

interface UploadPartResponse {
  success: boolean;
  partNumber: number;
  etag: string;
  error?: string;
}

// Helper to get fetch implementation
async function getFetch() {
  const platform = getCurrentPlatform();

  // Use our custom Rust-based fetch in Tauri (bypasses streamChannel bug)
  if (platform === 'tauri') {
    return rustTauriFetch;
  }

  // Use browser fetch on web
  return fetch;
}


export class R2Uploader {
  private onProgress?: (progress: UploadProgress) => void;
  private apiBaseUrl: string;

  constructor(tenantId: string, onProgress?: (progress: UploadProgress) => void) {
    // Use restaurant-client directly (restaurant worker has no HTTP routes configured)
    // Restaurant-client is a Next.js app that accepts direct HTTPS requests
    this.apiBaseUrl = `https://handsfree-restaurant-client.suyesh.workers.dev`;

    console.log('[R2Uploader] Using API base URL:', this.apiBaseUrl, 'for tenant:', tenantId);

    this.onProgress = onProgress;
  }

  /**
   * Upload file to R2 using multipart upload
   */
  async uploadFile(
    file: File,
    tenantId: string
  ): Promise<{
    success: boolean;
    r2Key?: string;
    bucketName?: string;
    isShared?: boolean;
    error?: string;
  }> {
    const customFetch = await getFetch();

    try {
      // Step 1: Initiate multipart upload
      console.log('[R2Uploader] Initiating upload for:', file.name, 'Size:', file.size);

      const initiateResponse = await customFetch(`${this.apiBaseUrl}/api/r2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({
          tenantId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });

      console.log('[R2Uploader] Initiate response status:', initiateResponse.status);

      const initiateResult = await initiateResponse.json();

      if (!initiateResponse.ok) {
        throw new Error(`Failed to initiate upload: ${typeof initiateResult === 'string' ? initiateResult : JSON.stringify(initiateResult)}`);
      }

      const { uploadId, r2Key, bucketName, isShared } = initiateResult as InitiateUploadResponse;

      console.log('[R2Uploader] Upload initiated:', { uploadId, r2Key });

      // Step 2: Upload file in chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadedParts: { partNumber: number; etag: string }[] = [];

      for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const uploadedPart = await this.uploadChunkWithRetry(
          customFetch,
          r2Key,
          uploadId,
          partNumber,
          chunk,
          tenantId
        );

        uploadedParts.push(uploadedPart);

        // Report progress
        if (this.onProgress) {
          this.onProgress({
            loaded: end,
            total: file.size,
            percentage: Math.round((end / file.size) * 100),
            uploadedChunks: partNumber,
            totalChunks,
          });
        }
      }

      // Step 3: Complete multipart upload
      const completeResponse = await customFetch(`${this.apiBaseUrl}/api/r2`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({
          r2Key,
          uploadId,
          parts: uploadedParts,
        }),
      });

      const completeResult = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(`Failed to complete upload: ${typeof completeResult === 'string' ? completeResult : JSON.stringify(completeResult)}`);
      }

      console.log('[R2Uploader] Upload complete:', r2Key);

      return {
        success: true,
        r2Key,
        bucketName,
        isShared,
      };
    } catch (error) {
      console.error('[R2Uploader] Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload a single chunk with retry logic
   */
  private async uploadChunkWithRetry(
    customFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    r2Key: string,
    uploadId: string,
    partNumber: number,
    chunk: Blob,
    tenantId: string
  ): Promise<{ partNumber: number; etag: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Convert Blob to Uint8Array to avoid Tauri fetch_read_body streamChannel error
        const arrayBuffer = await chunk.arrayBuffer();
        const requestBody = new Uint8Array(arrayBuffer);

        const response = await customFetch(
          `${this.apiBaseUrl}/api/r2?key=${encodeURIComponent(r2Key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
          {
            method: 'PUT',
            headers: {
              'X-Tenant-ID': tenantId,
              // Content-Length is helpful for some backends when using raw bytes
              'Content-Length': requestBody.length.toString(),
            },
            body: requestBody,
          }
        );

        if (!response.ok) {
          throw new Error(`Upload chunk ${partNumber} failed: ${response.status}`);
        }

        const result = await response.json() as UploadPartResponse;
        return {
          partNumber: result.partNumber,
          etag: result.etag,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[R2Uploader] Chunk ${partNumber} upload attempt ${attempt} failed:`, lastError.message);

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw new Error(
      `Failed to upload chunk ${partNumber} after ${MAX_RETRIES} attempts: ${lastError?.message}`
    );
  }
}

/**
 * Parse uploaded file with AI (WITHOUT saving to D1)
 * Returns parsed items for review before saving
 */
export async function parseFileFromR2(
  tenantId: string,
  r2Key: string,
  filename: string,
  mimeType: string
): Promise<{
  success: boolean;
  items: any[];
  summary?: {
    total: number;
    byType: Record<string, number>;
    withWarnings: number;
  };
  message?: string;
  error?: string;
}> {
  const customFetch = await getFetch();

  // Call restaurant-client API directly for parsing (no tenant routing needed)
  // Menu is stored locally in SQLite after parsing, so we just need the AI parsing service
  const restaurantClientUrl = 'https://handsfree-restaurant-client.suyesh.workers.dev';
  const apiUrl = `${restaurantClientUrl}/api/admin/menu/parse-from-r2`;

  console.log('[parseFileFromR2] Using restaurant-client parse API:', apiUrl);

  try {
    // Get auth token from localStorage for authenticated request
    const authStorage = localStorage.getItem('auth-storage');
    let authToken: string | null = null;

    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        authToken = parsed.state?.tokens?.accessToken || null;
      } catch {
        // Ignore JSON parse errors
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,  // Pass tenant ID in header for backend
    };

    // Add Bearer token if available
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // TEMPORARY: Skip auth validation for development
    // TODO: Set up proper admin API key in production
    headers['X-Skip-Auth'] = 'true';

    const response = await customFetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenantId,  // Also pass in body for backward compatibility
        r2Key,
        filename,
        mimeType,
      }),
    });

    console.log('[parseFileFromR2] Response status:', response.status);
    console.log('[parseFileFromR2] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Try to get response text first to see what we got
      const responseText = await response.text();
      console.error('[parseFileFromR2] Error response body:', responseText.substring(0, 500));

      // Try to parse as JSON if possible
      try {
        const error = JSON.parse(responseText) as { error?: string; message?: string };
        throw new Error(error.message || error.error || `HTTP ${response.status}: Parsing failed`);
      } catch (jsonError) {
        // Not JSON, return the status and text preview
        throw new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
      }
    }

    const result = await response.json();
    console.log('[parseFileFromR2] Success! Parsed', result.items?.length || 0, 'items');

    return {
      success: true,
      items: result.items || [],
      summary: result.summary,
      message: result.message,
    };
  } catch (error) {
    console.error('[parseFileFromR2] Parsing failed:', error);
    return {
      success: false,
      items: [],
      error: error instanceof Error ? error.message : 'Parsing failed',
    };
  }
}

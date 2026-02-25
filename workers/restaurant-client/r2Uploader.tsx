/**
 * R2 Uploader - Client-side multipart upload handler
 * Uses Next.js API routes for R2 multipart uploads
 */

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

interface CompleteUploadResponse {
  success: boolean;
  r2Key: string;
  etag: string;
  error?: string;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_RETRIES = 3;

export default class R2Uploader {
  private onProgress?: (progress: UploadProgress) => void;

  constructor(_url: string, onProgress?: (progress: UploadProgress) => void) {
    this.onProgress = onProgress;
  }

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
    try {
      // Step 1: Initiate multipart upload
      const initiateResponse = await fetch('/api/r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });

      if (!initiateResponse.ok) {
        const errorData = await initiateResponse.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to initiate upload');
      }

      const { uploadId, r2Key, bucketName, isShared } = await initiateResponse.json() as InitiateUploadResponse;

      // Step 2: Upload file in chunks
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadedParts = [];

      for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk with retry logic
        const uploadedPart = await this.uploadChunkWithRetry(
          r2Key,
          uploadId,
          partNumber,
          chunk
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
      const completeResponse = await fetch('/api/r2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r2Key,
          uploadId,
          parts: uploadedParts,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to complete upload');
      }

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

  private async uploadChunkWithRetry(
    r2Key: string,
    uploadId: string,
    partNumber: number,
    chunk: Blob
  ): Promise<{ partNumber: number; etag: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(
          `/api/r2?key=${encodeURIComponent(r2Key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
          {
            method: 'PUT',
            body: chunk,
          }
        );

        if (!response.ok) {
          const errorData = await response.json() as { error?: string };
          throw new Error(errorData.error || `Upload failed with status ${response.status}`);
        }

        const result = await response.json() as UploadPartResponse;
        return {
          partNumber: result.partNumber,
          etag: result.etag,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[R2Uploader] Chunk ${partNumber} upload attempt ${attempt} failed:`, error);

        if (attempt < MAX_RETRIES) {
          // Exponential backoff
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

  async upload(file: File): Promise<string> {
    // Legacy method for backwards compatibility
    const result = await this.uploadFile(file, 'demo');
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }
    return result.r2Key || '';
  }
}

/**
 * R2 Direct Upload Worker API
 * Handles presigned URL generation for browser-to-R2 direct uploads
 * Bypasses Cloud Run's 32MB HTTP limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Extend CloudflareEnv to include our custom bindings
declare global {
  interface CloudflareEnv {
    MENU_UPLOADS_BUCKET: R2Bucket;
    TENANT_METADATA: KVNamespace;
    R2_UPLOAD_EXPIRY?: string;
    R2_MAX_FILE_SIZE?: string;
  }
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'image/png',
  'image/jpeg',
  'image/webp',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const UPLOAD_EXPIRY = 3600; // 1 hour

/**
 * Get tenant-specific R2 bucket from TENANT_METADATA
 * Falls back to shared bucket if tenant metadata not found
 */
async function getTenantR2Bucket(env: CloudflareEnv, tenantId: string): Promise<{ bucket: R2Bucket; bucketName: string; isShared: boolean }> {
  try {
    // Try to get tenant metadata from KV
    if (env.TENANT_METADATA) {
      const tenantData = await env.TENANT_METADATA.get(`tenant:${tenantId}`, 'json') as any;

      // FIX: Domain service stores as r2_bucket_name (snake_case), not storage.r2BucketName
      const bucketName = tenantData?.r2_bucket_name;

      if (bucketName) {
        console.log(`[R2] Using tenant-specific bucket: ${bucketName} for tenant: ${tenantId}`);

        // Access the tenant-specific R2 bucket via binding
        // Note: Cloudflare Workers don't support dynamic R2 bucket access
        // For now, we use the shared bucket with tenant prefixing
        // TODO: Implement proper multi-bucket support or use R2 API

        return {
          bucket: env.MENU_UPLOADS_BUCKET,
          bucketName: bucketName,
          isShared: true // Temporarily using shared bucket with prefix
        };
      }

      // Note: r2_bucket_name will be null when provisionStorage: false (hybrid multi-tenancy)
      console.log(`[R2] Tenant ${tenantId} has no dedicated bucket (hybrid multi-tenancy), using shared bucket`);
    }
  } catch (error) {
    console.warn(`[R2] Failed to fetch tenant metadata for ${tenantId}, falling back to shared bucket:`, error);
  }

  // Fallback to shared bucket
  console.log(`[R2] Using shared/fallback bucket for tenant: ${tenantId}`);
  return {
    bucket: env.MENU_UPLOADS_BUCKET,
    bucketName: 'handsfree-menu-uploads',
    isShared: true
  };
}

/**
 * POST /api/r2/initiate-multipart
 * Start a multipart upload and return uploadId + r2Key
 */
export async function POST(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();

    const body = await request.json() as { tenantId: string, filename: string, mimeType: string, fileSize?: number };
    const { tenantId, filename, mimeType, fileSize } = body;

    // Validation
    if (!tenantId || !filename || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, filename, mimeType' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Invalid file type: ${mimeType}` },
        { status: 400 }
      );
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size ${fileSize} exceeds maximum of ${MAX_FILE_SIZE}` },
        { status: 400 }
      );
    }

    // Get tenant-specific R2 bucket (or fallback to shared)
    const { bucket, bucketName, isShared } = await getTenantR2Bucket(env, tenantId);

    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 bucket not configured' },
        { status: 500 }
      );
    }

    // Generate unique R2 key with tenant isolation
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // If using shared bucket, include tenant prefix; otherwise, tenant-specific bucket
    const r2Key = isShared
      ? `tenants/${tenantId}/uploads/${timestamp}-${sanitizedFilename}`
      : `uploads/${timestamp}-${sanitizedFilename}`;

    // Create multipart upload
    const multipartUpload = await (bucket as any).createMultipartUpload(r2Key);

    console.log(`[R2] Initiated multipart upload: ${r2Key}, uploadId: ${multipartUpload.uploadId}, bucket: ${bucketName}`);

    return NextResponse.json({
      success: true,
      uploadId: multipartUpload.uploadId,
      r2Key,
      bucketName,
      isShared,
      filename: sanitizedFilename,
      expiresIn: UPLOAD_EXPIRY,
    });
  } catch (error) {
    console.error('[R2] Initiate multipart error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate upload' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/r2/upload-part
 * Upload a single part of the multipart upload
 *
 * Note: R2Bucket type definitions don't include multipart methods,
 * but they exist at runtime. Using type assertion as workaround.
 */
export async function PUT(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const bucket = env.MENU_UPLOADS_BUCKET as any;

    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 bucket not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const r2Key = searchParams.get('key');
    const uploadId = searchParams.get('uploadId');
    const partNumber = searchParams.get('partNumber');

    if (!r2Key || !uploadId || !partNumber) {
      return NextResponse.json(
        { error: 'Missing required parameters: key, uploadId, partNumber' },
        { status: 400 }
      );
    }

    // Get the part data from request body
    const partData = await request.arrayBuffer();

    // Resume the multipart upload to get the upload object
    const multipartUpload = bucket.resumeMultipartUpload(r2Key, uploadId);

    // Upload the part
    const uploadedPart = await multipartUpload.uploadPart(parseInt(partNumber), partData);

    return NextResponse.json({
      success: true,
      partNumber: parseInt(partNumber),
      etag: uploadedPart.etag,
    });
  } catch (error) {
    console.error('[R2] Upload part error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload part' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/r2/complete-multipart
 * Complete the multipart upload
 *
 * Note: R2Bucket type definitions don't include multipart methods,
 * but they exist at runtime. Using type assertion as workaround.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const bucket = env.MENU_UPLOADS_BUCKET as any;

    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 bucket not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as { r2Key: string, uploadId: string, parts: any[] };
    const { r2Key, uploadId, parts } = body;

    if (!r2Key || !uploadId || !parts) {
      return NextResponse.json(
        { error: 'Missing required fields: r2Key, uploadId, parts' },
        { status: 400 }
      );
    }

    // Resume the multipart upload to get the upload object
    const multipartUpload = bucket.resumeMultipartUpload(r2Key, uploadId);

    // Complete the multipart upload
    const completedUpload = await multipartUpload.complete(parts);

    console.log(`[R2] Completed multipart upload: ${r2Key}`);

    return NextResponse.json({
      success: true,
      r2Key,
      etag: completedUpload.etag,
    });
  } catch (error) {
    console.error('[R2] Complete multipart error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete upload' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/r2/abort-multipart
 * Abort a failed multipart upload
 *
 * Note: R2Bucket type definitions don't include multipart methods,
 * but they exist at runtime. Using type assertion as workaround.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { env } = getCloudflareContext();
    const bucket = env.MENU_UPLOADS_BUCKET as any;

    if (!bucket) {
      return NextResponse.json(
        { error: 'R2 bucket not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const r2Key = searchParams.get('key');
    const uploadId = searchParams.get('uploadId');

    if (!r2Key || !uploadId) {
      return NextResponse.json(
        { error: 'Missing required parameters: key, uploadId' },
        { status: 400 }
      );
    }

    // Resume the multipart upload to get the upload object
    const multipartUpload = bucket.resumeMultipartUpload(r2Key, uploadId);

    // Abort the multipart upload
    await multipartUpload.abort();

    console.log(`[R2] Aborted multipart upload: ${r2Key}`);

    return NextResponse.json({
      success: true,
      message: 'Upload aborted successfully',
    });
  } catch (error) {
    console.error('[R2] Abort multipart error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to abort upload' },
      { status: 500 }
    );
  }
}

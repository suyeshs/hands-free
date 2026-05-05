/**
 * Cloudflare Images Upload API
 * Uploads images directly to Cloudflare Images service
 */

import { NextRequest, NextResponse } from 'next/server';

// Cloudflare Images configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '0f3287b287060e3215662501ee96292e';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'PEjPQStb94cuLh-Wor0yG59NCLE5WS6Js5DrBsfi';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/cfupload
 * Upload an image to Cloudflare Images
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          errors: ['No file uploaded']
        },
        { status: 400 }
      );
    }

    // Validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          errors: [`Invalid file type: ${file.type}`]
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          errors: [`File size ${file.size} exceeds maximum of ${MAX_FILE_SIZE}`]
        },
        { status: 400 }
      );
    }

    console.log(`[Cloudflare Upload] Uploading file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Upload to Cloudflare Images
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const uploadResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: uploadFormData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Cloudflare Upload] Upload failed:', errorText);
      return NextResponse.json(
        {
          success: false,
          errors: [`Upload failed: ${uploadResponse.status} ${errorText}`]
        },
        { status: uploadResponse.status }
      );
    }

    const result = await uploadResponse.json() as any;
    console.log(`[Cloudflare Upload] Successfully uploaded: ${result.result?.id}`);

    return NextResponse.json({
      success: true,
      result: {
        id: result.result?.id,
        filename: file.name,
        uploaded: result.result?.uploaded,
        requireSignedURLs: result.result?.requireSignedURLs || false,
        variants: result.result?.variants || [],
      }
    });
  } catch (error) {
    console.error('[Cloudflare Upload] Error:', error);
    return NextResponse.json(
      {
        success: false,
        errors: [error instanceof Error ? error.message : 'Upload failed']
      },
      { status: 500 }
    );
  }
}

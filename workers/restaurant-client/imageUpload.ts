/**
 * Image Upload Utilities
 * Stub for build compatibility
 */

const CLOUDFLARE_IMAGE_BASE_URL = 'https://imagedelivery.net/12jhjXIVHRTQjCWbyguS5A';

export function getCloudflareImageUrl(cloudflareId: string, variant: string = 'public'): string {
  if (!cloudflareId) {
    return '';
  }
  return `${CLOUDFLARE_IMAGE_BASE_URL}/${cloudflareId}/${variant}`;
}

export async function uploadToCloudflare(file: File, tenantId: string): Promise<{
  success: boolean;
  cloudflareId?: string;
  imageUrl?: string;
  error?: string;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', tenantId);

    const response = await fetch('/api/cfupload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Upload failed: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json() as any;
    const imageId = data.cloudflareId || data.id || data.result?.id;

    if (data.success && imageId) {
      return {
        success: true,
        cloudflareId: imageId,
        imageUrl: getCloudflareImageUrl(imageId),
      };
    }

    return {
      success: false,
      error: data.error || 'Upload failed',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

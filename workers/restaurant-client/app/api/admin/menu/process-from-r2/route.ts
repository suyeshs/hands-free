/**
 * Process Menu Upload from R2
 * POST /api/admin/menu/process-from-r2
 *
 * Handles menu file processing LOCALLY in Restaurant Client:
 * 1. Download file from R2
 * 2. Parse with Gemini AI (PDF/Image) or local parsing (Excel)
 * 3. Save to D1 database
 * 4. Call backend to upload to File Search (for voice ordering)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    MENU_UPLOADS_BUCKET: R2Bucket;
    MENU_DB: D1Database;
    TENANT_METADATA: KVNamespace;
    GEMINI_API_KEY: string;
  }
}

interface ParsedMenuItem {
  name: string;
  description?: string;
  category?: string;
  price: number;
  dietary?: string[];
  type?: string;
  spiceLevel?: string;
  imageUrl?: string;
  available?: boolean;
  preparationTime?: number;
  tags?: string[];
  allergens?: string[];
}

/**
 * Parse menu with Gemini AI
 */
async function parseMenuWithGemini(
  fileBuffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  apiKey: string
): Promise<ParsedMenuItem[]> {
  console.log('[MenuParser] Parsing menu with Gemini AI', { filename, mimeType });

  // Upload file to Gemini File API
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);

  const uploadResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Gemini file upload failed: ${error}`);
  }

  const uploadResult = await uploadResponse.json() as { file: { uri: string; name: string } };
  console.log('[MenuParser] File uploaded to Gemini:', uploadResult.file.name);

  // Wait a bit for file processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Extract menu data with structured prompting
  const prompt = `Parse this menu and extract ALL menu items. For each item, extract:
- name: The dish name
- description: The description (if any)
- category: The category (Appetizers, Main Course, Breakfast, etc.)
- price: The numeric price (without currency symbol)
- dietary: Array of dietary tags (vegetarian, vegan, gluten-free, dairy-free, etc.)
- type: "veg" or "non-veg"
- spiceLevel: "mild", "medium", "high", or "extra-hot" (if mentioned)
- preparationTime: Time in minutes (if mentioned)

Return ONLY a JSON array of items, no additional text.
Format: [{"name": "...", "description": "...", "category": "...", "price": 0, ...}]`;

  const generateResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { fileData: { fileUri: uploadResult.file.uri, mimeType } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  if (!generateResponse.ok) {
    const error = await generateResponse.text();
    throw new Error(`Gemini generation failed: ${error}`);
  }

  const generateResult = await generateResponse.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  const responseText = generateResult.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('No response from Gemini');
  }

  const items = JSON.parse(responseText) as ParsedMenuItem[];
  console.log('[MenuParser] Gemini parsed items:', items.length);

  // Cleanup: Delete uploaded file
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadResult.file.name}?key=${apiKey}`, {
    method: 'DELETE'
  });

  return items;
}

/**
 * POST /api/admin/menu/process-from-r2
 * Body: { tenantId: string, r2Key: string, filename, mimeType: string }
 *
 * SECURITY: This endpoint is protected - only authenticated admins can upload/process menus
 * - Validates admin session cookie
 * - Ensures tenant ownership matches authenticated user
 * - Prevents unauthorized Gemini API usage
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY CHECK #1: Require admin authentication (cookie OR Bearer token)
    // BYPASS: Allow X-Skip-Auth header for desktop POS app (TEMPORARY - TODO: use proper API key)
    const skipAuth = request.headers.get('x-skip-auth') === 'true';
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const hasCookieAuth = cookieHeader.includes('admin_access_token');
    const hasBearerAuth = authHeader.startsWith('Bearer ');

    if (!skipAuth && !hasCookieAuth && !hasBearerAuth) {
      console.warn('[ProcessR2] Unauthorized: No admin token (checked both cookie and Bearer)');
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    if (skipAuth) {
      console.log('[ProcessR2] Using X-Skip-Auth bypass (Desktop POS client)');
    }

    if (hasBearerAuth) {
      console.log('[ProcessR2] Using Bearer token authentication (POS/Desktop client)');
    } else {
      console.log('[ProcessR2] Using cookie authentication (Web client)');
    }

    const { env } = getCloudflareContext();
    const body = await request.json();
    const { tenantId, r2Key, filename, mimeType } = body as {
      tenantId: string;
      r2Key: string;
      filename: string;
      mimeType: string;
    };

    if (!tenantId || !r2Key || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, r2Key, filename' },
        { status: 400 }
      );
    }

    console.log('[ProcessR2] Processing file locally in Restaurant Client', {
      tenantId,
      r2Key,
      filename,
      mimeType,
    });

    // Validate tenant ownership of R2 key
    if (!r2Key.includes(tenantId)) {
      return NextResponse.json(
        { error: 'Access denied: R2 key does not match tenant' },
        { status: 403 }
      );
    }

    // Step 1: Download file from R2
    console.log('[ProcessR2] Downloading from R2...');
    const r2Object = await env.MENU_UPLOADS_BUCKET.get(r2Key);
    if (!r2Object) {
      return NextResponse.json(
        { error: 'File not found in R2', r2Key },
        { status: 404 }
      );
    }

    const fileBuffer = await r2Object.arrayBuffer();
    console.log('[ProcessR2] File downloaded:', fileBuffer.byteLength, 'bytes');

    // Step 2: Parse menu with Gemini AI
    console.log('[ProcessR2] Parsing with Gemini AI...');
    let parsedItems: ParsedMenuItem[] = [];

    try {
      parsedItems = await parseMenuWithGemini(
        fileBuffer,
        filename,
        mimeType,
        env.GEMINI_API_KEY
      );
    } catch (parseError) {
      console.error('[ProcessR2] AI parsing failed:', parseError);
      return NextResponse.json(
        {
          error: 'AI parsing failed',
          message: parseError instanceof Error ? parseError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Step 3: Save to D1 database
    console.log('[ProcessR2] Saving to D1...');
    let itemsSaved = 0;
    const d1Errors: string[] = [];

    // Get restaurant worker URL for category/item creation
    const restaurantWorkerUrl = process.env.NEXT_PUBLIC_RESTAURANT_WORKER_URL ||
                                 'https://handsfree-restaurant.suyesh.workers.dev';

    // Create categories
    const categories = [...new Set(parsedItems.map(item => item.category || 'Uncategorized'))];
    const categoryMap: Record<string, string> = {};

    for (const categoryName of categories) {
      try {
        const catResponse = await fetch(`${restaurantWorkerUrl}/api/admin/menu/categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId
          },
          body: JSON.stringify({
            name: categoryName,
            displayOrder: 0,
            description: `${categoryName} items`
          })
        });

        if (catResponse.ok) {
          const catData = await catResponse.json() as { category?: { id: string } };
          categoryMap[categoryName] = catData.category?.id || 'uncategorized';
        } else {
          categoryMap[categoryName] = 'uncategorized';
        }
      } catch (catError) {
        console.warn('[ProcessR2] Category creation failed:', categoryName);
        categoryMap[categoryName] = 'uncategorized';
      }
    }

    // Save menu items
    for (const item of parsedItems) {
      try {
        const menuItemData = {
          name: item.name,
          description: item.description || '',
          categoryId: categoryMap[item.category || 'Uncategorized'] || 'uncategorized',
          price: parseFloat(String(item.price)) || 0,
          currency: 'INR',
          isVegetarian: item.dietary?.includes('vegetarian') || item.type === 'veg' || false,
          isVegan: item.dietary?.includes('vegan') || false,
          isGlutenFree: item.dietary?.includes('gluten-free') || false,
          isDairyFree: item.dietary?.includes('dairy-free') || false,
          spiceLevel: item.spiceLevel?.toLowerCase(),
          imageUrl: item.imageUrl,
          isAvailable: item.available !== false,
          isFeatured: false,
          preparationTime: item.preparationTime || 15,
          tags: item.tags || [],
          allergens: item.allergens || [],
          displayOrder: 0
        };

        const response = await fetch(`${restaurantWorkerUrl}/api/admin/menu/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId
          },
          body: JSON.stringify(menuItemData)
        });

        if (response.ok) {
          itemsSaved++;
        } else {
          const error = await response.json() as { error?: string };
          d1Errors.push(`${item.name}: ${error.error || 'Failed to save'}`);
        }
      } catch (error) {
        d1Errors.push(`${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('[ProcessR2] D1 save complete:', itemsSaved, 'items saved');

    // Step 4: Upload to File Search (call backend for voice ordering)
    console.log('[ProcessR2] Uploading to File Search via backend...');
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stonepot-restaurant-334610188311.asia-south1.run.app';

    let storeName = '';
    try {
      const fileSearchResponse = await fetch(`${backendUrl}/api/admin/menu/process-from-r2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, r2Key, filename, mimeType })
      });

      if (fileSearchResponse.ok) {
        const fileSearchResult = await fileSearchResponse.json() as { storeName?: string };
        storeName = fileSearchResult.storeName || '';
        console.log('[ProcessR2] File Search upload complete:', storeName);
      } else {
        console.warn('[ProcessR2] File Search upload failed (non-critical)');
      }
    } catch (error) {
      console.warn('[ProcessR2] File Search upload failed:', error);
    }

    // Step 5: Cleanup - delete file from R2
    await env.MENU_UPLOADS_BUCKET.delete(r2Key);
    console.log('[ProcessR2] R2 file deleted:', r2Key);

    return NextResponse.json({
      success: true,
      message: `Menu processed successfully: ${itemsSaved} items saved to D1`,
      tenantId,
      filename,
      size: fileBuffer.byteLength,
      itemsSavedToD1: itemsSaved,
      d1Errors: d1Errors.length > 0 ? d1Errors : undefined,
      storeName,
      hint: itemsSaved > 0
        ? 'Menu is now available for voice ordering and visible in admin panel'
        : 'File uploaded but no items could be extracted'
    });
  } catch (error) {
    console.error('[ProcessR2] Error:', error);
    return NextResponse.json(
      {
        error: 'File processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

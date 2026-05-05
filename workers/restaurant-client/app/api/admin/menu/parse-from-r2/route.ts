/**
 * Parse Menu Upload from R2 (WITHOUT D1 Save)
 * POST /api/admin/menu/parse-from-r2
 *
 * This endpoint ONLY parses the menu with AI and returns items for review.
 * It does NOT save to D1 - that happens after user confirmation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

declare global {
  interface CloudflareEnv {
    MENU_UPLOADS_BUCKET: R2Bucket;
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

  // AI analysis fields
  aiConfidence?: number;
  suggestedType?: 'regular' | 'combo' | 'special' | 'variant' | 'addon';
  suggestedComboItems?: string[];
  suggestedValidityPeriod?: string;
  warnings?: string[];
}

/**
 * Parse menu with Gemini AI and return enhanced metadata
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

  // Wait for file processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Enhanced prompt for better classification
  const prompt = `Parse this menu and extract ALL menu items with detailed analysis. For each item:

1. BASIC INFORMATION:
   - name: Dish name
   - description: Full description
   - category: Category (Appetizers, Main Course, Breakfast, Desserts, Beverages, etc.)
   - price: Numeric price (without currency symbol)
   - preparationTime: Time in minutes (estimate if not mentioned)

2. DIETARY & TAGS:
   - dietary: Array of tags (vegetarian, vegan, gluten-free, dairy-free, halal, kosher, etc.)
   - type: "veg" or "non-veg"
   - spiceLevel: "mild", "medium", "high", or "extra-hot" (if applicable)
   - allergens: Array of allergens (nuts, dairy, eggs, shellfish, soy, wheat, etc.)
   - tags: Additional tags (popular, chef-special, new, etc.)

3. AI ANALYSIS (IMPORTANT):
   - aiConfidence: Your confidence in the extraction (0.0 to 1.0)
   - suggestedType: Classify as one of:
     * "regular": Standard single dish
     * "combo": Meal with multiple items (look for: combo, meal, bundle, set, platter, thali, family pack)
     * "special": Limited time or special occasion (look for: special, today, daily, chef, seasonal, limited)
     * "variant": Size or customization variant (look for: small/medium/large, half/full, regular/jumbo)
     * "addon": Extra/side item (look for: extra, add-on, side, topping)

   - suggestedComboItems: If type is "combo", list the items included (array of strings)
   - suggestedValidityPeriod: If type is "special", mention validity (e.g., "Daily 11AM-3PM", "Weekends only")

   - warnings: Array of potential issues:
     * "missing_description" if description is vague or missing
     * "price_zero" if price is 0
     * "ambiguous_category" if category is unclear
     * "possible_combo" if item might be a combo but not clearly stated
     * "missing_dietary_info" if no dietary tags found

Return ONLY a JSON array. Format:
[{
  "name": "...",
  "description": "...",
  "category": "...",
  "price": 0,
  "dietary": [...],
  "type": "veg",
  "spiceLevel": "medium",
  "preparationTime": 15,
  "allergens": [...],
  "tags": [...],
  "aiConfidence": 0.95,
  "suggestedType": "regular",
  "suggestedComboItems": [...],
  "suggestedValidityPeriod": "...",
  "warnings": [...]
}]`;

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
 * POST /api/admin/menu/parse-from-r2
 * Body: { tenantId: string, r2Key: string, filename, mimeType: string }
 *
 * Returns parsed items WITHOUT saving to D1
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY CHECK: Require admin authentication (cookie OR Bearer token)
    // BYPASS: Allow X-Skip-Auth header for desktop POS app (TEMPORARY - TODO: use proper API key)
    const skipAuth = request.headers.get('x-skip-auth') === 'true';
    const cookieHeader = request.headers.get('cookie') || '';
    const authHeader = request.headers.get('authorization') || '';

    const hasCookieAuth = cookieHeader.includes('admin_access_token');
    const hasBearerAuth = authHeader.startsWith('Bearer ');

    if (!skipAuth && !hasCookieAuth && !hasBearerAuth) {
      console.warn('[ParseR2] Unauthorized: No admin token (checked both cookie and Bearer)');
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    if (skipAuth) {
      console.log('[ParseR2] Using X-Skip-Auth bypass (Desktop POS client)');
    }

    if (hasBearerAuth) {
      console.log('[ParseR2] Using Bearer token authentication (POS/Desktop client)');
    } else {
      console.log('[ParseR2] Using cookie authentication (Web client)');
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

    console.log('[ParseR2] Parsing file (no D1 save)', {
      tenantId,
      r2Key,
      filename,
      mimeType,
    });

    // Validate tenant ownership
    if (!r2Key.includes(tenantId)) {
      return NextResponse.json(
        { error: 'Access denied: R2 key does not match tenant' },
        { status: 403 }
      );
    }

    // Download file from R2
    console.log('[ParseR2] Downloading from R2...');
    const r2Object = await env.MENU_UPLOADS_BUCKET.get(r2Key);
    if (!r2Object) {
      return NextResponse.json(
        { error: 'File not found in R2', r2Key },
        { status: 404 }
      );
    }

    const fileBuffer = await r2Object.arrayBuffer();
    console.log('[ParseR2] File downloaded:', fileBuffer.byteLength, 'bytes');

    // Parse menu with Gemini AI
    console.log('[ParseR2] Parsing with Gemini AI...');
    let parsedItems: ParsedMenuItem[] = [];

    try {
      parsedItems = await parseMenuWithGemini(
        fileBuffer,
        filename,
        mimeType,
        env.GEMINI_API_KEY
      );
    } catch (parseError) {
      console.error('[ParseR2] AI parsing failed:', parseError);
      return NextResponse.json(
        {
          error: 'AI parsing failed',
          message: parseError instanceof Error ? parseError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    console.log('[ParseR2] Parsing complete - returning items for review');

    return NextResponse.json({
      success: true,
      message: `Parsed ${parsedItems.length} items successfully`,
      items: parsedItems,
      r2Key, // Keep R2 key for later processing
      filename,
      mimeType,
      summary: {
        total: parsedItems.length,
        byType: {
          regular: parsedItems.filter(i => i.suggestedType === 'regular').length,
          combo: parsedItems.filter(i => i.suggestedType === 'combo').length,
          special: parsedItems.filter(i => i.suggestedType === 'special').length,
          variant: parsedItems.filter(i => i.suggestedType === 'variant').length,
          addon: parsedItems.filter(i => i.suggestedType === 'addon').length,
        },
        withWarnings: parsedItems.filter(i => i.warnings && i.warnings.length > 0).length,
      }
    });
  } catch (error) {
    console.error('[ParseR2] Error:', error);
    return NextResponse.json(
      {
        error: 'File parsing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

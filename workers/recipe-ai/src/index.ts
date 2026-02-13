/**
 * Recipe AI Worker
 *
 * AI-powered recipe generation using Gemini 1.5 Flash API.
 * Automatically generates ingredient lists for menu items by matching
 * them to existing inventory items.
 */

export interface Env {
  // KV Namespace for tenant metadata (shared with handsfree-orders)
  TENANT_METADATA: KVNamespace;

  // Service Bindings
  TOKEN_MANAGER: Fetcher;

  // Environment variables
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  TOKEN_MANAGER_URL: string;

  // Secrets are fetched from token-manager, not stored directly
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface RecipeGenerationOptions {
  cuisineType?: string;
  minConfidence?: number;
  restaurantType?: string;
}

interface RecipeGenerationRequest {
  menu_items: MenuItem[];
  options?: RecipeGenerationOptions;
}

interface AIIngredient {
  name: string;
  quantity: number;
  unit: string;
  matched_inventory_item_id: string | null;
  is_new_item: boolean;
  confidence: number;
  notes?: string;
}

interface RecipeSuggestion {
  menu_item_id: string;
  menu_item_name: string;
  confidence: number;
  ingredients: AIIngredient[];
}

interface RecipeGenerationResponse {
  success: boolean;
  recipes: RecipeSuggestion[];
  metadata: {
    model: string;
    processing_time_ms: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cost_usd?: number;
  };
  error?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
}

/**
 * Fetch a token from the token-manager service
 */
async function getTokenFromManager(
  tokenKey: string,
  env: Env
): Promise<string> {
  // Use Service Binding for worker-to-worker communication
  const url = `/api/tokens/${encodeURIComponent(tokenKey)}`;
  console.log(`Fetching token via service binding: ${url}`);

  const response = await env.TOKEN_MANAGER.fetch(
    new Request(`https://handsfree-token-manager/api/tokens/${encodeURIComponent(tokenKey)}`, {
      headers: {
        'X-Worker-Name': 'recipe-ai',
      },
    })
  );

  console.log(`Token fetch response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token fetch failed: ${response.status} - ${errorText}`);
    throw new Error(`Failed to fetch token ${tokenKey}: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.data.value;
}

/**
 * Calculate Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Match an ingredient name to inventory items using exact and fuzzy matching
 */
function matchIngredientToInventory(
  ingredientName: string,
  inventoryItems: InventoryItem[]
): { itemId: string | null; confidence: number } {
  const normalizedIngredient = ingredientName.toLowerCase().trim();

  // Strategy 1: Exact match (case-insensitive)
  const exactMatch = inventoryItems.find(
    (item) => item.name.toLowerCase().trim() === normalizedIngredient
  );
  if (exactMatch) {
    return { itemId: exactMatch.id, confidence: 1.0 };
  }

  // Strategy 2: Fuzzy match (Levenshtein distance < 3)
  let bestMatch: { item: InventoryItem; distance: number } | null = null;

  for (const item of inventoryItems) {
    const distance = levenshteinDistance(
      normalizedIngredient,
      item.name.toLowerCase().trim()
    );

    if (distance < 3) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { item, distance };
      }
    }
  }

  if (bestMatch) {
    // Confidence decreases with distance
    // Distance 0 = 1.0, Distance 1 = 0.85, Distance 2 = 0.70
    const confidence = Math.max(0.7, 1.0 - bestMatch.distance * 0.15);
    return { itemId: bestMatch.item.id, confidence };
  }

  // Strategy 3: No match found
  return { itemId: null, confidence: 0 };
}

/**
 * Build Gemini prompt for recipe generation
 */
function buildGeminiPrompt(
  menuItems: MenuItem[],
  inventoryItems: InventoryItem[],
  options: RecipeGenerationOptions
): string {
  const cuisineType = options.cuisineType || 'General';
  const restaurantType = options.restaurantType || 'Restaurant';

  // Build inventory context (limit to 500 items for token efficiency)
  const inventoryList = inventoryItems
    .slice(0, 500)
    .map((item) => `- ${item.id}: ${item.name} (${item.category}, ${item.unit})`)
    .join('\n');

  // Build menu items list
  const menuItemsList = menuItems
    .map((item, idx) => {
      const desc = item.description ? ` - ${item.description}` : '';
      const cat = item.category ? ` [${item.category}]` : '';
      return `${idx + 1}. ${item.name}${cat}${desc}`;
    })
    .join('\n');

  return `You are a professional chef analyzing menu items for a ${restaurantType}.

Context:
- Cuisine Type: ${cuisineType}
- Number of menu items: ${menuItems.length}
- Available inventory items: ${Math.min(inventoryItems.length, 500)}

Available Inventory:
${inventoryList}

Menu Items to Analyze:
${menuItemsList}

Task:
For each menu item, identify realistic recipe ingredients with quantities for 1 serving.

Requirements:
1. Match ingredients to inventory_item_id when possible (use exact IDs from the inventory list)
2. Use metric units: g (grams), kg (kilograms), ml (milliliters), l (liters), pcs (pieces)
3. Provide realistic quantities for 1 serving
4. Mark unmatched ingredients as is_new_item: true
5. Include confidence score (0-1) for each ingredient match
6. For each recipe, provide an overall confidence score

Output Format (JSON only, no markdown):
{
  "recipes": [
    {
      "menu_item_id": "item-123",
      "menu_item_name": "Butter Chicken",
      "confidence": 0.95,
      "ingredients": [
        {
          "name": "Chicken Breast",
          "quantity": 250,
          "unit": "g",
          "matched_inventory_item_id": "inv-002",
          "is_new_item": false,
          "confidence": 0.98,
          "notes": "Boneless preferred"
        },
        {
          "name": "Heavy Cream",
          "quantity": 100,
          "unit": "ml",
          "matched_inventory_item_id": null,
          "is_new_item": true,
          "confidence": 0.90,
          "notes": "Essential for sauce"
        }
      ]
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- Use exact inventory_item IDs from the list above
- Be accurate with quantities (realistic serving sizes)
- If uncertain about a match, set matched_inventory_item_id to null and is_new_item to true`;
}

/**
 * Call Gemini API for recipe generation
 */
async function callGeminiAPI(
  prompt: string,
  apiKey: string
): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  const geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3, // Lower temperature for more deterministic output
      maxOutputTokens: 8000,
      topP: 0.95,
      topK: 40,
      responseMimeType: 'application/json', // Force JSON response
    },
  };

  const response = await fetch(`${geminiEndpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract token counts
  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return { text, promptTokens, completionTokens };
}

/**
 * Parse and validate Gemini response
 */
function parseGeminiResponse(responseText: string): RecipeSuggestion[] {
  try {
    // Remove markdown code blocks if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.recipes || !Array.isArray(parsed.recipes)) {
      throw new Error('Invalid response format: missing recipes array');
    }

    return parsed.recipes;
  } catch (error) {
    console.error('Failed to parse Gemini response:', responseText.substring(0, 500));
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch inventory items from D1 for a tenant
 */
async function getInventoryItems(tenantId: string, env: Env): Promise<InventoryItem[]> {
  try {
    // Get D1 database ID from KV
    const metadata = await env.TENANT_METADATA.get(`tenant:${tenantId}:d1`, 'json') as any;

    if (!metadata?.databaseId) {
      console.log(`No D1 database found for tenant ${tenantId}, using empty inventory`);
      return [];
    }

    const databaseId = metadata.databaseId;

    // Fetch Cloudflare API token from token-manager
    const cloudflareToken = await getTokenFromManager('cloudflare:api_token', env);

    // Query inventory items from D1
    const queryUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`;

    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT id, name, category, unit FROM inventory_items WHERE tenant_id = ? ORDER BY name LIMIT 500',
        params: [tenantId],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`D1 query error: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const results = data.result?.[0]?.results || [];

    return results.map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit,
    }));
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return [];
  }
}

/**
 * Calculate API cost
 */
function calculateCost(promptTokens: number, completionTokens: number): number {
  // Gemini 1.5 Flash pricing (as of January 2025)
  // Input: $0.075 per 1M tokens
  // Output: $0.30 per 1M tokens
  const inputCost = (promptTokens / 1_000_000) * 0.075;
  const outputCost = (completionTokens / 1_000_000) * 0.30;
  return inputCost + outputCost;
}

/**
 * Main handler for recipe generation
 */
async function handleRecipeGeneration(
  request: Request,
  env: Env,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Fetch Gemini API key from token-manager
    let geminiApiKey: string;
    try {
      geminiApiKey = await getTokenFromManager('gemini:api_key', env);
    } catch (error) {
      console.error('Failed to fetch Gemini API key:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch Gemini API key from token-manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const requestData = (await request.json()) as RecipeGenerationRequest;

    if (!requestData.menu_items || requestData.menu_items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No menu items provided',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch inventory items from D1
    console.log(`Fetching inventory for tenant: ${tenantId}`);
    const inventoryItems = await getInventoryItems(tenantId, env);
    console.log(`Found ${inventoryItems.length} inventory items`);

    // Build prompt
    const options = requestData.options || {};
    const prompt = buildGeminiPrompt(requestData.menu_items, inventoryItems, options);

    // Call Gemini API
    console.log(`Calling Gemini API for ${requestData.menu_items.length} menu items`);
    const { text, promptTokens, completionTokens } = await callGeminiAPI(
      prompt,
      geminiApiKey
    );

    // Parse response
    const recipes = parseGeminiResponse(text);

    // Post-process: Improve matching using local fuzzy matching
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.matched_inventory_item_id && inventoryItems.length > 0) {
          const match = matchIngredientToInventory(ingredient.name, inventoryItems);
          if (match.itemId) {
            ingredient.matched_inventory_item_id = match.itemId;
            ingredient.is_new_item = false;
            ingredient.confidence = Math.max(ingredient.confidence, match.confidence);
          }
        }
      }
    }

    // Calculate cost
    const costUsd = calculateCost(promptTokens, completionTokens);
    const processingTimeMs = Date.now() - startTime;

    console.log(`Recipe generation complete: ${recipes.length} recipes, ${processingTimeMs}ms, $${costUsd.toFixed(6)}`);

    const response: RecipeGenerationResponse = {
      success: true,
      recipes,
      metadata: {
        model: 'gemini-pro',
        processing_time_ms: processingTimeMs,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Recipe generation error:', error);

    const response: RecipeGenerationResponse = {
      success: false,
      recipes: [],
      metadata: {
        model: 'gemini-pro',
        processing_time_ms: Date.now() - startTime,
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Main worker entry point
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route: POST /api/recipes/:tenantId/generate
      if (path.startsWith('/api/recipes/') && path.endsWith('/generate')) {
        const parts = path.split('/');
        const tenantId = parts[3];

        if (!tenantId) {
          return new Response(
            JSON.stringify({ error: 'Tenant ID is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return handleRecipeGeneration(request, env, tenantId, corsHeaders);
      }

      // Debug endpoint
      if (path === '/debug/env') {
        return new Response(
          JSON.stringify({
            TOKEN_MANAGER_URL: env.TOKEN_MANAGER_URL,
            ENVIRONMENT: env.ENVIRONMENT,
            CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Test token fetch endpoint
      if (path === '/debug/test-token-fetch') {
        const url = `${env.TOKEN_MANAGER_URL}/api/tokens/${encodeURIComponent('gemini:api_key')}`;
        try {
          const response = await fetch(url, {
            headers: {
              'X-Worker-Name': 'recipe-ai',
            },
          });
          const data = await response.text();
          return new Response(
            JSON.stringify({
              url,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers),
              body: data,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              url,
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Health check
      if (path === '/health' || path === '/') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'recipe-ai',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            endpoints: [
              'POST /api/recipes/:tenantId/generate',
            ],
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};

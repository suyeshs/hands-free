/**
 * Recipe Generation API Service
 *
 * Frontend service to call the recipe-ai Cloudflare Worker
 * and handle AI-generated recipe suggestions.
 */

import type {
  RecipeGenerationRequest,
  RecipeGenerationResponse,
  RecipeSuggestion,
  RecipeGenerationMenuItem,
  RecipeGenerationOptions,
} from '../types/inventory';

const WORKER_URL =
  import.meta.env.VITE_RECIPE_AI_WORKER_URL ||
  'https://recipe-ai.suyesh.workers.dev';

/**
 * Recipe Generation API Client
 */
export class RecipeGenerationAPI {
  private baseUrl: string;
  private tenantId: string;

  constructor(tenantId: string, workerUrl?: string) {
    this.tenantId = tenantId;
    this.baseUrl = workerUrl || WORKER_URL;
  }

  /**
   * Generate recipe suggestions for menu items
   *
   * @param menuItems - Array of menu items to generate recipes for
   * @param options - Optional configuration for recipe generation
   * @returns Promise with recipe suggestions and metadata
   */
  async generateRecipes(
    menuItems: RecipeGenerationMenuItem[],
    options?: RecipeGenerationOptions
  ): Promise<RecipeGenerationResponse> {
    const url = `${this.baseUrl}/api/recipes/${this.tenantId}/generate`;

    const requestBody: RecipeGenerationRequest = {
      menu_items: menuItems,
      options: options || {},
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }

      const data: RecipeGenerationResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Recipe generation API error:', error);

      // Return error response
      return {
        success: false,
        recipes: [],
        metadata: {
          model: 'gemini-1.5-flash',
          processingTimeMs: 0,
        },
        error:
          error instanceof Error ? error.message : 'Failed to generate recipes',
      };
    }
  }

  /**
   * Generate recipes with retry logic
   *
   * @param menuItems - Array of menu items
   * @param options - Optional configuration
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns Promise with recipe suggestions
   */
  async generateRecipesWithRetry(
    menuItems: RecipeGenerationMenuItem[],
    options?: RecipeGenerationOptions,
    maxRetries: number = 3
  ): Promise<RecipeGenerationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.generateRecipes(menuItems, options);

        if (result.success) {
          return result;
        }

        // If not success and it's an error we shouldn't retry (400), don't retry
        if (result.error && result.error.includes('No menu items provided')) {
          return result;
        }

        lastError = new Error(result.error || 'Unknown error');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        console.log(`Retrying recipe generation (attempt ${attempt + 1}/${maxRetries})...`);
      }
    }

    // All retries failed
    return {
      success: false,
      recipes: [],
      metadata: {
        model: 'gemini-1.5-flash',
        processingTimeMs: 0,
      },
      error: lastError?.message || 'Failed to generate recipes after multiple attempts',
    };
  }

  /**
   * Check worker health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) return false;

      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

/**
 * Process recipe suggestions and prepare for UI
 *
 * Enriches recipe suggestions with UI state and validation
 */
export function prepareRecipesForUI(recipes: RecipeSuggestion[]): RecipeSuggestion[] {
  return recipes.map((recipe) => ({
    ...recipe,
    isApproved: false,
    isRejected: false,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      isEditing: false,
      validationError: validateIngredient(ingredient),
    })),
  }));
}

/**
 * Validate individual ingredient
 */
function validateIngredient(ingredient: {
  quantity: number;
  unit: string;
  name: string;
}): string | undefined {
  // Quantity validation
  if (ingredient.quantity <= 0) {
    return 'Quantity must be greater than 0';
  }
  if (ingredient.quantity > 10000) {
    return 'Quantity seems unrealistic (> 10,000)';
  }

  // Name validation
  if (!ingredient.name || ingredient.name.trim().length === 0) {
    return 'Ingredient name is required';
  }

  // Unit validation
  const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'box', 'dozen', 'pack', 'bottle', 'can', 'bag', 'bunch', 'unit'];
  if (!validUnits.includes(ingredient.unit.toLowerCase())) {
    return `Invalid unit: ${ingredient.unit}`;
  }

  return undefined;
}

/**
 * Filter recipes by confidence threshold
 */
export function filterRecipesByConfidence(
  recipes: RecipeSuggestion[],
  minConfidence: number = 0.7
): RecipeSuggestion[] {
  return recipes.filter((recipe) => recipe.confidence >= minConfidence);
}

/**
 * Get statistics from recipe generation result
 */
export function getRecipeStats(recipes: RecipeSuggestion[]) {
  const totalRecipes = recipes.length;
  const totalIngredients = recipes.reduce((sum, r) => sum + r.ingredients.length, 0);
  const matchedIngredients = recipes.reduce(
    (sum, r) => sum + r.ingredients.filter((i) => !i.isNewItem).length,
    0
  );
  const newIngredients = totalIngredients - matchedIngredients;
  const avgConfidence = totalRecipes > 0
    ? recipes.reduce((sum, r) => sum + r.confidence, 0) / totalRecipes
    : 0;

  return {
    totalRecipes,
    totalIngredients,
    matchedIngredients,
    newIngredients,
    avgConfidence,
    matchRate: totalIngredients > 0 ? matchedIngredients / totalIngredients : 0,
  };
}

/**
 * Export singleton instance creator
 */
export function createRecipeGenerationAPI(tenantId: string): RecipeGenerationAPI {
  return new RecipeGenerationAPI(tenantId);
}

export default RecipeGenerationAPI;

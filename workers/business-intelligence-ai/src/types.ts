/**
 * Business Intelligence AI - Type Definitions
 */

export interface Env {
  // KV Namespace for tenant metadata
  TENANT_METADATA: KVNamespace;

  // Service Bindings
  TOKEN_MANAGER: Fetcher;

  // Environment variables
  ENVIRONMENT: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  TOKEN_MANAGER_URL: string;
}

// ============ Menu Optimization Types ============

export interface MenuOptimizationRequest {
  tenant_id: string;
  time_range?: 'week' | 'month'; // Default: week
  min_confidence?: number; // Default: 0.7
  options?: {
    focus_areas?: ('food_cost' | 'pricing' | 'sales_volume' | 'waste')[];
    target_food_cost_percentage?: number; // Default: 30
  };
}

export interface MenuItemAnalysis {
  id: string;
  name: string;
  category?: string;
  sales_count: number;
  total_revenue: number;
  average_price: number;
  food_cost: number;
  food_cost_percentage: number;
  profit_margin: number;
  profit_per_item: number;
}

export interface MenuInsight {
  item_id: string;
  item_name: string;
  issue_type: 'high_food_cost' | 'low_sales' | 'waste_risk' | 'pricing_opportunity' | 'high_performer';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'positive';
  current_metrics: {
    food_cost_percentage?: number;
    sales_count?: number;
    revenue?: number;
    profit_margin?: number;
    profit_per_item?: number;
  };
  recommendation: string;
  suggested_actions: Array<{
    action: string;
    impact_estimate: string;
  }>;
  confidence: number;
}

export interface MenuOptimizationResponse {
  success: boolean;
  insights: MenuInsight[];
  summary: {
    total_items_analyzed: number;
    high_priority_issues: number;
    potential_monthly_impact: number; // INR
    avg_food_cost_percentage: number;
  };
  metadata: {
    model: string;
    processing_time_ms: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cost_usd?: number;
  };
  error?: string;
}

// ============ Sales Data Types ============

export interface SalesDataRow {
  menu_item_id: string;
  menu_item_name: string;
  category: string | null;
  total_sales: number;
  total_revenue: number;
  avg_price: number;
}

export interface RecipeCostRow {
  menu_item_id: string;
  total_food_cost: number;
}

export interface InventoryItemRow {
  id: string;
  name: string;
  last_purchase_price: number;
  unit: string;
}

// ============ Gemini API Types ============

export interface GeminiResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiAIOutput {
  insights: MenuInsight[];
  summary: {
    total_items_analyzed: number;
    high_priority_count: number;
    estimated_monthly_impact_inr: number;
  };
}

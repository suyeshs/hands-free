/**
 * Business Intelligence API Service
 *
 * Frontend service to call the business-intelligence-ai Cloudflare Worker
 * and handle AI-generated business insights and recommendations.
 */

export interface MenuOptimizationRequest {
  time_range?: 'week' | 'month';
  min_confidence?: number;
  options?: {
    focus_areas?: ('food_cost' | 'pricing' | 'sales_volume' | 'waste')[];
    target_food_cost_percentage?: number;
  };
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
    potential_monthly_impact: number;
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

const WORKER_URL =
  import.meta.env.VITE_BUSINESS_INTELLIGENCE_WORKER_URL ||
  'https://business-intelligence-ai.suyesh.workers.dev';

/**
 * Business Intelligence API Client
 */
export class BusinessIntelligenceAPI {
  private baseUrl: string;
  private tenantId: string;

  constructor(tenantId: string, workerUrl?: string) {
    this.tenantId = tenantId;
    this.baseUrl = workerUrl || WORKER_URL;
  }

  /**
   * Get menu optimization insights
   *
   * @param request - Menu optimization request parameters
   * @returns Promise with menu insights and recommendations
   */
  async getMenuOptimization(
    request: MenuOptimizationRequest = {}
  ): Promise<MenuOptimizationResponse> {
    const url = `${this.baseUrl}/api/insights/${this.tenantId}/menu-optimization`;

    try {
      console.log('Calling menu optimization API:', url, request);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }

      const data: MenuOptimizationResponse = await response.json();

      console.log('Menu optimization response:', {
        success: data.success,
        insights: data.insights.length,
        processingTime: data.metadata.processing_time_ms,
        cost: data.metadata.cost_usd
      });

      return data;
    } catch (error) {
      console.error('Menu optimization API error:', error);

      // Return error response
      return {
        success: false,
        insights: [],
        summary: {
          total_items_analyzed: 0,
          high_priority_issues: 0,
          potential_monthly_impact: 0,
          avg_food_cost_percentage: 0
        },
        metadata: {
          model: 'gemini-1.5-flash',
          processing_time_ms: 0
        },
        error: error instanceof Error ? error.message : 'Failed to get menu insights'
      };
    }
  }

  /**
   * Get menu optimization with retry logic
   *
   * @param request - Menu optimization request
   * @param maxRetries - Maximum retry attempts (default: 2)
   * @returns Promise with menu insights
   */
  async getMenuOptimizationWithRetry(
    request: MenuOptimizationRequest = {},
    maxRetries: number = 2
  ): Promise<MenuOptimizationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.getMenuOptimization(request);

        if (result.success) {
          return result;
        }

        lastError = new Error(result.error || 'Unknown error');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        console.log(`Retrying menu optimization (attempt ${attempt + 1}/${maxRetries})...`);
      }
    }

    // All retries failed
    return {
      success: false,
      insights: [],
      summary: {
        total_items_analyzed: 0,
        high_priority_issues: 0,
        potential_monthly_impact: 0,
        avg_food_cost_percentage: 0
      },
      metadata: {
        model: 'gemini-1.5-flash',
        processing_time_ms: 0
      },
      error: lastError?.message || 'Failed to get menu insights after multiple attempts'
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
 * Export singleton instance creator
 */
export function createBusinessIntelligenceAPI(tenantId: string): BusinessIntelligenceAPI {
  return new BusinessIntelligenceAPI(tenantId);
}

export default BusinessIntelligenceAPI;

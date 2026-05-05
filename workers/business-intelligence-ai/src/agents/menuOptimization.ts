/**
 * Menu Optimization Agent
 * Analyzes menu performance and provides actionable recommendations
 */

import {
  Env,
  MenuOptimizationRequest,
  MenuOptimizationResponse,
  MenuItemAnalysis,
  MenuInsight,
  GeminiAIOutput
} from '../types';
import { getSalesData, getRecipeCosts } from '../utils/database';
import { callGemini, calculateCost } from '../utils/gemini';
import { getTokenFromManager } from '../utils/tokenManager';

/**
 * Main handler for menu optimization analysis
 */
export async function handleMenuOptimization(
  request: MenuOptimizationRequest,
  env: Env
): Promise<MenuOptimizationResponse> {
  const startTime = Date.now();

  try {
    console.log(`Starting menu optimization for tenant: ${request.tenant_id}`);

    // 1. Fetch data from D1
    const timeRange = request.time_range || 'week';
    const [salesData, recipeCosts] = await Promise.all([
      getSalesData(request.tenant_id, timeRange, env),
      getRecipeCosts(request.tenant_id, env)
    ]);

    console.log(`Fetched ${salesData.length} menu items with sales data`);
    console.log(`Fetched ${recipeCosts.length} recipe costs`);

    if (salesData.length === 0) {
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
          processing_time_ms: Date.now() - startTime
        },
        error: 'No sales data found for the specified time period'
      };
    }

    // 2. Combine sales data with recipe costs
    const menuAnalysis = analyzeMenuItems(salesData, recipeCosts);

    console.log(`Analyzed ${menuAnalysis.length} menu items`);

    // 3. Build AI prompt
    const targetFoodCost = request.options?.target_food_cost_percentage || 30;
    const prompt = buildMenuOptimizationPrompt(menuAnalysis, timeRange, targetFoodCost);

    // 4. Call Gemini API
    const geminiApiKey = await getTokenFromManager('gemini:api_key', env);
    const { text, promptTokens, completionTokens } = await callGemini(prompt, geminiApiKey, {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    });

    console.log(`Gemini response received (${promptTokens} input, ${completionTokens} output tokens)`);

    // 5. Parse AI response
    const aiOutput: GeminiAIOutput = JSON.parse(text);

    // 6. Filter by confidence threshold
    const minConfidence = request.min_confidence || 0.7;
    const insights = aiOutput.insights.filter(i => i.confidence >= minConfidence);

    // 7. Calculate summary
    const avgFoodCost = menuAnalysis.reduce((sum, item) => sum + item.food_cost_percentage, 0) / menuAnalysis.length;
    const highPriorityCount = insights.filter(i => i.severity === 'critical' || i.severity === 'high').length;

    const cost = calculateCost(promptTokens, completionTokens);
    const processingTime = Date.now() - startTime;

    console.log(`Menu optimization complete: ${insights.length} insights, ${processingTime}ms, $${cost.toFixed(6)}`);

    return {
      success: true,
      insights,
      summary: {
        total_items_analyzed: menuAnalysis.length,
        high_priority_issues: highPriorityCount,
        potential_monthly_impact: aiOutput.summary.estimated_monthly_impact_inr || 0,
        avg_food_cost_percentage: avgFoodCost
      },
      metadata: {
        model: 'gemini-1.5-flash',
        processing_time_ms: processingTime,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: cost
      }
    };
  } catch (error) {
    console.error('Menu optimization error:', error);

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
        processing_time_ms: Date.now() - startTime
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Analyze menu items by combining sales and cost data
 */
function analyzeMenuItems(
  salesData: any[],
  recipeCosts: any[]
): MenuItemAnalysis[] {
  return salesData.map(item => {
    const recipeCost = recipeCosts.find(r => r.menu_item_id === item.menu_item_id);
    const foodCost = recipeCost?.total_food_cost || 0;
    const foodCostPercentage = item.avg_price > 0 ? (foodCost / item.avg_price) * 100 : 0;
    const profitMargin = item.avg_price > 0 ? ((item.avg_price - foodCost) / item.avg_price) * 100 : 0;
    const profitPerItem = item.avg_price - foodCost;

    return {
      id: item.menu_item_id,
      name: item.menu_item_name,
      category: item.category,
      sales_count: item.total_sales,
      total_revenue: item.total_revenue,
      average_price: item.avg_price,
      food_cost: foodCost,
      food_cost_percentage: foodCostPercentage,
      profit_margin: profitMargin,
      profit_per_item: profitPerItem
    };
  });
}

/**
 * Build the AI prompt for menu optimization
 */
function buildMenuOptimizationPrompt(
  menuAnalysis: MenuItemAnalysis[],
  timeRange: string,
  targetFoodCost: number
): string {
  const timeDescription = timeRange === 'week' ? 'last 7 days' : 'last 30 days';

  // Format menu items for the prompt
  const menuItemsList = menuAnalysis
    .slice(0, 50) // Limit to top 50 items to manage token usage
    .map(item => {
      const category = item.category ? ` [${item.category}]` : '';
      return `
- **${item.name}**${category} (ID: ${item.id})
  - Sales: ${item.sales_count} orders
  - Revenue: ₹${item.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
  - Avg Price: ₹${item.average_price.toFixed(2)}
  - Food Cost: ₹${item.food_cost.toFixed(2)} (${item.food_cost_percentage.toFixed(1)}%)
  - Profit/Item: ₹${item.profit_per_item.toFixed(2)}
  - Margin: ${item.profit_margin.toFixed(1)}%`;
    })
    .join('\n');

  return `You are a restaurant business analyst specializing in Indian cuisine. Analyze menu performance and provide actionable recommendations.

**Analysis Period**: ${timeDescription}
**Restaurant Context**: Indian restaurant with ${menuAnalysis.length} menu items
**Target Food Cost**: ${targetFoodCost}% (industry standard: 28-32%)

**Menu Items Performance**:
${menuItemsList}

**Your Task**:
1. Identify items with **high food cost** (>${targetFoodCost + 5}%) - these hurt profitability
2. Identify **low-performing items** (<10 sales in the period) - consider removing or promoting
3. Identify **high-performers** (high sales + good margins) - consider featuring or upselling
4. Suggest **pricing opportunities** (high demand items that can support price increases)
5. Flag **waste risks** (items with ingredients that might expire)

**For each insight, provide**:
- Specific issue type
- Severity level (critical/high/medium/low/positive)
- Current metrics
- Clear recommendation in simple language
- 2-3 actionable steps with estimated impact

**Output Format** (JSON only, no markdown):
{
  "insights": [
    {
      "item_id": "menu-item-id",
      "item_name": "Butter Chicken",
      "issue_type": "high_food_cost",
      "severity": "high",
      "current_metrics": {
        "food_cost_percentage": 42.5,
        "sales_count": 87,
        "revenue": 15660,
        "profit_margin": 57.5,
        "profit_per_item": 103.50
      },
      "recommendation": "Food cost is 42.5%, well above the target of ${targetFoodCost}%. This significantly impacts profitability despite good sales volume.",
      "suggested_actions": [
        {
          "action": "Increase price from ₹180 to ₹210 (+16.7%)",
          "impact_estimate": "Reduce food cost to 36%, add ₹2,610/month revenue (87 sales × ₹30)"
        },
        {
          "action": "Reduce portion size by 15% (maintain quality)",
          "impact_estimate": "Lower food cost to 36%, save ₹1,100/month in ingredient costs"
        },
        {
          "action": "Negotiate with chicken supplier for bulk discount",
          "impact_estimate": "Potential 8-10% reduction in chicken cost, save ₹800/month"
        }
      ],
      "confidence": 0.92
    }
  ],
  "summary": {
    "total_items_analyzed": 25,
    "high_priority_count": 4,
    "estimated_monthly_impact_inr": 8500
  }
}

**Important Guidelines**:
- Be specific with numbers and calculations
- Consider Indian restaurant context (Biryani, Paneer, Tikka, Curry, etc.)
- Suggest realistic actions (price increases, portion adjustments, supplier negotiations)
- Estimate impact based on actual sales volume shown in data
- Use INR (₹) for all monetary values
- Confidence score: 0.9+ for clear issues, 0.7-0.9 for moderate issues, <0.7 for uncertain
- Focus on highest impact opportunities first

Return ONLY valid JSON, no additional text.`;
}

# Proactive Business Intelligence Agents - Technical Architecture

## Overview
This document outlines the technical architecture for implementing proactive AI agents for business recommendations, management insights, and operational analysis in the restaurant POS system.

---

## Architecture Decision: Hybrid Context-Based Inference

### Why NOT Fine-Tuning?

**Fine-tuning considerations**:
- ❌ Cost: $100-500 per training run (OpenAI GPT-3.5/4)
- ❌ Time: 1-4 hours per training cycle
- ❌ Data requirements: 1000+ high-quality examples per use case
- ❌ Maintenance: Need to retrain for each restaurant/update
- ❌ Latency: Model deployment overhead
- ❌ Vendor lock-in: Model tied to specific provider

**Our use case doesn't need fine-tuning because**:
1. Each restaurant has different data (can't generalize)
2. Business rules change frequently
3. Context window (128k tokens) is sufficient for all data
4. Real-time data is critical (fine-tuned models are static)

---

## Recommended Architecture: 3-Tier Hybrid System

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TIER 1: RULE-BASED AGENTS                         │
│                    (80% of recommendations)                          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  • Payment due date calculations                             │  │
│  │  • Stock level thresholds                                    │  │
│  │  • Attendance pattern detection                              │  │
│  │  • Cash flow warnings                                        │  │
│  │  • Simple price vs cost comparisons                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Runtime: Browser/Tauri (local compute)                             │
│  Cost: $0                                                            │
│  Latency: <100ms                                                     │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  TIER 2: AI-ENHANCED AGENTS                          │
│                  (15% of recommendations)                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  • Menu profitability optimization                           │  │
│  │  • Sales pattern analysis                                    │  │
│  │  • Customer behavior clustering                              │  │
│  │  • Demand forecasting                                        │  │
│  │  • Anomaly detection in sales/costs                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Runtime: Cloudflare Workers + Gemini Flash                         │
│  Cost: ~$0.001-0.005 per request                                    │
│  Latency: 200-800ms                                                  │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  TIER 3: DEEP AI ANALYSIS                            │
│                  (5% of recommendations - triggered by user)         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  • Comprehensive business health analysis                    │  │
│  │  • Strategic recommendations (menu redesign)                 │  │
│  │  • Market positioning insights                               │  │
│  │  • Long-term trend predictions                               │  │
│  │  • Competitive analysis                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Runtime: Cloudflare Workers + Gemini Pro / Claude                  │
│  Cost: ~$0.01-0.05 per request                                      │
│  Latency: 2-5 seconds                                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Tier 1: Rule-Based Agents (Local Compute)

**Technology Stack**:
- TypeScript (runs in Tauri/Browser)
- Zustand stores for data access
- No API calls needed

**Example: Vendor Payment Agent**

```typescript
// src/services/agents/rules/VendorPaymentRuleAgent.ts

import { BaseAgent } from '../AgentOrchestrator';
import { useInventoryStore } from '../../../stores/inventoryStore';
import { useDailySalesStore } from '../../../stores/dailySalesStore';

export class VendorPaymentRuleAgent extends BaseAgent {
  async analyze() {
    const { bills } = useInventoryStore.getState();
    const { report } = useDailySalesStore.getState();

    const pendingBills = bills.filter(b => b.paymentStatus === 'pending');
    const avgDailyRevenue = report?.summary.totalRevenue || 0;
    const cashReserve = avgDailyRevenue * 7; // 7 days of revenue

    // Rule 1: Payment due within 3 days
    for (const bill of pendingBills) {
      const daysUntilDue = this.getDaysUntilDue(bill.dueDate);

      if (daysUntilDue <= 3 && daysUntilDue > 0) {
        this.addRecommendation({
          agentName: 'Vendor Payment Agent',
          category: 'vendor',
          priority: daysUntilDue === 1 ? 'critical' : 'high',
          actionType: 'notification',
          title: `Payment Due ${daysUntilDue === 1 ? 'Tomorrow' : `in ${daysUntilDue} days`}`,
          message: `${bill.supplierName} invoice #${bill.invoiceNumber} (₹${bill.amount.toLocaleString()})`,
          insight: cashReserve > bill.amount * 3
            ? `Cash flow sufficient. Reserve: ₹${cashReserve.toLocaleString()}`
            : `⚠️ Warning: Low cash reserve. Only ${Math.floor(cashReserve / avgDailyRevenue)} days runway`,
          actions: [/* ... */],
          confidence: 1.0,
        });
      }
    }

    // Rule 2: Early payment discounts
    for (const bill of pendingBills) {
      if (bill.earlyPaymentDiscount) {
        const savings = bill.amount * (bill.earlyPaymentDiscount.percentage / 100);
        const daysUntilDue = this.getDaysUntilDue(bill.dueDate);

        if (daysUntilDue > bill.earlyPaymentDiscount.daysBeforeDue) {
          this.addRecommendation({
            agentName: 'Vendor Payment Agent',
            category: 'vendor',
            priority: 'medium',
            actionType: 'suggestion',
            title: '💰 Early Payment Savings',
            message: `Save ₹${savings.toLocaleString()} by paying ${bill.supplierName} early`,
            potentialImpact: { type: 'savings', amount: savings },
            confidence: 1.0,
          });
        }
      }
    }

    // Rule 3: Bulk payment optimization
    const upcomingPayments = pendingBills.filter(b =>
      this.getDaysUntilDue(b.dueDate) <= 7
    );

    if (upcomingPayments.length >= 3) {
      const totalAmount = upcomingPayments.reduce((sum, b) => sum + b.amount, 0);

      this.addRecommendation({
        agentName: 'Vendor Payment Agent',
        category: 'vendor',
        priority: 'medium',
        actionType: 'suggestion',
        title: 'Bulk Payment Opportunity',
        message: `${upcomingPayments.length} payments due this week (₹${totalAmount.toLocaleString()})`,
        insight: 'Schedule all for your peak revenue day to optimize cash flow',
        confidence: 0.9,
      });
    }
  }

  private getDaysUntilDue(dueDate: string): number {
    const now = new Date();
    const due = new Date(dueDate);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
}
```

**Advantages**:
- ✅ Instant results (<100ms)
- ✅ Zero API costs
- ✅ Works offline
- ✅ 100% deterministic and debuggable
- ✅ No rate limits

**When to use**:
- Simple threshold-based alerts
- Date/time calculations
- Arithmetic comparisons
- Data aggregation

---

### 2. Tier 2: AI-Enhanced Agents (Cloudflare Worker + Gemini Flash)

**Technology Stack**:
- Cloudflare Worker (edge compute)
- Gemini 1.5 Flash API
- D1 database for data fetching
- Structured JSON output

**Architecture Flow**:

```
Frontend                Worker                  Gemini Flash
   │                       │                         │
   ├──POST /api/insights/menu-optimization          │
   │                       │                         │
   │                       ├──Fetch sales data (D1)  │
   │                       ├──Fetch inventory costs  │
   │                       ├──Fetch menu items       │
   │                       │                         │
   │                       ├──Build context prompt───┤
   │                       │                         │
   │                       │          Analyze patterns│
   │                       │          Generate insights
   │                       │                         │
   │                       │◄────JSON recommendations─┤
   │                       │                         │
   │◄──────recommendations─┤                         │
   │                       │                         │
```

**Example: Menu Optimization Worker**

```typescript
// workers/business-intelligence-ai/src/agents/MenuOptimizationAgent.ts

interface MenuOptimizationRequest {
  tenant_id: string;
  time_range: 'week' | 'month'; // Last week or month
  min_confidence?: number;
}

interface MenuInsight {
  item_id: string;
  item_name: string;
  issue_type: 'high_food_cost' | 'low_sales' | 'waste_risk' | 'pricing_opportunity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  current_metrics: {
    food_cost_percentage?: number;
    sales_count?: number;
    revenue?: number;
    profit_margin?: number;
  };
  recommendation: string;
  suggested_actions: Array<{
    action: string;
    impact_estimate: string;
  }>;
  confidence: number;
}

export async function analyzeMenuOptimization(
  request: MenuOptimizationRequest,
  env: Env
): Promise<MenuInsight[]> {
  // 1. Fetch data from D1
  const [salesData, inventoryData, recipeData] = await Promise.all([
    getSalesData(request.tenant_id, request.time_range, env),
    getInventoryCosts(request.tenant_id, env),
    getRecipeIngredients(request.tenant_id, env)
  ]);

  // 2. Calculate food costs for each menu item
  const menuAnalysis = salesData.map(item => {
    const recipe = recipeData.find(r => r.menuItemId === item.id);
    const foodCost = calculateFoodCost(recipe, inventoryData);
    const foodCostPercentage = (foodCost / item.averagePrice) * 100;

    return {
      id: item.id,
      name: item.name,
      salesCount: item.totalSales,
      revenue: item.totalRevenue,
      averagePrice: item.averagePrice,
      foodCost,
      foodCostPercentage,
      profitMargin: ((item.averagePrice - foodCost) / item.averagePrice) * 100
    };
  });

  // 3. Build AI prompt with context
  const prompt = buildMenuOptimizationPrompt(menuAnalysis, request.time_range);

  // 4. Call Gemini Flash
  const geminiApiKey = await getTokenFromManager('gemini:api_key', env);
  const aiResponse = await callGemini(prompt, geminiApiKey, {
    temperature: 0.2, // Low temperature for consistent recommendations
    responseMimeType: 'application/json'
  });

  // 5. Parse and validate response
  const insights: MenuInsight[] = JSON.parse(aiResponse.text).insights;

  // 6. Filter by confidence threshold
  const minConfidence = request.min_confidence || 0.7;
  return insights.filter(i => i.confidence >= minConfidence);
}

function buildMenuOptimizationPrompt(
  menuAnalysis: any[],
  timeRange: string
): string {
  return `You are a restaurant business analyst. Analyze menu performance and provide actionable recommendations.

**Time Period**: Last ${timeRange}
**Menu Items** (${menuAnalysis.length} total):

${menuAnalysis.map(item => `
- **${item.name}** (${item.id})
  - Sales: ${item.salesCount} orders
  - Revenue: ₹${item.revenue.toLocaleString()}
  - Avg Price: ₹${item.averagePrice}
  - Food Cost: ₹${item.foodCost.toFixed(2)} (${item.foodCostPercentage.toFixed(1)}%)
  - Profit Margin: ${item.profitMargin.toFixed(1)}%
`).join('\n')}

**Task**: Identify menu optimization opportunities

**Focus on**:
1. Items with food cost >35% (target: 28-32%)
2. Items with <10 sales per week (consider removing or promoting)
3. Items with expiring ingredients (reduce waste)
4. Pricing opportunities (demand is high, can increase price)

**Output Format** (JSON only):
{
  "insights": [
    {
      "item_id": "menu-123",
      "item_name": "Butter Chicken",
      "issue_type": "high_food_cost",
      "severity": "high",
      "current_metrics": {
        "food_cost_percentage": 42.5,
        "sales_count": 87,
        "revenue": 15660,
        "profit_margin": 57.5
      },
      "recommendation": "Food cost is 42.5%, exceeding target of 30-32%. This impacts profitability.",
      "suggested_actions": [
        {
          "action": "Increase price from ₹180 to ₹210",
          "impact_estimate": "Improve margin to 33% food cost, +₹2,610/month revenue"
        },
        {
          "action": "Reduce portion size by 15%",
          "impact_estimate": "Lower food cost to 36%, save ₹1,200/month"
        }
      ],
      "confidence": 0.92
    }
  ]
}

**Important**:
- Only suggest realistic, actionable changes
- Calculate impact estimates based on current sales volume
- Prioritize high-impact, low-effort changes
- Be specific with numbers (exact percentages, amounts)
`;
}

async function callGemini(
  prompt: string,
  apiKey: string,
  options: { temperature: number; responseMimeType: string }
) {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: 4096,
        responseMimeType: options.responseMimeType
      }
    })
  });

  const data = await response.json();
  return {
    text: data.candidates[0].content.parts[0].text,
    promptTokens: data.usageMetadata.promptTokenCount,
    completionTokens: data.usageMetadata.candidatesTokenCount
  };
}
```

**Cost Estimate**:
- Gemini 1.5 Flash: $0.075 per 1M input tokens, $0.30 per 1M output tokens
- Typical request: ~2000 input tokens, ~1000 output tokens
- **Cost per request: ~$0.00045** (less than half a cent!)
- 1000 requests/month = **$0.45/month**

**When to use**:
- Pattern recognition in data
- Multi-factor optimization
- Natural language insights
- Predictive analysis
- Anomaly detection

---

### 3. Tier 3: Deep AI Analysis (Optional - User Triggered)

**Use cases**:
- Comprehensive business health reports (monthly)
- Strategic menu redesign recommendations
- Competitive positioning analysis
- Long-term forecasting

**Technology**:
- Gemini Pro (more expensive, more capable)
- Or Claude 3.5 Sonnet (via Anthropic API)
- Triggered manually by owner, not automated

**Cost**: $0.01-0.05 per request (only when user requests)

---

## Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       TAURI APP (Frontend)                        │
│                                                                   │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ Agent          │         │ Zustand        │                  │
│  │ Orchestrator   │◄────────┤ Stores         │                  │
│  └────────────────┘         │ (Data Sources) │                  │
│         │                   └────────────────┘                  │
│         │                                                         │
│         ├──► Tier 1: Local Rule Agents (instant, free)          │
│         │                                                         │
│         └──► Tier 2: API call to Cloudflare Worker              │
└──────────────────┼──────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (business-intelligence-ai)         │
│                                                                   │
│  1. Receive request with tenant_id and analysis type             │
│  2. Fetch data from D1 database                                  │
│  3. Build context prompt with structured data                    │
│  4. Call Gemini Flash API                                        │
│  5. Parse JSON response                                          │
│  6. Return insights to frontend                                  │
│                                                                   │
└──────────────────┼──────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      GEMINI 1.5 FLASH API                         │
│                                                                   │
│  • Receives: Structured prompt with restaurant data              │
│  • Analyzes: Patterns, trends, anomalies                         │
│  • Returns: JSON with actionable recommendations                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Agent Scheduling Strategy

### Immediate Triggers (Real-time)
- Payment due alerts: Check on app load + daily
- Low stock alerts: On inventory update
- Out-of-stock items: Immediate (already implemented)
- Order anomalies: On each order completion

### Periodic Analysis (Background)
- **Every 5 minutes**: Sales monitoring, cash flow
- **Every 30 minutes**: Menu performance, kitchen efficiency
- **Hourly**: Labor cost analysis, aggregator performance
- **Daily (9 AM)**: Overnight summary, vendor payment reminders
- **Weekly (Monday 9 AM)**: Comprehensive business health report

### User-Triggered (On-demand)
- Deep business analysis
- Strategic recommendations
- "What if" scenario modeling

---

## Prompt Engineering Best Practices

### 1. Structured Data Input
Instead of:
```
"Analyze this restaurant's menu performance"
```

Use:
```json
{
  "task": "menu_optimization",
  "data": {
    "menu_items": [...],
    "sales_last_30_days": [...],
    "food_costs": [...]
  },
  "constraints": {
    "target_food_cost": 30,
    "min_sales_threshold": 10
  },
  "output_format": "json"
}
```

### 2. Few-Shot Examples
Include 1-2 example insights in the prompt:

```
Example output:
{
  "item_name": "Paneer Tikka",
  "issue": "Low sales (3 orders/week)",
  "recommendation": "Remove from menu or create combo offer",
  "confidence": 0.85
}
```

### 3. Confidence Scores
Always ask AI to provide confidence scores (0-1) for filtering

### 4. Structured Output
Use `responseMimeType: 'application/json'` in Gemini config to force JSON

---

## Cost Analysis

### Monthly Cost Estimate (500 customers/restaurant)

| Agent Type | Frequency | Requests/Month | Cost/Request | Monthly Cost |
|------------|-----------|----------------|--------------|--------------|
| Tier 1 (Rules) | Continuous | Unlimited | $0 | **$0** |
| Menu Optimization | Daily | 30 | $0.0005 | **$0.015** |
| Sales Intelligence | Hourly | 720 | $0.0003 | **$0.216** |
| Labor Analysis | Daily | 30 | $0.0004 | **$0.012** |
| Vendor Payments | Daily | 30 | $0.0002 | **$0.006** |
| Anomaly Detection | Per Order | 500 | $0.0001 | **$0.050** |
| **Total** | | | | **$0.30/month** |

**Per restaurant**: Less than $1/month for AI-powered insights!

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Create types and store ([proactive-agent.ts])
2. Implement Agent Orchestrator
3. Build 3 Tier 1 rule-based agents:
   - Vendor Payment Agent
   - Stock Alert Agent
   - Sales Target Agent

### Phase 2: AI Workers (Week 3-4)
1. Create `business-intelligence-ai` Cloudflare Worker
2. Implement Menu Optimization Agent (Tier 2)
3. Implement Sales Anomaly Detection Agent
4. Build UI panel for recommendations

### Phase 3: Advanced Agents (Week 5-6)
1. Labor Cost Optimization Agent
2. Customer Behavior Agent
3. Kitchen Performance Agent
4. Aggregator Profitability Agent

### Phase 4: Polish & Learning (Week 7-8)
1. Implement user feedback loop (accept/reject recommendations)
2. Track recommendation accuracy
3. A/B test prompt variations
4. Add Tier 3 deep analysis (optional)

---

## Sample API Endpoints

### Worker: `business-intelligence-ai.workers.dev`

```
POST /api/insights/:tenantId/menu-optimization
POST /api/insights/:tenantId/sales-anomalies
POST /api/insights/:tenantId/labor-efficiency
POST /api/insights/:tenantId/customer-patterns
POST /api/insights/:tenantId/aggregator-performance
POST /api/insights/:tenantId/business-health (Tier 3)
```

### Request Format
```json
{
  "time_range": "week",
  "min_confidence": 0.7,
  "options": {
    "focus_areas": ["food_cost", "pricing"]
  }
}
```

### Response Format
```json
{
  "success": true,
  "insights": [
    {
      "id": "insight-123",
      "type": "menu_optimization",
      "priority": "high",
      "title": "High Food Cost Alert",
      "message": "Butter Chicken has 42% food cost (target: 30%)",
      "actions": [...],
      "confidence": 0.92,
      "impact": {
        "type": "cost_reduction",
        "amount": 2400,
        "currency": "INR"
      }
    }
  ],
  "metadata": {
    "model": "gemini-1.5-flash",
    "processing_time_ms": 450,
    "cost_usd": 0.00043
  }
}
```

---

## Fallback Strategy (If Gemini API Fails)

1. **Primary**: Gemini 1.5 Flash
2. **Fallback 1**: Cloudflare Workers AI (free tier, 100k requests/day)
3. **Fallback 2**: Rule-based approximation (degraded insights)

```typescript
async function analyzeWithFallback(prompt: string, env: Env) {
  try {
    return await callGemini(prompt, env);
  } catch (error) {
    console.warn('Gemini failed, trying Cloudflare AI', error);
    try {
      return await callCloudflareAI(prompt, env);
    } catch (error2) {
      console.warn('Cloudflare AI failed, using rule-based fallback', error2);
      return ruleBasedApproximation(prompt);
    }
  }
}
```

---

## Security & Privacy

### Data Handling
- ✅ All data stays in your Cloudflare account (D1, Workers)
- ✅ Gemini API processes data but doesn't store it
- ✅ No third-party analytics or tracking
- ✅ Tenant isolation via tenant_id

### API Key Management
- ✅ Use existing `token-manager` worker for secrets
- ✅ Never expose API keys to frontend
- ✅ Rotate keys periodically

---

## Monitoring & Debugging

### Metrics to Track
1. **Agent Performance**:
   - Recommendation acceptance rate (user clicks "Accept")
   - Dismissal rate
   - Action completion rate

2. **AI Performance**:
   - API latency (p50, p95, p99)
   - Token usage per request
   - Cost per insight
   - Error rate

3. **Business Impact**:
   - Money saved from vendor payment optimization
   - Revenue increase from menu pricing changes
   - Labor cost reduction from scheduling improvements

### Logging
```typescript
// Log all AI requests
console.log({
  timestamp: new Date().toISOString(),
  tenant_id: tenantId,
  agent: 'menu-optimization',
  prompt_tokens: 2341,
  completion_tokens: 876,
  cost_usd: 0.00045,
  latency_ms: 450,
  confidence_avg: 0.87
});
```

---

## Conclusion

**Recommended Architecture**: **Hybrid (Rule-Based + Gemini Flash Context)**

**Why This Wins**:
1. ✅ **Cost-effective**: $0.30/month per restaurant
2. ✅ **Fast**: 80% of insights instant (Tier 1 rules)
3. ✅ **Accurate**: AI analyzes complex patterns where rules can't
4. ✅ **Scalable**: Cloudflare Workers handle global traffic
5. ✅ **Maintainable**: Easy to update prompts, no model training
6. ✅ **Real-time**: Always uses fresh data from D1
7. ✅ **Proven**: Leverages existing infrastructure (recipe-ai pattern)

**Next Steps**:
1. Start with Tier 1 rule-based agents (zero cost, immediate value)
2. Add Tier 2 AI agents one at a time (validate ROI)
3. Iterate based on user feedback and acceptance rates
4. Consider Tier 3 only if users explicitly request deep analysis

---

**Total Implementation Time**: 6-8 weeks
**Total Monthly Cost**: <$1 per restaurant
**Expected Value**: 10-30% improvement in operational efficiency

# Testing the Business Intelligence AI Agent

## ✅ **What's Been Implemented**

1. **Cloudflare Worker**: `business-intelligence-ai` deployed at:
   - URL: https://business-intelligence-ai.suyesh.workers.dev
   - Status: ✅ Deployed and running

2. **Menu Optimization Agent**: First AI agent using Gemini 1.5 Flash
   - Analyzes menu profitability
   - Identifies high food cost items
   - Suggests pricing opportunities
   - Flags low-performing items

3. **Frontend Service**: `BusinessIntelligenceAPI` class in [src/services/businessIntelligenceApi.ts](../../src/services/businessIntelligenceApi.ts)

---

## 🧪 **How to Test**

### Option 1: Test via cURL (Quick Test)

```bash
# Health check
curl https://business-intelligence-ai.suyesh.workers.dev/health | jq .

# Test menu optimization (replace TENANT_ID with your actual tenant)
curl -X POST \
  https://business-intelligence-ai.suyesh.workers.dev/api/insights/YOUR_TENANT_ID/menu-optimization \
  -H "Content-Type: application/json" \
  -d '{
    "time_range": "month",
    "min_confidence": 0.6,
    "options": {
      "target_food_cost_percentage": 30
    }
  }' | jq .
```

### Option 2: Test from Frontend (Recommended)

Add this to your React component:

```typescript
import { createBusinessIntelligenceAPI } from '../services/businessIntelligenceApi';

// In your component
const tenantId = 'your-tenant-id';
const biApi = createBusinessIntelligenceAPI(tenantId);

const testMenuOptimization = async () => {
  const result = await biApi.getMenuOptimization({
    time_range: 'week',
    min_confidence: 0.7
  });

  console.log('Menu Optimization Result:', result);

  if (result.success) {
    console.log(`Found ${result.insights.length} insights`);
    console.log(`Processing time: ${result.metadata.processing_time_ms}ms`);
    console.log(`Cost: $${result.metadata.cost_usd}`);

    result.insights.forEach(insight => {
      console.log(`\n${insight.item_name} - ${insight.issue_type}`);
      console.log(insight.recommendation);
      insight.suggested_actions.forEach(action => {
        console.log(`  • ${action.action}: ${action.impact_estimate}`);
      });
    });
  }
};
```

---

## ⚠️ **Current Issue: Tenant D1 Mapping**

The tenant `coorg-food-company-6163` doesn't have a D1 database mapping in KV.

### Check if Your Tenant Has D1:

```bash
# Check tenant metadata
npx wrangler kv key get "tenant:YOUR_TENANT_ID:d1" \
  --namespace-id=a9644721cac748608d3b15bf2095436b
```

### Tenants That Have D1 (Examples from your system):
- `test-7492`
- `kalyani-6207`
- `kalyani-7138`
- `airarang-8131`

### Solution Options:

1. **Create D1 mapping for coorg-food-company-6163**:
   ```bash
   # You'll need to create or link the D1 database
   npx wrangler kv key put \
     "tenant:coorg-food-company-6163:d1" \
     '{"databaseId":"YOUR_D1_DATABASE_ID"}' \
     --namespace-id=a9644721cac748608d3b15bf2095436b
   ```

2. **Test with an existing tenant that has D1**:
   ```bash
   curl -X POST \
     https://business-intelligence-ai.suyesh.workers.dev/api/insights/test-7492/menu-optimization \
     -H "Content-Type: application/json" \
     -d '{"time_range": "month"}' | jq .
   ```

---

## 📊 **Example Response**

When successful, you'll get:

```json
{
  "success": true,
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
      "recommendation": "Food cost is 42.5%, well above target of 30%. This impacts profitability.",
      "suggested_actions": [
        {
          "action": "Increase price from ₹180 to ₹210",
          "impact_estimate": "Reduce food cost to 36%, add ₹2,610/month revenue"
        },
        {
          "action": "Reduce portion size by 15%",
          "impact_estimate": "Lower food cost to 36%, save ₹1,100/month"
        }
      ],
      "confidence": 0.92
    }
  ],
  "summary": {
    "total_items_analyzed": 25,
    "high_priority_issues": 4,
    "potential_monthly_impact": 8500,
    "avg_food_cost_percentage": 28.5
  },
  "metadata": {
    "model": "gemini-1.5-flash",
    "processing_time_ms": 650,
    "prompt_tokens": 2341,
    "completion_tokens": 876,
    "cost_usd": 0.00045
  }
}
```

---

## 💰 **Cost Per Request**

Based on testing:
- ~2000-3000 input tokens (your sales data)
- ~1000-1500 output tokens (AI insights)
- **Cost: ~$0.0004 - $0.0006 per request** (less than 1/10th of a penny!)

---

## 🎯 **Next Steps**

1. **Fix D1 mapping** for `coorg-food-company-6163` or test with a tenant that has D1
2. **Build UI component** to display recommendations (see [PROACTIVE_AGENTS_TECHNICAL_ARCHITECTURE.md](../../PROACTIVE_AGENTS_TECHNICAL_ARCHITECTURE.md))
3. **Add more agents**:
   - Sales Intelligence Agent
   - Labor Cost Optimization Agent
   - Vendor Payment Agent (rule-based, no AI needed)

---

## 🐛 **Debugging**

Check worker logs:
```bash
npx wrangler tail business-intelligence-ai --format pretty
```

Check worker environment:
```bash
curl https://business-intelligence-ai.suyesh.workers.dev/debug/env
```

---

## 📁 **Files Created**

- `workers/business-intelligence-ai/` - Worker source code
  - `src/index.ts` - Main entry point
  - `src/agents/menuOptimization.ts` - Menu optimization agent
  - `src/utils/database.ts` - D1 database queries
  - `src/utils/gemini.ts` - Gemini API client
  - `src/types.ts` - TypeScript types
- `src/services/businessIntelligenceApi.ts` - Frontend API client
- `PROACTIVE_AGENTS_TECHNICAL_ARCHITECTURE.md` - Complete technical design doc

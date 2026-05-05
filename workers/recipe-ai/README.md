# Recipe AI Worker

AI-powered recipe generation using Gemini 1.5 Flash API. Automatically generates ingredient lists for menu items by matching them to existing inventory items.

## Features

- **AI Recipe Generation**: Uses Gemini 1.5 Flash to extract realistic recipe ingredients from menu item names and descriptions
- **Smart Ingredient Matching**: Exact + fuzzy matching to link AI suggestions with existing inventory items
- **Cost Tracking**: Reports API token usage and cost per request (~$0.001 per 10 items)
- **Confidence Scores**: Provides confidence metrics for both overall recipes and individual ingredient matches
- **Multi-Tenant**: Supports multiple restaurants via tenant IDs

## API Endpoints

### POST /api/recipes/:tenantId/generate

Generate recipe suggestions for menu items.

**Request:**
```json
{
  "menu_items": [
    {
      "id": "item-123",
      "name": "Butter Chicken",
      "description": "Creamy tomato curry with tender chicken",
      "category": "Main Course"
    }
  ],
  "options": {
    "cuisineType": "Indian",
    "minConfidence": 0.7,
    "restaurantType": "fine_dining"
  }
}
```

**Response:**
```json
{
  "success": true,
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
        }
      ]
    }
  ],
  "metadata": {
    "model": "gemini-1.5-flash",
    "processing_time_ms": 3200,
    "prompt_tokens": 6300,
    "completion_tokens": 2000,
    "cost_usd": 0.001
  }
}
```

### GET /health

Health check endpoint.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Secrets

Set the Gemini API key and Cloudflare API token:

```bash
# Get your Gemini API key from: https://aistudio.google.com/app/apikey
wrangler secret put GEMINI_API_KEY

# Cloudflare API token for D1 database access (same as handsfree-orders worker)
wrangler secret put CLOUDFLARE_API_TOKEN
```

### 3. Deploy

```bash
# Deploy to production
npm run deploy

# Or run locally for development
npm run dev
```

### 4. View Logs

```bash
npm run tail
```

## Environment Variables

Set in `wrangler.jsonc`:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `TENANT_METADATA`: KV namespace binding (shared with handsfree-orders)

## Architecture

```
POS App
  ↓
  POST /api/recipes/:tenantId/generate
  ↓
Recipe AI Worker
  ↓
  1. Fetch inventory items from D1
  ↓
  2. Build prompt with inventory context
  ↓
  3. Call Gemini 1.5 Flash API
  ↓
  4. Parse JSON response
  ↓
  5. Fuzzy match ingredients to inventory
  ↓
  6. Return suggestions with confidence scores
```

## Cost Estimates

**Per-Request Pricing:**
- Input tokens: $0.075 per 1M tokens
- Output tokens: $0.30 per 1M tokens
- Average: ~$0.001 per 10 menu items

**Monthly Estimates:**
| Restaurant Size | Requests | Cost/Month |
|----------------|----------|------------|
| Small (50 items, 1x) | 5 | $0.005 |
| Medium (200 items, 2x) | 40 | $0.04 |
| Large (1000 items, 4x) | 400 | $0.40 |

## Matching Strategies

### 1. Exact Match (Confidence: 1.0)
Case-insensitive exact string match.

Example: "Tomatoes" → "tomatoes" (inventory item)

### 2. Fuzzy Match (Confidence: 0.70-0.85)
Levenshtein distance < 3 characters.

Example: "Chicken Breast" → "Chicken breast boneless"

### 3. No Match (Confidence: 0)
Mark as `is_new_item: true` for user to resolve.

## Testing

### Example Request:

```bash
curl -X POST https://recipe-ai.suyesh.workers.dev/api/recipes/test-tenant/generate \
  -H "Content-Type: application/json" \
  -d '{
    "menu_items": [
      {
        "id": "item-1",
        "name": "Paneer Tikka",
        "description": "Grilled cottage cheese with spices",
        "category": "Starter"
      }
    ],
    "options": {
      "cuisineType": "Indian"
    }
  }'
```

## Error Handling

- **400**: Invalid request (no menu items)
- **500**: Gemini API error or parsing failure
- **Retry Strategy**: 3 retries with exponential backoff (implemented in frontend)

## Monitoring

View real-time logs:
```bash
wrangler tail recipe-ai
```

Check worker health:
```bash
curl https://recipe-ai.suyesh.workers.dev/health
```

## Development

### Local Testing

```bash
# Start local development server
npm run dev

# Test with local endpoint
curl -X POST http://localhost:8787/api/recipes/test-tenant/generate \
  -H "Content-Type: application/json" \
  -d '{"menu_items":[{"id":"1","name":"Test Item"}]}'
```

### Production Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Verify deployment
curl https://recipe-ai.suyesh.workers.dev/health
```

## License

MIT

## Support

For issues or questions, contact support@handsfree.tech

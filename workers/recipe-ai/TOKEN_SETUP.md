# Recipe AI Worker - Token Setup

The recipe-ai worker needs access to two tokens from the token-manager:

1. **`gemini:api_key`** - Google Gemini API key for AI recipe generation
2. **`cloudflare:api_token`** - Cloudflare API token for D1 database access

## Quick Setup

Run the automated setup script:

```bash
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/scripts

# Set your admin API key (if you have it)
export ADMIN_API_KEY='your-admin-api-key-here'

# Set your Gemini API key (if you have it)
export GEMINI_API_KEY='your-gemini-api-key-here'

# Run the setup script
./setup-recipe-ai-tokens.sh
```

## Manual Setup

If you prefer to set this up manually:

### Step 1: Get the Admin API Key

The admin API key is stored as a secret in the token-manager worker. If you don't have it:

```bash
cd /Users/stonepot-tech/projects/handsfree-restaurant-new/platform/scripts
./get-admin-token.sh
```

### Step 2: Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Copy the key

### Step 3: Add Gemini API Key to Token Manager

```bash
TOKEN_MANAGER_URL="https://handsfree-token-manager.suyesh.workers.dev"

curl -X POST "$TOKEN_MANAGER_URL/api/admin/tokens" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "service": "gemini",
    "key": "api_key",
    "value": "YOUR_GEMINI_API_KEY",
    "metadata": {
      "purpose": "recipe-generation",
      "description": "Google Gemini API key for recipe generation",
      "model": "gemini-1.5-flash"
    }
  }'
```

### Step 4: Create Access Policy

```bash
curl -X POST "$TOKEN_MANAGER_URL/api/admin/policies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{
    "workerName": "recipe-ai",
    "allowedTokens": [
      "gemini:api_key",
      "cloudflare:api_token"
    ]
  }'
```

### Step 5: Verify Access

```bash
# Test Gemini API key access
curl -X GET "$TOKEN_MANAGER_URL/api/tokens/gemini%3Aapi_key" \
  -H "X-Worker-Name: recipe-ai"

# Test Cloudflare API token access
curl -X GET "$TOKEN_MANAGER_URL/api/tokens/cloudflare%3Aapi_token" \
  -H "X-Worker-Name: recipe-ai"
```

Both should return a success response with the token value.

## Verifying the Worker

Once the tokens are set up, test the recipe-ai worker:

```bash
# Health check
curl https://recipe-ai.suyesh.workers.dev/health

# Test recipe generation (replace TENANT_ID with an actual tenant ID)
curl -X POST https://recipe-ai.suyesh.workers.dev/api/recipes/TENANT_ID/generate \
  -H "Content-Type: application/json" \
  -d '{
    "menu_items": [
      {
        "id": "item-1",
        "name": "Butter Chicken",
        "description": "Classic Indian curry",
        "category": "Main Course"
      }
    ],
    "options": {
      "cuisineType": "Indian",
      "restaurantType": "Indian Restaurant"
    }
  }'
```

## Troubleshooting

### "Access denied" error

Check that the access policy was created correctly:

```bash
curl -X GET "$TOKEN_MANAGER_URL/api/admin/policies" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Look for a policy with `workerName: "recipe-ai"`.

### "Token not found" error

Check that the tokens exist:

```bash
curl -X GET "$TOKEN_MANAGER_URL/api/admin/tokens" \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

Look for `gemini:api_key` and `cloudflare:api_token` in the list.

### "Failed to fetch Gemini API key from token-manager" error

This means the recipe-ai worker couldn't retrieve the token. Check:
1. Token exists in token-manager
2. Access policy is configured correctly
3. Worker name in policy matches "recipe-ai"

## Token Manager Architecture

The token-manager service provides secure, centralized token management:

- **Encrypted Storage**: All tokens encrypted at rest using AES-256-GCM
- **Access Control**: Per-worker access policies
- **Audit Logging**: Complete audit trail of token access

For more details, see [Token Manager README](/Users/stonepot-tech/projects/handsfree-restaurant-new/platform/workers/token-manager/README.md).

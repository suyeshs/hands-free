#!/bin/bash
#
# Deploy FileSearch Sync Worker
#
# This worker handles ALL menu synchronization:
# - D1 → KV sync (edge caching)
# - D1 → File Search sync (AI voice ordering)
# - Status monitoring
# - Webhooks for automatic syncing

set -e

echo "======================================================================"
echo "Menu Sync Worker Deployment"
echo "======================================================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npx tsc --noEmit

# Deploy to Cloudflare
echo ""
echo "🚀 Deploying to Cloudflare Workers..."
echo ""

wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "======================================================================"
    echo "Worker URL: https://filesearch-sync.YOUR_SUBDOMAIN.workers.dev"
    echo ""
    echo "Available Endpoints:"
    echo "  GET  /health"
    echo "  GET  /status/:tenantId"
    echo "  POST /status/batch"
    echo "  POST /sync/:tenantId                  - File Search sync"
    echo "  POST /sync/d1-to-kv/:tenantId         - D1 → KV sync"
    echo "  POST /sync/full/:tenantId             - Full sync (all systems)"
    echo "  POST /webhook/menu-updated            - Auto-sync webhook"
    echo ""
    echo "======================================================================"
    echo ""
    echo "Next Steps:"
    echo "1. Test health endpoint:"
    echo "   curl https://filesearch-sync.YOUR_SUBDOMAIN.workers.dev/health"
    echo ""
    echo "2. Check sync status:"
    echo "   curl https://filesearch-sync.YOUR_SUBDOMAIN.workers.dev/status/coorg-food-company-6163"
    echo ""
    echo "3. Trigger manual sync:"
    echo "   curl -X POST https://filesearch-sync.YOUR_SUBDOMAIN.workers.dev/sync/full/coorg-food-company-6163"
    echo ""
    echo "4. Configure POS to call webhook after menu changes"
    echo ""
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi

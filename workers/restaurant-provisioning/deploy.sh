#!/bin/bash

# Deploy Restaurant Provisioning Worker

set -e

echo "🚀 Deploying Restaurant Provisioning Worker..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Installing..."
    npm install -g wrangler
fi

# Deploy the worker
echo "📦 Deploying worker..."
wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Worker URL: https://handsfree-restaurant-provisioning.suyesh.workers.dev"
echo ""
echo "API Endpoints:"
echo "  - POST /api/provision           # Provision new restaurant"
echo "  - GET  /api/status/{tenantId}   # Check provisioning status"
echo "  - GET  /health                   # Health check"
echo ""
echo "Next steps:"
echo "1. Update POS app to use this endpoint instead of admin panel"
echo "2. Test provisioning with a test tenant"
echo "3. Monitor logs with: npm run tail"
echo ""

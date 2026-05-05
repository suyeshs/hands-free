#!/bin/bash
# Script to set up recipe-ai worker secrets

echo "Setting up recipe-ai worker secrets..."
echo ""
echo "1. CLOUDFLARE_API_TOKEN (same as handsfree-orders)"
echo "   This token is used to access D1 databases"
echo ""
echo "2. GEMINI_API_KEY"
echo "   Get from: https://aistudio.google.com/app/apikey"
echo "   Free tier: 15 RPM, 1500 requests/day"
echo ""
echo "Run these commands:"
echo "  cd /Users/stonepot-tech/projects/restaurant-pos-ai/workers/recipe-ai"
echo "  wrangler secret put CLOUDFLARE_API_TOKEN"
echo "  wrangler secret put GEMINI_API_KEY"
echo ""

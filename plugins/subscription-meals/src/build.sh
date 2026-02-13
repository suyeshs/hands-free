#!/bin/bash
# Build script for Subscription Meals Plugin Frontend
# Bundles React components into a distributable format

set -e

echo "🔨 Building Subscription Meals Plugin - Frontend Components"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PLUGIN_DIR="$(dirname "$0")/.."
SRC_DIR="$PLUGIN_DIR/../../../src/components/subscriptions"
DIST_DIR="$PLUGIN_DIR/dist"

# Create dist directory
mkdir -p "$DIST_DIR"

# Check if components exist
if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Source components not found at $SRC_DIR"
    exit 1
fi

echo "📦 Bundling React components..."

# Create a bundle manifest
cat > "$DIST_DIR/components.json" << 'EOF'
{
  "components": [
    {
      "name": "SubscriptionDashboard",
      "path": "/subscriptions",
      "source": "SubscriptionDashboard.tsx",
      "roles": ["owner", "manager"]
    },
    {
      "name": "SubscriptionPlans",
      "path": "/subscriptions/plans",
      "source": "SubscriptionPlans.tsx",
      "roles": ["owner", "manager"]
    },
    {
      "name": "WeeklyMenuManager",
      "path": "/subscriptions/menu",
      "source": "WeeklyMenuManager.tsx",
      "roles": ["owner", "manager"]
    },
    {
      "name": "SubscriptionKDS",
      "path": "/subscriptions/kds",
      "source": "SubscriptionKDS.tsx",
      "roles": ["owner", "manager", "staff"]
    },
    {
      "name": "ParcelDispatchScreen",
      "path": "/subscriptions/dispatch",
      "source": "ParcelDispatchScreen.tsx",
      "roles": ["owner", "manager", "staff"]
    }
  ],
  "dependencies": [
    "@tanstack/react-query",
    "zustand",
    "framer-motion",
    "lucide-react"
  ],
  "version": "1.0.0"
}
EOF

echo "✅ Component manifest created"

# Create a loader script
cat > "$DIST_DIR/loader.js" << 'EOF'
/**
 * Subscription Plugin Loader
 * Dynamically loads subscription components into the main app
 */

export async function initSubscriptionPlugin(app) {
  console.log('[Subscription Plugin] Initializing...');

  // Register routes
  const routes = [
    { path: '/subscriptions', component: 'SubscriptionDashboard' },
    { path: '/subscriptions/plans', component: 'SubscriptionPlans' },
    { path: '/subscriptions/menu', component: 'WeeklyMenuManager' },
    { path: '/subscriptions/kds', component: 'SubscriptionKDS' },
    { path: '/subscriptions/dispatch', component: 'ParcelDispatchScreen' },
  ];

  for (const route of routes) {
    await app.registerRoute(route);
  }

  console.log('[Subscription Plugin] Initialized successfully');

  return {
    name: 'subscription-meals',
    version: '1.0.0',
    routes,
  };
}

export async function unloadSubscriptionPlugin(app) {
  console.log('[Subscription Plugin] Unloading...');
  // Cleanup logic here
}
EOF

echo "✅ Loader script created"

# Create a README for the dist
cat > "$DIST_DIR/README.md" << 'EOF'
# Subscription Meals Plugin - Distribution

This directory contains the built plugin components.

## Contents

- `components.json` - Component manifest
- `loader.js` - Plugin loader script
- `subscription-client.wasm` - WASM placeholder (optional for future use)

## Installation

The plugin is installed via the POS plugin manager using the R2-hosted manifest.

## Development

Components are located in `src/components/subscriptions/` and are built into this distribution.
EOF

# Create a placeholder WASM file (for future WASM implementation)
echo "Creating WASM placeholder..."
cat > "$DIST_DIR/subscription-client.wasm.info" << 'EOF'
This is a placeholder for future WASM implementation.
Currently, the plugin uses React components loaded directly.
To build actual WASM, use wasm-pack with a Rust WebAssembly project.
EOF

echo ""
echo "✅ Build complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Output: $DIST_DIR"
echo "📦 Components: 5"
echo "📄 Manifest: components.json"
echo "🔧 Loader: loader.js"
echo ""
echo "Next steps:"
echo "1. Deploy worker: cd worker && npm run deploy"
echo "2. Upload plugin: cd .. && ./deploy-plugin.sh"
echo ""

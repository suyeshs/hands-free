#!/bin/bash
set -e

echo "🔨 Building all new plugin WASM modules..."
echo ""

# Array of plugin directories
PLUGINS=(
  "inventory-management"
  "people-payroll"
  "analytics-reports"
  "customer-crm"
  "multi-location-sync"
  "online-ordering-qr"
)

# Track build results
SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_PLUGINS=()

for plugin in "${PLUGINS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔨 Building $plugin..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ -d "$plugin/client" ]; then
    cd "$plugin/client"

    if ./build.sh; then
      echo "✅ $plugin built successfully"
      ((SUCCESS_COUNT++))
    else
      echo "❌ $plugin build failed"
      ((FAIL_COUNT++))
      FAILED_PLUGINS+=("$plugin")
    fi

    cd ../..
  else
    echo "⚠️  $plugin/client directory not found, skipping..."
  fi

  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed: $FAIL_COUNT"

if [ $FAIL_COUNT -gt 0 ]; then
  echo ""
  echo "Failed plugins:"
  for failed in "${FAILED_PLUGINS[@]}"; do
    echo "  - $failed"
  done
  exit 1
fi

echo ""
echo "🎉 All plugins built successfully!"
echo ""
echo "📦 WASM modules available in dist/plugins/"
ls -lh ../dist/plugins/*/

echo ""
echo "Next steps:"
echo "1. Calculate checksums: cd plugins && ./calculate-checksums.sh"
echo "2. Upload to R2: cd plugins && ./upload-wasm-to-r2.sh"

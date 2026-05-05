#!/bin/bash

# Script to remove Zustand persist() from stores that should use SQLite only
# Usage: ./remove-zustand-persist.sh

echo "🧹 Removing Zustand persist() from data stores..."

STORES_TO_FIX=(
  "src/stores/chainConfigStore.ts"
  "src/stores/inventoryStore.ts"
  "src/stores/payrollStore.ts"
  "src/stores/attendanceStore.ts"
  "src/stores/rosteringStore.ts"
  "src/stores/barInventoryStore.ts"
  "src/stores/leaveStore.ts"
  "src/stores/aggregatorExtractionStore.ts"
  "src/stores/trainingStore.ts"
  "src/stores/deliveryVerificationStore.ts"
  "src/stores/qrOrderingStore.ts"
  "src/stores/barPOSStore.ts"
  "src/stores/notificationStore.ts"
)

for store in "${STORES_TO_FIX[@]}"; do
  if [ ! -f "$store" ]; then
    echo "⏭️  Skipping $store (not found)"
    continue
  fi

  echo "📝 Processing $store..."

  # Create backup
  cp "$store" "${store}.bak"

  # Remove persist import line
  sed -i '' '/import.*persist.*from.*zustand\/middleware/d' "$store"

  echo "✅ Removed persist import from $store"
done

echo ""
echo "✅ Done! Backups created with .bak extension"
echo "⚠️  Manual review needed:"
echo "   - Remove persist() wrapper from create() calls"
echo "   - Remove persist config objects"
echo "   - Ensure SQLite methods exist for data persistence"
echo ""
echo "Run: git diff src/stores/ to review changes"

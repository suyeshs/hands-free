#!/bin/bash

# ========================================================================
# Archive the deprecated store-front worker
# ========================================================================
# This script moves the deprecated store-front worker to an _archived
# directory to prevent accidental use while keeping it for reference.
# ========================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$SCRIPT_DIR/store-front"
ARCHIVE_DIR="$SCRIPT_DIR/_archived"
ARCHIVED_WORKER="$ARCHIVE_DIR/store-front-deprecated-$(date +%Y%m%d)"

echo "========================================="
echo "Archive Deprecated Store-Front Worker"
echo "========================================="
echo ""

# Check if worker directory exists
if [ ! -d "$WORKER_DIR" ]; then
  echo "❌ Error: store-front worker directory not found at: $WORKER_DIR"
  exit 1
fi

# Check if already archived
if [ ! -d "$WORKER_DIR" ]; then
  echo "✅ Worker already archived or moved"
  exit 0
fi

echo "📦 This will archive the deprecated store-front worker"
echo ""
echo "   From: $WORKER_DIR"
echo "   To:   $ARCHIVED_WORKER"
echo ""
echo "⚠️  Important Notes:"
echo "   - The worker is already DEPRECATED and routes are DISABLED"
echo "   - Current routing is handled by: handsfree-proxy"
echo "   - This operation can be reversed by moving the folder back"
echo ""

read -p "Continue with archiving? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo ""
  echo "❌ Archive cancelled"
  exit 0
fi

echo ""
echo "📁 Creating archive directory..."
mkdir -p "$ARCHIVE_DIR"

echo "📦 Moving store-front worker to archive..."
mv "$WORKER_DIR" "$ARCHIVED_WORKER"

echo ""
echo "✅ Archive complete!"
echo ""
echo "📋 Summary:"
echo "   - Archived to: $ARCHIVED_WORKER"
echo "   - Active routing: handsfree-proxy (unchanged)"
echo "   - No impact on production (routes were already disabled)"
echo ""
echo "To restore (if needed):"
echo "   mv $ARCHIVED_WORKER $WORKER_DIR"
echo ""
echo "✅ Done!"

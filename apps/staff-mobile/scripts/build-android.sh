#!/bin/bash
# Build Android APK/AAB for HandsFree Staff Mobile App

set -e

echo "🚀 Building HandsFree Staff Mobile for Android..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from apps/staff-mobile directory"
    exit 1
fi

# Build type (default: debug)
BUILD_TYPE="${1:-debug}"

echo -e "${YELLOW}Build Type:${NC} $BUILD_TYPE"
echo ""

# Clean previous builds (optional)
if [ "$2" = "--clean" ]; then
    echo "🧹 Cleaning previous builds..."
    rm -rf src-tauri/gen/android/app/build
    rm -rf dist
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
bun install --silent
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Build frontend
echo "🏗️  Building frontend..."
bun run build
echo -e "${GREEN}✓${NC} Frontend built"
echo ""

# Build Rust dependencies
echo "⚙️  Building Rust dependencies..."
cd src-tauri
cargo build --release
cd ..
echo -e "${GREEN}✓${NC} Rust dependencies built"
echo ""

# Build Android
echo "📱 Building Android app..."
if [ "$BUILD_TYPE" = "release" ]; then
    bun run tauri android build
else
    bun run tauri android build --debug
fi

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""

# Show output location
if [ "$BUILD_TYPE" = "release" ]; then
    APK_PATH="src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
    if [ -f "$APK_PATH" ]; then
        echo "📦 APK Location:"
        echo "   $APK_PATH"
        echo ""
        echo "⚠️  Note: APK is unsigned. Sign before distribution."
    fi
else
    APK_PATH="src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk"
    if [ -f "$APK_PATH" ]; then
        echo "📦 Debug APK Location:"
        echo "   $APK_PATH"
        echo ""
        echo "📲 Install with:"
        echo "   adb install -r $APK_PATH"
    fi
fi

echo ""
echo "🎉 Done!"

#!/bin/bash

set -e

echo "🏗️  Building HandsFree Restaurant Android APKs..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build output directory
OUTPUT_DIR="builds/android-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

# Build Staff APK
echo -e "\n${BLUE}📱 Building STAFF APK...${NC}"
bun run android:build:staff

# Copy and rename
if [ -f "src-tauri/gen/android/app/build/outputs/apk/universal-release/app-universal-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/universal-release/app-universal-release.apk \
       "$OUTPUT_DIR/handsfree-staff-v3.1.0.apk"
elif [ -f "src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk \
       "$OUTPUT_DIR/handsfree-staff-v3.1.0.apk"
else
    echo -e "${YELLOW}⚠️  Could not find staff APK output${NC}"
fi

echo -e "${GREEN}✅ Staff APK built: $OUTPUT_DIR/handsfree-staff-v3.1.0.apk${NC}"

# Build Owner APK
echo -e "\n${BLUE}📱 Building OWNER APK...${NC}"
bun run android:build:owner

# Copy and rename
if [ -f "src-tauri/gen/android/app/build/outputs/apk/universal-release/app-universal-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/universal-release/app-universal-release.apk \
       "$OUTPUT_DIR/handsfree-owner-v3.1.0.apk"
elif [ -f "src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk \
       "$OUTPUT_DIR/handsfree-owner-v3.1.0.apk"
else
    echo -e "${YELLOW}⚠️  Could not find owner APK output${NC}"
fi

echo -e "${GREEN}✅ Owner APK built: $OUTPUT_DIR/handsfree-owner-v3.1.0.apk${NC}"

# Summary
echo -e "\n${GREEN}✅ Build complete!${NC}"
echo "📦 Output directory: $OUTPUT_DIR"
echo ""
echo "Staff APK: handsfree-staff-v3.1.0.apk"
echo "  Package ID: com.stonepot_tech.handsfree_pos.staff"
echo ""
echo "Owner APK: handsfree-owner-v3.1.0.apk"
echo "  Package ID: com.stonepot_tech.handsfree_pos.owner"

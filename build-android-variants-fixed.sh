#!/bin/bash

set -e

# Change to the script's directory (project root)
cd "$(dirname "$0")"

echo "🏗️  Building HandsFree Restaurant Android APKs (Fixed Method)..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build output directory
OUTPUT_DIR="builds/android-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

# ============= BUILD STAFF APK =============
echo -e "\n${BLUE}📱 Building STAFF APK...${NC}"

# Step 1: Build frontend for staff
echo "Building frontend (staff mode)..."
bun run build:staff

# Step 2: Remove existing Android project
echo "Cleaning Android project..."
rm -rf src-tauri/gen/android

# Step 3: Initialize Android project with staff config
# We'll temporarily use the staff config as the main config
echo "Setting up staff configuration..."
cp src-tauri/tauri.conf.staff.json src-tauri/tauri.conf.temp.json
cp src-tauri/tauri.conf.staff.json src-tauri/tauri.conf.json

# Step 4: Initialize Android project
echo "Initializing Android project for staff..."
cd src-tauri
cargo tauri android init
cd ..

# Step 5: Build APK
echo "Building staff APK..."
cd src-tauri
cargo tauri android build --apk
cd ..

# Step 6: Copy APK to output directory
if [ -f "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk \
       "$OUTPUT_DIR/handsfree-staff-v3.1.0.apk"
elif [ -f "src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk \
       "$OUTPUT_DIR/handsfree-staff-v3.1.0.apk"
else
    echo -e "${YELLOW}⚠️  Could not find staff APK output${NC}"
fi

echo -e "${GREEN}✅ Staff APK built successfully${NC}"

# Step 7: Restore original config
mv src-tauri/tauri.conf.temp.json src-tauri/tauri.conf.json

# ============= BUILD OWNER APK =============
echo -e "\n${BLUE}📱 Building OWNER APK...${NC}"

# Step 1: Build frontend for owner
echo "Building frontend (owner mode)..."
bun run build:owner

# Step 2: Remove existing Android project
echo "Cleaning Android project..."
rm -rf src-tauri/gen/android

# Step 3: Initialize Android project with owner config
echo "Setting up owner configuration..."
cp src-tauri/tauri.conf.owner.json src-tauri/tauri.conf.temp.json
cp src-tauri/tauri.conf.owner.json src-tauri/tauri.conf.json

# Step 4: Initialize Android project
echo "Initializing Android project for owner..."
cd src-tauri
cargo tauri android init
cd ..

# Step 5: Build APK
echo "Building owner APK..."
cd src-tauri
cargo tauri android build --apk
cd ..

# Step 6: Copy APK to output directory
if [ -f "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk \
       "$OUTPUT_DIR/handsfree-owner-v3.1.0.apk"
elif [ -f "src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk \
       "$OUTPUT_DIR/handsfree-owner-v3.1.0.apk"
else
    echo -e "${YELLOW}⚠️  Could not find owner APK output${NC}"
fi

echo -e "${GREEN}✅ Owner APK built successfully${NC}"

# Step 7: Restore original config
mv src-tauri/tauri.conf.temp.json src-tauri/tauri.conf.json

# ============= SUMMARY =============
echo -e "\n${GREEN}✅ Build complete!${NC}"
echo "📦 Output directory: $OUTPUT_DIR"
echo ""
echo "Staff APK: handsfree-staff-v3.1.0.apk"
echo "  Package ID: com.stonepot_tech.handsfree_pos.staff"
echo ""
echo "Owner APK: handsfree-owner-v3.1.0.apk"
echo "  Package ID: com.stonepot_tech.handsfree_pos.owner"
echo ""
echo "To install on device:"
echo "  adb install $OUTPUT_DIR/handsfree-staff-v3.1.0.apk"
echo "  adb install $OUTPUT_DIR/handsfree-owner-v3.1.0.apk"

#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        🔬 DIAGNOSTIC RESET & APP LAUNCH                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Kill all processes
echo "1️⃣  Killing all processes..."
pkill -9 -f "tauri" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null
pkill -9 -f "bun" 2>/dev/null
pkill -9 -f "cargo" 2>/dev/null
pkill -9 -f "restaurant" 2>/dev/null
lsof -ti:1420 | xargs kill -9 2>/dev/null
sleep 2
echo "   ✅ All processes killed"
echo ""

# Step 2: Show what exists BEFORE deletion
echo "2️⃣  Current state BEFORE deletion:"
echo ""
echo "   App Support directories:"
ls -la ~/Library/Application\ Support/ | grep handsfree 2>&1 | sed 's/^/     /'
if [ $? -ne 0 ]; then
    echo "     ✅ None found"
fi

echo ""
echo "   WebKit directories:"
ls -la ~/Library/WebKit/ | grep handsfree 2>&1 | sed 's/^/     /'
if [ $? -ne 0 ]; then
    echo "     ✅ None found"
fi

echo ""
echo "   Database files:"
find ~/Library/Application\ Support -name "*handsfree*.db" -o -name "*pos*.db" 2>/dev/null | sed 's/^/     /'
if [ $? -ne 0 ]; then
    echo "     ✅ None found"
fi

echo ""

# Step 3: Delete everything
echo "3️⃣  Deleting ALL application data..."
rm -rf ~/Library/Application\ Support/com.stonepot-tech.handsfree-pos* 2>/dev/null
rm -rf ~/Library/Caches/com.stonepot-tech.handsfree-pos* 2>/dev/null
rm -rf ~/Library/WebKit/com.stonepot-tech.handsfree-pos* 2>/dev/null
rm -rf ~/Library/WebKit/com.apple.WebKit.WebContent/ 2>/dev/null
rm -rf ~/Library/Preferences/com.stonepot-tech.handsfree-pos* 2>/dev/null
rm -rf ~/Library/Saved\ Application\ State/com.stonepot-tech.handsfree-pos* 2>/dev/null
rm -rf ~/Library/Containers/com.stonepot-tech.handsfree-pos* 2>/dev/null
rm -rf ~/.tauri/ 2>/dev/null
rm -rf ~/.local/share/com.stonepot-tech.handsfree-pos/ 2>/dev/null
find ~/Library/Application\ Support -name "*handsfree-pos*.db" -delete 2>/dev/null
find ~/Library/Application\ Support -name "*pos.db" -delete 2>/dev/null
echo "   ✅ Deletion commands executed"
echo ""

# Step 4: Verify deletion
echo "4️⃣  Verifying deletion (should see NOTHING below):"
echo ""
echo "   Checking App Support:"
ls -la ~/Library/Application\ Support/ | grep -i handsfree 2>&1 | sed 's/^/     /'
if [ $? -ne 0 ]; then
    echo "     ✅ Clean - no handsfree directories"
fi

echo ""
echo "   Checking WebKit:"
ls -la ~/Library/WebKit/ | grep -i handsfree 2>&1 | sed 's/^/     /'
if [ $? -ne 0 ]; then
    echo "     ✅ Clean - no handsfree directories"
fi

echo ""
echo "   Checking databases:"
find ~/Library -name "*handsfree*.db" -o -name "*pos.db" 2>/dev/null | sed 's/^/     /'
if [ $? -eq 0 ]; then
    DB_COUNT=$(find ~/Library -name "*handsfree*.db" -o -name "*pos.db" 2>/dev/null | wc -l)
    if [ "$DB_COUNT" -eq 0 ]; then
        echo "     ✅ Clean - no database files"
    else
        echo "     ⚠️  WARNING: Found $DB_COUNT database files!"
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              ✅ RESET COMPLETE                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 What to do next:"
echo "   1. Run: cd /Users/stonepot-tech/projects/restaurant-pos-ai"
echo "   2. Run: bun tauri dev"
echo "   3. Open DevTools (Cmd+Option+I)"
echo "   4. Look for the 🔍 STARTUP DIAGNOSTICS section in console"
echo "   5. Check if localStorage is EMPTY or has tenant-storage"
echo ""
echo "Expected result:"
echo "   ✅ localStorage is EMPTY (clean state)"
echo "   ✅ App shows Tenant Activation screen (NOT Hub)"
echo ""
echo "If you see tenant-storage in localStorage, that means:"
echo "   ⚠️  WebView storage is NOT being cleared properly"
echo "   ⚠️  We need to find the actual storage location"
echo ""

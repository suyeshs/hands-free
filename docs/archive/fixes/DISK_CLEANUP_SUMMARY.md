# Disk Space Cleanup Summary

## Disk Space Status

### Before Cleanup:
- **Total Disk:** 460 GB
- **Used:** 422 GB (99% full)
- **Available:** 8.4 GB ⚠️ CRITICAL

### After Cleanup:
- **Total Disk:** 460 GB
- **Used:** 415 GB (97% full)
- **Available:** 15 GB ✅ IMPROVED
- **Space Freed:** ~6.6 GB

## Files Deleted

### 1. Current Project (restaurant-pos-ai)
✅ **src-tauri/target/** - 4.3 GB
- Rust build cache (debug + release builds)
- Will be rebuilt on next `bun tauri dev`

✅ **releases/** - 12 MB
- Old Windows installers (v3.1 MSI/NSIS)

✅ **dist/** - 3 MB
- Old development build artifacts

**Project size:** 4.8 GB → 490 MB

### 2. Cargo Global Cache
✅ **~/.cargo/registry/** - 461 MB
- Removed unused crate source checkouts
- Downloaded crates remain (will re-download if needed)

### 3. Other Rust Projects
✅ **~/projects/test-tauri-1/src-tauri/target/** - 2.4 GB
✅ **~/projects/web-cam/src-tauri/target/** - 1.1 GB

**Total Freed:** ~6.6 GB

## Additional Cleanup Options

### Large node_modules Directories Found:
```
1.0 GB  - stonepot/node_modules
712 MB  - tcfc-main/node_modules
647 MB  - shiptrack-dash-app/node_modules
447 MB  - restaurant-pos-ai/node_modules (CURRENT PROJECT - keep)
369 MB  - handsfree-shopify-voice/node_modules
336 MB  - merch-overlay/overlay-app/node_modules
179 MB  - stonepot-do-app/node_modules
162 MB  - hands-free/node_modules
```

**Potential savings:** ~4-5 GB additional

### To Clean Old Projects:
```bash
# Check which projects you're actively using, then remove unused ones:

# Example: Delete node_modules from inactive projects
rm -rf ~/projects/stonepot/node_modules
rm -rf ~/projects/tcfc-main/node_modules
rm -rf ~/projects/shiptrack-dash-app/node_modules

# They will be reinstalled when you run npm/bun install next time
```

### Other Common Space Hogs:

#### Check Xcode Derived Data:
```bash
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null
# Can safely delete: rm -rf ~/Library/Developer/Xcode/DerivedData
```

#### Check Homebrew Cache:
```bash
du -sh ~/Library/Caches/Homebrew 2>/dev/null
# Clean with: brew cleanup
```

#### Check Docker:
```bash
docker system df
# Clean with: docker system prune -a
```

#### Check Application Caches:
```bash
du -sh ~/Library/Caches/* 2>/dev/null | sort -hr | head -10
```

## What Was Kept

✅ **node_modules/** in restaurant-pos-ai (447 MB)
- Currently needed for development

✅ **~/.cargo/bin/** (59 MB)
- Installed Cargo tools (cargo-cache, etc.)

✅ **~/.cargo/registry/** (2.8 GB)
- Downloaded crate archives (needed for fast rebuilds)

## Recommendations

### Immediate Actions:
1. ✅ **Rust target directories deleted** - Will rebuild automatically
2. ⚠️ **Still 97% full** - Consider deleting old projects entirely

### Long-term:
1. **Delete unused projects** from ~/projects/
2. **Set up Time Machine** to external drive for important files
3. **Move large files** (videos, images) to external storage
4. **Use cloud storage** for archived projects
5. **Enable macOS Storage Management:**
   - Apple Menu → About This Mac → Storage → Manage
   - Use recommendations to remove system junk

## Recovery Instructions

If you need to rebuild deleted caches:

### Rust Build Cache:
```bash
cd ~/projects/restaurant-pos-ai
bun tauri dev
# target/ will be rebuilt automatically (takes 2-3 minutes first time)
```

### Node Modules:
```bash
cd <project-directory>
npm install  # or: bun install
```

### Cargo Crates:
```bash
# Automatically downloaded when needed by cargo build
```

## Summary

- ✅ Freed 6.6 GB immediately
- ✅ Current project reduced from 4.8GB to 490MB
- ⚠️ Disk still 97% full - recommend cleaning old projects
- 💡 Potential 4-5GB more from unused node_modules

**Next steps:** Review ~/projects/ and delete inactive projects entirely to free more space.

# Dev Environment Reset Scripts

Quick reference for resetting your Bun + Tauri development environment.

## 🚀 Quick Start

### Full Reset (with confirmations)
```bash
bun run reset
# OR
./reset-dev.sh
```

### Quick Reset (no confirmations)
```bash
bun run reset:quick
# OR
./quick-reset.sh
```

---

## 📋 What Gets Reset

### Full Reset (`reset-dev.sh`)
✅ Stops dev server processes
✅ Deletes database files (`pos-dev.db`, `guanix.db`)
✅ Clears Tauri cache and build artifacts
✅ Clears Node/Bun cache
✅ Clears Vite cache
✅ Creates reset flag for browser
✅ Offers to restart dev server

### Quick Reset (`quick-reset.sh`)
✅ Stops dev server
✅ Deletes database files
✅ Clears Node/Vite cache
⚠️ **No confirmations** - instant reset!

---

## 🎯 Usage Examples

### Scenario 1: Full Clean Start
```bash
# Stop everything and reset completely
bun run reset

# Follow prompts:
# - Type 'yes' to confirm
# - Choose 'y' to restart dev server
# - Clear browser storage when prompted
```

### Scenario 2: Quick Test Reset
```bash
# Instant reset (no confirmations)
bun run reset:quick

# Restart manually:
bun run tauri dev

# Then clear browser storage
```

### Scenario 3: Database Only
```bash
# On macOS:
rm -rf ~/Library/Application\ Support/com.handsfree.pos/pos-dev.db*

# On Linux:
rm -rf ~/.local/share/com.handsfree.pos/pos-dev.db*

# Then restart dev server
```

---

## 🔧 Manual Steps

### Clear Browser Storage

After resetting, you must clear browser storage:

**Option A: Console (Recommended)**
```javascript
// Press F12 → Console → Run:
localStorage.clear();
sessionStorage.clear();
window.location.reload();
```

**Option B: Navigate to Reset URL**
```
/#/reset
```

**Option C: Complete Reset UI**
```
/#/complete-reset
```

---

## 📂 File Locations

### Database Files

**macOS:**
```
~/Library/Application Support/com.handsfree.pos/
  ├── pos-dev.db          # Development database
  ├── pos-dev.db-wal      # Write-ahead log
  ├── pos-dev.db-shm      # Shared memory
  └── guanix.db           # Production database (if exists)
```

**Linux:**
```
~/.local/share/com.handsfree.pos/
  ├── pos-dev.db
  ├── pos-dev.db-wal
  └── pos-dev.db-shm
```

**Windows:**
```
%APPDATA%\com.handsfree.pos\
  ├── pos-dev.db
  ├── pos-dev.db-wal
  └── pos-dev.db-shm
```

### Cache Directories

**Tauri Cache:**
- macOS: `~/Library/Caches/com.handsfree.pos`
- Linux: `~/.cache/com.handsfree.pos`

**Build Cache:**
- `src-tauri/target/debug/`
- `node_modules/.cache/`
- `.vite/`

---

## 🐛 Troubleshooting

### Script Permission Denied
```bash
chmod +x reset-dev.sh
chmod +x quick-reset.sh
```

### Dev Server Won't Stop
```bash
# Force kill all processes
pkill -9 -f "tauri dev"
pkill -9 -f "vite"
pkill -9 -f "bun.*dev"
```

### Database Still Exists After Reset
```bash
# Manual deletion (macOS)
rm -rf ~/Library/Application\ Support/com.handsfree.pos/

# Create fresh directory
mkdir -p ~/Library/Application\ Support/com.handsfree.pos/
```

### Browser Storage Not Clearing
```bash
# Hard refresh after clearing
# Chrome/Safari: Cmd+Shift+R
# Firefox: Ctrl+Shift+R

# Or use Incognito/Private mode for testing
```

### Reset Script Fails
```bash
# Check what's running
ps aux | grep -E "tauri|vite|bun"

# Check database files
ls -la ~/Library/Application\ Support/com.handsfree.pos/

# Check logs
tail -f /tmp/tauri-dev.log  # If dev server was started
```

---

## 🔍 Script Details

### `reset-dev.sh`

**Features:**
- Interactive prompts
- Colored output
- Step-by-step progress
- Safe confirmations
- Automatic restart option
- Platform detection (macOS/Linux/Windows)

**When to use:**
- Starting completely fresh
- Before important testing
- After major code changes
- When debugging persistence issues

### `quick-reset.sh`

**Features:**
- No confirmations
- Minimal output
- Fast execution
- Essential cleanup only

**When to use:**
- Rapid development iterations
- Quick testing cycles
- When you know what you're doing
- Automated testing scripts

---

## 📝 After Reset Checklist

After running a reset script:

- [ ] Dev server restarted (or start with `bun run tauri dev`)
- [ ] Browser storage cleared (run in console: `localStorage.clear()`)
- [ ] Page reloaded (Cmd+R or Ctrl+R)
- [ ] Navigate to activation page (`/#/activate`)
- [ ] Complete setup wizard
- [ ] Verify fresh state

---

## 🎨 Example Workflow

### Typical Dev Reset Flow

```bash
# 1. Make code changes
git pull origin main
bun install

# 2. Reset environment
bun run reset:quick

# 3. Start dev server
bun run tauri dev

# 4. In browser console:
localStorage.clear()
sessionStorage.clear()
location.reload()

# 5. Test fresh setup
# Navigate to /#/activate
# Complete wizard
# Test features
```

---

## 🆘 Need Help?

- **Check console logs** for detailed error messages
- **Run with verbose**: `bash -x reset-dev.sh`
- **Manual cleanup**: Delete files manually from locations above
- **Fresh clone**: If all else fails, clone the repo again

---

## 📚 Related Files

- `reset-dev.sh` - Full reset script
- `quick-reset.sh` - Quick reset script
- `src/lib/resetEverything.ts` - UI reset logic
- `src/pages/CompleteReset.tsx` - Reset UI page
- `RESET_GUIDE.md` - Complete reset guide

---

**Last Updated:** 2024-02-10
**Tested On:** macOS (Darwin), should work on Linux/Windows

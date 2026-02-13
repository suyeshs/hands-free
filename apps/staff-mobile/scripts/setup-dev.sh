#!/bin/bash
# Development environment setup for HandsFree Staff Mobile App

set -e

echo "🔧 Setting up HandsFree Staff Mobile development environment..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from apps/staff-mobile directory"
    exit 1
fi

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Node.js/Bun
if command -v bun &> /dev/null; then
    echo -e "${GREEN}✓${NC} Bun installed: $(bun --version)"
elif command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js installed: $(node --version)"
else
    echo -e "${YELLOW}⚠${NC}  Neither Bun nor Node.js found"
    echo "   Install from: https://bun.sh or https://nodejs.org"
fi

# Check Rust
if command -v cargo &> /dev/null; then
    echo -e "${GREEN}✓${NC} Rust installed: $(cargo --version | cut -d' ' -f2)"
else
    echo -e "${YELLOW}⚠${NC}  Rust not found"
    echo "   Install from: https://rustup.rs"
fi

# Check Tauri CLI
if command -v cargo-tauri &> /dev/null; then
    echo -e "${GREEN}✓${NC} Tauri CLI installed"
else
    echo -e "${YELLOW}⚠${NC}  Tauri CLI not found"
    echo "   Install with: cargo install tauri-cli@^2.0.0"
fi

echo ""

# Install dependencies
echo "📦 Installing JavaScript dependencies..."
bun install
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Initialize database
echo "💾 Initializing database..."
if [ ! -f "guanix.db" ]; then
    echo "   Creating new database..."
    sqlite3 guanix.db "SELECT 1;" 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Database created"
else
    echo -e "${GREEN}✓${NC} Database already exists"
fi
echo ""

# Seed test data (optional)
echo "🌱 Seed test data? (y/N)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    if [ -f "seed-test-data.sql" ]; then
        sqlite3 guanix.db < seed-test-data.sql
        echo -e "${GREEN}✓${NC} Test data seeded"
        echo ""
        echo "Test users:"
        sqlite3 guanix.db "SELECT '  - ' || name || ' (' || role || ') - PIN: 1234' FROM staff_users WHERE tenant_id = 'test-tenant-001';"
    else
        echo "   seed-test-data.sql not found"
    fi
fi
echo ""

# Build Rust dependencies
echo "⚙️  Building Rust dependencies..."
cd src-tauri
cargo build
cd ..
echo -e "${GREEN}✓${NC} Rust dependencies built"
echo ""

# Make scripts executable
echo "🔐 Making scripts executable..."
chmod +x scripts/*.sh 2>/dev/null || true
echo -e "${GREEN}✓${NC} Scripts are executable"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "  Desktop development:"
echo "    bun run tauri:dev"
echo ""
echo "  Android development:"
echo "    bun run tauri android dev"
echo ""
echo "  iOS development (macOS only):"
echo "    bun run tauri ios dev"
echo ""
echo "  Build for production:"
echo "    ./scripts/build-android.sh release"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Project overview"
echo "   - SETUP_AND_TESTING.md - Complete setup guide"
echo "   - DEVICE_AUTH_IMPLEMENTATION.md - Architecture details"
echo ""
echo "🎉 Happy coding!"

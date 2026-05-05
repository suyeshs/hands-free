#!/bin/bash

##############################################################################
# Complete Dev Environment Reset Script
# For Bun + Tauri Development Build
#
# Usage:
#   chmod +x reset-dev.sh
#   ./reset-dev.sh
#
# This script will:
# 1. Stop the dev server if running
# 2. Delete database files (pos-dev.db)
# 3. Clear Tauri cache and build artifacts
# 4. Clear node_modules/.cache if needed
# 5. Optionally restart the dev server
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# App name and directories
APP_NAME="com.gaunix.restaurant"
DB_DEV_NAME="pos-dev.db"
DB_PROD_NAME="guanix.db"

# Platform-specific paths
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    APP_DATA_DIR="$HOME/Library/Application Support/$APP_NAME"
    CACHE_DIR="$HOME/Library/Caches/$APP_NAME"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    APP_DATA_DIR="$HOME/.local/share/$APP_NAME"
    CACHE_DIR="$HOME/.cache/$APP_NAME"
else
    # Windows (Git Bash / WSL)
    APP_DATA_DIR="$APPDATA/$APP_NAME"
    CACHE_DIR="$LOCALAPPDATA/$APP_NAME"
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

##############################################################################
# Functions
##############################################################################

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  🔄 Dev Environment Reset${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}➜${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

confirm() {
    echo -e "${YELLOW}$1${NC}"
    read -p "Type 'yes' to continue: " response
    if [ "$response" != "yes" ]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
}

stop_dev_server() {
    print_step "Stopping dev server processes..."

    # Kill Tauri dev processes
    pkill -f "tauri dev" 2>/dev/null && echo "  Stopped Tauri dev" || echo "  No Tauri dev running"

    # Kill Vite dev server
    pkill -f "vite" 2>/dev/null && echo "  Stopped Vite dev server" || echo "  No Vite server running"

    # Kill Bun processes (be careful not to kill other bun processes)
    pkill -f "bun.*dev" 2>/dev/null && echo "  Stopped Bun dev processes" || echo "  No Bun dev running"

    # Wait a moment for processes to fully terminate
    sleep 2

    print_success "Dev server stopped"
}

delete_database_files() {
    print_step "Deleting database files..."

    if [ -d "$APP_DATA_DIR" ]; then
        echo "  Looking in: $APP_DATA_DIR"

        # Delete dev database
        if [ -f "$APP_DATA_DIR/$DB_DEV_NAME" ]; then
            rm -f "$APP_DATA_DIR/$DB_DEV_NAME"
            echo "  Deleted: $DB_DEV_NAME"
        else
            echo "  Not found: $DB_DEV_NAME"
        fi

        # Delete WAL and SHM files
        rm -f "$APP_DATA_DIR/$DB_DEV_NAME-wal" 2>/dev/null && echo "  Deleted: $DB_DEV_NAME-wal"
        rm -f "$APP_DATA_DIR/$DB_DEV_NAME-shm" 2>/dev/null && echo "  Deleted: $DB_DEV_NAME-shm"

        # Delete prod database (if exists)
        if [ -f "$APP_DATA_DIR/$DB_PROD_NAME" ]; then
            rm -f "$APP_DATA_DIR/$DB_PROD_NAME"
            rm -f "$APP_DATA_DIR/$DB_PROD_NAME-wal" 2>/dev/null
            rm -f "$APP_DATA_DIR/$DB_PROD_NAME-shm" 2>/dev/null
            echo "  Deleted: $DB_PROD_NAME (and related files)"
        fi

        print_success "Database files deleted"
    else
        print_warning "App data directory not found: $APP_DATA_DIR"
        echo "  Database may not exist yet (fresh install)"
    fi
}

clear_tauri_cache() {
    print_step "Clearing Tauri cache..."

    if [ -d "$CACHE_DIR" ]; then
        echo "  Clearing: $CACHE_DIR"
        rm -rf "$CACHE_DIR"
        print_success "Tauri cache cleared"
    else
        echo "  No Tauri cache found"
    fi

    # Clear Tauri target directory (dev builds)
    if [ -d "$PROJECT_DIR/src-tauri/target" ]; then
        echo "  Clearing Tauri build cache..."
        rm -rf "$PROJECT_DIR/src-tauri/target/debug" 2>/dev/null || true
        print_success "Tauri build cache cleared"
    fi
}

clear_node_cache() {
    print_step "Clearing Node/Bun cache..."

    # Clear node_modules cache
    if [ -d "$PROJECT_DIR/node_modules/.cache" ]; then
        echo "  Clearing: node_modules/.cache"
        rm -rf "$PROJECT_DIR/node_modules/.cache"
        print_success "Node cache cleared"
    fi

    # Clear Vite cache
    if [ -d "$PROJECT_DIR/.vite" ]; then
        echo "  Clearing: .vite"
        rm -rf "$PROJECT_DIR/.vite"
        print_success "Vite cache cleared"
    fi
}

create_reset_flag() {
    print_step "Creating reset flag for browser storage..."

    # This flag will be checked by the app on startup
    mkdir -p "$APP_DATA_DIR"
    echo "$(date)" > "$APP_DATA_DIR/.reset-flag"

    print_success "Reset flag created"
}

show_manual_steps() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  📋 Manual Steps Required${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "${YELLOW}After starting the dev server:${NC}"
    echo ""
    echo "  1. Open the app in your browser"
    echo "  2. Press F12 (or Cmd+Option+I) to open DevTools"
    echo "  3. Go to Console tab"
    echo "  4. Run: localStorage.clear(); sessionStorage.clear();"
    echo "  5. Reload the page (Cmd+R or Ctrl+R)"
    echo ""
    echo -e "${YELLOW}OR navigate to:${NC} /#/reset"
    echo ""
}

restart_dev_server() {
    local restart_choice
    echo ""
    read -p "Start dev server now? (y/n): " restart_choice

    if [[ "$restart_choice" == "y" || "$restart_choice" == "Y" ]]; then
        print_step "Starting dev server..."
        cd "$PROJECT_DIR"

        # Start in a new terminal window
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS - open in new Terminal window
            osascript -e 'tell app "Terminal" to do script "cd '"$PROJECT_DIR"' && bun run tauri dev"'
            print_success "Dev server starting in new Terminal window"
        else
            # Linux/Windows - start in background
            nohup bun run tauri dev > /tmp/tauri-dev.log 2>&1 &
            print_success "Dev server starting in background (logs: /tmp/tauri-dev.log)"
        fi

        echo ""
        show_manual_steps
    else
        echo ""
        echo -e "${YELLOW}To start manually, run:${NC}"
        echo "  cd $PROJECT_DIR"
        echo "  bun run tauri dev"
        echo ""
        show_manual_steps
    fi
}

##############################################################################
# Main Script
##############################################################################

main() {
    print_header

    # Confirmation
    echo -e "${RED}⚠️  WARNING: This will DELETE:${NC}"
    echo "  • Database files ($DB_DEV_NAME, $DB_PROD_NAME)"
    echo "  • Tauri cache and build artifacts"
    echo "  • Node/Bun cache"
    echo ""
    echo -e "${YELLOW}You will need to manually clear browser storage after restart.${NC}"
    echo ""

    confirm "Are you sure you want to reset the dev environment?"

    echo ""

    # Execute reset steps
    stop_dev_server
    echo ""

    delete_database_files
    echo ""

    clear_tauri_cache
    echo ""

    clear_node_cache
    echo ""

    create_reset_flag
    echo ""

    print_success "🎉 Reset complete!"
    echo ""

    # Offer to restart
    restart_dev_server
}

# Run main function
main

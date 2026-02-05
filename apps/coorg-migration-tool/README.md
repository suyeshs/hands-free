# Coorg Migration Tool

Standalone Tauri application for migrating Coorg Food Company from v1.0 to current system.

## Features

- **Standalone Executable** - No runtime dependencies (Bun/Node)
- **Safe Migration** - Automatic backups before any changes
- **Data Transformation** - Converts v1.0 JSON sales to structured format
- **D1 Cloud Sync** - Syncs all migrated data to Cloudflare D1
- **Progress Tracking** - Real-time UI with step-by-step progress
- **Validation** - Verifies data integrity before committing

## Migration Flow

```
pos.db (v1.0) → Export → Backup → Transform →
guanix.db (current) → Validate → D1 Sync → Done
```

## Development

### Prerequisites

- Rust (latest stable)
- Node.js/npm or Bun
- Tauri CLI

### Setup

```bash
# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

### Output Files

After building:
- Windows: `src-tauri/target/release/bundle/nsis/Coorg Migration Tool_1.0.0_x64-setup.exe`
- macOS: `src-tauri/target/release/bundle/dmg/Coorg Migration Tool.dmg`
- Linux: `src-tauri/target/release/bundle/appimage/coorg-migration-tool_1.0.0_amd64.AppImage`

## Usage

### For End Users

1. **Download** the migration tool executable for your platform
2. **Close** existing POS app if running
3. **Run** the migration tool
4. **Follow** on-screen instructions
5. **Wait** for migration to complete (~5-10 minutes)
6. **Verify** success message
7. **Install** new POS version
8. **Launch** new POS and verify data

### What Gets Migrated

- ✅ **Sales Transactions** - All closed orders from v1.0
- ✅ **Staff Accounts** - All users with credentials preserved
- ✅ **Active Sessions** - In-progress orders
- ✅ **Settings** - Restaurant configuration
- ✅ **D1 Cloud** - All data synced to cloud

### Safety Features

- **Automatic Backup** - `pos-v1-backup-{timestamp}.db` created before migration
- **Export JSON** - `migration-export-{timestamp}.json` for audit trail
- **Validation** - Data counts verified before commit
- **Rollback** - Can restore from backup if needed

## Architecture

### Frontend (React + TypeScript)
- Welcome screen with database detection
- Progress tracking with real-time updates
- Validation screen to review results
- Success screen with next steps

### Backend (Rust + Tauri)
- Database detection and validation
- Data export from v1.0 database
- Transformation logic (JSON → SQL)
- Import to new database schema
- D1 cloud sync integration

## Technical Details

### Database Migration
- **From**: pos.db (v1.0) - 3 tables
- **To**: guanix.db (current) - 70+ tables
- **Transformation**: JSON `order_data` → Structured `sales_transactions`
- **Tax Calculation**: 2.5% CGST + 2.5% SGST = 5% total

### D1 Sync
- Provisions D1 database if needed
- Syncs sales, staff, menu, settings
- Batch size: 500 records per request
- Worker endpoint: `https://handsfree-orders.suyesh.workers.dev`

## Development Status

This tool is purpose-built for migrating the `coorg-food-company-6163` tenant. For general migration needs, additional development is required.

## Support

For issues or questions about the migration tool, contact the development team.

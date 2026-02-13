# Database Location

## Development Database

**Path**: `/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/`

**Files**:
- `guanix.db` - Main SQLite database
- `guanix.db-shm` - Shared memory file (WAL mode)
- `guanix.db-wal` - Write-Ahead Log file (WAL mode)
- `pos-dev.db` - Alternative dev database (older)
- `handsfree.db` - Alternative database name

## Production Database

**Path**: `/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/`

Same location as development, but different filename based on app configuration.

## Quick Commands

### View all databases
```bash
ls -lh "/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/"
```

### Delete databases (fresh start)
```bash
rm -f "/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/"*.db*
```

### Check if tenant_config table exists
```bash
sqlite3 "/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/guanix.db" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_config';"
```

### View all tables
```bash
sqlite3 "/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/guanix.db" \
  ".tables"
```

### Check applied migrations
```bash
sqlite3 "/Users/stonepot-tech/Library/Application Support/com.gaunix.restaurant/guanix.db" \
  "SELECT version, name, source FROM schema_migrations ORDER BY version;"
```

## Database Filename Logic

The database filename is determined by `src-tauri/src/lib.rs`:
- Development: Uses `get_db_filename()` function
- Checks for environment-specific naming
- Falls back to default naming scheme

## Important Notes

1. The app uses **WAL mode** (Write-Ahead Logging) for better concurrency
2. Always close the app before manually modifying the database
3. Deleting the database will trigger fresh migrations on next app start
4. Migration 030 creates the `tenant_config` table (added in commit d79020f8)

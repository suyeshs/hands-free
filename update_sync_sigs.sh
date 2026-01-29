#!/bin/bash
# Update all sync function signatures to use DbConnection

file="src-tauri/src/sync/incremental_sync.rs"

# Update all function signatures from &Connection to DbConnection
sed -i.bak 's/pub async fn sync_\([a-z_]*\)(\s*db: &Connection,/pub async fn sync_\1(db: DbConnection,/g' "$file"
sed -i.bak 's/pub async fn sync_\([a-z_]*\)(\n    db: &Connection,/pub async fn sync_\1(\n    db: DbConnection,/g' "$file"

echo "Updated function signatures"

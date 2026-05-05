#!/usr/bin/env node
/**
 * Generate migration manifest for R2 deployment
 * Creates manifest.json with metadata for all migrations in migrations-for-r2-deployment/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations-for-r2-deployment');
const MANIFEST_PATH = path.join(MIGRATIONS_DIR, 'manifest.json');

function calculateChecksum(content) {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return `sha256:${hash.digest('hex')}`;
}

function extractMigrationNumber(filename) {
  const match = filename.match(/^(\d+)[a-z]?_/);
  return match ? parseInt(match[1], 10) : null;
}

function extractMigrationName(filename) {
  const match = filename.match(/^\d+[a-z]?_(.+)\.sql$/);
  return match ? match[1] : filename.replace('.sql', '');
}

function generateManifest() {
  console.log('[ManifestGenerator] Reading migrations from:', MIGRATIONS_DIR);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[ManifestGenerator] Found ${files.length} migration files`);

  const migrations = files.map(file => {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const version = extractMigrationNumber(file);
    const name = extractMigrationName(file);
    const checksum = calculateChecksum(content);

    // Extract description from first comment line (if exists)
    const descriptionMatch = content.match(/^--\s*Migration:\s*(.+)$/m) ||
                           content.match(/^--\s*(.+)$/m);
    const description = descriptionMatch ? descriptionMatch[1].trim() : null;

    console.log(`[ManifestGenerator] - ${file} (v${version}): ${name}`);

    return {
      version,
      name,
      description,
      file,
      checksum,
      required_app_version: '3.1.0',
      tenant_whitelist: null,
      created_at: new Date().toISOString(),
    };
  }).filter(m => m.version !== null); // Filter out files without version numbers

  const manifest = {
    version: 1,
    migrations: migrations.sort((a, b) => a.version - b.version),
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`[ManifestGenerator] ✅ Generated manifest with ${migrations.length} migrations`);
  console.log(`[ManifestGenerator] Written to: ${MANIFEST_PATH}`);
}

// Run if called directly
if (require.main === module) {
  try {
    generateManifest();
  } catch (error) {
    console.error('[ManifestGenerator] Error:', error);
    process.exit(1);
  }
}

module.exports = { generateManifest };

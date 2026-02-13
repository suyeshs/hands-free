/**
 * Database Provisioner
 *
 * Provisions database schema and seed data for newly created tenant databases.
 */

// Cloudflare R2 Bucket type (from Workers runtime)
type R2Bucket = any;

export interface DatabaseProvisioningConfig {
  databaseId: string;
  tenantId: string;
  subdomain: string;
  includeSeeds?: boolean; // Default: true
  schemaVersion?: string; // Optional: 'latest', 'v3.1.0', etc.
}

export interface DatabaseProvisioningResult {
  success: boolean;
  databaseId: string;
  tablesCreated: number;
  rowsInserted: number;
  error?: string;
  duration: number;
}

export class DatabaseProvisioner {
  private apiToken: string;
  private accountId: string;
  private r2Bucket?: R2Bucket; // Add R2 bucket for schema storage

  constructor(apiToken: string, accountId: string, r2Bucket?: R2Bucket) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.r2Bucket = r2Bucket;
  }

  /**
   * Provision database with schema from R2 and seed data
   */
  async provisionDatabase(config: DatabaseProvisioningConfig): Promise<DatabaseProvisioningResult> {
    const startTime = Date.now();
    const result: DatabaseProvisioningResult = {
      success: false,
      databaseId: config.databaseId,
      tablesCreated: 0,
      rowsInserted: 0,
      duration: 0,
    };

    try {
      console.log(`[DB] Provisioning database for ${config.subdomain} (${config.databaseId})`);

      // Fetch schema from R2 (if R2 bucket is available)
      let schemaSQL: string;
      if (this.r2Bucket) {
        console.log(`[DB] Fetching schema from R2...`);
        schemaSQL = await this.fetchSchemaFromR2(config.schemaVersion || 'latest');
        console.log(`[DB] ✅ Fetched schema from R2 (${schemaSQL.length} bytes)`);
      } else {
        console.log(`[DB] ⚠️  R2 bucket not configured, using embedded schema`);
        schemaSQL = this.getSchemaSQL();
      }

      // Step 1: Execute schema SQL
      const schemaResult = await this.executeSchemaSQL(config.databaseId, schemaSQL);
      result.tablesCreated = schemaResult.tablesCreated;
      console.log(`[DB] ✅ Created ${schemaResult.tablesCreated} tables`);

      // Step 2: Insert seed data (if requested)
      if (config.includeSeeds !== false) {
        const seedResult = await this.executeSeedData(config.databaseId);
        result.rowsInserted = seedResult.rowsInserted;
        console.log(`[DB] ✅ Inserted ${seedResult.rowsInserted} seed rows`);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

      console.log(`[DB] ✅ Database provisioning completed in ${result.duration}ms`);
      return result;

    } catch (error: any) {
      result.error = error.message || 'Unknown error';
      result.duration = Date.now() - startTime;
      console.error(`[DB] ❌ Database provisioning failed:`, error);
      throw error;
    }
  }

  /**
   * Fetch schema from R2
   */
  private async fetchSchemaFromR2(version: string = 'latest'): Promise<string> {
    if (!this.r2Bucket) {
      throw new Error('R2 bucket not configured - cannot fetch schema');
    }

    const schemaKey = version === 'latest'
      ? 'pos-schema-latest.sql'
      : `pos-schema-${version}.sql`;

    console.log(`[R2] Fetching schema: ${schemaKey}`);

    const schemaObject = await this.r2Bucket.get(schemaKey);

    if (!schemaObject) {
      throw new Error(`Schema not found in R2: ${schemaKey}`);
    }

    const schemaSQL = await schemaObject.text();

    if (!schemaSQL || schemaSQL.length === 0) {
      throw new Error(`Empty schema fetched from R2: ${schemaKey}`);
    }

    console.log(`[R2] ✅ Fetched ${schemaKey} (${schemaSQL.length} bytes)`);

    return schemaSQL;
  }

  /**
   * Execute schema SQL statements
   */
  private async executeSchemaSQL(databaseId: string, schemaSQL: string): Promise<{ tablesCreated: number }> {
    const statements = this.splitSQLStatements(schemaSQL);
    let tablesCreated = 0;

    console.log(`[DB] Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await this.executeSQLStatement(databaseId, statement);
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            tablesCreated++;
            console.log(`[DB] Created table ${tablesCreated} (statement ${i + 1}/${statements.length})`);
          }
        } catch (error: any) {
          console.error(`[DB] ❌ Failed on statement ${i + 1}/${statements.length}:`);
          console.error(`[DB] Statement preview: ${statement.substring(0, 200)}...`);
          throw new Error(`Statement ${i + 1} failed: ${error.message}`);
        }
      }
    }

    return { tablesCreated };
  }

  /**
   * Execute seed data insertion (minimal - just default categories)
   */
  private async executeSeedData(databaseId: string): Promise<{ rowsInserted: number }> {
    // Minimal seed data - only if menu_categories table exists
    const seedSQL = `
-- Default menu categories (if table exists)
INSERT OR IGNORE INTO menu_categories (id, tenant_id, name, display_order, created_at, updated_at)
VALUES
  (1, 'default', 'Starters', 1, datetime('now'), datetime('now')),
  (2, 'default', 'Main Course', 2, datetime('now'), datetime('now')),
  (3, 'default', 'Breads', 3, datetime('now'), datetime('now')),
  (4, 'default', 'Rice & Biryani', 4, datetime('now'), datetime('now')),
  (5, 'default', 'Desserts', 5, datetime('now'), datetime('now')),
  (6, 'default', 'Beverages', 6, datetime('now'), datetime('now'));
    `;

    try {
      await this.executeSQLStatement(databaseId, seedSQL.trim());
      return { rowsInserted: 6 };
    } catch (error: any) {
      // Ignore errors for seed data (table might not exist)
      console.log(`[DB] Seed data skipped:`, error.message);
      return { rowsInserted: 0 };
    }
  }

  /**
   * Execute a single SQL statement via Cloudflare API
   */
  private async executeSQLStatement(databaseId: string, sql: string): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`SQL execution failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as any;
    
    if (!data.success) {
      throw new Error(`SQL execution failed: ${JSON.stringify(data.errors)}`);
    }

    return data.result;
  }

  /**
   * Split SQL file into individual statements
   * Properly handles comments, strings, and multi-line statements
   */
  private splitSQLStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = i < sql.length - 1 ? sql[i + 1] : '';
      const prevChar = i > 0 ? sql[i - 1] : '';

      // Handle line comments (-- )
      if (!inSingleQuote && !inDoubleQuote && !inBlockComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        i++; // Skip the next dash
        continue;
      }

      // End line comment at newline
      if (inLineComment && (char === '\n' || char === '\r')) {
        inLineComment = false;
        // Add newline to preserve line breaks in multi-line statements
        current += char;
        continue;
      }

      // Skip characters while in line comment
      if (inLineComment) {
        continue;
      }

      // Handle block comments (/* */)
      if (!inSingleQuote && !inDoubleQuote && !inBlockComment && char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++; // Skip the asterisk
        continue;
      }

      // End block comment
      if (inBlockComment && char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the slash
        continue;
      }

      // Skip characters while in block comment
      if (inBlockComment) {
        continue;
      }

      // Handle single quotes (with escape handling)
      if (char === "'" && prevChar !== '\\') {
        if (!inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        }
      }

      // Handle double quotes (with escape handling)
      if (char === '"' && prevChar !== '\\') {
        if (!inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        }
      }

      // Split on semicolon (only if not in string or comment)
      if (char === ';' && !inSingleQuote && !inDoubleQuote) {
        const stmt = current.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        current = '';
        continue;
      }

      // Add character to current statement
      current += char;
    }

    // Add final statement if exists
    const finalStmt = current.trim();
    if (finalStmt.length > 0) {
      statements.push(finalStmt);
    }

    return statements;
  }

  /**
   * Get schema SQL (fallback - embedded restaurant schema)
   * Only used if R2 bucket is not configured
   */
  private getSchemaSQL(): string {
    return RESTAURANT_SCHEMA_SQL;
  }

  /**
   * Verify database exists and is accessible
   */
  async verifyDatabase(databaseId: string): Promise<boolean> {
    try {
      await this.executeSQLStatement(databaseId, 'SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get table count
   */
  async getTableCount(databaseId: string): Promise<number> {
    const result = await this.executeSQLStatement(
      databaseId,
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return result[0]?.results[0]?.count || 0;
  }
}

// Restaurant Schema SQL (embedded for serverless environment)
const RESTAURANT_SCHEMA_SQL = `
-- Restaurant Database Schema for Multi-Tenant Menu Management
-- Optimized for Cloudflare Edge performance

-- Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_hindi TEXT,
  name_local TEXT,
  category TEXT NOT NULL DEFAULT 'Uncategorized',
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  photo_url TEXT,
  cloudflare_image_id TEXT,
  available INTEGER NOT NULL DEFAULT 1,
  is_vegetarian INTEGER NOT NULL DEFAULT 0,
  is_vegan INTEGER NOT NULL DEFAULT 0,
  spice_level TEXT,
  allergens TEXT,
  tags TEXT,
  display_order INTEGER DEFAULT 0,
  is_bestseller INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  last_bestseller_update TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_from_filesearch INTEGER DEFAULT 1,
  filesearch_sync_at TEXT
);

-- Indexes for menu items
CREATE INDEX IF NOT EXISTS idx_tenant_available ON menu_items(tenant_id, available);
CREATE INDEX IF NOT EXISTS idx_tenant_category ON menu_items(tenant_id, category, display_order);
CREATE INDEX IF NOT EXISTS idx_tenant_name ON menu_items(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_updated_at ON menu_items(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_bestseller ON menu_items(tenant_id, is_bestseller DESC, order_count DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary ON menu_items(tenant_id, is_vegetarian, is_vegan, available);

-- File Search Sync Metadata
CREATE TABLE IF NOT EXISTS filesearch_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  sync_started_at TEXT NOT NULL,
  sync_completed_at TEXT,
  items_processed INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_unchanged INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  filesearch_store_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_tenant ON filesearch_sync_log(tenant_id, sync_completed_at DESC);

-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  depth INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES menu_categories(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_category_name ON menu_categories(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_category_order ON menu_categories(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_category_parent ON menu_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_category_depth ON menu_categories(tenant_id, depth, display_order);

-- Customer Orders Table (voice/web orders)
CREATE TABLE IF NOT EXISTS customer_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  tenant_id TEXT NOT NULL,
  order_items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  order_type TEXT,
  delivery_address TEXT,
  status TEXT DEFAULT 'pending',
  order_date TEXT NOT NULL DEFAULT (datetime('now')),
  estimated_delivery_time INTEGER,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_orders(customer_phone, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_id ON customer_orders(session_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_orders ON customer_orders(tenant_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_status ON customer_orders(tenant_id, status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_date ON customer_orders(order_date DESC);

-- POS Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  table_number INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  source TEXT DEFAULT 'pos',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  customization TEXT,
  item_total REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- View for customer order history
CREATE VIEW IF NOT EXISTS customer_order_history AS
SELECT
  co.id,
  co.session_id,
  co.customer_name,
  co.customer_phone,
  co.tenant_id,
  co.order_items,
  co.total,
  co.order_type,
  co.status,
  co.order_date,
  COUNT(*) OVER (PARTITION BY co.customer_phone) as total_orders_by_phone,
  SUM(co.total) OVER (PARTITION BY co.customer_phone) as lifetime_value
FROM customer_orders co
WHERE co.customer_phone IS NOT NULL
ORDER BY co.order_date DESC;

-- Tenant Integration Secrets
-- Stores encrypted API keys and credentials for third-party integrations
-- Encryption keys are stored in Token Manager (tenant:{tenantId}:encryption_key)
CREATE TABLE IF NOT EXISTS tenant_secrets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  secret_type TEXT NOT NULL, -- 'stripe', 'shipstation', 'quickbooks', 'razorpay', 'twilio', etc.
  secret_key TEXT NOT NULL,   -- 'api_key', 'client_id', 'secret_key', 'webhook_secret', etc.
  environment TEXT NOT NULL CHECK (environment IN ('test', 'production')),
  encrypted_value TEXT NOT NULL, -- AES-256-GCM encrypted value
  encryption_version INTEGER NOT NULL DEFAULT 1, -- For key rotation support
  metadata TEXT, -- JSON: {"scope": "read_only", "expires_at": "2025-12-31", "description": ""}
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT, -- Track when secret was last accessed
  UNIQUE(tenant_id, secret_type, secret_key, environment)
);

CREATE INDEX IF NOT EXISTS idx_tenant_secrets_lookup
  ON tenant_secrets(tenant_id, secret_type, environment);
CREATE INDEX IF NOT EXISTS idx_tenant_secrets_type
  ON tenant_secrets(tenant_id, secret_type);
CREATE INDEX IF NOT EXISTS idx_tenant_secrets_last_used
  ON tenant_secrets(tenant_id, last_used_at);
CREATE INDEX IF NOT EXISTS idx_tenant_secrets_updated
  ON tenant_secrets(tenant_id, updated_at DESC);
`;

// Restaurant Seed SQL
const RESTAURANT_SEED_SQL = `
-- Default Restaurant Menu Categories
INSERT INTO menu_categories (tenant_id, name, display_order) VALUES
  ('default', 'Starters', 1),
  ('default', 'Main Course', 2),
  ('default', 'Breads', 3),
  ('default', 'Rice & Biryani', 4),
  ('default', 'Desserts', 5),
  ('default', 'Beverages', 6);
`;


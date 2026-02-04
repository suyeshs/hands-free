/**
 * Schema Comparison Service
 *
 * Detects schema mismatches between POS SQLite and Cloud D1 databases
 * for hybrid SaaS synchronization.
 */

import Database from '@tauri-apps/plugin-sql';

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface SchemaColumn {
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: string | null;
  pk: boolean;
}

export interface SchemaIndex {
  name: string;
  unique: boolean;
  columns: string[];
  partial: boolean;
}

export interface TableSchema {
  name: string;
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  foreignKeys: SchemaForeignKey[];
}

export interface SchemaForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export interface SchemaMismatch {
  table: string;
  posColumns: string[];
  cloudColumns: string[];
  missingInPos: string[];
  missingInCloud: string[];
  typeMismatches: ColumnTypeMismatch[];
}

export interface ColumnTypeMismatch {
  column: string;
  posType: string;
  cloudType: string;
}

export interface SchemaSyncStatus {
  status: 'synced' | 'pos_ahead' | 'cloud_ahead' | 'diverged';
  posVersion: string | null;
  cloudVersion: string | null;
  missingInPos: string[];
  missingInCloud: string[];
  schemaMismatches: SchemaMismatch[];
  lastChecked: string;
}

// =====================================================
// SCHEMA EXTRACTION
// =====================================================

export class SchemaComparisonService {
  /**
   * Get the schema of a table from SQLite database
   */
  static async getTableSchema(
    db: Database,
    tableName: string
  ): Promise<TableSchema | null> {
    try {
      // Get column information
      const columns = await db.select<SchemaColumn[]>(
        `PRAGMA table_info(${tableName})`
      );

      if (!columns || columns.length === 0) {
        return null; // Table doesn't exist
      }

      // Get index information
      const indexList = await db.select<{ name: string; unique: number; partial: number }[]>(
        `PRAGMA index_list(${tableName})`
      );

      const indexes: SchemaIndex[] = [];
      for (const idx of indexList) {
        const indexInfo = await db.select<{ seqno: number; cid: number; name: string }[]>(
          `PRAGMA index_info(${idx.name})`
        );

        indexes.push({
          name: idx.name,
          unique: idx.unique === 1,
          columns: indexInfo.map(i => i.name),
          partial: idx.partial === 1,
        });
      }

      // Get foreign key information
      const foreignKeys = await db.select<SchemaForeignKey[]>(
        `PRAGMA foreign_key_list(${tableName})`
      );

      return {
        name: tableName,
        columns,
        indexes,
        foreignKeys: foreignKeys || [],
      };
    } catch (error) {
      console.error(`Error getting schema for table ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Get all table names from a SQLite database
   */
  static async getAllTableNames(db: Database): Promise<string[]> {
    try {
      const result = await db.select<{ name: string }[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      );
      return result.map(r => r.name);
    } catch (error) {
      console.error('Error getting table names:', error);
      return [];
    }
  }

  /**
   * Get complete database schema (all tables)
   */
  static async getDatabaseSchema(db: Database): Promise<Map<string, TableSchema>> {
    const schemaMap = new Map<string, TableSchema>();
    const tableNames = await this.getAllTableNames(db);

    for (const tableName of tableNames) {
      const schema = await this.getTableSchema(db, tableName);
      if (schema) {
        schemaMap.set(tableName, schema);
      }
    }

    return schemaMap;
  }

  // =====================================================
  // CLOUD SCHEMA (from tenant-schema.sql)
  // =====================================================

  /**
   * Get expected cloud schema from reference
   * This is based on the tenant-schema.sql file
   */
  static getCloudSchemaReference(): Map<string, string[]> {
    return new Map([
      // Menu & Categories
      ['menu_items', ['id', 'tenant_id', 'name', 'name_hindi', 'name_local', 'category', 'description', 'price', 'photo_url', 'cloudflare_image_id', 'available', 'is_vegetarian', 'is_vegan', 'spice_level', 'allergens', 'tags', 'display_order', 'is_bestseller', 'order_count', 'last_bestseller_update', 'created_at', 'updated_at', 'synced_from_filesearch', 'filesearch_sync_at']],
      ['menu_categories', ['id', 'tenant_id', 'name', 'parent_id', 'depth', 'display_order', 'icon', 'created_at', 'updated_at']],
      ['filesearch_sync_log', ['id', 'tenant_id', 'sync_started_at', 'sync_completed_at', 'items_processed', 'items_added', 'items_updated', 'items_unchanged', 'status', 'error_message', 'filesearch_store_id']],

      // Orders
      ['customer_orders', ['id', 'session_id', 'customer_name', 'customer_phone', 'tenant_id', 'order_items', 'subtotal', 'tax', 'total', 'order_type', 'delivery_address', 'status', 'order_date', 'estimated_delivery_time', 'payment_method', 'payment_status', 'notes']],
      ['orders', ['id', 'tenant_id', 'order_number', 'order_type', 'status', 'subtotal', 'tax', 'total', 'payment_method', 'table_number', 'customer_name', 'customer_phone', 'notes', 'source', 'created_at', 'updated_at', 'completed_at']],
      ['order_items', ['id', 'order_id', 'menu_item_id', 'name', 'quantity', 'price', 'customization', 'item_total']],

      // Tips
      ['tips', ['id', 'tenant_id', 'invoice_number', 'order_number', 'table_number', 'order_type', 'tip_amount', 'staff_id', 'server_name', 'entered_by_staff_id', 'entered_by_name', 'entry_method', 'created_at', 'tip_date', 'synced_at']],

      // Sales & Transactions (NEW)
      ['sales_transactions', ['id', 'tenant_id', 'invoice_number', 'order_number', 'order_type', 'table_number', 'source', 'subtotal', 'service_charge', 'cgst', 'sgst', 'discount', 'round_off', 'grand_total', 'payment_method', 'payment_status', 'items_json', 'cashier_name', 'staff_id', 'created_at', 'completed_at']],

      // Staff & HR (NEW)
      ['staff_users', ['id', 'tenant_id', 'name', 'role', 'pin_hash', 'is_active', 'permissions', 'created_at', 'last_login_at', 'created_by']],
      ['staff_login_history', ['id', 'staff_id', 'tenant_id', 'login_at', 'device_id', 'success']],

      // Cash Management (NEW)
      ['daily_cash_registers', ['id', 'tenant_id', 'business_date', 'opening_cash', 'opened_at', 'opened_by', 'expected_closing_cash', 'actual_closing_cash', 'cash_variance', 'closed_at', 'closed_by', 'status', 'notes', 'created_at', 'updated_at']],
      ['cash_payouts', ['id', 'tenant_id', 'business_date', 'amount', 'payout_type', 'category', 'description', 'reference_number', 'recorded_by', 'authorized_by', 'status', 'created_at', 'updated_at']],

      // Aggregator Orders (NEW)
      ['aggregator_orders', ['id', 'order_id', 'order_number', 'aggregator', 'aggregator_order_id', 'status', 'order_type', 'customer_name', 'customer_phone', 'delivery_address', 'items_json', 'subtotal', 'delivery_fee', 'packaging_fee', 'platform_fee', 'discount', 'tax', 'total', 'restaurant_payout', 'is_prepaid', 'payment_method', 'created_at', 'accepted_at', 'ready_at', 'picked_up_at', 'delivered_at', 'estimated_delivery_time', 'special_instructions', 'cancellation_reason', 'synced_to_pos', 'last_synced_at', 'tenant_id']],

      // Secrets
      ['tenant_secrets', ['id', 'tenant_id', 'secret_type', 'secret_key', 'environment', 'encrypted_value', 'encryption_version', 'metadata', 'created_at', 'updated_at', 'last_used_at']],

      // Inventory
      ['inventory_suppliers', ['id', 'tenant_id', 'name', 'contact_name', 'email', 'phone', 'address', 'gstin', 'tax_id', 'payment_terms', 'currency', 'bank_name', 'bank_account', 'total_orders', 'total_spent', 'notes', 'created_at', 'updated_at']],
      ['inventory_items', ['id', 'tenant_id', 'name', 'quantity', 'unit', 'category', 'supplier_id', 'price_per_unit', 'expiry_date', 'reorder_level', 'storage_location', 'notes', 'created_at', 'updated_at']],
      ['inventory_documents', ['id', 'tenant_id', 'type', 'original_filename', 'storage_key', 'mime_type', 'file_size', 'ocr_provider', 'ocr_raw_text', 'extracted_data', 'status', 'error_message', 'processing_time_ms', 'created_by', 'created_at', 'processed_at']],
      ['inventory_transactions', ['id', 'tenant_id', 'item_id', 'document_id', 'transaction_type', 'quantity_change', 'previous_quantity', 'new_quantity', 'unit', 'reason', 'notes', 'order_id', 'created_by', 'created_at']],
      ['inventory_recipes', ['id', 'tenant_id', 'menu_item_id', 'menu_item_name', 'yield_quantity', 'yield_unit', 'total_cost', 'created_at', 'updated_at']],
      ['inventory_recipe_ingredients', ['id', 'tenant_id', 'recipe_id', 'inventory_item_id', 'quantity', 'unit', 'waste_percentage']],

      // Schema Versioning (NEW)
      ['schema_versions', ['id', 'version', 'migration_name', 'checksum', 'target_system', 'applied_at', 'created_by', 'metadata']],
    ]);
  }

  // =====================================================
  // COMPARISON LOGIC
  // =====================================================

  /**
   * Compare two table schemas and identify differences
   */
  static compareTableSchemas(
    tableName: string,
    posSchema: TableSchema | undefined,
    cloudColumns: string[] | undefined
  ): SchemaMismatch | null {
    if (!posSchema && !cloudColumns) {
      return null; // Both missing, nothing to compare
    }

    const posColumns = posSchema ? posSchema.columns.map(c => c.name) : [];
    const cloud = cloudColumns || [];

    const missingInPos = cloud.filter(col => !posColumns.includes(col));
    const missingInCloud = posColumns.filter(col => !cloud.includes(col));

    // Only report if there are actual differences
    if (missingInPos.length === 0 && missingInCloud.length === 0) {
      return null;
    }

    return {
      table: tableName,
      posColumns,
      cloudColumns: cloud,
      missingInPos,
      missingInCloud,
      typeMismatches: [], // Type checking would require cloud schema introspection
    };
  }

  /**
   * Perform full schema comparison between POS and Cloud
   */
  static async compareSchemas(db: Database): Promise<SchemaSyncStatus> {
    try {
      // Get POS schema
      const posSchema = await this.getDatabaseSchema(db);
      const posTableNames = Array.from(posSchema.keys());

      // Get Cloud schema reference
      const cloudSchema = this.getCloudSchemaReference();
      const cloudTableNames = Array.from(cloudSchema.keys());

      // Find missing tables
      const missingInPos = cloudTableNames.filter(t => !posTableNames.includes(t));
      const missingInCloud = posTableNames.filter(t => !cloudTableNames.includes(t));

      // Compare common tables
      const schemaMismatches: SchemaMismatch[] = [];
      const commonTables = posTableNames.filter(t => cloudTableNames.includes(t));

      for (const tableName of commonTables) {
        const mismatch = this.compareTableSchemas(
          tableName,
          posSchema.get(tableName),
          cloudSchema.get(tableName)
        );
        if (mismatch) {
          schemaMismatches.push(mismatch);
        }
      }

      // Get schema versions
      const posVersionResult = await db.select<{ version: string }[]>(
        `SELECT version FROM schema_versions WHERE target_system IN ('pos', 'both') ORDER BY applied_at DESC LIMIT 1`
      ).catch(() => null);

      const posVersion = posVersionResult && posVersionResult.length > 0
        ? posVersionResult[0].version
        : null;

      // Determine sync status
      let status: SchemaSyncStatus['status'];
      if (missingInPos.length === 0 && missingInCloud.length === 0 && schemaMismatches.length === 0) {
        status = 'synced';
      } else if (missingInCloud.length > 0 && missingInPos.length === 0) {
        status = 'pos_ahead';
      } else if (missingInPos.length > 0 && missingInCloud.length === 0) {
        status = 'cloud_ahead';
      } else {
        status = 'diverged';
      }

      return {
        status,
        posVersion,
        cloudVersion: null, // Would need to query cloud D1
        missingInPos,
        missingInCloud,
        schemaMismatches,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error comparing schemas:', error);
      throw error;
    }
  }

  // =====================================================
  // MIGRATION GENERATION
  // =====================================================

  /**
   * Generate ALTER TABLE statements to sync POS with Cloud
   */
  static generateSyncMigration(syncStatus: SchemaSyncStatus): string {
    const statements: string[] = [];

    // Add missing tables
    for (const tableName of syncStatus.missingInPos) {
      statements.push(
        `-- TODO: Add full CREATE TABLE statement for ${tableName}`,
        `-- Reference: platform/scripts/tenant-schema.sql`,
        ''
      );
    }

    // Add missing columns
    for (const mismatch of syncStatus.schemaMismatches) {
      if (mismatch.missingInPos.length > 0) {
        statements.push(`-- Add missing columns to ${mismatch.table}`);
        for (const column of mismatch.missingInPos) {
          statements.push(
            `ALTER TABLE ${mismatch.table} ADD COLUMN ${column} TEXT; -- TODO: Specify correct type`
          );
        }
        statements.push('');
      }
    }

    return statements.join('\n');
  }

  /**
   * Generate a detailed sync report
   */
  static generateSyncReport(syncStatus: SchemaSyncStatus): string {
    const lines: string[] = [];

    lines.push('# Schema Sync Report');
    lines.push('');
    lines.push(`**Status:** ${syncStatus.status.toUpperCase()}`);
    lines.push(`**Last Checked:** ${syncStatus.lastChecked}`);
    lines.push(`**POS Version:** ${syncStatus.posVersion || 'Unknown'}`);
    lines.push(`**Cloud Version:** ${syncStatus.cloudVersion || 'Unknown'}`);
    lines.push('');

    if (syncStatus.missingInPos.length > 0) {
      lines.push('## ⚠️ Missing in POS (Exists in Cloud)');
      lines.push('');
      for (const table of syncStatus.missingInPos) {
        lines.push(`- \`${table}\``);
      }
      lines.push('');
    }

    if (syncStatus.missingInCloud.length > 0) {
      lines.push('## ⚠️ Missing in Cloud (Exists in POS)');
      lines.push('');
      for (const table of syncStatus.missingInCloud) {
        lines.push(`- \`${table}\``);
      }
      lines.push('');
    }

    if (syncStatus.schemaMismatches.length > 0) {
      lines.push('## 🔍 Schema Mismatches');
      lines.push('');
      for (const mismatch of syncStatus.schemaMismatches) {
        lines.push(`### Table: \`${mismatch.table}\``);
        lines.push('');

        if (mismatch.missingInPos.length > 0) {
          lines.push('**Missing in POS:**');
          for (const col of mismatch.missingInPos) {
            lines.push(`- ${col}`);
          }
          lines.push('');
        }

        if (mismatch.missingInCloud.length > 0) {
          lines.push('**Missing in Cloud:**');
          for (const col of mismatch.missingInCloud) {
            lines.push(`- ${col}`);
          }
          lines.push('');
        }
      }
    }

    if (syncStatus.status === 'synced') {
      lines.push('## ✅ Schemas are in sync!');
      lines.push('');
      lines.push('No action required.');
    }

    return lines.join('\n');
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get POS database instance
 */
export async function getPOSDatabase(): Promise<Database> {
  return await Database.load(DB_NAME);
}

/**
 * Run schema comparison and return status
 */
export async function checkSchemaSync(): Promise<SchemaSyncStatus> {
  const db = await getPOSDatabase();
  return await SchemaComparisonService.compareSchemas(db);
}

/**
 * Run schema comparison and generate report
 */
export async function generateSchemaReport(): Promise<string> {
  const syncStatus = await checkSchemaSync();
  return SchemaComparisonService.generateSyncReport(syncStatus);
}

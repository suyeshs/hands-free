export interface DetectionResult {
  found: boolean;
  path: string;
  sales_count: number;
  staff_count: number;
}

export interface ExportData {
  tenant_id: string;
  closed_sales: TableSession[];
  active_sessions: TableSession[];
  staff: StaffUser[];
  export_date: string;
}

export interface TableSession {
  id: string;
  tenant_id: string;
  table_number: number;
  guest_count: number;
  server_name: string;
  started_at: string;
  closed_at: string;
  status: string;
  order_data: string; // JSON string
}

export interface StaffUser {
  id: string;
  tenant_id: string;
  name: string;
  role: string;
  pin_hash: string;
  is_active: number;
  permissions: string;
  created_at: string;
  last_login_at: string | null;
  created_by: string | null;
}

export interface ImportResult {
  staff_imported: number;
  sales_imported: number;
  sessions_imported: number;
}

export interface ValidationResult {
  staff: {
    expected: number;
    actual: number;
    match: boolean;
  };
  sales: {
    expected: number;
    actual: number;
    match: boolean;
  };
  revenue: number;
  date_range: {
    oldest: string | null;
    newest: string | null;
  };
  overall_success: boolean;
}

export interface D1SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface MigrationProgress {
  step: string;
  progress: number; // 0-100
  message: string;
}

export type MigrationState = 'idle' | 'running' | 'success' | 'error';

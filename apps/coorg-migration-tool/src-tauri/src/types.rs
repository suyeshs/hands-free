use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectionResult {
    pub found: bool,
    pub path: String,
    pub sales_count: i32,
    pub staff_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TableSession {
    pub id: String,
    pub tenant_id: String,
    pub table_number: i32,
    pub guest_count: i32,
    pub server_name: String,
    pub started_at: String,
    pub closed_at: String,
    pub status: String,
    pub order_data: String, // JSON string
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StaffUser {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub role: String,
    pub pin_hash: String,
    pub is_active: i32,
    pub permissions: String,
    pub created_at: String,
    pub last_login_at: Option<String>,
    pub created_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MenuCategory {
    pub id: String,
    pub name: String,
    pub sort_order: i32,
    pub active: i32,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub name_translations: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MenuItem {
    pub id: String,
    pub category_id: String,
    pub name: String,
    pub description: String,
    pub price: f64,
    pub image: Option<String>,
    pub active: i32,
    pub preparation_time: i32,
    pub allergens: Option<String>,
    pub dietary_tags: Option<String>,
    pub name_translations: Option<String>,
    pub description_translations: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportData {
    pub tenant_id: String,
    pub closed_sales: Vec<TableSession>,
    pub active_sessions: Vec<TableSession>,
    pub staff: Vec<StaffUser>,
    pub menu_categories: Vec<MenuCategory>,
    pub menu_items: Vec<MenuItem>,
    pub export_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SalesTransaction {
    pub id: String,
    pub tenant_id: String,
    pub invoice_number: String,
    pub order_type: String,
    pub table_number: i32,
    pub source: String,
    pub subtotal: f64,
    pub service_charge: f64,
    pub cgst: f64,
    pub sgst: f64,
    pub discount: f64,
    pub round_off: f64,
    pub grand_total: f64,
    pub payment_method: String,
    pub payment_status: String,
    pub items_json: String,
    pub cashier_name: String,
    pub created_at: String,
    pub completed_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderData {
    pub subtotal: f64,
    pub discount: f64,
    pub order_type: Option<String>,
    pub items: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub staff_imported: i32,
    pub sales_imported: i32,
    pub sessions_imported: i32,
    pub menu_categories_imported: i32,
    pub menu_items_imported: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValidationResult {
    pub staff: ValidationCount,
    pub sales: ValidationCount,
    pub menu_categories: ValidationCount,
    pub menu_items: ValidationCount,
    pub revenue: f64,
    pub date_range: DateRange,
    pub overall_success: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValidationCount {
    pub expected: i32,
    pub actual: i32,
    pub match_: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DateRange {
    pub oldest: Option<String>,
    pub newest: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MigrationResult {
    pub validation: ValidationResult,
    pub backup_paths: BackupPaths,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupPaths {
    pub db_path: String,
    pub json_path: String,
}

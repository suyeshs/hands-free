use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

// ============================================================================
// Types
// ============================================================================

#[derive(Serialize, Deserialize, Clone)]
pub struct Ingredient {
    pub id: String,
    pub name: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_price: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub name: String,
    pub ingredients: Vec<Ingredient>,
    pub category: String,
}

#[derive(Serialize, Deserialize)]
pub struct PriceCalculation {
    pub cost: f64,
    pub markup_percentage: f64,
    pub price: f64,
    pub profit: f64,
    pub profit_margin: f64,
}

#[derive(Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub current_stock: f64,
    pub unit: String,
    pub reorder_level: f64,
    pub unit_cost: f64,
}

#[derive(Serialize, Deserialize)]
pub struct InventoryValidation {
    pub valid: bool,
    pub errors: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ClosingReportPreview {
    pub total_sales: f64,
    pub items_sold: u32,
    pub estimated_cogs: f64,
    pub estimated_profit: f64,
    pub low_stock_items: Vec<String>,
}

// ============================================================================
// Plugin Initialization
// ============================================================================

#[wasm_bindgen]
pub fn init() -> String {
    console_log!("[Bar Client WASM] Initialized v2.1.0");
    "bar-client-v2.1.0".to_string()
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "2.1.0".to_string()
}

// ============================================================================
// Price Calculations (Offline-capable)
// ============================================================================

#[wasm_bindgen]
pub fn calculate_drink_price(ingredients_json: &str, markup_percentage: f64) -> Result<JsValue, JsValue> {
    let ingredients: Vec<Ingredient> = serde_json::from_str(ingredients_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse ingredients: {}", e)))?;

    // Calculate total cost
    let cost: f64 = ingredients.iter()
        .map(|i| i.quantity * i.unit_price)
        .sum();

    // Apply markup
    let price = cost * (1.0 + markup_percentage / 100.0);
    let profit = price - cost;
    let profit_margin = if price > 0.0 {
        (profit / price) * 100.0
    } else {
        0.0
    };

    let calculation = PriceCalculation {
        cost,
        markup_percentage,
        price,
        profit,
        profit_margin,
    };

    console_log!("[Bar Client] Price calculated: cost={}, price={}", cost, price);

    serde_wasm_bindgen::to_value(&calculation)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn calculate_recipe_cost(recipe_json: &str) -> Result<JsValue, JsValue> {
    let recipe: Recipe = serde_json::from_str(recipe_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse recipe: {}", e)))?;

    let total_cost: f64 = recipe.ingredients.iter()
        .map(|i| i.quantity * i.unit_price)
        .sum();

    console_log!("[Bar Client] Recipe cost calculated: {}", total_cost);

    Ok(JsValue::from_f64(total_cost))
}

// ============================================================================
// Inventory Validation (Offline)
// ============================================================================

#[wasm_bindgen]
pub fn validate_inventory_entry(item_json: &str) -> Result<JsValue, JsValue> {
    let item: InventoryItem = serde_json::from_str(item_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse item: {}", e)))?;

    let mut errors = Vec::new();

    // Validation rules
    if item.name.trim().is_empty() {
        errors.push("Item name cannot be empty".to_string());
    }

    if item.current_stock < 0.0 {
        errors.push("Current stock cannot be negative".to_string());
    }

    if item.reorder_level < 0.0 {
        errors.push("Reorder level cannot be negative".to_string());
    }

    if item.unit_cost < 0.0 {
        errors.push("Unit cost cannot be negative".to_string());
    }

    if item.unit.trim().is_empty() {
        errors.push("Unit must be specified".to_string());
    }

    let validation = InventoryValidation {
        valid: errors.is_empty(),
        errors,
    };

    console_log!("[Bar Client] Inventory validation: valid={}", validation.valid);

    serde_wasm_bindgen::to_value(&validation)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

// ============================================================================
// Closing Report Preview (Quick offline preview)
// ============================================================================

#[wasm_bindgen]
pub fn preview_closing_report(sales_json: &str, inventory_json: &str) -> Result<JsValue, JsValue> {
    let sales: Vec<serde_json::Value> = serde_json::from_str(sales_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse sales: {}", e)))?;

    let inventory: Vec<InventoryItem> = serde_json::from_str(inventory_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse inventory: {}", e)))?;

    // Calculate totals from sales
    let total_sales: f64 = sales.iter()
        .filter_map(|s| s.get("amount").and_then(|a| a.as_f64()))
        .sum();

    let items_sold: u32 = sales.len() as u32;

    // Estimate COGS (simplified - real calculation in worker)
    let estimated_cogs = total_sales * 0.3; // Assume 30% COGS
    let estimated_profit = total_sales - estimated_cogs;

    // Find low stock items
    let low_stock_items: Vec<String> = inventory.iter()
        .filter(|item| item.current_stock <= item.reorder_level)
        .map(|item| item.name.clone())
        .collect();

    let preview = ClosingReportPreview {
        total_sales,
        items_sold,
        estimated_cogs,
        estimated_profit,
        low_stock_items,
    };

    console_log!("[Bar Client] Closing preview: sales={}, items={}", total_sales, items_sold);

    serde_wasm_bindgen::to_value(&preview)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

// ============================================================================
// Utility Functions
// ============================================================================

#[wasm_bindgen]
pub fn check_low_stock(inventory_json: &str) -> Result<JsValue, JsValue> {
    let inventory: Vec<InventoryItem> = serde_json::from_str(inventory_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse inventory: {}", e)))?;

    let low_stock: Vec<&InventoryItem> = inventory.iter()
        .filter(|item| item.current_stock <= item.reorder_level)
        .collect();

    console_log!("[Bar Client] Low stock check: {} items", low_stock.len());

    serde_wasm_bindgen::to_value(&low_stock)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

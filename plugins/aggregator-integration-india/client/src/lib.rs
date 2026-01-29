use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use regex::Regex;

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
pub struct OrderItem {
    pub name: String,
    pub quantity: u32,
    pub price: f64,
    pub customization: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ParsedOrder {
    pub order_id: String,
    pub platform: String,
    pub customer_name: String,
    pub customer_phone: Option<String>,
    pub items: Vec<OrderItem>,
    pub total_amount: f64,
    pub delivery_charge: f64,
    pub packaging_charge: f64,
    pub taxes: f64,
    pub discount: f64,
    pub final_amount: f64,
    pub status: String,
    pub order_time: String,
    pub delivery_time: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct OrderValidation {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractedData {
    pub order_id: Option<String>,
    pub customer_name: Option<String>,
    pub phone: Option<String>,
    pub items: Vec<OrderItem>,
    pub total: Option<f64>,
}

// ============================================================================
// Plugin Initialization
// ============================================================================

#[wasm_bindgen]
pub fn init() -> String {
    console_log!("[Aggregator Client WASM] Initialized v2.3.0");
    "aggregator-client-v2.3.0".to_string()
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "2.3.0".to_string()
}

// ============================================================================
// Order Parsing (Offline-capable)
// ============================================================================

#[wasm_bindgen]
pub fn parse_order_text(text: &str, platform: &str) -> Result<JsValue, JsValue> {
    console_log!("[Aggregator Client] Parsing order from {}", platform);

    let extracted = match platform {
        "swiggy" => extract_swiggy_order(text),
        "zomato" => extract_zomato_order(text),
        _ => return Err(JsValue::from_str("Unsupported platform")),
    };

    serde_wasm_bindgen::to_value(&extracted)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

fn extract_swiggy_order(text: &str) -> ExtractedData {
    // Simple regex-based extraction (simplified version)
    let order_id_re = Regex::new(r"Order\s*#?:?\s*(\d+)").unwrap();
    let customer_re = Regex::new(r"Customer:?\s*([A-Za-z\s]+)").unwrap();
    let phone_re = Regex::new(r"Phone:?\s*(\+?\d{10,})").unwrap();
    let total_re = Regex::new(r"Total:?\s*₹?\s*(\d+\.?\d*)").unwrap();

    ExtractedData {
        order_id: order_id_re.captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
        customer_name: customer_re.captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string()),
        phone: phone_re.captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
        items: Vec::new(), // Items parsing would be more complex
        total: total_re.captures(text)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<f64>().ok()),
    }
}

fn extract_zomato_order(text: &str) -> ExtractedData {
    // Similar to Swiggy but with Zomato-specific patterns
    let order_id_re = Regex::new(r"Order\s*(?:ID|Number)?:?\s*(\d+)").unwrap();
    let customer_re = Regex::new(r"(?:Customer|Name):?\s*([A-Za-z\s]+)").unwrap();
    let phone_re = Regex::new(r"(?:Phone|Contact):?\s*(\+?\d{10,})").unwrap();
    let total_re = Regex::new(r"(?:Total|Amount):?\s*₹?\s*(\d+\.?\d*)").unwrap();

    ExtractedData {
        order_id: order_id_re.captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
        customer_name: customer_re.captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().trim().to_string()),
        phone: phone_re.captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
        items: Vec::new(),
        total: total_re.captures(text)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<f64>().ok()),
    }
}

// ============================================================================
// Order Validation (Offline)
// ============================================================================

#[wasm_bindgen]
pub fn validate_order(order_json: &str) -> Result<JsValue, JsValue> {
    let order: ParsedOrder = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse order: {}", e)))?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validation rules
    if order.order_id.is_empty() {
        errors.push("Order ID is required".to_string());
    }

    if order.customer_name.is_empty() {
        errors.push("Customer name is required".to_string());
    }

    if order.items.is_empty() {
        errors.push("Order must have at least one item".to_string());
    }

    if order.final_amount <= 0.0 {
        errors.push("Final amount must be greater than zero".to_string());
    }

    // Calculate expected total
    let items_total: f64 = order.items.iter().map(|i| i.price * i.quantity as f64).sum();
    let calculated_total = items_total + order.delivery_charge + order.packaging_charge + order.taxes - order.discount;

    if (calculated_total - order.final_amount).abs() > 0.5 {
        warnings.push(format!(
            "Total mismatch: calculated {} vs stated {}",
            calculated_total, order.final_amount
        ));
    }

    // Phone number validation
    if let Some(phone) = &order.customer_phone {
        if phone.len() < 10 {
            warnings.push("Phone number seems too short".to_string());
        }
    }

    let validation = OrderValidation {
        valid: errors.is_empty(),
        errors,
        warnings,
    };

    console_log!("[Aggregator Client] Order validation: valid={}", validation.valid);

    serde_wasm_bindgen::to_value(&validation)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

// ============================================================================
// Status Mapping
// ============================================================================

#[wasm_bindgen]
pub fn map_status_to_pos(platform: &str, aggregator_status: &str) -> String {
    let normalized = aggregator_status.to_lowercase();

    match platform {
        "swiggy" => match normalized.as_str() {
            "placed" | "confirmed" => "pending",
            "preparing" | "ready" => "preparing",
            "dispatched" | "out_for_delivery" => "out_for_delivery",
            "delivered" => "completed",
            "cancelled" => "cancelled",
            _ => "unknown",
        },
        "zomato" => match normalized.as_str() {
            "order_placed" | "accepted" => "pending",
            "food_ready" | "rider_arrived" => "preparing",
            "on_the_way" => "out_for_delivery",
            "delivered" => "completed",
            "cancelled" | "rejected" => "cancelled",
            _ => "unknown",
        },
        _ => "unknown",
    }.to_string()
}

// ============================================================================
// Utility Functions
// ============================================================================

#[wasm_bindgen]
pub fn calculate_commission(total_amount: f64, platform: &str) -> f64 {
    // Typical commission rates (simplified)
    let rate = match platform {
        "swiggy" => 0.25, // 25%
        "zomato" => 0.23, // 23%
        _ => 0.20,
    };

    total_amount * rate
}

#[wasm_bindgen]
pub fn format_phone_number(phone: &str) -> String {
    // Clean and format Indian phone numbers
    let cleaned: String = phone.chars().filter(|c| c.is_numeric()).collect();

    if cleaned.len() == 10 {
        format!("+91 {}", cleaned)
    } else if cleaned.len() == 12 && cleaned.starts_with("91") {
        format!("+{}", cleaned)
    } else {
        phone.to_string()
    }
}

#[wasm_bindgen]
pub fn extract_order_id_from_text(text: &str) -> Option<String> {
    let re = Regex::new(r"(?:Order|#)\s*(\d{6,})").ok()?;
    re.captures(text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

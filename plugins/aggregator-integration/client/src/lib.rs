/**
 * Aggregator Integration Client Plugin
 *
 * Client-side WASM for aggregator order processing:
 * - Invoice number generation
 * - Order item transformation
 * - Payment method determination
 * - Order validation
 * - Status mapping (Swiggy/Zomato → internal)
 */

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use web_sys::console;

// ============================================================================
// Type Definitions
// ============================================================================

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginContext {
    pub plugin_id: String,
    pub tenant_id: String,
    pub version: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregatorOrder {
    pub order_id: String,
    pub order_number: String,
    pub aggregator: String, // "swiggy" or "zomato"
    pub aggregator_status: String,
    pub status: String,
    pub customer: Option<Customer>,
    pub cart: Cart,
    pub payment: Payment,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cart {
    pub items: Vec<CartItem>,
    pub subtotal: f64,
    pub tax: f64,
    pub delivery_fee: f64,
    pub platform_fee: f64,
    pub discount: f64,
    pub total: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CartItem {
    pub id: Option<String>,
    pub name: String,
    pub quantity: i32,
    pub price: f64,
    pub total: f64,
    pub category: Option<String>,
    pub addons: Option<Vec<Addon>>,
    pub special_instructions: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Addon {
    pub id: Option<String>,
    pub name: String,
    pub price: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    pub method: String,
    pub status: String,
    pub is_prepaid: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceResult {
    pub invoice_number: String,
    pub order_number: String,
    pub aggregator: String,
    pub prefix: String,
    pub year_month: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformedCartItem {
    pub id: String,
    pub menu_item: MenuItemRef,
    pub quantity: i32,
    pub modifiers: Vec<Modifier>,
    pub special_instructions: Option<String>,
    pub subtotal: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuItemRef {
    pub id: String,
    pub name: String,
    pub price: f64,
    pub category: String,
    pub available: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Modifier {
    pub id: String,
    pub name: String,
    pub price: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentMethodResult {
    pub payment_method: String, // "upi", "cash", "card"
    pub is_prepaid: bool,
    pub display_name: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusMapping {
    pub aggregator_status: String,
    pub internal_status: String,
    pub description: String,
    pub should_notify: bool,
}

// ============================================================================
// Plugin Entry Points
// ============================================================================

#[wasm_bindgen]
pub fn init(context_json: &str, _host_json: &str) -> Result<(), JsValue> {
    let context: PluginContext = serde_json::from_str(context_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse context: {}", e)))?;

    console::log_1(&JsValue::from_str(&format!(
        "[AggregatorIntegration] Plugin initialized! ID: {}, Tenant: {}, Version: {}",
        context.plugin_id, context.tenant_id, context.version
    )));

    Ok(())
}

#[wasm_bindgen]
pub fn get_info() -> Result<String, JsValue> {
    let info = serde_json::json!({
        "name": "Aggregator Integration",
        "version": "1.0.0",
        "description": "Swiggy & Zomato order processing and automation",
        "supportedPlatforms": ["swiggy", "zomato"],
        "features": [
            "Invoice generation",
            "Order transformation",
            "Status mapping",
            "Order validation",
            "Offline-capable"
        ]
    });

    serde_json::to_string(&info)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize info: {}", e)))
}

// ============================================================================
// Invoice Number Generation
// ============================================================================

#[wasm_bindgen]
pub fn generate_invoice_number(order_json: &str) -> Result<String, JsValue> {
    let order: AggregatorOrder = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse order: {}", e)))?;

    // Get current timestamp
    let now = js_sys::Date::now();
    let date = js_sys::Date::new(&JsValue::from_f64(now));

    let year = date.get_full_year() as u32;
    let month = date.get_month() + 1; // JS months are 0-indexed

    let yy = year % 100;
    let mm = format!("{:02}", month);
    let year_month = format!("{}{}", yy, mm);

    let prefix = match order.aggregator.to_lowercase().as_str() {
        "swiggy" => "SWG",
        "zomato" => "ZMT",
        _ => "DIR",
    };

    let invoice_number = format!("AGG-{}-{}{}", year_month, prefix, order.order_number);

    let result = InvoiceResult {
        invoice_number: invoice_number.clone(),
        order_number: order.order_number,
        aggregator: order.aggregator,
        prefix: prefix.to_string(),
        year_month,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Order Item Transformation
// ============================================================================

#[wasm_bindgen]
pub fn transform_items_to_cart(order_json: &str) -> Result<String, JsValue> {
    let order: AggregatorOrder = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse order: {}", e)))?;

    let transformed_items: Vec<TransformedCartItem> = order
        .cart
        .items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let item_id = item
                .id
                .clone()
                .unwrap_or_else(|| format!("agg-item-{}", index));

            let menu_item_id = item
                .id
                .clone()
                .unwrap_or_else(|| format!("agg-menu-{}", index));

            let modifiers: Vec<Modifier> = item
                .addons
                .as_ref()
                .map(|addons| {
                    addons
                        .iter()
                        .map(|addon| Modifier {
                            id: addon
                                .id
                                .clone()
                                .unwrap_or_else(|| format!("addon-{}", generate_random_id())),
                            name: addon.name.clone(),
                            price: addon.price,
                        })
                        .collect()
                })
                .unwrap_or_default();

            TransformedCartItem {
                id: item_id,
                menu_item: MenuItemRef {
                    id: menu_item_id,
                    name: item.name.clone(),
                    price: item.price,
                    category: item
                        .category
                        .clone()
                        .unwrap_or_else(|| "Aggregator".to_string()),
                    available: true,
                },
                quantity: item.quantity,
                modifiers,
                special_instructions: item.special_instructions.clone(),
                subtotal: item.total,
            }
        })
        .collect();

    serde_json::to_string(&transformed_items)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize items: {}", e)))
}

// ============================================================================
// Payment Method Determination
// ============================================================================

#[wasm_bindgen]
pub fn determine_payment_method(order_json: &str) -> Result<String, JsValue> {
    let order: AggregatorOrder = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse order: {}", e)))?;

    let (payment_method, display_name) = if order.payment.is_prepaid {
        ("upi", "UPI/Online")
    } else {
        ("cash", "Cash on Delivery")
    };

    let result = PaymentMethodResult {
        payment_method: payment_method.to_string(),
        is_prepaid: order.payment.is_prepaid,
        display_name: display_name.to_string(),
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Order Validation
// ============================================================================

#[wasm_bindgen]
pub fn validate_order(order_json: &str) -> Result<String, JsValue> {
    let order: AggregatorOrder = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse order: {}", e)))?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Required fields
    if order.order_number.is_empty() {
        errors.push("Order number is required".to_string());
    }

    if order.aggregator.is_empty() {
        errors.push("Aggregator is required".to_string());
    }

    if order.cart.items.is_empty() {
        errors.push("Order must have at least one item".to_string());
    }

    // Validate cart totals
    let items_total: f64 = order
        .cart
        .items
        .iter()
        .map(|item| item.total)
        .sum();

    let calculated_total = items_total + order.cart.tax + order.cart.delivery_fee
                          + order.cart.platform_fee - order.cart.discount;

    let total_diff = (calculated_total - order.cart.total).abs();

    if total_diff > 1.0 {
        // Allow 1 rupee rounding difference
        warnings.push(format!(
            "Cart total mismatch: calculated {:.2}, order {:.2}",
            calculated_total, order.cart.total
        ));
    }

    // Validate customer info
    if order.customer.is_none() {
        warnings.push("Customer information is missing".to_string());
    } else if let Some(customer) = &order.customer {
        if customer.phone.is_none() || customer.phone.as_ref().unwrap().is_empty() {
            warnings.push("Customer phone number is missing".to_string());
        }
    }

    // Validate payment
    if order.payment.method.is_empty() {
        warnings.push("Payment method not specified".to_string());
    }

    let result = ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Status Mapping
// ============================================================================

#[wasm_bindgen]
pub fn map_aggregator_status(aggregator: &str, status: &str) -> Result<String, JsValue> {
    let (internal_status, description, should_notify) = match (aggregator.to_lowercase().as_str(), status.to_lowercase().as_str()) {
        // Swiggy statuses
        ("swiggy", "order_placed") => ("pending", "Order placed, awaiting acceptance", true),
        ("swiggy", "order_accepted") => ("accepted", "Order accepted by restaurant", true),
        ("swiggy", "food_ready") => ("ready", "Food is ready for pickup", true),
        ("swiggy", "order_picked") => ("picked_up", "Order picked up by delivery partner", true),
        ("swiggy", "delivered") => ("delivered", "Order delivered to customer", true),
        ("swiggy", "cancelled") => ("cancelled", "Order cancelled", true),

        // Zomato statuses
        ("zomato", "placed") => ("pending", "Order placed, awaiting acceptance", true),
        ("zomato", "accepted") => ("accepted", "Order accepted by restaurant", true),
        ("zomato", "food_ready") => ("ready", "Food is ready for pickup", true),
        ("zomato", "picked_up") => ("picked_up", "Order picked up by delivery partner", true),
        ("zomato", "delivered") => ("delivered", "Order delivered to customer", true),
        ("zomato", "cancelled") => ("cancelled", "Order cancelled", true),

        // Unknown status
        _ => ("unknown", &format!("Unknown status: {}", status), false),
    };

    let result = StatusMapping {
        aggregator_status: status.to_string(),
        internal_status: internal_status.to_string(),
        description: description.to_string(),
        should_notify,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Tax Calculation
// ============================================================================

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxBreakdown {
    pub cgst: f64,
    pub sgst: f64,
    pub total_tax: f64,
}

#[wasm_bindgen]
pub fn calculate_tax_breakdown(total_tax: f64) -> Result<String, JsValue> {
    // Split tax evenly between CGST and SGST (Indian tax structure)
    let cgst = total_tax / 2.0;
    let sgst = total_tax / 2.0;

    let result = TaxBreakdown {
        cgst,
        sgst,
        total_tax,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Batch Processing
// ============================================================================

#[wasm_bindgen]
pub fn batch_generate_invoices(orders_json: &str) -> Result<String, JsValue> {
    let orders: Vec<AggregatorOrder> = serde_json::from_str(orders_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse orders: {}", e)))?;

    let mut results = Vec::new();

    for order in orders {
        let order_json = serde_json::to_string(&order).unwrap();
        match generate_invoice_number(&order_json) {
            Ok(result_json) => {
                results.push(serde_json::from_str::<serde_json::Value>(&result_json).unwrap());
            }
            Err(_) => {
                results.push(serde_json::json!({
                    "orderNumber": order.order_number,
                    "error": "Failed to generate invoice"
                }));
            }
        }
    }

    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize results: {}", e)))
}

// ============================================================================
// Helper Functions
// ============================================================================

fn generate_random_id() -> String {
    let random = js_sys::Math::random();
    let id = (random * 1000000.0) as u32;
    format!("{:06x}", id)
}

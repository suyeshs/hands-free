use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// Macro for console logging
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format!($($t)*)))
}

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Deserialize, Serialize)]
pub struct OrderItem {
    pub id: String,
    pub name: String,
    pub quantity: f64,
    pub price: f64,
    pub tax_rate: f64,
    pub discount_percentage: f64,
}

#[derive(Deserialize, Serialize)]
pub struct Order {
    pub items: Vec<OrderItem>,
    pub discount_percentage: f64,
    pub tip_amount: f64,
    pub tax_rate: f64,
}

#[derive(Serialize)]
pub struct OrderCalculation {
    pub subtotal: f64,
    pub discount: f64,
    pub subtotal_after_discount: f64,
    pub tax: f64,
    pub tip: f64,
    pub total: f64,
    pub items: Vec<ItemCalculation>,
}

#[derive(Serialize)]
pub struct ItemCalculation {
    pub id: String,
    pub name: String,
    pub quantity: f64,
    pub price: f64,
    pub subtotal: f64,
    pub discount: f64,
    pub tax: f64,
    pub total: f64,
}

#[derive(Serialize)]
pub struct SplitBillResult {
    pub per_person: f64,
    pub splits: Vec<SplitPortion>,
}

#[derive(Serialize)]
pub struct SplitPortion {
    pub person_index: usize,
    pub amount: f64,
}

#[derive(Serialize)]
pub struct PaymentValidation {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Deserialize)]
pub struct Payment {
    pub amount: f64,
    pub method: String,
    pub reference: Option<String>,
}

// ============================================================================
// Public API
// ============================================================================

#[wasm_bindgen]
pub fn init() -> String {
    console_log!("[POS Core WASM] Initialized v3.0.0");
    "pos-core-v3.0.0".to_string()
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "3.0.0".to_string()
}

/// Calculate complete order totals including items, discounts, tax, and tip
#[wasm_bindgen]
pub fn calculate_order_total(order_json: &str) -> Result<JsValue, JsValue> {
    let order: Order = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid order JSON: {}", e)))?;

    // Calculate each item
    let mut items: Vec<ItemCalculation> = Vec::new();
    let mut subtotal = 0.0;

    for item in &order.items {
        let item_subtotal = item.price * item.quantity;
        let item_discount = item_subtotal * (item.discount_percentage / 100.0);
        let item_after_discount = item_subtotal - item_discount;
        let item_tax = item_after_discount * (item.tax_rate / 100.0);
        let item_total = item_after_discount + item_tax;

        items.push(ItemCalculation {
            id: item.id.clone(),
            name: item.name.clone(),
            quantity: item.quantity,
            price: item.price,
            subtotal: round_currency(item_subtotal),
            discount: round_currency(item_discount),
            tax: round_currency(item_tax),
            total: round_currency(item_total),
        });

        subtotal += item_subtotal;
    }

    // Apply order-level discount
    let order_discount = subtotal * (order.discount_percentage / 100.0);
    let subtotal_after_discount = subtotal - order_discount;

    // Calculate tax
    let tax = subtotal_after_discount * (order.tax_rate / 100.0);

    // Calculate total
    let total = subtotal_after_discount + tax + order.tip_amount;

    let calculation = OrderCalculation {
        subtotal: round_currency(subtotal),
        discount: round_currency(order_discount),
        subtotal_after_discount: round_currency(subtotal_after_discount),
        tax: round_currency(tax),
        tip: round_currency(order.tip_amount),
        total: round_currency(total),
        items,
    };

    serde_wasm_bindgen::to_value(&calculation)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Calculate tax for a given amount and tax rate
#[wasm_bindgen]
pub fn calculate_tax(amount: f64, tax_rate: f64) -> f64 {
    round_currency(amount * (tax_rate / 100.0))
}

/// Calculate discount amount
#[wasm_bindgen]
pub fn calculate_discount(amount: f64, discount_percentage: f64) -> f64 {
    round_currency(amount * (discount_percentage / 100.0))
}

/// Calculate tip based on amount and percentage
#[wasm_bindgen]
pub fn calculate_tip(amount: f64, tip_percentage: f64) -> f64 {
    round_currency(amount * (tip_percentage / 100.0))
}

/// Split bill evenly among N people
#[wasm_bindgen]
pub fn split_bill_evenly(total: f64, num_people: u32) -> Result<JsValue, JsValue> {
    if num_people == 0 {
        return Err(JsValue::from_str("Number of people must be greater than 0"));
    }

    let per_person = round_currency(total / num_people as f64);
    let remainder = total - (per_person * num_people as f64);

    let mut splits = Vec::new();
    for i in 0..num_people {
        let mut amount = per_person;
        // Add remainder cents to first person to handle rounding
        if i == 0 {
            amount += round_currency(remainder);
        }
        splits.push(SplitPortion {
            person_index: i as usize,
            amount: round_currency(amount),
        });
    }

    let result = SplitBillResult { per_person, splits };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Split bill by custom amounts
#[wasm_bindgen]
pub fn split_bill_custom(total: f64, amounts_json: &str) -> Result<JsValue, JsValue> {
    let amounts: Vec<f64> = serde_json::from_str(amounts_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid amounts JSON: {}", e)))?;

    let sum: f64 = amounts.iter().sum();
    if (sum - total).abs() > 0.01 {
        return Err(JsValue::from_str(&format!(
            "Split amounts ({}) do not match total ({})",
            sum, total
        )));
    }

    let splits: Vec<SplitPortion> = amounts
        .into_iter()
        .enumerate()
        .map(|(i, amount)| SplitPortion {
            person_index: i,
            amount: round_currency(amount),
        })
        .collect();

    let result = SplitBillResult {
        per_person: round_currency(total / splits.len() as f64),
        splits,
    };

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Validate payment against order total
#[wasm_bindgen]
pub fn validate_payment(order_total: f64, payment_json: &str) -> Result<JsValue, JsValue> {
    let payment: Payment = serde_json::from_str(payment_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid payment JSON: {}", e)))?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validate amount
    if payment.amount <= 0.0 {
        errors.push("Payment amount must be greater than 0".to_string());
    }

    if payment.amount < order_total {
        errors.push(format!(
            "Payment amount ({:.2}) is less than order total ({:.2})",
            payment.amount, order_total
        ));
    }

    if payment.amount > order_total {
        let change = round_currency(payment.amount - order_total);
        warnings.push(format!(
            "Payment exceeds order total by {:.2}. Change due: {:.2}",
            payment.amount - order_total,
            change
        ));
    }

    // Validate method
    let valid_methods = vec!["cash", "card", "upi", "wallet", "other"];
    if !valid_methods.contains(&payment.method.to_lowercase().as_str()) {
        warnings.push(format!("Unknown payment method: {}", payment.method));
    }

    // Validate reference for non-cash payments
    if payment.method.to_lowercase() != "cash" && payment.reference.is_none() {
        warnings.push("Non-cash payments should have a reference number".to_string());
    }

    let validation = PaymentValidation {
        valid: errors.is_empty(),
        errors,
        warnings,
    };

    serde_wasm_bindgen::to_value(&validation)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Validate order items
#[wasm_bindgen]
pub fn validate_order_items(order_json: &str) -> Result<JsValue, JsValue> {
    let order: Order = serde_json::from_str(order_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid order JSON: {}", e)))?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if order.items.is_empty() {
        errors.push("Order must contain at least one item".to_string());
    }

    for (index, item) in order.items.iter().enumerate() {
        if item.quantity <= 0.0 {
            errors.push(format!("Item {} quantity must be greater than 0", index + 1));
        }

        if item.price < 0.0 {
            errors.push(format!("Item {} price cannot be negative", index + 1));
        }

        if item.tax_rate < 0.0 || item.tax_rate > 100.0 {
            errors.push(format!(
                "Item {} tax rate must be between 0 and 100",
                index + 1
            ));
        }

        if item.discount_percentage < 0.0 || item.discount_percentage > 100.0 {
            errors.push(format!(
                "Item {} discount must be between 0 and 100",
                index + 1
            ));
        }

        if item.discount_percentage > 50.0 {
            warnings.push(format!(
                "Item {} has high discount ({}%)",
                index + 1, item.discount_percentage
            ));
        }
    }

    if order.discount_percentage < 0.0 || order.discount_percentage > 100.0 {
        errors.push("Order discount must be between 0 and 100".to_string());
    }

    if order.tip_amount < 0.0 {
        errors.push("Tip amount cannot be negative".to_string());
    }

    let validation = PaymentValidation {
        valid: errors.is_empty(),
        errors,
        warnings,
    };

    serde_wasm_bindgen::to_value(&validation)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Calculate change to return
#[wasm_bindgen]
pub fn calculate_change(total: f64, paid: f64) -> f64 {
    if paid < total {
        return 0.0;
    }
    round_currency(paid - total)
}

/// Round to 2 decimal places for currency
fn round_currency(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_tax() {
        assert_eq!(calculate_tax(100.0, 10.0), 10.0);
        assert_eq!(calculate_tax(100.0, 5.0), 5.0);
        assert_eq!(calculate_tax(0.0, 10.0), 0.0);
    }

    #[test]
    fn test_calculate_discount() {
        assert_eq!(calculate_discount(100.0, 10.0), 10.0);
        assert_eq!(calculate_discount(100.0, 50.0), 50.0);
        assert_eq!(calculate_discount(100.0, 0.0), 0.0);
    }

    #[test]
    fn test_calculate_tip() {
        assert_eq!(calculate_tip(100.0, 15.0), 15.0);
        assert_eq!(calculate_tip(100.0, 20.0), 20.0);
    }

    #[test]
    fn test_calculate_change() {
        assert_eq!(calculate_change(100.0, 150.0), 50.0);
        assert_eq!(calculate_change(100.0, 100.0), 0.0);
        assert_eq!(calculate_change(100.0, 90.0), 0.0);
    }

    #[test]
    fn test_round_currency() {
        assert_eq!(round_currency(10.123), 10.12);
        assert_eq!(round_currency(10.126), 10.13);
        assert_eq!(round_currency(10.1), 10.1);
    }
}

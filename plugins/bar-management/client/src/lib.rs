/**
 * Bar Management Client Plugin
 *
 * Client-side WASM for offline-capable bar management calculations:
 * - Pour cost calculation
 * - Ingredient availability checking
 * - Variance calculations
 * - Price calculations
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
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub full_containers: i32,
    pub partial_container_ml: f64,
    pub container_size_ml: f64,
    pub cost_per_container: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIngredient {
    pub inventory_item_id: String,
    pub quantity_ml: f64,
    pub is_optional: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: String,
    pub drink_name: String,
    pub ingredients: Vec<RecipeIngredient>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PourCostResult {
    pub total_cost: f64,
    pub ingredient_costs: Vec<IngredientCost>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngredientCost {
    pub item_name: String,
    pub quantity_ml: f64,
    pub cost_per_ml: f64,
    pub total_cost: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityCheck {
    pub available: bool,
    pub missing_items: Vec<MissingItem>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingItem {
    pub item_name: String,
    pub required_ml: f64,
    pub available_ml: f64,
    pub shortage_ml: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VarianceInput {
    pub expected_full_bottles: i32,
    pub expected_partial_ml: f64,
    pub actual_full_bottles: i32,
    pub actual_partial_ml: f64,
    pub container_size_ml: f64,
    pub cost_per_container: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VarianceResult {
    pub variance_bottles: i32,
    pub variance_ml: f64,
    pub variance_cost: f64,
    pub variance_percentage: f64,
    pub expected_total_ml: f64,
    pub actual_total_ml: f64,
}

// ============================================================================
// Plugin Entry Points
// ============================================================================

#[wasm_bindgen]
pub fn init(context_json: &str, _host_json: &str) -> Result<(), JsValue> {
    let context: PluginContext = serde_json::from_str(context_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse context: {}", e)))?;

    console::log_1(&JsValue::from_str(&format!(
        "[BarManagement] Plugin initialized! ID: {}, Tenant: {}, Version: {}",
        context.plugin_id, context.tenant_id, context.version
    )));

    Ok(())
}

#[wasm_bindgen]
pub fn get_info() -> Result<String, JsValue> {
    let info = serde_json::json!({
        "name": "Bar Management",
        "version": "1.0.0",
        "description": "Bar inventory, recipes, and closing calculations",
        "features": [
            "Pour cost calculation",
            "Ingredient availability checking",
            "Variance analysis",
            "Offline-capable"
        ]
    });

    serde_json::to_string(&info)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize info: {}", e)))
}

// ============================================================================
// Pour Cost Calculation
// ============================================================================

#[wasm_bindgen]
pub fn calculate_pour_cost(
    recipe_json: &str,
    items_json: &str,
) -> Result<String, JsValue> {
    let recipe: Recipe = serde_json::from_str(recipe_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse recipe: {}", e)))?;

    let items: Vec<InventoryItem> = serde_json::from_str(items_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse items: {}", e)))?;

    let mut total_cost = 0.0;
    let mut ingredient_costs = Vec::new();

    for ingredient in &recipe.ingredients {
        if let Some(item) = items.iter().find(|i| i.id == ingredient.inventory_item_id) {
            let cost_per_ml = item.cost_per_container / item.container_size_ml;
            let ingredient_total_cost = ingredient.quantity_ml * cost_per_ml;

            total_cost += ingredient_total_cost;

            ingredient_costs.push(IngredientCost {
                item_name: item.name.clone(),
                quantity_ml: ingredient.quantity_ml,
                cost_per_ml,
                total_cost: ingredient_total_cost,
            });
        }
    }

    let result = PourCostResult {
        total_cost,
        ingredient_costs,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Ingredient Availability
// ============================================================================

#[wasm_bindgen]
pub fn check_ingredient_availability(
    recipe_json: &str,
    items_json: &str,
    quantity: i32,
) -> Result<String, JsValue> {
    let recipe: Recipe = serde_json::from_str(recipe_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse recipe: {}", e)))?;

    let items: Vec<InventoryItem> = serde_json::from_str(items_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse items: {}", e)))?;

    let mut missing_items = Vec::new();

    for ingredient in &recipe.ingredients {
        if ingredient.is_optional {
            continue;
        }

        if let Some(item) = items.iter().find(|i| i.id == ingredient.inventory_item_id) {
            let required_ml = ingredient.quantity_ml * (quantity as f64);
            let available_ml = (item.full_containers as f64) * item.container_size_ml
                             + item.partial_container_ml;

            if available_ml < required_ml {
                missing_items.push(MissingItem {
                    item_name: item.name.clone(),
                    required_ml,
                    available_ml,
                    shortage_ml: required_ml - available_ml,
                });
            }
        } else {
            missing_items.push(MissingItem {
                item_name: ingredient.inventory_item_id.clone(),
                required_ml: ingredient.quantity_ml * (quantity as f64),
                available_ml: 0.0,
                shortage_ml: ingredient.quantity_ml * (quantity as f64),
            });
        }
    }

    let result = AvailabilityCheck {
        available: missing_items.is_empty(),
        missing_items,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Variance Calculation
// ============================================================================

#[wasm_bindgen]
pub fn calculate_variance(input_json: &str) -> Result<String, JsValue> {
    let input: VarianceInput = serde_json::from_str(input_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse input: {}", e)))?;

    let expected_total_ml = (input.expected_full_bottles as f64) * input.container_size_ml
                          + input.expected_partial_ml;
    let actual_total_ml = (input.actual_full_bottles as f64) * input.container_size_ml
                        + input.actual_partial_ml;

    let variance_ml = actual_total_ml - expected_total_ml;
    let variance_bottles = input.actual_full_bottles - input.expected_full_bottles;
    let cost_per_ml = input.cost_per_container / input.container_size_ml;
    let variance_cost = variance_ml * cost_per_ml;
    let variance_percentage = if expected_total_ml > 0.0 {
        (variance_ml / expected_total_ml) * 100.0
    } else {
        0.0
    };

    let result = VarianceResult {
        variance_bottles,
        variance_ml,
        variance_cost,
        variance_percentage,
        expected_total_ml,
        actual_total_ml,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

// ============================================================================
// Batch Operations
// ============================================================================

#[wasm_bindgen]
pub fn calculate_batch_pour_costs(
    recipes_json: &str,
    items_json: &str,
) -> Result<String, JsValue> {
    let recipes: Vec<Recipe> = serde_json::from_str(recipes_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse recipes: {}", e)))?;

    let items: Vec<InventoryItem> = serde_json::from_str(items_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse items: {}", e)))?;

    let mut results = Vec::new();

    for recipe in recipes {
        let recipe_json = serde_json::to_string(&recipe).unwrap();
        let items_json = serde_json::to_string(&items).unwrap();

        match calculate_pour_cost(&recipe_json, &items_json) {
            Ok(result_json) => {
                let result: PourCostResult = serde_json::from_str(&result_json).unwrap();
                results.push(serde_json::json!({
                    "recipeId": recipe.id,
                    "drinkName": recipe.drink_name,
                    "totalCost": result.total_cost,
                }));
            }
            Err(_) => {
                results.push(serde_json::json!({
                    "recipeId": recipe.id,
                    "drinkName": recipe.drink_name,
                    "error": "Failed to calculate"
                }));
            }
        }
    }

    serde_json::to_string(&results)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize results: {}", e)))
}

// ============================================================================
// Price Calculation with Markup
// ============================================================================

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceCalculation {
    pub pour_cost: f64,
    pub markup_percentage: f64,
    pub suggested_price: f64,
    pub profit_margin: f64,
}

#[wasm_bindgen]
pub fn calculate_drink_price(
    pour_cost: f64,
    markup_percentage: f64,
) -> Result<String, JsValue> {
    if pour_cost < 0.0 {
        return Err(JsValue::from_str("Pour cost cannot be negative"));
    }

    if markup_percentage < 0.0 {
        return Err(JsValue::from_str("Markup percentage cannot be negative"));
    }

    let suggested_price = pour_cost * (1.0 + markup_percentage / 100.0);
    let profit_margin = suggested_price - pour_cost;

    let result = PriceCalculation {
        pour_cost,
        markup_percentage,
        suggested_price,
        profit_margin,
    };

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

/**
 * Subscription Meals Commands
 * Tauri commands for subscription plugin functionality
 */

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionStats {
    pub total_subscribers: i32,
    pub active_subscribers: i32,
    pub paused_subscribers: i32,
    pub today_deliveries: i32,
    pub this_week_deliveries: i32,
    pub weekly_revenue: f64,
    pub monthly_revenue: f64,
    pub churn_rate: f64,
    pub average_revenue_per_user: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionCustomer {
    pub id: String,
    pub tenant_id: String,
    pub customer_phone: String,
    pub customer_name: String,
    pub customer_email: Option<String>,
    pub subscription_plan_id: String,
    pub status: String,
    pub start_date: String,
    pub tower_number: String,
    pub apartment_number: String,
    pub distance_from_kitchen: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryRoute {
    pub tower_number: String,
    pub deliveries: Vec<DeliveryInfo>,
    pub total_distance: i32,
    pub estimated_time: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryInfo {
    pub id: String,
    pub customer_name: String,
    pub apartment_number: String,
    pub time_slot: String,
    pub status: String,
    pub item_count: i32,
}

/// Get subscription statistics from local database
#[tauri::command]
pub fn get_subscription_stats_local(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<SubscriptionStats, String> {
    // Require plugin to be installed
    crate::commands::plugin::require_plugin(&app, "subscription-meals")?;

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // Get active subscribers
    let active_count: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM subscription_customers WHERE tenant_id = ? AND status = 'active'",
            [&tenant_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Get paused subscribers
    let paused_count: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM subscription_customers WHERE tenant_id = ? AND status = 'paused'",
            [&tenant_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Get today's deliveries
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_deliveries: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM subscription_deliveries WHERE tenant_id = ? AND scheduled_date = ?",
            params![&tenant_id, &today],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Get this week's deliveries
    let week_start = chrono::Local::now()
        .date_naive()
        .week(chrono::Weekday::Mon)
        .first_day()
        .format("%Y-%m-%d")
        .to_string();
    let week_end = chrono::Local::now()
        .date_naive()
        .week(chrono::Weekday::Mon)
        .last_day()
        .format("%Y-%m-%d")
        .to_string();

    let week_deliveries: i32 = db
        .query_row(
            "SELECT COUNT(*) FROM subscription_deliveries WHERE tenant_id = ? AND scheduled_date BETWEEN ? AND ?",
            params![&tenant_id, &week_start, &week_end],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Calculate weekly revenue
    let weekly_revenue: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(sp.price_per_week), 0) FROM subscription_customers sc
             JOIN subscription_plans sp ON sc.subscription_plan_id = sp.id
             WHERE sc.tenant_id = ? AND sc.status = 'active'",
            [&tenant_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let monthly_revenue = weekly_revenue * 4.0;
    let average_revenue_per_user = if active_count > 0 {
        weekly_revenue / active_count as f64
    } else {
        0.0
    };

    Ok(SubscriptionStats {
        total_subscribers: active_count + paused_count,
        active_subscribers: active_count,
        paused_subscribers: paused_count,
        today_deliveries,
        this_week_deliveries: week_deliveries,
        weekly_revenue,
        monthly_revenue,
        churn_rate: 0.0, // TODO: Calculate based on historical data
        average_revenue_per_user,
    })
}

/// Get subscription customers with optional filters
#[tauri::command]
pub fn get_subscription_customers_local(
    app: tauri::AppHandle,
    tenant_id: String,
    status: Option<String>,
    tower: Option<String>,
) -> Result<Vec<SubscriptionCustomer>, String> {
    crate::commands::plugin::require_plugin(&app, "subscription-meals")?;

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut query = String::from(
        "SELECT id, tenant_id, customer_phone, customer_name, customer_email,
         subscription_plan_id, status, start_date, tower_number, apartment_number,
         distance_from_kitchen, created_at
         FROM subscription_customers WHERE tenant_id = ?",
    );
    let mut params: Vec<String> = vec![tenant_id.clone()];

    if let Some(s) = status {
        query.push_str(" AND status = ?");
        params.push(s);
    }

    if let Some(t) = tower {
        query.push_str(" AND tower_number = ?");
        params.push(t);
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut stmt = db.prepare(&query).map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();

    let customers = stmt
        .query_map(&param_refs[..], |row| {
            Ok(SubscriptionCustomer {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                customer_phone: row.get(2)?,
                customer_name: row.get(3)?,
                customer_email: row.get(4)?,
                subscription_plan_id: row.get(5)?,
                status: row.get(6)?,
                start_date: row.get(7)?,
                tower_number: row.get(8)?,
                apartment_number: row.get(9)?,
                distance_from_kitchen: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(customers)
}

/// Generate optimized delivery routes by tower
#[tauri::command]
pub fn generate_delivery_routes(
    app: tauri::AppHandle,
    tenant_id: String,
    date: String,
) -> Result<Vec<DeliveryRoute>, String> {
    crate::commands::plugin::require_plugin(&app, "subscription-meals")?;

    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT sd.id, sd.tower_number, sd.apartment_number, sd.scheduled_time_slot,
             sd.status, sd.distance_from_kitchen, sc.customer_name, sp.selected_items
             FROM subscription_deliveries sd
             JOIN subscription_customers sc ON sd.subscription_id = sc.id
             JOIN subscription_preferences sp ON sd.preference_id = sp.id
             WHERE sd.tenant_id = ? AND sd.scheduled_date = ?
             ORDER BY sd.tower_number, sd.distance_from_kitchen",
        )
        .map_err(|e| e.to_string())?;

    let deliveries = stmt
        .query_map(params![&tenant_id, &date], |row| {
            let selected_items: String = row.get(7)?;
            let items: Vec<serde_json::Value> =
                serde_json::from_str(&selected_items).unwrap_or_default();

            Ok((
                row.get::<_, String>(0)?,           // id
                row.get::<_, String>(1)?,           // tower_number
                row.get::<_, String>(2)?,           // apartment_number
                row.get::<_, String>(3)?,           // time_slot
                row.get::<_, String>(4)?,           // status
                row.get::<_, Option<i32>>(5)?,      // distance
                row.get::<_, String>(6)?,           // customer_name
                items.len() as i32,                 // item_count
            ))
        })
        .map_err(|e| e.to_string())?;

    // Group by tower
    let mut routes: std::collections::HashMap<String, Vec<DeliveryInfo>> =
        std::collections::HashMap::new();
    let mut tower_distances: std::collections::HashMap<String, i32> =
        std::collections::HashMap::new();

    for delivery in deliveries {
        let (id, tower, apartment, time_slot, status, distance, customer_name, item_count) =
            delivery.map_err(|e| e.to_string())?;

        let delivery_info = DeliveryInfo {
            id,
            customer_name,
            apartment_number: apartment,
            time_slot,
            status,
            item_count,
        };

        routes.entry(tower.clone()).or_default().push(delivery_info);

        if let Some(d) = distance {
            tower_distances.entry(tower).or_insert(d);
        }
    }

    // Convert to route list
    let mut route_list: Vec<DeliveryRoute> = routes
        .into_iter()
        .map(|(tower, deliveries)| {
            let total_distance = tower_distances.get(&tower).copied().unwrap_or(0);
            let delivery_count = deliveries.len() as i32;
            let estimated_time = 5 + (delivery_count * 3) + (total_distance / 50); // Base + per delivery + travel time

            DeliveryRoute {
                tower_number: tower,
                deliveries,
                total_distance,
                estimated_time,
            }
        })
        .collect();

    // Sort by distance (closest first)
    route_list.sort_by_key(|r| r.total_distance);

    Ok(route_list)
}

/// Export delivery route to printable format
#[tauri::command]
pub fn export_delivery_route_pdf(
    app: tauri::AppHandle,
    tenant_id: String,
    date: String,
    tower: Option<String>,
) -> Result<String, String> {
    crate::commands::plugin::require_plugin(&app, "subscription-meals")?;

    let routes = generate_delivery_routes(app.clone(), tenant_id.clone(), date.clone())?;

    let filtered_routes: Vec<&DeliveryRoute> = if let Some(t) = tower {
        routes.iter().filter(|r| r.tower_number == t).collect()
    } else {
        routes.iter().collect()
    };

    // Generate HTML for printing
    let mut html = String::from(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Delivery Routes</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        .route { page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
        .route-header { background: #f5f5f5; padding: 10px; margin-bottom: 10px; }
        .delivery { padding: 8px; border-bottom: 1px solid #eee; }
        .delivery:last-child { border-bottom: none; }
        @media print { .route { page-break-inside: avoid; } }
    </style>
</head>
<body>
"#,
    );

    html.push_str(&format!("<h1>Delivery Routes - {}</h1>\n", date));

    for route in filtered_routes {
        html.push_str(&format!(
            r#"<div class="route">
    <div class="route-header">
        <h2>Tower {}</h2>
        <p>Distance: {}m | Estimated Time: {} mins | Deliveries: {}</p>
    </div>
"#,
            route.tower_number,
            route.total_distance,
            route.estimated_time,
            route.deliveries.len()
        ));

        for (i, delivery) in route.deliveries.iter().enumerate() {
            html.push_str(&format!(
                r#"    <div class="delivery">
        <strong>{}. {}</strong> - Apt {} | {} | {} items | Status: {}
    </div>
"#,
                i + 1,
                delivery.customer_name,
                delivery.apartment_number,
                delivery.time_slot,
                delivery.item_count,
                delivery.status
            ));
        }

        html.push_str("</div>\n");
    }

    html.push_str("</body></html>");

    Ok(html)
}

/// Sync subscription data to remote (placeholder)
#[tauri::command]
pub async fn sync_subscription_data(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<String, String> {
    crate::commands::plugin::require_plugin(&app, "subscription-meals")?;

    // TODO: Implement sync logic with Cloudflare Worker
    // This would push local changes to the worker and pull remote updates

    Ok(format!(
        "Subscription data sync initiated for tenant {}",
        tenant_id
    ))
}

// ==================== SUBSCRIPTION PLAN CRUD ====================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionPlan {
    pub id: String,
    pub tenant_id: String,
    pub name: String,
    pub description: Option<String>,
    pub price_per_week: f64,
    pub meals_per_week: i32,
    pub delivery_days: Vec<String>,
    pub active: bool,
    pub cuisine_types: Option<Vec<String>>,
    pub meal_selection_limit: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriptionPlanInput {
    pub name: String,
    pub description: Option<String>,
    pub price_per_week: f64,
    pub meals_per_week: i32,
    pub delivery_days: Vec<String>,
    pub cuisine_types: Option<Vec<String>>,
    pub meal_selection_limit: i32,
}

/// Get all subscription plans for a tenant
#[tauri::command]
pub fn get_subscription_plans(
    app: tauri::AppHandle,
    tenant_id: String,
) -> Result<Vec<SubscriptionPlan>, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT id, tenant_id, name, description, price_per_week, meals_per_week,
             delivery_days, active, cuisine_types, meal_selection_limit, created_at, updated_at
             FROM subscription_plans WHERE tenant_id = ? ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let plans = stmt
        .query_map([&tenant_id], |row| {
            let delivery_days_str: String = row.get(6)?;
            let delivery_days: Vec<String> =
                serde_json::from_str(&delivery_days_str).unwrap_or_default();

            let cuisine_types_str: Option<String> = row.get(8)?;
            let cuisine_types = cuisine_types_str
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(SubscriptionPlan {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                price_per_week: row.get(4)?,
                meals_per_week: row.get(5)?,
                delivery_days,
                active: row.get::<_, i32>(7)? == 1,
                cuisine_types,
                meal_selection_limit: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(plans)
}

/// Create a new subscription plan
#[tauri::command]
pub fn create_subscription_plan(
    app: tauri::AppHandle,
    tenant_id: String,
    input: CreateSubscriptionPlanInput,
) -> Result<SubscriptionPlan, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let delivery_days_json = serde_json::to_string(&input.delivery_days)
        .map_err(|e| e.to_string())?;
    let cuisine_types_json = input.cuisine_types
        .as_ref()
        .map(|ct| serde_json::to_string(ct))
        .transpose()
        .map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO subscription_plans (id, tenant_id, name, description, price_per_week,
         meals_per_week, delivery_days, active, cuisine_types, meal_selection_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
        params![
            &id,
            &tenant_id,
            &input.name,
            &input.description,
            &input.price_per_week,
            &input.meals_per_week,
            &delivery_days_json,
            &cuisine_types_json,
            &input.meal_selection_limit,
            &now,
            &now,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(SubscriptionPlan {
        id,
        tenant_id,
        name: input.name,
        description: input.description,
        price_per_week: input.price_per_week,
        meals_per_week: input.meals_per_week,
        delivery_days: input.delivery_days,
        active: true,
        cuisine_types: input.cuisine_types,
        meal_selection_limit: input.meal_selection_limit,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Update an existing subscription plan
#[tauri::command]
pub fn update_subscription_plan(
    app: tauri::AppHandle,
    plan_id: String,
    input: CreateSubscriptionPlanInput,
) -> Result<SubscriptionPlan, String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let delivery_days_json = serde_json::to_string(&input.delivery_days)
        .map_err(|e| e.to_string())?;
    let cuisine_types_json = input.cuisine_types
        .as_ref()
        .map(|ct| serde_json::to_string(ct))
        .transpose()
        .map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE subscription_plans SET name = ?, description = ?, price_per_week = ?,
         meals_per_week = ?, delivery_days = ?, cuisine_types = ?,
         meal_selection_limit = ?, updated_at = ? WHERE id = ?",
        params![
            &input.name,
            &input.description,
            &input.price_per_week,
            &input.meals_per_week,
            &delivery_days_json,
            &cuisine_types_json,
            &input.meal_selection_limit,
            &now,
            &plan_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Fetch and return the updated plan
    let mut stmt = db
        .prepare(
            "SELECT id, tenant_id, name, description, price_per_week, meals_per_week,
             delivery_days, active, cuisine_types, meal_selection_limit, created_at, updated_at
             FROM subscription_plans WHERE id = ?",
        )
        .map_err(|e| e.to_string())?;

    let plan = stmt
        .query_row([&plan_id], |row| {
            let delivery_days_str: String = row.get(6)?;
            let delivery_days: Vec<String> =
                serde_json::from_str(&delivery_days_str).unwrap_or_default();

            let cuisine_types_str: Option<String> = row.get(8)?;
            let cuisine_types = cuisine_types_str
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(SubscriptionPlan {
                id: row.get(0)?,
                tenant_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                price_per_week: row.get(4)?,
                meals_per_week: row.get(5)?,
                delivery_days,
                active: row.get::<_, i32>(7)? == 1,
                cuisine_types,
                meal_selection_limit: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(plan)
}

/// Delete a subscription plan
#[tauri::command]
pub fn delete_subscription_plan(
    app: tauri::AppHandle,
    plan_id: String,
) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    db.execute("DELETE FROM subscription_plans WHERE id = ?", [&plan_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Toggle subscription plan active status
#[tauri::command]
pub fn toggle_subscription_plan_active(
    app: tauri::AppHandle,
    plan_id: String,
) -> Result<(), String> {
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(crate::get_db_filename());

    let db = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "UPDATE subscription_plans SET active = NOT active, updated_at = ? WHERE id = ?",
        params![&now, &plan_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct SubscriptionPlugin {
    version: String,
}

#[wasm_bindgen]
impl SubscriptionPlugin {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        log("🔌 Subscription Meals Plugin WASM initialized");
        Self {
            version: "1.0.0".to_string(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn version(&self) -> String {
        self.version.clone()
    }

    #[wasm_bindgen]
    pub fn init(&self) -> JsValue {
        let info = PluginInfo {
            name: "Subscription Meals".to_string(),
            version: self.version.clone(),
            author: "Guanix Team".to_string(),
            description: "Weekly meal subscription service for gated communities".to_string(),
        };

        serde_wasm_bindgen::to_value(&info).unwrap()
    }

    #[wasm_bindgen]
    pub fn get_routes(&self) -> JsValue {
        let routes = vec![
            Route {
                path: "/subscriptions".to_string(),
                component: "SubscriptionDashboard".to_string(),
                title: "Subscriptions Dashboard".to_string(),
            },
            Route {
                path: "/subscriptions/plans".to_string(),
                component: "SubscriptionPlans".to_string(),
                title: "Subscription Plans".to_string(),
            },
            Route {
                path: "/subscriptions/menu".to_string(),
                component: "WeeklyMenuManager".to_string(),
                title: "Weekly Menu Manager".to_string(),
            },
            Route {
                path: "/subscriptions/kds".to_string(),
                component: "SubscriptionKDS".to_string(),
                title: "Subscription KDS".to_string(),
            },
            Route {
                path: "/subscriptions/dispatch".to_string(),
                component: "ParcelDispatchScreen".to_string(),
                title: "Parcel Dispatch".to_string(),
            },
        ];

        serde_wasm_bindgen::to_value(&routes).unwrap()
    }

    #[wasm_bindgen]
    pub fn validate_config(&self, config_json: &str) -> bool {
        // Validate plugin configuration
        match serde_json::from_str::<serde_json::Value>(config_json) {
            Ok(_) => true,
            Err(_) => false,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct PluginInfo {
    name: String,
    version: String,
    author: String,
    description: String,
}

#[derive(Serialize, Deserialize)]
struct Route {
    path: String,
    component: String,
    title: String,
}

#[wasm_bindgen(start)]
pub fn main() {
    log("✅ Subscription Meals WASM module loaded");
}

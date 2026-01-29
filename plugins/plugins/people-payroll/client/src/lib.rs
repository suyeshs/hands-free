use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format!($($t)*)))
}

#[wasm_bindgen]
pub fn init() -> String {
    console_log!("[people-payroll WASM] Initialized v2.2.0");
    "people-payroll-v2.2.0".to_string()
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "2.2.0".to_string()
}

// TODO: Add plugin-specific business logic functions here

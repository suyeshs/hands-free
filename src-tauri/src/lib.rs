mod database;
mod config;
mod dashboard_manager;
mod storage;
mod network;
mod commands;

use config::{get_aggregator_config, update_aggregator_config, get_platform_selectors};
use dashboard_manager::{
    open_swiggy_dashboard,
    open_zomato_dashboard,
    close_dashboard,
    process_extracted_orders,
    notify_new_orders,
    reload_dashboard,
};
use commands::auth::{
    check_device_registration,
    manager_login_start,
    manager_login_verify,
    manager_totp_verify,
    register_device,
    manager_logout,
    check_manager_auth,
    get_manager_session,
};
use commands::staff_auth::{
    hash_staff_pin,
    verify_staff_pin,
    is_valid_pin,
    check_staff_login_rate_limit,
    record_failed_login_attempt,
    clear_failed_login_attempts,
    set_staff_session,
    staff_logout,
    get_staff_session,
    is_staff_authenticated,
    StaffSessionState,
};
use std::sync::Mutex;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:pos.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "create initial tables",
                            sql: database::INIT_SQL,
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "create staff authentication tables",
                            sql: include_str!("../migrations/001_staff_users.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .manage(Mutex::new(StaffSessionState::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            // Dashboard management
            open_swiggy_dashboard,
            open_zomato_dashboard,
            close_dashboard,
            reload_dashboard,
            // Order processing
            process_extracted_orders,
            notify_new_orders,
            // Configuration
            get_aggregator_config,
            update_aggregator_config,
            get_platform_selectors,
            // Authentication - Manager
            check_device_registration,
            manager_login_start,
            manager_login_verify,
            manager_totp_verify,
            register_device,
            manager_logout,
            check_manager_auth,
            get_manager_session,
            // Authentication - Staff
            hash_staff_pin,
            verify_staff_pin,
            is_valid_pin,
            check_staff_login_rate_limit,
            record_failed_login_attempt,
            clear_failed_login_attempts,
            set_staff_session,
            staff_logout,
            get_staff_session,
            is_staff_authenticated,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

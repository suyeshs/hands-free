// Suppress warnings that Tauri CLI treats as errors with -D warnings
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]

mod database;
mod config;
mod dashboard_manager;
mod storage;
mod network;
mod commands;
mod lan_sync;
mod print_service;
mod sync;
// mod i18n; // WIP - Not tracked in git yet

use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use tauri::Manager;
use config::{get_aggregator_config, update_aggregator_config, get_platform_selectors};
use dashboard_manager::{
    open_swiggy_dashboard,
    open_zomato_dashboard,
    close_dashboard,
    process_extracted_orders,
    notify_new_orders,
    reload_dashboard,
    open_unified_aggregator,
    close_unified_aggregator,
    eval_in_dashboard,
    history_extraction_complete,
    // Debug/testing commands
    dashboard_debug_result,
    identify_dashboard_buttons,
    test_dashboard_click,
    get_dashboard_page_state,
    navigate_dashboard_tab,
    verify_dashboard_selectors,
    // Window management
    minimize_aggregator_dashboards,
    focus_main_window,
    are_dashboards_open,
    switch_aggregator_tab,
    // Extraction service
    start_extraction_service,
    stop_extraction_service,
    get_extraction_service_status,
    execute_aggregator_action,
    get_all_order_states,
    process_extracted_states,
    order_action_result,
};
use commands::auth::{
    check_device_registration,
    manager_login_start,
    manager_login_verify,
    manager_totp_verify,
    register_device,
    clear_device_registration,
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
use commands::printer::{
    get_system_printers,
    scan_network_printers,
    test_printer_connection,
    send_to_network_printer,
    print_to_system_printer,
    get_local_subnet,
    print_html_content,
};
use commands::print_service::{
    start_mdns_print_service,
    stop_mdns_print_service,
    get_mdns_print_service_status,
    discover_mdns_print_services,
    send_remote_print_request,
};
use lan_sync::server::{
    start_lan_server,
    stop_lan_server,
    get_lan_server_status,
    broadcast_order,
    broadcast_order_status,
    get_lan_clients,
};
use lan_sync::client::{
    discover_lan_servers,
    connect_lan_server,
    disconnect_lan_server,
    get_lan_client_status,
};
use database::encrypted::{
    init_encrypted_storage,
    store_secret,
    get_secret,
    delete_secret_cmd,
};
use sync::commands::{
    init_sync,
    start_auto_sync,
    stop_auto_sync,
    trigger_sync,
    get_sync_status,
    get_queue_stats,
    clear_failed_queue,
    process_offline_queue,
    sync_floor_plan_to_cloud,
    SyncSchedulerState,
};
// use i18n::commands::{
//     get_translations,
//     get_translation,
//     update_tenant_translation,
//     delete_tenant_translation,
//     get_tenant_overrides,
//     get_translation_keys,
//     get_user_language,
//     set_user_language,
//     transliterate_text,
//     transliterate_batch,
// };
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
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_barcode_scanner::init())?;

            // Initialize sync scheduler state
            let db_path = app.path().app_data_dir()
                .unwrap()
                .join("pos.db");

            let db = rusqlite::Connection::open(&db_path)
                .expect("Failed to open database for sync");

            // Initialize sync tables
            sync::init_sync_system(&db).expect("Failed to init sync system");

            let db_connection = Arc::new(TokioMutex::new(db));
            let sync_state = SyncSchedulerState {
                scheduler: Arc::new(TokioMutex::new(None)),
                db: db_connection,
                config: Arc::new(TokioMutex::new(sync::SyncConfig {
                    tenant_id: String::new(),
                    api_base_url: String::new(),
                    enable_auto_sync: false,
                })),
            };

            app.manage(sync_state);

            Ok(())
        })
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
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "create table sessions for guest tracking",
                            sql: include_str!("../migrations/002_table_sessions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "create aggregator orders table",
                            sql: include_str!("../migrations/003_aggregator_orders.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "add KOT tracking columns to table sessions",
                            sql: include_str!("../migrations/004_table_session_kot_records.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "create KDS orders table",
                            sql: include_str!("../migrations/005_kds_orders.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "create sales transactions table",
                            sql: include_str!("../migrations/006_sales_transactions.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 8,
                            description: "create daily cash registers table",
                            sql: include_str!("../migrations/007_daily_cash_registers.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 9,
                            description: "remove demo users for security",
                            sql: include_str!("../migrations/008_remove_demo_users.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 10,
                            description: "create cash payouts table",
                            sql: include_str!("../migrations/009_cash_payouts.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 11,
                            description: "create inventory management tables",
                            sql: include_str!("../migrations/010_inventory.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 12,
                            description: "add picked_up_at to aggregator orders",
                            sql: include_str!("../migrations/011_aggregator_picked_up.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 13,
                            description: "add archived_at to aggregator orders",
                            sql: include_str!("../migrations/012_aggregator_archived.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 14,
                            description: "create out of stock items table",
                            sql: include_str!("../migrations/013_out_of_stock.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        // NOTE: Versions 15-17 are SKIPPED intentionally
                        // They were used by WIP features in v3.0 (sync tables, i18n)
                        // To avoid migration conflicts on upgrade, we skip to version 18
                        tauri_plugin_sql::Migration {
                            version: 18,
                            description: "create sales sync metadata tables",
                            sql: include_str!("../migrations/014_sales_sync.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 19,
                            description: "create order mappings table",
                            sql: include_str!("../migrations/015_order_mappings.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 20,
                            description: "create attendance records table",
                            sql: include_str!("../migrations/016_attendance_records.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 21,
                            description: "create weekly roster table",
                            sql: include_str!("../migrations/017_weekly_roster.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 22,
                            description: "create leave management tables",
                            sql: include_str!("../migrations/018_leave_management.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 23,
                            description: "add attendance sync metadata",
                            sql: include_str!("../migrations/019_attendance_sync.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 24,
                            description: "add floor plan sync tracking columns",
                            sql: include_str!("../migrations/023_floor_plan_sync.sql"),
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
            open_unified_aggregator,
            close_unified_aggregator,
            // Order processing
            process_extracted_orders,
            notify_new_orders,
            // History extraction
            eval_in_dashboard,
            history_extraction_complete,
            // Debug/testing commands
            dashboard_debug_result,
            identify_dashboard_buttons,
            test_dashboard_click,
            get_dashboard_page_state,
            navigate_dashboard_tab,
            verify_dashboard_selectors,
            // Window management
            minimize_aggregator_dashboards,
            focus_main_window,
            are_dashboards_open,
            switch_aggregator_tab,
            // Extraction service
            start_extraction_service,
            stop_extraction_service,
            get_extraction_service_status,
            execute_aggregator_action,
            get_all_order_states,
            process_extracted_states,
            order_action_result,
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
            clear_device_registration,
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
            // Printer Discovery & Management
            get_system_printers,
            scan_network_printers,
            test_printer_connection,
            send_to_network_printer,
            print_to_system_printer,
            get_local_subnet,
            print_html_content,
            // mDNS Print Service (LAN printing)
            start_mdns_print_service,
            stop_mdns_print_service,
            get_mdns_print_service_status,
            discover_mdns_print_services,
            send_remote_print_request,
            // LAN Sync - Server (POS)
            start_lan_server,
            stop_lan_server,
            get_lan_server_status,
            broadcast_order,
            broadcast_order_status,
            get_lan_clients,
            // LAN Sync - Client (KDS/BDS)
            discover_lan_servers,
            connect_lan_server,
            disconnect_lan_server,
            get_lan_client_status,
            // Encrypted Storage (SQLCipher)
            init_encrypted_storage,
            store_secret,
            get_secret,
            delete_secret_cmd,
            // Cloud Sync
            init_sync,
            start_auto_sync,
            stop_auto_sync,
            trigger_sync,
            get_sync_status,
            get_queue_stats,
            clear_failed_queue,
            sync_floor_plan_to_cloud,
            process_offline_queue,
            // I18n - Multilingual Support (WIP - Not tracked in git yet)
            // get_translations,
            // get_translation,
            // update_tenant_translation,
            // delete_tenant_translation,
            // get_tenant_overrides,
            // get_translation_keys,
            // get_user_language,
            // set_user_language,
            // transliterate_text,
            // transliterate_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

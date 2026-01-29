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
mod i18n;
mod webserver;
mod services;
mod models;
mod utils;

use commands::*; // Import all command functions
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
use commands::settings::{
    get_restaurant_settings,
    save_restaurant_settings,
};
use commands::tenant::{
    get_tenant_config,
    save_tenant_config,
    clear_tenant_config,
};
use commands::wizard::{
    get_setup_wizard_state,
    save_setup_wizard_state,
    reset_setup_wizard_state,
    cleanup_provisioning_websocket,
};
use commands::images::{
    upload_image_to_cloudflare,
    upload_images_bulk,
};
use commands::inventory::{
    // Suppliers
    get_suppliers,
    get_supplier,
    create_supplier,
    update_supplier,
    delete_supplier,
    // Items
    get_inventory_items,
    create_inventory_item,
    update_inventory_item,
    delete_inventory_item,
    adjust_inventory_stock,
    // Alerts
    get_low_stock_alerts,
    get_expiring_soon_alerts,
    get_inventory_summary,
    // Recipes
    get_recipe_ingredients,
    add_recipe_ingredient,
    remove_recipe_ingredient,
    // Documents & Transactions
    save_inventory_document,
    get_item_transactions,
    // Sync Queue
    mark_inventory_sync_pending,
    get_pending_inventory_syncs,
    clear_inventory_sync_queue,
};
use commands::tunnel::{
    start_cloudflare_tunnel,
    stop_cloudflare_tunnel,
    get_tunnel_url,
    is_tunnel_running,
    restart_tunnel,
    check_tunnel_health,
    start_tunnel_watchdog,
};
use commands::table_tokens::{
    generate_table_token,
    validate_table_token,
    get_table_token,
    generate_tokens_for_all_tables,
    cleanup_expired_tokens,
};
use i18n::{
    get_translations,
    get_translation,
    update_tenant_translation,
    delete_tenant_translation,
    get_tenant_overrides,
    get_translation_keys,
    get_user_language,
    set_user_language,
    transliterate_text,
    transliterate_batch,
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

// ============================================================================
// Handsfree Setup Agent Commands
// ============================================================================

#[tauri::command]
async fn setup_agent_create_session(
    tenant_id: String,
    language: String,
    app: tauri::AppHandle,
) -> Result<models::SessionInfo, String> {
    // Get database path
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("pos.db")
        .to_string_lossy()
        .to_string();

    services::handsfree_setup_agent::create_agent_session(tenant_id, language, db_path).await
}

#[tauri::command]
async fn setup_agent_send_audio(
    session_id: String,
    audio_data: Vec<u8>,
) -> Result<(), String> {
    let agent = services::handsfree_setup_agent::get_agent_session(&session_id).await?;
    let agent_lock = agent.lock().await;
    agent_lock.send_audio(audio_data).await
}

#[tauri::command]
async fn setup_agent_stop_session(session_id: String) -> Result<(), String> {
    let agent = services::handsfree_setup_agent::get_agent_session(&session_id).await?;
    let mut agent_lock = agent.lock().await;
    agent_lock.shutdown().await?;

    // Remove from sessions map
    services::handsfree_setup_agent::remove_agent_session(&session_id).await?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

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

            // Start local web server for QR code ordering in separate thread
            // (actix-web has its own runtime and can't run in Tauri's async runtime)
            let app_handle = app.handle().clone();
            let db_path_str = db_path.to_string_lossy().to_string();

            std::thread::spawn(move || {
                println!("[Main] Starting QR ordering web server...");
                // actix-web will create its own runtime
                actix_web::rt::System::new().block_on(async move {
                    if let Err(e) = webserver::start_ordering_server(app_handle, db_path_str, 3000).await {
                        eprintln!("[Main] Web server error: {}", e);
                    }
                })
            });

            // Start tunnel watchdog for auto-restart on failure
            let watchdog_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_tunnel_watchdog(watchdog_handle).await;
            });

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
                        // NOTE: All migrations 2+ are handled by dynamic migrations from R2
                        // This allows deploying migration fixes without app rebuild
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
            // Restaurant Settings
            get_restaurant_settings,
            save_restaurant_settings,
            // Tenant Configuration
            get_tenant_config,
            save_tenant_config,
            clear_tenant_config,
            // Setup Wizard State
            get_setup_wizard_state,
            save_setup_wizard_state,
            reset_setup_wizard_state,
            cleanup_provisioning_websocket,
            // I18n - Multilingual Support
            get_translations,
            get_translation,
            update_tenant_translation,
            delete_tenant_translation,
            get_tenant_overrides,
            get_translation_keys,
            get_user_language,
            set_user_language,
            transliterate_text,
            transliterate_batch,
            // Translation Generation (Sarvam AI)
            generate_translations,
            export_translations_to_json,
            check_translations_status,
            // Image Upload
            upload_image_to_cloudflare,
            upload_images_bulk,
            // Inventory Management - Suppliers
            get_suppliers,
            get_supplier,
            create_supplier,
            update_supplier,
            delete_supplier,
            // Inventory Management - Items
            get_inventory_items,
            create_inventory_item,
            update_inventory_item,
            delete_inventory_item,
            adjust_inventory_stock,
            // Inventory Management - Alerts
            get_low_stock_alerts,
            get_expiring_soon_alerts,
            get_inventory_summary,
            // Inventory Management - Recipes
            get_recipe_ingredients,
            add_recipe_ingredient,
            remove_recipe_ingredient,
            // Inventory Management - Documents & Transactions
            save_inventory_document,
            get_item_transactions,
            // Inventory Management - Sync Queue
            mark_inventory_sync_pending,
            get_pending_inventory_syncs,
            clear_inventory_sync_queue,
            // Cloudflare Tunnel Management
            start_cloudflare_tunnel,
            stop_cloudflare_tunnel,
            get_tunnel_url,
            is_tunnel_running,
            restart_tunnel,
            check_tunnel_health,
            // Table Token Management
            generate_table_token,
            validate_table_token,
            get_table_token,
            generate_tokens_for_all_tables,
            cleanup_expired_tokens,
            // D1 Database Provisioning
            provision_d1_schema,
            check_wrangler_installed,
            get_wrangler_version,
            extract_sqlite_schema,
            provision_d1_via_worker,
            table_exists,
            query_sqlite,
            // D1 Sync (Schema + Data)
            provision_d1_full,
            sync_to_d1,
            check_d1_status,
            // Device-User Alignment
            configure_device_for_user,
            get_user_device_preference,
            set_user_device_preference,
            record_user_logout,
            set_auto_adapt_mode,
            get_device_login_history,
            // Dynamic Migrations
            sync_dynamic_migrations,
            get_migration_history,
            apply_migration_sql,
            // HTTP Fetch (workaround for Tauri plugin bug)
            http_fetch,
            // Combo Management
            get_combo_filter_keywords,
            save_combo_filter_keyword,
            delete_combo_filter_keyword,
            // Chain Location Management
            create_chain,
            store_location_tenant,
            get_chain_locations,
            get_current_tenant_id,
            get_chain,
            get_chain_by_master_tenant,
            update_location_status,
            get_location_by_tenant_id,
            delete_location,
            // Multi-Location Menu Sync
            fetch_and_load_master_menu,
            // Handsfree Setup Agent (Gemini Live)
            setup_agent_create_session,
            setup_agent_send_audio,
            setup_agent_stop_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

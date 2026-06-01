// Suppress warnings that Tauri CLI treats as errors with -D warnings
#![allow(dead_code)]
#![allow(unused_imports)]
#![allow(unused_variables)]

/// Get database filename based on build type
/// Dev builds use pos-dev.db, production builds use guanix.db
pub fn get_db_filename() -> &'static str {
    if cfg!(debug_assertions) {
        "pos-dev.db"
    } else {
        "guanix.db"
    }
}

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
mod migrations;

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
    get_restaurant_settings_location_info,
};
use commands::device_settings::{
    get_device_settings,
    save_device_settings,
    update_lan_server_settings,
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
// Inventory commands come in via `use commands::*` above (see commands/mod.rs re-exports).
use commands::plugin::{
    install_plugin,
    is_plugin_installed,
    get_installed_plugins,
    uninstall_plugin,
    enable_plugin,
};
use commands::subscription::{
    get_subscription_stats_local,
    get_subscription_customers_local,
    generate_delivery_routes,
    export_delivery_route_pdf,
    sync_subscription_data,
    get_subscription_plans,
    create_subscription_plan,
    update_subscription_plan,
    delete_subscription_plan,
    toggle_subscription_plan_active,
};
use commands::tunnel::{
    start_named_tunnel,
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
    probe_lan_server,
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

#[tauri::command]
async fn check_db_exists(app: tauri::AppHandle) -> Result<bool, String> {
    use std::path::PathBuf;

    // Get app data directory
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Build database path using the correct filename for build type
    let db_filename = get_db_filename();
    let db_path: PathBuf = app_data_dir.join(db_filename);

    // Check if file exists
    Ok(db_path.exists())
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
    // Get database path - use different DB for dev/prod
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join(get_db_filename())
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

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init());

    // Auto-update plugin (desktop only — Android/iOS use store updates)
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .setup(|app| {
            // Initialize database path
            // Use different database for dev (debug) and production (release)
            println!("[Setup] Using database: {} (debug: {})", get_db_filename(), cfg!(debug_assertions));

            let db_path = app.path().app_data_dir()
                .unwrap()
                .join(get_db_filename());

            // Run migrations automatically on startup
            println!("[Setup] Database path: {:?}", db_path);
            println!("[Setup] Running core migrations...");

            match migrations::run_migrations(&db_path) {
                Ok(_) => println!("[Setup] ✅ Migrations completed successfully"),
                Err(e) => eprintln!("[Setup] ⚠️  Migration error (non-fatal): {}", e),
            }

            // Open database connection for sync system
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

            // QR ordering and tunnel are now managed via settings
            // No automatic startup - they start when explicitly enabled in Settings
            // Use start_cloudflare_tunnel() and webserver commands to enable

            Ok(())
        })
        .plugin({
            // Use database name based on build type (dev/prod)
            // Frontend now uses matching DB_NAME constant
            let db_filename = get_db_filename();
            let db_url = format!("sqlite:{}", db_filename);

            println!("[Setup] SQL Plugin using database: {}", db_url);

            // NOTE: Database migrations are now handled by the Rust migration system (migrations.rs)
            // Only base tables are created automatically. Plugin tables are installed via plugin system.
            // tauri-plugin-sql is used only for query execution, not migrations.
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    &db_url,
                    vec![
                        // No automatic migrations - handled by migrations.rs
                    ],
                )
                .build()
        })
        .manage(Mutex::new(StaffSessionState::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            check_db_exists,
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
            probe_lan_server,
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
            get_restaurant_settings_location_info,
            // Device Settings
            get_device_settings,
            save_device_settings,
            update_lan_server_settings,
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
            // Inventory - Suppliers
            get_suppliers,
            get_supplier,
            create_supplier,
            update_supplier,
            delete_supplier,
            // Inventory - Items
            get_inventory_items,
            create_inventory_item,
            update_inventory_item,
            delete_inventory_item,
            adjust_inventory_stock,
            // Inventory - Alerts & summary
            get_low_stock_alerts,
            get_expiring_soon_alerts,
            get_inventory_summary,
            // Inventory - Recipes
            get_recipe_ingredients,
            add_recipe_ingredient,
            remove_recipe_ingredient,
            // Inventory - Docs, txns, sync queue
            save_inventory_document,
            get_item_transactions,
            mark_inventory_sync_pending,
            get_pending_inventory_syncs,
            clear_inventory_sync_queue,
            // Cloudflare Tunnel Management
            start_named_tunnel,
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
            sync_schema_to_d1,
            table_exists,
            query_sqlite,
            execute_sqlite,
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
            // Tenant Switching
            get_accessible_tenants,
            get_current_tenant_context,
            switch_tenant,
            // Location Activation
            validate_activation_code,
            configure_as_location,
            get_activation_status,
            // Network/WiFi Detection
            get_current_wifi_ssid,
            is_on_wifi,
            // reCamera Discovery & Configuration
            scan_recameras,
            test_recamera_connection,
            configure_recamera_wifi,
            get_recamera_network_status,
            // Handsfree Setup Agent (Gemini Live)
            setup_agent_create_session,
            setup_agent_send_audio,
            setup_agent_stop_session,
            // Manual Database Migrations
            run_core_migrations,
            check_migration_status,
            // Plugin Management
            install_plugin,
            is_plugin_installed,
            get_installed_plugins,
            uninstall_plugin,
            enable_plugin,
            // Subscription Meals Plugin
            get_subscription_stats_local,
            get_subscription_customers_local,
            generate_delivery_routes,
            export_delivery_route_pdf,
            sync_subscription_data,
            get_subscription_plans,
            create_subscription_plan,
            update_subscription_plan,
            delete_subscription_plan,
            toggle_subscription_plan_active,
            // Social Media Campaigns Plugin
            store_oauth_token,
            get_oauth_token,
            store_api_credentials,
            check_api_credentials,
            secure_social_api_call,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

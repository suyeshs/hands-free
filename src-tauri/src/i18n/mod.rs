// ============================================================================
// I18N MODULE - Multilingual Support System
// ============================================================================
// Provides translation services for the POS application with:
// - Database-driven translations (SQLite storage)
// - Per-tenant customization (restaurant-specific terminology)
// - Multi-language support (13+ languages)
// - Fallback strategy (tenant override → base translation → English default)
// - Admin UI integration for label customization
// ============================================================================

pub mod service;
pub mod commands;

pub use service::TranslationService;
pub use commands::*;

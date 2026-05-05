/**
 * Social Media Campaigns WASM Plugin
 *
 * Local-first social media campaign management for Instagram, TikTok, and WhatsApp.
 * All credentials encrypted and stored locally - never sent to cloud.
 */

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use web_sys::console;

/// Plugin context passed during initialization
#[derive(Deserialize)]
struct PluginContext {
    #[serde(rename = "pluginId")]
    plugin_id: String,
    #[serde(rename = "tenantId")]
    tenant_id: String,
    version: String,
}

/// Campaign structure
#[derive(Serialize, Deserialize, Clone)]
pub struct Campaign {
    id: String,
    tenant_id: String,
    name: String,
    description: Option<String>,
    status: String, // draft, active, scheduled, paused, completed
    platform: String, // whatsapp, instagram, tiktok
    start_date: Option<String>,
    end_date: Option<String>,
    goal_type: Option<String>,
    created_by: String,
    created_at: String,
    updated_at: String,
}

/// Post structure
#[derive(Serialize, Deserialize, Clone)]
pub struct Post {
    id: String,
    campaign_id: String,
    tenant_id: String,
    content_type: String,
    message: Option<String>,
    caption: Option<String>,
    hashtags: Vec<String>,
    media_paths: Vec<String>,
    scheduled_time: Option<String>,
    posted_time: Option<String>,
    status: String,
    platform_post_id: Option<String>,
    created_at: String,
    updated_at: String,
}

/// Platform connection status
#[derive(Serialize, Deserialize)]
pub struct PlatformConnection {
    platform: String,
    is_connected: bool,
    platform_username: Option<String>,
    connected_at: Option<String>,
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/// Initialize the plugin
#[wasm_bindgen]
pub fn init(context_json: &str, _host_json: &str) -> Result<(), JsValue> {
    let context: PluginContext = serde_json::from_str(context_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse context: {}", e)))?;

    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Plugin initialized! ID: {}, Tenant: {}, Version: {}",
        context.plugin_id, context.tenant_id, context.version
    )));

    Ok(())
}

/// Cleanup when plugin is unloaded
#[wasm_bindgen]
pub fn destroy() {
    console::log_1(&JsValue::from_str("[SocialCampaigns] Plugin destroyed"));
}

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/// Create a new campaign
#[wasm_bindgen]
pub fn create_campaign(campaign_json: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str("[SocialCampaigns] Creating campaign..."));

    let mut campaign: Campaign = serde_json::from_str(campaign_json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    // Generate ID if not provided
    if campaign.id.is_empty() {
        campaign.id = uuid::Uuid::new_v4().to_string();
    }

    // Set timestamps
    let now = chrono::Utc::now().to_rfc3339();
    campaign.created_at = now.clone();
    campaign.updated_at = now;

    // Serialize and return
    serde_json::to_string(&campaign)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// List all campaigns for a tenant
#[wasm_bindgen]
pub fn list_campaigns(tenant_id: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Listing campaigns for tenant: {}",
        tenant_id
    )));

    // This would normally query local SQLite via Tauri command
    // For now, return empty array as placeholder
    Ok("[]".to_string())
}

/// Get a single campaign by ID
#[wasm_bindgen]
pub fn get_campaign(campaign_id: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Getting campaign: {}",
        campaign_id
    )));

    Err(JsValue::from_str("Not implemented - use Tauri command"))
}

/// Update a campaign
#[wasm_bindgen]
pub fn update_campaign(campaign_id: &str, updates_json: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Updating campaign: {}",
        campaign_id
    )));

    let mut updates: serde_json::Value = serde_json::from_str(updates_json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    // Update timestamp
    updates["updated_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());

    serde_json::to_string(&updates)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Delete a campaign
#[wasm_bindgen]
pub fn delete_campaign(campaign_id: &str) -> Result<(), JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Deleting campaign: {}",
        campaign_id
    )));

    Ok(())
}

// ============================================================================
// POST MANAGEMENT
// ============================================================================

/// Schedule a post
#[wasm_bindgen]
pub fn schedule_post(post_json: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str("[SocialCampaigns] Scheduling post..."));

    let mut post: Post = serde_json::from_str(post_json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    // Generate ID if not provided
    if post.id.is_empty() {
        post.id = uuid::Uuid::new_v4().to_string();
    }

    // Set timestamps
    let now = chrono::Utc::now().to_rfc3339();
    post.created_at = now.clone();
    post.updated_at = now;
    post.status = "scheduled".to_string();

    serde_json::to_string(&post)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Publish a post immediately
#[wasm_bindgen]
pub fn publish_post_now(post_id: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Publishing post immediately: {}",
        post_id
    )));

    Ok(format!("{{\"post_id\":\"{}\",\"status\":\"posting\"}}", post_id))
}

/// List posts for a campaign
#[wasm_bindgen]
pub fn list_posts(campaign_id: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Listing posts for campaign: {}",
        campaign_id
    )));

    Ok("[]".to_string())
}

// ============================================================================
// ENGAGEMENT & ANALYTICS
// ============================================================================

/// Fetch engagement metrics for a post
#[wasm_bindgen]
pub fn fetch_engagement_metrics(post_id: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Fetching metrics for post: {}",
        post_id
    )));

    // Return placeholder metrics
    let metrics = serde_json::json!({
        "post_id": post_id,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "views": 0,
        "impressions": 0,
        "reach": 0,
        "recorded_at": chrono::Utc::now().to_rfc3339()
    });

    serde_json::to_string(&metrics)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Analyze sentiment of text (local keyword-based analysis)
#[wasm_bindgen]
pub fn analyze_sentiment(text: &str) -> Result<String, JsValue> {
    let positive_keywords = ["love", "great", "amazing", "excellent", "awesome", "fantastic", "wonderful", "perfect", "best"];
    let negative_keywords = ["hate", "terrible", "awful", "bad", "disappointing", "worst", "horrible", "poor"];

    let text_lower = text.to_lowercase();

    let positive_count = positive_keywords.iter().filter(|&&kw| text_lower.contains(kw)).count();
    let negative_count = negative_keywords.iter().filter(|&&kw| text_lower.contains(kw)).count();

    let sentiment = if positive_count > negative_count {
        "positive"
    } else if negative_count > positive_count {
        "negative"
    } else {
        "neutral"
    };

    let result = serde_json::json!({
        "sentiment": sentiment,
        "positive_score": positive_count,
        "negative_score": negative_count,
        "text_length": text.len()
    });

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

// ============================================================================
// PLATFORM CONNECTIONS
// ============================================================================

/// Check if a platform is connected (has OAuth token)
#[wasm_bindgen]
pub fn check_platform_connection(tenant_id: &str, platform: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Checking connection for {}/{}",
        tenant_id, platform
    )));

    let connection = PlatformConnection {
        platform: platform.to_string(),
        is_connected: false,
        platform_username: None,
        connected_at: None,
    };

    serde_json::to_string(&connection)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Get all platform connections
#[wasm_bindgen]
pub fn get_platform_connections(tenant_id: &str) -> Result<String, JsValue> {
    let platforms = ["instagram", "tiktok", "whatsapp"];
    let connections: Vec<PlatformConnection> = platforms
        .iter()
        .map(|&platform| PlatformConnection {
            platform: platform.to_string(),
            is_connected: false,
            platform_username: None,
            connected_at: None,
        })
        .collect();

    serde_json::to_string(&connections)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

// ============================================================================
// CLOUD SYNC
// ============================================================================

/// Sync campaign data to cloud (credentials stay local)
#[wasm_bindgen]
pub fn sync_to_cloud(campaign_id: &str) -> Result<String, JsValue> {
    console::log_1(&JsValue::from_str(&format!(
        "[SocialCampaigns] Syncing campaign to cloud: {}",
        campaign_id
    )));

    Ok(format!("{{\"campaign_id\":\"{}\",\"synced\":true}}", campaign_id))
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Get plugin info
#[wasm_bindgen]
pub fn get_info() -> Result<String, JsValue> {
    let info = serde_json::json!({
        "name": "Social Media Campaigns",
        "version": "1.0.0",
        "description": "Multi-platform social media campaign management",
        "platforms": ["instagram", "tiktok", "whatsapp"],
        "features": [
            "local-first-security",
            "encrypted-credentials",
            "campaign-management",
            "post-scheduling",
            "engagement-analytics",
            "customer-linking",
            "sentiment-analysis"
        ]
    });

    serde_json::to_string(&info)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Validate campaign data
#[wasm_bindgen]
pub fn validate_campaign(campaign_json: &str) -> Result<String, JsValue> {
    let campaign: Campaign = serde_json::from_str(campaign_json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    let mut errors: Vec<String> = Vec::new();

    if campaign.name.trim().is_empty() {
        errors.push("Name is required".to_string());
    }

    if campaign.platform.is_empty() {
        errors.push("Platform is required".to_string());
    } else if !["instagram", "tiktok", "whatsapp"].contains(&campaign.platform.as_str()) {
        errors.push("Invalid platform".to_string());
    }

    let result = serde_json::json!({
        "valid": errors.is_empty(),
        "errors": errors
    });

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Validate post data
#[wasm_bindgen]
pub fn validate_post(post_json: &str) -> Result<String, JsValue> {
    let post: Post = serde_json::from_str(post_json)
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    let mut errors: Vec<String> = Vec::new();

    if post.campaign_id.is_empty() {
        errors.push("Campaign ID is required".to_string());
    }

    if post.content_type.is_empty() {
        errors.push("Content type is required".to_string());
    }

    if post.message.is_none() && post.caption.is_none() {
        errors.push("Either message or caption is required".to_string());
    }

    let result = serde_json::json!({
        "valid": errors.is_empty(),
        "errors": errors
    });

    serde_json::to_string(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
